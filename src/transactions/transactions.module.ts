import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BalancesModule } from '../balances/balances.module';
import { ParserModule } from '../parser/parser.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  exports: [TransactionsService],
  imports: [AuthModule, BalancesModule, ParserModule],
  providers: [TransactionsService],
})
export class TransactionsModule {}
