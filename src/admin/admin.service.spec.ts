import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Prisma } from '@prisma/client';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { BusinessOpsGuard } from '../auth/business-ops.guard';
import type { AuthenticatedUser } from '../auth/auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { MerchantsService } from '../merchants/merchants.service';
import type { DeleteAdminRecordDto } from './dto/admin-config.dto';

jest.mock('../auth/auth.service', () => ({ AuthService: class AuthService {} }));

const actor: AuthenticatedUser = { role: 'ADMIN', userId: 'actor', phoneNumber: '+251900000000', sessionId: 'session', deviceId: null };
const recordId = '8c77d932-3ef8-4a3e-96a3-5a56cf7e3c68';

function delegate() {
  return { findUnique: jest.fn(), findFirst: jest.fn(), delete: jest.fn(), update: jest.fn(), create: jest.fn(), updateMany: jest.fn() };
}

function setup() {
  const tx = {
    provider: delegate(), merchant: delegate(), category: delegate(), providerSenderAlias: delegate(),
    providerParserRule: delegate(), providerPaymentTemplate: delegate(), auditLog: delegate(), user: delegate(), authSession: delegate(),
  };
  const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
  const service = new AdminService({} as MerchantsService, prisma as unknown as PrismaService);
  return { service, tx, prisma };
}

describe('Admin CRUD permissions and safeguards', () => {
  it('guards the delete route with administrator authorization', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController.prototype.deleteRecord)).toContain(AdminRoleGuard);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toContain(BusinessOpsGuard);
  });

  it.each(['USER', 'BUSINESS_OPS'])('denies deletion to %s at service and guard boundaries', async (role) => {
    const { service, prisma } = setup();
    await expect(service.deleteRecord({ ...actor, role }, 'categories', recordId)).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    const context = { switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) } as unknown as ExecutionContext;
    expect(() => new AdminRoleGuard().canActivate(context)).toThrow(ForbiddenException);
  });

  it.each(['providers', 'merchants', 'categories', 'aliases', 'parser-rules', 'payment-templates'] as const)('rejects a missing %s record', async (resource) => {
    const { service } = setup();
    await expect(service.deleteRecord(actor, resource, recordId)).rejects.toThrow(NotFoundException);
  });

  it('deletes an inactive unreferenced provider and audits in a serializable transaction', async () => {
    const { service, tx, prisma } = setup();
    tx.provider.findUnique.mockResolvedValue({ id: recordId, code: 'test', isActive: false, _count: { accounts: 0 } });
    await expect(service.deleteRecord(actor, 'providers', recordId)).resolves.toEqual({ id: recordId });
    expect(tx.provider.delete).toHaveBeenCalledWith({ where: { id: recordId } });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: actor.userId, action: 'RECORD_DELETED', targetId: recordId }) }));
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });

  it.each([
    { isActive: true, _count: {} },
    { isActive: false, _count: { transactions: 1 } },
    { isActive: false, _count: { configVersions: 1 } },
  ])('protects active and referenced providers: %j', async (record) => {
    const { service, tx } = setup();
    tx.provider.findUnique.mockResolvedValue({ id: recordId, code: 'test', ...record });
    await expect(service.deleteRecord(actor, 'providers', recordId)).rejects.toThrow(ConflictException);
    expect(tx.provider.delete).not.toHaveBeenCalled();
  });

  it('protects providers referenced by merchant code', async () => {
    const { service, tx } = setup();
    tx.provider.findUnique.mockResolvedValue({ code: 'test', isActive: false, _count: {} });
    tx.merchant.findFirst.mockResolvedValue({ id: 'merchant' });
    await expect(service.deleteRecord(actor, 'providers', recordId)).rejects.toThrow(ConflictException);
  });

  it('protects categories with transactions or children', async () => {
    const { service, tx } = setup();
    tx.category.findFirst.mockResolvedValue({ _count: { children: 1, transactions: 0 } });
    await expect(service.deleteRecord(actor, 'categories', recordId)).rejects.toThrow(ConflictException);
    tx.category.findFirst.mockResolvedValue({ _count: { children: 0, transactions: 1 } });
    await expect(service.deleteRecord(actor, 'categories', recordId)).rejects.toThrow(ConflictException);
    expect(tx.category.delete).not.toHaveBeenCalled();
  });

  it('protects merchants with subscriptions and active aliases', async () => {
    const { service, tx } = setup();
    tx.merchant.findUnique.mockResolvedValue({ isActive: false, _count: { subscriptions: 1 } });
    tx.providerSenderAlias.findUnique.mockResolvedValue({ isActive: true });
    await expect(service.deleteRecord(actor, 'merchants', recordId)).rejects.toThrow(ConflictException);
    await expect(service.deleteRecord(actor, 'aliases', recordId)).rejects.toThrow(ConflictException);
  });

  it('only deletes never-published payment-templates drafts', async () => {
    const { service, tx } = setup();
    const model = tx.providerPaymentTemplate;
    const resource = 'payment-templates';
    model.findUnique.mockResolvedValue({ status: 'ACTIVE', configVersionId: 'version' });
    await expect(service.deleteRecord(actor, resource, recordId)).rejects.toThrow(ConflictException);
    model.findUnique.mockResolvedValue({ status: 'DRAFT', configVersionId: null });
    tx.auditLog.findFirst.mockResolvedValue({ id: 'publication' });
    await expect(service.deleteRecord(actor, resource, recordId)).rejects.toThrow(ConflictException);
    expect(model.delete).not.toHaveBeenCalled();
    tx.auditLog.findFirst.mockResolvedValue(null);
    await expect(service.deleteRecord(actor, resource, recordId)).resolves.toEqual({ id: recordId });
    expect(model.delete).toHaveBeenCalled();
  });

  it('lets admins delete any message template that devices are not using', async () => {
    const { service, tx } = setup();
    tx.providerParserRule.findUnique.mockResolvedValue({ status: 'ACTIVE', configVersionId: 'version' });
    await expect(service.deleteRecord(actor, 'parser-rules', recordId)).rejects.toThrow(ConflictException);
    expect(tx.providerParserRule.delete).not.toHaveBeenCalled();
    for (const status of ['DISABLED', 'DEPRECATED', 'DRAFT']) {
      tx.providerParserRule.findUnique.mockResolvedValue({ status, configVersionId: 'version' });
      await expect(service.deleteRecord(actor, 'parser-rules', recordId)).resolves.toEqual({ id: recordId });
    }
    expect(tx.providerParserRule.delete).toHaveBeenCalledTimes(3);
  });

  it('refuses to publish a rule that fails its own examples', async () => {
    const { service, tx } = setup();
    Object.assign(tx, { providerConfigVersion: { findFirst: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'v', version: 2 }) } });
    const rule = {
      id: recordId, providerId: 'p', transactionType: 'P2P_IN', provider: { code: 'enat_bank' },
      pattern: String.raw`credited with\s+(?<amount>[\d,.]+)\s*ETB`,
      fieldMappings: [{ captureGroup: 'amount', targetField: 'amount', valueType: 'NUMBER', transform: null, isRequired: true }],
      examples: [{ messageBody: 'Your account has been credited with 47,000.00 ETB.', expectedType: 'P2P_IN', expectedAmount: new Prisma.Decimal(47000), expectedBalance: null, expectedRef: null, expectedCounterpartyName: null, expectedCounterpartyPhone: null }],
    };
    tx.providerParserRule.findUnique.mockResolvedValue({ ...rule, examples: [{ ...rule.examples[0], expectedAmount: new Prisma.Decimal(1) }] });
    await expect(service.publishParserRule(actor, recordId)).rejects.toThrow(BadRequestException);
    tx.providerParserRule.findUnique.mockResolvedValue(rule);
    tx.providerParserRule.update.mockResolvedValue({ id: recordId, status: 'ACTIVE' });
    await expect(service.publishParserRule(actor, recordId)).resolves.toEqual({ id: recordId, status: 'ACTIVE', configVersion: 2 });
  });

  it('rejects unsupported resource types', async () => {
    const { service } = setup();
    await expect(service.deleteRecord(actor, 'audit-logs' as DeleteAdminRecordDto['resource'], recordId)).rejects.toThrow(BadRequestException);
  });

  it('validates template placeholders and rejects payment secrets', async () => {
    const { service } = setup();
    await expect(service.updatePaymentTemplate(actor, recordId, { paymentType: 'SEND', template: '*{amount}#', fields: [] })).rejects.toThrow(BadRequestException);
    await expect(service.updatePaymentTemplate(actor, recordId, { paymentType: 'SEND', template: '*{pin}#', fields: [{ key: 'pin', label: 'PIN' }] })).rejects.toThrow(BadRequestException);
  });

  it('preserves validation patterns when business ops edit a draft', async () => {
    const { service, tx } = setup();
    tx.providerPaymentTemplate.findUnique.mockResolvedValue({ status: 'DRAFT', fields: [{ key: 'phone', validationPattern: '^09' }] });
    await service.updatePaymentTemplate({ ...actor, role: 'BUSINESS_OPS' }, recordId, { paymentType: 'SEND', template: '*{phone}#', fields: [{ key: 'phone', label: 'Phone' }] });
    expect(tx.providerPaymentTemplate.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fields: { deleteMany: {}, create: [{ key: 'phone', label: 'Phone', validationPattern: '^09' }] } }) }));
  });

  it('rejects published template editing and regular user access', async () => {
    const { service, tx } = setup();
    const input = { paymentType: 'SEND', template: '*123#', fields: [] };
    tx.providerPaymentTemplate.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    await expect(service.updatePaymentTemplate(actor, recordId, input)).rejects.toThrow(ConflictException);
    await expect(service.updatePaymentTemplate({ ...actor, role: 'USER' }, recordId, input)).rejects.toThrow(ForbiddenException);
  });

  it('prevents self-deletion and revokes sessions for deleted accounts', async () => {
    const { service, tx } = setup();
    await expect(service.updateUserAccess(actor, actor.userId, { status: 'DELETED' })).rejects.toThrow(ForbiddenException);
    tx.user.findUnique.mockResolvedValue({ role: 'USER', status: 'ACTIVE' });
    tx.user.update.mockResolvedValue({ role: 'USER', status: 'DELETED' });
    await service.updateUserAccess(actor, recordId, { status: 'DELETED' });
    expect(tx.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'ACTIVE', userId: recordId } }));
  });

  it('restricts per-user subscriptions to admins and audits every view', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController.prototype.listUserSubscriptions)).toContain(AdminRoleGuard);
    const { service, tx } = setup();
    const subscription = { ...delegate(), findMany: jest.fn().mockResolvedValue([]) };
    Object.assign(tx, { subscription });
    tx.user.findUnique.mockResolvedValue(null);
    await expect(service.listUserSubscriptions(actor, recordId)).rejects.toThrow(NotFoundException);
    tx.user.findUnique.mockResolvedValue({ id: recordId, phoneNumber: '+251911111111', status: 'ACTIVE' });
    await expect(service.listUserSubscriptions(actor, recordId)).resolves.toEqual(expect.objectContaining({ subscriptions: [] }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'USER_SUBSCRIPTIONS_VIEWED', targetId: recordId }) }));
  });

  it('aggregates subscription stats with monthly-equivalent amounts', async () => {
    const prisma = {
      subscription: {
        groupBy: jest.fn().mockResolvedValue([
          { category: 'INTERNET', frequency: 'MONTHLY', status: 'ACTIVE', _count: { _all: 2 }, _sum: { amount: new Prisma.Decimal(1000) } },
          { category: 'INTERNET', frequency: 'YEARLY', status: 'ACTIVE', _count: { _all: 1 }, _sum: { amount: new Prisma.Decimal(1200) } },
          { category: 'RENT', frequency: 'MONTHLY', status: 'CANCELLED', _count: { _all: 1 }, _sum: { amount: new Prisma.Decimal(5000) } },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      user: { count: jest.fn().mockResolvedValue(2) },
    };
    const service = new AdminService({} as MerchantsService, prisma as unknown as PrismaService);
    const stats = await service.getSubscriptionStats();
    expect(stats.totals).toEqual({ total: 4, active: 3, paused: 0, cancelled: 1, subscribers: 2, activeMonthlyAmount: 1100, dueNext7Days: 1 });
    expect(stats.byCategory.find((row) => row.category === 'INTERNET')).toEqual({ category: 'INTERNET', total: 3, active: 3, activeMonthlyAmount: 1100 });
    expect(stats.byCategory.find((row) => row.category === 'RENT')).toEqual({ category: 'RENT', total: 1, active: 0, activeMonthlyAmount: 0 });
  });

  describe('subscription CRUD', () => {
    const owner = { id: recordId, status: 'ACTIVE' };
    const record = {
      id: recordId, userId: recordId, name: 'Internet', category: 'INTERNET', frequency: 'MONTHLY', status: 'ACTIVE',
      amount: new Prisma.Decimal(499), currency: 'ETB', nextDueAt: null, merchantId: null, merchant: null,
      user: { phoneNumber: '+251911111111' }, createdAt: new Date(0), updatedAt: new Date(0),
    };

    function withSubscriptions() {
      const context = setup();
      Object.assign(context.tx, { subscription: { ...delegate(), findMany: jest.fn().mockResolvedValue([record]) } });
      return context as typeof context & { tx: typeof context.tx & { subscription: ReturnType<typeof delegate> & { findMany: jest.Mock } } };
    }

    it('guards every admin subscription route with the admin role', () => {
      for (const method of ['listAllSubscriptions', 'createSubscription', 'updateSubscription'] as const) {
        expect(Reflect.getMetadata(GUARDS_METADATA, AdminController.prototype[method])).toContain(AdminRoleGuard);
      }
    });

    it.each(['USER', 'BUSINESS_OPS'])('denies %s at the service boundary', async (role) => {
      const { service, prisma } = withSubscriptions();
      const nonAdmin = { ...actor, role };
      await expect(service.listAllSubscriptions(nonAdmin, {})).rejects.toThrow(ForbiddenException);
      await expect(service.createSubscriptionForUser(nonAdmin, { name: 'x', phoneNumber: '+251911111111' })).rejects.toThrow(ForbiddenException);
      await expect(service.updateSubscriptionAsAdmin(nonAdmin, recordId, { name: 'x' })).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates for the account behind the phone number and audits it', async () => {
      const { service, tx } = withSubscriptions();
      tx.user.findUnique.mockResolvedValue(owner);
      tx.subscription.create.mockResolvedValue(record);
      const result = await service.createSubscriptionForUser(actor, { name: 'Internet', phoneNumber: '+251911111111', frequency: 'YEARLY' });
      expect(result).toEqual(expect.objectContaining({ id: recordId, phoneNumber: '+251911111111', amount: '499.00' }));
      expect(tx.subscription.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: recordId, recurrenceRule: 'FREQ=YEARLY' }) }));
      expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'SUBSCRIPTION_CREATED' }) }));
    });

    it('rejects unknown or deleted owners and unknown merchants', async () => {
      const { service, tx } = withSubscriptions();
      tx.user.findUnique.mockResolvedValue(null);
      await expect(service.createSubscriptionForUser(actor, { name: 'x', phoneNumber: '+251911111111' })).rejects.toThrow(NotFoundException);
      tx.user.findUnique.mockResolvedValue({ ...owner, status: 'DELETED' });
      await expect(service.createSubscriptionForUser(actor, { name: 'x', phoneNumber: '+251911111111' })).rejects.toThrow(ConflictException);
      tx.user.findUnique.mockResolvedValue(owner);
      tx.merchant.findUnique.mockResolvedValue(null);
      await expect(service.createSubscriptionForUser(actor, { name: 'x', phoneNumber: '+251911111111', merchantId: recordId })).rejects.toThrow(BadRequestException);
    });

    it('updates status and audits before/after', async () => {
      const { service, tx } = withSubscriptions();
      tx.subscription.findUnique.mockResolvedValue(record);
      tx.subscription.update.mockResolvedValue({ ...record, status: 'CANCELLED' });
      await service.updateSubscriptionAsAdmin(actor, recordId, { status: 'CANCELLED' });
      expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'SUBSCRIPTION_UPDATED' }) }));
      tx.subscription.findUnique.mockResolvedValue(null);
      await expect(service.updateSubscriptionAsAdmin(actor, recordId, { status: 'ACTIVE' })).rejects.toThrow(NotFoundException);
    });

    it('deletes through the audited admin delete route', async () => {
      const { service, tx } = withSubscriptions();
      tx.subscription.findUnique.mockResolvedValue({ id: recordId });
      await expect(service.deleteRecord(actor, 'subscriptions', recordId)).resolves.toEqual({ id: recordId });
      expect(tx.subscription.delete).toHaveBeenCalledWith({ where: { id: recordId } });
      expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'RECORD_DELETED', targetType: 'Subscription' }) }));
    });
  });
});