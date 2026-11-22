-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('ALL', 'CATEGORIES', 'PRODUCTS');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "discountName" TEXT,
ADD COLUMN     "discountPercent" DOUBLE PRECISION,
ADD COLUMN     "listPriceCents" INTEGER;

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "scope" "DiscountScope" NOT NULL DEFAULT 'ALL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DiscountToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DiscountToProduct_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CategoryToDiscount" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToDiscount_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Discount_active_idx" ON "Discount"("active");

-- CreateIndex
CREATE INDEX "_DiscountToProduct_B_index" ON "_DiscountToProduct"("B");

-- CreateIndex
CREATE INDEX "_CategoryToDiscount_B_index" ON "_CategoryToDiscount"("B");

-- AddForeignKey
ALTER TABLE "_DiscountToProduct" ADD CONSTRAINT "_DiscountToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DiscountToProduct" ADD CONSTRAINT "_DiscountToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToDiscount" ADD CONSTRAINT "_CategoryToDiscount_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToDiscount" ADD CONSTRAINT "_CategoryToDiscount_B_fkey" FOREIGN KEY ("B") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

