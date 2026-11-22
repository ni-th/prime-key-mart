-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "bannerMobileUrl" TEXT,
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "showInHeader" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "visible" BOOLEAN NOT NULL DEFAULT true;

