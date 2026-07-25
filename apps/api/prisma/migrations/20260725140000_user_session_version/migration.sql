ALTER TABLE "users"
  ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "ck_users_session_version" CHECK ("session_version" >= 0);
