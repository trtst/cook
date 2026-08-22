ALTER TABLE "site_contents"
ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "like_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "site_content_likes" (
  "id" SERIAL NOT NULL,
  "content_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "site_content_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_content_likes_content_id_user_id_key" ON "site_content_likes"("content_id", "user_id");
CREATE INDEX "site_content_likes_user_id_created_at_idx" ON "site_content_likes"("user_id", "created_at");
CREATE INDEX "site_content_likes_content_id_created_at_idx" ON "site_content_likes"("content_id", "created_at");

ALTER TABLE "site_content_likes"
ADD CONSTRAINT "site_content_likes_content_id_fkey"
FOREIGN KEY ("content_id") REFERENCES "site_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_content_likes"
ADD CONSTRAINT "site_content_likes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
