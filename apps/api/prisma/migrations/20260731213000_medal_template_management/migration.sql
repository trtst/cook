CREATE TYPE "MedalAwardRule" AS ENUM (
    'MEAL_COMPLETION',
    'DINING_EVENT_COMPLETION',
    'GROUP_MEAL_COMPLETION',
    'FULL_LOOP_COMPLETION',
    'RECOMMENDATION_ADOPTED_TOTAL'
);

CREATE TYPE "MedalCategory" AS ENUM (
    'MEAL_CHECKIN',
    'DINING_COLLABORATION',
    'HOLIDAY_LIMITED',
    'RECOMMENDATION_CONTRIBUTION'
);

CREATE TYPE "MedalTemplateStatus" AS ENUM (
    'DRAFT',
    'LISTED',
    'UNLISTED',
    'ARCHIVED'
);

CREATE TABLE "medal_templates" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "award_rule" "MedalAwardRule" NOT NULL,
    "category" "MedalCategory" NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "condition" VARCHAR(255) NOT NULL,
    "icon_key" VARCHAR(32) NOT NULL,
    "status" "MedalTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "target_count" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_limited" BOOLEAN NOT NULL DEFAULT false,
    "start_at" TIMESTAMPTZ(3),
    "end_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medal_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "medal_templates_time_range_check" CHECK ("end_at" IS NULL OR "start_at" IS NULL OR "start_at" < "end_at"),
    CONSTRAINT "medal_templates_target_count_check" CHECK ("target_count" > 0)
);

CREATE UNIQUE INDEX "medal_templates_code_key" ON "medal_templates"("code");
CREATE INDEX "medal_templates_status_category_sort_order_idx" ON "medal_templates"("status", "category", "sort_order");
CREATE INDEX "medal_templates_award_rule_status_target_count_idx" ON "medal_templates"("award_rule", "status", "target_count");

INSERT INTO "medal_templates" (
    "code",
    "award_rule",
    "category",
    "name",
    "description",
    "condition",
    "icon_key",
    "status",
    "target_count",
    "sort_order",
    "is_limited"
) VALUES
    (
        'FIRST_COMPLETED_MEAL',
        'MEAL_COMPLETION',
        'MEAL_CHECKIN',
        '开火第一餐',
        '第一次把自己安排的一餐真正做完吃成。',
        '完成任意一个自己的计划餐次。',
        'PLAN',
        'LISTED',
        1,
        10,
        false
    ),
    (
        'FIRST_COMPLETED_DINING_EVENT',
        'DINING_EVENT_COMPLETION',
        'DINING_COLLABORATION',
        '第一场饭局',
        '第一次参与完成一场真实饭局。',
        '成为一场已完成饭局的发起人，或已接受参与人。',
        'DINING_EVENT',
        'LISTED',
        1,
        20,
        false
    ),
    (
        'FIRST_GROUP_MEAL',
        'GROUP_MEAL_COMPLETION',
        'DINING_COLLABORATION',
        '一起吃成一顿',
        '第一次以发起人身份把一场多人饭局真正吃成。',
        '作为发起人完成一场至少有 1 位已接受参与人的饭局。',
        'GROUP',
        'LISTED',
        1,
        30,
        false
    ),
    (
        'FIRST_FULL_LOOP',
        'FULL_LOOP_COMPLETION',
        'MEAL_CHECKIN',
        '完整闭环',
        '第一次把计划、饭局、采购和开饭完整走完。',
        '同一计划链路下已完成饭局，已把该饭局至少 1 个购物项标记为已买，并最终完成用餐。',
        'SHOPPING',
        'LISTED',
        1,
        40,
        false
    ),
    (
        'RECOMMENDATION_RISING_STAR',
        'RECOMMENDATION_ADOPTED_TOTAL',
        'RECOMMENDATION_CONTRIBUTION',
        '推荐新星',
        '第一次把自己的经验推荐进系统库。',
        '累计 1 次推荐内容被系统收录。当前统计菜谱推荐收录与食材推荐收录。',
        'RECOMMEND',
        'LISTED',
        1,
        50,
        false
    ),
    (
        'RECOMMENDATION_BRIGHT_STAR',
        'RECOMMENDATION_ADOPTED_TOTAL',
        'RECOMMENDATION_CONTRIBUTION',
        '推荐之星',
        '你的好经验，已经开始帮助更多人做饭。',
        '累计 3 次推荐内容被系统收录。当前统计菜谱推荐收录与食材推荐收录。',
        'RECOMMEND',
        'LISTED',
        3,
        60,
        false
    ),
    (
        'RECOMMENDATION_AMBASSADOR',
        'RECOMMENDATION_ADOPTED_TOTAL',
        'RECOMMENDATION_CONTRIBUTION',
        '推荐大使',
        '持续贡献被收录内容，成为系统内容的重要补充者。',
        '累计 10 次推荐内容被系统收录。当前统计菜谱推荐收录与食材推荐收录。',
        'RECOMMEND',
        'LISTED',
        10,
        70,
        false
    );

ALTER TABLE "user_medals"
ALTER COLUMN "code" TYPE VARCHAR(64)
USING "code"::text;

DROP TYPE "MedalCode";

ALTER TABLE "user_medals"
ADD CONSTRAINT "user_medals_code_fkey"
FOREIGN KEY ("code") REFERENCES "medal_templates"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
