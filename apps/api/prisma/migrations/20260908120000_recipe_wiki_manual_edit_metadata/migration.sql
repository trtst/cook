CREATE TYPE "RecipeDerivedSource" AS ENUM ('AUTO', 'OPS');

ALTER TABLE "recipe_cook_assistants"
  ADD COLUMN "source" "RecipeDerivedSource" NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "updated_by_admin_id" INTEGER;

ALTER TABLE "recipe_nutrition_snapshots"
  ADD COLUMN "source" "RecipeDerivedSource" NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "updated_by_admin_id" INTEGER;

ALTER TABLE "recipe_cook_assistants"
  ADD CONSTRAINT "recipe_cook_assistants_updated_by_admin_id_fkey"
  FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recipe_nutrition_snapshots"
  ADD CONSTRAINT "recipe_nutrition_snapshots_updated_by_admin_id_fkey"
  FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "recipe_cook_assistants_updated_by_admin_id_idx"
  ON "recipe_cook_assistants"("updated_by_admin_id");

CREATE INDEX "recipe_nutrition_snapshots_updated_by_admin_id_idx"
  ON "recipe_nutrition_snapshots"("updated_by_admin_id");
