ALTER TABLE "recipes"
  ADD COLUMN "origin_version_id" INTEGER,
  ADD COLUMN "origin_cover_image_url" VARCHAR(512);

ALTER TABLE "recipes"
  ADD CONSTRAINT "recipes_origin_version_id_fkey"
  FOREIGN KEY ("origin_version_id") REFERENCES "recipe_content_versions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "recipes_owner_id_origin_version_id_idx"
  ON "recipes"("owner_id", "origin_version_id");
