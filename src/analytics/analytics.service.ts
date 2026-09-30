import { Injectable } from '@nestjs/common';
import { Prisma, TransactionDirection } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import {
  AnalyticsBreakdownItemDto,
  AnalyticsBreakdownResponseDto,
  AnalyticsCashflowResponseDto,
  AnalyticsSummaryResponseDto,
  CashflowPointDto,
} from './dto/analytics-response.dto';

type AnalyticsTransaction = Prisma.TransactionGetPayload<{
  include: {
    category: true;
    provider: true;
  };
}>;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    user: AuthenticatedUser,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsSummaryResponseDto> {
    const range = this.resolveRange(query);
    const transactions = await this.findTransactions(user.userId, range);
    const totals = this.sum(transactions);

    return {
      from: range.from.toISOString(),
      netCashflow: this.format(totals.inflow - totals.outflow),
      to: range.to.toISOString(),
      totalInflow: this.format(totals.inflow),
      totalOutflow: this.format(totals.outflow),
      transactionCount: transactions.length,
    };
  }

  async getCashflow(
    user: AuthenticatedUser,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsCashflowResponseDto> {
    const range = this.resolveRange(query);
    const transactions = await this.findTransactions(user.userId, range);
    const byDate = new Map<string, { inflow: number; outflow: number }>();

    for (const transaction of transactions) {
      const date = (transaction.occurredAt ?? transaction.createdAt)
        .toISOString()
        .slice(0, 10);
      const bucket = byDate.get(date) ?? { inflow: 0, outflow: 0 };
      const amount = Number(transaction.amount);

      if (transaction.direction === TransactionDirection.INFLOW) {
        bucket.inflow += amount;
      } else {
        bucket.outflow += amount;
      }

      byDate.set(date, bucket);
    }

    const points: CashflowPointDto[] = [...byDate.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, bucket]) => ({
        date,
        inflow: this.format(bucket.inflow),
        net: this.format(bucket.inflow - bucket.outflow),
        outflow: this.format(bucket.outflow),
      }));

    return { points };
  }

  async getCategoryBreakdown(
    user: AuthenticatedUser,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsBreakdownResponseDto> {
    const range = this.resolveRange(query);
    const transactions = await this.findTransactions(user.userId, range);
    return { items: this.groupBy(transactions, 'category') };
  }

  async getProviderBreakdown(
    user: AuthenticatedUser,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsBreakdownResponseDto> {
    const range = this.resolveRange(query);
    const transactions = await this.findTransactions(user.userId, range);
    return { items: this.groupBy(transactions, 'provider') };
  }

  private async findTransactions(
    userId: string,
    range: { from: Date; to: Date },
  ): Promise<AnalyticsTransaction[]> {
    return this.prisma.transaction.findMany({
      include: {
        category: true,
        provider: true,
      },
      where: {
        deletedAt: null,
        occurredAt: {
          gte: range.from,
          lte: range.to,
        },
        userId,
      },
    });
  }

  private groupBy(
    transactions: AnalyticsTransaction[],
    dimension: 'category' | 'provider',
  ): AnalyticsBreakdownItemDto[] {
    const buckets = new Map<
      string,
      {
        key: string | null;
        label: string;
        inflow: number;
        outflow: number;
        count: number;
      }
    >();

    for (const transaction of transactions) {
      const key =
        dimension === 'category'
          ? (transaction.category?.id ?? 'uncategorized')
          : (transaction.provider?.id ?? 'unknown-provider');
      const label =
        dimension === 'category'
          ? (transaction.category?.name ?? 'Uncategorized')
          : (transaction.provider?.displayName ?? 'Unknown Provider');
      const bucket = buckets.get(key) ?? {
        count: 0,
        inflow: 0,
        key: key.startsWith('unknown') || key === 'uncategorized' ? null : key,
        label,
        outflow: 0,
      };
      const amount = Number(transaction.amount);

      if (transaction.direction === TransactionDirection.INFLOW) {
        bucket.inflow += amount;
      } else {
        bucket.outflow += amount;
      }

      bucket.count += 1;
      buckets.set(key, bucket);
    }

    return [...buckets.values()]
      .sort(
        (left, right) =>
          right.inflow + right.outflow - (left.inflow + left.outflow),
      )
      .map((bucket) => ({
        inflow: this.format(bucket.inflow),
        key: bucket.key,
        label: bucket.label,
        net: this.format(bucket.inflow - bucket.outflow),
        outflow: this.format(bucket.outflow),
        transactionCount: bucket.count,
      }));
  }

  private sum(transactions: AnalyticsTransaction[]): {
    inflow: number;
    outflow: number;
  } {
    return transactions.reduce(
      (totals, transaction) => {
        const amount = Number(transaction.amount);

        if (transaction.direction === TransactionDirection.INFLOW) {
          totals.inflow += amount;
        } else {
          totals.outflow += amount;
        }

        return totals;
      },
      { inflow: 0, outflow: 0 },
    );
  }

  private resolveRange(query: AnalyticsQueryDto): { from: Date; to: Date } {
    const now = new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = query.to ? new Date(query.to) : now;

    return { from, to };
  }

  private format(value: number): string {
    return value.toFixed(2);
  }
}
