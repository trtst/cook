ALTER TABLE "site_contents"
  ADD COLUMN "scheduled_publish_at" TIMESTAMPTZ(3);

CREATE INDEX "site_contents_type_status_scheduled_publish_at_idx"
  ON "site_contents"("type", "status", "scheduled_publish_at");
