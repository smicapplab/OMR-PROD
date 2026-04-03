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
          // idle_timeout is intentionally omitted: the database runs on localhost so there is
          // no NAT gateway that could drop idle TCP connections. Keeping connections open avoids
          // reconnection entirely, which eliminates the window where a password mismatch
          // (28P01) can surface on reconnect.
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
        return drizzle(queryClient, { schema });
      },
    },
  ],
  exports: ['DATABASE_CONNECTION'],
})
export class DatabaseModule {}
