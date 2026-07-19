CREATE SEQUENCE IF NOT EXISTS "users_uid_seq" START WITH 100000;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "uid" INTEGER;

UPDATE "users"
SET "uid" = nextval('"users_uid_seq"')
WHERE "uid" IS NULL;

SELECT setval(
  '"users_uid_seq"',
  GREATEST((SELECT COALESCE(MAX("uid"), 99999) FROM "users"), 99999),
  true
);

ALTER TABLE "users"
  ALTER COLUMN "uid" SET DEFAULT nextval('"users_uid_seq"'),
  ALTER COLUMN "uid" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_uid_key" ON "users"("uid");
