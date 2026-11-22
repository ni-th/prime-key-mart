-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "warrantyMode" SET DEFAULT 'NONE';


-- Warranty is opt-in per product: products that were on the old default
-- ("STORE", before any plans existed) start with no warranty.
UPDATE "Product" SET "warrantyMode" = 'NONE' WHERE "warrantyMode" = 'STORE';
