import { Controller, Get, Post, Param, Body, Inject, UnauthorizedException, NotFoundException, Headers, Req } from '@nestjs/common';
import { eq, and, or, inArray, desc, sql, count } from 'drizzle-orm';
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

    // 3. RESOLVE SCHOOL ID (Permissive / Best-Effort)
    // We trust the machine is authorized. We only resolve the ID to satisfy DB constraints.
    const inputSchoolId = body.school_id;
    let schoolId: string | null = null;

    // Try to find the current UUID for this school (by ID or Code)
    if (inputSchoolId) {
        const [resolved] = await this.db.select().from(schema.schools)
            .where(or(
                inputSchoolId.length === 36 ? eq(schema.schools.id, inputSchoolId) : sql`false`,
                eq(schema.schools.code, inputSchoolId)
            )).limit(1);
        if (resolved) schoolId = resolved.id;
    }

    // Fallback: If no school found, use the machine's first school assignment
    if (!schoolId) {
        const [assignment] = await this.db.select().from(schema.machineAssignments)
            .where(and(
                eq(schema.machineAssignments.machineId, machine.id),
                eq(schema.machineAssignments.scope, 'SCHOOL')
            )).limit(1);
        
        if (assignment) {
            schoolId = assignment.scopeValue;
            console.log(`ℹ️ Unrecognized school in payload. Defaulting to machine assignment: ${schoolId}`);
        }
    }

    if (!schoolId) {
        throw new UnauthorizedException('Machine has no authorized school assignments to fall back to.');
    }

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
  async getGlobalStats(@Req() req: any) {
    const user = req.user; // Injected by JwtAuthGuard
    
    // Base queries
    let totalQuery = this.db.select({ value: count() }).from(schema.scans);
    let reviewQuery = this.db.select({ value: count() }).from(schema.scans).where(eq(schema.scans.reviewRequired, true));
    let streamQuery = this.db.select().from(schema.scans);

    // Apply Filters based on RBAC
    if (user && user.visibilityScope !== 'NATIONAL') {
        if (user.visibilityScope === 'SCHOOL') {
            const sId = user.scopeValue;
            totalQuery = totalQuery.where(eq(schema.scans.schoolId, sId));
            reviewQuery = reviewQuery.where(and(eq(schema.scans.reviewRequired, true), eq(schema.scans.schoolId, sId)));
            streamQuery = streamQuery.where(eq(schema.scans.schoolId, sId));
        } else if (user.visibilityScope === 'REGIONAL') {
            const rId = user.scopeValue;
            // Join schools to filter by region
            const regionSchools = this.db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.regionId, rId));
            
            totalQuery = totalQuery.where(inArray(schema.scans.schoolId, regionSchools));
            reviewQuery = reviewQuery.where(and(eq(schema.scans.reviewRequired, true), inArray(schema.scans.schoolId, regionSchools)));
            streamQuery = streamQuery.where(inArray(schema.scans.schoolId, regionSchools));
        }
    }

    const [totalCountResult] = await totalQuery;
    const [reviewCountResult] = await reviewQuery;
    const recentScans = await streamQuery.orderBy(desc(schema.scans.createdAt)).limit(20);

    // Fetch school names for the stream
    const schoolIds = [...new Set(recentScans.map((s: any) => s.schoolId))];
    let schools: any[] = [];
    if (schoolIds.length > 0) {
        schools = await this.db.select({ id: schema.schools.id, name: schema.schools.name })
            .from(schema.schools)
            .where(inArray(schema.schools.id, schoolIds));
    }
    const schoolMap = Object.fromEntries(schools.map(s => [s.id, s.name]));

    return {
        totalScans: Number(totalCountResult.value),
        reviewRequired: Number(reviewCountResult.value),
        recentScans: recentScans.map((s: any) => ({
            id: s.id,
            schoolId: s.schoolId,
            schoolName: schoolMap[s.schoolId] || 'Unknown',
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
    console.log(`🔍 Operator Pull: Machine=${machineId}`);

    // 1. Verify machine
    const [machine] = await this.db.select()
        .from(schema.machines)
        .where(and(
            eq(schema.machines.machineId, machineId),
            eq(schema.machines.secret, machineSecret),
            eq(schema.machines.status, 'active')
        ))
        .limit(1);

    if (!machine) {
        console.error(`❌ Authorization Failed for Machine: ${machineId}`);
        throw new UnauthorizedException('Machine not enrolled, inactive, or invalid secret');
    }

    console.log(`✅ Machine Authorized: ${machine.machineId}`);

    // 2. Get users explicitly assigned to THIS machine
    const assignedUsers = await this.db.select()
        .from(schema.users)
        .innerJoin(schema.userMachines, eq(schema.users.id, schema.userMachines.userId))
        .where(eq(schema.userMachines.machineId, machine.id));
    
    const operators = assignedUsers.map((r: any) => r.users);

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
