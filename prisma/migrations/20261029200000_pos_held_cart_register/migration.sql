-- AlterTable
ALTER TABLE "pos_held_cart" ADD COLUMN     "registerId" TEXT;

-- AddForeignKey
ALTER TABLE "pos_held_cart" ADD CONSTRAINT "pos_held_cart_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "cash_register"("id") ON DELETE SET NULL ON UPDATE CASCADE;

