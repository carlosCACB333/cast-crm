-- AlterTable
ALTER TABLE "sales_document_line" ADD COLUMN     "presentationId" TEXT,
ADD COLUMN     "presentationLabel" TEXT,
ADD COLUMN     "unitFactor" DECIMAL(14,3) NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "sales_document_line_presentationId_idx" ON "sales_document_line"("presentationId");

-- AddForeignKey
ALTER TABLE "sales_document_line" ADD CONSTRAINT "sales_document_line_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "product_presentation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

