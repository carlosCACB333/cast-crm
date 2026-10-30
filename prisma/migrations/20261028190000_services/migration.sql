-- CreateTable
CREATE TABLE "service_category" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#71717a',
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "categoryId" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'hour',
    "price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(14,2),
    "taxRate" DECIMAL(5,2),
    "durationMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_category_organizationId_position_idx" ON "service_category"("organizationId", "position");

-- CreateIndex
CREATE INDEX "service_organizationId_updatedAt_idx" ON "service"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "service_organizationId_name_idx" ON "service"("organizationId", "name");

-- CreateIndex
CREATE INDEX "service_organizationId_categoryId_idx" ON "service"("organizationId", "categoryId");

-- CreateIndex
CREATE INDEX "service_organizationId_isActive_idx" ON "service"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "service_organizationId_code_key" ON "service"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "service_category" ADD CONSTRAINT "service_category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: every existing organization gets the default services category, as
-- new organizations do when they are created.
INSERT INTO "service_category" ("id", "organizationId", "name", "color", "position", "updatedAt")
SELECT 'svc_cat_' || md5(random()::text || "id"), "id", 'General', '#3b82f6', 0, CURRENT_TIMESTAMP
FROM "organization";

-- Data: services stored as products move to their own table. Product
-- categories are not carried over because services have their own.
INSERT INTO "service" ("id", "organizationId", "name", "code", "description", "unit", "price", "cost", "taxRate", "isActive", "tags", "createdById", "createdAt", "updatedAt")
SELECT "id", "organizationId", "name", "sku", "description",
  CASE WHEN "unit" IN ('hour', 'day', 'month', 'service') THEN "unit" ELSE 'service' END,
  "price", "cost", "taxRate", "isActive", "tags", "createdById", "createdAt", "updatedAt"
FROM "product"
WHERE "type" = 'SERVICE';

DELETE FROM "product" WHERE "type" = 'SERVICE';

-- AlterTable
ALTER TABLE "product" DROP COLUMN "type";

-- DropEnum
DROP TYPE "ProductType";
