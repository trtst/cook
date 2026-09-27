-- The homepage feature-board cards are now fixed client content; retain only four configurable quick entries.
BEGIN;

DELETE FROM "home_feature_board_cards"
WHERE "placement" IN ('MAIN', 'SIDE_TOP', 'SIDE_BOTTOM');

CREATE TYPE "HomeFeatureBoardPlacement_next" AS ENUM ('QUICK_1', 'QUICK_2', 'QUICK_3', 'QUICK_4');

ALTER TABLE "home_feature_board_cards"
  ALTER COLUMN "placement" TYPE "HomeFeatureBoardPlacement_next"
  USING "placement"::text::"HomeFeatureBoardPlacement_next";

DROP TYPE "HomeFeatureBoardPlacement";
ALTER TYPE "HomeFeatureBoardPlacement_next" RENAME TO "HomeFeatureBoardPlacement";

COMMIT;
