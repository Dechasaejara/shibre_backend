import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import type { AuthenticatedUser } from '../auth/auth.service';
import { BusinessOpsGuard } from '../auth/business-ops.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateMerchantDto, UpdateMerchantDto } from '../merchants/dto/merchant.dto';
import {
  AdminCreateSubscriptionDto,
  CreateParserRuleDto,
  CreatePaymentTemplateDto,
  CreatePresetCategoryDto,
  CreateProviderDto,
  CreateSenderAliasDto,
  DeleteAdminRecordDto,
  DeleteAdminRecordResponseDto,
  UpdatePaymentTemplateDto,
  ListByStatusQueryDto,
  ListAdminSubscriptionsQueryDto,
  TestParserPatternDto,
  TestParserRuleDto,
  ListUsersQueryDto,
  ListUssdReportsQueryDto,
  UpdateParserRuleDto,
  UpdateParserRuleStatusDto,
  UpdatePaymentTemplateStatusDto,
  UpdatePresetCategoryDto,
  UpdateProviderDto,
  UpdateSenderAliasDto,
  UpdateUserAccessDto,
  UpdateUssdReportDto,
} from './dto/admin-config.dto';
import { AdminService, type AdminSubscriptionResponse, type AuditLogResponse, type ParserRuleTestResult, type SubscriptionStatsResponse, type UserSubscriptionsResponse } from './admin.service';
import { UpdateSubscriptionDto } from '../subscriptions/dto/subscription.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, BusinessOpsGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Delete(':resource/:id')
  @UseGuards(AdminRoleGuard)
  @ApiOkResponse({ type: DeleteAdminRecordResponseDto })
  deleteRecord(@CurrentUser() user: AuthenticatedUser, @Param() params: DeleteAdminRecordDto): Promise<DeleteAdminRecordResponseDto> {
    return this.adminService.deleteRecord(user, params.resource, params.id);
  }

  @Patch('payment-templates/:id')
  @ApiOkResponse()
  updatePaymentTemplate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePaymentTemplateDto): Promise<{ id: string }> {
    return this.adminService.updatePaymentTemplate(user, id, dto);
  }

  @Get('overview')
  @ApiOkResponse()
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('metrics/parser')
  @ApiOkResponse()
  getParserMetrics() {
    return this.adminService.getParserMetrics();
  }

  @Get('providers')
  @ApiOkResponse()
  listProviders() {
    return this.adminService.listProviders();
  }

  @Get('providers/:id')
  @ApiOkResponse()
  getProvider(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getProvider(id);
  }

  @Post('providers/:id/aliases')
  @ApiCreatedResponse()
  createSenderAlias(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) providerId: string, @Body() dto: CreateSenderAliasDto) {
    return this.adminService.createSenderAlias(user, providerId, dto);
  }

  @Patch('aliases/:id')
  @ApiOkResponse()
  updateSenderAlias(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSenderAliasDto) {
    return this.adminService.updateSenderAlias(user, id, dto);
  }

  @Get('parser-rules')
  @ApiOkResponse()
  listParserRules(@Query() query: ListByStatusQueryDto) {
    return this.adminService.listParserRules(query.status);
  }

  @Get('payment-templates')
  @ApiOkResponse()
  listPaymentTemplates(@Query() query: ListByStatusQueryDto) {
    return this.adminService.listPaymentTemplates(query.status);
  }

  @Patch('parser-rules/:id/status')
  @UseGuards(AdminRoleGuard)
  @ApiOkResponse()
  updateParserRuleStatus(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateParserRuleStatusDto) {
    return this.adminService.updateParserRuleStatus(user, id, dto.status);
  }

  @Patch('payment-templates/:id/status')
  @UseGuards(AdminRoleGuard)
  @ApiOkResponse()
  updatePaymentTemplateStatus(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePaymentTemplateStatusDto) {
    return this.adminService.updatePaymentTemplateStatus(user, id, dto.status);
  }

  @Get('ussd-reports')
  @ApiOkResponse()
  listUssdReports(@Query() query: ListUssdReportsQueryDto) {
    return this.adminService.listUssdReports(query.status);
  }

  @Patch('ussd-reports/:id')
  @ApiOkResponse()
  updateUssdReport(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUssdReportDto) {
    return this.adminService.updateUssdReport(user, id, dto);
  }

  @Get('categories')
  @ApiOkResponse()
  listPresetCategories() {
    return this.adminService.listPresetCategories();
  }

  @Post('categories')
  @ApiCreatedResponse()
  createPresetCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePresetCategoryDto) {
    return this.adminService.createPresetCategory(user, dto);
  }

  @Patch('categories/:id')
  @ApiOkResponse()
  updatePresetCategory(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePresetCategoryDto) {
    return this.adminService.updatePresetCategory(user, id, dto);
  }

  @Get('users')
  @UseGuards(AdminRoleGuard)
  @ApiOkResponse()
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id')
  @UseGuards(AdminRoleGuard)
  @ApiOkResponse()
  updateUserAccess(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserAccessDto) {
    return this.adminService.updateUserAccess(user, id, dto);
  }

  @Get('users/:id/subscriptions')
  @UseGuards(AdminRoleGuard)
  @ApiOkResponse()
  listUserSubscriptions(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<UserSubscriptionsResponse> {
    return this.adminService.listUserSubscriptions(user, id);
  }

  @Get('subscriptions/stats')
  @ApiOkResponse()
  getSubscriptionStats(): Promise<SubscriptionStatsResponse> {
    return this.adminService.getSubscriptionStats();
  }

  @Get('subscriptions')
  @UseGuards(AdminRoleGuard)
  @ApiOkResponse()
  listAllSubscriptions(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAdminSubscriptionsQueryDto): Promise<AdminSubscriptionResponse[]> {
    return this.adminService.listAllSubscriptions(user, query);
  }

  @Post('subscriptions')
  @UseGuards(AdminRoleGuard)
  @ApiCreatedResponse()
  createSubscription(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdminCreateSubscriptionDto): Promise<AdminSubscriptionResponse> {
    return this.adminService.createSubscriptionForUser(user, dto);
  }

  @Patch('subscriptions/:id')
  @UseGuards(AdminRoleGuard)
  @ApiOkResponse()
  updateSubscription(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubscriptionDto): Promise<AdminSubscriptionResponse> {
    return this.adminService.updateSubscriptionAsAdmin(user, id, dto);
  }

  @Get('parser-rules/drafts')
  @ApiOkResponse()
  listDraftParserRules() {
    return this.adminService.listDraftParserRules();
  }

  @Get('payment-templates/drafts')
  @ApiOkResponse()
  listDraftPaymentTemplates() {
    return this.adminService.listDraftPaymentTemplates();
  }

  @Get('merchants')
  @ApiOkResponse()
  listMerchants() {
    return this.adminService.listMerchants();
  }

  @Get('audit-logs')
  @UseGuards(AdminRoleGuard)
  @ApiOkResponse()
  listAuditLogs(@Query('limit') limit = '100'): Promise<AuditLogResponse[]> {
    const parsedLimit = Number(limit);
    return this.adminService.listAuditLogs(Number.isInteger(parsedLimit) ? parsedLimit : 100);
  }

  @Post('providers')
  @ApiCreatedResponse()
  createProvider(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProviderDto) {
    return this.adminService.createProvider(user, dto);
  }

  @Patch('providers/:id')
  @ApiOkResponse()
  updateProvider(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.adminService.updateProvider(user, id, dto);
  }

  @Post('providers/:id/parser-rules')
  @ApiCreatedResponse()
  createParserRule(@CurrentUser() user: AuthenticatedUser, @Param('id') providerId: string, @Body() dto: CreateParserRuleDto) {
    return this.adminService.createParserRule(user, providerId, dto);
  }

  @Patch('parser-rules/:id')
  @ApiOkResponse()
  updateParserRule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateParserRuleDto) {
    return this.adminService.updateParserRule(user, id, dto);
  }

  @Post('parser-rules/test')
  @ApiOkResponse()
  testParserPattern(@Body() dto: TestParserPatternDto) {
    return this.adminService.testParserPattern(dto);
  }

  @Post('parser-rules/:id/test')
  @ApiOkResponse()
  testParserRule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TestParserRuleDto): Promise<ParserRuleTestResult> {
    return this.adminService.testParserRule(id, dto.messageBody);
  }

  @Post('parser-rules/:id/publish')
  @UseGuards(AdminRoleGuard)
  @ApiOkResponse()
  publishParserRule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.adminService.publishParserRule(user, id);
  }

  @Post('providers/:id/payment-templates')
  @ApiCreatedResponse()
  createPaymentTemplate(@CurrentUser() user: AuthenticatedUser, @Param('id') providerId: string, @Body() dto: CreatePaymentTemplateDto) {
    return this.adminService.createPaymentTemplate(user, providerId, dto);
  }

  @Post('payment-templates/:id/publish')
  @UseGuards(AdminRoleGuard)
  @ApiOkResponse()
  publishPaymentTemplate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.adminService.publishPaymentTemplate(user, id);
  }

  @Post('merchants')
  @ApiCreatedResponse()
  createMerchant(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMerchantDto) {
    return this.adminService.createMerchant(user, dto);
  }

  @Patch('merchants/:id')
  @ApiOkResponse()
  updateMerchant(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateMerchantDto) {
    return this.adminService.updateMerchant(user, id, dto);
  }
}