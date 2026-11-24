-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "maxPaymentLkrCents" INTEGER,
ADD COLUMN     "usdPaymentsEnabled" BOOLEAN NOT NULL DEFAULT true;
