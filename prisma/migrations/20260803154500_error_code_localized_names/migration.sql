-- Keep localized error names separate from the optional default message.
ALTER TABLE "error_codes"
  ADD COLUMN "name_vi" TEXT,
  ADD COLUMN "name_en" TEXT,
  ALTER COLUMN "default_message" DROP NOT NULL;

-- Preserve existing configured labels when upgrading older databases.
UPDATE "error_codes"
SET
  "name_vi" = COALESCE(NULLIF(BTRIM("name_vi"), ''), "default_message"),
  "name_en" = COALESCE(NULLIF(BTRIM("name_en"), ''), "default_message")
WHERE "default_message" IS NOT NULL;
