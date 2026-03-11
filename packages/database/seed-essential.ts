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
  }).onConflictDoNothing().returning();

  if (admin) {
    console.log(`✅ Super Admin created: ${adminEmail}`);
  } else {
    console.log(`ℹ️ Super Admin already exists.`);
  }

  // 2. Add System Maintenance Roles (Standard roles for all schools)
  // ... roles logic if needed

  console.log('--- ✅ Essential Seeding Complete ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
