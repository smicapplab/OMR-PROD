import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import * as schema from '@omr-prod/database';

@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');
        if (!dbUrl) {
            console.error('❌ DATABASE_URL is not defined in environment');
        }
        const postgresFunc = (postgres as any).default || postgres;
        const queryClient = postgresFunc(dbUrl!, {
          max: 10,              // connection pool size
          idle_timeout: 20,     // close idle connections after 20s (guards against short-lived NAT for remote Postgres)
          // max_lifetime is intentionally left as the postgres-js default: a randomised value
          // between 30–60 minutes per connection. Using a fixed value (e.g. 1800) caused all
          // pool connections to expire at the exact same instant ("thundering herd"), which
          // overwhelmed Postgres during simultaneous reconnection and produced "Failed query"
          // errors that persisted until the process was restarted.
          connect_timeout: 10,  // fail fast if Postgres is unreachable
          prepare: false,       // disable server-side prepared statements; safer with connection
                                // recycling and required for PgBouncer-style poolers
          onnotice: () => {},   // suppress NOTICE messages in logs
        });
        const db = drizzle(queryClient, { schema });

        // Log any underlying postgres-js connection errors so the real cause is
        // visible instead of only the DrizzleQueryError wrapper.
        queryClient.unsafe('SELECT 1').catch((err: any) => {
          console.warn('⚠️  [DatabaseModule] Initial connectivity check failed:', err?.message ?? err);
        });

        return db;
      },
    },
  ],
  exports: ['DATABASE_CONNECTION'],
})
export class DatabaseModule {}
