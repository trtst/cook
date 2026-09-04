ALTER TYPE "AuthCodeScene" ADD VALUE IF NOT EXISTS 'PHONE_CHANGE';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "phone_changed_at" TIMESTAMPTZ(3);

CREATE TABLE IF NOT EXISTS "phone_change_sessions" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "old_phone" VARCHAR(32) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "phone_change_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "phone_change_sessions_token_hash_key"
  ON "phone_change_sessions"("token_hash");

CREATE INDEX IF NOT EXISTS "phone_change_sessions_user_id_consumed_at_expires_at_idx"
  ON "phone_change_sessions"("user_id", "consumed_at", "expires_at");

CREATE INDEX IF NOT EXISTS "phone_change_sessions_expires_at_idx"
  ON "phone_change_sessions"("expires_at");

ALTER TABLE "phone_change_sessions"
  ADD CONSTRAINT "phone_change_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
