DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'IngredientProteinType'
  ) THEN
    CREATE TYPE "IngredientProteinType" AS ENUM (
      'PORK',
      'CHICKEN',
      'BEEF',
      'LAMB',
      'DUCK',
      'SEAFOOD',
      'EGG',
      'TOFU',
      'NONE'
    );
  END IF;
END
$$;

ALTER TABLE "ingredients"
  ADD COLUMN IF NOT EXISTS "protein_type" "IngredientProteinType",
  ADD COLUMN IF NOT EXISTS "is_staple" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "is_spicy_ingredient" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "aliases" VARCHAR(32)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(32)[];
