CREATE TABLE "recipe_cook_assistants" (
    "id" SERIAL NOT NULL,
    "recipe_version_id" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "generated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_cook_assistants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_cook_assistants_recipe_version_id_key" ON "recipe_cook_assistants"("recipe_version_id");

ALTER TABLE "recipe_cook_assistants"
ADD CONSTRAINT "recipe_cook_assistants_recipe_version_id_fkey"
FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
