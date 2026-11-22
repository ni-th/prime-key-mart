-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "freeCheckHours" INTEGER NOT NULL DEFAULT 24;

-- AlterTable
ALTER TABLE "WarrantyClaim" ADD COLUMN     "coverage" TEXT NOT NULL DEFAULT 'WARRANTY',
ADD COLUMN     "refundCents" INTEGER;

