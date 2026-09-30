import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentTemplateStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentTemplateFieldResponseDto,
  PaymentTemplateResponseDto,
} from './dto/payment-template-response.dto';
import {
  RenderPaymentTemplateDto,
  RenderPaymentTemplateResponseDto,
} from './dto/render-payment-template.dto';
import {
  CreateUssdReportDto,
  UssdReportResponseDto,
} from './dto/ussd-report.dto';

type PaymentTemplateRecord = Prisma.ProviderPaymentTemplateGetPayload<{
  include: {
    fields: true;
    provider: true;
  };
}>;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates(
    providerCode?: string,
  ): Promise<PaymentTemplateResponseDto[]> {
    const templates = await this.prisma.providerPaymentTemplate.findMany({
      include: {
        fields: {
          orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
        },
        provider: true,
      },
      orderBy: [{ provider: { displayName: 'asc' } }, { paymentType: 'asc' }],
      where: {
        provider: {
          ...(providerCode ? { code: providerCode } : {}),
          isActive: true,
        },
        status: PaymentTemplateStatus.ACTIVE,
      },
    });

    return templates.map((template) => this.toTemplateResponse(template));
  }

  async getTemplate(
    providerCode: string,
    paymentType: string,
  ): Promise<PaymentTemplateResponseDto> {
    const template = await this.findActiveTemplate(providerCode, paymentType);
    return this.toTemplateResponse(template);
  }

  async renderUssd(
    dto: RenderPaymentTemplateDto,
  ): Promise<RenderPaymentTemplateResponseDto> {
    const template = await this.findActiveTemplate(
      dto.providerCode,
      dto.paymentType,
    );
    const dialString = this.renderTemplate(template, dto.fields);

    return {
      dialString,
      paymentType: template.paymentType,
      providerCode: template.provider.code,
      providerName: template.provider.displayName,
      telUri: this.toTelUri(dialString),
      version: template.version,
    };
  }

  /**
   * Record that a published USSD template did not work for a user.
   * Only the template pattern is stored - never the rendered dial string,
   * recipient details, PINs, or passwords.
   */
  async reportBrokenTemplate(
    userId: string,
    dto: CreateUssdReportDto,
  ): Promise<UssdReportResponseDto> {
    const template = await this.findActiveTemplate(
      dto.providerCode,
      dto.paymentType,
    );

    const report = await this.prisma.ussdTemplateReport.create({
      data: {
        appVersion: dto.appVersion,
        dialPattern: template.template,
        note: dto.note,
        paymentTemplateId: template.id,
        paymentType: template.paymentType,
        platform: dto.platform,
        providerId: template.providerId,
        reason: dto.reason,
        templateVersion: template.version,
        userId,
      },
      select: { id: true, status: true, createdAt: true },
    });

    return {
      createdAt: report.createdAt.toISOString(),
      id: report.id,
      status: report.status,
    };
  }

  private async findActiveTemplate(
    providerCode: string,
    paymentType: string,
  ): Promise<PaymentTemplateRecord> {
    const template = await this.prisma.providerPaymentTemplate.findFirst({
      include: {
        fields: {
          orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
        },
        provider: true,
      },
      orderBy: { version: 'desc' },
      where: {
        paymentType,
        provider: {
          code: providerCode,
          isActive: true,
        },
        status: PaymentTemplateStatus.ACTIVE,
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Payment template not found: ${providerCode}/${paymentType}`,
      );
    }

    return template;
  }

  private renderTemplate(
    template: PaymentTemplateRecord,
    values: Record<string, string>,
  ): string {
    for (const field of template.fields) {
      const value = values[field.key];

      if (field.isRequired && !value) {
        throw new BadRequestException(`Missing required field: ${field.key}`);
      }

      if (value && field.validationPattern) {
        const regex = new RegExp(field.validationPattern);

        if (!regex.test(value)) {
          throw new BadRequestException(
            `Invalid value for field: ${field.key}`,
          );
        }
      }
    }

    return template.template.replaceAll(
      /\{([A-Za-z0-9_]+)\}/g,
      (_match, key) => {
        const value = values[String(key)];

        if (value === undefined) {
          throw new BadRequestException(
            `Missing template value: ${String(key)}`,
          );
        }

        return value;
      },
    );
  }

  private toTemplateResponse(
    template: PaymentTemplateRecord,
  ): PaymentTemplateResponseDto {
    return {
      fields: template.fields.map((field) => this.toFieldResponse(field)),
      paymentType: template.paymentType,
      providerCode: template.provider.code,
      providerName: template.provider.displayName,
      template: template.template,
      version: template.version,
    };
  }

  private toFieldResponse(
    field: PaymentTemplateRecord['fields'][number],
  ): PaymentTemplateFieldResponseDto {
    return {
      isRequired: field.isRequired,
      key: field.key,
      label: field.label,
      sortOrder: field.sortOrder,
      validationPattern: field.validationPattern,
      valueType: field.valueType,
    };
  }

  private toTelUri(dialString: string): string {
    return `tel:${dialString.replaceAll('#', '%23')}`;
  }
}
