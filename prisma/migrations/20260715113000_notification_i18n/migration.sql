ALTER TABLE "notification_templates"
  ADD COLUMN "title_template_vi" TEXT,
  ADD COLUMN "message_template_vi" TEXT,
  ADD COLUMN "title_template_en" TEXT,
  ADD COLUMN "message_template_en" TEXT;

ALTER TABLE "notification_events"
  ADD COLUMN "title_vi" TEXT,
  ADD COLUMN "message_vi" TEXT,
  ADD COLUMN "title_en" TEXT,
  ADD COLUMN "message_en" TEXT,
  ADD COLUMN "payload_json" JSONB;

UPDATE "notification_templates"
SET
  "title_template_en" = "title_template",
  "message_template_en" = "message_template"
WHERE "title_template_en" IS NULL
  AND "message_template_en" IS NULL;

UPDATE "notification_events"
SET
  "title_en" = "title",
  "message_en" = "message"
WHERE "title_en" IS NULL
  AND "message_en" IS NULL;
