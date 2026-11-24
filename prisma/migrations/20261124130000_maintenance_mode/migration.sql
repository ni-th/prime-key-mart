-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "maintenanceMessage" TEXT,
ADD COLUMN     "maintenanceMode" BOOLEAN NOT NULL DEFAULT false;
