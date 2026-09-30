-- AlterTable
ALTER TABLE "BalanceSnapshot" ADD COLUMN     "userId" UUID;

-- CreateIndex
CREATE INDEX "BalanceSnapshot_userId_recordedAt_idx" ON "BalanceSnapshot"("userId", "recordedAt");

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
