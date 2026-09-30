import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ProviderRuleStatus,
  TransactionDirection,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ParseSmsResponseDto } from './dto/parse-sms-response.dto';
import { evaluateRule, senderKey } from './rule-evaluator';

type ProviderWithRules = Prisma.ProviderGetPayload<{
  include: {
    aliases: true;
    parserRules: {
      include: {
        fieldMappings: true;
      };
    };
  };
}>;

export interface ParsedSmsResult {
  providerId: string;
  providerCode: string;
  providerName: string;
  transactionType: TransactionType;
  direction: TransactionDirection;
  amount: string;
  currency: string;
  counterpartyName?: string;
  counterpartyPhone?: string;
  reference?: string;
  transactionAt?: Date;
  currentBalance?: string;
  additionalFields: Record<string, string>;
}

@Injectable()
export class ParserService {
  constructor(private readonly prisma: PrismaService) {}

  async previewSms(
    senderId: string,
    messageBody: string,
  ): Promise<ParseSmsResponseDto> {
    const parsed = await this.parseSms(senderId, messageBody);

    if (!parsed) {
      return {
        additionalFields: {},
        amount: null,
        counterpartyName: null,
        counterpartyPhone: null,
        currency: 'ETB',
        currentBalance: null,
        direction: null,
        matched: false,
        providerCode: null,
        providerName: null,
        reference: null,
        transactionAt: null,
        transactionType: null,
      };
    }

    return {
      additionalFields: parsed.additionalFields,
      amount: parsed.amount,
      counterpartyName: parsed.counterpartyName ?? null,
      counterpartyPhone: parsed.counterpartyPhone ?? null,
      currency: parsed.currency,
      currentBalance: parsed.currentBalance ?? null,
      direction: parsed.direction,
      matched: true,
      providerCode: parsed.providerCode,
      providerName: parsed.providerName,
      reference: parsed.reference ?? null,
      transactionAt: parsed.transactionAt?.toISOString() ?? null,
      transactionType: parsed.transactionType,
    };
  }

  async parseSms(
    senderId: string,
    messageBody: string,
  ): Promise<ParsedSmsResult | null> {
    const provider = await this.findProvider(senderId);

    if (!provider) {
      return null;
    }

    for (const rule of provider.parserRules) {
      const evaluation = evaluateRule(rule, messageBody);
      if (evaluation.failure || !evaluation.amount) continue;

      return {
        additionalFields: evaluation.additionalFields,
        amount: evaluation.amount,
        counterpartyName: evaluation.counterpartyName,
        counterpartyPhone: evaluation.counterpartyPhone,
        currency: 'ETB',
        currentBalance: evaluation.currentBalance,
        direction: evaluation.direction,
        providerCode: provider.code,
        providerId: provider.id,
        providerName: provider.displayName,
        reference: evaluation.reference,
        transactionAt: evaluation.transactionAt,
        transactionType: rule.transactionType,
      };
    }

    return null;
  }

  async findProvider(senderId: string): Promise<ProviderWithRules | null> {
    const aliasId = await this.findAliasId(senderId);
    if (!aliasId) return null;
    const alias = await this.prisma.providerSenderAlias.findUnique({
      include: {
        provider: {
          include: {
            aliases: true,
            parserRules: {
              include: {
                fieldMappings: true,
              },
              orderBy: [{ priority: 'asc' }, { transactionType: 'asc' }],
              where: { status: ProviderRuleStatus.ACTIVE },
            },
          },
        },
      },
      where: { id: aliasId },
    });

    return alias?.provider ?? null;
  }

  /** Active alias for a sender, ignoring case, spaces and punctuation ("ENAT BANK" = "EnatBank"). */
  async findAliasId(senderId: string): Promise<string | null> {
    const exact = await this.prisma.providerSenderAlias.findFirst({
      select: { id: true },
      where: { isActive: true, senderId: { equals: senderId.trim(), mode: 'insensitive' } },
    });
    if (exact) return exact.id;
    const key = senderKey(senderId);
    if (!key) return null;
    const aliases = await this.prisma.providerSenderAlias.findMany({
      orderBy: { priority: 'asc' },
      select: { id: true, senderId: true },
      where: { isActive: true },
    });
    return aliases.find((alias) => senderKey(alias.senderId) === key)?.id ?? null;
  }
}
