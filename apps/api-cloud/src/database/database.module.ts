import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import * as schema from '@omr-prod/database';

@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: () => {
        // Handle potential different import styles
        const postgresFunc = (postgres as any).default || postgres;
        const queryClient = postgresFunc(process.env.DATABASE_URL!);
        return drizzle(queryClient, { schema });
      },
    },
  ],
  exports: ['DATABASE_CONNECTION'],
})
export class DatabaseModule {}
