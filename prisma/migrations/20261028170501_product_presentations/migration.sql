-- AlterTable
ALTER TABLE "product_stock_movement" ADD COLUMN     "presentationLabel" TEXT,
ADD COLUMN     "presentationQuantity" DECIMAL(14,3);

-- CreateTable
CREATE TABLE "product_presentation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "factor" DECIMAL(14,3) NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "barcode" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_presentation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_presentation_productId_position_idx" ON "product_presentation"("productId", "position");

-- CreateIndex
CREATE INDEX "product_presentation_organizationId_barcode_idx" ON "product_presentation"("organizationId", "barcode");

-- AddForeignKey
ALTER TABLE "product_presentation" ADD CONSTRAINT "product_presentation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_presentation" ADD CONSTRAINT "product_presentation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
