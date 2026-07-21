CREATE TABLE "user_taste_profiles" (
  "user_id" UUID NOT NULL,
  "allergies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "strict_dislikes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "disliked_ingredients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "flavor_preferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "note" VARCHAR(1000),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_taste_profiles_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "ck_user_taste_profiles_allergies_size" CHECK (cardinality("allergies") <= 50),
  CONSTRAINT "ck_user_taste_profiles_strict_dislikes_size" CHECK (cardinality("strict_dislikes") <= 50),
  CONSTRAINT "ck_user_taste_profiles_disliked_ingredients_size" CHECK (cardinality("disliked_ingredients") <= 50),
  CONSTRAINT "ck_user_taste_profiles_flavor_preferences_size" CHECK (cardinality("flavor_preferences") <= 50)
);

ALTER TABLE "user_taste_profiles"
  ADD CONSTRAINT "user_taste_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
