ALTER TABLE "recipes"
ADD COLUMN "is_inspiration" BOOLEAN NOT NULL DEFAULT false;

UPDATE "recipes"
SET "is_inspiration" = true
WHERE "owner_id" IS NULL
  AND "inspiration_category_id" IS NOT NULL;

CREATE TABLE "recipe_inspiration_owners" (
  "user_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipe_inspiration_owners_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "recipe_inspiration_owners_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "recipe_inspiration_owners" ("user_id")
SELECT "id" FROM "users" WHERE "uid" = 10001
ON CONFLICT ("user_id") DO NOTHING;
