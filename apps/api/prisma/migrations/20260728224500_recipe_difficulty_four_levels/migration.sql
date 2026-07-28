ALTER TYPE "RecipeDifficulty" RENAME TO "RecipeDifficulty_old";

CREATE TYPE "RecipeDifficulty" AS ENUM ('BEGINNER', 'EASY', 'SKILLED', 'CHALLENGING');

ALTER TABLE "recipe_content_versions"
  ALTER COLUMN "difficulty" TYPE "RecipeDifficulty"
  USING (
    CASE
      WHEN "difficulty"::text = 'EASY' THEN 'EASY'
      WHEN "difficulty"::text = 'MEDIUM' THEN 'SKILLED'
      WHEN "difficulty"::text = 'HARD' THEN 'CHALLENGING'
      ELSE NULL
    END
  )::"RecipeDifficulty";

DROP TYPE "RecipeDifficulty_old";
