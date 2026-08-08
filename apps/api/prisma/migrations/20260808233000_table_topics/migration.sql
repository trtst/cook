CREATE TYPE "TableTopicStatus" AS ENUM (
  'LISTED',
  'UNLISTED'
);

CREATE TYPE "TableTopicTargetType" AS ENUM (
  'PAGE',
  'WEB_VIEW'
);

CREATE TABLE "table_topics" (
  "id" SERIAL NOT NULL,
  "title" VARCHAR(30) NOT NULL,
  "summary" VARCHAR(240) NOT NULL,
  "status" "TableTopicStatus" NOT NULL DEFAULT 'UNLISTED',
  "target_type" "TableTopicTargetType" NOT NULL,
  "target_value" VARCHAR(512),
  "cover_image_url" VARCHAR(512),
  "activity_at" TIMESTAMPTZ(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "table_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "table_topic_participants" (
  "id" SERIAL NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "table_topic_participants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "table_topics_status_activity_at_id_idx"
ON "table_topics"("status", "activity_at", "id");

CREATE UNIQUE INDEX "table_topic_participants_topic_id_user_id_key"
ON "table_topic_participants"("topic_id", "user_id");

CREATE INDEX "table_topic_participants_user_id_created_at_idx"
ON "table_topic_participants"("user_id", "created_at");

CREATE INDEX "table_topic_participants_topic_id_created_at_id_idx"
ON "table_topic_participants"("topic_id", "created_at", "id");

ALTER TABLE "table_topic_participants"
  ADD CONSTRAINT "table_topic_participants_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "table_topics"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "table_topic_participants"
  ADD CONSTRAINT "table_topic_participants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

UPDATE "home_feature_board_cards"
SET "target_type" = 'PAGE',
    "target_value" = '/pages_home/table-topic/index',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "placement" = 'SIDE_BOTTOM'
  AND "target_type" = 'WEB_VIEW'
  AND "target_value" = 'https://www.trtst.com/scenes';
