import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/schema';
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

  // 2. Comprehensive School List (NCR, Region III, Region VII, Region XI)
  const schoolsToInsert = [
    // NCR - Manila
    { name: 'Manila Science High School', code: '305312', regionId: findId('NCR'), division: 'Manila', address: 'Taft Ave, Ermita, Manila' },
    { name: 'Dr. Juan G. Nolasco High School', code: '305288', regionId: findId('NCR'), division: 'Manila', address: 'Tondo, Manila' },
    { name: 'Tondo High School', code: '305291', regionId: findId('NCR'), division: 'Manila', address: 'Tondo, Manila' },
    { name: 'Manuel L. Quezon High School', code: '305297', regionId: findId('NCR'), division: 'Manila', address: 'Sampaloc, Manila' },
    
    // NCR - Quezon City
    { name: 'Philippine Science HS (Main)', code: '300401', regionId: findId('NCR'), division: 'Quezon City', address: 'Agham Road, Diliman, QC' },
    { name: 'Ateneo de Manila Univ. (HS)', code: '406364', regionId: findId('NCR'), division: 'Quezon City', address: 'Katipunan Ave, QC' },
    { name: 'Quezon City Science High School', code: '305371', regionId: findId('NCR'), division: 'Quezon City', address: 'Bago Bantay, QC' },
    { name: 'Batasan Hills National HS', code: '305364', regionId: findId('NCR'), division: 'Quezon City', address: 'Batasan Hills, QC' },
    
    // Region III - Bulacan
    { name: 'Bulacan State Univ. (Lab HS)', code: '600034', regionId: findId('Region III'), division: 'Malolos City', address: 'Guinhawa, Malolos' },
    { name: 'Marcelo H. del Pilar National HS', code: '300741', regionId: findId('Region III'), division: 'Malolos City', address: 'Malolos, Bulacan' },
    { name: 'San Miguel National High School', code: '300761', regionId: findId('Region III'), division: 'Bulacan', address: 'San Miguel, Bulacan' },
    
    // Region VII - Cebu
    { name: 'Cebu City National Science HS', code: '302941', regionId: findId('Region VII'), division: 'Cebu City', address: 'Salvador St, Labangon' },
    { name: 'Abellana National School', code: '302931', regionId: findId('Region VII'), division: 'Cebu City', address: 'Osmeña Blvd, Cebu City' },
    { name: 'University of San Carlos (HS)', code: '404312', regionId: findId('Region VII'), division: 'Cebu City', address: 'P. Del Rosario St' },
    
    // Region XI - Davao
    { name: 'Davao City National High School', code: '304364', regionId: findId('Region XI'), division: 'Davao City', address: 'F. Torres St, Davao City' },
    { name: 'Philippine Science HS (SMC)', code: '300402', regionId: findId('Region XI'), division: 'Davao City', address: 'Tugbok, Davao City' },
    { name: 'Daniel R. Aguinaldo National HS', code: '304365', regionId: findId('Region XI'), division: 'Davao City', address: 'Matina, Davao City' },

    // More generated schools to trigger pagination
    ...Array.from({ length: 20 }).map((_, i) => ({
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
  const [phiSci] = await db.select().from(schema.schools).where(eq(schema.schools.code, '300401')).limit(1);

  const testUsers = [
    { email: 'auditor@omr-prod.gov.ph', firstName: 'Arthur', lastName: 'Auditor', userType: 'NATIONAL_AUDITOR', visibilityScope: 'NATIONAL', scopeValue: 'ALL' },
    { email: 'ncr.monitor@omr-prod.gov.ph', firstName: 'Nora', lastName: 'NCR', userType: 'DEPED_MONITOR', visibilityScope: 'REGIONAL', scopeValue: 'NCR' },
    { email: 'manila.monitor@omr-prod.gov.ph', firstName: 'Manny', lastName: 'Manila', userType: 'DEPED_MONITOR', visibilityScope: 'DIVISION', scopeValue: 'Manila' },
    { email: 'msci.admin@omr-prod.gov.ph', firstName: 'Admin', lastName: 'MSci', userType: 'SCHOOL_ADMIN', schoolId: msSci.id, visibilityScope: 'SCHOOL', scopeValue: msSci.id },
    { email: 'psci.op@omr-prod.gov.ph', firstName: 'Operator', lastName: 'PSci', userType: 'EDGE_OPERATOR', schoolId: phiSci.id, visibilityScope: 'SCHOOL', scopeValue: phiSci.id },
    { email: 'operator1@mshs.edu.ph', firstName: 'MSHS', lastName: 'Operator 1', userType: 'EDGE_OPERATOR', schoolId: msSci.id, visibilityScope: 'SCHOOL', scopeValue: msSci.id }
  ];

  for (const u of testUsers) {
    await db.insert(schema.users).values({ ...u, passwordHash: pass, isActive: true }).onConflictDoNothing();
  }

  // 4. Pre-enroll a Development Machine
  console.log('Pre-enrolling MACHINE-00001...');
  const [devMachine] = await db.insert(schema.machines).values({
    machineId: 'MACHINE-00001',
    status: 'active',
    secret: 'dev-machine-secret-123',
    hostname: 'dev-laptop',
    ipAddress: '127.0.0.1'
  }).onConflictDoNothing().returning();

  if (devMachine) {
    await db.insert(schema.machineAssignments).values({
        machineId: devMachine.id,
        scope: 'SCHOOL',
        scopeValue: msSci.id
    });
    console.log('✅ MACHINE-00001 pre-authorized for MSHS');
  }

  console.log('--- ✅ Demo Seeding Complete ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
