-- Move legacy public article channels out of request-time code.
INSERT INTO "site_content_channels" ("code", "name", "description", "sort_order", "version", "created_at", "updated_at")
VALUES
  ('KITCHEN', '厨房百事', '用什么、怎么买、怎么存、怎么备', 6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('COOK', '烹调技法', '怎么做、为什么这样做、失败怎么救', 7, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('FOOD', '饮食文化', '餐桌上的节气、地域、传统、人情', 8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

DO $$
DECLARE
  mapping RECORD;
  legacy_id INTEGER;
  target_id INTEGER;
BEGIN
  FOR mapping IN
    SELECT * FROM (VALUES
      ('KITCHEN_PREP', 'KITCHEN'),
      ('COOKING_SKILLS', 'COOK'),
      ('RECIPE_SKILLS', 'FOOD')
    ) AS channels(from_code, to_code)
  LOOP
    legacy_id := NULL;
    target_id := NULL;
    SELECT "id" INTO legacy_id
    FROM "site_content_channels"
    WHERE "code" = mapping.from_code;

    IF legacy_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT "id" INTO target_id
    FROM "site_content_channels"
    WHERE "code" = mapping.to_code;

    UPDATE "site_contents"
    SET "channel_id" = target_id
    WHERE "channel_id" = legacy_id;

    DELETE FROM "site_content_channels"
    WHERE "id" = legacy_id;
  END LOOP;

  UPDATE "site_contents" AS content
  SET "label" = channel."name"
  FROM "site_content_channels" AS channel
  WHERE content."channel_id" = channel."id"
    AND content."type" = 'ARTICLE'
    AND channel."code" IN ('KITCHEN', 'COOK', 'FOOD');
END $$;
