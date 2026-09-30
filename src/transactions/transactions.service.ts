import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  RawSmsParseStatus,
  ReconciliationStatus,
  SyncStatus,
  TransactionSource,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.service';
import { BalancesService } from '../balances/balances.service';
import { shortId } from '../common/logging';
import { ParsedSmsResult, ParserService } from '../parser/parser.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManualTransactionDto } from './dto/create-manual-transaction.dto';
import { IngestRawSmsDto } from './dto/ingest-raw-sms.dto';
import { IngestSmsTransactionDto } from './dto/ingest-sms-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import {
  TransactionListResponseDto,
  TransactionResponseDto,
} from './dto/transaction-response.dto';

type TransactionRecord = Prisma.TransactionGetPayload<{
  include: {
    counterparty: true;
    provider: true;
  };
}>;

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly balancesService: BalancesService,
    private readonly parserService: ParserService,
    private readonly prisma: PrismaService,
  ) {}

  async listTransactions(
    user: AuthenticatedUser,
    query: ListTransactionsQueryDto,
  ): Promise<TransactionListResponseDto> {
    const limit = query.limit ?? 30;
    const records = await this.prisma.transaction.findMany({
      cursor: query.cursor ? { id: query.cursor } : undefined,
      include: {
        counterparty: true,
        provider: true,
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      skip: query.cursor ? 1 : 0,
      take: limit + 1,
      where: {
        categoryId: query.categoryId,
        deletedAt: null,
        occurredAt: query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lt: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
        provider: query.providerCode ? { code: query.providerCode } : undefined,
        source: query.source,
        type: query.type,
        userId: user.userId,
      },
    });

    const items = records.slice(0, limit);

    return {
      items: items.map((record) => this.toResponse(record)),
      nextCursor: records.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async getTransaction(
    user: AuthenticatedUser,
    id: string,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.prisma.transaction.findFirst({
      include: {
        counterparty: true,
        provider: true,
      },
      where: {
        deletedAt: null,
        id,
        userId: user.userId,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction not found: ${id}`);
    }

    return this.toResponse(transaction);
  }

  async updateTransactionCategory(
    user: AuthenticatedUser,
    id: string,
    categoryId: string | null,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.prisma.transaction.findFirst({
      select: { id: true },
      where: { deletedAt: null, id, userId: user.userId },
    });
    if (!transaction) {
      throw new NotFoundException(`Transaction not found: ${id}`);
    }

    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        select: { id: true },
        where: {
          id: categoryId,
          OR: [{ userId: null }, { userId: user.userId }],
        },
      });
      if (!category) {
        throw new NotFoundException(`Category not found: ${categoryId}`);
      }
    }

    const updated = await this.prisma.transaction.update({
      data: { categoryId, syncStatus: SyncStatus.SYNCED },
      include: { counterparty: true, provider: true },
      where: { id },
    });
    this.logger.log(
      `Transaction category updated user=${shortId(user.userId)} tx=${shortId(id)} category=${shortId(categoryId)}`,
    );
    return this.toResponse(updated);
  }

  async createManualTransaction(
    user: AuthenticatedUser,
    dto: CreateManualTransactionDto,
  ): Promise<TransactionResponseDto> {
    const existing = await this.findExistingLocalTransaction(
      user.userId,
      dto.localId,
    );

    if (existing) {
      return this.toResponse(existing);
    }

    const provider = dto.providerCode
      ? await this.prisma.provider.findUnique({
          where: { code: dto.providerCode },
        })
      : null;
    const counterpartyId = await this.resolveCounterparty(user.userId, {
      displayName: dto.counterpartyName,
      phoneNumber: dto.counterpartyPhone,
    });

    const transaction = await this.prisma.transaction.create({
      data: {
        accountId: dto.accountId,
        amount: dto.amount,
        categoryId: dto.categoryId,
        counterpartyId,
        currency: dto.currency ?? 'ETB',
        direction: dto.direction,
        localId: dto.localId,
        note: dto.note,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        providerId: provider?.id,
        reconciliationStatus: ReconciliationStatus.UNRECONCILED,
        reference: dto.reference,
        source: TransactionSource.MANUAL,
        syncStatus: SyncStatus.SYNCED,
        type: dto.type,
        userId: user.userId,
      },
      include: {
        counterparty: true,
        provider: true,
      },
    });

    this.logger.log(`Manual transaction created user=${shortId(user.userId)} tx=${shortId(transaction.id)} type=${transaction.type}`);
    return this.toResponse(transaction);
  }

  async ingestSmsTransaction(
    user: AuthenticatedUser,
    dto: IngestSmsTransactionDto,
  ): Promise<TransactionResponseDto> {
    const existing = await this.findExistingLocalTransaction(
      user.userId,
      dto.localId,
    );

    if (existing) {
      this.logger.debug(`SMS transaction already synced user=${shortId(user.userId)} localId=${dto.localId}`);
      return this.toResponse(existing);
    }

    const provider = await this.resolveProvider(dto.providerCode, dto.senderId);
    const duplicate = await this.findExistingByReference(
      user.userId,
      provider?.id,
      dto.reference,
    );
    if (duplicate) {
      this.logger.log(`SMS transaction deduplicated by reference user=${shortId(user.userId)} provider=${provider?.code ?? '-'}`);
      return this.toResponse(duplicate);
    }
    const counterpartyId = await this.resolveCounterparty(user.userId, {
      displayName: dto.counterpartyName,
      phoneNumber: dto.counterpartyPhone,
    });

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          amount: dto.amount,
          counterpartyId,
          currency: dto.currency ?? 'ETB',
          deviceId: user.deviceId,
          direction: dto.direction,
          localId: dto.localId,
          occurredAt: new Date(dto.receivedAt),
          providerId: provider?.id,
          reconciliationStatus: ReconciliationStatus.UNRECONCILED,
          reference: dto.reference,
          source: TransactionSource.SMS,
          syncStatus: SyncStatus.SYNCED,
          type: dto.type,
          userId: user.userId,
        },
      });

      if (dto.messageBody) {
        await tx.rawSmsLog.create({
          data: {
            deviceId: user.deviceId,
            localId: dto.localId,
            messageBody: dto.messageBody,
            parseStatus: RawSmsParseStatus.PARSED,
            providerId: provider?.id,
            receivedAt: new Date(dto.receivedAt),
            senderId: dto.senderId,
            transactionId: created.id,
            userId: user.userId,
          },
        });
      }

      if (dto.currentBalance) {
        await this.balancesService.createSnapshotAndCheckDiscrepancy(tx, {
          amount: dto.amount,
          direction: dto.direction,
          providerId: provider?.id,
          recordedAt: new Date(dto.receivedAt),
          reportedBalance: dto.currentBalance,
          transactionId: created.id,
          userId: user.userId,
        });
      }

      return tx.transaction.findUniqueOrThrow({
        include: {
          counterparty: true,
          provider: true,
        },
        where: { id: created.id },
      });
    });

    return this.toResponse(transaction);
  }

  async ingestRawSms(
    user: AuthenticatedUser,
    dto: IngestRawSmsDto,
  ): Promise<TransactionResponseDto> {
    const existing = await this.findExistingLocalTransaction(
      user.userId,
      dto.localId,
    );

    if (existing) {
      return this.toResponse(existing);
    }

    const previousRawSms = dto.localId
      ? await this.prisma.rawSmsLog.findUnique({
          include: {
            transaction: {
              include: { counterparty: true, provider: true },
            },
          },
          where: {
            userId_localId: {
              localId: dto.localId,
              userId: user.userId,
            },
          },
        })
      : null;

    if (previousRawSms?.transaction) {
      return this.toResponse(previousRawSms.transaction);
    }

    const parsed = await this.parserService.parseSms(
      dto.senderId,
      dto.messageBody,
    );
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

    if (!parsed) {
      const provider = await this.parserService.findProvider(dto.senderId);
      this.logger.warn(
        `Raw SMS not parsed user=${shortId(user.userId)} sender=${dto.senderId} provider=${provider?.code ?? 'unknown sender'} activeRules=${provider?.parserRules.length ?? 0}`,
      );
      const rawSmsData = {
        deviceId: user.deviceId,
        localId: dto.localId,
        messageBody: dto.messageBody,
        parseStatus: RawSmsParseStatus.FAILED,
        providerId: provider?.id,
        receivedAt,
        senderId: dto.senderId,
        userId: user.userId,
      };
      if (dto.localId) {
        await this.prisma.rawSmsLog.upsert({
          create: rawSmsData,
          update: {
            deviceId: user.deviceId,
            messageBody: dto.messageBody,
            parseStatus: RawSmsParseStatus.FAILED,
            providerId: provider?.id,
            receivedAt,
            senderId: dto.senderId,
          },
          where: {
            userId_localId: { localId: dto.localId, userId: user.userId },
          },
        });
      } else {
        await this.prisma.rawSmsLog.create({ data: rawSmsData });
      }
      throw new UnprocessableEntityException(
        'SMS did not match any active provider parser rule',
      );
    }

    return this.createParsedSmsTransaction(user, dto, parsed, receivedAt);
  }

  async findUpdatedTransactions(
    user: AuthenticatedUser,
    cursor: {
      snapshotAt: Date;
      afterUpdatedAt?: Date;
      afterId?: string;
    },
    limit: number,
  ): Promise<{
    items: TransactionResponseDto[];
    hasMore: boolean;
    nextPosition: { updatedAt: string; id: string } | null;
  }> {
    const seekCondition: Prisma.TransactionWhereInput | undefined =
      cursor.afterUpdatedAt
        ? cursor.afterId
          ? {
              OR: [
                { updatedAt: { gt: cursor.afterUpdatedAt } },
                {
                  updatedAt: cursor.afterUpdatedAt,
                  id: { gt: cursor.afterId },
                },
              ],
            }
          : { updatedAt: { gt: cursor.afterUpdatedAt } }
        : undefined;
    const records = await this.prisma.transaction.findMany({
      include: {
        counterparty: true,
        provider: true,
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      where: {
        AND: [
          { updatedAt: { lte: cursor.snapshotAt } },
          ...(seekCondition ? [seekCondition] : []),
        ],
        userId: user.userId,
      },
    });

    const hasMore = records.length > limit;
    const page = records.slice(0, limit);
    const lastRecord = page.at(-1);

    return {
      hasMore,
      items: page.map((transaction) => this.toResponse(transaction)),
      nextPosition:
        hasMore && lastRecord
          ? { id: lastRecord.id, updatedAt: lastRecord.updatedAt.toISOString() }
          : null,
    };
  }

  /** Provider references are unique per provider, so a repeat means the same real-world transaction. */
  private async findExistingByReference(
    userId: string,
    providerId: string | null | undefined,
    reference: string | null | undefined,
  ): Promise<TransactionRecord | null> {
    const normalized = reference?.trim();
    if (!providerId || !normalized) {
      return null;
    }

    return this.prisma.transaction.findFirst({
      include: {
        counterparty: true,
        provider: true,
      },
      where: {
        deletedAt: null,
        providerId,
        reference: { equals: normalized, mode: 'insensitive' },
        userId,
      },
    });
  }

  private async findExistingLocalTransaction(
    userId: string,
    localId: string | undefined,
  ): Promise<TransactionRecord | null> {
    if (!localId) {
      return null;
    }

    return this.prisma.transaction.findUnique({
      include: {
        counterparty: true,
        provider: true,
      },
      where: {
        userId_localId: {
          localId,
          userId,
        },
      },
    });
  }

  private async createParsedSmsTransaction(
    user: AuthenticatedUser,
    dto: IngestRawSmsDto,
    parsed: ParsedSmsResult,
    receivedAt: Date,
  ): Promise<TransactionResponseDto> {
    const duplicate = await this.findExistingByReference(
      user.userId,
      parsed.providerId,
      parsed.reference,
    );
    if (duplicate) {
      return this.toResponse(duplicate);
    }
    const counterpartyId = await this.resolveCounterparty(user.userId, {
      displayName: parsed.counterpartyName,
      phoneNumber: parsed.counterpartyPhone,
    });
    const occurredAt = parsed.transactionAt ?? receivedAt;

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          amount: parsed.amount,
          counterpartyId,
          currency: parsed.currency,
          deviceId: user.deviceId,
          direction: parsed.direction,
          localId: dto.localId,
          occurredAt,
          providerId: parsed.providerId,
          reconciliationStatus: ReconciliationStatus.UNRECONCILED,
          reference: parsed.reference,
          source: TransactionSource.SMS,
          syncStatus: SyncStatus.SYNCED,
          type: parsed.transactionType,
          userId: user.userId,
        },
      });

      const rawSmsData = {
        deviceId: user.deviceId,
        localId: dto.localId,
        messageBody: dto.messageBody,
        parseStatus: RawSmsParseStatus.PARSED,
        providerId: parsed.providerId,
        receivedAt,
        senderId: dto.senderId,
        transactionId: created.id,
        userId: user.userId,
      };
      if (dto.localId) {
        await tx.rawSmsLog.upsert({
          create: rawSmsData,
          update: {
            deviceId: user.deviceId,
            messageBody: dto.messageBody,
            parseStatus: RawSmsParseStatus.PARSED,
            providerId: parsed.providerId,
            receivedAt,
            senderId: dto.senderId,
            transactionId: created.id,
          },
          where: {
            userId_localId: { localId: dto.localId, userId: user.userId },
          },
        });
      } else {
        await tx.rawSmsLog.create({ data: rawSmsData });
      }

      if (parsed.currentBalance) {
        await this.balancesService.createSnapshotAndCheckDiscrepancy(tx, {
          amount: parsed.amount,
          direction: parsed.direction,
          providerId: parsed.providerId,
          recordedAt: occurredAt,
          reportedBalance: parsed.currentBalance,
          transactionId: created.id,
          userId: user.userId,
        });
      }

      return tx.transaction.findUniqueOrThrow({
        include: {
          counterparty: true,
          provider: true,
        },
        where: { id: created.id },
      });
    });

    return this.toResponse(transaction);
  }

  private async resolveProvider(
    providerCode: string | undefined,
    senderId: string,
  ): Promise<{ id: string; code: string; displayName: string } | null> {
    if (providerCode) {
      return this.prisma.provider.findUnique({ where: { code: providerCode } });
    }

    const aliasId = await this.parserService.findAliasId(senderId);
    if (!aliasId) return null;
    const alias = await this.prisma.providerSenderAlias.findUnique({
      include: { provider: true },
      where: { id: aliasId },
    });

    return alias?.provider ?? null;
  }

  private async resolveCounterparty(
    userId: string,
    input: { displayName?: string; phoneNumber?: string },
  ): Promise<string | undefined> {
    if (!input.displayName && !input.phoneNumber) {
      return undefined;
    }

    const displayName = input.displayName ?? input.phoneNumber ?? 'Unknown';

    if (input.phoneNumber) {
      const existing = await this.prisma.counterparty.findFirst({
        where: {
          phoneNumber: input.phoneNumber,
          userId,
        },
      });

      if (existing) {
        return existing.id;
      }
    }

    const created = await this.prisma.counterparty.create({
      data: {
        displayName,
        phoneNumber: input.phoneNumber,
        userId,
      },
    });

    return created.id;
  }

  private toResponse(transaction: TransactionRecord): TransactionResponseDto {
    return {
      amount: transaction.amount.toFixed(2),
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      counterpartyName: transaction.counterparty?.displayName ?? null,
      counterpartyPhone: transaction.counterparty?.phoneNumber ?? null,
      createdAt: transaction.createdAt.toISOString(),
      currency: transaction.currency,
      direction: transaction.direction,
      id: transaction.id,
      localId: transaction.localId,
      note: transaction.note,
      occurredAt: transaction.occurredAt?.toISOString() ?? null,
      providerCode: transaction.provider?.code ?? null,
      providerName: transaction.provider?.displayName ?? null,
      reconciliationStatus: transaction.reconciliationStatus,
      reference: transaction.reference,
      source: transaction.source,
      syncStatus: transaction.syncStatus,
      type: transaction.type,
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }
}
