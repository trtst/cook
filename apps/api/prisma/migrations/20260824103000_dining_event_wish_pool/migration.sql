CREATE TABLE "dining_event_wish_items" (
    "id" SERIAL NOT NULL,
    "dining_event_id" INTEGER NOT NULL,
    "recipe_id" INTEGER,
    "recipe_version_id" INTEGER NOT NULL,
    "suggested_by_user_id" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dining_event_wish_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dining_event_wish_supports" (
    "id" SERIAL NOT NULL,
    "wish_item_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dining_event_wish_supports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dining_event_wish_items_dining_event_id_recipe_version_id_key"
ON "dining_event_wish_items"("dining_event_id", "recipe_version_id");

CREATE INDEX "dining_event_wish_items_dining_event_id_created_at_idx"
ON "dining_event_wish_items"("dining_event_id", "created_at" DESC);

CREATE INDEX "dining_event_wish_items_suggested_by_user_id_created_at_idx"
ON "dining_event_wish_items"("suggested_by_user_id", "created_at" DESC);

CREATE INDEX "dining_event_wish_items_recipe_id_idx"
ON "dining_event_wish_items"("recipe_id");

CREATE INDEX "dining_event_wish_items_recipe_version_id_idx"
ON "dining_event_wish_items"("recipe_version_id");

CREATE UNIQUE INDEX "dining_event_wish_supports_wish_item_id_user_id_key"
ON "dining_event_wish_supports"("wish_item_id", "user_id");

CREATE INDEX "dining_event_wish_supports_user_id_created_at_idx"
ON "dining_event_wish_supports"("user_id", "created_at" DESC);

CREATE INDEX "dining_event_wish_supports_wish_item_id_created_at_idx"
ON "dining_event_wish_supports"("wish_item_id", "created_at" DESC);

ALTER TABLE "dining_event_wish_items"
ADD CONSTRAINT "dining_event_wish_items_dining_event_id_fkey"
FOREIGN KEY ("dining_event_id") REFERENCES "dining_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dining_event_wish_items"
ADD CONSTRAINT "dining_event_wish_items_recipe_id_fkey"
FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dining_event_wish_items"
ADD CONSTRAINT "dining_event_wish_items_recipe_version_id_fkey"
FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dining_event_wish_items"
ADD CONSTRAINT "dining_event_wish_items_suggested_by_user_id_fkey"
FOREIGN KEY ("suggested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dining_event_wish_supports"
ADD CONSTRAINT "dining_event_wish_supports_wish_item_id_fkey"
FOREIGN KEY ("wish_item_id") REFERENCES "dining_event_wish_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dining_event_wish_supports"
ADD CONSTRAINT "dining_event_wish_supports_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
