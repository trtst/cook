ALTER TABLE "user_notification_states"
ADD COLUMN "badge_read_at" TIMESTAMPTZ(3);

UPDATE "user_notification_states"
SET "badge_read_at" = "feed_read_at"
WHERE "feed_read_at" IS NOT NULL;

CREATE TABLE "user_notification_reads" (
  "user_id" INTEGER NOT NULL,
  "notification_id" VARCHAR(96) NOT NULL,
  "notification_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_notification_reads_pkey" PRIMARY KEY ("user_id", "notification_id")
);

ALTER TABLE "user_notification_reads"
ADD CONSTRAINT "user_notification_reads_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
