CREATE TYPE "HomeFeatureBoardPlacement" AS ENUM ('MAIN', 'SIDE_TOP', 'SIDE_BOTTOM');

CREATE TYPE "HomeFeatureBoardTargetType" AS ENUM ('PAGE', 'WEB_VIEW');

CREATE TABLE "home_feature_board_cards" (
  "placement" "HomeFeatureBoardPlacement" NOT NULL,
  "title" VARCHAR(20) NOT NULL,
  "subtitle" VARCHAR(40) NOT NULL,
  "target_type" "HomeFeatureBoardTargetType" NOT NULL,
  "target_value" VARCHAR(512) NOT NULL,
  "art_image_url" VARCHAR(512),
  "badge_text" VARCHAR(8),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "home_feature_board_cards_pkey" PRIMARY KEY ("placement")
);
