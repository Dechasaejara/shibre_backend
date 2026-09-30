-- CreateEnum
CREATE TYPE "BalanceDiscrepancyStatus" AS ENUM ('OPEN', 'REVIEWED', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "BalanceDiscrepancy" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "accountId" UUID,
    "providerId" UUID,
    "transactionId" UUID,
    "reportedBalance" DECIMAL(18,2) NOT NULL,
    "expectedBalance" DECIMAL(18,2) NOT NULL,
    "difference" DECIMAL(18,2) NOT NULL,
    "status" "BalanceDiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BalanceDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BalanceDiscrepancy_userId_status_createdAt_idx" ON "BalanceDiscrepancy"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BalanceDiscrepancy_providerId_status_idx" ON "BalanceDiscrepancy"("providerId", "status");

-- CreateIndex
CREATE INDEX "BalanceDiscrepancy_accountId_status_idx" ON "BalanceDiscrepancy"("accountId", "status");

-- AddForeignKey
ALTER TABLE "BalanceDiscrepancy" ADD CONSTRAINT "BalanceDiscrepancy_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceDiscrepancy" ADD CONSTRAINT "BalanceDiscrepancy_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceDiscrepancy" ADD CONSTRAINT "BalanceDiscrepancy_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceDiscrepancy" ADD CONSTRAINT "BalanceDiscrepancy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
