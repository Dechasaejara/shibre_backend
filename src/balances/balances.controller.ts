import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.service';
import { BalancesService } from './balances.service';
import {
  BalanceDiscrepancyResponseDto,
  BalanceSnapshotResponseDto,
} from './dto/balance-response.dto';
import { UpdateDiscrepancyDto } from './dto/update-discrepancy.dto';

@ApiTags('Balances')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('balances')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get()
  @ApiOkResponse({ type: [BalanceSnapshotResponseDto] })
  listLatestBalances(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BalanceSnapshotResponseDto[]> {
    return this.balancesService.listLatestBalances(user);
  }

  @Get('discrepancies')
  @ApiOkResponse({ type: [BalanceDiscrepancyResponseDto] })
  listDiscrepancies(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BalanceDiscrepancyResponseDto[]> {
    return this.balancesService.listDiscrepancies(user);
  }

  @Patch('discrepancies/:id')
  @ApiOkResponse({ type: BalanceDiscrepancyResponseDto })
  updateDiscrepancy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDiscrepancyDto,
  ): Promise<BalanceDiscrepancyResponseDto> {
    return this.balancesService.updateDiscrepancy(user, id, dto);
  }
}
