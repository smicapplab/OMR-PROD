import { Controller, Get, Post, Body, Inject, Query } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import * as schema from '@omr-prod/database';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Controller('maintenance')
export class MaintenanceController {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly db: any,
  ) {}

  // --- REGIONS ---
  @Get('regions')
  async listRegions() {
    return this.db.select().from(schema.regions).orderBy(schema.regions.name);
  }

  @Post('regions')
  async createRegion(@Body() body: any) {
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
    @Query('search') search: string = ''
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
  async createSchool(@Body() body: any) {
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
  async listMachines() {
    const machines = await this.db.select().from(schema.machines);
    const assignments = await this.db.select().from(schema.machineAssignments);
    
    return machines.map((m: any) => ({
        ...m,
        lastHeartbeat: m.lastHeartbeatAt,
        assignments: assignments.filter((a: any) => a.machineId === m.id)
    }));
  }

  @Post('machines/approve')
  async approveMachine(@Body() body: any) {
    const { id, assignments } = body;

    return this.db.transaction(async (tx: any) => {
        // 1. Update status to active
        await tx.update(schema.machines)
            .set({ status: 'active', updatedAt: new Date() })
            .where(eq(schema.machines.id, id));

        // 2. Clear old and insert new assignments
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
    @Query('offset') offset: string = '0'
  ) {
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
  async createUser(@Body() body: any) {
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
  async updateUser(@Body() body: any) {
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

        // Update machines
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
  async deleteUser(@Body() body: { id: string }) {
    await this.db.delete(schema.users).where(eq(schema.users.id, body.id));
    return { ok: true };
  }

  // --- ANSWER KEYS ---
  @Get('keys')
  async listKeys() {
    return this.db.select().from(schema.answerKeys).orderBy(schema.answerKeys.updatedAt);
  }

  @Post('keys')
  async upsertKey(@Body() body: any) {
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
}
