-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "priceLkrCents" INTEGER;

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "usdToLkrRate" DOUBLE PRECISION,
    "lkrMarginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

