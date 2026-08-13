# 功能执行单：随机页

## 一、执行状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 业务流程 | 已确认 | 已确认“选条件 -> 生成一桌 -> 逐道调整 -> 本桌缺口预检 -> 加入计划或去采购”主闭环 |
| 页面行为 | 已确认 | 已确认早餐 / 午晚餐规则、菜位交互、缺口预检、出口规则和随机记录边界 |
| 权限与状态 | 已确认 | 已确认随机页只读当前用户菜谱与冰箱事实，写计划和购物清单继续归真实 owner |
| 最小 API | 评审稿已确认 | 已形成随机生成、菜位替换、本桌缺口预检、计划写入升级和购物写入草案 |
| 最小表与约束 | 评审稿已确认 | 已形成随机页数据评审稿，明确标签字段、计划字段、购物来源语义和不新增随机表 |
| 三端实现 | 未开始 | 当前只交付开发前文档，不修改客户端、API、Admin、Prisma 或 migration |
| 真实验收 | 未开始 | 待接口、数据和页面实现完成后执行 |

## 二、目标

- 本功能要跑通的最小业务闭环：
  `选择餐次 / 人数 / 冰箱优先 -> 生成一桌菜单 -> 逐道保留/划掉/换菜 -> 本桌缺口预检 -> 处理 unknown / missing -> 加入计划或写入购物清单`
- 对应 V1 范围：
  家庭晚饭决策、个人计划、个人冰箱、个人购物清单，不扩到 AI、共享冰箱、复杂营养系统或儿童推荐

## 三、本轮范围

- 小程序端：
  `pages_meal/random` 从“3 套候选原型”改造成“单桌菜位决策台”
- 后端 API：
  随机生成、单菜位替换、本桌缺口预检、计划写入升级、购物写入
- 后台管理：
  本轮不新增后台页面；只要求后续数据标签有明确 owner
- 共享契约：
  冻结随机页最小 API / DTO、计划升级字段、购物写入入口和错误语义

## 四、本轮不做

- 儿童友好推荐
- 精确热量、蛋白质、脂肪、碳水等营养计算
- AI 自动解释推荐理由
- 随机结果持久化草稿表、随机历史表、随机候选缓存中心
- 共享冰箱、共享采购决策、多人实时协同编辑

## 五、业务流程与页面行为门禁

### 5.1 业务流程

- 用户目标：
  让系统先给出一桌可执行菜单，再在加入计划前把缺料和替换问题处理掉
- 触发条件：
  用户从首页四宫格、计划页或其他入口进入随机页
- 主成功路径：
  1. 选择 `早餐 / 午餐 / 晚餐`、人数和冰箱优先
  2. 系统按规则生成一桌菜单
  3. 用户逐道保留、划掉或换菜
  4. 进入本桌缺口预检
  5. 用户处理 `unknown / missing / partial`
  6. 用户选择“加入计划”或“确认这桌并去采购缺口”
- 失败 / 阻断路径：
  1. 当前条件候选不足，只返回可行子集并给降级提示
  2. `unknown` 未处理时不能加入计划
  3. `missing` 菜位未明确处理时不能加入计划
  4. 计划版本冲突时返回 `409`
  5. 购物清单写入重复时按幂等重放第一次结果
- 结束状态：
  1. 当前菜单写入计划
  2. 当前缺口写入购物清单
  3. 或用户停留在随机页继续调整，不写任何持久化事实
- 确认人 / 确认记录：
  本线程 2026-08-12 多轮确认，已冻结 unknown、keep pending、标签挂载层、菜位交互和缺口前置

### 5.2 页面行为

- 页面入口：
  首页四宫格 `随机`，后续允许计划页带当前日期进入
- 展示内容及用途：
  1. 条件栏：餐次、人数、冰箱优先
  2. 单桌菜单区：当前槽位与每道菜的决策状态
  3. 缺口面板：当前这桌的局部缺口，不展示全局缺口
  4. 底部确认栏：进入缺口、加入计划、去采购
- 用户操作：
  1. 生成一桌
  2. 逐道保留、划掉、换一道
  3. 当前菜位附加替换约束
  4. 缺口确认 `确认有 / 确认无 / 划掉 / 换菜 / 采购 / 保留待处理`
- 加载 / 空态 / 失败态：
  1. 首屏空态只允许生成，不展示旧候选
  2. 单菜位替换独立 loading
  3. 候选不足时显示降级提示，不报错中断
  4. 缺口预检失败时保留当前菜单，不清空用户操作
- 成功后的页面变化：
  1. 加入计划后跳计划日期确认或计划结果
  2. 去采购后跳缺口采购处理或购物清单
  3. 两种成功都可记入随机记录
- 本流程不需要的页面数据：
  1. 不需要全局待处理饭局缺口
  2. 不需要完整菜谱步骤正文
  3. 不需要计划页周视图数据

### 5.3 门禁结论

- [x] 业务流程已确认
- [x] 页面行为已确认
- [x] 现有接口、表和页面仅作为候选实现，没有被当作需求证据

## 六、领域与商业化评估

- 数据归属：`USER`
- Free 基础：
  可使用随机页、缺口预检、加入计划和购物写入
- 付费增量：
  本轮不新增随机页专属付费能力
- 权益作用域：`USER`
- 权益类型：`功能`
- 到期与超额行为：
  计划、菜谱和购物清单仍服从现有个人额度与存储策略
- 数据保留与迁出：
  随机页本身不产生独立长期主事实；计划和购物继续按原域保留策略处理
- 配置来源：`USER / INSTANCE / SAFETY`
- 隐私、安全与合规：
  冰箱、忌口、缺口和购物清单都只按当前用户范围读取和写入
- 是否涉及 Reserved 的 OCR、AI、Pro 或多家庭：
  否

## 七、CTO 拆解

| 端 | 负责人 | 最小任务 | 输入 | 输出 | 依赖 | 验收 |
| --- | --- | --- | --- | --- | --- | --- |
| 小程序 | Frontend | 重构 `pages_meal/random` 为单桌菜位决策流 | 随机页状态机稿、API 契约 | 页面状态、菜位卡、缺口面板、出口动作 | API 契约冻结 | 真机完成主闭环 |
| 后端 | Backend | 提供随机生成 / 替换 / 缺口预检 / 计划升级 / 购物写入 | API / DTO 草案、数据标签结论 | Controller、DTO、Service、OpenAPI | 数据字段冻结 | 真实接口验收 |
| 后台 | Admin | 本轮无新增页面；后续只承担标签数据 owner | 未来标签字段评审 | 无 | 数据评审 | 无 |
| 共享契约 | Main | 冻结路径、请求、响应、错误、幂等和过渡策略 | 本执行单、API 草案 | `api-contract / api-index / 本执行单` | 用户确认 | 文档评审通过 |

## 八、开发者最小任务确认

### 8.1 小程序确认

- 最小交付：
  单桌随机、菜位替换、缺口预检和计划 / 购物出口
- 依赖：
  新随机计算接口、升级后的 `POST /meal-plans`
- 是否先用 mock：
  不建议；本功能强依赖真实缺口和版本行为
- 不做项：
  不做全局历史、不做共享状态、不做通用随机引擎
- 验收方式：
  真机走“生成 -> 换菜 -> 缺口确认 -> 写计划 / 写清单”主路径

### 8.2 后端确认

- 最小交付：
  5 个最小动作：
  `generate / replace / gap preview / meal-plans upgrade / shopping from random`
- 数据表 / 事务边界：
  计算接口不落库；计划写入和购物写入各自独立事务
- 错误码：
  `400` 参数非法、`401` 未登录、`403` 越权、`404` 资源不存在、`409` 计划版本冲突、`503` 标签或功能未就绪
- 不做项：
  不建随机草稿表、不建候选缓存表、不建随机历史表
- 验收方式：
  真实接口 + 权限 + 并发 + 幂等路径
- 状态机 / 权限矩阵：
  写计划仍走计划 owner；写购物仍走购物 owner；无权不允许读他人冰箱或菜谱
- 配置解析与实例冻结：
  无实例化配置中心；规则直接来自当前业务冻结
- 到期 / 清理任务：
  无额外定时清理；随机页不新增持久化草稿

### 8.3 后台确认

- 最小交付：
  本轮无
- 页面入口 / 权限：
  无
- 依赖：
  后续标签字段评审
- 不做项：
  不做随机配置后台
- 验收方式：
  无

## 九、接口契约

接口契约以 `docs/api-contract.md` 为最终共享基线；本节给出随机页评审入口。

| 方法 | 路径 | 用途 | 权限 | 幂等 | 版本字段 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `POST` | `/random-menus/generate` | 生成一桌菜单 | 登录用户 | 否 | 无 | 评审稿 |
| `POST` | `/random-menu-slots/replace` | 替换单个菜位 | 登录用户 | 否 | 无 | 评审稿 |
| `POST` | `/random-menu-gap/preview` | 本桌缺口预检 | 登录用户 | 否 | 无 | 评审稿 |
| `POST` | `/meal-plans` | 写入当前餐次计划 | 计划 owner | 是 | `expectedVersion` | 待升级 |
| `POST` | `/shopping-items/from-random-menu` | 把当前缺口写入购物 | 购物 owner | 是 | 无 | 评审稿 |

## 十、最小数据表与约束

| 主事实 / 关系 | owner | 必要字段 | 生命周期 | 外键 / 唯一 / Check | 对应真实查询 | 是否复用现有结构 |
| --- | --- | --- | --- | --- | --- | --- |
| 菜谱推荐标签 | `RecipeVersionTag` | `dishRole / mealType / mainProteinType / primaryIngredient / flavorProfile / spiceLevel` | 随版本冻结 | `recipeVersionId + tagCode + source` 唯一约束 | 随机生成、替换筛选 | 新增独立标签表 |
| 计划菜位扩展 | `MealPlanDish` | `slotType / purchaseState` | 跟随计划项 | `planItemId + sortOrder` 继续保留 | 计划展示、计划再编辑 | 复用现有表，待补字段 |
| 随机页运行态 | 页面本地 | `conditions / slotPlan / slots / gap` | 页面会话内 | 不落库 | 页面渲染 | 不新增表 |

- 可以从现有主事实重算、不新增持久化的内容：
  随机候选、缺口预检结果、替换约束、随机记录避重候选池
- 明确不新增的表、字段、枚举和索引：
  不新增随机历史表、随机候选缓存表、随机上下文表、随机结果表
- migration 部署与回退边界：
  先冻结标签字段和计划扩展字段，再做前向 migration；不保留长期双 DTO

## 十一、各端类型

- `apps/api` DTO / 响应：
  新增随机页 DTO，升级 `CreateMealPlanDto` 与 `MealPlanMenuItem*`
- `apps/client` API 类型：
  新增 `pages_meal/apis/random.ts` 和升级后的计划类型
- `apps/admin` API 类型：
  本轮无新增

## 十一点五、配套数据评审

随机页的最小数据表 / 字段约束评审稿见：

- [random-page-data-review.md](/Users/yangpenghui/personal/cook/docs/plans/random-page-data-review.md)
- [random-page-schema-dto-openapi-review.md](/Users/yangpenghui/personal/cook/docs/plans/random-page-schema-dto-openapi-review.md)

## 十二、分批实施稿

随机页后续实现建议按 4 批推进，每一批都只改真实 owner 文件，不跨批次顺手扩抽象。

### 12.1 第一批：Schema 与共享契约

目标：

- 冻结 Prisma、DTO、OpenAPI、共享类型

建议 owner 文件：

- `apps/api/prisma/schema.prisma`
- `apps/api/src/contracts/dtos.ts`
- `apps/api/src/contracts/openapi.ts`
- `apps/api/src/contracts/types.ts`
- `docs/api-contract.md`
- `docs/api-index.md`
- `docs/client-api.md`

本批只做：

1. `RecipeContentVersion` 标签字段
2. `MealPlanDish.slotType / purchaseState`
3. `ShoppingSourceType.RANDOM_MENU`
4. `CreateMealPlanDto` 从 `recipeIds[]` 升级到 `menuItems[]`

本批不做：

- Service 实现
- Controller 路由
- 前端页面改造

最小验证：

- `pnpm --filter @next-meal/api exec prisma validate --schema prisma/schema.prisma`
- `pnpm --filter @next-meal/api prisma:generate`
- `pnpm --filter @next-meal/api type-check`
- `pnpm --filter @next-meal/api verify:openapi`

### 12.2 第二批：后端接口与最小真实流程

目标：

- 提供随机页计算接口和升级后的计划 / 购物写入口

建议 owner 文件：

- `apps/api/src/modules/meal/meal.controller.ts`
- `apps/api/src/modules/meal/meal.service.ts`
- 如代码量确实过大，可新增：
  `apps/api/src/modules/meal/random-menu.service.ts`
- `apps/api/src/modules/pantry/` 下只改真正需要接入的购物写入 owner

本批只做：

1. `POST /random-menus/generate`
2. `POST /random-menu-slots/replace`
3. `POST /random-menu-gap/preview`
4. 升级后的 `POST /meal-plans`
5. `POST /shopping-items/from-random-menu`

本批不做：

- 计划页 UI 改造
- 随机页 UI 改造
- 后台标签编辑页

最小验证：

- `pnpm --filter @next-meal/api type-check`
- `pnpm --filter @next-meal/api build`
- `pnpm --filter @next-meal/api verify:openapi`
- 补充随机页真实流程脚本后执行对应 verify 脚本

### 12.3 第三批：随机页前端改造

目标：

- 把 `pages_meal/random` 从“3 套候选原型”改成“单桌菜位决策台”

建议 owner 文件：

- `apps/client/src/pages_meal/random/index.vue`
- `apps/client/src/pages_meal/apis/meal.ts`
- 新增：
  `apps/client/src/pages_meal/apis/random.ts`
- 新增局部组件：
  `apps/client/src/pages_meal/components/RandomConditionBar.vue`
  `apps/client/src/pages_meal/components/RandomMenuBoard.vue`
  `apps/client/src/pages_meal/components/RandomSlotCard.vue`
  `apps/client/src/pages_meal/components/RandomGapPanel.vue`
  `apps/client/src/pages_meal/components/RandomBottomBar.vue`

本批只做：

1. 页面状态机
2. 菜位级交互
3. 缺口预检面板
4. 写计划 / 写购物出口

本批不做：

- Pinia 持久化
- 全局随机状态
- 通用随机引擎

最小验证：

- `pnpm --filter @next-meal/client type-check`
- `pnpm --filter @next-meal/client build:mp-weixin`

### 12.4 第四批：计划页与购物页衔接

目标：

- 让新计划结构和购物来源结构在现有页面正确展示

建议 owner 文件：

- `apps/client/src/pages_meal/plan/index.vue`
- `apps/client/src/pages_pantry/` 下真正展示来源和购物项的页面
- `apps/client/src/pages_pantry/apis/shopping.ts`

本批只做：

1. `slotType / purchaseState` 展示
2. `RANDOM_MENU` 来源展示
3. 新计划创建结果和旧页面兼容收口

本批不做：

- 计划页大改版
- 购物页全量重构

最小验证：

- `pnpm --filter @next-meal/client type-check`
- `pnpm --filter @next-meal/client build:mp-weixin`
- 真实页面手测“加入计划 / 去采购”回跳链路

### 12.5 每批共用约束

1. 不在同一批次同时重写随机页、计划页和购物页视觉
2. 不为过渡引入 `manager / engine / adapter / center`
3. 每一批结束后更新 `docs/plans/minor_change_log.md`
4. 优先做纵切闭环，不顺手扩儿童友好、营养系统、共享冰箱

## 十三、联调清单

- [ ] 小程序 mock 路径可跑通
- [ ] 后端接口测试通过
- [ ] 小程序接真实接口通过
- [ ] 权限 / 未登录 / 无权限路径通过
- [ ] 重复提交 / 幂等路径通过
- [ ] 版本冲突路径通过
- [ ] unknown / missing 阻断规则通过

## 十四、验收状态

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 开发完成 | 未完成 |  |
| 联调完成 | 未完成 |  |
| 机器检查 | 未完成 |  |
| 手动验收 | 未完成 |  |
| 可发布 | 否 |  |

## 十五、风险与遗留

- 风险：
  当前 `RecipeContentVersion` 缺少随机推荐最小标签，后端无法只靠现有 schema 做真实随机
- 风险：
  当前 `CreateMealPlanDto` 仍是 `recipeIds[]`，如果不升级会把随机页计划语义压扁
- 风险：
  `ShoppingItem.sourceType` 当前没有 `RANDOM_MENU`，如果不补来源语义，后续来源回溯会混淆
- 遗留：
  随机记录的最终落地位置与避重策略还未进入数据评审
- 发布前必须处理：
  标签字段、计划扩展字段、计划升级兼容策略

## 十六、范围自检

- 本次满足的用户确认规则：
  已把随机页从产品收口推进到正式执行单，覆盖安全、性能、命名、幂等、过渡拆分和最小接口面
- 每个文件为什么必须修改：
  本执行单用于冻结实现顺序；`api-contract` 用于冻结共享契约；`api-index` 和 `docs/index` 用于让后续实现按正式入口查阅
- 明确没有顺手加入的功能：
  未加入 AI、儿童友好、精确营养、共享冰箱、随机后台配置
- 因复用未被证明而没有提前增加的抽象：
  没有新增 `manager / engine / adapter / center` 类抽象
- 是否还能缩小改动而不破坏需求：
  不能；如果不补执行单和正式契约，下一步 API / 数据评审仍会回到口头状态
