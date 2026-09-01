CREATE TYPE "RecipeViewSourceType" AS ENUM ('MY', 'INSPIRATION');

CREATE TABLE "recipe_view_histories" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "recipe_id" INTEGER,
  "source_type" "RecipeViewSourceType" NOT NULL,
  "title_at_viewed" VARCHAR(120) NOT NULL,
  "last_viewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recipe_view_histories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_view_histories_user_id_recipe_id_key"
ON "recipe_view_histories"("user_id", "recipe_id");

CREATE INDEX "recipe_view_histories_user_id_last_viewed_at_id_idx"
ON "recipe_view_histories"("user_id", "last_viewed_at" DESC, "id" DESC);

ALTER TABLE "recipe_view_histories"
ADD CONSTRAINT "recipe_view_histories_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_view_histories"
ADD CONSTRAINT "recipe_view_histories_recipe_id_fkey"
FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
