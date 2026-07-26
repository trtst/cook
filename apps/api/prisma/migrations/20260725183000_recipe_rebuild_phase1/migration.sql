-- Reset legacy recipe candidate data approved on 2026-07-25 before rebuilding the recipe vertical slice.
DELETE FROM "shopping_items"
WHERE "source_type" IN ('PLAN', 'EVENT', 'BRING');

DELETE FROM "dining_event_participants";
DELETE FROM "dining_events";
DELETE FROM "meal_plan_items";
DELETE FROM "recipe_reports";
DELETE FROM "recipes";
DELETE FROM "recipe_content_versions";
DELETE FROM "storage_ledger"
WHERE "module" = 'RECIPE';

-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('WEIGHT', 'VOLUME', 'COUNT', 'CONTAINER', 'PACKAGE', 'OTHER');

-- DropForeignKey
ALTER TABLE "recipes" DROP CONSTRAINT "recipes_base_version_id_fkey";

-- DropForeignKey
ALTER TABLE "recipes" DROP CONSTRAINT "recipes_independent_version_id_fkey";

-- DropForeignKey
ALTER TABLE "recipes" DROP CONSTRAINT "recipes_source_recipe_id_fkey";

-- DropIndex
DROP INDEX "recipes_source_kind_status_updated_at_idx";

-- DropIndex
DROP INDEX "recipes_source_recipe_id_base_version_id_owner_id_status_idx";

-- AlterTable
ALTER TABLE "recipe_content_versions" DROP COLUMN "servings",
ADD COLUMN     "base_servings" INTEGER NOT NULL,
ADD COLUMN     "difficulty" "RecipeDifficulty",
ADD COLUMN     "story" VARCHAR(2000),
ADD COLUMN     "tips" VARCHAR(1000);

-- AlterTable
ALTER TABLE "recipes" DROP COLUMN "base_version_id",
DROP COLUMN "hidden_base_images",
DROP COLUMN "independent_version_id",
DROP COLUMN "is_customized",
DROP COLUMN "override_json",
DROP COLUMN "source_kind",
DROP COLUMN "source_recipe_id",
ADD COLUMN     "category_id" UUID,
ADD COLUMN     "collect_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "current_version_id" UUID NOT NULL,
ADD COLUMN     "inspiration_category_id" UUID,
ADD COLUMN     "like_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- DropEnum
DROP TYPE "RecipeSourceKind";

-- CreateTable
CREATE TABLE "recipe_categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "search_key" VARCHAR(40) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipe_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_scenes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "search_key" VARCHAR(40) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipe_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspiration_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "icon_key" VARCHAR(64),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inspiration_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "icon_key" VARCHAR(64),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ingredient_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "owner_id" UUID,
    "type" "UnitType" NOT NULL,
    "name" VARCHAR(16) NOT NULL,
    "search_key" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "owner_id" UUID,
    "category_id" UUID NOT NULL,
    "default_unit_id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "search_key" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_scene_links" (
    "recipe_id" UUID NOT NULL,
    "scene_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_scene_links_pkey" PRIMARY KEY ("recipe_id","scene_id")
);

-- CreateTable
CREATE TABLE "recipe_drafts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recipe_id" UUID,
    "category_id" UUID,
    "title" VARCHAR(120),
    "search_text" TEXT NOT NULL,
    "content_json" JSONB NOT NULL,
    "content_size_bytes" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipe_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_draft_scenes" (
    "draft_id" UUID NOT NULL,
    "scene_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_draft_scenes_pkey" PRIMARY KEY ("draft_id","scene_id")
);

-- CreateIndex
CREATE INDEX "recipe_categories_user_id_sort_order_id_idx" ON "recipe_categories"("user_id", "sort_order", "id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_categories_user_id_search_key_key" ON "recipe_categories"("user_id", "search_key");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_categories_user_id_sort_order_key" ON "recipe_categories"("user_id", "sort_order");

-- CreateIndex
CREATE INDEX "recipe_scenes_user_id_sort_order_id_idx" ON "recipe_scenes"("user_id", "sort_order", "id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_scenes_user_id_search_key_key" ON "recipe_scenes"("user_id", "search_key");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_scenes_user_id_sort_order_key" ON "recipe_scenes"("user_id", "sort_order");

-- CreateIndex
CREATE INDEX "inspiration_categories_sort_order_id_idx" ON "inspiration_categories"("sort_order", "id");

-- CreateIndex
CREATE UNIQUE INDEX "inspiration_categories_name_key" ON "inspiration_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "inspiration_categories_sort_order_key" ON "inspiration_categories"("sort_order");

-- CreateIndex
CREATE INDEX "ingredient_categories_sort_order_id_idx" ON "ingredient_categories"("sort_order", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_categories_name_key" ON "ingredient_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_categories_sort_order_key" ON "ingredient_categories"("sort_order");

-- CreateIndex
CREATE INDEX "units_owner_id_type_search_key_id_idx" ON "units"("owner_id", "type", "search_key", "id");

-- CreateIndex
CREATE INDEX "ingredients_owner_id_category_id_search_key_id_idx" ON "ingredients"("owner_id", "category_id", "search_key", "id");

-- CreateIndex
CREATE INDEX "recipe_scene_links_scene_id_recipe_id_idx" ON "recipe_scene_links"("scene_id", "recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_drafts_recipe_id_key" ON "recipe_drafts"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_drafts_user_id_updated_at_id_idx" ON "recipe_drafts"("user_id", "updated_at", "id");

-- CreateIndex
CREATE INDEX "recipe_draft_scenes_scene_id_draft_id_idx" ON "recipe_draft_scenes"("scene_id", "draft_id");

-- CreateIndex
CREATE INDEX "recipes_owner_id_status_category_id_sort_order_id_idx" ON "recipes"("owner_id", "status", "category_id", "sort_order", "id");

-- CreateIndex
CREATE INDEX "recipes_inspiration_category_id_status_updated_at_id_idx" ON "recipes"("inspiration_category_id", "status", "updated_at", "id");

-- AddForeignKey
ALTER TABLE "recipe_categories" ADD CONSTRAINT "recipe_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_scenes" ADD CONSTRAINT "recipe_scenes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ingredient_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_default_unit_id_fkey" FOREIGN KEY ("default_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "recipe_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_inspiration_category_id_fkey" FOREIGN KEY ("inspiration_category_id") REFERENCES "inspiration_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_scene_links" ADD CONSTRAINT "recipe_scene_links_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_scene_links" ADD CONSTRAINT "recipe_scene_links_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "recipe_scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_drafts" ADD CONSTRAINT "recipe_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_drafts" ADD CONSTRAINT "recipe_drafts_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_drafts" ADD CONSTRAINT "recipe_drafts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "recipe_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_draft_scenes" ADD CONSTRAINT "recipe_draft_scenes_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "recipe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_draft_scenes" ADD CONSTRAINT "recipe_draft_scenes_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "recipe_scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
