CREATE TABLE "recipe_collections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_recipe_id" UUID NOT NULL,
    "source_version_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_collections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_collection_scenes" (
    "collection_id" UUID NOT NULL,
    "scene_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_collection_scenes_pkey" PRIMARY KEY ("collection_id","scene_id")
);

CREATE UNIQUE INDEX "recipe_collections_user_id_source_recipe_id_source_version_id_key"
ON "recipe_collections"("user_id", "source_recipe_id", "source_version_id");

CREATE INDEX "recipe_collections_user_id_updated_at_id_idx"
ON "recipe_collections"("user_id", "updated_at", "id");

CREATE INDEX "recipe_collections_source_recipe_id_user_id_id_idx"
ON "recipe_collections"("source_recipe_id", "user_id", "id");

CREATE INDEX "recipe_collection_scenes_scene_id_collection_id_idx"
ON "recipe_collection_scenes"("scene_id", "collection_id");

ALTER TABLE "recipe_collections"
ADD CONSTRAINT "recipe_collections_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_collections"
ADD CONSTRAINT "recipe_collections_source_recipe_id_fkey"
FOREIGN KEY ("source_recipe_id") REFERENCES "recipes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recipe_collections"
ADD CONSTRAINT "recipe_collections_source_version_id_fkey"
FOREIGN KEY ("source_version_id") REFERENCES "recipe_content_versions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recipe_collection_scenes"
ADD CONSTRAINT "recipe_collection_scenes_collection_id_fkey"
FOREIGN KEY ("collection_id") REFERENCES "recipe_collections"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_collection_scenes"
ADD CONSTRAINT "recipe_collection_scenes_scene_id_fkey"
FOREIGN KEY ("scene_id") REFERENCES "recipe_scenes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
