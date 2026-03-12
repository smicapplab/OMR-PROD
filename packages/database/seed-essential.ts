import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/schema';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function main() {
  console.log('--- 🚀 Running Essential Seeding (Production) ---');

  // 1. Create System Admin
  const adminEmail = 'admin@omr-prod.gov.ph';
  const hashedPassword = await bcrypt.hash('admin-secure-password', 10);

  const [admin] = await db.insert(schema.users).values({
    email: adminEmail,
    passwordHash: hashedPassword,
    userType: 'SUPER_ADMIN',
    firstName: 'System',
    lastName: 'Administrator',
    visibilityScope: 'NATIONAL',
    scopeValue: 'ALL'
  }).onConflictDoNothing().returning();

  if (admin) {
    console.log(`✅ Super Admin created: ${adminEmail}`);
  } else {
    console.log(`ℹ️ Super Admin already exists.`);
  }

  // 2. Add Official Answer Keys (2026-V1)
  console.log('Seeding Official 2026-V1 Answer Keys...');
  const subjects = ['math', 'english', 'science', 'filipino', 'ap'];
  
  for (const subject of subjects) {
    const perfectAnswers: any = {};
    for (let i = 1; i <= 40; i++) {
        // Pattern: A, B, C, D, A...
        perfectAnswers[i] = ['A', 'B', 'C', 'D'][(i - 1) % 4];
    }

    await db.insert(schema.answerKeys).values({
        examName: "National Admission Test",
        subject: subject,
        version: "2026-V1",
        answers: perfectAnswers,
    }).onConflictDoNothing();
  }
  console.log(`✅ Provisioned ${subjects.length} subject keys.`);

  // 3. Add System Maintenance Roles

  console.log('--- ✅ Essential Seeding Complete ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
