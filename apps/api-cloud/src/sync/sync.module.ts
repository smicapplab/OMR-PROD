import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { AuthModule } from '../auth/auth.module';
import { GradingService } from './grading.service';
import { SyncService } from './sync.service';

@Module({
  imports: [AuthModule],
  controllers: [SyncController],
  providers: [GradingService, SyncService],
  exports: [GradingService, SyncService]
})
export class SyncModule {}
