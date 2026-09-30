import { NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ReconciliationStatus,
  SyncStatus,
  TransactionDirection,
  TransactionSource,
  TransactionType,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service';
import type { BalancesService } from '../balances/balances.service';
import type { ParserService } from '../parser/parser.service';
import type { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

const user: AuthenticatedUser = {
  deviceId: null,
  phoneNumber: '+251911111111',
  role: 'USER',
  sessionId: 'session',
  userId: 'user-1',
};

function setup() {
  const prisma = {
    transaction: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    category: { findFirst: jest.fn() },
  };
  const service = new TransactionsService(
    {} as BalancesService,
    {} as ParserService,
    prisma as unknown as PrismaService,
  );
  return { prisma, service };
}

function transaction(categoryId: string | null) {
  const date = new Date('2026-09-30T09:00:00.000Z');
  return {
    id: 'tx-1',
    userId: user.userId,
    accountId: null,
    categoryId,
    counterpartyId: null,
    providerId: null,
    rawSmsLogId: null,
    localId: 'local-1',
    amount: new Prisma.Decimal(100),
    currency: 'ETB',
    type: TransactionType.UTILITY,
    direction: TransactionDirection.OUTFLOW,
    source: TransactionSource.SMS,
    reconciliationStatus: ReconciliationStatus.UNRECONCILED,
    syncStatus: SyncStatus.SYNCED,
    reference: null,
    note: null,
    occurredAt: date,
    deletedAt: null,
    createdAt: date,
    updatedAt: date,
    counterparty: null,
    provider: null,
  };
}

describe('TransactionsService category updates', () => {
  it('filters and sorts the transaction list by occurrence date', async () => {
    const { prisma, service } = setup();
    prisma.transaction.findMany.mockResolvedValue([]);

    await service.listTransactions(user, {
      categoryId: '408f9641-6052-4f9f-8226-3cb950678cab',
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
      providerCode: 'enat_bank',
    });

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      where: expect.objectContaining({
        categoryId: '408f9641-6052-4f9f-8226-3cb950678cab',
        occurredAt: {
          gte: new Date('2026-09-01T00:00:00.000Z'),
          lt: new Date('2026-10-01T00:00:00.000Z'),
        },
        provider: { code: 'enat_bank' },
        userId: user.userId,
      }),
    }));
  });

  it('updates the category of the signed-in user transaction', async () => {
    const { prisma, service } = setup();
    prisma.transaction.findFirst.mockResolvedValue({ id: 'tx-1' });
    prisma.category.findFirst.mockResolvedValue({ id: 'category-1' });
    prisma.transaction.update.mockResolvedValue(transaction('category-1'));

    await expect(service.updateTransactionCategory(user, 'tx-1', 'category-1')).resolves.toEqual(
      expect.objectContaining({ id: 'tx-1', categoryId: 'category-1' }),
    );
    expect(prisma.transaction.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'tx-1', userId: user.userId }),
    }));
    expect(prisma.category.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'category-1' }),
    }));
  });

  it('allows clearing a category without looking one up', async () => {
    const { prisma, service } = setup();
    prisma.transaction.findFirst.mockResolvedValue({ id: 'tx-1' });
    prisma.transaction.update.mockResolvedValue(transaction(null));

    await expect(service.updateTransactionCategory(user, 'tx-1', null)).resolves.toEqual(
      expect.objectContaining({ categoryId: null }),
    );
    expect(prisma.category.findFirst).not.toHaveBeenCalled();
  });

  it('does not expose another user transaction or category', async () => {
    const { prisma, service } = setup();
    prisma.transaction.findFirst.mockResolvedValue(null);
    await expect(service.updateTransactionCategory(user, 'foreign-tx', 'category-1')).rejects.toThrow(NotFoundException);

    prisma.transaction.findFirst.mockResolvedValue({ id: 'tx-1' });
    prisma.category.findFirst.mockResolvedValue(null);
    await expect(service.updateTransactionCategory(user, 'tx-1', 'foreign-category')).rejects.toThrow(NotFoundException);
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });
});
