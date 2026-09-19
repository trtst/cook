ALTER TABLE "dining_event_participants"
ADD COLUMN "note" VARCHAR(255);

CREATE TABLE "dining_event_participant_bring_recipes" (
    "id" SERIAL NOT NULL,
    "participant_id" INTEGER NOT NULL,
    "recipe_id" INTEGER,
    "recipe_version_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dining_event_participant_bring_recipes_pkey" PRIMARY KEY ("id")
);

INSERT INTO "dining_event_participant_bring_recipes" ("participant_id", "recipe_id", "recipe_version_id")
SELECT "id", "bring_recipe_id", "bring_version_id"
FROM "dining_event_participants"
WHERE "bring_recipe_id" IS NOT NULL AND "bring_version_id" IS NOT NULL;

CREATE UNIQUE INDEX "dining_event_participant_bring_recipes_participant_id_recipe_id_recipe_version_id_key"
ON "dining_event_participant_bring_recipes"("participant_id", "recipe_id", "recipe_version_id");

CREATE INDEX "dining_event_participant_bring_recipes_participant_id_sort_order_id_idx"
ON "dining_event_participant_bring_recipes"("participant_id", "sort_order", "id");

CREATE INDEX "dining_event_participant_bring_recipes_recipe_id_idx"
ON "dining_event_participant_bring_recipes"("recipe_id");

CREATE INDEX "dining_event_participant_bring_recipes_recipe_version_id_idx"
ON "dining_event_participant_bring_recipes"("recipe_version_id");

ALTER TABLE "dining_event_participants"
DROP CONSTRAINT IF EXISTS "dining_event_participants_bring_recipe_id_fkey",
DROP CONSTRAINT IF EXISTS "dining_event_participants_bring_version_id_fkey";

ALTER TABLE "dining_event_participants"
DROP COLUMN "bring_recipe_id",
DROP COLUMN "bring_version_id";

ALTER TABLE "dining_event_participant_bring_recipes"
ADD CONSTRAINT "dining_event_participant_bring_recipes_participant_id_fkey"
FOREIGN KEY ("participant_id") REFERENCES "dining_event_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "dining_event_participant_bring_recipes_recipe_id_fkey"
FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "dining_event_participant_bring_recipes_recipe_version_id_fkey"
FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
