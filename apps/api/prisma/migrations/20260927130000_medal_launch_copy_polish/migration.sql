UPDATE "medal_templates"
SET
    "description" = CASE "code"
        WHEN 'DINING_EVENT_COMPLETION_50' THEN '让邀约相聚成为值得期待的饭桌时光。'
        WHEN 'SHOPPING_COMPLETION_50' THEN '清单安排妥帖，把需要的滋味安心带回家。'
    END,
    "version" = "version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN ('DINING_EVENT_COMPLETION_50', 'SHOPPING_COMPLETION_50');
