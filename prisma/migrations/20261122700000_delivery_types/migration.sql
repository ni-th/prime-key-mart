-- AlterTable
ALTER TABLE "LicenseKey" ADD COLUMN     "extraActivations" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "activationSteps" TEXT,
ADD COLUMN     "deliveryType" TEXT NOT NULL DEFAULT 'KEY';

-- CreateTable
CREATE TABLE "ActivationRequest" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "confirmationId" TEXT,
    "note" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivationRequest_status_createdAt_idx" ON "ActivationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ActivationRequest_keyId_idx" ON "ActivationRequest"("keyId");

-- AddForeignKey
ALTER TABLE "ActivationRequest" ADD CONSTRAINT "ActivationRequest_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "LicenseKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

