CREATE TYPE "HomeTopicType" AS ENUM (
  'WEEKEND_GATHERING',
  'QUICK_AFTER_WORK',
  'HOME_STYLE',
  'ONE_PERSON',
  'BREAKFAST',
  'LIGHT_DINNER'
);

CREATE TABLE "home_topics" (
  "id" SERIAL NOT NULL,
  "title" VARCHAR(20) NOT NULL,
  "sub_title" VARCHAR(40),
  "rec_type" "HomeTopicType" NOT NULL,
  "issue_no" INTEGER NOT NULL,
  "description" VARCHAR(120) NOT NULL,
  "cover_image_url" VARCHAR(512),
  "published_at" TIMESTAMPTZ(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "home_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "home_topic_items" (
  "id" SERIAL NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "recipe_id" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "home_topic_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "home_topics_issue_no_key" ON "home_topics"("issue_no");
CREATE INDEX "home_topics_published_at_id_idx" ON "home_topics"("published_at", "id");
CREATE UNIQUE INDEX "home_topic_items_topic_id_recipe_id_key" ON "home_topic_items"("topic_id", "recipe_id");
CREATE UNIQUE INDEX "home_topic_items_topic_id_sort_order_key" ON "home_topic_items"("topic_id", "sort_order");
CREATE INDEX "home_topic_items_topic_id_sort_order_id_idx" ON "home_topic_items"("topic_id", "sort_order", "id");

ALTER TABLE "home_topic_items"
  ADD CONSTRAINT "home_topic_items_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "home_topics"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "home_topic_items"
  ADD CONSTRAINT "home_topic_items_recipe_id_fkey"
  FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

UPDATE "home_feature_board_cards"
SET "target_value" = '/pages_home/topic/index',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "placement" = 'SIDE_TOP'
  AND "target_value" = '/pages_recipe/list/index';
