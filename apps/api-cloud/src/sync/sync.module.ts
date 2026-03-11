import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { AuthModule } from '../auth/auth.module';
import { GradingService } from './grading.service';

@Module({
  imports: [AuthModule],
  controllers: [SyncController],
  providers: [GradingService],
  exports: [GradingService]
})
export class SyncModule {}
