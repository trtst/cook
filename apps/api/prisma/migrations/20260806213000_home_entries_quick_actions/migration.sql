ALTER TYPE "HomeFeatureBoardPlacement" ADD VALUE IF NOT EXISTS 'QUICK_1';
ALTER TYPE "HomeFeatureBoardPlacement" ADD VALUE IF NOT EXISTS 'QUICK_2';
ALTER TYPE "HomeFeatureBoardPlacement" ADD VALUE IF NOT EXISTS 'QUICK_3';
ALTER TYPE "HomeFeatureBoardPlacement" ADD VALUE IF NOT EXISTS 'QUICK_4';

COMMIT;

ALTER TABLE "home_feature_board_cards"
  ALTER COLUMN "subtitle" DROP NOT NULL;

INSERT INTO "home_feature_board_cards" (
  "placement",
  "title",
  "subtitle",
  "target_type",
  "target_value",
  "art_image_url",
  "badge_text",
  "version",
  "created_at",
  "updated_at"
)
VALUES
  ('QUICK_1', '我想吃', '先记一口', 'PAGE', '/pages_meal/wish/index', NULL, '想', 1, NOW(), NOW()),
  ('QUICK_2', '问大家', '问问大家', 'PAGE', '/pages_meal/poll/index', NULL, '问', 1, NOW(), NOW()),
  ('QUICK_3', '随机', '不纠结', 'PAGE', '/pages_meal/random/index', NULL, '随', 1, NOW(), NOW()),
  ('QUICK_4', '缺什么', '买菜前看', 'PAGE', '/pages_pantry/gap/index', NULL, '缺', 1, NOW(), NOW())
ON CONFLICT ("placement") DO NOTHING;
