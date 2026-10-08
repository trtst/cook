CREATE TABLE "recipe_version_ingredients" (
    "recipe_version_id" INTEGER NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    CONSTRAINT "recipe_version_ingredients_pkey" PRIMARY KEY ("recipe_version_id", "ingredient_id"),
    CONSTRAINT "recipe_version_ingredients_recipe_version_id_fkey"
      FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recipe_version_ingredients_ingredient_id_fkey"
      FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "recipe_version_ingredients_ingredient_id_recipe_version_id_idx"
  ON "recipe_version_ingredients"("ingredient_id", "recipe_version_id");

CREATE INDEX "recipes_current_version_id_idx" ON "recipes"("current_version_id");

CREATE TABLE "home_fridge_recommendation_caches" (
    "user_id" INTEGER NOT NULL,
    "active_ingredient_ids" JSONB NOT NULL,
    "active_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "candidate_pool_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "candidate_pool" JSONB NOT NULL DEFAULT '[]',
    "cursor_recipe_version_id" INTEGER NOT NULL DEFAULT 0,
    "seen_recipe_names" JSONB NOT NULL DEFAULT '[]',
    "seen_ingredient_sets" JSONB NOT NULL DEFAULT '[]',
    "has_more" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "home_fridge_recommendation_caches_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "home_fridge_recommendation_caches_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
