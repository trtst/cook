ALTER TABLE "meal_plan_items"
ADD COLUMN "title" VARCHAR(40);

UPDATE "meal_plan_items"
SET "title" = CASE "meal_slot"
  WHEN 'BREAKFAST' THEN '早餐饮食计划'
  WHEN 'LUNCH' THEN '午餐饮食计划'
  WHEN 'AFTERNOON_TEA' THEN '下午茶饮食计划'
  WHEN 'DINNER' THEN '晚餐饮食计划'
  WHEN 'LATE_NIGHT' THEN '夜宵饮食计划'
  ELSE '这顿饭饮食计划'
END
WHERE "title" IS NULL;

ALTER TABLE "meal_plan_items"
ALTER COLUMN "title" SET NOT NULL;
