import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';

@Module({
  controllers: [MerchantsController],
  exports: [MerchantsService],
  imports: [AuthModule],
  providers: [MerchantsService],
})
export class MerchantsModule {}
