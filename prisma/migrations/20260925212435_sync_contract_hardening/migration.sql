/*
  Warnings:

  - A unique constraint covering the columns `[userId,localId]` on the table `RawSmsLog` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "RawSmsLog" ADD COLUMN     "localId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RawSmsLog_userId_localId_key" ON "RawSmsLog"("userId", "localId");
