-- CreateEnum
CREATE TYPE "SalesDocumentType" AS ENUM ('QUOTE', 'ORDER', 'DELIVERY_NOTE', 'INVOICE');

-- CreateEnum
CREATE TYPE "SalesDocumentStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONFIRMED', 'DELIVERED', 'ISSUED', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "salesDefaultTaxRate" DECIMAL(5,2),
ADD COLUMN     "salesDefaultTerms" TEXT,
ADD COLUMN     "salesDeliveryNotePrefix" TEXT NOT NULL DEFAULT 'ALB-',
ADD COLUMN     "salesInvoiceDueDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "salesInvoicePrefix" TEXT NOT NULL DEFAULT 'FAC-',
ADD COLUMN     "salesOrderPrefix" TEXT NOT NULL DEFAULT 'PED-',
ADD COLUMN     "salesQuotePrefix" TEXT NOT NULL DEFAULT 'PRE-',
ADD COLUMN     "salesQuoteValidityDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "salesStockOnDelivery" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "sales_document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "SalesDocumentType" NOT NULL,
    "status" "SalesDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "number" TEXT,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerTaxId" TEXT,
    "customerEmail" TEXT,
    "customerAddress" TEXT,
    "reference" TEXT,
    "terms" TEXT,
    "internalNotes" TEXT,
    "currency" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stockApplied" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_document_line" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "productId" TEXT,
    "serviceId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sales_document_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidOn" DATE NOT NULL,
    "method" TEXT NOT NULL,
    "note" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_counter" (
    "organizationId" TEXT NOT NULL,
    "type" "SalesDocumentType" NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sales_counter_pkey" PRIMARY KEY ("organizationId","type","year")
);

-- CreateIndex
CREATE INDEX "sales_document_organizationId_type_updatedAt_idx" ON "sales_document"("organizationId", "type", "updatedAt");

-- CreateIndex
CREATE INDEX "sales_document_organizationId_type_status_idx" ON "sales_document"("organizationId", "type", "status");

-- CreateIndex
CREATE INDEX "sales_document_organizationId_type_issueDate_idx" ON "sales_document"("organizationId", "type", "issueDate");

-- CreateIndex
CREATE INDEX "sales_document_customerId_idx" ON "sales_document"("customerId");

-- CreateIndex
CREATE INDEX "sales_document_sourceId_idx" ON "sales_document"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_document_organizationId_type_number_key" ON "sales_document"("organizationId", "type", "number");

-- CreateIndex
CREATE INDEX "sales_document_line_documentId_position_idx" ON "sales_document_line"("documentId", "position");

-- CreateIndex
CREATE INDEX "sales_document_line_organizationId_idx" ON "sales_document_line"("organizationId");

-- CreateIndex
CREATE INDEX "sales_document_line_productId_idx" ON "sales_document_line"("productId");

-- CreateIndex
CREATE INDEX "sales_document_line_serviceId_idx" ON "sales_document_line"("serviceId");

-- CreateIndex
CREATE INDEX "sales_payment_documentId_paidOn_idx" ON "sales_payment"("documentId", "paidOn");

-- CreateIndex
CREATE INDEX "sales_payment_organizationId_idx" ON "sales_payment"("organizationId");

-- AddForeignKey
ALTER TABLE "sales_document" ADD CONSTRAINT "sales_document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document" ADD CONSTRAINT "sales_document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document" ADD CONSTRAINT "sales_document_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sales_document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document" ADD CONSTRAINT "sales_document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document" ADD CONSTRAINT "sales_document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document_line" ADD CONSTRAINT "sales_document_line_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document_line" ADD CONSTRAINT "sales_document_line_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "sales_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document_line" ADD CONSTRAINT "sales_document_line_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document_line" ADD CONSTRAINT "sales_document_line_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_payment" ADD CONSTRAINT "sales_payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_payment" ADD CONSTRAINT "sales_payment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "sales_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_payment" ADD CONSTRAINT "sales_payment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_counter" ADD CONSTRAINT "sales_counter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
