CREATE TABLE "admin_material_images" (
    "id" SERIAL NOT NULL,
    "storage_key" VARCHAR(256) NOT NULL,
    "note" VARCHAR(120) NOT NULL,
    "content_type" VARCHAR(40) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "uploaded_by_admin_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_material_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_material_images_storage_key_key" ON "admin_material_images"("storage_key");
CREATE INDEX "admin_material_images_created_at_id_idx" ON "admin_material_images"("created_at", "id");

ALTER TABLE "admin_material_images"
ADD CONSTRAINT "admin_material_images_uploaded_by_admin_id_fkey"
FOREIGN KEY ("uploaded_by_admin_id") REFERENCES "admin_accounts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_material_images"
ADD CONSTRAINT "admin_material_images_size_bytes_check"
CHECK ("size_bytes" > 0);

ALTER TABLE "admin_material_images"
ADD CONSTRAINT "admin_material_images_width_height_check"
CHECK ("width" > 0 AND "height" > 0);
