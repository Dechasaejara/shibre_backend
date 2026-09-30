import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthSessionStatus,
  CategoryKind,
  ConfigValueType,
  PaymentTemplateStatus,
  Prisma,
  ProviderRuleStatus,
  RawSmsParseStatus,
  SubscriptionCategory,
  SubscriptionFrequency,
  SubscriptionStatus,
  UserStatus,
  UssdReportStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantsService } from '../merchants/merchants.service';
import { shortId } from '../common/logging';
import { evaluateRule, normalizeDecimal, type RuleEvaluation } from '../parser/rule-evaluator';
import type { UpdateSubscriptionDto } from '../subscriptions/dto/subscription.dto';
import { FREQUENCY_RULES } from '../subscriptions/subscriptions.service';
import type {
  AdminCreateSubscriptionDto,
  CreateParserRuleDto,
  CreatePaymentTemplateDto,
  CreatePresetCategoryDto,
  CreateProviderDto,
  CreateSenderAliasDto,
  DeleteAdminRecordDto,
  UpdatePaymentTemplateDto,
  TestParserPatternDto,
  ListAdminSubscriptionsQueryDto,
  ListUsersQueryDto,
  UpdateParserRuleDto,
  UpdatePresetCategoryDto,
  UpdateProviderDto,
  UpdateSenderAliasDto,
  UpdateUserAccessDto,
  UpdateUssdReportDto,
} from './dto/admin-config.dto';

export interface AuditLogResponse {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
  details: { key: string; value: string; valueType: string }[];
}

const MONTHLY_FACTOR: Record<SubscriptionFrequency, number> = {
  WEEKLY: 52 / 12,
  MONTHLY: 1,
  QUARTERLY: 1 / 3,
  YEARLY: 1 / 12,
};

export interface ParserRuleTestResult {
  ruleId: string;
  passed: boolean;
  results: { messageBody: string; evaluation: RuleEvaluation; mismatches: string[]; passed: boolean }[];
}

interface ExampleExpectation {
  expectedType: string | null;
  expectedAmount: Prisma.Decimal | null;
  expectedBalance: Prisma.Decimal | null;
  expectedRef: string | null;
  expectedCounterpartyName: string | null;
  expectedCounterpartyPhone: string | null;
}

/** Human-readable differences between what a rule parsed and what an example expects. */
function exampleMismatches(evaluation: RuleEvaluation, example: ExampleExpectation): string[] {
  const checks: [string, string | null | undefined, string | null | undefined][] = [
    ['type', example.expectedType, evaluation.transactionType],
    ['amount', example.expectedAmount ? normalizeDecimal(example.expectedAmount.toString()) : null, evaluation.amount],
    ['balance', example.expectedBalance ? normalizeDecimal(example.expectedBalance.toString()) : null, evaluation.currentBalance],
    ['reference', example.expectedRef, evaluation.reference],
    ['counterparty name', example.expectedCounterpartyName, evaluation.counterpartyName],
    ['counterparty phone', example.expectedCounterpartyPhone, evaluation.counterpartyPhone],
  ];
  return checks
    .filter(([, expected, actual]) => expected && expected !== actual)
    .map(([label, expected, actual]) => `${label}: expected "${expected}", got "${actual ?? '—'}"`);
}

export interface SubscriptionStatsResponse {
  totals: {
    total: number;
    active: number;
    paused: number;
    cancelled: number;
    subscribers: number;
    activeMonthlyAmount: number;
    dueNext7Days: number;
  };
  byCategory: { category: SubscriptionCategory; total: number; active: number; activeMonthlyAmount: number }[];
  byFrequency: { frequency: SubscriptionFrequency; total: number; active: number }[];
}

export interface UserSubscriptionsResponse {
  user: { id: string; phoneNumber: string; status: UserStatus };
  subscriptions: AdminSubscriptionResponse[];
}

export interface AdminSubscriptionResponse {
  id: string;
  userId: string;
  phoneNumber: string;
  name: string;
  category: SubscriptionCategory;
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  amount: string | null;
  currency: string;
  nextDueAt: string | null;
  merchantId: string | null;
  merchantName: string | null;
  createdAt: string;
  updatedAt: string;
}

const ADMIN_SUBSCRIPTION_INCLUDE = {
  merchant: { select: { displayName: true } },
  user: { select: { phoneNumber: true } },
} satisfies Prisma.SubscriptionInclude;

type AdminSubscriptionRecord = Prisma.SubscriptionGetPayload<{ include: typeof ADMIN_SUBSCRIPTION_INCLUDE }>;

function toAdminSubscription(item: AdminSubscriptionRecord): AdminSubscriptionResponse {
  return {
    id: item.id,
    userId: item.userId,
    phoneNumber: item.user.phoneNumber,
    name: item.name,
    category: item.category,
    frequency: item.frequency,
    status: item.status,
    amount: item.amount?.toFixed(2) ?? null,
    currency: item.currency,
    nextDueAt: item.nextDueAt?.toISOString() ?? null,
    merchantId: item.merchantId,
    merchantName: item.merchant?.displayName ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

@Injectable()
export class AdminService {
  private readonly auditLogger = new Logger('AdminAudit');

  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly prisma: PrismaService,
  ) {}

  async deleteRecord(user: AuthenticatedUser, resource: DeleteAdminRecordDto['resource'], id: string): Promise<{ id: string }> {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Administrator access required');
    return this.prisma.$transaction(async (tx) => {
      let targetType: string;
      switch (resource) {
        case 'providers': {
          const record = await tx.provider.findUnique({ where: { id }, include: { _count: true } });
          if (!record) throw new NotFoundException('Provider not found');
          const merchant = await tx.merchant.findFirst({ where: { providerCode: record.code }, select: { id: true } });
          if (record.isActive || Object.values(record._count).some((count) => count > 0) || merchant) {
            throw new ConflictException('Only inactive providers without configuration or linked records can be deleted');
          }
          await tx.provider.delete({ where: { id } });
          targetType = 'Provider';
          break;
        }
        case 'merchants': {
          const record = await tx.merchant.findUnique({ where: { id }, include: { _count: { select: { subscriptions: true } } } });
          if (!record) throw new NotFoundException('Merchant not found');
          if (record.isActive || record._count.subscriptions) throw new ConflictException('Only inactive merchants without subscriptions can be deleted');
          await tx.merchant.delete({ where: { id } });
          targetType = 'Merchant';
          break;
        }
        case 'categories': {
          const record = await tx.category.findFirst({ where: { id, kind: CategoryKind.PRESET, userId: null }, include: { _count: true } });
          if (!record) throw new NotFoundException('Preset category not found');
          if (record._count.children || record._count.transactions) throw new ConflictException('Categories with children or transactions cannot be deleted');
          await tx.category.delete({ where: { id } });
          targetType = 'Category';
          break;
        }
        case 'aliases': {
          const record = await tx.providerSenderAlias.findUnique({ where: { id } });
          if (!record) throw new NotFoundException('Alias not found');
          if (record.isActive) throw new ConflictException('Disable the alias before deleting it');
          await tx.providerSenderAlias.delete({ where: { id } });
          targetType = 'ProviderSenderAlias';
          break;
        }
        case 'parser-rules': {
          const record = await tx.providerParserRule.findUnique({ where: { id } });
          if (!record) throw new NotFoundException('Configuration not found');
          if (record.status === 'ACTIVE') throw new ConflictException('Disable or deprecate the rule before deleting it so devices stop using it');
          await tx.providerParserRule.delete({ where: { id } });
          targetType = 'ProviderParserRule';
          break;
        }
        case 'payment-templates': {
          const record = await tx.providerPaymentTemplate.findUnique({ where: { id } });
          if (!record) throw new NotFoundException('Configuration not found');
          const published = await tx.auditLog.findFirst({ where: { targetId: id, action: 'PAYMENT_TEMPLATE_PUBLISHED' }, select: { id: true } });
          if (record.status !== 'DRAFT' || record.configVersionId || published) throw new ConflictException('Only never-published drafts can be deleted; disable published configuration instead');
          await tx.providerPaymentTemplate.delete({ where: { id } });
          targetType = 'ProviderPaymentTemplate';
          break;
        }
        case 'subscriptions': {
          const record = await tx.subscription.findUnique({ where: { id }, select: { id: true } });
          if (!record) throw new NotFoundException('Subscription not found');
          await tx.subscription.delete({ where: { id } });
          targetType = 'Subscription';
          break;
        }
        default:
          throw new BadRequestException('Unsupported record type');
      }
      await this.writeAudit(tx, user, 'RECORD_DELETED', targetType, id, [['resource', resource]]);
      return { id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updatePaymentTemplate(user: AuthenticatedUser, id: string, dto: UpdatePaymentTemplateDto): Promise<{ id: string }> {
    if (user.role !== 'ADMIN' && user.role !== 'BUSINESS_OPS') throw new ForbiddenException('Business operations access required');
    const keys = new Set(dto.fields.map((field) => field.key));
    if (keys.size !== dto.fields.length || dto.fields.some((field) => /pin|password/i.test(`${field.key} ${field.label}`))) {
      throw new BadRequestException('Fields must be unique and cannot include payment PINs or passwords');
    }
    if ([...dto.template.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].some((match) => !keys.has(match[1]))) {
      throw new BadRequestException('Every template placeholder must have a declared field');
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.providerPaymentTemplate.findUnique({ where: { id }, include: { fields: true } });
      if (!existing) throw new NotFoundException('Payment template not found');
      if (existing.status !== 'DRAFT') throw new ConflictException('Only draft templates can be edited');
      await tx.providerPaymentTemplate.update({ where: { id }, data: {
        paymentType: dto.paymentType,
        template: dto.template,
        instructions: dto.instructions?.trim() || null,
        fields: { deleteMany: {}, create: dto.fields.map((field) => ({ ...field, validationPattern: field.validationPattern ?? existing.fields.find((previous) => previous.key === field.key)?.validationPattern })) },
      } });
      await this.writeAudit(tx, user, 'PAYMENT_TEMPLATE_DRAFT_UPDATED', 'ProviderPaymentTemplate', id, [['fieldCount', String(dto.fields.length)]]);
      return { id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listAuditLogs(limit: number): Promise<AuditLogResponse[]> {
    const records = await this.prisma.auditLog.findMany({
      include: { details: { orderBy: { key: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return records.map((record) => ({
      id: record.id,
      actorId: record.actorId,
      action: record.action,
      targetType: record.targetType,
      targetId: record.targetId,
      createdAt: record.createdAt.toISOString(),
      details: record.details.map(({ key, value, valueType }) => ({ key, value, valueType })),
    }));
  }

  async listProviders() {
    return this.prisma.provider.findMany({
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        code: true,
        displayName: true,
        countryCode: true,
        currency: true,
        isActive: true,
      },
    });
  }

  async listMerchants() {
    return this.prisma.merchant.findMany({
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        displayName: true,
        providerCode: true,
        merchantRef: true,
        isActive: true,
      },
    });
  }

  async listDraftParserRules() {
    return this.prisma.providerParserRule.findMany({
      include: { fieldMappings: true, provider: { select: { code: true, displayName: true } } },
      orderBy: [{ providerId: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
      where: { status: ProviderRuleStatus.DRAFT },
    });
  }

  async listDraftPaymentTemplates() {
    return this.prisma.providerPaymentTemplate.findMany({
      include: { fields: true, provider: { select: { code: true, displayName: true } } },
      orderBy: [{ providerId: 'asc' }, { paymentType: 'asc' }, { createdAt: 'desc' }],
      where: { status: PaymentTemplateStatus.DRAFT },
    });
  }

  async createProvider(user: AuthenticatedUser, dto: CreateProviderDto) {
    return this.prisma.$transaction(async (tx) => {
      const provider = await tx.provider.create({
        data: {
          code: dto.code,
          displayName: dto.displayName,
          countryCode: dto.countryCode,
          currency: dto.currency,
        },
      });
      await this.writeAudit(tx, user, 'PROVIDER_CREATED', 'Provider', provider.id, [
        ['code', provider.code],
        ['displayName', provider.displayName],
      ]);
      return provider;
    });
  }

  async updateProvider(user: AuthenticatedUser, id: string, dto: UpdateProviderDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.provider.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Provider not found');
      const provider = await tx.provider.update({
        data: {
          code: dto.code,
          displayName: dto.displayName,
          countryCode: dto.countryCode,
          currency: dto.currency,
          isActive: dto.isActive,
        },
        where: { id },
      });
      await this.writeAudit(tx, user, 'PROVIDER_UPDATED', 'Provider', id, [
        ['code.before', existing.code], ['code.after', provider.code],
        ['displayName.before', existing.displayName], ['displayName.after', provider.displayName],
        ['isActive.before', String(existing.isActive)], ['isActive.after', String(provider.isActive)],
      ]);
      return provider;
    });
  }

  async createParserRule(user: AuthenticatedUser, providerId: string, dto: CreateParserRuleDto) {
    this.validatePattern(dto.pattern);
    return this.prisma.$transaction(async (tx) => {
      const provider = await tx.provider.findUnique({ where: { id: providerId } });
      if (!provider) throw new NotFoundException('Provider not found');
      const rule = await tx.providerParserRule.create({
        data: {
          providerId,
          version: dto.version,
          transactionType: dto.transactionType,
          pattern: dto.pattern,
          priority: dto.priority,
          status: ProviderRuleStatus.DRAFT,
          fieldMappings: {
            create: dto.fieldMappings?.map((mapping) => ({
              captureGroup: mapping.captureGroup,
              targetField: mapping.targetField,
              valueType: mapping.valueType,
              transform: mapping.transform,
              isRequired: mapping.isRequired,
            })),
          },
          examples: {
            create: dto.examples?.map((example) => ({
              messageBody: example.messageBody,
              expectedType: example.expectedType,
              expectedAmount: example.expectedAmount,
              expectedBalance: example.expectedBalance,
              expectedRef: example.expectedRef,
              expectedCounterpartyName: example.expectedCounterpartyName,
              expectedCounterpartyPhone: example.expectedCounterpartyPhone,
            })),
          },
        },
        include: { fieldMappings: true },
      });
      await this.writeAudit(tx, user, 'PARSER_RULE_DRAFT_CREATED', 'ProviderParserRule', rule.id, [
        ['providerCode', provider.code],
        ['transactionType', rule.transactionType],
        ['version', String(rule.version)],
        ['exampleCount', String(dto.examples?.length ?? 0)],
        ['fieldMappingCount', String(dto.fieldMappings?.length ?? 0)],
      ]);
      return {
        id: rule.id,
        providerId: rule.providerId,
        version: rule.version,
        transactionType: rule.transactionType,
        pattern: rule.pattern,
        priority: rule.priority,
        status: rule.status,
        fieldMappings: rule.fieldMappings,
      };
    });
  }

  async updateParserRule(user: AuthenticatedUser, id: string, dto: UpdateParserRuleDto) {
    if (dto.pattern !== undefined) this.validatePattern(dto.pattern);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.providerParserRule.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Parser rule not found');
      const rule = await tx.providerParserRule.update({
        data: {
          transactionType: dto.transactionType,
          pattern: dto.pattern,
          priority: dto.priority,
          status: ProviderRuleStatus.DRAFT,
          configVersionId: null,
          fieldMappings: dto.fieldMappings
            ? {
                deleteMany: {},
                create: dto.fieldMappings.map((mapping) => ({
                  captureGroup: mapping.captureGroup,
                  targetField: mapping.targetField,
                  valueType: mapping.valueType,
                  transform: mapping.transform,
                  isRequired: mapping.isRequired,
                })),
              }
            : undefined,
          examples: dto.examples
            ? {
                deleteMany: {},
                create: dto.examples.map((example) => ({
                  messageBody: example.messageBody,
                  expectedType: example.expectedType,
                  expectedAmount: example.expectedAmount,
                  expectedBalance: example.expectedBalance,
                  expectedRef: example.expectedRef,
                  expectedCounterpartyName: example.expectedCounterpartyName,
                  expectedCounterpartyPhone: example.expectedCounterpartyPhone,
                })),
              }
            : undefined,
        },
        where: { id },
      });
      await this.writeAudit(tx, user, 'PARSER_RULE_DRAFT_UPDATED', 'ProviderParserRule', id, [
        ['status.before', existing.status],
        ['status.after', rule.status],
        ['patternChanged', String(dto.pattern !== undefined && dto.pattern !== existing.pattern)],
        ['typeChanged', String(dto.transactionType !== undefined && dto.transactionType !== existing.transactionType)],
        ['fieldMappingsReplaced', String(dto.fieldMappings !== undefined)],
        ['examplesReplaced', String(dto.examples !== undefined)],
      ]);
      return rule;
    });
  }

  /** Tries an unsaved pattern + mappings against one message. */
  testParserPattern(dto: TestParserPatternDto): RuleEvaluation {
    return evaluateRule(
      {
        pattern: dto.pattern,
        transactionType: dto.transactionType,
        fieldMappings: dto.fieldMappings.map((mapping) => ({
          captureGroup: mapping.captureGroup,
          targetField: mapping.targetField,
          valueType: mapping.valueType ?? ConfigValueType.STRING,
          transform: mapping.transform ?? null,
          isRequired: mapping.isRequired ?? false,
        })),
      },
      dto.messageBody,
    );
  }

  /** Tries a saved rule against a message, or against all of its saved examples. */
  async testParserRule(id: string, messageBody?: string): Promise<ParserRuleTestResult> {
    const rule = await this.prisma.providerParserRule.findUnique({
      include: { examples: true, fieldMappings: true },
      where: { id },
    });
    if (!rule) throw new NotFoundException('Parser rule not found');
    const inputs = messageBody !== undefined
      ? [{ messageBody, expected: null }]
      : rule.examples.map((example) => ({ messageBody: example.messageBody, expected: example }));
    const results = inputs.map(({ messageBody: body, expected }) => {
      const evaluation = evaluateRule(rule, body);
      const mismatches = expected ? exampleMismatches(evaluation, expected) : [];
      return { messageBody: body, evaluation, mismatches, passed: !evaluation.failure && mismatches.length === 0 };
    });
    return { ruleId: id, passed: results.every((result) => result.passed), results };
  }

  async publishParserRule(user: AuthenticatedUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.providerParserRule.findUnique({
        include: { provider: true, examples: true, fieldMappings: true },
        where: { id },
      });
      if (!rule) throw new NotFoundException('Parser rule not found');
      // Never ship a rule to devices that fails its own sample messages.
      const failing = rule.examples.filter((example) => {
        const evaluation = evaluateRule(rule, example.messageBody);
        return evaluation.failure || exampleMismatches(evaluation, example).length > 0;
      });
      if (failing.length > 0) {
        throw new BadRequestException(`${failing.length} of ${rule.examples.length} example message(s) do not parse as expected. Test the rule and fix it before publishing.`);
      }
      const latestVersion = await tx.providerConfigVersion.findFirst({
        orderBy: { version: 'desc' },
        where: { providerId: rule.providerId },
      });
      const configVersion = await tx.providerConfigVersion.create({
        data: {
          providerId: rule.providerId,
          version: (latestVersion?.version ?? 0) + 1,
          status: ProviderRuleStatus.ACTIVE,
          notes: `Published parser rule ${rule.id}`,
          publishedAt: new Date(),
        },
      });
      const published = await tx.providerParserRule.update({
        data: {
          configVersionId: configVersion.id,
          status: ProviderRuleStatus.ACTIVE,
        },
        where: { id },
      });
      await this.writeAudit(tx, user, 'PARSER_RULE_PUBLISHED', 'ProviderParserRule', id, [
        ['providerCode', rule.provider.code],
        ['configVersion', String(configVersion.version)],
      ]);
      return { id: published.id, status: published.status, configVersion: configVersion.version };
    });
  }

  async createPaymentTemplate(user: AuthenticatedUser, providerId: string, dto: CreatePaymentTemplateDto) {
    const fieldKeys = new Set(dto.fields.map((field) => field.key));
    if (dto.fields.some((field) => /pin|password/i.test(`${field.key} ${field.label}`))) {
      throw new BadRequestException('Payment PINs and passwords cannot be template fields');
    }
    const placeholders = [...dto.template.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]);
    if (placeholders.some((placeholder) => !fieldKeys.has(placeholder))) {
      throw new BadRequestException('Every template placeholder must have a declared field');
    }

    return this.prisma.$transaction(async (tx) => {
      const provider = await tx.provider.findUnique({ where: { id: providerId } });
      if (!provider) throw new NotFoundException('Provider not found');
      const latest = await tx.providerPaymentTemplate.findFirst({
        orderBy: { version: 'desc' },
        where: { paymentType: dto.paymentType, providerId },
      });
      const template = await tx.providerPaymentTemplate.create({
        data: {
          providerId,
          paymentType: dto.paymentType,
          version: (latest?.version ?? 0) + 1,
          template: dto.template,
          instructions: dto.instructions?.trim() || null,
          status: PaymentTemplateStatus.DRAFT,
          fields: {
            create: dto.fields.map((field) => ({
              key: field.key,
              label: field.label,
              valueType: field.valueType,
              isRequired: field.isRequired,
              validationPattern: field.validationPattern,
              sortOrder: field.sortOrder,
            })),
          },
        },
        include: { fields: true },
      });
      await this.writeAudit(tx, user, 'PAYMENT_TEMPLATE_DRAFT_CREATED', 'ProviderPaymentTemplate', template.id, [
        ['providerCode', provider.code],
        ['paymentType', template.paymentType],
        ['version', String(template.version)],
        ['fieldCount', String(template.fields.length)],
      ]);
      return template;
    });
  }

  async publishPaymentTemplate(user: AuthenticatedUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.providerPaymentTemplate.findUnique({
        include: { provider: true },
        where: { id },
      });
      if (!template) throw new NotFoundException('Payment template not found');
      const latestVersion = await tx.providerConfigVersion.findFirst({
        orderBy: { version: 'desc' },
        where: { providerId: template.providerId },
      });
      const configVersion = await tx.providerConfigVersion.create({
        data: {
          providerId: template.providerId,
          version: (latestVersion?.version ?? 0) + 1,
          status: ProviderRuleStatus.ACTIVE,
          notes: `Published payment template ${template.id}`,
          publishedAt: new Date(),
        },
      });
      const published = await tx.providerPaymentTemplate.update({
        data: {
          configVersionId: configVersion.id,
          status: PaymentTemplateStatus.ACTIVE,
        },
        where: { id },
      });
      await this.writeAudit(tx, user, 'PAYMENT_TEMPLATE_PUBLISHED', 'ProviderPaymentTemplate', id, [
        ['providerCode', template.provider.code],
        ['paymentType', template.paymentType],
        ['configVersion', String(configVersion.version)],
      ]);
      return { id: published.id, status: published.status, configVersion: configVersion.version };
    });
  }

  createMerchant(user: AuthenticatedUser, dto: { displayName: string; providerCode?: string | null; merchantRef?: string | null }) {
    return this.merchantsService.createMerchant(user, dto);
  }

  async getOverview() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const [
      totalUsers,
      activeDevices,
      activeProviders,
      transactions30d,
      draftParserRules,
      draftPaymentTemplates,
      activeMerchants,
      parseGroups,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.device.count({ where: { status: 'TRUSTED' } }),
      this.prisma.provider.count({ where: { isActive: true } }),
      this.prisma.transaction.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      this.prisma.providerParserRule.count({ where: { status: ProviderRuleStatus.DRAFT } }),
      this.prisma.providerPaymentTemplate.count({ where: { status: PaymentTemplateStatus.DRAFT } }),
      this.prisma.merchant.count({ where: { isActive: true } }),
      this.prisma.rawSmsLog.groupBy({
        by: ['parseStatus'],
        _count: { _all: true },
        where: { createdAt: { gte: since } },
      }),
    ]);

    const parseCounts = Object.fromEntries(
      Object.values(RawSmsParseStatus).map((status) => [
        status,
        parseGroups.find((group) => group.parseStatus === status)?._count._all ?? 0,
      ]),
    ) as Record<RawSmsParseStatus, number>;
    const attempted = parseCounts.PARSED + parseCounts.FAILED;

    return {
      activeDevices,
      activeMerchants,
      activeProviders,
      draftParserRules,
      draftPaymentTemplates,
      parseCounts,
      parseSuccessRate: attempted === 0 ? null : parseCounts.PARSED / attempted,
      totalUsers,
      transactions30d,
    };
  }

  async getParserMetrics() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const [providers, groups] = await Promise.all([
      this.prisma.provider.findMany({
        orderBy: { displayName: 'asc' },
        select: { id: true, code: true, displayName: true },
      }),
      this.prisma.rawSmsLog.groupBy({
        by: ['providerId', 'parseStatus'],
        _count: { _all: true },
        where: { createdAt: { gte: since } },
      }),
    ]);

    const rows = [...providers, { id: null, code: 'unknown', displayName: 'Unmatched sender' }];
    return rows.map((provider) => {
      const count = (status: RawSmsParseStatus) =>
        groups.find((group) => group.providerId === provider.id && group.parseStatus === status)?._count._all ?? 0;
      const parsed = count(RawSmsParseStatus.PARSED);
      const failed = count(RawSmsParseStatus.FAILED);
      return {
        providerId: provider.id,
        providerCode: provider.code,
        displayName: provider.displayName,
        parsed,
        failed,
        unparsed: count(RawSmsParseStatus.UNPARSED),
        ignored: count(RawSmsParseStatus.IGNORED),
        successRate: parsed + failed === 0 ? null : parsed / (parsed + failed),
      };
    });
  }

  async getProvider(id: string) {
    const provider = await this.prisma.provider.findUnique({
      include: {
        aliases: { orderBy: [{ priority: 'asc' }, { senderId: 'asc' }] },
        configVersions: { orderBy: { version: 'desc' }, take: 20 },
        parserRules: {
          include: { fieldMappings: true, examples: { orderBy: { createdAt: 'asc' } }, _count: { select: { examples: true } } },
          orderBy: [{ status: 'asc' }, { priority: 'asc' }],
        },
        paymentTemplates: {
          include: { fields: { orderBy: { sortOrder: 'asc' } } },
          orderBy: [{ paymentType: 'asc' }, { version: 'desc' }],
        },
      },
      where: { id },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    return provider;
  }

  async listParserRules(status?: ProviderRuleStatus) {
    return this.prisma.providerParserRule.findMany({
      include: { fieldMappings: true, examples: { orderBy: { createdAt: 'asc' } }, provider: { select: { code: true, displayName: true } } },
      orderBy: [{ providerId: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
      where: status ? { status } : undefined,
    });
  }

  async listPaymentTemplates(status?: PaymentTemplateStatus) {
    return this.prisma.providerPaymentTemplate.findMany({
      include: { fields: { orderBy: { sortOrder: 'asc' } }, provider: { select: { code: true, displayName: true } } },
      orderBy: [{ providerId: 'asc' }, { paymentType: 'asc' }, { version: 'desc' }],
      where: status ? { status } : undefined,
    });
  }

  async updateParserRuleStatus(user: AuthenticatedUser, id: string, status: ProviderRuleStatus) {
    if (status === ProviderRuleStatus.ACTIVE) {
      throw new BadRequestException('Use the publish endpoint to activate a parser rule');
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.providerParserRule.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Parser rule not found');
      const rule = await tx.providerParserRule.update({ data: { status }, where: { id } });
      await this.writeAudit(tx, user, 'PARSER_RULE_STATUS_CHANGED', 'ProviderParserRule', id, [
        ['status.before', existing.status],
        ['status.after', rule.status],
      ]);
      return { id: rule.id, status: rule.status };
    });
  }

  async listUssdReports(status?: UssdReportStatus) {
    return this.prisma.ussdTemplateReport.findMany({
      include: {
        paymentTemplate: { select: { id: true, status: true, template: true, version: true } },
        provider: { select: { code: true, displayName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      where: status ? { status } : undefined,
    });
  }

  async updateUssdReport(user: AuthenticatedUser, id: string, dto: UpdateUssdReportDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.ussdTemplateReport.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('USSD report not found');
      const report = await tx.ussdTemplateReport.update({
        data: {
          resolutionNote: dto.resolutionNote ?? existing.resolutionNote,
          reviewedAt: new Date(),
          reviewedById: user.userId,
          status: dto.status,
        },
        where: { id },
      });
      await this.writeAudit(tx, user, 'USSD_REPORT_REVIEWED', 'UssdTemplateReport', id, [
        ['status.before', existing.status],
        ['status.after', report.status],
      ]);
      return { id: report.id, status: report.status };
    });
  }

  async updatePaymentTemplateStatus(user: AuthenticatedUser, id: string, status: PaymentTemplateStatus) {
    if (status === PaymentTemplateStatus.ACTIVE) {
      throw new BadRequestException('Use the publish endpoint to activate a payment template');
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.providerPaymentTemplate.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Payment template not found');
      const template = await tx.providerPaymentTemplate.update({ data: { status }, where: { id } });
      await this.writeAudit(tx, user, 'PAYMENT_TEMPLATE_STATUS_CHANGED', 'ProviderPaymentTemplate', id, [
        ['status.before', existing.status],
        ['status.after', template.status],
      ]);
      return { id: template.id, status: template.status };
    });
  }

  async createSenderAlias(user: AuthenticatedUser, providerId: string, dto: CreateSenderAliasDto) {
    return this.prisma.$transaction(async (tx) => {
      const provider = await tx.provider.findUnique({ where: { id: providerId } });
      if (!provider) throw new NotFoundException('Provider not found');
      const alias = await tx.providerSenderAlias.create({
        data: { providerId, senderId: dto.senderId.trim(), priority: dto.priority },
      });
      await this.writeAudit(tx, user, 'SENDER_ALIAS_CREATED', 'ProviderSenderAlias', alias.id, [
        ['providerCode', provider.code],
        ['senderId', alias.senderId],
      ]);
      return alias;
    });
  }

  async updateSenderAlias(user: AuthenticatedUser, id: string, dto: UpdateSenderAliasDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.providerSenderAlias.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Sender alias not found');
      const alias = await tx.providerSenderAlias.update({
        data: { senderId: dto.senderId?.trim(), priority: dto.priority, isActive: dto.isActive },
        where: { id },
      });
      await this.writeAudit(tx, user, 'SENDER_ALIAS_UPDATED', 'ProviderSenderAlias', id, [
        ['senderId.before', existing.senderId], ['senderId.after', alias.senderId],
        ['isActive.before', String(existing.isActive)], ['isActive.after', String(alias.isActive)],
      ]);
      return alias;
    });
  }

  async listPresetCategories() {
    return this.prisma.category.findMany({
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, icon: true, color: true, parentId: true, updatedAt: true },
      where: { kind: CategoryKind.PRESET, userId: null },
    });
  }

  async createPresetCategory(user: AuthenticatedUser, dto: CreatePresetCategoryDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.parentId) await this.findPresetCategory(tx, dto.parentId);
      const category = await tx.category.create({
        data: {
          kind: CategoryKind.PRESET,
          name: dto.name.trim(),
          icon: dto.icon,
          color: dto.color,
          parentId: dto.parentId,
        },
      });
      await this.writeAudit(tx, user, 'PRESET_CATEGORY_CREATED', 'Category', category.id, [
        ['name', category.name],
      ]);
      return category;
    });
  }

  async updatePresetCategory(user: AuthenticatedUser, id: string, dto: UpdatePresetCategoryDto) {
    if (dto.parentId === id) throw new BadRequestException('A category cannot be its own parent');
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findPresetCategory(tx, id);
      if (dto.parentId) await this.findPresetCategory(tx, dto.parentId);
      const category = await tx.category.update({
        data: {
          name: dto.name?.trim(),
          icon: dto.icon,
          color: dto.color,
          parentId: dto.parentId,
        },
        where: { id },
      });
      await this.writeAudit(tx, user, 'PRESET_CATEGORY_UPDATED', 'Category', id, [
        ['name.before', existing.name],
        ['name.after', category.name],
      ]);
      return category;
    });
  }

  async listUsers(query: ListUsersQueryDto) {
    const search = query.search?.trim();
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phoneNumber: true,
        role: true,
        status: true,
        createdAt: true,
        lockedUntil: true,
        _count: { select: { devices: true, transactions: true } },
      },
      take: query.limit ?? 50,
      where: search ? { phoneNumber: { contains: search } } : undefined,
    });
    return users.map(({ _count, createdAt, lockedUntil, ...rest }) => ({
      ...rest,
      createdAt: createdAt.toISOString(),
      lockedUntil: lockedUntil?.toISOString() ?? null,
      deviceCount: _count.devices,
      transactionCount: _count.transactions,
    }));
  }

  async updateUserAccess(actor: AuthenticatedUser, id: string, dto: UpdateUserAccessDto) {
    if (id === actor.userId) {
      throw new ForbiddenException('You cannot change your own role or status');
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('User not found');
      const user = await tx.user.update({
        data: { role: dto.role, status: dto.status },
        select: { id: true, phoneNumber: true, role: true, status: true },
        where: { id },
      });
      if (user.status !== UserStatus.ACTIVE) {
        await tx.authSession.updateMany({
          data: { revokedAt: new Date(), status: AuthSessionStatus.REVOKED },
          where: { status: AuthSessionStatus.ACTIVE, userId: id },
        });
      }
      await this.writeAudit(tx, actor, 'USER_ACCESS_UPDATED', 'User', id, [
        ['role.before', existing.role], ['role.after', user.role],
        ['status.before', existing.status], ['status.after', user.status],
      ]);
      return user;
    });
  }

  /** Aggregate-only view: no user identifiers leave this method. */
  async getSubscriptionStats(): Promise<SubscriptionStatsResponse> {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
    const [groups, subscribers, dueNext7Days] = await Promise.all([
      this.prisma.subscription.groupBy({
        by: ['category', 'frequency', 'status'],
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.user.count({ where: { subscriptions: { some: { status: SubscriptionStatus.ACTIVE } } } }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE, nextDueAt: { gte: now, lte: weekAhead } },
      }),
    ]);

    type Group = (typeof groups)[number];
    const isActive = (group: Group) => group.status === SubscriptionStatus.ACTIVE;
    const count = (predicate: (group: Group) => boolean) =>
      groups.filter(predicate).reduce((sum, group) => sum + group._count._all, 0);
    const monthly = (predicate: (group: Group) => boolean) =>
      Math.round(
        groups
          .filter((group) => isActive(group) && predicate(group))
          .reduce((sum, group) => sum + Number(group._sum.amount ?? 0) * MONTHLY_FACTOR[group.frequency], 0) * 100,
      ) / 100;

    return {
      totals: {
        total: count(() => true),
        active: count(isActive),
        paused: count((group) => group.status === SubscriptionStatus.PAUSED),
        cancelled: count((group) => group.status === SubscriptionStatus.CANCELLED),
        subscribers,
        activeMonthlyAmount: monthly(() => true),
        dueNext7Days,
      },
      byCategory: Object.values(SubscriptionCategory).map((category) => ({
        category,
        total: count((group) => group.category === category),
        active: count((group) => group.category === category && isActive(group)),
        activeMonthlyAmount: monthly((group) => group.category === category),
      })),
      byFrequency: Object.values(SubscriptionFrequency).map((frequency) => ({
        frequency,
        total: count((group) => group.frequency === frequency),
        active: count((group) => group.frequency === frequency && isActive(group)),
      })),
    };
  }

  /** Read-only support view of one user's subscriptions; every access is audit-logged. */
  async listUserSubscriptions(actor: AuthenticatedUser, userId: string): Promise<UserSubscriptionsResponse> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        select: { id: true, phoneNumber: true, status: true },
        where: { id: userId },
      });
      if (!user) throw new NotFoundException('User not found');
      const subscriptions = await tx.subscription.findMany({
        include: ADMIN_SUBSCRIPTION_INCLUDE,
        orderBy: [{ status: 'asc' }, { nextDueAt: 'asc' }, { name: 'asc' }],
        where: { userId },
      });
      await this.writeAudit(tx, actor, 'USER_SUBSCRIPTIONS_VIEWED', 'User', userId, [
        ['subscriptionCount', String(subscriptions.length)],
      ]);
      return { user, subscriptions: subscriptions.map(toAdminSubscription) };
    });
  }

  async listAllSubscriptions(actor: AuthenticatedUser, query: ListAdminSubscriptionsQueryDto): Promise<AdminSubscriptionResponse[]> {
    this.assertAdmin(actor);
    const search = query.search?.trim();
    return this.prisma.$transaction(async (tx) => {
      const subscriptions = await tx.subscription.findMany({
        include: ADMIN_SUBSCRIPTION_INCLUDE,
        orderBy: [{ updatedAt: 'desc' }],
        take: query.limit ?? 200,
        where: {
          category: query.category,
          status: query.status,
          ...(search
            ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { user: { phoneNumber: { contains: search } } }] }
            : {}),
        },
      });
      await this.writeAudit(tx, actor, 'SUBSCRIPTIONS_LISTED', 'Subscription', 'all', [
        ['resultCount', String(subscriptions.length)],
        ...(query.status ? [['status', query.status] as [string, string]] : []),
        ...(query.category ? [['category', query.category] as [string, string]] : []),
        ...(search ? [['search', 'provided'] as [string, string]] : []),
      ]);
      return subscriptions.map(toAdminSubscription);
    });
  }

  async createSubscriptionForUser(actor: AuthenticatedUser, dto: AdminCreateSubscriptionDto): Promise<AdminSubscriptionResponse> {
    this.assertAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({ select: { id: true, status: true }, where: { phoneNumber: dto.phoneNumber } });
      if (!owner) throw new NotFoundException('No account uses this phone number');
      if (owner.status === UserStatus.DELETED) throw new ConflictException('Cannot add subscriptions to a deleted account');
      await this.assertMerchant(tx, dto.merchantId);
      const frequency = dto.frequency ?? SubscriptionFrequency.MONTHLY;
      const subscription = await tx.subscription.create({
        data: {
          amount: dto.amount,
          category: dto.category,
          currency: dto.currency ?? 'ETB',
          frequency,
          merchantId: dto.merchantId,
          name: dto.name,
          nextDueAt: dto.nextDueAt ? new Date(dto.nextDueAt) : undefined,
          recurrenceRule: FREQUENCY_RULES[frequency],
          status: SubscriptionStatus.ACTIVE,
          userId: owner.id,
        },
        include: ADMIN_SUBSCRIPTION_INCLUDE,
      });
      await this.writeAudit(tx, actor, 'SUBSCRIPTION_CREATED', 'Subscription', subscription.id, [
        ['userId', owner.id], ['category', subscription.category], ['frequency', subscription.frequency],
      ]);
      return toAdminSubscription(subscription);
    });
  }

  async updateSubscriptionAsAdmin(actor: AuthenticatedUser, id: string, dto: UpdateSubscriptionDto): Promise<AdminSubscriptionResponse> {
    this.assertAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Subscription not found');
      await this.assertMerchant(tx, dto.merchantId);
      const subscription = await tx.subscription.update({
        data: {
          amount: dto.amount,
          category: dto.category,
          currency: dto.currency,
          frequency: dto.frequency,
          merchantId: dto.merchantId,
          name: dto.name,
          nextDueAt: dto.nextDueAt === null ? null : dto.nextDueAt ? new Date(dto.nextDueAt) : undefined,
          recurrenceRule: dto.frequency ? FREQUENCY_RULES[dto.frequency] : undefined,
          status: dto.status,
        },
        include: ADMIN_SUBSCRIPTION_INCLUDE,
        where: { id },
      });
      const changed = (Object.keys(dto) as (keyof UpdateSubscriptionDto)[]).filter((key) => dto[key] !== undefined);
      await this.writeAudit(tx, actor, 'SUBSCRIPTION_UPDATED', 'Subscription', id, [
        ['userId', existing.userId],
        ['fields', changed.join(',') || 'none'],
        ['status.before', existing.status], ['status.after', subscription.status],
      ]);
      return toAdminSubscription(subscription);
    });
  }

  private assertAdmin(actor: AuthenticatedUser): void {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Administrator access required');
  }

  private async assertMerchant(tx: Prisma.TransactionClient, merchantId: string | null | undefined): Promise<void> {
    if (!merchantId) return;
    const merchant = await tx.merchant.findUnique({ select: { id: true }, where: { id: merchantId } });
    if (!merchant) throw new BadRequestException('Merchant not found');
  }

  private async findPresetCategory(tx: Prisma.TransactionClient, id: string) {
    const category = await tx.category.findFirst({
      where: { id, kind: CategoryKind.PRESET, userId: null },
    });
    if (!category) throw new NotFoundException('Preset category not found');
    return category;
  }

  updateMerchant(user: AuthenticatedUser, id: string, dto: { displayName?: string; providerCode?: string | null; merchantRef?: string | null; isActive?: boolean }) {
    return this.merchantsService.updateMerchant(user, id, dto);
  }

  private validatePattern(pattern: string): void {
    try {
      new RegExp(pattern);
    } catch {
      throw new BadRequestException('Parser rule pattern is not a valid regular expression');
    }
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    action: string,
    targetType: string,
    targetId: string,
    details: [string, string][],
  ): Promise<void> {
    this.auditLogger.log(`${action} ${targetType}=${shortId(targetId)} by user=${shortId(user.userId)} (${user.role})`);
    await tx.auditLog.create({
      data: {
        action,
        actorId: user.userId,
        targetId,
        targetType,
        details: { create: details.map(([key, value]) => ({ key, value })) },
      },
    });
  }
}