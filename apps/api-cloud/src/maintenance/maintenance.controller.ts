import { Controller, Get, Post, Body, Inject, Query } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import * as schema from '@omr-prod/database';
import * as bcrypt from 'bcrypt';

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
        regionName: schema.regions.name
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
    return this.db.select({
        id: schema.machines.id,
        machineId: schema.machines.machineId,
        status: schema.machines.status,
        schoolName: schema.schools.name,
        lastHeartbeat: schema.machines.lastHeartbeatAt
    })
    .from(schema.machines)
    .leftJoin(schema.schools, eq(schema.machines.schoolId, schema.schools.id));
  }

  @Post('machines')
  async enrollMachine(@Body() body: any) {
    return this.db.insert(schema.machines).values({
      machineId: body.machineId,
      schoolId: body.schoolId,
      status: 'active',
    }).returning();
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
            scopeValue: u.scopeValue
        })),
        total: parseInt(totalResult.count),
        limit: l,
        offset: o
    };
  }

  @Post('users')
  async createUser(@Body() body: any) {
    const { email, password, firstName, lastName, userType, schoolId, visibilityScope, scopeValue } = body;
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password || 'password123', salt);

    return this.db.insert(schema.users).values({
      email,
      passwordHash,
      firstName,
      lastName,
      userType: userType || 'EDGE_OPERATOR',
      schoolId: schoolId || null,
      visibilityScope: visibilityScope || 'SCHOOL',
      scopeValue: scopeValue || null
    }).returning();
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
