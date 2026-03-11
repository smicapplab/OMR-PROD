import { Controller, Get, Post, Param, Body, Inject, UnauthorizedException, NotFoundException, Headers, Req, Query } from '@nestjs/common';
import { eq, and, or, inArray, desc, sql, count } from 'drizzle-orm';
import * as schema from '@omr-prod/database';
import { SyncScanDto } from './dto/sync-scan.dto';
import { EnrollMachineDto } from './dto/enroll-machine.dto';
import * as crypto from 'crypto';
import { AuthService } from '../auth/auth.service';
import { GradingService } from './grading.service';

@Controller('sync')
export class SyncController {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly db: any,
    private readonly authService: AuthService,
    private readonly gradingService: GradingService,
  ) {}

  @Post('register')
  async registerMachine(@Body() body: { machineId: string }) {
    console.log(`🆕 Registration attempt: ${body.machineId}`);

    let [machine] = await this.db.select().from(schema.machines)
        .where(eq(schema.machines.machineId, body.machineId))
        .limit(1);

    if (machine) {
        return { ok: true, status: machine.status, machineSecret: machine.secret };
    }

    const secret = crypto.randomBytes(32).toString('hex');
    await this.db.insert(schema.machines).values({
        machineId: body.machineId,
        secret: secret,
        status: 'pending'
    });

    return { ok: true, status: 'pending', machineSecret: secret };
  }

  @Post('scans')
  async syncScanResult(
    @Body() body: SyncScanDto,
    @Headers('x-machine-secret') machineSecret: string
  ) {
    // 1. VERIFY MACHINE AUTHORIZATION
    const [machine] = await this.db.select()
        .from(schema.machines)
        .where(and(
            eq(schema.machines.machineId, body.machine_id),
            eq(schema.machines.secret, machineSecret),
            eq(schema.machines.status, 'active')
        ))
        .limit(1);

    if (!machine) throw new UnauthorizedException('Machine not authorized or pending approval');

    // 2. LOG HEARTBEAT
    await this.db.update(schema.machines).set({ lastHeartbeatAt: new Date() }).where(eq(schema.machines.id, machine.id));

    // 3. RESOLVE SCHOOL ID
    const inputSchoolId = body.school_id;
    let schoolId: string | null = null;
    let syncStatus = 'success';

    if (inputSchoolId) {
        const [resolved] = await this.db.select().from(schema.schools)
            .where(or(
                inputSchoolId.length === 36 ? eq(schema.schools.id, inputSchoolId) : sql`false`,
                eq(schema.schools.code, inputSchoolId)
            )).limit(1);
        if (resolved) schoolId = resolved.id;
        else syncStatus = 'orphaned';
    } else {
        syncStatus = 'orphaned';
    }

    // 4. AUTHORITATIVE GRADING
    const { totalScore, maxPossibleScore, gradingDetails } = await this.gradingService.gradeScan(body.raw_data);

    // 5. PERSISTENCE & AUDIT
    return this.db.transaction(async (tx: any) => {
        const [existing] = await tx.select().from(schema.scans)
            .where(eq(schema.scans.originalSha, body.original_sha))
            .limit(1);

        if (existing) {
            if (body.is_manually_edited) {
                const incomingStr = JSON.stringify(body.raw_data);
                const existingStr = JSON.stringify(existing.extracted_data);

                if (incomingStr !== existingStr) {
                    await tx.update(schema.scans).set({
                        pending_data: body.raw_data,
                        reviewRequired: true,
                        updatedAt: new Date()
                    }).where(eq(schema.scans.id, existing.id));

                    await tx.insert(schema.correctionLogs).values({
                        scanId: existing.id,
                        action: 'BUBBLE_CORRECTION',
                        oldData: existing.extracted_data,
                        newData: body.raw_data,
                        reason: 'Field Correction Sync',
                        status: 'pending'
                    });
                    
                    return { ok: true, status: 'updated_pending' };
                }
            }
            return { ok: true, status: 'duplicate' };
        }

        const [result] = await tx.insert(schema.scans).values({
            machineId: body.machine_id,
            schoolId: schoolId,
            originalSha: body.original_sha,
            fileName: body.file_name,
            fileUrl: body.file_url,
            confidence: body.confidence,
            reviewRequired: syncStatus === 'orphaned' || body.is_manually_edited === true,
            status: syncStatus,
            extracted_data: body.raw_data,
            totalScore: totalScore,
            maxScore: maxPossibleScore,
            gradingDetails: gradingDetails,
        }).returning();

        if (body.is_manually_edited) {
            await tx.insert(schema.correctionLogs).values({
                scanId: result.id,
                action: 'BUBBLE_CORRECTION',
                oldData: null,
                newData: body.raw_data,
                reason: 'Initial Field Correction',
                status: 'pending'
            });
        }

        console.log(`✅ Scored & Synced: ${result.id} (${totalScore}/${maxPossibleScore})`);
        return { ok: true, id: result.id, score: totalScore };
    });
  }

  @Post('logs')
  async syncActivityLogs(
    @Body() body: { logs: any[] },
    @Headers('x-machine-secret') machineSecret: string
  ) {
    const [machine] = await this.db.select().from(schema.machines)
        .where(and(eq(schema.machines.secret, machineSecret), eq(schema.machines.status, 'active')))
        .limit(1);
    if (!machine) throw new UnauthorizedException();

    if (body.logs.length === 0) return { ok: true };

    const scanCorrections = body.logs.filter(l => l.action === 'SCAN_CORRECTION');
    
    for (const log of scanCorrections) {
        const [scan] = await this.db.select().from(schema.scans).where(eq(schema.scans.originalSha, log.details?.sha)).limit(1);
        if (scan) {
            await this.db.insert(schema.correctionLogs).values({
                scanId: scan.id,
                action: 'BUBBLE_CORRECTION',
                oldData: log.details?.old_data,
                newData: log.details?.new_data,
                reason: `Edge Sync: ${log.details?.reason || 'Manual Correction'}`,
                status: 'pending', // Field corrections start as pending for HQ review
                createdAt: new Date(log.created_at)
            }).onConflictDoNothing();
        }
    }

    return { ok: true, synced: body.logs.length };
  }

  @Get('stats')
  async getGlobalStats(@Req() req: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException();
    const user = await this.authService.verifyToken(authHeader.split(' ')[1]);
    if (!user) throw new UnauthorizedException();

    let totalQuery = this.db.select({ value: count() }).from(schema.scans);
    let reviewQuery = this.db.select({ value: count() }).from(schema.scans).where(eq(schema.scans.reviewRequired, true));
    let streamQuery = this.db.select().from(schema.scans);

    if (user.visibilityScope !== 'NATIONAL') {
        if (user.visibilityScope === 'SCHOOL') {
            totalQuery = totalQuery.where(eq(schema.scans.schoolId, user.scopeValue));
            reviewQuery = reviewQuery.where(and(eq(schema.scans.reviewRequired, true), eq(schema.scans.schoolId, user.scopeValue)));
            streamQuery = streamQuery.where(eq(schema.scans.schoolId, user.scopeValue));
        } else if (user.visibilityScope === 'REGIONAL') {
            const regionSchools = this.db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.regionId, user.scopeValue));
            totalQuery = totalQuery.where(inArray(schema.scans.schoolId, regionSchools));
            reviewQuery = reviewQuery.where(and(eq(schema.scans.reviewRequired, true), inArray(schema.scans.schoolId, regionSchools)));
            streamQuery = streamQuery.where(inArray(schema.scans.schoolId, regionSchools));
        }
    }

    const [[total], [review], recentScans] = await Promise.all([
        totalQuery, reviewQuery, streamQuery.orderBy(desc(schema.scans.createdAt)).limit(20)
    ]);

    const sIds = [...new Set(recentScans.map((s: any) => s.schoolId))].filter(Boolean) as string[];
    const schools = sIds.length > 0 ? await this.db.select({ id: schema.schools.id, name: schema.schools.name }).from(schema.schools).where(inArray(schema.schools.id, sIds)) : [];
    const schoolMap = Object.fromEntries(schools.map((s: any) => [s.id, s.name]));

    return {
        totalScans: Number(total.value),
        reviewRequired: Number(review.value),
        recentScans: recentScans.map((s: any) => ({
            ...s,
            schoolName: schoolMap[s.schoolId] || 'Unknown Institutional Context',
            studentName: `${s.extracted_data?.student_info?.first_name?.answer || ''} ${s.extracted_data?.student_info?.last_name?.answer || ''}`.trim() || 'Unidentified',
            lrn: s.extracted_data?.student_info?.lrn?.answer
        }))
    };
  }

  @Get('scans/:id')
  async getScan(@Param('id') id: string) {
    const [scan] = await this.db.select().from(schema.scans).where(eq(schema.scans.id, id)).limit(1);
    if (!scan) throw new NotFoundException();
    return scan;
  }

  @Get('scans')
  async listScans(
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
    @Query('search') search: string = '',
    @Query('schoolId') schoolId: string = '',
    @Query('regionId') regionId: string = '',
    @Req() req: any
  ) {
    const user = await this.authService.verifyToken(req.headers.authorization?.split(' ')[1]);
    if (!user) throw new UnauthorizedException();

    const l = parseInt(limit);
    const o = parseInt(offset);
    const conditions = [];

    if (user.visibilityScope === 'SCHOOL') conditions.push(eq(schema.scans.schoolId, user.scopeValue));
    else if (user.visibilityScope === 'REGIONAL') {
        const regionSchools = this.db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.regionId, user.scopeValue));
        conditions.push(inArray(schema.scans.schoolId, regionSchools));
    }

    if (schoolId) conditions.push(eq(schema.scans.schoolId, schoolId));
    if (regionId && user.visibilityScope === 'NATIONAL') {
        const regionSchools = this.db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.regionId, regionId));
        conditions.push(inArray(schema.scans.schoolId, regionSchools));
    }

    if (search) {
        const s = `%${search.toLowerCase()}%`;
        conditions.push(or(
            sql`lower(${schema.scans.extracted_data}->'student_info'->'first_name'->>'answer') LIKE ${s}`,
            sql`lower(${schema.scans.extracted_data}->'student_info'->'last_name'->>'answer') LIKE ${s}`,
            sql`(${schema.scans.extracted_data}->'student_info'->'lrn'->>'answer') LIKE ${s}`
        ));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await this.db.select().from(schema.scans).where(whereClause).orderBy(desc(schema.scans.createdAt)).limit(l).offset(o);
    const [totalResult] = await this.db.select({ value: count() }).from(schema.scans).where(whereClause);

    const sIds = [...new Set(items.map((i: any) => i.schoolId))].filter(Boolean) as string[];
    const schoolNames = sIds.length > 0 ? await this.db.select({ id: schema.schools.id, name: schema.schools.name }).from(schema.schools).where(inArray(schema.schools.id, sIds)) : [];
    const schoolMap = Object.fromEntries(schoolNames.map((s: any) => [s.id, s.name]));

    return {
        items: items.map((s: any) => ({
            ...s,
            schoolName: schoolMap[s.schoolId] || 'Unknown',
            studentName: `${s.extracted_data?.student_info?.first_name?.answer || ''} ${s.extracted_data?.student_info?.last_name?.answer || ''}`.trim() || 'Unidentified',
            lrn: s.extracted_data?.student_info?.lrn?.answer
        })),
        total: Number(totalResult.value),
        limit: l, offset: o
    };
  }

  @Get('machines/:machineId/operators')
  async getMachineOperators(
    @Param('machineId') machineId: string,
    @Headers('x-machine-secret') machineSecret: string
  ) {
    const [machine] = await this.db.select().from(schema.machines).where(and(eq(schema.machines.machineId, machineId), eq(schema.machines.secret, machineSecret), eq(schema.machines.status, 'active'))).limit(1);
    if (!machine) throw new UnauthorizedException('Machine not authorized');

    const assignedUsers = await this.db.select().from(schema.users).innerJoin(schema.userMachines, eq(schema.users.id, schema.userMachines.userId)).where(eq(schema.userMachines.machineId, machine.id));
    const operators = assignedUsers.map((r: any) => r.users);

    return operators.map((user: any) => ({
      id: user.id, email: user.email, password_hash: user.passwordHash, first_name: user.firstName, last_name: user.lastName, user_type: user.userType,
    }));
  }
}
