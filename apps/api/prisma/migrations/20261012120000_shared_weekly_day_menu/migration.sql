BEGIN;

CREATE TYPE "HomeTopicWeekday" AS ENUM (
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
);

CREATE TYPE "HomeTopicStatus_new" AS ENUM ('DRAFT', 'PUBLISHED', 'UNLISTED');

ALTER TABLE "home_topics"
  ADD COLUMN "period_start_date" DATE,
  ADD COLUMN "scheduled_publish_at" TIMESTAMPTZ(3);

ALTER TABLE "home_topic_items"
  ADD COLUMN "weekday" "HomeTopicWeekday",
  ADD COLUMN "todo_dismissed_at" TIMESTAMPTZ(3);

UPDATE "home_topic_items"
   SET "weekday" = 'MONDAY'::"HomeTopicWeekday";

ALTER TABLE "home_topic_items"
  ALTER COLUMN "weekday" SET NOT NULL;

WITH "topic_dates" AS (
  SELECT
    "id",
    (COALESCE("published_at", "created_at") AT TIME ZONE 'Asia/Shanghai')::date AS "source_date"
  FROM "home_topics"
)
UPDATE "home_topics" AS "topic"
   SET "period_start_date" = "topic_dates"."source_date"
     + (8 - EXTRACT(ISODOW FROM "topic_dates"."source_date")::integer)
  FROM "topic_dates"
 WHERE "topic"."id" = "topic_dates"."id";

DO $$
DECLARE
  "conflicts" text;
BEGIN
  SELECT string_agg(
           "period_start_date"::text || ' => [' || array_to_string("topic_ids", ',') || ']',
           '; '
         )
    INTO "conflicts"
    FROM (
      SELECT "period_start_date", array_agg("id" ORDER BY "id") AS "topic_ids"
        FROM "home_topics"
       GROUP BY "period_start_date"
      HAVING COUNT(*) > 1
    ) AS "duplicate_periods";

  IF "conflicts" IS NOT NULL THEN
    RAISE EXCEPTION 'HomeTopic period mapping conflict; review topic IDs before migrating: %', "conflicts";
  END IF;
END $$;

ALTER TABLE "home_topics"
  ALTER COLUMN "period_start_date" SET NOT NULL,
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "home_topics"
  ALTER COLUMN "status" TYPE "HomeTopicStatus_new"
  USING (
    CASE "status"::text
      WHEN 'LISTED' THEN 'PUBLISHED'
      ELSE "status"::text
    END
  )::"HomeTopicStatus_new";

DROP TYPE "HomeTopicStatus";
ALTER TYPE "HomeTopicStatus_new" RENAME TO "HomeTopicStatus";

ALTER TABLE "home_topics"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ALTER COLUMN "published_at" DROP NOT NULL;

UPDATE "home_topics"
   SET "published_at" = NULL
 WHERE "status" <> 'PUBLISHED';

DROP INDEX "home_topics_status_published_at_id_idx";
DROP INDEX "home_topic_items_topic_id_sort_order_key";

CREATE UNIQUE INDEX "home_topics_period_start_date_key"
  ON "home_topics"("period_start_date");
CREATE INDEX "home_topics_status_period_start_date_issue_no_idx"
  ON "home_topics"("status", "period_start_date", "issue_no");
CREATE INDEX "home_topics_status_scheduled_publish_at_idx"
  ON "home_topics"("status", "scheduled_publish_at");
CREATE UNIQUE INDEX "home_topic_items_topic_id_weekday_sort_order_key"
  ON "home_topic_items"("topic_id", "weekday", "sort_order");

COMMIT;
