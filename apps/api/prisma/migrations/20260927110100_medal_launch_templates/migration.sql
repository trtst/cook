UPDATE "medal_templates"
SET "condition" = '明确确认完成用餐累计达到 1 餐；计划与关联饭局只计一餐，饭局统计发起人和完成时仍为已接受状态的参与人。'
WHERE "code" = 'FIRST_COMPLETED_MEAL'
  AND "condition" = '完成任意一个自己的计划餐次。';

UPDATE "medal_templates"
SET "condition" = '同一饭局所需食材均已通过准备流程确认完成（已买、家里已有或无需采购），并由发起人确认完成饭局。'
WHERE "code" = 'FIRST_FULL_LOOP'
  AND "condition" = '同一计划链路下已完成饭局，已把该饭局至少 1 个购物项标记为已买，并最终完成用餐。';

INSERT INTO "medal_templates" ("code", "award_rule", "category", "name", "description", "condition", "icon_key", "status", "target_count", "sort_order", "is_limited")
VALUES
('MEAL_COMPLETION_5', 'MEAL_COMPLETION', 'MEAL_CHECKIN', '完成餐次5餐', '累计达成5餐，把认真安排生活的每一步留下记录。', '明确确认完成用餐累计达到 5 餐；同一计划与关联饭局只计一餐。', 'PLAN', 'LISTED', 5, 11, false),
('MEAL_COMPLETION_20', 'MEAL_COMPLETION', 'MEAL_CHECKIN', '完成餐次20餐', '累计达成20餐，把认真安排生活的每一步留下记录。', '明确确认完成用餐累计达到 20 餐；同一计划与关联饭局只计一餐。', 'PLAN', 'LISTED', 20, 12, false),
('MEAL_COMPLETION_50', 'MEAL_COMPLETION', 'MEAL_CHECKIN', '完成餐次50餐', '累计达成50餐，把认真安排生活的每一步留下记录。', '明确确认完成用餐累计达到 50 餐；同一计划与关联饭局只计一餐。', 'PLAN', 'LISTED', 50, 13, false),
('MEAL_COMPLETION_100', 'MEAL_COMPLETION', 'MEAL_CHECKIN', '完成餐次100餐', '累计达成100餐，把认真安排生活的每一步留下记录。', '明确确认完成用餐累计达到 100 餐；同一计划与关联饭局只计一餐。', 'PLAN', 'LISTED', 100, 14, false),
('DINING_EVENT_COMPLETION_5', 'DINING_EVENT_COMPLETION', 'DINING_COLLABORATION', '完成饭局5场', '累计达成5场，把认真安排生活的每一步留下记录。', '作为饭局发起人或完成时仍为已接受状态的参与人，完成饭局累计达到 5 场。', 'DINING_EVENT', 'LISTED', 5, 21, false),
('DINING_EVENT_COMPLETION_20', 'DINING_EVENT_COMPLETION', 'DINING_COLLABORATION', '完成饭局20场', '累计达成20场，把认真安排生活的每一步留下记录。', '作为饭局发起人或完成时仍为已接受状态的参与人，完成饭局累计达到 20 场。', 'DINING_EVENT', 'LISTED', 20, 22, false),
('DINING_EVENT_COMPLETION_50', 'DINING_EVENT_COMPLETION', 'DINING_COLLABORATION', '完成饭局50场', '累计达成50场，把认真安排生活的每一步留下记录。', '作为饭局发起人或完成时仍为已接受状态的参与人，完成饭局累计达到 50 场。', 'DINING_EVENT', 'LISTED', 50, 23, false),
('DINING_EVENT_COMPLETION_100', 'DINING_EVENT_COMPLETION', 'DINING_COLLABORATION', '完成饭局100场', '累计达成100场，把认真安排生活的每一步留下记录。', '作为饭局发起人或完成时仍为已接受状态的参与人，完成饭局累计达到 100 场。', 'DINING_EVENT', 'LISTED', 100, 24, false),
('GROUP_MEAL_COMPLETION_3', 'GROUP_MEAL_COMPLETION', 'DINING_COLLABORATION', '主理多人饭局3场', '累计达成3场，把认真安排生活的每一步留下记录。', '作为发起人完成至少有一位已接受参与人的饭局累计达到 3 场。', 'GROUP', 'LISTED', 3, 31, false),
('GROUP_MEAL_COMPLETION_10', 'GROUP_MEAL_COMPLETION', 'DINING_COLLABORATION', '主理多人饭局10场', '累计达成10场，把认真安排生活的每一步留下记录。', '作为发起人完成至少有一位已接受参与人的饭局累计达到 10 场。', 'GROUP', 'LISTED', 10, 32, false),
('GROUP_MEAL_COMPLETION_20', 'GROUP_MEAL_COMPLETION', 'DINING_COLLABORATION', '主理多人饭局20场', '累计达成20场，把认真安排生活的每一步留下记录。', '作为发起人完成至少有一位已接受参与人的饭局累计达到 20 场。', 'GROUP', 'LISTED', 20, 33, false),
('GROUP_MEAL_COMPLETION_50', 'GROUP_MEAL_COMPLETION', 'DINING_COLLABORATION', '主理多人饭局50场', '累计达成50场，把认真安排生活的每一步留下记录。', '作为发起人完成至少有一位已接受参与人的饭局累计达到 50 场。', 'GROUP', 'LISTED', 50, 34, false),
('FULL_LOOP_COMPLETION_3', 'FULL_LOOP_COMPLETION', 'MEAL_CHECKIN', '完整闭环3餐', '累计达成3餐，把认真安排生活的每一步留下记录。', '所有所需食材均已买、家里已有或无需采购，并明确确认完成用餐，累计达到 3 餐。', 'SHOPPING', 'LISTED', 3, 41, false),
('FULL_LOOP_COMPLETION_5', 'FULL_LOOP_COMPLETION', 'MEAL_CHECKIN', '完整闭环5餐', '累计达成5餐，把认真安排生活的每一步留下记录。', '所有所需食材均已买、家里已有或无需采购，并明确确认完成用餐，累计达到 5 餐。', 'SHOPPING', 'LISTED', 5, 42, false),
('FULL_LOOP_COMPLETION_10', 'FULL_LOOP_COMPLETION', 'MEAL_CHECKIN', '完整闭环10餐', '累计达成10餐，把认真安排生活的每一步留下记录。', '所有所需食材均已买、家里已有或无需采购，并明确确认完成用餐，累计达到 10 餐。', 'SHOPPING', 'LISTED', 10, 43, false),
('FULL_LOOP_COMPLETION_20', 'FULL_LOOP_COMPLETION', 'MEAL_CHECKIN', '完整闭环20餐', '累计达成20餐，把认真安排生活的每一步留下记录。', '所有所需食材均已买、家里已有或无需采购，并明确确认完成用餐，累计达到 20 餐。', 'SHOPPING', 'LISTED', 20, 44, false),
('SHOPPING_COMPLETION_1', 'SHOPPING_COMPLETION', 'MEAL_CHECKIN', '采购完成1张', '累计达成1张，把认真安排生活的每一步留下记录。', '完成非空采购清单且所有未删除项目均为已买；每人每天最多计 2 张，累计达到 1 张。', 'SHOPPING', 'LISTED', 1, 90, false),
('SHOPPING_COMPLETION_5', 'SHOPPING_COMPLETION', 'MEAL_CHECKIN', '采购完成5张', '累计达成5张，把认真安排生活的每一步留下记录。', '完成非空采购清单且所有未删除项目均为已买；每人每天最多计 2 张，累计达到 5 张。', 'SHOPPING', 'LISTED', 5, 91, false),
('SHOPPING_COMPLETION_20', 'SHOPPING_COMPLETION', 'MEAL_CHECKIN', '采购完成20张', '累计达成20张，把认真安排生活的每一步留下记录。', '完成非空采购清单且所有未删除项目均为已买；每人每天最多计 2 张，累计达到 20 张。', 'SHOPPING', 'LISTED', 20, 92, false),
('SHOPPING_COMPLETION_50', 'SHOPPING_COMPLETION', 'MEAL_CHECKIN', '采购完成50张', '累计达成50张，把认真安排生活的每一步留下记录。', '完成非空采购清单且所有未删除项目均为已买；每人每天最多计 2 张，累计达到 50 张。', 'SHOPPING', 'LISTED', 50, 93, false),
('SHOPPING_COMPLETION_100', 'SHOPPING_COMPLETION', 'MEAL_CHECKIN', '采购完成100张', '累计达成100张，把认真安排生活的每一步留下记录。', '完成非空采购清单且所有未删除项目均为已买；每人每天最多计 2 张，累计达到 100 张。', 'SHOPPING', 'LISTED', 100, 94, false),
('FRIDGE_MAINTENANCE_1', 'FRIDGE_MAINTENANCE', 'MEAL_CHECKIN', '食材维护1周', '累计达成1周，把认真安排生活的每一步留下记录。', '食材库发生真实新增或移除变化；每个自然周最多计 1 周，累计达到 1 周。', 'SHOPPING', 'LISTED', 1, 100, false),
('FRIDGE_MAINTENANCE_4', 'FRIDGE_MAINTENANCE', 'MEAL_CHECKIN', '食材维护4周', '累计达成4周，把认真安排生活的每一步留下记录。', '食材库发生真实新增或移除变化；每个自然周最多计 1 周，累计达到 4 周。', 'SHOPPING', 'LISTED', 4, 101, false),
('FRIDGE_MAINTENANCE_12', 'FRIDGE_MAINTENANCE', 'MEAL_CHECKIN', '食材维护12周', '累计达成12周，把认真安排生活的每一步留下记录。', '食材库发生真实新增或移除变化；每个自然周最多计 1 周，累计达到 12 周。', 'SHOPPING', 'LISTED', 12, 102, false),
('FRIDGE_MAINTENANCE_26', 'FRIDGE_MAINTENANCE', 'MEAL_CHECKIN', '食材维护26周', '累计达成26周，把认真安排生活的每一步留下记录。', '食材库发生真实新增或移除变化；每个自然周最多计 1 周，累计达到 26 周。', 'SHOPPING', 'LISTED', 26, 103, false),
('FRIDGE_MAINTENANCE_52', 'FRIDGE_MAINTENANCE', 'MEAL_CHECKIN', '食材维护52周', '累计达成52周，把认真安排生活的每一步留下记录。', '食材库发生真实新增或移除变化；每个自然周最多计 1 周，累计达到 52 周。', 'SHOPPING', 'LISTED', 52, 104, false),
('MEMORY_SHARE_STARTED_TOTAL_1', 'MEMORY_SHARE_STARTED_TOTAL', 'DINING_COLLABORATION', '回忆分享1场', '累计达成1场，把认真安排生活的每一步留下记录。', '完成饭局后由发起人主动发起微信回忆分享；每场饭局最多计一次，累计达到 1 场。', 'DINING_EVENT', 'LISTED', 1, 60, false),
('MEMORY_SHARE_STARTED_TOTAL_3', 'MEMORY_SHARE_STARTED_TOTAL', 'DINING_COLLABORATION', '回忆分享3场', '累计达成3场，把认真安排生活的每一步留下记录。', '完成饭局后由发起人主动发起微信回忆分享；每场饭局最多计一次，累计达到 3 场。', 'DINING_EVENT', 'LISTED', 3, 61, false),
('MEMORY_SHARE_STARTED_TOTAL_10', 'MEMORY_SHARE_STARTED_TOTAL', 'DINING_COLLABORATION', '回忆分享10场', '累计达成10场，把认真安排生活的每一步留下记录。', '完成饭局后由发起人主动发起微信回忆分享；每场饭局最多计一次，累计达到 10 场。', 'DINING_EVENT', 'LISTED', 10, 62, false),
('MEMORY_SHARE_STARTED_TOTAL_20', 'MEMORY_SHARE_STARTED_TOTAL', 'DINING_COLLABORATION', '回忆分享20场', '累计达成20场，把认真安排生活的每一步留下记录。', '完成饭局后由发起人主动发起微信回忆分享；每场饭局最多计一次，累计达到 20 场。', 'DINING_EVENT', 'LISTED', 20, 63, false),
('MEMORY_SHARE_STARTED_TOTAL_50', 'MEMORY_SHARE_STARTED_TOTAL', 'DINING_COLLABORATION', '回忆分享50场', '累计达成50场，把认真安排生活的每一步留下记录。', '完成饭局后由发起人主动发起微信回忆分享；每场饭局最多计一次，累计达到 50 场。', 'DINING_EVENT', 'LISTED', 50, 64, false),
('RECOMMENDATION_ADOPTED_TOTAL_20', 'RECOMMENDATION_ADOPTED_TOTAL', 'RECOMMENDATION_CONTRIBUTION', '推荐收录20次', '累计达成20次，把认真安排生活的每一步留下记录。', '菜谱或食材推荐经审核真实收录累计达到 20 次；不统计单位推荐。', 'RECOMMEND', 'LISTED', 20, 80, false),
('RECOMMENDATION_ADOPTED_TOTAL_50', 'RECOMMENDATION_ADOPTED_TOTAL', 'RECOMMENDATION_CONTRIBUTION', '推荐收录50次', '累计达成50次，把认真安排生活的每一步留下记录。', '菜谱或食材推荐经审核真实收录累计达到 50 次；不统计单位推荐。', 'RECOMMEND', 'LISTED', 50, 81, false)
ON CONFLICT ("code") DO NOTHING;
