import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import {
  AnalyticsBreakdownResponseDto,
  AnalyticsCashflowResponseDto,
  AnalyticsSummaryResponseDto,
} from './dto/analytics-response.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOkResponse({ type: AnalyticsSummaryResponseDto })
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsSummaryResponseDto> {
    return this.analyticsService.getSummary(user, query);
  }

  @Get('cashflow')
  @ApiOkResponse({ type: AnalyticsCashflowResponseDto })
  getCashflow(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsCashflowResponseDto> {
    return this.analyticsService.getCashflow(user, query);
  }

  @Get('categories')
  @ApiOkResponse({ type: AnalyticsBreakdownResponseDto })
  getCategoryBreakdown(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsBreakdownResponseDto> {
    return this.analyticsService.getCategoryBreakdown(user, query);
  }

  @Get('providers')
  @ApiOkResponse({ type: AnalyticsBreakdownResponseDto })
  getProviderBreakdown(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsBreakdownResponseDto> {
    return this.analyticsService.getProviderBreakdown(user, query);
  }
}
