import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionDirection } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BalanceDiscrepancyResponseDto,
  BalanceSnapshotResponseDto,
} from './dto/balance-response.dto';
import { UpdateDiscrepancyDto } from './dto/update-discrepancy.dto';

type BalanceSnapshotRecord = Prisma.BalanceSnapshotGetPayload<{
  include: { account: true; provider: true };
}>;

type BalanceDiscrepancyRecord = Prisma.BalanceDiscrepancyGetPayload<{
  include: { provider: true };
}>;

const discrepancyTolerance = 1;

@Injectable()
export class BalancesService {
  constructor(private readonly prisma: PrismaService) {}

  async listLatestBalances(
    user: AuthenticatedUser,
  ): Promise<BalanceSnapshotResponseDto[]> {
    const snapshots = await this.prisma.balanceSnapshot.findMany({
      distinct: ['accountId', 'providerId'],
      include: { account: true, provider: true },
      orderBy: { recordedAt: 'desc' },
      where: {
        userId: user.userId,
      },
    });

    return snapshots.map((snapshot) => this.toSnapshotResponse(snapshot));
  }

  async listDiscrepancies(
    user: AuthenticatedUser,
  ): Promise<BalanceDiscrepancyResponseDto[]> {
    const discrepancies = await this.prisma.balanceDiscrepancy.findMany({
      include: { provider: true },
      orderBy: { createdAt: 'desc' },
      where: { userId: user.userId },
    });

    return discrepancies.map((discrepancy) =>
      this.toDiscrepancyResponse(discrepancy),
    );
  }

  async updateDiscrepancy(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateDiscrepancyDto,
  ): Promise<BalanceDiscrepancyResponseDto> {
    const existing = await this.prisma.balanceDiscrepancy.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) {
      throw new NotFoundException(`Balance discrepancy not found: ${id}`);
    }

    const discrepancy = await this.prisma.balanceDiscrepancy.update({
      data: {
        reason: dto.reason,
        status: dto.status,
      },
      include: { provider: true },
      where: { id },
    });

    return this.toDiscrepancyResponse(discrepancy);
  }

  async createSnapshotAndCheckDiscrepancy(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      accountId?: string | null;
      providerId?: string | null;
      transactionId: string;
      amount: string;
      direction: TransactionDirection;
      reportedBalance: string;
      recordedAt: Date;
    },
  ): Promise<void> {
    const previousSnapshot = await tx.balanceSnapshot.findFirst({
      orderBy: { recordedAt: 'desc' },
      where: {
        userId: input.userId,
        accountId: input.accountId ?? undefined,
        providerId: input.accountId
          ? undefined
          : (input.providerId ?? undefined),
      },
    });

    await tx.balanceSnapshot.create({
      data: {
        accountId: input.accountId ?? undefined,
        balance: input.reportedBalance,
        providerId: input.providerId ?? undefined,
        recordedAt: input.recordedAt,
        transactionId: input.transactionId,
        userId: input.userId,
      },
    });

    if (!previousSnapshot) {
      return;
    }

    const previous = Number(previousSnapshot.balance);
    const amount = Number(input.amount);
    const reported = Number(input.reportedBalance);
    const expected =
      input.direction === TransactionDirection.INFLOW
        ? previous + amount
        : previous - amount;
    const difference = reported - expected;

    if (Math.abs(difference) <= discrepancyTolerance) {
      return;
    }

    await tx.balanceDiscrepancy.create({
      data: {
        accountId: input.accountId ?? undefined,
        difference: difference.toFixed(2),
        expectedBalance: expected.toFixed(2),
        providerId: input.providerId ?? undefined,
        reason: 'Reported balance differs from expected balance',
        reportedBalance: input.reportedBalance,
        transactionId: input.transactionId,
        userId: input.userId,
      },
    });
  }

  private toSnapshotResponse(
    snapshot: BalanceSnapshotRecord,
  ): BalanceSnapshotResponseDto {
    return {
      accountId: snapshot.accountId,
      balance: snapshot.balance.toFixed(2),
      id: snapshot.id,
      providerCode: snapshot.provider?.code ?? null,
      providerName: snapshot.provider?.displayName ?? null,
      recordedAt: snapshot.recordedAt.toISOString(),
    };
  }

  private toDiscrepancyResponse(
    discrepancy: BalanceDiscrepancyRecord,
  ): BalanceDiscrepancyResponseDto {
    return {
      createdAt: discrepancy.createdAt.toISOString(),
      difference: discrepancy.difference.toFixed(2),
      expectedBalance: discrepancy.expectedBalance.toFixed(2),
      id: discrepancy.id,
      providerCode: discrepancy.provider?.code ?? null,
      providerName: discrepancy.provider?.displayName ?? null,
      reason: discrepancy.reason,
      reportedBalance: discrepancy.reportedBalance.toFixed(2),
      status: discrepancy.status,
      transactionId: discrepancy.transactionId,
    };
  }
}
