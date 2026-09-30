import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';

@Module({
  controllers: [ReconciliationController],
  imports: [AuthModule],
  providers: [ReconciliationService],
})
export class ReconciliationModule {}
