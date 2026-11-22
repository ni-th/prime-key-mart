-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "warrantyCents" INTEGER,
ADD COLUMN     "warrantyExpiresAt" TIMESTAMP(3),
ADD COLUMN     "warrantyMonths" INTEGER,
ADD COLUMN     "warrantyName" TEXT,
ADD COLUMN     "warrantyPlanId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "warrantyMode" TEXT NOT NULL DEFAULT 'STORE';

-- CreateTable
CREATE TABLE "WarrantyPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "months" INTEGER,
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductWarranty" (
    "productId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "percent" DOUBLE PRECISION,

    CONSTRAINT "ProductWarranty_pkey" PRIMARY KEY ("productId","planId")
);

-- CreateIndex
CREATE INDEX "ProductWarranty_planId_idx" ON "ProductWarranty"("planId");

-- AddForeignKey
ALTER TABLE "ProductWarranty" ADD CONSTRAINT "ProductWarranty_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductWarranty" ADD CONSTRAINT "ProductWarranty_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WarrantyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

