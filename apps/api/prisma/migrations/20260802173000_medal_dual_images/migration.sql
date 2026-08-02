ALTER TABLE "medal_templates"
  RENAME COLUMN "image_updated_at" TO "earned_image_updated_at";

ALTER TABLE "medal_templates"
  ADD COLUMN "locked_image_updated_at" TIMESTAMPTZ(3);
