import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MaintenanceController],
})
export class MaintenanceModule {}
