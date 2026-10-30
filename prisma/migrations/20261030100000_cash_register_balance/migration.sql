-- CreateEnum
CREATE TYPE "CashRegisterEntryType" AS ENUM ('CLOSING', 'ADJUSTMENT', 'DISCREPANCY');

-- AlterTable
ALTER TABLE "cash_register" ADD COLUMN     "cashBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "cash_register_entry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "type" "CashRegisterEntryType" NOT NULL,
    "sessionId" TEXT,
    "balanceBefore" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "countedAmount" DECIMAL(14,2),
    "reason" TEXT,
    "authorId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_register_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_register_entry_registerId_createdAt_idx" ON "cash_register_entry"("registerId", "createdAt");

-- CreateIndex
CREATE INDEX "cash_register_entry_organizationId_type_resolvedAt_idx" ON "cash_register_entry"("organizationId", "type", "resolvedAt");

-- AddForeignKey
ALTER TABLE "cash_register_entry" ADD CONSTRAINT "cash_register_entry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_entry" ADD CONSTRAINT "cash_register_entry_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "cash_register"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_entry" ADD CONSTRAINT "cash_register_entry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cash_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_entry" ADD CONSTRAINT "cash_register_entry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Registers keep the cash counted at their last closing.
UPDATE "cash_register" AS r
SET "cashBalance" = last."countedCash"
FROM (
    SELECT DISTINCT ON ("registerId") "registerId", "countedCash"
    FROM "cash_session"
    WHERE "status" = 'CLOSED' AND "countedCash" IS NOT NULL
    ORDER BY "registerId", "closedAt" DESC
) AS last
WHERE last."registerId" = r."id";
