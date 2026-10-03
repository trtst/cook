UPDATE "medal_templates"
SET
    "condition" = '完成一场饭局或计划中的用餐，就为认真生活留下一枚印记。',
    "version" = "version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN (
    'FIRST_COMPLETED_MEAL',
    'MEAL_COMPLETION_5',
    'MEAL_COMPLETION_20',
    'MEAL_COMPLETION_50',
    'MEAL_COMPLETION_100'
)
AND "condition" IS DISTINCT FROM '完成一场饭局或计划中的用餐，就为认真生活留下一枚印记。';

UPDATE "medal_templates"
SET
    "condition" = '赴一场饭局，等发起人确认完成；发起人和接受邀请的伙伴，都能把这次相聚留作纪念。',
    "version" = "version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN (
    'FIRST_COMPLETED_DINING_EVENT',
    'DINING_EVENT_COMPLETION_5',
    'DINING_EVENT_COMPLETION_20',
    'DINING_EVENT_COMPLETION_50',
    'DINING_EVENT_COMPLETION_100'
)
AND "condition" IS DISTINCT FROM '赴一场饭局，等发起人确认完成；发起人和接受邀请的伙伴，都能把这次相聚留作纪念。';

UPDATE "medal_templates"
SET
    "condition" = '你张罗的饭局有伙伴接受邀约，并由你确认饭局圆满结束；用心安排的相聚，值得好好留念。',
    "version" = "version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN (
    'FIRST_GROUP_MEAL',
    'GROUP_MEAL_COMPLETION_3',
    'GROUP_MEAL_COMPLETION_10',
    'GROUP_MEAL_COMPLETION_20',
    'GROUP_MEAL_COMPLETION_50'
)
AND "condition" IS DISTINCT FROM '你张罗的饭局有伙伴接受邀约，并由你确认饭局圆满结束；用心安排的相聚，值得好好留念。';

UPDATE "medal_templates"
SET
    "condition" = '饭局需要的食材都已备妥：已有的标记「我已备好」，买到的勾选「已买」；之后由发起人确认用餐完成，让从准备到开饭的用心留下印记。',
    "version" = "version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN (
    'FIRST_FULL_LOOP',
    'FULL_LOOP_COMPLETION_3',
    'FULL_LOOP_COMPLETION_5',
    'FULL_LOOP_COMPLETION_10',
    'FULL_LOOP_COMPLETION_20'
)
AND "condition" IS DISTINCT FROM '饭局需要的食材都已备妥：已有的标记「我已备好」，买到的勾选「已买」；之后由发起人确认用餐完成，让从准备到开饭的用心留下印记。';

UPDATE "medal_templates"
SET
    "condition" = '把采购清单里的食材逐项勾选为「已买」，再完成这次采购；食材备齐了，下一餐也更有着落。',
    "version" = "version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN (
    'SHOPPING_COMPLETION_1',
    'SHOPPING_COMPLETION_5',
    'SHOPPING_COMPLETION_20',
    'SHOPPING_COMPLETION_50',
    'SHOPPING_COMPLETION_100'
)
AND "condition" IS DISTINCT FROM '把采购清单里的食材逐项勾选为「已买」，再完成这次采购；食材备齐了，下一餐也更有着落。';

UPDATE "medal_templates"
SET
    "condition" = '把新添的食材记进食材库，或把用完的食材点「家里没有了」移除；这都是认真照料家中食材的方式。',
    "version" = "version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN (
    'FRIDGE_MAINTENANCE_1',
    'FRIDGE_MAINTENANCE_4',
    'FRIDGE_MAINTENANCE_12',
    'FRIDGE_MAINTENANCE_26',
    'FRIDGE_MAINTENANCE_52'
)
AND "condition" IS DISTINCT FROM '把新添的食材记进食材库，或把用完的食材点「家里没有了」移除；这都是认真照料家中食材的方式。';

UPDATE "medal_templates"
SET
    "condition" = '你发起的饭局圆满结束后，点「分享回忆」把这顿饭的温暖分享出去。',
    "version" = "version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN (
    'MEMORY_SHARE_STARTED_TOTAL_1',
    'MEMORY_SHARE_STARTED_TOTAL_3',
    'MEMORY_SHARE_STARTED_TOTAL_10',
    'MEMORY_SHARE_STARTED_TOTAL_20',
    'MEMORY_SHARE_STARTED_TOTAL_50'
)
AND "condition" IS DISTINCT FROM '你发起的饭局圆满结束后，点「分享回忆」把这顿饭的温暖分享出去。';

UPDATE "medal_templates"
SET
    "condition" = '分享菜谱或食材推荐，审核通过并收录后，这份心意也能为别人的餐桌带去灵感。',
    "version" = "version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN (
    'RECOMMENDATION_RISING_STAR',
    'RECOMMENDATION_BRIGHT_STAR',
    'RECOMMENDATION_AMBASSADOR',
    'RECOMMENDATION_ADOPTED_TOTAL_20',
    'RECOMMENDATION_ADOPTED_TOTAL_50'
)
AND "condition" IS DISTINCT FROM '分享菜谱或食材推荐，审核通过并收录后，这份心意也能为别人的餐桌带去灵感。';
