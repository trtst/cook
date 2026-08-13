DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'RecipeVersionTagCode'
  ) THEN
    CREATE TYPE "RecipeVersionTagCode" AS ENUM (
      'DISH_ROLE',
      'MEAL_TYPE',
      'MAIN_PROTEIN_TYPE',
      'PRIMARY_INGREDIENT',
      'FLAVOR_PROFILE',
      'SPICE_LEVEL'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'RecipeVersionTagSource'
  ) THEN
    CREATE TYPE "RecipeVersionTagSource" AS ENUM (
      'AUTO',
      'USER',
      'OPS',
      'AI'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "recipe_version_tags" (
  "id" SERIAL NOT NULL,
  "recipe_version_id" INTEGER NOT NULL,
  "tag_code" "RecipeVersionTagCode" NOT NULL,
  "tag_value" VARCHAR(64) NOT NULL,
  "source" "RecipeVersionTagSource" NOT NULL DEFAULT 'AUTO',
  "confidence" DECIMAL(4, 3),
  "sort_order" INTEGER,
  "is_locked" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "recipe_version_tags_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recipe_version_tags_recipe_version_id_fkey'
  ) THEN
    ALTER TABLE "recipe_version_tags"
      ADD CONSTRAINT "recipe_version_tags_recipe_version_id_fkey"
      FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "recipe_version_tags_recipe_version_id_tag_code_tag_value_source_key"
  ON "recipe_version_tags" ("recipe_version_id", "tag_code", "tag_value", "source");

CREATE INDEX IF NOT EXISTS "recipe_version_tags_recipe_version_id_tag_code_sort_order_id_idx"
  ON "recipe_version_tags" ("recipe_version_id", "tag_code", "sort_order", "id");

CREATE INDEX IF NOT EXISTS "recipe_version_tags_tag_code_tag_value_recipe_version_id_idx"
  ON "recipe_version_tags" ("tag_code", "tag_value", "recipe_version_id");
