import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { AuthModule } from '../auth/auth.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [AuthModule, SyncModule],
  controllers: [MaintenanceController],
})
export class MaintenanceModule {}
