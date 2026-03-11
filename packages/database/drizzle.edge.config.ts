import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/edge.ts',
  out: './drizzle/edge-migrations',
  driver: 'libsql',
  dbCredentials: {
    url: 'file:../../apps/api-edge/omr_edge.db',
  },
  verbose: true,
  strict: true,
});
