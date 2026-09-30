import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.service';
import { CreateManualTransactionDto } from './dto/create-manual-transaction.dto';
import { IngestRawSmsDto } from './dto/ingest-raw-sms.dto';
import { IngestSmsTransactionDto } from './dto/ingest-sms-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import {
  TransactionListResponseDto,
  TransactionResponseDto,
} from './dto/transaction-response.dto';
import { UpdateTransactionCategoryDto } from './dto/update-transaction-category.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOkResponse({ type: TransactionListResponseDto })
  listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<TransactionListResponseDto> {
    return this.transactionsService.listTransactions(user, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: TransactionResponseDto })
  getTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.getTransaction(user, id);
  }

  @Patch(':id/category')
  @ApiOkResponse({ type: TransactionResponseDto })
  updateTransactionCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionCategoryDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.updateTransactionCategory(
      user,
      id,
      dto.categoryId,
    );
  }

  @Post('manual')
  @ApiCreatedResponse({ type: TransactionResponseDto })
  createManualTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateManualTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.createManualTransaction(user, dto);
  }

  @Post('sms')
  @ApiCreatedResponse({ type: TransactionResponseDto })
  ingestSmsTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: IngestSmsTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.ingestSmsTransaction(user, dto);
  }

  @Post('sms/raw')
  @ApiCreatedResponse({ type: TransactionResponseDto })
  ingestRawSms(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: IngestRawSmsDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.ingestRawSms(user, dto);
  }
}
