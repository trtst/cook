# 饭搭子协作后端执行单

## 一、执行状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 业务流程 | 已确认 | 已确认“征集 -> 回应 -> 确认菜单 -> 我来做 / 我带菜 -> 完成餐次 -> 饭搭子卡”主线 |
| 页面行为 | 已确认 | 首页轻动态、征集页、结果汇总页、分工页职责已在上游文档冻结 |
| 权限与状态 | 已确认 | `meal-polls / dining-group-activities / dining-events/{eventId}/cook` 的角色边界已进正式共享契约 |
| 最小 API | 已确认 | 共享契约已同步到 `api-contract / client-api / api-index` |
| 最小表与约束 | 部分确认 | 可复用结构、必加表、唯一约束、索引和事务边界已收口；仍有 3 个 P0 决策待定 |
| 三端实现 | 未开始 | 本文只冻结后端实现边界，不改 Prisma、DTO、Service 或 migration |
| 真实验收 | 未开始 | 待 P0 决策冻结后再进入代码实现 |

## 二、目标

- 本功能要跑通的最小业务闭环：
  `发起点菜征集 -> 成员提交回应 -> 主理人确认最终菜单 -> 生成或更新餐次与饭局 -> 成员对菜单项执行“我来做” -> 首页读取最近轻动态`
- 对应 V1 范围：
  - 点菜征集
  - 首页轻动态
  - 我来做
  - 继续复用已存在的我带菜、饭局完成和分享快照

本轮只交付后端执行基线，不进入代码实现。

## 三、本轮范围

- 后端 API：
  - `apps/api/src/contracts/*`
  - `apps/api/src/modules/meal/*`
  - `apps/api/src/common/idempotency.ts`
- 数据层：
  - `apps/api/prisma/schema.prisma`
  - 新增前向 migration 的目标边界
- 验证：
  - `apps/api/scripts/verify-meal-pantry-flow.ts`
  - 或未来拆分 `verify-meal-poll-flow.ts`
- 共享契约：
  - `docs/api-contract.md`
  - `docs/client-api.md`
  - `docs/api-index.md`

## 四、本轮不做

- 记忆墙、动态完整历史页、动态评论、动态已读。
- 扫码入群、通讯录拉人、新邀请形态。
- 共享冰箱、共享购物清单、食材认领、聊天或消息中心。
- 餐后反馈统计、家庭回顾、掌勺排行榜。
- 通用动态中心、通用投票引擎、通用协作权限系统。

## 五、P0 必须先定

以下 3 项未定前，不建议直接进入 Prisma 和 Service 实现。

### 5.1 点菜确认后生成的 `MealPlanItem / DiningEvent` 归谁所有

当前风险：

1. `POST /meal-polls/{pollId}/confirm` 允许 `OWNER / ADMIN` 执行。
2. 计划和饭局又是明确的个人对象。
3. 若不先定 owner，谁占用个人餐次唯一键、谁持有饭局、后续谁能完成或修改，都会随“最后点确认的人”漂移。

必须冻结成单一规则，不能按当前操作者动态决定。

建议待选：

1. 永远归征集创建人。
2. 永远归饭搭子 `OWNER`。

### 5.2 `/dining-events/{eventId}/cook` 的版本锁来源

当前共享契约要求 `expectedVersion`，但还没冻结到底锁：

1. 整场饭局：`event.version`
2. 单道菜：`menuItem.version`

未定前无法安全做并发冲突 `409`。

当前建议：

- 采用 `menuItem.version` 做菜级乐观锁，粒度更小，也更贴合“同一道菜只能一人认领”。

### 5.3 `/dining-group-activities` 的作用域来源

当前共享契约只写了“当前饭搭子最近 `3~5` 条”，但还没冻结：

1. 显式传 `diningGroupId` 查询。
2. 或服务端解析某个“当前饭搭子上下文”。

未定前容易退化成“按用户最近活动查”，造成多饭搭子串读。

当前建议：

- 显式要求 `diningGroupId` 查询参数，并在服务端按成员关系过滤。

## 六、可复用的现有主事实

| 结构 | 当前价值 | 结论 |
| --- | --- | --- |
| `meal_plan_items` | 已有 `user_id + plan_date + meal_slot` 唯一键、`status`、`completed_at`、`version`，适合继续承接“确认后落地个人餐次” | 可复用，但当前是单菜结构 |
| `dining_events` | 已有 `meal_plan_item_id` 一对一、`scheduled_at`、`location`、`status`、`version`、分享预览骨架 | 可复用，但当前是单菜单快照 |
| `dining_event_participants` | 已承接邀请、回应、分享加入和我带菜 | 可复用，但不能承接“我来做” |
| `idempotency_records` | 已支持 `operation_type / request_hash / result_json` | 直接复用到征集与认领写接口 |

## 七、必改与必加的主事实

### 7.1 必改

1. `MealPlanItem`
   - 当前只有 `recipeId / recipeVersionId / menuSnapshot` 单菜结构。
   - 与“最终菜单是多道菜、每项固定版本”的共享契约冲突。
2. `DiningEventSummary`
   - 当前本地 `types.ts / openapi.ts / meal.service.ts` 仍停在 `menu` 单快照。
   - 必须补 `menuItems` 才能支持“我来做”。
3. `DiningEventParticipant`
   - 继续承接“我带菜”。
   - 不能承接“我来做”，后者是菜级责任，不是参与人级责任。
4. `DiningEvent.diningGroupId`
   - 现有邀请流程不会可靠写入。
   - 后续要按饭搭子归集轻动态，必须保证这里的 group 归属真实可用。

### 7.2 必加

| 主事实 / 关系 | owner | 最小字段 | 作用 |
| --- | --- | --- | --- |
| `meal_polls` | `DINING_GROUP` | `dining_group_id`、`plan_date`、`meal_slot`、`deadline_at`、`choice_limit`、`note`、`status`、`version` | 征集头 |
| `meal_poll_candidates` | `MEAL_POLL` | `poll_id`、`recipe_version_id?`、`title`、`source_type`、`status`、`suggested_by_user_id?` | 候选菜与建议菜 |
| `meal_poll_responses` | `PARTICIPATION` | `poll_id`、`user_id`、`note`、`responded_at` | 每个成员一份回应头 |
| `meal_poll_response_items` | `PARTICIPATION` | `response_id`、`candidate_id` | 回应明细 |
| `dining_group_activities` | `DINING_GROUP` | `dining_group_id`、`kind`、`state`、`actor_user_id?`、`title`、`detail?`、`poll_id?`、`plan_item_id?`、`dining_event_id?`、`dedupe_key` | 首页轻动态摘要 |
| `dining_event_menu_items` | `DINING_EVENT` | `dining_event_id`、`recipe_version_id`、`title`、`cook_user_id?`、`version`、`sort_order` | 菜级认领 |

## 八、数据库约束与索引

### 8.1 必须有的唯一约束

1. `meal_polls`
   - `UNIQUE (dining_group_id, plan_date, meal_slot)`
2. `meal_poll_responses`
   - `UNIQUE (poll_id, user_id)`
3. `meal_poll_response_items`
   - `UNIQUE (response_id, candidate_id)`
4. `dining_group_activities`
   - `UNIQUE (dining_group_id, dedupe_key)`
5. `dining_event_participants`
   - 建议补 partial unique：
     `UNIQUE (dining_event_id, user_id) WHERE user_id IS NOT NULL`

### 8.2 必须有的 Check

1. `meal_polls.choice_limit`
   - `CHECK (choice_limit between 1 and 3)`
2. `dining_event_menu_items.version`
   - `CHECK (version >= 1)`

### 8.3 必须有的索引

1. `meal_polls`
   - `(dining_group_id, status, deadline_at)`
   - `(dining_group_id, plan_date desc, meal_slot)`
2. `meal_poll_candidates`
   - `(poll_id, status, id)`
3. `meal_poll_responses`
   - `(poll_id, responded_at desc)`
4. `meal_poll_response_items`
   - `(candidate_id)`
5. `dining_group_activities`
   - `(dining_group_id, created_at desc)`
6. `dining_event_menu_items`
   - `(dining_event_id, sort_order)`
   - 如需按责任人聚合，再补 `(dining_event_id, cook_user_id)`

### 8.4 不要加的东西

- 动态全文搜索索引。
- 动态评论表。
- 动态已读表。
- 记忆墙时间轴聚合表。
- 通用 `extraJson` 或征集大 JSON 字段代替结构化子表。

## 九、事务、并发、幂等

### 9.1 必须事务化的流程

1. 创建征集
   - 校验角色、饭搭子状态、实例冻结参数、候选菜版本引用
2. 提交或覆盖回应
   - 锁征集版本
   - 更新回应头
   - 重写回应明细
   - 写动态摘要
3. 确认最终菜单
   - 锁征集行
   - 校验 `expectedVersion`
   - 关闭征集
   - 汇总回应
   - 生成或更新 `MealPlanItem`
   - 生成或更新 `DiningEvent`
   - 重建 `dining_event_menu_items`
   - 写动态摘要
4. “我来做”认领或释放
   - 锁目标 `dining_event_menu_items`
   - 校验参与人资格、饭局状态和认领归属
   - 更新 `cook_user_id + version`
   - 写动态摘要

### 9.2 并发控制

1. `meal_polls` 用 `version` 做乐观锁。
2. `dining_event_menu_items` 用 `version` 做菜级乐观锁。
3. 双人同时开同餐次征集，唯一约束兜底，返回 `409`。
4. 双人同时认领同一道菜，后到者命中 `0 row updated`，返回 `409`。
5. 同一成员重复投票，只覆盖自己的旧回应，不影响其他成员。

### 9.3 幂等

沿用现有 `idempotency_records`，不新增第二套幂等表。

建议 `operation_type`：

- `meal-poll:create`
- `meal-poll:vote`
- `meal-poll:confirm`
- `dining-event:cook`

## 十、安全与性能

### 10.1 权限与越权

1. 征集列表和详情
   - 必须先验证当前用户是该饭搭子的有效成员
2. 发起和确认征集
   - 当前用户角色必须为 `OWNER / ADMIN`
3. “我来做”认领
   - 当前用户必须是该饭局的参与人或发起人
4. 释放认领
   - 默认只能释放自己已认领的菜
   - 若后续允许发起人释放别人，需单独冻结权限规则

### 10.2 隐私边界

动态和征集返回不得泄露：

1. 冰箱明细
2. 购物清单明细
3. 过敏、忌口原始资料
4. 内部备注
5. 未采用候选菜和投票明细全文

### 10.3 查询边界

1. `/dining-group-activities`
   - 只查当前饭搭子最近 `3~5` 条摘要
   - 不做全量历史
   - 不做长列表分页
2. `/meal-polls`
   - 列表只返回摘要
   - 不把成员逐条回应、建议菜全文和动态一起塞进列表
3. `/meal-polls/{pollId}`
   - 只需要当前有效回应
   - 不扩成回应修订历史
4. 不新增 `current/context/home` 大接口

## 十一、验证要求

实现前后至少补这些真实验收：

1. 同饭搭子同餐次不能重复开征集
2. 同一成员重复投票只覆盖自己
3. 截止后不能继续投票
4. 双人同时确认征集，只能成功一方
5. 双人同时认领同一道菜，只能成功一方
6. 重试不重复生成动态摘要
7. 非成员不能读征集或动态
8. 非参与人不能认领菜单项

## 十二、停止条件

出现以下情况时停止实现并重新确认：

1. `MealPlanItem / DiningEvent` owner 仍未冻结
2. `/cook` 的版本锁粒度仍未冻结
3. `/dining-group-activities` 的作用域仍未冻结
4. 需要把动态做成完整历史流、聊天或消息中心
5. 需要让“我来做”直接改写别人的购物、冰箱或菜谱所有权

## 十三、范围自检

- 本次满足的用户确认规则：
  - 继续沿“征集 + 轻动态 + 我来做”推进到后端可实现层
  - 显式考虑性能、安全、并发和幂等
- 每个文件为什么必须修改：
  - `docs/plans/dining-group-backend-execution.md`：冻结后端主事实、约束、事务、性能与安全边界
  - `docs/plans/minor_change_log.md`：满足仓库中央时间线要求
- 明确没有顺手加入的功能：
  - 记忆墙、动态历史页、扫码邀请、聊天、共享购物
- 因复用未被证明而没有提前增加的抽象：
  - 没有新增通用动态中心、通用投票引擎或协作权限中心
- 是否还能缩小改动而不破坏需求：
  - 如果还要更小，只能停在“征集 + 菜级认领 + 轻动态”后端冻结层；再缩就无法支撑当前正式契约
