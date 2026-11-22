-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "lowStockThreshold" INTEGER,
ADD COLUMN     "stockAlertState" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "alertEmails" TEXT,
ADD COLUMN     "alertFailedDelivery" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "alertLowStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "alertNewOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "alertOutOfStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "alertPaymentProblem" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertLog_createdAt_idx" ON "AlertLog"("createdAt");

-- CreateIndex
CREATE INDEX "AlertLog_dedupeKey_createdAt_idx" ON "AlertLog"("dedupeKey", "createdAt");

