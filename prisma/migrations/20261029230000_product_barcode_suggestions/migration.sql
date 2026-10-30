-- AlterTable
ALTER TABLE "product" ADD COLUMN     "copiedCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "product_barcode_idx" ON "product"("barcode");
