import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/schema';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  console.log('--- 🗺 Seeding Regions ---');

  const regions = [
    { name: 'NCR', code: 'NCR', description: 'National Capital Region' },
    { name: 'CAR', code: 'CAR', description: 'Cordillera Administrative Region' },
    { name: 'Region I', code: 'REG-1', description: 'Ilocos Region' },
    { name: 'Region II', code: 'REG-2', description: 'Cagayan Valley' },
    { name: 'Region III', code: 'REG-3', description: 'Central Luzon' },
    { name: 'Region IV-A', code: 'REG-4A', description: 'CALABARZON' },
    { name: 'MIMAROPA', code: 'REG-4B', description: 'Southwestern Tagalog Region' },
    { name: 'Region V', code: 'REG-5', description: 'Bicol Region' },
    { name: 'Region VI', code: 'REG-6', description: 'Western Visayas' },
    { name: 'Region VII', code: 'REG-7', description: 'Central Visayas' },
    { name: 'Region VIII', code: 'REG-8', description: 'Eastern Visayas' },
    { name: 'Region IX', code: 'REG-9', description: 'Zamboanga Peninsula' },
    { name: 'Region X', code: 'REG-10', description: 'Northern Mindanao' },
    { name: 'Region XI', code: 'REG-11', description: 'Davao Region' },
    { name: 'Region XII', code: 'REG-12', description: 'SOCCSKSARGEN' },
    { name: 'Region XIII', code: 'REG-13', description: 'Caraga' },
    { name: 'BARMM', code: 'BARMM', description: 'Bangsamoro Autonomous Region in Muslim Mindanao' },
  ];

  for (const reg of regions) {
    await db.insert(schema.regions).values({
      name: reg.name,
      code: reg.code,
      description: reg.description
    }).onConflictDoNothing();
  }

  console.log('--- ✅ Regions Seeded ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
