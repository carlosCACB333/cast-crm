-- Barcodes must identify a single product or presentation per organization.
-- Existing duplicates keep the barcode on the oldest record only.
UPDATE "product" AS p
SET "barcode" = NULL
FROM (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "organizationId", "barcode" ORDER BY "createdAt", "id"
  ) AS rn
  FROM "product"
  WHERE "barcode" IS NOT NULL
) AS d
WHERE p."id" = d."id" AND d.rn > 1;

UPDATE "product_presentation" AS pp
SET "barcode" = NULL
FROM (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "organizationId", "barcode" ORDER BY "createdAt", "id"
  ) AS rn
  FROM "product_presentation"
  WHERE "barcode" IS NOT NULL
) AS d
WHERE pp."id" = d."id" AND d.rn > 1;

-- A presentation cannot reuse a product barcode either.
UPDATE "product_presentation" AS pp
SET "barcode" = NULL
FROM "product" AS p
WHERE p."organizationId" = pp."organizationId" AND p."barcode" = pp."barcode";

-- DropIndex
DROP INDEX "product_presentation_organizationId_barcode_idx";

-- CreateIndex
CREATE UNIQUE INDEX "product_organizationId_barcode_key" ON "product"("organizationId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "product_presentation_organizationId_barcode_key" ON "product_presentation"("organizationId", "barcode");
