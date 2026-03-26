import { Controller, Get, Post, Body, Inject, Query, Req, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { eq, sql, desc, and, inArray, or } from 'drizzle-orm';
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
  ) { }

  private async validateUser(req: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException();
    const token = authHeader.split(' ')[1];
    const user = await this.authService.verifyToken(token);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async validateAdmin(req: any, write = false) {
    const user = await this.validateUser(req);
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
    await this.validateUser(req);
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
    @Query('region') region: string = '',
    @Req() req: any
  ) {
    await this.validateUser(req);
    const l = parseInt(limit);
    const o = parseInt(offset);

    const conditions = [];
    if (search) {
      const s = `%${search.toLowerCase()}%`;
      conditions.push(or(
        sql`lower(${schema.schools.name}) LIKE ${s}`,
        sql`lower(${schema.schools.code}) LIKE ${s}`,
        sql`lower(${schema.schools.division}) LIKE ${s}`
      ));
    }
    if (region) {
      conditions.push(eq(schema.regions.name, region));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
      .where(whereClause)
      .orderBy(schema.schools.name)
      .limit(l)
      .offset(o);

    const [totalResult] = await this.db.select({ count: sql`count(*)` }).from(schema.schools).where(whereClause);

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

  @Post('schools/update')
  async updateSchool(@Body() body: any, @Req() req: any) {
    await this.validateAdmin(req, true);
    const { id, name, code, regionId, division, address } = body;
    return this.db.update(schema.schools)
      .set({
        name,
        code,
        regionId,
        division,
        address,
        updatedAt: new Date()
      })
      .where(eq(schema.schools.id, id))
      .returning();
  }

  // --- MACHINES ---
  @Get('machines')
  async listMachines(
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
    @Query('search') search: string = '',
    @Req() req: any
  ) {
    await this.validateUser(req);
    const l = parseInt(limit);
    const o = parseInt(offset);

    const conditions = [];
    if (search) {
      const s = `%${search.toLowerCase()}%`;
      conditions.push(or(
        sql`lower(${schema.machines.machineId}) LIKE ${s}`,
        sql`lower(${schema.machines.status}) LIKE ${s}`
      ));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const machines = await this.db.select().from(schema.machines)
      .where(whereClause)
      .orderBy(schema.machines.machineId)
      .limit(l).offset(o);

    const [totalResult] = await this.db.select({ count: sql`count(*)` }).from(schema.machines).where(whereClause);
    const assignments = await this.db.select().from(schema.machineAssignments);

    return {
      items: machines.map((m: any) => ({
        ...m,
        lastHeartbeat: m.lastHeartbeatAt,
        assignments: assignments.filter((a: any) => a.machineId === m.id)
      })),
      total: parseInt(totalResult.count),
      limit: l,
      offset: o
    };
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
    @Query('search') search: string = '',
    @Req() req: any
  ) {
    await this.validateAdmin(req);
    const l = parseInt(limit);
    const o = parseInt(offset);

    const conditions = [];
    if (search) {
      const s = `%${search.toLowerCase()}%`;
      conditions.push(or(
        sql`lower(${schema.users.email}) LIKE ${s}`,
        sql`lower(${schema.users.firstName}) LIKE ${s}`,
        sql`lower(${schema.users.lastName}) LIKE ${s}`
      ));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await this.db.select().from(schema.users).where(whereClause).limit(l).offset(o);
    const userMacs = await this.db.select().from(schema.userMachines);
    const [totalResult] = await this.db.select({ count: sql`count(*)` }).from(schema.users).where(whereClause);

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
    const user = await this.validateUser(req);
    console.log(`🔍 [PENDING REVIEW] User: ${user.email}, Role: ${user.userType}, Scope: ${user.visibilityScope}`);

    if (user.userType === 'SUPER_ADMIN') {
      const results = await this.db.select().from(schema.scans)
        .where(eq(schema.scans.reviewRequired, true))
        .orderBy(desc(schema.scans.createdAt));
      console.log(`✅ [PENDING REVIEW] Found ${results.length} records for SUPER_ADMIN`);
      return results;
    }

    const conditions = [eq(schema.scans.reviewRequired, true)];

    if (user.visibilityScope === 'SCHOOL') {
      conditions.push(eq(schema.scans.schoolId, user.scopeValue));
    } else if (user.visibilityScope === 'REGIONAL') {
      const regionSchools = this.db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.regionId, user.scopeValue));
      conditions.push(inArray(schema.scans.schoolId, regionSchools));
    }

    const results = await this.db.select().from(schema.scans)
      .where(and(...conditions))
      .orderBy(desc(schema.scans.createdAt));

    console.log(`✅ [PENDING REVIEW] Found ${results.length} records for ${user.visibilityScope} scope`);
    return results;
  }

  @Post('scans/correct-bubbles')
  async requestBubbleCorrection(@Body() body: any, @Req() req: any) {
    const user = await this.validateUser(req);
    const { scanId, correctedData, reason } = body;

    // RBAC: Only SUPER_ADMIN, DEPED_MONITOR, and SCHOOL_ADMIN can submit corrections.
    if (!['SUPER_ADMIN', 'DEPED_MONITOR', 'SCHOOL_ADMIN'].includes(user.userType)) {
      throw new ForbiddenException('You are not authorized to submit data corrections');
    }

    return this.db.transaction(async (tx: any) => {
      const [scan] = await tx.select().from(schema.scans).where(eq(schema.scans.id, scanId)).limit(1);
      if (!scan) throw new NotFoundException('Scan not found');

      // Scope Check: SCHOOL_ADMIN can only correct scans from their school
      if (user.visibilityScope === 'SCHOOL' && scan.schoolId !== user.scopeValue) {
        throw new ForbiddenException('Access denied: You can only submit corrections for your own institution');
      }

      // Scope Check: REGIONAL_MONITOR can only correct scans from their region
      if (user.visibilityScope === 'REGIONAL') {
        const [school] = await tx.select({ regionId: schema.schools.regionId }).from(schema.schools).where(eq(schema.schools.id, scan.schoolId)).limit(1);
        if (!school || school.regionId !== user.scopeValue) {
          throw new ForbiddenException('Access denied: You can only submit corrections for institutions in your region');
        }
      }

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
    const qaUser = await this.validateUser(req);
    const { scanId, decision, selectedItems } = body;
    let { logId } = body;

    // RBAC: Only SUPER_ADMIN and DEPED_MONITOR (Regional Monitors) can approve corrections.
    if (qaUser.userType !== 'SUPER_ADMIN' && qaUser.userType !== 'DEPED_MONITOR') {
      throw new ForbiddenException('Only National Administrators or Regional Monitors can approve data corrections');
    }

    return this.db.transaction(async (tx: any) => {
      const [scan] = await tx.select().from(schema.scans).where(eq(schema.scans.id, scanId)).limit(1);
      if (!scan || !scan.pending_data) throw new NotFoundException('No pending correction found');

      // Scope Check: Regional Monitor can only approve scans from their region
      if (qaUser.visibilityScope === 'REGIONAL') {
        const [school] = await tx.select({ regionId: schema.schools.regionId }).from(schema.schools).where(eq(schema.schools.id, scan.schoolId)).limit(1);
        if (!school || school.regionId !== qaUser.scopeValue) {
          throw new ForbiddenException('Access denied: You can only approve corrections for institutions in your region');
        }
      }

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
      let finalData = scan.pending_data;

      // If specific items were selected, merge only those into existing data
      if (selectedItems && Array.isArray(selectedItems)) {
        finalData = JSON.parse(JSON.stringify(scan.extracted_data));
        for (const path of selectedItems) {
          const [subject, qNum] = path.split('.');
          if (!finalData[subject]) finalData[subject] = {};
          finalData[subject][qNum] = scan.pending_data[subject]?.[qNum];
        }
      }

      const { totalScore, maxPossibleScore, gradingDetails } = await this.gradingService.gradeScan(finalData);

      await tx.update(schema.scans)
        .set({
          extracted_data: finalData,
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
          .set({
            status: 'approved',
            newData: finalData // Log what was actually approved
          })
          .where(eq(schema.correctionLogs.id, logId));
      }

      return { ok: true, status: 'approved', score: totalScore };
    });
  }

  @Post('scans/update-authoritative')
  async updateAuthoritative(@Body() body: any, @Req() req: any) {
    const user = await this.validateUser(req);
    // Only SUPER_ADMIN and DEPED_MONITOR can do direct authoritative updates
    if (user.userType !== 'SUPER_ADMIN' && user.userType !== 'DEPED_MONITOR') {
      throw new ForbiddenException('Direct authoritative updates are restricted to Administrators and Monitors');
    }

    const { scanId, correctedData, reason } = body;

    return this.db.transaction(async (tx: any) => {
      const [scan] = await tx.select().from(schema.scans).where(eq(schema.scans.id, scanId)).limit(1);
      if (!scan) throw new NotFoundException();

      // 1. Grade the new data
      const { totalScore, maxPossibleScore, gradingDetails } = await this.gradingService.gradeScan(correctedData);

      // 2. Update the scan immediately
      await tx.update(schema.scans)
        .set({
          extracted_data: correctedData,
          pending_data: null, // Clear any pending data if it exists
          gradingDetails: gradingDetails,
          totalScore: totalScore,
          maxScore: maxPossibleScore,
          reviewRequired: false,
          updatedAt: new Date()
        })
        .where(eq(schema.scans.id, scanId));

      // 3. Log as an automatically approved correction
      await tx.insert(schema.correctionLogs).values({
        scanId,
        userId: user.id,
        action: 'AUTHORITATIVE_UPDATE',
        oldData: scan.extracted_data,
        newData: correctedData,
        reason: reason || 'Direct Authoritative Update',
        status: 'approved'
      });

      return { ok: true, score: totalScore };
    });
  }

  // --- GLOBAL AUDIT TRAIL ---
  @Get('audit-trail')
  async getAuditTrail(@Query('scanId') scanId: string, @Req() req: any) {
    await this.validateUser(req);

    const conditions = [];
    if (scanId) conditions.push(eq(schema.correctionLogs.scanId, scanId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    console.log(`[DEBUG audit-trail] scanId=${scanId}, conditions=${conditions.length}`);

    const logs = await this.db.select({
      id: schema.correctionLogs.id,
      action: schema.correctionLogs.action,
      status: schema.correctionLogs.status,
      createdAt: schema.correctionLogs.createdAt,
      reason: schema.correctionLogs.reason,
      oldData: schema.correctionLogs.oldData,
      newData: schema.correctionLogs.newData,
      userName: sql`COALESCE(${schema.users.firstName} || ' ' || ${schema.users.lastName}, 'SYSTEM')`,
      userEmail: schema.users.email,
      fileName: schema.scans.fileName,
      scanId: schema.scans.id
    })
      .from(schema.correctionLogs)
      .leftJoin(schema.users, eq(schema.correctionLogs.userId, schema.users.id))
      .innerJoin(schema.scans, eq(schema.correctionLogs.scanId, schema.scans.id))
      .where(whereClause)
      .orderBy(desc(schema.correctionLogs.createdAt))
      .limit(100);

    console.log(`[DEBUG audit-trail] returning ${logs.length} items`);
    return logs.map((log: any) => ({
      ...log,
      details: {
        old_data: log.oldData,
        new_data: log.newData
      }
    }));
  }
}
