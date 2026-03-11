import { Controller, Get, Post, Body, Inject, Query, Req, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { eq, sql, desc, and } from 'drizzle-orm';
import * as schema from '@omr-prod/database';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from '../auth/auth.service';
import { GradingService } from '../sync/grading.service';

@Controller('maintenance')
export class MaintenanceController {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly db: any,
    private readonly authService: AuthService,
    private readonly gradingService: GradingService,
  ) {}

  private async validateAdmin(req: any, write = false) {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException();
    const token = authHeader.split(' ')[1];
    const user = await this.authService.verifyToken(token);
    
    if (!user) throw new UnauthorizedException();
    if (user.visibilityScope !== 'NATIONAL') {
        throw new ForbiddenException('Access restricted to National Level personnel');
    }
    if (write && user.userType !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Only Super Administrators can modify the registry');
    }
    return user;
  }

  // --- REGIONS ---
  @Get('regions')
  async listRegions(@Req() req: any) {
    await this.validateAdmin(req);
    return this.db.select().from(schema.regions).orderBy(schema.regions.name);
  }

  @Post('regions')
  async createRegion(@Body() body: any, @Req() req: any) {
    await this.validateAdmin(req, true);
    return this.db.insert(schema.regions).values({
      name: body.name,
      code: body.code,
      description: body.description,
    }).returning();
  }

  // --- SCHOOLS ---
  @Get('schools')
  async listSchools(
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
    @Query('search') search: string = '',
    @Req() req: any
  ) {
    const l = parseInt(limit);
    const o = parseInt(offset);

    const items = await this.db.select({
        id: schema.schools.id,
        name: schema.schools.name,
        code: schema.schools.code,
        division: schema.schools.division,
        address: schema.schools.address,
        createdAt: schema.schools.createdAt,
        regionName: schema.regions.name,
        regionId: schema.schools.regionId
    })
    .from(schema.schools)
    .leftJoin(schema.regions, eq(schema.schools.regionId, schema.regions.id))
    .orderBy(schema.schools.name)
    .limit(l)
    .offset(o);

    const [totalResult] = await this.db.select({ count: sql`count(*)` }).from(schema.schools);

    return {
        items,
        total: parseInt(totalResult.count),
        limit: l,
        offset: o
    };
  }

  @Post('schools')
  async createSchool(@Body() body: any, @Req() req: any) {
    await this.validateAdmin(req, true);
    return this.db.insert(schema.schools).values({
      name: body.name,
      code: body.code,
      regionId: body.regionId,
      division: body.division,
      address: body.address,
    }).returning();
  }

  // --- MACHINES ---
  @Get('machines')
  async listMachines(@Req() req: any) {
    await this.validateAdmin(req);
    const machines = await this.db.select().from(schema.machines);
    const assignments = await this.db.select().from(schema.machineAssignments);
    
    return machines.map((m: any) => ({
        ...m,
        lastHeartbeat: m.lastHeartbeatAt,
        assignments: assignments.filter((a: any) => a.machineId === m.id)
    }));
  }

  @Post('machines/approve')
  async approveMachine(@Body() body: any, @Req() req: any) {
    await this.validateAdmin(req, true);
    const { id, assignments } = body;

    return this.db.transaction(async (tx: any) => {
        await tx.update(schema.machines)
            .set({ status: 'active', updatedAt: new Date() })
            .where(eq(schema.machines.id, id));

        await tx.delete(schema.machineAssignments).where(eq(schema.machineAssignments.machineId, id));

        if (assignments && assignments.length > 0) {
            await tx.insert(schema.machineAssignments).values(
                assignments.map((a: any) => ({
                    machineId: id,
                    scope: a.scope,
                    scopeValue: a.scopeValue
                }))
            );
        }

        return { ok: true };
    });
  }

  // --- USERS ---
  @Get('users')
  async listUsers(
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
    @Req() req: any
  ) {
    await this.validateAdmin(req);
    const l = parseInt(limit);
    const o = parseInt(offset);

    const items = await this.db.select().from(schema.users).limit(l).offset(o);
    const userMacs = await this.db.select().from(schema.userMachines);
    const [totalResult] = await this.db.select({ count: sql`count(*)` }).from(schema.users);

    return {
        items: items.map((u: any) => ({
            id: u.id,
            email: u.email,
            userType: u.userType,
            firstName: u.firstName,
            lastName: u.lastName,
            isActive: u.isActive,
            visibilityScope: u.visibilityScope,
            scopeValue: u.scopeValue,
            schoolId: u.schoolId,
            machineIds: userMacs.filter((um: any) => um.userId === u.id).map((um: any) => um.machineId)
        })),
        total: parseInt(totalResult.count),
        limit: l,
        offset: o
    };
  }

  @Post('users')
  async createUser(@Body() body: any, @Req() req: any) {
    await this.validateAdmin(req, true);
    const { email, password, firstName, lastName, userType, schoolId, visibilityScope, scopeValue, machineIds } = body;
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password || 'password123', salt);

    return this.db.transaction(async (tx: any) => {
        const [user] = await tx.insert(schema.users).values({
            email,
            passwordHash,
            firstName,
            lastName,
            userType: userType || 'EDGE_OPERATOR',
            schoolId: schoolId || null,
            visibilityScope: visibilityScope || 'SCHOOL',
            scopeValue: scopeValue || null
        }).returning();

        if (machineIds && machineIds.length > 0) {
            await tx.insert(schema.userMachines).values(
                machineIds.map((mid: string) => ({ userId: user.id, machineId: mid }))
            );
        }
        return user;
    });
  }

  @Post('users/update')
  async updateUser(@Body() body: any, @Req() req: any) {
    await this.validateAdmin(req, true);
    const { id, email, password, firstName, lastName, userType, schoolId, visibilityScope, scopeValue, machineIds, isActive } = body;

    return this.db.transaction(async (tx: any) => {
        const updateData: any = { 
            email, firstName, lastName, userType, schoolId, visibilityScope, scopeValue, isActive,
            updatedAt: new Date() 
        };
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.passwordHash = await bcrypt.hash(password, salt);
        }

        await tx.update(schema.users).set(updateData).where(eq(schema.users.id, id));

        await tx.delete(schema.userMachines).where(eq(schema.userMachines.userId, id));
        if (machineIds && machineIds.length > 0) {
            await tx.insert(schema.userMachines).values(
                machineIds.map((mid: string) => ({ userId: id, machineId: mid }))
            );
        }
        return { ok: true };
    });
  }

  @Post('users/delete')
  async deleteUser(@Body() body: { id: string }, @Req() req: any) {
    await this.validateAdmin(req, true);
    await this.db.delete(schema.users).where(eq(schema.users.id, body.id));
    return { ok: true };
  }

  // --- ANSWER KEYS ---
  @Get('keys')
  async listKeys(@Req() req: any) {
    await this.validateAdmin(req);
    return this.db.select().from(schema.answerKeys).orderBy(schema.answerKeys.updatedAt);
  }

  @Post('keys')
  async upsertKey(@Body() body: any, @Req() req: any) {
    await this.validateAdmin(req, true);
    const { id, examName, subject, version, answers } = body;
    
    if (id) {
        return this.db.update(schema.answerKeys)
            .set({ examName, subject, version, answers, updatedAt: new Date() })
            .where(eq(schema.answerKeys.id, id))
            .returning();
    }

    return this.db.insert(schema.answerKeys).values({
      examName,
      subject,
      version,
      answers,
    }).returning();
  }

  // --- ORPHANED SCAN MANAGEMENT ---
  @Get('scans/orphaned')
  async listOrphanedScans(@Req() req: any) {
    await this.validateAdmin(req);
    return this.db.select().from(schema.scans).where(eq(schema.scans.status, 'orphaned')).orderBy(desc(schema.scans.createdAt));
  }

  @Post('scans/assign')
  async assignSchoolToScan(@Body() body: any, @Req() req: any) {
    const user = await this.validateAdmin(req, true);
    const { scanId, schoolId } = body;

    return this.db.transaction(async (tx: any) => {
        const [oldScan] = await tx.select().from(schema.scans).where(eq(schema.scans.id, scanId)).limit(1);

        // 1. Update the scan
        await tx.update(schema.scans)
            .set({ 
                schoolId: schoolId, 
                status: 'success', 
                updatedAt: new Date() 
            })
            .where(eq(schema.scans.id, scanId));

        // 2. Audit the correction
        await tx.insert(schema.correctionLogs).values({
            scanId,
            userId: user.id,
            action: 'SCHOOL_ASSIGNMENT',
            oldData: { schoolId: oldScan?.schoolId },
            newData: { schoolId: schoolId }
        });
        
        return { ok: true };
    });
  }

  // --- BUBBLE CORRECTION & VALIDATION QUEUE ---
  @Get('scans/pending-review')
  async listPendingReview(@Req() req: any) {
    await this.validateAdmin(req);
    return this.db.select().from(schema.scans)
        .where(eq(schema.scans.reviewRequired, true))
        .orderBy(desc(schema.scans.createdAt));
  }

  @Post('scans/correct-bubbles')
  async requestBubbleCorrection(@Body() body: any, @Req() req: any) {
    const user = await this.validateAdmin(req, true);
    const { scanId, correctedData, reason } = body;

    return this.db.transaction(async (tx: any) => {
        const [scan] = await tx.select().from(schema.scans).where(eq(schema.scans.id, scanId)).limit(1);
        if (!scan) throw new NotFoundException();

        await tx.update(schema.scans)
            .set({ 
                pending_data: correctedData,
                reviewRequired: true 
            })
            .where(eq(schema.scans.id, scanId));

        await tx.insert(schema.correctionLogs).values({
            scanId,
            userId: user.id,
            action: 'BUBBLE_CORRECTION',
            oldData: scan.extracted_data,
            newData: correctedData,
            reason: reason || 'Manual Correction Filed',
            status: 'pending'
        });

        return { ok: true };
    });
  }

  @Post('scans/approve-correction')
  async approveCorrection(@Body() body: any, @Req() req: any) {
    const qaUser = await this.validateAdmin(req, true);
    const { scanId, decision } = body; 
    let { logId } = body;

    return this.db.transaction(async (tx: any) => {
        const [scan] = await tx.select().from(schema.scans).where(eq(schema.scans.id, scanId)).limit(1);
        if (!scan || !scan.pending_data) throw new NotFoundException('No pending correction found');

        if (!logId) {
            const [foundLog] = await tx.select().from(schema.correctionLogs)
                .where(and(eq(schema.correctionLogs.scanId, scanId), eq(schema.correctionLogs.status, 'pending')))
                .limit(1);
            logId = foundLog?.id;
        }

        if (decision === 'rejected') {
            await tx.update(schema.scans).set({ pending_data: null, reviewRequired: false }).where(eq(schema.scans.id, scanId));
            if (logId) await tx.update(schema.correctionLogs).set({ status: 'rejected' }).where(eq(schema.correctionLogs.id, logId));
            return { ok: true, status: 'rejected' };
        }

        // --- APPROVED: USE GRADING SERVICE ---
        const { totalScore, maxPossibleScore, gradingDetails } = await this.gradingService.gradeScan(scan.pending_data);

        await tx.update(schema.scans)
            .set({ 
                extracted_data: scan.pending_data,
                pending_data: null,
                gradingDetails: gradingDetails,
                totalScore: totalScore,
                maxScore: maxPossibleScore,
                reviewRequired: false,
                updatedAt: new Date()
            })
            .where(eq(schema.scans.id, scanId));

        if (logId) {
            await tx.update(schema.correctionLogs)
                .set({ status: 'approved' })
                .where(eq(schema.correctionLogs.id, logId));
        }

        return { ok: true, status: 'approved', score: totalScore };
    });
  }

  // --- GLOBAL AUDIT TRAIL ---
  @Get('audit-trail')
  async getAuditTrail(@Req() req: any) {
    await this.validateAdmin(req);
    
    const logs = await this.db.select({
        id: schema.correctionLogs.id,
        action: schema.correctionLogs.action,
        status: schema.correctionLogs.status,
        createdAt: schema.correctionLogs.createdAt,
        reason: schema.correctionLogs.reason,
        userName: sql`${schema.users.firstName} || ' ' || ${schema.users.lastName}`,
        userEmail: schema.users.email,
        fileName: schema.scans.fileName,
        scanId: schema.scans.id
    })
    .from(schema.correctionLogs)
    .innerJoin(schema.users, eq(schema.correctionLogs.userId, schema.users.id))
    .innerJoin(schema.scans, eq(schema.correctionLogs.scanId, schema.scans.id))
    .orderBy(desc(schema.correctionLogs.createdAt))
    .limit(100);

    return logs;
  }
}
