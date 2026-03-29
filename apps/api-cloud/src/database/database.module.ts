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
          idle_timeout: 20,     // close idle connections after 20s (before Linode NAT drops them)
          max_lifetime: 1800,   // recycle connections after 30min regardless of activity
          connect_timeout: 10,  // fail fast if Postgres is unreachable
        });
        return drizzle(queryClient, { schema });
      },
    },
  ],
  exports: ['DATABASE_CONNECTION'],
})
export class DatabaseModule {}
