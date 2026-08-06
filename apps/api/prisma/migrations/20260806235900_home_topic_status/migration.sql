CREATE TYPE "HomeTopicStatus" AS ENUM (
  'LISTED',
  'UNLISTED'
);

ALTER TABLE "home_topics"
  ADD COLUMN "status" "HomeTopicStatus";

UPDATE "home_topics"
SET "status" = 'LISTED'
WHERE "status" IS NULL;

ALTER TABLE "home_topics"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'UNLISTED';

DROP INDEX "home_topics_published_at_id_idx";

CREATE INDEX "home_topics_status_published_at_id_idx"
ON "home_topics"("status", "published_at", "id");
