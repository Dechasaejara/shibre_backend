import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PaymentTemplateStatus,
  Prisma,
  ProviderRuleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProviderConfigProviderDto,
  ProviderConfigResponseDto,
  ProviderParserRuleDto,
  ProviderPaymentTemplateDto,
} from './dto/provider-config-response.dto';
import { ProviderSummaryResponseDto } from './dto/provider-summary-response.dto';

type ProviderSummaryRecord = Prisma.ProviderGetPayload<object>;

type ProviderConfigRecord = Prisma.ProviderGetPayload<{
  include: {
    aliases: true;
    configVersions: true;
    parserRules: {
      include: {
        examples: true;
        fieldMappings: true;
      };
    };
    paymentTemplates: {
      include: {
        fields: true;
      };
    };
  };
}>;

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async listProviders(): Promise<ProviderSummaryResponseDto[]> {
    const providers = await this.prisma.provider.findMany({
      orderBy: { displayName: 'asc' },
    });

    return providers.map((provider) => this.toProviderSummary(provider));
  }

  async getProviderByCode(code: string): Promise<ProviderSummaryResponseDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { code },
    });

    if (!provider) {
      throw new NotFoundException(`Provider not found: ${code}`);
    }

    return this.toProviderSummary(provider);
  }

  async getLatestProviderConfig(): Promise<ProviderConfigResponseDto> {
    const providers = await this.prisma.provider.findMany({
      include: {
        aliases: {
          where: { isActive: true },
          orderBy: [{ priority: 'asc' }, { senderId: 'asc' }],
        },
        configVersions: {
          where: { status: ProviderRuleStatus.ACTIVE },
          orderBy: { version: 'desc' },
          take: 1,
        },
        parserRules: {
          where: { status: ProviderRuleStatus.ACTIVE },
          include: {
            examples: true,
            fieldMappings: {
              orderBy: [{ targetField: 'asc' }, { captureGroup: 'asc' }],
            },
          },
          orderBy: [{ priority: 'asc' }, { transactionType: 'asc' }],
        },
        paymentTemplates: {
          where: { status: PaymentTemplateStatus.ACTIVE },
          include: {
            fields: {
              orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
            },
          },
          orderBy: [{ paymentType: 'asc' }, { version: 'desc' }],
        },
      },
      orderBy: { displayName: 'asc' },
      where: { isActive: true },
    });

    return {
      generatedAt: new Date().toISOString(),
      providers: providers.map((provider) => this.toProviderConfig(provider)),
    };
  }

  private toProviderSummary(
    provider: ProviderSummaryRecord,
  ): ProviderSummaryResponseDto {
    return {
      code: provider.code,
      countryCode: provider.countryCode,
      currency: provider.currency,
      displayName: provider.displayName,
      isActive: provider.isActive,
    };
  }

  private toProviderConfig(
    provider: ProviderConfigRecord,
  ): ProviderConfigProviderDto {
    const activeVersion = provider.configVersions[0]?.version ?? 1;

    return {
      code: provider.code,
      countryCode: provider.countryCode,
      currency: provider.currency,
      displayName: provider.displayName,
      parserRules: provider.parserRules.map((rule) => this.toParserRule(rule)),
      paymentTemplates: provider.paymentTemplates.map((template) =>
        this.toPaymentTemplate(template),
      ),
      senderAliases: provider.aliases.map((alias) => ({
        priority: alias.priority,
        senderId: alias.senderId,
      })),
      version: activeVersion,
    };
  }

  private toParserRule(
    rule: ProviderConfigRecord['parserRules'][number],
  ): ProviderParserRuleDto {
    return {
      examples: rule.examples.map((example) => ({
        expectedAmount: example.expectedAmount?.toFixed(2) ?? null,
        expectedBalance: example.expectedBalance?.toFixed(2) ?? null,
        expectedCounterpartyName: example.expectedCounterpartyName,
        expectedCounterpartyPhone: example.expectedCounterpartyPhone,
        expectedRef: example.expectedRef,
        expectedType: example.expectedType,
        messageBody: example.messageBody,
      })),
      fieldMappings: rule.fieldMappings.map((mapping) => ({
        captureGroup: mapping.captureGroup,
        isRequired: mapping.isRequired,
        targetField: mapping.targetField,
        transform: mapping.transform,
        valueType: mapping.valueType,
      })),
      pattern: rule.pattern,
      priority: rule.priority,
      transactionType: rule.transactionType,
    };
  }

  private toPaymentTemplate(
    template: ProviderConfigRecord['paymentTemplates'][number],
  ): ProviderPaymentTemplateDto {
    return {
      fields: template.fields.map((field) => ({
        isRequired: field.isRequired,
        key: field.key,
        label: field.label,
        sortOrder: field.sortOrder,
        validationPattern: field.validationPattern,
        valueType: field.valueType,
      })),
      paymentType: template.paymentType,
      template: template.template,
      instructions: template.instructions,
      version: template.version,
    };
  }
}
