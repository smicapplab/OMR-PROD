import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/schema';
import { userMachines } from './src/schema/users';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  console.log('--- 🧪 Running Expanded Realistic Demo Seeding ---');

  // 1. Get Region IDs
  const regions = await db.select().from(schema.regions);
  const findId = (name: string) => regions.find(r => r.name === name)?.id;
  const findByCode = (code: string) => regions.find(r => r.code === code)?.id;

  // 2. Comprehensive School List
  const schoolsToInsert = [
    { name: 'Manila Science High School', code: '305312', regionId: findId('NCR'), division: 'Manila', address: 'Taft Ave, Manila' },
    { name: 'Philippine Science HS (Main)', code: '300401', regionId: findId('NCR'), division: 'Quezon City', address: 'Agham Road, QC' },
    { name: 'Test School Alpha', code: '777888', regionId: findId('NCR'), division: 'Manila', address: 'Test Site 1' },
    { name: 'Test School Beta', code: '123456', regionId: findId('NCR'), division: 'Manila', address: 'Test Site 2' },

    // More generated schools to trigger pagination
    ...Array.from({ length: 15 }).map((_, i) => ({
      name: `Public School Instance ${i + 1}`,
      code: `900${100 + i}`,
      regionId: findId('NCR'),
      division: 'Generic Division',
      address: 'Standard DepEd Address Structure'
    }))
  ];

  console.log(`Inserting ${schoolsToInsert.length} Institutions...`);
  for (const s of schoolsToInsert) {
    await db.insert(schema.schools).values(s).onConflictDoNothing();
  }

  // 3. Create Demo Users (All use 'password123')
  console.log('Provisioning Multi-Role Identities...');
  const salt = await bcrypt.genSalt(10);
  const pass = await bcrypt.hash('password123', salt);

  const [msSci] = await db.select().from(schema.schools).where(eq(schema.schools.code, '305312')).limit(1);
  const [tsAlpha] = await db.select().from(schema.schools).where(eq(schema.schools.code, '777888')).limit(1);
  const [tsBeta] = await db.select().from(schema.schools).where(eq(schema.schools.code, '123456')).limit(1);

  const testUsers = [
    { email: 'auditor@omr-prod.gov.ph', firstName: 'Arthur', lastName: 'Auditor', userType: 'NATIONAL_AUDITOR', visibilityScope: 'NATIONAL', scopeValue: 'ALL' },
    { email: 'monitor.ncr@omr-prod.gov.ph', firstName: 'Nora', lastName: 'NCR', userType: 'DEPED_MONITOR', visibilityScope: 'REGIONAL', scopeValue: findByCode('NCR') },
    { email: 'admin.777@omr-prod.gov.ph', firstName: 'Admin', lastName: '777', userType: 'SCHOOL_ADMIN', schoolId: msSci.id, visibilityScope: 'SCHOOL', scopeValue: msSci.id },
    { email: 'operator1@mshs.edu.ph', firstName: 'MSHS', lastName: 'Operator 1', userType: 'EDGE_OPERATOR', visibilityScope: 'SCHOOL', scopeValue: msSci.id }
  ];

  for (const u of testUsers) {
    await db.insert(schema.users).values({ ...u, passwordHash: pass, isActive: true }).onConflictDoNothing();
  }

  // 4. Pre-enroll a Development Machine
  console.log('Pre-enrolling MACHINE-00001...');
  const devMachineSecret = 'dev-machine-secret-123';
  const hashedMachineSecret = await bcrypt.hash(devMachineSecret, salt);

  const [devMachine] = await db.insert(schema.machines).values({
    machineId: 'MACHINE-00001',
    status: 'active',
    secret: hashedMachineSecret,
    hostname: 'dev-laptop',
    ipAddress: '127.0.0.1'
  }).onConflictDoNothing().returning();

  if (devMachine) {
    // Clear old assignments if any (for repeated runs)
    await db.delete(schema.machineAssignments).where(eq(schema.machineAssignments.machineId, devMachine.id));

    await db.insert(schema.machineAssignments).values([
      { machineId: devMachine.id, scope: 'SCHOOL', scopeValue: msSci.id },
      { machineId: devMachine.id, scope: 'SCHOOL', scopeValue: tsAlpha.id },
      { machineId: devMachine.id, scope: 'SCHOOL', scopeValue: tsBeta.id }
    ]);

    // Explicitly link operator1 to MACHINE-00001
    const [op1] = await db.select().from(schema.users).where(eq(schema.users.email, 'operator1@mshs.edu.ph')).limit(1);
    if (op1) {
      await db.insert(userMachines).values({
        userId: op1.id,
        machineId: devMachine.id
      }).onConflictDoNothing();
    }

    console.log('✅ MACHINE-00001 pre-authorized for multiple schools and personnel');
  }

  // 5. Create a PENDING machine for demonstration
  console.log('Provisioning PENDING machine for demo...');
  await db.insert(schema.machines).values({
    machineId: 'MACHINE-DEMO-PENDING',
    status: 'pending',
    secret: 'pending-secret-xyz',
    hostname: 'demo-unauthorized-box',
    ipAddress: '192.168.1.50'
  }).onConflictDoNothing();

  console.log('--- ✅ Demo Seeding Complete ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
