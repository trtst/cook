CREATE TYPE "HomeEntryStatus" AS ENUM (
  'LISTED',
  'UNLISTED'
);

ALTER TABLE "home_feature_board_cards"
  ADD COLUMN "status" "HomeEntryStatus";

UPDATE "home_feature_board_cards"
SET "status" = 'LISTED'
WHERE "status" IS NULL;

ALTER TABLE "home_feature_board_cards"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'LISTED';
