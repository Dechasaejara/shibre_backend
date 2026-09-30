import {
  AuthSessionStatus,
  BalanceDiscrepancyStatus,
  CategoryKind,
  DeviceStatus,
  Merchant,
  PaymentTemplateStatus,
  Prisma,
  PrismaClient,
  ProviderRuleStatus,
  RawSmsParseStatus,
  ReconciliationStatus,
  SubscriptionCategory,
  SubscriptionFrequency,
  SubscriptionStatus,
  SyncStatus,
  TransactionDirection,
  TransactionSource,
  TransactionType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';

// Mirrors AuthService.hashPassword so seeded accounts can log in.
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, p: 1, r: 8 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}

// Deterministic PRNG so every seed run produces the same shape of data.
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20260926);
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
const between = (min: number, max: number): number => min + random() * (max - min);
const roundTo = (value: number, step: number): number => Math.max(step, Math.round(value / step) * step);

const DAY = 24 * 60 * 60_000;
const now = Date.now();

const money = (value: number): string =>
  value.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const pad = (value: number): string => String(value).padStart(2, '0');
const ddmmyyyy = (date: Date): string =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
const reference = (prefix: string, length = 8): string =>
  prefix +
  Array.from({ length }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'[Math.floor(random() * 34)]).join('');
const maskPhone = (phone: string): string => `2519****${phone.slice(-4)}`;
const maskAccount = (account: string): string => `1********${account.slice(-4)}`;

interface DemoUserSeed {
  phoneNumber: string;
  firstName: string;
  role: UserRole;
  status?: UserStatus;
  locked?: boolean;
  transactionCount: number;
}

const demoUsers: DemoUserSeed[] = [
  { phoneNumber: '+251911000001', firstName: 'Selamawit', role: UserRole.ADMIN, transactionCount: 24 },
  { phoneNumber: '+251911000002', firstName: 'Yonas', role: UserRole.BUSINESS_OPS, transactionCount: 18 },
  { phoneNumber: '+251911000003', firstName: 'Dechasa', role: UserRole.USER, transactionCount: 60 },
  { phoneNumber: '+251911000004', firstName: 'Hanna', role: UserRole.USER, transactionCount: 48 },
  { phoneNumber: '+251911000005', firstName: 'Abebe', role: UserRole.USER, transactionCount: 36 },
  { phoneNumber: '+251911000006', firstName: 'Meron', role: UserRole.USER, transactionCount: 42 },
  { phoneNumber: '+251911000007', firstName: 'Kidus', role: UserRole.USER, transactionCount: 30, locked: true },
  { phoneNumber: '+251911000008', firstName: 'Liya', role: UserRole.USER, transactionCount: 12, status: UserStatus.SUSPENDED },
  { phoneNumber: '+251911000009', firstName: 'Tewodros', role: UserRole.USER, transactionCount: 26 },
  { phoneNumber: '+251911000010', firstName: 'Bethlehem', role: UserRole.USER, transactionCount: 8 },
];

const counterpartyPool = [
  { name: 'Negaye Fikadu', phone: '251912348679' },
  { name: 'SAREM TEDELE', phone: '251911235946' },
  { name: 'Selam Nekir Moshe', phone: '251913449597' },
  { name: 'Hezkias Mesfin Semie', phone: '251914551592' },
  { name: 'Mulugeta Alemu', phone: '251915660021' },
  { name: 'Tigist Bekele', phone: '251916774410' },
  { name: 'Dawit Girma', phone: '251917889312' },
  { name: 'Almaz Tadesse', phone: '251918992205' },
] as const;

const merchantSeeds = [
  { displayName: 'Ethio Telecom', providerCode: 'telebirr', merchantRef: '100001', isActive: true },
  { displayName: 'Ethiopian Electric Utility', providerCode: 'telebirr', merchantRef: '200145', isActive: true },
  { displayName: 'Addis Ababa Water & Sewerage', providerCode: 'telebirr', merchantRef: '200310', isActive: true },
  { displayName: 'DStv Ethiopia', providerCode: 'telebirr', merchantRef: '310022', isActive: true },
  { displayName: 'Safaricom Ethiopia', providerCode: 'cbe_birr', merchantRef: '410087', isActive: true },
  { displayName: 'Shoa Supermarket', providerCode: 'telebirr', merchantRef: '933913041', isActive: true },
  { displayName: "Kaldi's Coffee", providerCode: 'telebirr', merchantRef: '933455120', isActive: true },
  { displayName: 'Ride Ethiopia', providerCode: 'cbe_birr', merchantRef: '8294', isActive: true },
  { displayName: 'Zemen Gym', providerCode: null, merchantRef: null, isActive: false },
] as const;

const failedSmsBodies = [
  'Dear Customer, your telebirr loan (Endekise) of ETB 500.00 has been disbursed. Repayment due 25/10/2026.',
  'You have paid ETB 320.00 to Ethiopian Electric Utility for bill 200145-8823 on 12/09/2026 09:14:05. Transaction ID DIQ88AB12K.',
  'Your CBE Birr wallet has been topped up with ETB 1,500.00 via agent 30211. Balance ETB 4,120.40.',
  'Dear customer, ETB 2,000.00 has been withdrawn at ATM ADD-BOLE-012 on 18/09/2026. Avail. Bal ETB 9,880.10',
];

const ignoredSmsBodies = [
  'Your one-time code is 482913. Do not share this code with anyone.',
  'Get 5GB for only ETB 99! Dial *999# now. Ethio telecom',
  'Dear customer, telebirr will undergo scheduled maintenance tonight from 01:00 to 03:00.',
];

interface ProviderRef {
  id: string;
  code: string;
}

interface AccountRef {
  id: string;
  provider: ProviderRef;
  number: string;
  balance: number;
}

type Generated = {
  transaction: Prisma.TransactionCreateManyInput;
  sms?: Omit<Prisma.RawSmsLogCreateManyInput, 'userId'>;
};

function telebirrMessage(
  firstName: string,
  type: TransactionType,
  amount: number,
  balance: number,
  counterparty: (typeof counterpartyPool)[number],
  at: Date,
  ref: string,
): string {
  if (type === TransactionType.P2P_IN) {
    return `Dear ${firstName} You have received ETB ${money(amount)} from ${counterparty.name}(${maskPhone(counterparty.phone)}) on ${ddmmyyyy(at)}. Your transaction number is ${ref}. Your current E-Money Account balance is ETB ${money(balance)}. Thank you for using telebirr Ethio telecom`;
  }
  if (type === TransactionType.AIRTIME) {
    return `Dear ${firstName} You have paid ETB ${money(amount)} for package Voice Monthly for 150 Min +76 Min night package bonus purchase made for 9${counterparty.phone.slice(-8)} on ${ddmmyyyy(at)}. Your transaction number is ${ref}. Your current balance is ETB ${money(balance)}. Thank you for using telebirr Ethio telecom`;
  }
  const fee = Math.min(amount * 0.0035, 15);
  return `Dear ${firstName} You have transferred ETB ${money(amount)} to ${counterparty.name} (${maskPhone(counterparty.phone)}) on ${ddmmyyyy(at)}. Your transaction number is ${ref}. The service fee is ETB ${money(fee)} and 15% VAT on the service fee is ETB ${money(fee * 0.15)}. Your current E-Money Account balance is ETB ${money(balance)}. Thank you for using telebirr Ethio telecom`;
}

function cbeMessage(
  fullName: string,
  type: TransactionType,
  amount: number,
  balance: number,
  counterparty: (typeof counterpartyPool)[number],
  account: string,
): string {
  const other = maskAccount(counterparty.phone);
  if (type === TransactionType.P2P_IN) {
    return `Dear ${fullName} You have received ETB ${money(amount)} from account ${other} (${counterparty.name}) to your account ${maskAccount(account)}. Your current balance is ETB${money(balance)}. Thanks for Banking with CBE.`;
  }
  return `Dear ${fullName} You have successfully transferred ETB${money(amount)} from account ${maskAccount(account)} to account ${other} (${counterparty.name}). Service charge of ETB 1.00 and VAT(15%) of ETB0.15 and Disaster Recovery(5%) of 0.05 with total of ETB${money(amount + 1.2)}. Your current balance is ETB${money(balance)}. Thanks for Banking with CBE.`;
}

function generateTransactions(params: {
  seed: DemoUserSeed;
  userId: string;
  deviceId: string;
  accounts: AccountRef[];
  categories: Map<string, string>;
  counterparties: Map<string, string>;
  merchants: { id: string; displayName: string }[];
}): Generated[] {
  const { seed, userId, deviceId, accounts, categories, counterparties } = params;
  const results: Generated[] = [];
  const fullName = `${seed.firstName} Demo`;

  const offsets = Array.from({ length: seed.transactionCount }, () => between(0.05, 60) * DAY).sort((a, b) => b - a);

  offsets.forEach((offset, index) => {
    const at = new Date(now - offset);
    const account = pick(accounts);
    const roll = random();
    const counterparty = pick(counterpartyPool);
    const localId = `demo-${seed.phoneNumber.slice(-3)}-${index}`;
    const id = randomUUID();

    let type: TransactionType;
    let amount: number;
    if (roll < 0.28) {
      type = TransactionType.P2P_IN;
      amount = roundTo(between(150, 12000), 5);
    } else if (roll < 0.58) {
      type = TransactionType.P2P_OUT;
      amount = roundTo(between(50, 5000), 5);
    } else if (roll < 0.72 && account.provider.code === 'telebirr') {
      type = TransactionType.AIRTIME;
      amount = pick([25, 50, 99, 150, 250]);
    } else if (roll < 0.86) {
      type = TransactionType.MERCHANT_PAY;
      amount = roundTo(between(40, 2500), 0.5);
    } else if (roll < 0.94) {
      type = TransactionType.UTILITY;
      amount = roundTo(between(120, 1800), 0.5);
    } else {
      type = TransactionType.WITHDRAWAL;
      amount = roundTo(between(500, 6000), 100);
    }

    const direction = type === TransactionType.P2P_IN ? TransactionDirection.INFLOW : TransactionDirection.OUTFLOW;
    if (direction === TransactionDirection.OUTFLOW && account.balance < amount) {
      account.balance += roundTo(between(amount, amount * 3), 100);
    }
    account.balance += direction === TransactionDirection.INFLOW ? amount : -amount;
    account.balance = Math.round(account.balance * 100) / 100;

    const categoryName: Record<TransactionType, string> = {
      ADJUSTMENT: 'Other',
      AIRTIME: 'Airtime',
      MERCHANT_PAY: random() < 0.5 ? 'Food' : 'Merchant Payment',
      P2P_IN: 'Income',
      P2P_OUT: random() < 0.25 ? 'Transport' : 'Transfer',
      SUBSCRIPTION: 'Subscription',
      UTILITY: 'Utilities',
      WITHDRAWAL: 'Withdrawal',
    };

    const isSmsType =
      (account.provider.code === 'telebirr' &&
        (type === TransactionType.P2P_IN || type === TransactionType.P2P_OUT || type === TransactionType.AIRTIME)) ||
      (account.provider.code === 'cbe_birr' && (type === TransactionType.P2P_IN || type === TransactionType.P2P_OUT));

    const ref = reference(account.provider.code === 'telebirr' ? 'DI' : 'FT');
    const merchant = type === TransactionType.MERCHANT_PAY || type === TransactionType.UTILITY ? pick(params.merchants) : null;
    const hasCounterparty = type === TransactionType.P2P_IN || type === TransactionType.P2P_OUT;
    const reconciliationRoll = random();

    const transaction: Prisma.TransactionCreateManyInput = {
      accountId: account.id,
      amount: amount.toFixed(2),
      categoryId: categories.get(categoryName[type]),
      counterpartyId: hasCounterparty ? counterparties.get(counterparty.name) : undefined,
      createdAt: at,
      deviceId,
      direction,
      id,
      localId,
      note: merchant ? merchant.displayName : undefined,
      occurredAt: at,
      providerId: account.provider.id,
      reconciliationStatus:
        reconciliationRoll < 0.7
          ? ReconciliationStatus.VERIFIED
          : reconciliationRoll < 0.85
            ? ReconciliationStatus.MATCHED
            : reconciliationRoll < 0.95
              ? ReconciliationStatus.UNRECONCILED
              : ReconciliationStatus.NEEDS_REVIEW,
      reference: ref,
      source: isSmsType ? TransactionSource.SMS : TransactionSource.MANUAL,
      syncStatus: SyncStatus.SYNCED,
      type,
      updatedAt: at,
      userId,
    };

    const sms = isSmsType
      ? {
          createdAt: at,
          deviceId,
          localId: `${localId}-sms`,
          messageBody:
            account.provider.code === 'telebirr'
              ? telebirrMessage(seed.firstName, type, amount, account.balance, counterparty, at, ref)
              : cbeMessage(fullName, type, amount, account.balance, counterparty, account.number),
          parseStatus: RawSmsParseStatus.PARSED,
          providerId: account.provider.id,
          receivedAt: at,
          senderId: account.provider.code === 'telebirr' ? '127' : 'CBE',
          transactionId: id,
        }
      : undefined;

    results.push({ transaction, sms });
  });

  return results;
}

async function resetDemoUsers(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.user.findMany({
    select: { id: true },
    where: { phoneNumber: { in: demoUsers.map((user) => user.phoneNumber) } },
  });
  const ids = existing.map((user) => user.id);
  if (ids.length === 0) return;
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function seedMerchants(prisma: PrismaClient) {
  const merchants: Merchant[] = [];
  for (const seed of merchantSeeds) {
    const existing = await prisma.merchant.findFirst({ where: { displayName: seed.displayName } });
    const data = { isActive: seed.isActive, merchantRef: seed.merchantRef, providerCode: seed.providerCode };
    merchants.push(
      existing
        ? await prisma.merchant.update({ data, where: { id: existing.id } })
        : await prisma.merchant.create({ data: { ...data, displayName: seed.displayName } }),
    );
  }
  return merchants;
}

async function seedReviewQueue(prisma: PrismaClient, providers: Map<string, ProviderRef>): Promise<string[]> {
  const created: string[] = [];
  const telebirr = providers.get('telebirr');
  const cbe = providers.get('cbe_birr');
  const awash = providers.get('awash_bank');
  const dashen = providers.get('dashen_bank');

  const draftRules = [
    telebirr && {
      providerId: telebirr.id,
      version: 2,
      transactionType: TransactionType.UTILITY,
      priority: 25,
      status: ProviderRuleStatus.DRAFT,
      pattern: String.raw`You have paid ETB\s+(?<amount>[\d,.]+)\s+to\s+(?<merchantName>.+?)\s+for bill\s+(?<billRef>\S+)\s+on\s+(?<transactionAt>\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})\.\s+Transaction ID\s+(?<ref>[A-Z0-9]+)`,
      mappings: [
        ['amount', 'amount', 'NUMBER', true],
        ['merchantName', 'merchantName', 'STRING', true],
        ['billRef', 'billReference', 'STRING', false],
        ['ref', 'reference', 'STRING', true],
      ] as const,
      example: failedSmsBodies[1],
    },
    awash && {
      providerId: awash.id,
      version: 1,
      transactionType: TransactionType.P2P_IN,
      priority: 10,
      status: ProviderRuleStatus.DRAFT,
      pattern: String.raw`Your account\s+(?<toAccount>\S+)\s+has been credited with ETB\s+(?<amount>[\d,.]+)\s+by\s+(?<counterpartyName>.+?)\.\s+Balance:\s+ETB\s+(?<balance>[\d,.]+)`,
      mappings: [
        ['amount', 'amount', 'NUMBER', true],
        ['counterpartyName', 'counterpartyName', 'STRING', false],
        ['balance', 'currentBalance', 'NUMBER', false],
      ] as const,
      example:
        'Dear Customer, Your account 01320******800 has been credited with ETB 2,450.00 by Mulugeta Alemu. Balance: ETB 18,210.35. Awash Bank',
    },
    dashen && {
      providerId: dashen.id,
      version: 1,
      transactionType: TransactionType.WITHDRAWAL,
      priority: 10,
      status: ProviderRuleStatus.DRAFT,
      pattern: String.raw`ETB\s+(?<amount>[\d,.]+)\s+has been withdrawn at ATM\s+(?<atm>\S+)\s+on\s+(?<transactionAt>\d{2}/\d{2}/\d{4})\.\s+Avail\. Bal ETB\s+(?<balance>[\d,.]+)`,
      mappings: [
        ['amount', 'amount', 'NUMBER', true],
        ['atm', 'channel', 'STRING', false],
        ['balance', 'currentBalance', 'NUMBER', false],
      ] as const,
      example: failedSmsBodies[3],
    },
    cbe && {
      providerId: cbe.id,
      version: 1,
      transactionType: TransactionType.P2P_OUT,
      priority: 90,
      status: ProviderRuleStatus.DEPRECATED,
      pattern: String.raw`transferred ETB(?<amount>[\d,.]+) to (?<counterpartyName>.+?)\.`,
      mappings: [['amount', 'amount', 'NUMBER', true]] as const,
      example: 'You have transferred ETB500.00 to Abebe Kebede.',
    },
  ].filter((rule): rule is NonNullable<typeof rule> => Boolean(rule));

  for (const rule of draftRules) {
    const exists = await prisma.providerParserRule.findFirst({
      where: { pattern: rule.pattern, providerId: rule.providerId },
    });
    if (exists) continue;
    const record = await prisma.providerParserRule.create({
      data: {
        examples: { create: [{ expectedType: rule.transactionType, messageBody: rule.example }] },
        fieldMappings: {
          create: rule.mappings.map(([captureGroup, targetField, valueType, isRequired]) => ({
            captureGroup,
            isRequired,
            targetField,
            valueType,
          })),
        },
        pattern: rule.pattern,
        priority: rule.priority,
        providerId: rule.providerId,
        status: rule.status,
        transactionType: rule.transactionType,
        version: rule.version,
      },
    });
    created.push(`rule:${record.id}`);
  }

  const draftTemplates = [
    telebirr && {
      providerId: telebirr.id,
      paymentType: 'SEND_MONEY',
      template: '*127*1*{phone}*{amount}#',
      fields: [
        { key: 'phone', label: 'Recipient phone', validationPattern: String.raw`^0?9\d{8}$`, sortOrder: 10 },
        { key: 'amount', label: 'Amount', validationPattern: String.raw`^\d+(\.\d{1,2})?$`, sortOrder: 20 },
      ],
    },
    cbe && {
      providerId: cbe.id,
      paymentType: 'AIRTIME',
      template: '*847*3*{phone}*{amount}#',
      fields: [
        { key: 'phone', label: 'Phone number', validationPattern: String.raw`^0?9\d{8}$`, sortOrder: 10 },
        { key: 'amount', label: 'Amount', validationPattern: String.raw`^\d+$`, sortOrder: 20 },
      ],
    },
  ].filter((template): template is NonNullable<typeof template> => Boolean(template));

  for (const template of draftTemplates) {
    const exists = await prisma.providerPaymentTemplate.findFirst({
      where: { paymentType: template.paymentType, providerId: template.providerId, status: PaymentTemplateStatus.DRAFT },
    });
    if (exists) continue;
    const latest = await prisma.providerPaymentTemplate.findFirst({
      orderBy: { version: 'desc' },
      where: { paymentType: template.paymentType, providerId: template.providerId },
    });
    const record = await prisma.providerPaymentTemplate.create({
      data: {
        fields: { create: template.fields },
        paymentType: template.paymentType,
        providerId: template.providerId,
        status: PaymentTemplateStatus.DRAFT,
        template: template.template,
        version: (latest?.version ?? 0) + 1,
      },
    });
    created.push(`template:${record.id}`);
  }

  return created;
}

async function seedAuditTrail(
  prisma: PrismaClient,
  adminId: string,
  opsId: string,
  providers: Map<string, ProviderRef>,
  targetUserId: string,
): Promise<void> {
  const telebirr = providers.get('telebirr');
  const awash = providers.get('awash_bank');
  const events: {
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string;
    daysAgo: number;
    details: [string, string][];
  }[] = [
    { actorId: adminId, action: 'PROVIDER_CREATED', targetType: 'Provider', targetId: awash?.id, daysAgo: 21, details: [['code', 'awash_bank'], ['displayName', 'Awash Bank']] },
    { actorId: opsId, action: 'SENDER_ALIAS_CREATED', targetType: 'ProviderSenderAlias', daysAgo: 20, details: [['providerCode', 'awash_bank'], ['senderId', 'AwashBank']] },
    { actorId: opsId, action: 'PARSER_RULE_DRAFT_CREATED', targetType: 'ProviderParserRule', daysAgo: 12, details: [['providerCode', 'telebirr'], ['transactionType', 'UTILITY'], ['version', '2'], ['exampleCount', '1']] },
    { actorId: adminId, action: 'PARSER_RULE_PUBLISHED', targetType: 'ProviderParserRule', daysAgo: 11, details: [['providerCode', 'telebirr'], ['configVersion', '1']] },
    { actorId: opsId, action: 'MERCHANT_CREATED', targetType: 'Merchant', daysAgo: 9, details: [['displayName', 'Shoa Supermarket']] },
    { actorId: opsId, action: 'PAYMENT_TEMPLATE_DRAFT_CREATED', targetType: 'ProviderPaymentTemplate', daysAgo: 6, details: [['providerCode', 'telebirr'], ['paymentType', 'SEND_MONEY'], ['fieldCount', '2']] },
    { actorId: adminId, action: 'PROVIDER_UPDATED', targetType: 'Provider', targetId: telebirr?.id, daysAgo: 4, details: [['displayName.before', 'TeleBirr'], ['displayName.after', 'Telebirr']] },
    { actorId: adminId, action: 'USER_ACCESS_UPDATED', targetType: 'User', targetId: targetUserId, daysAgo: 2, details: [['role.before', 'USER'], ['role.after', 'USER'], ['status.before', 'ACTIVE'], ['status.after', 'SUSPENDED']] },
    { actorId: opsId, action: 'PRESET_CATEGORY_UPDATED', targetType: 'Category', daysAgo: 1, details: [['name.before', 'Food & Drink'], ['name.after', 'Food']] },
  ];

  for (const event of events) {
    await prisma.auditLog.create({
      data: {
        action: event.action,
        actorId: event.actorId,
        createdAt: new Date(now - event.daysAgo * DAY),
        details: { create: event.details.map(([key, value]) => ({ key, value })) },
        targetId: event.targetId ?? randomUUID(),
        targetType: event.targetType,
      },
    });
  }
}

export async function seedDemoData(prisma: PrismaClient, password: string): Promise<void> {
  const providerRows = await prisma.provider.findMany({ select: { code: true, id: true } });
  const providers = new Map(providerRows.map((provider) => [provider.code, provider]));
  const telebirr = providers.get('telebirr');
  const cbe = providers.get('cbe_birr');
  if (!telebirr || !cbe) throw new Error('Seed providers first');

  const categoryRows = await prisma.category.findMany({
    select: { id: true, name: true },
    where: { kind: CategoryKind.PRESET, userId: null },
  });
  const categories = new Map(categoryRows.map((category) => [category.name, category.id]));

  await resetDemoUsers(prisma);
  const merchants = await seedMerchants(prisma);
  const activeMerchants = merchants.filter((merchant) => merchant.isActive);
  const passwordHash = hashPassword(password);
  const userIds = new Map<string, string>();

  for (const [userIndex, seed] of demoUsers.entries()) {
    const joinedAt = new Date(now - (90 - userIndex * 7) * DAY);
    const user = await prisma.user.create({
      data: {
        createdAt: joinedAt,
        failedLoginAttempts: 0,
        lockedUntil: seed.locked ? new Date(now + 12 * 60_000) : null,
        notificationPreference: { create: { upcomingBillEnabled: userIndex % 3 !== 0 } },
        passwordHash,
        phoneNumber: seed.phoneNumber,
        role: seed.role,
        status: seed.status ?? UserStatus.ACTIVE,
      },
    });
    userIds.set(seed.phoneNumber, user.id);

    const primaryDevice = await prisma.device.create({
      data: {
        appVersion: pick(['1.0.0', '1.0.1', '1.1.0']),
        deviceKey: `android-demo-${seed.phoneNumber.slice(-3)}`,
        lastSyncAt: new Date(now - between(0.02, 3) * DAY),
        platform: userIndex % 4 === 3 ? 'ios' : 'android',
        userId: user.id,
      },
    });
    if (userIndex % 3 === 1) {
      await prisma.device.create({
        data: {
          appVersion: '0.9.4',
          deviceKey: `android-old-${seed.phoneNumber.slice(-3)}`,
          platform: 'android',
          revokedAt: new Date(now - 30 * DAY),
          status: DeviceStatus.REVOKED,
          userId: user.id,
        },
      });
    }

    const accounts: AccountRef[] = [];
    const accountSeeds: [ProviderRef, string, string][] = [
      [telebirr, 'telebirr Wallet', `9${seed.phoneNumber.slice(-8)}`],
      ...(userIndex % 2 === 0 ? [[cbe, 'CBE Savings', `1000${seed.phoneNumber.slice(-8)}2026`] as [ProviderRef, string, string]] : []),
    ];
    for (const [provider, displayName, number] of accountSeeds) {
      const account = await prisma.account.create({
        data: { displayName, providerId: provider.id, userId: user.id },
      });
      accounts.push({ balance: roundTo(between(800, 9000), 0.05), id: account.id, number, provider });
    }

    const counterparties = new Map<string, string>();
    for (const counterparty of counterpartyPool) {
      const record = await prisma.counterparty.create({
        data: { displayName: counterparty.name, phoneNumber: counterparty.phone, userId: user.id },
      });
      counterparties.set(counterparty.name, record.id);
    }

    const generated = generateTransactions({
      accounts,
      categories,
      counterparties,
      deviceId: primaryDevice.id,
      merchants: activeMerchants,
      seed,
      userId: user.id,
    });

    await prisma.transaction.createMany({ data: generated.map((item) => item.transaction) });
    await prisma.rawSmsLog.createMany({
      data: generated.flatMap((item) => (item.sms ? [{ ...item.sms, userId: user.id }] : [])),
    });

    const extraLogs: Prisma.RawSmsLogCreateManyInput[] = [];
    const failures = Math.floor(seed.transactionCount / 12);
    for (let index = 0; index < failures; index += 1) {
      const at = new Date(now - between(0.1, 28) * DAY);
      const body = pick(failedSmsBodies);
      extraLogs.push({
        createdAt: at,
        deviceId: primaryDevice.id,
        localId: `demo-${seed.phoneNumber.slice(-3)}-failed-${index}`,
        messageBody: body,
        parseStatus: RawSmsParseStatus.FAILED,
        providerId: body.includes('CBE') ? cbe.id : body.includes('ATM') ? providers.get('dashen_bank')?.id : telebirr.id,
        receivedAt: at,
        senderId: body.includes('CBE') ? 'CBE' : body.includes('ATM') ? 'Dashen_Bank' : '127',
        userId: user.id,
      });
    }
    for (let index = 0; index < 2; index += 1) {
      const at = new Date(now - between(0.1, 20) * DAY);
      extraLogs.push({
        createdAt: at,
        deviceId: primaryDevice.id,
        localId: `demo-${seed.phoneNumber.slice(-3)}-ignored-${index}`,
        messageBody: pick(ignoredSmsBodies),
        parseStatus: index === 0 ? RawSmsParseStatus.IGNORED : RawSmsParseStatus.UNPARSED,
        providerId: index === 0 ? telebirr.id : null,
        receivedAt: at,
        senderId: index === 0 ? '127' : '8990',
        userId: user.id,
      });
    }
    await prisma.rawSmsLog.createMany({ data: extraLogs });

    const telebirrAccount = accounts[0];
    await prisma.balanceSnapshot.create({
      data: { accountId: telebirrAccount.id, balance: telebirrAccount.balance.toFixed(2), providerId: telebirr.id, userId: user.id },
    });
    if (userIndex % 4 === 2) {
      const difference = roundTo(between(5, 250), 0.05);
      await prisma.balanceDiscrepancy.create({
        data: {
          accountId: telebirrAccount.id,
          difference: difference.toFixed(2),
          expectedBalance: (telebirrAccount.balance + difference).toFixed(2),
          providerId: telebirr.id,
          reason: 'Reported SMS balance does not match computed ledger',
          reportedBalance: telebirrAccount.balance.toFixed(2),
          status: userIndex === 2 ? BalanceDiscrepancyStatus.OPEN : BalanceDiscrepancyStatus.REVIEWED,
          userId: user.id,
        },
      });
    }

    const subscriptionMerchants = [
      { merchant: 'DStv Ethiopia', amount: '1150.00', category: SubscriptionCategory.STREAMING, frequency: SubscriptionFrequency.MONTHLY },
      { merchant: 'Ethio Telecom', amount: '499.00', category: SubscriptionCategory.TELECOM, frequency: SubscriptionFrequency.MONTHLY },
      { merchant: 'Ethiopian Electric Utility', amount: null, category: SubscriptionCategory.UTILITIES, frequency: SubscriptionFrequency.MONTHLY },
    ];
    for (const [subIndex, subscription] of subscriptionMerchants.entries()) {
      if ((userIndex + subIndex) % 2 !== 0) continue;
      const merchant = merchants.find((item) => item.displayName === subscription.merchant);
      await prisma.subscription.create({
        data: {
          amount: subscription.amount,
          category: subscription.category,
          frequency: subscription.frequency,
          merchantId: merchant?.id,
          name: subscription.merchant,
          nextDueAt: new Date(now + between(1, 28) * DAY),
          recurrenceRule: 'FREQ=MONTHLY',
          status: subIndex === 2 && userIndex % 3 === 0 ? SubscriptionStatus.PAUSED : SubscriptionStatus.ACTIVE,
          userId: user.id,
        },
      });
    }

    if (seed.status === UserStatus.SUSPENDED) {
      await prisma.authSession.updateMany({
        data: { revokedAt: new Date(), status: AuthSessionStatus.REVOKED },
        where: { userId: user.id },
      });
    }
  }

  await seedReviewQueue(prisma, providers);

  const adminId = userIds.get('+251911000001');
  const opsId = userIds.get('+251911000002');
  const suspendedId = userIds.get('+251911000008');
  if (adminId && opsId && suspendedId) {
    await seedAuditTrail(prisma, adminId, opsId, providers, suspendedId);
  }
}

export const demoAccounts = demoUsers.map(({ phoneNumber, role, status, locked }) => ({
  locked: Boolean(locked),
  phoneNumber,
  role,
  status: status ?? UserStatus.ACTIVE,
}));
