import {
  CategoryKind,
  PaymentTemplateStatus,
  PrismaClient,
  ProviderRuleStatus,
} from '@prisma/client';
import { demoAccounts, seedDemoData } from './demo-data';
import { balanceTemplate, providers, type ProviderSeed } from './provider-seeds';

const prisma = new PrismaClient();

const presetCategories = [
  { name: 'Income', icon: 'trending-up', color: '#00A651' },
  { name: 'Transfer', icon: 'send', color: '#0070BA' },
  { name: 'Merchant Payment', icon: 'shopping-bag', color: '#0070BA' },
  { name: 'Airtime', icon: 'phone', color: '#009CDE' },
  { name: 'Utilities', icon: 'bolt', color: '#F5A623' },
  { name: 'Subscription', icon: 'calendar', color: '#6C7278' },
  { name: 'Withdrawal', icon: 'banknote', color: '#D0021B' },
  { name: 'Food', icon: 'utensils', color: '#00A651' },
  { name: 'Transport', icon: 'car', color: '#F5A623' },
  { name: 'Other', icon: 'circle', color: '#9EA5AD' },
] as const;

async function seedProvider(providerSeed: ProviderSeed): Promise<void> {
  const provider = await prisma.provider.upsert({
    create: {
      code: providerSeed.code,
      displayName: providerSeed.displayName,
    },
    update: {
      displayName: providerSeed.displayName,
      isActive: true,
    },
    where: { code: providerSeed.code },
  });

  await Promise.all(
    providerSeed.aliases.map((senderId, index) =>
      prisma.providerSenderAlias.upsert({
        create: {
          priority: (index + 1) * 10,
          providerId: provider.id,
          senderId,
        },
        update: {
          isActive: true,
          priority: (index + 1) * 10,
        },
        where: {
          providerId_senderId: {
            providerId: provider.id,
            senderId,
          },
        },
      }),
    ),
  );

  const configVersion = await prisma.providerConfigVersion.upsert({
    create: {
      providerId: provider.id,
      publishedAt: new Date(),
      status: ProviderRuleStatus.ACTIVE,
      version: 1,
    },
    update: {
      publishedAt: new Date(),
      status: ProviderRuleStatus.ACTIVE,
    },
    where: {
      providerId_version: {
        providerId: provider.id,
        version: 1,
      },
    },
  });

  await prisma.providerParserRule.deleteMany({
    where: { configVersionId: configVersion.id },
  });
  await prisma.providerPaymentTemplate.deleteMany({
    where: { configVersionId: configVersion.id },
  });

  for (const ruleSeed of providerSeed.parserRules) {
    await prisma.providerParserRule.create({
      data: {
        configVersionId: configVersion.id,
        examples: {
          create: ruleSeed.examples.map((example) => ({
            expectedAmount: example.expectedAmount,
            expectedBalance: example.expectedBalance,
            expectedCounterpartyName: example.expectedCounterpartyName,
            expectedCounterpartyPhone: example.expectedCounterpartyPhone,
            expectedRef: example.expectedRef,
            expectedType: example.expectedType,
            messageBody: example.messageBody,
          })),
        },
        fieldMappings: {
          create: ruleSeed.fields.map((parserField) => ({
            captureGroup: parserField.captureGroup,
            isRequired: parserField.isRequired ?? false,
            targetField: parserField.targetField,
            transform: parserField.transform,
            valueType: parserField.valueType,
          })),
        },
        pattern: ruleSeed.pattern,
        priority: ruleSeed.priority,
        providerId: provider.id,
        status: ProviderRuleStatus.ACTIVE,
        transactionType: ruleSeed.transactionType,
        version: 1,
      },
    });
  }

  for (const templateSeed of [...providerSeed.paymentTemplates, balanceTemplate(providerSeed.balanceUssd)]) {
    await prisma.providerPaymentTemplate.create({
      data: {
        configVersionId: configVersion.id,
        fields: {
          create: templateSeed.fields.map((templateField) => ({
            isRequired: templateField.isRequired ?? true,
            key: templateField.key,
            label: templateField.label,
            sortOrder: templateField.sortOrder,
            validationPattern: templateField.validationPattern,
            valueType: templateField.valueType,
          })),
        },
        paymentType: templateSeed.paymentType,
        providerId: provider.id,
        status: PaymentTemplateStatus.ACTIVE,
        template: templateSeed.template,
        instructions: templateSeed.instructions,
        version: templateSeed.version,
      },
    });
  }
}

async function main(): Promise<void> {
  for (const provider of providers) {
    await seedProvider(provider);
  }

  await seedPresetCategories();

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && process.env.SEED_DEMO !== 'true') {
    console.log('Skipping demo data in production (set SEED_DEMO=true to force).');
    return;
  }

  const password = process.env.SEED_DEMO_PASSWORD ?? 'ShibreDemo#2026';
  if (isProduction && !process.env.SEED_DEMO_PASSWORD) {
    throw new Error('SEED_DEMO_PASSWORD is required when seeding demo data in production');
  }

  await seedDemoData(prisma, password);
  console.log(`Demo accounts (password: ${isProduction ? '<SEED_DEMO_PASSWORD>' : password}):`);
  console.table(demoAccounts);
}

async function seedPresetCategories(): Promise<void> {
  for (const categorySeed of presetCategories) {
    const existing = await prisma.category.findFirst({
      where: {
        kind: CategoryKind.PRESET,
        name: categorySeed.name,
        userId: null,
      },
    });

    if (existing) {
      await prisma.category.update({
        data: {
          color: categorySeed.color,
          icon: categorySeed.icon,
        },
        where: { id: existing.id },
      });
      continue;
    }

    await prisma.category.create({
      data: {
        color: categorySeed.color,
        icon: categorySeed.icon,
        kind: CategoryKind.PRESET,
        name: categorySeed.name,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });