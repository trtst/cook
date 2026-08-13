CREATE TYPE "RecipeSlotType" AS ENUM (
    'MEAT',
    'VEGETABLE',
    'SOUP',
    'STAPLE',
    'BREAKFAST_STAPLE',
    'BREAKFAST_PROTEIN',
    'BREAKFAST_SIDE'
);

CREATE TYPE "RecipeProteinType" AS ENUM (
    'PORK',
    'CHICKEN',
    'BEEF',
    'LAMB',
    'DUCK',
    'FISH',
    'NONE'
);

CREATE TYPE "RecipeVersionTagCode" AS ENUM (
    'DISH_ROLE',
    'MEAL_TYPE',
    'MAIN_PROTEIN_TYPE',
    'PRIMARY_INGREDIENT',
    'FLAVOR_PROFILE',
    'SPICE_LEVEL'
);

CREATE TYPE "RecipeVersionTagSource" AS ENUM (
    'AUTO',
    'USER',
    'OPS',
    'AI'
);

CREATE TYPE "MealPlanDishPurchaseState" AS ENUM (
    'READY',
    'PENDING'
);

ALTER TYPE "ShoppingSourceType" ADD VALUE 'RANDOM_MENU';

CREATE TABLE "recipe_version_tags" (
  "id" SERIAL NOT NULL,
  "recipe_version_id" INTEGER NOT NULL,
  "tag_code" "RecipeVersionTagCode" NOT NULL,
  "tag_value" VARCHAR(64) NOT NULL,
  "source" "RecipeVersionTagSource" NOT NULL DEFAULT 'AUTO',
  "confidence" DECIMAL(4, 3),
  "sort_order" INTEGER,
  "is_locked" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipe_version_tags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recipe_version_tags_recipe_version_id_fkey"
    FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "recipe_version_tags_recipe_version_id_tag_code_tag_value_source_key"
  ON "recipe_version_tags" ("recipe_version_id", "tag_code", "tag_value", "source");

CREATE INDEX "recipe_version_tags_recipe_version_id_tag_code_sort_order_id_idx"
  ON "recipe_version_tags" ("recipe_version_id", "tag_code", "sort_order", "id");

CREATE INDEX "recipe_version_tags_tag_code_tag_value_recipe_version_id_idx"
  ON "recipe_version_tags" ("tag_code", "tag_value", "recipe_version_id");

ALTER TABLE "meal_plan_dishes"
  ADD COLUMN "slot_type" "RecipeSlotType",
  ADD COLUMN "purchase_state" "MealPlanDishPurchaseState" NOT NULL DEFAULT 'READY';
