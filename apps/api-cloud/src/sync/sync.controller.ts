import { Controller, Get, Post, Param, Body, Inject, UnauthorizedException, NotFoundException, Headers } from '@nestjs/common';
import { eq, and, or, inArray } from 'drizzle-orm';
import * as schema from '@omr-prod/database';
import { SyncScanDto } from './dto/sync-scan.dto';
import { EnrollMachineDto } from './dto/enroll-machine.dto';
import * as crypto from 'crypto';

@Controller('sync')
export class SyncController {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly db: any,
  ) {}

  @Post('register')
  async registerMachine(@Body() body: { machineId: string }) {
    console.log(`🆕 Registration attempt: ${body.machineId}`);

    // Check if machine already exists
    let [machine] = await this.db.select().from(schema.machines)
        .where(eq(schema.machines.machineId, body.machineId))
        .limit(1);

    if (machine) {
        // If it exists, return the existing secret (or we could rotate it)
        return {
            ok: true,
            status: machine.status,
            machineSecret: machine.secret
        };
    }

    // New machine: Create as PENDING
    const secret = crypto.randomBytes(32).toString('hex');
    await this.db.insert(schema.machines).values({
        machineId: body.machineId,
        secret: secret,
        status: 'pending'
    });

    return {
        ok: true,
        status: 'pending',
        machineSecret: secret
    };
  }

  @Post('scans')
  async syncScanResult(
    @Body() body: SyncScanDto,
    @Headers('x-machine-secret') machineSecret: string
  ) {
    // 1. VERIFY MACHINE AUTHORIZATION (Identity + Active Status)
    const [machine] = await this.db.select()
        .from(schema.machines)
        .where(and(
            eq(schema.machines.machineId, body.machine_id),
            eq(schema.machines.secret, machineSecret),
            eq(schema.machines.status, 'active')
        ))
        .limit(1);

    if (!machine) {
        throw new UnauthorizedException('Machine not authorized or pending approval');
    }

    // 2. LOG HEARTBEAT
    await this.db.update(schema.machines)
        .set({ lastHeartbeatAt: new Date() })
        .where(eq(schema.machines.id, machine.id));

    // 3. RESOLVE SCHOOL ID (Resilient Lookup)
    // The edge might send a UUID (which changes on reset) or a stable School Code
    const inputSchoolId = body.school_id;
    if (!inputSchoolId) throw new UnauthorizedException('Missing school identification');

    let resolvedSchool;
    
    // Attempt lookup by UUID first
    if (inputSchoolId.length === 36) { // Basic UUID length check
        [resolvedSchool] = await this.db.select().from(schema.schools)
            .where(eq(schema.schools.id, inputSchoolId)).limit(1);
    }

    // If not found by UUID, lookup by stable School Code
    if (!resolvedSchool) {
        [resolvedSchool] = await this.db.select().from(schema.schools)
            .where(eq(schema.schools.code, inputSchoolId)).limit(1);
    }

    if (!resolvedSchool) {
        console.error(`❌ Sync Rejected: School [${inputSchoolId}] not found in National Registry.`);
        throw new NotFoundException(`School [${inputSchoolId}] not found`);
    }

    const schoolId = resolvedSchool.id;
    console.log(`✅ Syncing for School: ${resolvedSchool.name} (${schoolId})`);

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
  async getMachineOperators(
    @Param('machineId') machineId: string,
    @Headers('x-machine-secret') machineSecret: string
  ) {
    console.log(`🔍 Operator Pull Request`);
    console.log(`   - Machine ID: ${machineId}`);
    console.log(`   - Secret Received: [${machineSecret || 'MISSING'}]`);

    // Also verify machine and secret here
    const [machine] = await this.db.select()
        .from(schema.machines)
        .where(and(
            eq(schema.machines.machineId, machineId),
            eq(schema.machines.secret, machineSecret),
            eq(schema.machines.status, 'active')
        ))
        .limit(1);

    if (!machine) {
        console.error(`❌ Authorization Failed for Machine: ${machineId}. Secret provided: ${machineSecret}`);
        throw new UnauthorizedException('Machine not enrolled, inactive, or invalid secret');
    }

    console.log(`✅ Machine Authorized: ${machine.machineId} (${machine.id})`);

    const assignments = await this.db.select().from(schema.machineAssignments)
        .where(eq(schema.machineAssignments.machineId, machine.id));

    if (assignments.length === 0) return [];

    const schoolIds = assignments.filter((a: any) => a.scope === 'SCHOOL').map((a: any) => a.scopeValue);
    const regionIds = assignments.filter((a: any) => a.scope === 'REGION').map((a: any) => a.scopeValue);

    const conditions = [];

    if (schoolIds.length > 0) {
        conditions.push(inArray(schema.users.schoolId, schoolIds));
    }

    if (regionIds.length > 0) {
        // Find schools in these regions
        const schoolsInRegions = await this.db.select({ id: schema.schools.id }).from(schema.schools)
            .where(inArray(schema.schools.regionId, regionIds));
        const regionSchoolIds = schoolsInRegions.map((s: any) => s.id);
        if (regionSchoolIds.length > 0) {
            conditions.push(inArray(schema.users.schoolId, regionSchoolIds));
        }
    }

    if (conditions.length === 0) return [];

    const operators = await this.db.select().from(schema.users).where(or(...conditions));

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
