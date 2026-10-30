-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('BACKOFFICE', 'POS');

-- CreateEnum
CREATE TYPE "PaymentMethodKind" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "posTicketPrefix" TEXT NOT NULL DEFAULT 'TCK-',
ADD COLUMN     "posWalkInCustomerName" TEXT NOT NULL DEFAULT 'Cliente de mostrador';

-- AlterTable
ALTER TABLE "sales_counter" DROP CONSTRAINT "sales_counter_pkey",
ADD COLUMN     "series" TEXT NOT NULL DEFAULT '',
ADD CONSTRAINT "sales_counter_pkey" PRIMARY KEY ("organizationId", "type", "series", "year");

-- AlterTable
ALTER TABLE "sales_document" ADD COLUMN     "cashSessionId" TEXT,
ADD COLUMN     "channel" "SalesChannel" NOT NULL DEFAULT 'BACKOFFICE';

-- AlterTable (the payment method moves to "payment_method" below)
ALTER TABLE "sales_payment" ADD COLUMN     "cashSessionId" TEXT,
ADD COLUMN     "paymentMethodId" TEXT,
ADD COLUMN     "tendered" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "payment_method" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PaymentMethodKind" NOT NULL DEFAULT 'OTHER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_register" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_session" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingAmount" DECIMAL(14,2) NOT NULL,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "expectedCash" DECIMAL(14,2),
    "countedCash" DECIMAL(14,2),
    "difference" DECIMAL(14,2),
    "closingNotes" TEXT,

    CONSTRAINT "cash_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movement_pkey" PRIMARY KEY ("id")
);

-- Default payment methods of every existing organization (new ones get them
-- when created). The legacy codes keep the payments they had.
CREATE TEMPORARY TABLE "_default_payment_method" ("code" TEXT, "name" TEXT, "kind" "PaymentMethodKind", "position" INTEGER);
INSERT INTO "_default_payment_method" VALUES
  ('cash', 'Efectivo', 'CASH', 0),
  ('card', 'Tarjeta', 'CARD', 1),
  ('transfer', 'Transferencia', 'TRANSFER', 2),
  ('direct_debit', 'Domiciliación', 'TRANSFER', 3),
  ('other', 'Otro', 'OTHER', 4);

INSERT INTO "payment_method" ("id", "organizationId", "name", "kind", "position", "updatedAt")
SELECT md5(o."id" || d."code"), o."id", d."name", d."kind", d."position", CURRENT_TIMESTAMP
FROM "organization" o CROSS JOIN "_default_payment_method" d;

-- "check" was a legacy code without a default; it only exists where used.
INSERT INTO "payment_method" ("id", "organizationId", "name", "kind", "position", "updatedAt")
SELECT DISTINCT md5(p."organizationId" || 'check'), p."organizationId", 'Cheque', 'OTHER'::"PaymentMethodKind", 5, CURRENT_TIMESTAMP
FROM "sales_payment" p WHERE p."method" = 'check';

UPDATE "sales_payment"
SET "paymentMethodId" = md5("organizationId" || CASE WHEN "method" IN ('cash', 'card', 'transfer', 'direct_debit', 'check') THEN "method" ELSE 'other' END);

DROP TABLE "_default_payment_method";

ALTER TABLE "sales_payment" DROP COLUMN "method",
ALTER COLUMN "paymentMethodId" SET NOT NULL;

-- A register and a person have at most one open session at a time.
CREATE UNIQUE INDEX "cash_session_open_register_key" ON "cash_session"("registerId") WHERE "status" = 'OPEN';
CREATE UNIQUE INDEX "cash_session_open_user_key" ON "cash_session"("organizationId", "openedById") WHERE "status" = 'OPEN';

-- CreateIndex
CREATE INDEX "payment_method_organizationId_position_idx" ON "payment_method"("organizationId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "cash_register_organizationId_name_key" ON "cash_register"("organizationId", "name");

-- CreateIndex
CREATE INDEX "cash_session_organizationId_openedAt_idx" ON "cash_session"("organizationId", "openedAt");

-- CreateIndex
CREATE INDEX "cash_session_registerId_status_idx" ON "cash_session"("registerId", "status");

-- CreateIndex
CREATE INDEX "cash_movement_sessionId_createdAt_idx" ON "cash_movement"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "cash_movement_organizationId_idx" ON "cash_movement"("organizationId");

-- CreateIndex
CREATE INDEX "sales_document_cashSessionId_idx" ON "sales_document"("cashSessionId");

-- CreateIndex
CREATE INDEX "sales_payment_cashSessionId_idx" ON "sales_payment"("cashSessionId");

-- CreateIndex
CREATE INDEX "sales_payment_paymentMethodId_idx" ON "sales_payment"("paymentMethodId");

-- AddForeignKey
ALTER TABLE "sales_document" ADD CONSTRAINT "sales_document_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_session"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_payment" ADD CONSTRAINT "sales_payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_method"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_payment" ADD CONSTRAINT "sales_payment_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_session"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_method" ADD CONSTRAINT "payment_method_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register" ADD CONSTRAINT "cash_register_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "cash_register"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cash_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

