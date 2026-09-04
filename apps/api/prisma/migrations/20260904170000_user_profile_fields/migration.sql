ALTER TABLE "users"
  ADD COLUMN "cook_no" VARCHAR(20),
  ADD COLUMN "bio" VARCHAR(160),
  ADD COLUMN "gender" VARCHAR(16),
  ADD COLUMN "birth_date" DATE;

UPDATE "users"
SET "cook_no" = CASE
  WHEN char_length("uid"::text) >= 5 THEN "uid"::text
  ELSE 'cook_' || "uid"::text
END
WHERE "cook_no" IS NULL;

CREATE UNIQUE INDEX "users_cook_no_key" ON "users"("cook_no");

ALTER TABLE "users"
  ADD CONSTRAINT "users_cook_no_length_check"
    CHECK ("cook_no" IS NULL OR char_length("cook_no") BETWEEN 5 AND 20),
  ADD CONSTRAINT "users_cook_no_format_check"
    CHECK ("cook_no" IS NULL OR "cook_no" ~ '^[A-Za-z0-9_]+$'),
  ADD CONSTRAINT "users_gender_check"
    CHECK ("gender" IS NULL OR "gender" IN ('MALE', 'FEMALE', 'UNSPECIFIED')),
  ADD CONSTRAINT "users_birth_date_not_future_check"
    CHECK ("birth_date" IS NULL OR "birth_date" <= CURRENT_DATE);
