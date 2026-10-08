CREATE TABLE "site_content_article_reads" (
  "id" SERIAL NOT NULL,
  "content_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_content_article_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_content_article_reads_user_id_content_id_key"
  ON "site_content_article_reads"("user_id", "content_id");

CREATE INDEX "site_content_article_reads_content_id_idx"
  ON "site_content_article_reads"("content_id");

CREATE INDEX "site_contents_channel_id_type_status_published_at_idx"
  ON "site_contents"("channel_id", "type", "status", "published_at");

ALTER TABLE "site_content_article_reads"
  ADD CONSTRAINT "site_content_article_reads_content_id_fkey"
  FOREIGN KEY ("content_id") REFERENCES "site_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_content_article_reads"
  ADD CONSTRAINT "site_content_article_reads_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
