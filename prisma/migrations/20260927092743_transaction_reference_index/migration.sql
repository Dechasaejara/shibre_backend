-- CreateIndex
CREATE INDEX "Transaction_userId_providerId_reference_idx" ON "Transaction"("userId", "providerId", "reference");
