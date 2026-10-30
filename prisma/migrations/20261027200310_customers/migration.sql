-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "StatusColor" AS ENUM ('DEFAULT', 'ACCENT', 'SUCCESS', 'WARNING', 'DANGER');

-- CreateTable
CREATE TABLE "customer_status" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" "StatusColor" NOT NULL DEFAULT 'DEFAULT',
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'PERSON',
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "jobTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "taxId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "statusId" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_note" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_status_organizationId_position_idx" ON "customer_status"("organizationId", "position");

-- CreateIndex
CREATE INDEX "customer_organizationId_updatedAt_idx" ON "customer"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "customer_organizationId_name_idx" ON "customer"("organizationId", "name");

-- CreateIndex
CREATE INDEX "customer_organizationId_statusId_idx" ON "customer"("organizationId", "statusId");

-- CreateIndex
CREATE INDEX "customer_organizationId_ownerId_idx" ON "customer"("organizationId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_organizationId_email_key" ON "customer"("organizationId", "email");

-- CreateIndex
CREATE INDEX "customer_note_customerId_createdAt_idx" ON "customer_note"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_note_organizationId_idx" ON "customer_note"("organizationId");

-- AddForeignKey
ALTER TABLE "customer_status" ADD CONSTRAINT "customer_status_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "customer_status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_note" ADD CONSTRAINT "customer_note_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_note" ADD CONSTRAINT "customer_note_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_note" ADD CONSTRAINT "customer_note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default customer statuses for existing organizations (new ones get them on creation).
INSERT INTO "customer_status" ("id", "organizationId", "label", "color", "position", "updatedAt")
SELECT gen_random_uuid()::text, o."id", s."label", s."color"::"StatusColor", s."position", CURRENT_TIMESTAMP
FROM "organization" o
CROSS JOIN (VALUES
    ('Prospecto', 'ACCENT', 0),
    ('Activo', 'SUCCESS', 1),
    ('Inactivo', 'DEFAULT', 2)
) AS s("label", "color", "position");

-- Grant the new `customer` resource to the default roles of existing organizations.
UPDATE "organizationRole"
SET "permission" = ("permission"::jsonb || '{"customer":["read","create","update","delete"]}'::jsonb)::text
WHERE "role" = 'admin' AND NOT ("permission"::jsonb ? 'customer');

UPDATE "organizationRole"
SET "permission" = ("permission"::jsonb || '{"customer":["read","create","update"]}'::jsonb)::text
WHERE "role" = 'member' AND NOT ("permission"::jsonb ? 'customer');
