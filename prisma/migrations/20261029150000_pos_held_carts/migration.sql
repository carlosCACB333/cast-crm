-- CreateTable
CREATE TABLE "pos_held_cart" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "note" TEXT,
    "customerId" TEXT,
    "sourceId" TEXT,
    "lines" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_held_cart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_held_cart_organizationId_createdAt_idx" ON "pos_held_cart"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "pos_held_cart" ADD CONSTRAINT "pos_held_cart_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_held_cart" ADD CONSTRAINT "pos_held_cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_held_cart" ADD CONSTRAINT "pos_held_cart_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sales_document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_held_cart" ADD CONSTRAINT "pos_held_cart_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

