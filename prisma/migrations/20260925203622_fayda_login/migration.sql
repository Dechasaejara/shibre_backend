/*
  Warnings:

  - A unique constraint covering the columns `[faydaIdHash]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "OtpChallenge" ADD COLUMN     "faydaIdHash" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "faydaIdHash" TEXT;

-- CreateIndex
CREATE INDEX "OtpChallenge_faydaIdHash_idx" ON "OtpChallenge"("faydaIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_faydaIdHash_key" ON "User"("faydaIdHash");
