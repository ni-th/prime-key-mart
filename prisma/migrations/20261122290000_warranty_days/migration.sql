-- Warranty length in days instead of months (so 7-day plans are possible).
-- Renamed (not dropped) so existing values survive, then converted.
ALTER TABLE "WarrantyPlan" RENAME COLUMN "months" TO "days";
UPDATE "WarrantyPlan"
   SET "days" = CASE WHEN "days" % 12 = 0 THEN ("days" / 12) * 365 ELSE "days" * 30 END
 WHERE "days" IS NOT NULL;

ALTER TABLE "OrderItem" RENAME COLUMN "warrantyMonths" TO "warrantyDays";
UPDATE "OrderItem"
   SET "warrantyDays" = CASE WHEN "warrantyDays" % 12 = 0 THEN ("warrantyDays" / 12) * 365 ELSE "warrantyDays" * 30 END
 WHERE "warrantyDays" IS NOT NULL;
