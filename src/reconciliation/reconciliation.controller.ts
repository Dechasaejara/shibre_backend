import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.service';
import {
  MatchTransactionsDto,
  UpdateReconciliationStatusDto,
} from './dto/reconciliation.dto';
import {
  ReconciliationActionResponseDto,
  ReconciliationSuggestionsResponseDto,
} from './dto/reconciliation-response.dto';
import { ReconciliationService } from './reconciliation.service';

@ApiTags('Reconciliation')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get('suggestions')
  @ApiOkResponse({ type: ReconciliationSuggestionsResponseDto })
  getSuggestions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReconciliationSuggestionsResponseDto> {
    return this.reconciliationService.getSuggestions(user);
  }

  @Post('matches')
  @ApiOkResponse({ type: ReconciliationActionResponseDto })
  matchTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MatchTransactionsDto,
  ): Promise<ReconciliationActionResponseDto> {
    return this.reconciliationService.matchTransactions(user, dto);
  }

  @Patch('transactions/:id/status')
  @ApiOkResponse({ type: ReconciliationActionResponseDto })
  updateTransactionStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReconciliationStatusDto,
  ): Promise<ReconciliationActionResponseDto> {
    return this.reconciliationService.updateTransactionStatus(user, id, dto);
  }
}
