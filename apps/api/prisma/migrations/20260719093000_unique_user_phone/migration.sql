DROP INDEX IF EXISTS "users_phone_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key" ON "users"("phone");
