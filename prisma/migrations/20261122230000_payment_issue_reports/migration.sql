-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "issueNote" TEXT,
ADD COLUMN     "issuePaymentRef" TEXT,
ADD COLUMN     "issueReportedAt" TIMESTAMP(3),
ADD COLUMN     "issueResolution" TEXT,
ADD COLUMN     "issueResolvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_issueReportedAt_idx" ON "Order"("issueReportedAt");

