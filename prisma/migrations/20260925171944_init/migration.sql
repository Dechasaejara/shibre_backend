-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'BUSINESS_OPS', 'ADMIN');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('TRUSTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ProviderRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED', 'DISABLED');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('SMS', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('P2P_OUT', 'P2P_IN', 'MERCHANT_PAY', 'WITHDRAWAL', 'AIRTIME', 'UTILITY', 'SUBSCRIPTION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCED', 'CONFLICTED', 'DELETED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('UNRECONCILED', 'MATCHED', 'VERIFIED', 'IGNORED', 'DUPLICATE', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('PRESET', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RawSmsParseStatus" AS ENUM ('UNPARSED', 'PARSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "PaymentTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED', 'DISABLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConfigValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATETIME');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSetting" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL DEFAULT 'STRING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL DEFAULT 'STRING',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" UUID NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "pushToken" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'TRUSTED',
    "lastSyncAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'ET',
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConfigVersion" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ProviderRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderSenderAlias" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "senderId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderSenderAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderParserRule" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "configVersionId" UUID,
    "version" INTEGER NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "pattern" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" "ProviderRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderParserRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderParserFieldMapping" (
    "id" UUID NOT NULL,
    "parserRuleId" UUID NOT NULL,
    "captureGroup" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL DEFAULT 'STRING',
    "transform" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderParserFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderParserRuleExample" (
    "id" UUID NOT NULL,
    "parserRuleId" UUID NOT NULL,
    "messageBody" TEXT NOT NULL,
    "expectedType" "TransactionType",
    "expectedAmount" DECIMAL(18,2),
    "expectedBalance" DECIMAL(18,2),
    "expectedRef" TEXT,
    "expectedCounterpartyName" TEXT,
    "expectedCounterpartyPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderParserRuleExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderPaymentTemplate" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "configVersionId" UUID,
    "paymentType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "template" TEXT NOT NULL,
    "status" "PaymentTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderPaymentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderPaymentTemplateField" (
    "id" UUID NOT NULL,
    "paymentTemplateId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL DEFAULT 'STRING',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "validationPattern" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderPaymentTemplateField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "parentId" UUID,
    "kind" "CategoryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "providerId" UUID,
    "displayName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counterparty" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Counterparty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "localId" TEXT,
    "userId" UUID NOT NULL,
    "deviceId" UUID,
    "accountId" UUID,
    "providerId" UUID,
    "categoryId" UUID,
    "counterpartyId" UUID,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "type" "TransactionType" NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "source" "TransactionSource" NOT NULL,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'UNRECONCILED',
    "reference" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawSmsLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" UUID,
    "providerId" UUID,
    "transactionId" UUID,
    "senderId" TEXT NOT NULL,
    "messageBody" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "parseStatus" "RawSmsParseStatus" NOT NULL DEFAULT 'UNPARSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawSmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceSnapshot" (
    "id" UUID NOT NULL,
    "accountId" UUID,
    "providerId" UUID,
    "transactionId" UUID,
    "balance" DECIMAL(18,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "transactionId" UUID,
    "status" "ReconciliationStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationEventDetail" (
    "id" UUID NOT NULL,
    "reconciliationEventId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL DEFAULT 'STRING',

    CONSTRAINT "ReconciliationEventDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "providerCode" TEXT,
    "merchantRef" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "merchantId" UUID,
    "lastPaidTransactionId" UUID,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "recurrenceRule" TEXT,
    "nextDueAt" TIMESTAMP(3),
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "newTransactionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "balanceMismatchEnabled" BOOLEAN NOT NULL DEFAULT true,
    "spendingLimitEnabled" BOOLEAN NOT NULL DEFAULT true,
    "upcomingBillEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncFailureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paymentStatusEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogDetail" (
    "id" UUID NOT NULL,
    "auditLogId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL DEFAULT 'STRING',

    CONSTRAINT "AuditLogDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "UserSetting_key_idx" ON "UserSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserSetting_userId_key_key" ON "UserSetting"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "OtpChallenge_phoneNumber_createdAt_idx" ON "OtpChallenge"("phoneNumber", "createdAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "Device_userId_status_idx" ON "Device"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_code_key" ON "Provider"("code");

-- CreateIndex
CREATE INDEX "Provider_isActive_idx" ON "Provider"("isActive");

-- CreateIndex
CREATE INDEX "ProviderConfigVersion_providerId_status_idx" ON "ProviderConfigVersion"("providerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfigVersion_providerId_version_key" ON "ProviderConfigVersion"("providerId", "version");

-- CreateIndex
CREATE INDEX "ProviderSenderAlias_senderId_isActive_idx" ON "ProviderSenderAlias"("senderId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSenderAlias_providerId_senderId_key" ON "ProviderSenderAlias"("providerId", "senderId");

-- CreateIndex
CREATE INDEX "ProviderParserRule_providerId_status_version_idx" ON "ProviderParserRule"("providerId", "status", "version");

-- CreateIndex
CREATE INDEX "ProviderParserRule_configVersionId_idx" ON "ProviderParserRule"("configVersionId");

-- CreateIndex
CREATE INDEX "ProviderParserRule_transactionType_idx" ON "ProviderParserRule"("transactionType");

-- CreateIndex
CREATE INDEX "ProviderParserFieldMapping_targetField_idx" ON "ProviderParserFieldMapping"("targetField");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderParserFieldMapping_parserRuleId_captureGroup_target_key" ON "ProviderParserFieldMapping"("parserRuleId", "captureGroup", "targetField");

-- CreateIndex
CREATE INDEX "ProviderParserRuleExample_parserRuleId_idx" ON "ProviderParserRuleExample"("parserRuleId");

-- CreateIndex
CREATE INDEX "ProviderPaymentTemplate_providerId_paymentType_status_idx" ON "ProviderPaymentTemplate"("providerId", "paymentType", "status");

-- CreateIndex
CREATE INDEX "ProviderPaymentTemplate_configVersionId_idx" ON "ProviderPaymentTemplate"("configVersionId");

-- CreateIndex
CREATE INDEX "ProviderPaymentTemplateField_sortOrder_idx" ON "ProviderPaymentTemplateField"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderPaymentTemplateField_paymentTemplateId_key_key" ON "ProviderPaymentTemplateField"("paymentTemplateId", "key");

-- CreateIndex
CREATE INDEX "Category_userId_kind_idx" ON "Category"("userId", "kind");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Account_userId_isActive_idx" ON "Account"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Account_providerId_idx" ON "Account"("providerId");

-- CreateIndex
CREATE INDEX "Counterparty_userId_displayName_idx" ON "Counterparty"("userId", "displayName");

-- CreateIndex
CREATE INDEX "Counterparty_userId_phoneNumber_idx" ON "Counterparty"("userId", "phoneNumber");

-- CreateIndex
CREATE INDEX "Transaction_userId_occurredAt_idx" ON "Transaction"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_syncStatus_updatedAt_idx" ON "Transaction"("userId", "syncStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "Transaction_providerId_type_idx" ON "Transaction"("providerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_localId_key" ON "Transaction"("userId", "localId");

-- CreateIndex
CREATE UNIQUE INDEX "RawSmsLog_transactionId_key" ON "RawSmsLog"("transactionId");

-- CreateIndex
CREATE INDEX "RawSmsLog_userId_receivedAt_idx" ON "RawSmsLog"("userId", "receivedAt");

-- CreateIndex
CREATE INDEX "RawSmsLog_providerId_parseStatus_idx" ON "RawSmsLog"("providerId", "parseStatus");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_accountId_recordedAt_idx" ON "BalanceSnapshot"("accountId", "recordedAt");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_providerId_recordedAt_idx" ON "BalanceSnapshot"("providerId", "recordedAt");

-- CreateIndex
CREATE INDEX "ReconciliationEvent_userId_status_createdAt_idx" ON "ReconciliationEvent"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationEvent_transactionId_idx" ON "ReconciliationEvent"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationEventDetail_reconciliationEventId_key_key" ON "ReconciliationEventDetail"("reconciliationEventId", "key");

-- CreateIndex
CREATE INDEX "Merchant_displayName_idx" ON "Merchant"("displayName");

-- CreateIndex
CREATE INDEX "Merchant_providerCode_merchantRef_idx" ON "Merchant"("providerCode", "merchantRef");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_nextDueAt_idx" ON "Subscription"("userId", "status", "nextDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLogDetail_auditLogId_key_key" ON "AuditLogDetail"("auditLogId", "key");

-- AddForeignKey
ALTER TABLE "UserSetting" ADD CONSTRAINT "UserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVersion" ADD CONSTRAINT "ProviderConfigVersion_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSenderAlias" ADD CONSTRAINT "ProviderSenderAlias_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderParserRule" ADD CONSTRAINT "ProviderParserRule_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "ProviderConfigVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderParserRule" ADD CONSTRAINT "ProviderParserRule_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderParserFieldMapping" ADD CONSTRAINT "ProviderParserFieldMapping_parserRuleId_fkey" FOREIGN KEY ("parserRuleId") REFERENCES "ProviderParserRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderParserRuleExample" ADD CONSTRAINT "ProviderParserRuleExample_parserRuleId_fkey" FOREIGN KEY ("parserRuleId") REFERENCES "ProviderParserRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderPaymentTemplate" ADD CONSTRAINT "ProviderPaymentTemplate_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "ProviderConfigVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderPaymentTemplate" ADD CONSTRAINT "ProviderPaymentTemplate_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderPaymentTemplateField" ADD CONSTRAINT "ProviderPaymentTemplateField_paymentTemplateId_fkey" FOREIGN KEY ("paymentTemplateId") REFERENCES "ProviderPaymentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Counterparty" ADD CONSTRAINT "Counterparty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawSmsLog" ADD CONSTRAINT "RawSmsLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawSmsLog" ADD CONSTRAINT "RawSmsLog_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawSmsLog" ADD CONSTRAINT "RawSmsLog_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawSmsLog" ADD CONSTRAINT "RawSmsLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationEvent" ADD CONSTRAINT "ReconciliationEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationEvent" ADD CONSTRAINT "ReconciliationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationEventDetail" ADD CONSTRAINT "ReconciliationEventDetail_reconciliationEventId_fkey" FOREIGN KEY ("reconciliationEventId") REFERENCES "ReconciliationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_lastPaidTransactionId_fkey" FOREIGN KEY ("lastPaidTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogDetail" ADD CONSTRAINT "AuditLogDetail_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
