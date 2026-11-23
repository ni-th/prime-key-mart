-- AlterTable
ALTER TABLE "User" ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

-- Backfill from the existing full name: first word / the rest.
UPDATE "User"
SET "firstName" = split_part(btrim("name"), ' ', 1),
    "lastName"  = NULLIF(btrim(substr(btrim("name"), length(split_part(btrim("name"), ' ', 1)) + 1)), '')
WHERE "name" IS NOT NULL AND btrim("name") <> '';

-- CreateTable
CREATE TABLE "SignupCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignupCode_email_key" ON "SignupCode"("email");
