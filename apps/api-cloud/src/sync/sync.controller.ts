import { Controller, Get, Post, Param, Body, Inject, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import * as schema from '@omr-prod/database';
import { SyncScanDto } from './dto/sync-scan.dto';

@Controller('sync')
export class SyncController {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly db: any,
  ) {}

  @Post('scans')
  async syncScanResult(@Body() body: SyncScanDto) {
    console.log(`📥 Sync Request: ${body.original_sha} from ${body.machine_id}`);

    // 1. VERIFY MACHINE ENROLLMENT
    const [machine] = await this.db.select()
        .from(schema.machines)
        .where(and(
            eq(schema.machines.machineId, body.machine_id),
            eq(schema.machines.status, 'active')
        ))
        .limit(1);

    if (!machine) {
        console.error(`❌ Unauthorized Machine: ${body.machine_id}`);
        throw new UnauthorizedException('Machine not enrolled or inactive');
    }

    // Update heartbeat
    await this.db.update(schema.machines)
        .set({ lastHeartbeatAt: new Date() })
        .where(eq(schema.machines.id, machine.id));

    // Use machine's school ID if payload doesn't have one
    const schoolId = body.school_id || machine.schoolId;

    // --- GRADING LOGIC ---
    const studentAnswers = body.raw_data?.answers || {};
    const gradingDetails: any = {};
    let totalScore = 0;
    let maxPossibleScore = 0;

    for (const subject of Object.keys(studentAnswers)) {
        let [key] = await this.db.select().from(schema.answerKeys)
            .where(and(eq(schema.answerKeys.subject, subject), eq(schema.answerKeys.version, '2026-V1')))
            .limit(1);

        if (!key) {
            const perfectAnswers: any = {};
            for (let i = 1; i <= 40; i++) perfectAnswers[i] = "A";
            const [newKey] = await this.db.insert(schema.answerKeys).values({
                examName: "Standard Admission Test",
                subject: subject,
                version: "2026-V1",
                answers: perfectAnswers,
            }).onConflictDoNothing().returning();
            
            if (newKey) {
                key = newKey;
            } else {
                // If another request created it simultaneously, fetch it
                [key] = await this.db.select().from(schema.answerKeys)
                    .where(and(eq(schema.answerKeys.subject, subject), eq(schema.answerKeys.version, '2026-V1')))
                    .limit(1);
            }
        }

        const correctAnswers = key.answers as Record<string, string>;
        let subjectScore = 0;
        const subjectResults: Record<string, boolean> = {};

        Object.keys(correctAnswers).forEach(qNum => {
            const studentChoice = studentAnswers[subject]?.[qNum]?.answer;
            const isCorrect = studentChoice === correctAnswers[qNum];
            if (isCorrect) subjectScore++;
            subjectResults[qNum] = isCorrect;
        });

        gradingDetails[subject] = {
            score: subjectScore,
            total: Object.keys(correctAnswers).length,
            results: subjectResults
        };

        totalScore += subjectScore;
        maxPossibleScore += Object.keys(correctAnswers).length;
    }

    // 2. PERSIST WITH FORENSIC INTEGRITY
    const [result] = await this.db.insert(schema.scans).values({
      machineId: body.machine_id,
      schoolId: schoolId,
      originalSha: body.original_sha,
      fileName: body.file_name,
      fileUrl: body.file_url,
      confidence: body.confidence,
      reviewRequired: body.review_required,
      status: 'success',
      extracted_data: body.raw_data,
      totalScore: totalScore,
      maxScore: maxPossibleScore,
      gradingDetails: gradingDetails,
    }).onConflictDoNothing({ target: schema.scans.originalSha }).returning();

    if (!result) {
        return { ok: true, status: 'duplicate', message: 'Scan already synced' };
    }

    console.log(`✅ Scored & Synced: ${result.id} (${totalScore}/${maxPossibleScore})`);
    return { ok: true, id: result.id, score: totalScore };
  }

  @Get('stats')
  async getGlobalStats() {
    const scansResult = await this.db.select().from(schema.scans);
    const totalScans = scansResult.length;
    const reviewRequired = scansResult.filter((s: any) => s.reviewRequired).length;
    
    const recentScans = await this.db.select()
        .from(schema.scans)
        .orderBy(schema.scans.createdAt)
        .limit(10);

    return {
        totalScans,
        reviewRequired,
        recentScans: recentScans.map((s: any) => ({
            id: s.id,
            schoolId: s.schoolId,
            machineId: s.machineId,
            totalScore: s.totalScore,
            maxScore: s.maxScore,
            confidence: s.confidence,
            reviewRequired: s.reviewRequired,
            createdAt: s.createdAt,
            studentName: s.extracted_data?.student_info?.first_name?.answer + " " + s.extracted_data?.student_info?.last_name?.answer,
            lrn: s.extracted_data?.student_info?.lrn?.answer
        }))
    };
  }

  @Get('machines/:machineId/operators')
  async getMachineOperators(@Param('machineId') machineId: string) {
    // Also verify machine here
    const [machine] = await this.db.select().from(schema.machines).where(eq(schema.machines.machineId, machineId)).limit(1);
    if (!machine || machine.status !== 'active') throw new UnauthorizedException();

    const operators = await this.db.select().from(schema.users);
    return operators.map((user: any) => ({
      id: user.id,
      email: user.email,
      password_hash: user.passwordHash,
      first_name: user.firstName,
      last_name: user.lastName,
      user_type: user.userType,
    }));
  }
}
