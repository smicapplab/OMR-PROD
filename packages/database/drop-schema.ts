import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

async function main() {
  console.log('--- 🗑 Dropping ALL Cloud Schema ---');
  await client`DROP TABLE IF EXISTS "machines" CASCADE`;
  await client`DROP TABLE IF EXISTS "omr_scans" CASCADE`;
  await client`DROP TABLE IF EXISTS "answer_keys" CASCADE`;
  await client`DROP TABLE IF EXISTS "refresh_tokens" CASCADE`;
  await client`DROP TABLE IF EXISTS "users" CASCADE`;
  await client`DROP TABLE IF EXISTS "schools" CASCADE`;
  await client`DROP TABLE IF EXISTS "regions" CASCADE`;
  console.log('--- ✅ Schema Dropped ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
