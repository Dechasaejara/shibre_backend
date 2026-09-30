import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaymentTemplateResponseDto } from './dto/payment-template-response.dto';
import {
  RenderPaymentTemplateDto,
  RenderPaymentTemplateResponseDto,
} from './dto/render-payment-template.dto';
import {
  CreateUssdReportDto,
  UssdReportResponseDto,
} from './dto/ussd-report.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('templates')
  @ApiOkResponse({ type: [PaymentTemplateResponseDto] })
  listTemplates(
    @Query('providerCode') providerCode?: string,
  ): Promise<PaymentTemplateResponseDto[]> {
    return this.paymentsService.listTemplates(providerCode);
  }

  @Get('templates/:providerCode/:paymentType')
  @ApiOkResponse({ type: PaymentTemplateResponseDto })
  getTemplate(
    @Param('providerCode') providerCode: string,
    @Param('paymentType') paymentType: string,
  ): Promise<PaymentTemplateResponseDto> {
    return this.paymentsService.getTemplate(providerCode, paymentType);
  }

  @Post('ussd/render')
  @ApiCreatedResponse({ type: RenderPaymentTemplateResponseDto })
  renderUssd(
    @Body() dto: RenderPaymentTemplateDto,
  ): Promise<RenderPaymentTemplateResponseDto> {
    return this.paymentsService.renderUssd(dto);
  }

  @Post('ussd/reports')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: UssdReportResponseDto })
  reportBrokenUssd(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUssdReportDto,
  ): Promise<UssdReportResponseDto> {
    return this.paymentsService.reportBrokenTemplate(user.userId, dto);
  }
}
