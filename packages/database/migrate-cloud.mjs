#!/usr/bin/env node
// Programmatic cloud migration runner — used by scripts/demo.sh and scripts/deploy.sh.
// Bypasses drizzle-kit CLI (which requires a TTY for confirmation prompts) and runs
// migrations directly via drizzle-orm's built-in migrator. Always prints real errors.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1, connect_timeout: 10 });
const db = drizzle(sql);

const migrationsFolder = join(__dirname, 'drizzle', 'cloud-migrations');

try {
  console.log(`  Applying migrations from ${migrationsFolder}...`);
  await migrate(db, { migrationsFolder });
  console.log('  ✅ Cloud schema up to date');
} catch (err) {
  console.error('  ❌ Migration failed:', err.message ?? err);
  process.exit(1);
} finally {
  await sql.end();
}
