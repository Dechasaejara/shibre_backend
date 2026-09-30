import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ReconciliationStatus,
  TransactionSource,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MatchTransactionsDto,
  UpdateReconciliationStatusDto,
} from './dto/reconciliation.dto';
import {
  ReconciliationActionResponseDto,
  ReconciliationSuggestionDto,
  ReconciliationSuggestionsResponseDto,
  ReconciliationTransactionSummaryDto,
} from './dto/reconciliation-response.dto';

type TransactionWithCounterparty = Prisma.TransactionGetPayload<{
  include: { counterparty: true };
}>;

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async getSuggestions(
    user: AuthenticatedUser,
  ): Promise<ReconciliationSuggestionsResponseDto> {
    const [manualTransactions, smsTransactions] = await Promise.all([
      this.findUnreconciled(user.userId, TransactionSource.MANUAL),
      this.findUnreconciled(user.userId, TransactionSource.SMS),
    ]);
    const suggestions: ReconciliationSuggestionDto[] = [];

    for (const manualTransaction of manualTransactions) {
      for (const smsTransaction of smsTransactions) {
        const suggestion = this.scorePair(manualTransaction, smsTransaction);

        if (suggestion.score >= 70) {
          suggestions.push(suggestion);
        }
      }
    }

    return {
      suggestions: suggestions
        .sort((left, right) => right.score - left.score)
        .slice(0, 20),
    };
  }

  async matchTransactions(
    user: AuthenticatedUser,
    dto: MatchTransactionsDto,
  ): Promise<ReconciliationActionResponseDto> {
    const [manualTransaction, smsTransaction] = await Promise.all([
      this.findOwnedTransaction(user.userId, dto.manualTransactionId),
      this.findOwnedTransaction(user.userId, dto.smsTransactionId),
    ]);

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.updateMany({
        data: { reconciliationStatus: ReconciliationStatus.MATCHED },
        where: {
          id: { in: [manualTransaction.id, smsTransaction.id] },
          userId: user.userId,
        },
      });
      await tx.reconciliationEvent.create({
        data: {
          reason:
            dto.reason ?? 'Manual transaction matched with SMS transaction',
          status: ReconciliationStatus.MATCHED,
          transactionId: manualTransaction.id,
          userId: user.userId,
          details: {
            create: [
              {
                key: 'matchedTransactionId',
                value: smsTransaction.id,
              },
            ],
          },
        },
      });
      await tx.reconciliationEvent.create({
        data: {
          reason:
            dto.reason ?? 'SMS transaction matched with manual transaction',
          status: ReconciliationStatus.MATCHED,
          transactionId: smsTransaction.id,
          userId: user.userId,
          details: {
            create: [
              {
                key: 'matchedTransactionId',
                value: manualTransaction.id,
              },
            ],
          },
        },
      });
    });

    return { updated: true };
  }

  async updateTransactionStatus(
    user: AuthenticatedUser,
    transactionId: string,
    dto: UpdateReconciliationStatusDto,
  ): Promise<ReconciliationActionResponseDto> {
    const transaction = await this.findOwnedTransaction(
      user.userId,
      transactionId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        data: { reconciliationStatus: dto.status },
        where: { id: transaction.id },
      });
      await tx.reconciliationEvent.create({
        data: {
          reason: dto.reason,
          status: dto.status,
          transactionId: transaction.id,
          userId: user.userId,
        },
      });
    });

    return { updated: true };
  }

  private async findUnreconciled(
    userId: string,
    source: TransactionSource,
  ): Promise<TransactionWithCounterparty[]> {
    return this.prisma.transaction.findMany({
      include: { counterparty: true },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      where: {
        deletedAt: null,
        reconciliationStatus: ReconciliationStatus.UNRECONCILED,
        source,
        userId,
      },
    });
  }

  private async findOwnedTransaction(
    userId: string,
    transactionId: string,
  ): Promise<TransactionWithCounterparty> {
    const transaction = await this.prisma.transaction.findFirst({
      include: { counterparty: true },
      where: {
        deletedAt: null,
        id: transactionId,
        userId,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction not found: ${transactionId}`);
    }

    return transaction;
  }

  private scorePair(
    manualTransaction: TransactionWithCounterparty,
    smsTransaction: TransactionWithCounterparty,
  ): ReconciliationSuggestionDto {
    let score = 0;
    const reasons: string[] = [];

    if (manualTransaction.amount.equals(smsTransaction.amount)) {
      score += 40;
      reasons.push('amount');
    }

    if (manualTransaction.type === smsTransaction.type) {
      score += 20;
      reasons.push('type');
    }

    if (manualTransaction.direction === smsTransaction.direction) {
      score += 15;
      reasons.push('direction');
    }

    if (
      this.isNearDate(manualTransaction.occurredAt, smsTransaction.occurredAt)
    ) {
      score += 15;
      reasons.push('dateProximity');
    }

    if (this.sameCounterparty(manualTransaction, smsTransaction)) {
      score += 10;
      reasons.push('counterparty');
    }

    return {
      manualTransaction: this.toSummary(manualTransaction),
      reasons,
      score,
      smsTransaction: this.toSummary(smsTransaction),
    };
  }

  private isNearDate(left: Date | null, right: Date | null): boolean {
    if (!left || !right) {
      return false;
    }

    return Math.abs(left.getTime() - right.getTime()) <= 72 * 60 * 60_000;
  }

  private sameCounterparty(
    left: TransactionWithCounterparty,
    right: TransactionWithCounterparty,
  ): boolean {
    const leftName = left.counterparty?.displayName?.toLowerCase();
    const rightName = right.counterparty?.displayName?.toLowerCase();

    if (!leftName || !rightName) {
      return false;
    }

    return leftName === rightName;
  }

  private toSummary(
    transaction: TransactionWithCounterparty,
  ): ReconciliationTransactionSummaryDto {
    return {
      amount: transaction.amount.toFixed(2),
      counterpartyName: transaction.counterparty?.displayName ?? null,
      direction: transaction.direction,
      id: transaction.id,
      occurredAt: transaction.occurredAt?.toISOString() ?? null,
      source: transaction.source,
      type: transaction.type,
    };
  }
}
