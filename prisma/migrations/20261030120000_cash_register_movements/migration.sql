-- CreateEnum
CREATE TYPE "CashRegisterMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "cash_register_movement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "type" "CashRegisterMovementType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "cash_register_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_discrepancy_report" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "expectedAmount" DECIMAL(14,2) NOT NULL,
    "countedAmount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "authorId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "cash_discrepancy_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_register_movement_registerId_createdAt_idx" ON "cash_register_movement"("registerId", "createdAt");

-- CreateIndex
CREATE INDEX "cash_register_movement_organizationId_idx" ON "cash_register_movement"("organizationId");

-- CreateIndex
CREATE INDEX "cash_discrepancy_report_registerId_createdAt_idx" ON "cash_discrepancy_report"("registerId", "createdAt");

-- CreateIndex
CREATE INDEX "cash_discrepancy_report_organizationId_resolvedAt_idx" ON "cash_discrepancy_report"("organizationId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "cash_register_movement" ADD CONSTRAINT "cash_register_movement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_movement" ADD CONSTRAINT "cash_register_movement_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "cash_register"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_movement" ADD CONSTRAINT "cash_register_movement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_discrepancy_report" ADD CONSTRAINT "cash_discrepancy_report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_discrepancy_report" ADD CONSTRAINT "cash_discrepancy_report_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "cash_register"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_discrepancy_report" ADD CONSTRAINT "cash_discrepancy_report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Move the existing history: adjustments become movements, discrepancies
-- reports. Closings are already recorded in their cash sessions.
INSERT INTO "cash_register_movement" ("id", "organizationId", "registerId", "type", "amount", "balanceAfter", "reason", "authorId", "createdAt")
SELECT "id", "organizationId", "registerId", 'ADJUSTMENT', "balanceAfter" - "balanceBefore", "balanceAfter", COALESCE("reason", ''), "authorId", "createdAt"
FROM "cash_register_entry"
WHERE "type" = 'ADJUSTMENT';

INSERT INTO "cash_discrepancy_report" ("id", "organizationId", "registerId", "expectedAmount", "countedAmount", "reason", "authorId", "resolvedAt", "createdAt")
SELECT "id", "organizationId", "registerId", "balanceBefore", COALESCE("countedAmount", 0), COALESCE("reason", ''), "authorId", "resolvedAt", "createdAt"
FROM "cash_register_entry"
WHERE "type" = 'DISCREPANCY';

-- DropForeignKey
ALTER TABLE "cash_register_entry" DROP CONSTRAINT "cash_register_entry_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "cash_register_entry" DROP CONSTRAINT "cash_register_entry_registerId_fkey";

-- DropForeignKey
ALTER TABLE "cash_register_entry" DROP CONSTRAINT "cash_register_entry_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "cash_register_entry" DROP CONSTRAINT "cash_register_entry_authorId_fkey";

-- DropTable
DROP TABLE "cash_register_entry";

-- DropEnum
DROP TYPE "CashRegisterEntryType";
