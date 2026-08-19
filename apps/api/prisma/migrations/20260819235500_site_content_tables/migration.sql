CREATE TYPE "SiteContentType" AS ENUM ('PAGE', 'ARTICLE');
CREATE TYPE "SiteContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNLISTED');

CREATE TABLE "site_content_channels" (
  "id" SERIAL NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(32) NOT NULL,
  "description" VARCHAR(200),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "site_content_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_contents" (
  "id" SERIAL NOT NULL,
  "type" "SiteContentType" NOT NULL,
  "status" "SiteContentStatus" NOT NULL DEFAULT 'DRAFT',
  "channel_id" INTEGER,
  "slug" VARCHAR(80) NOT NULL,
  "path" VARCHAR(160) NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "summary" VARCHAR(240) NOT NULL,
  "label" VARCHAR(16) NOT NULL,
  "hero_note" VARCHAR(200),
  "cover_image_url" VARCHAR(512),
  "body_html" TEXT NOT NULL,
  "body_text" TEXT NOT NULL,
  "effective_at" TIMESTAMPTZ(3),
  "published_at" TIMESTAMPTZ(3),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by_admin_id" INTEGER,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "site_contents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_content_channels_code_key" ON "site_content_channels"("code");
CREATE INDEX "site_content_channels_sort_order_id_idx" ON "site_content_channels"("sort_order", "id");

CREATE UNIQUE INDEX "site_contents_slug_key" ON "site_contents"("slug");
CREATE UNIQUE INDEX "site_contents_path_key" ON "site_contents"("path");
CREATE INDEX "site_contents_type_status_sort_order_id_idx" ON "site_contents"("type", "status", "sort_order", "id");
CREATE INDEX "site_contents_channel_id_type_status_sort_order_id_idx" ON "site_contents"("channel_id", "type", "status", "sort_order", "id");
CREATE INDEX "site_contents_published_at_id_idx" ON "site_contents"("published_at", "id");

ALTER TABLE "site_contents"
ADD CONSTRAINT "site_contents_channel_id_fkey"
FOREIGN KEY ("channel_id") REFERENCES "site_content_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "site_contents"
ADD CONSTRAINT "site_contents_updated_by_admin_id_fkey"
FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
