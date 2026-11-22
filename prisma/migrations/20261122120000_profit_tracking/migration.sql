-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "feeCents" INTEGER;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "unitCostCents" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costCents" INTEGER,
ADD COLUMN     "costCurrency" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "gatewayFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

