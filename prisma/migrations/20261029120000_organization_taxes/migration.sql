-- The default tax rate moves from the sales settings to the organization
-- settings, keeping its value.
ALTER TABLE "organization" RENAME COLUMN "salesDefaultTaxRate" TO "defaultTaxRate";

-- Tax on the total of sales documents and tickets.
ALTER TABLE "organization" ADD COLUMN     "totalTaxEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalTaxName" TEXT NOT NULL DEFAULT 'Impuesto sobre el total',
ADD COLUMN     "totalTaxRate" DECIMAL(5,2);

ALTER TABLE "sales_document" ADD COLUMN     "totalTaxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalTaxName" TEXT,
ADD COLUMN     "totalTaxRate" DECIMAL(5,2);
