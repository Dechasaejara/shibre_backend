-- CreateEnum
CREATE TYPE "SubscriptionCategory" AS ENUM ('UTILITIES', 'TELECOM', 'INTERNET', 'STREAMING', 'RENT', 'INSURANCE', 'EDUCATION', 'LOAN', 'OTHER');

-- CreateEnum
CREATE TYPE "SubscriptionFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "category" "SubscriptionCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "frequency" "SubscriptionFrequency" NOT NULL DEFAULT 'MONTHLY';

-- Backfill frequency from existing recurrence rules
UPDATE "Subscription" SET "frequency" = CASE
  WHEN upper("recurrenceRule") LIKE '%FREQ=WEEKLY%' THEN 'WEEKLY'::"SubscriptionFrequency"
  WHEN upper("recurrenceRule") LIKE '%FREQ=YEARLY%' THEN 'YEARLY'::"SubscriptionFrequency"
  WHEN upper("recurrenceRule") LIKE '%FREQ=MONTHLY%' AND upper("recurrenceRule") LIKE '%INTERVAL=3%' THEN 'QUARTERLY'::"SubscriptionFrequency"
  ELSE 'MONTHLY'::"SubscriptionFrequency"
END
WHERE "recurrenceRule" IS NOT NULL;
