-- CreateEnum
CREATE TYPE "UssdReportReason" AS ENUM ('DIALER_DID_NOT_OPEN', 'CODE_REJECTED', 'WRONG_MENU', 'PAYMENT_NOT_COMPLETED', 'OTHER');

-- CreateEnum
CREATE TYPE "UssdReportStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "UssdTemplateReport" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "providerId" UUID NOT NULL,
    "paymentTemplateId" UUID,
    "paymentType" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "dialPattern" TEXT NOT NULL,
    "reason" "UssdReportReason" NOT NULL DEFAULT 'OTHER',
    "note" TEXT,
    "platform" TEXT,
    "appVersion" TEXT,
    "status" "UssdReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UssdTemplateReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UssdTemplateReport_status_createdAt_idx" ON "UssdTemplateReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UssdTemplateReport_providerId_paymentType_idx" ON "UssdTemplateReport"("providerId", "paymentType");

-- CreateIndex
CREATE INDEX "UssdTemplateReport_paymentTemplateId_idx" ON "UssdTemplateReport"("paymentTemplateId");

-- AddForeignKey
ALTER TABLE "UssdTemplateReport" ADD CONSTRAINT "UssdTemplateReport_paymentTemplateId_fkey" FOREIGN KEY ("paymentTemplateId") REFERENCES "ProviderPaymentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UssdTemplateReport" ADD CONSTRAINT "UssdTemplateReport_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UssdTemplateReport" ADD CONSTRAINT "UssdTemplateReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UssdTemplateReport" ADD CONSTRAINT "UssdTemplateReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
