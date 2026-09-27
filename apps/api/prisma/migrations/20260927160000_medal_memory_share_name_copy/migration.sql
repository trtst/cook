UPDATE "medal_templates"
SET
    "name" = '一席余温',
    "description" = '相聚散场，饭桌上的暖意仍留在心里。',
    "version" = "version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'MEMORY_SHARE_STARTED_TOTAL_3';
