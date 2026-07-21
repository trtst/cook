# 下一餐项目总览

## 文档定位

本文是给开发人员阅读的项目总文档，描述当前仓库的产品定位、V1 范围、技术选型、工程边界和核心实现规则。

AI 快速执行规则见 `AGENT.md`。饭搭子生命周期见 `dining-group.md`，会员、配置和空间规则见 `configuration.md`。`docs/cook/` 中的 Prisma、SQL 和早期产品方案只是来源材料，不覆盖当前产品规则。

## 项目定位

产品名：**下一餐**。

产品定义：一个人或一组长期一起吃饭的人共同决定下一顿吃什么，管理饭搭子菜谱、冰箱、计划和购物清单，并通过饭局承接临时来客的轻量小程序。

核心表达：**不是菜谱大全，而是你家的下一餐。**

首要业务闭环：

`我想吃 -> 共同选择 -> 确认下一餐 -> 核对冰箱 -> 生成清单 -> 完成采购 -> 做饭 -> 留下并分享记忆`

菜谱流转闭环：

`广场浏览或手动创建 -> 固定版本收录到当前饭搭子 -> 实际进入计划 -> 按权限分享`

产品不是聊天工具。所有协作都围绕菜谱、点菜征集、餐食计划、冰箱和购物清单发生；备注必须附着于具体业务对象，不能脱离事项单独发送。

## V1 交付范围

V1 目标是跑通家庭下一餐闭环，包含：

1. 注册后自动创建单人饭搭子；每人只有一个活跃长期饭搭子。
2. 免费饭搭子为主理人加一名长期成员；饭搭子 Plus 总人数为 6。
3. 受邀人加入后冻结原空间，主动选择迁入；退出后恢复原空间并获得临时迁出快照。
4. 饭搭子菜谱创建、广场收录、固定版本、编辑写时复制、重复提示和全部可见菜谱带回。
5. 饭搭子冰箱、计划、参与关系、购物清单和本人需求归属。
6. 下一餐、点菜、食材缺口、购物和完成用餐的核心闭环。
7. 饭局临时邀请、参与点菜、本人饭局记录、非货币勋章入口占位和用户级“我的口味”。
8. Free/Plus 权益、统一逻辑空间、图片压缩、派生做法、回收站、升级折算和到期超额只读。
9. 系统菜谱导入、标准食材与别名治理、基础审计和后台管理。

## V1 不做

V1 明确不包含：

1. 聊天、群聊、评论、私信、关注关系和公开家庭动态流。
2. 外卖、食材电商、价格比对、超市导购、履约闭环和精细财务记账。
3. 仓储级批次库存、成本核算和强制自动扣减库存。
4. 用户公共投稿、优秀推荐曝光晋级和公开 UGC 运营闭环。
5. 通用饭票、积分钱包、积分充值、积分商城和与当前 Plus 无关的复杂支付产品。
6. 小票识别、OCR、AI 菜谱解析、AI 周计划和食材推荐。
7. 冰箱、计划、购物和饭局独立图片。
8. Pro、多家庭协作、多饭搭子切换和护工专业模式。
9. 以过敏安全、基础用餐闭环、退出和数据带回作为付费墙。

## 技术栈

| 层级 | 选型 | 备注 |
| --- | --- | --- |
| 小程序端 | uni-app + Vue 3 + TypeScript + Pinia | 首发目标为 mp-weixin |
| 后端 API | NestJS + TypeScript | Node.js 20+ |
| 数据库 | PostgreSQL | 15+ |
| ORM | Prisma | 固定 5.22.0 |
| 缓存与队列 | Redis + BullMQ | 重试、调度和后台任务 |
| 异步可靠交付 | PostgreSQL Outbox | V1 建表，Worker 不启动 |
| 对象存储 | 腾讯云 COS 或阿里云 OSS | 私有读，签名 URL |
| 后台管理 | Vue 3 + Element Plus | 独立 Web 应用 |
| API 契约 | OpenAPI 3.0 | 后端 decorator 自动生成 |

## 工程结构

```text
apps/
  client/          # uni-app 小程序
  admin/           # Vue 3 + Element Plus 后台
  api/             # NestJS API 服务
  worker/          # 独立 Worker，V1 不启动

packages/
  api-client/      # OpenAPI 生成的类型安全客户端
  domain/          # 纯 TS 领域实体和类型
  platform/        # 登录、支付、存储、分享等平台适配接口
  shared/          # 通用工具和常量

infra/
  docker-compose/  # 本地开发环境
  scripts/         # 迁移、导入和运维脚本
```

关键约束：

1. 业务代码不直接调用 `wx.*`，统一通过 `packages/platform` 适配层。
2. 前端与后端共享 `packages/domain` 的稳定类型。
3. 后台管理独立部署，不与小程序共用前端资源。
4. `docs/cook/` 是冻结方案来源，顶层 `docs/*.md` 是当前执行规则。

## 三端联合开发机制

当前仓库按小程序端、后端 API、后台管理三端并行开发组织。参考其他项目的协作经验时，只复用契约先行、分层验收和变更记录机制，不把本项目当成迁移项目处理。

长期分工：

1. CTO / 技术负责人：资深前后端专家，负责功能纵切拆解、接口契约、共享类型、数据边界、权限规则、联调顺序和验收口径。
2. 小程序开发：负责 `apps/client` 页面、状态、请求接入、平台适配和真机体验。
3. 后端开发：负责 `apps/api` 接口、Prisma、事务、鉴权、错误码、接口测试和 OpenAPI 输出。
4. 后台开发：负责 `apps/admin` 管理页面、表格表单、权限展示和后台接口联调。
5. 共享包维护：`packages/domain` 和 `packages/api-client` 默认由 CTO 或后端牵头修改，小程序和后台按契约消费。

每个功能按一条最小纵切链路推进：

```text
功能目标 -> CTO 拆解 -> 开发者最小任务确认 -> 契约冻结 -> 三端并行 -> 联调 -> 验收 -> 发布
```

CTO 拆解后必须分别与小程序、后端、后台开发者确认最小任务。确认项包括：

1. 本端最小交付是什么。
2. 本端依赖谁，输入是什么。
3. 本端输出什么给其他端。
4. 本轮明确不做什么。
5. 是否允许先用 mock 开发。
6. 如何证明本端任务完成。

未完成最小任务确认的功能，不进入正式开发；未完成接口契约确认的功能，不进入三端联调；未完成纵切验收的功能，不进入发布口径。

任务状态统一使用：

```text
待拆解 -> 待确认 -> 可开发 -> 开发中 -> 待联调 -> 联调中 -> 待验收 -> 已验收
```

功能执行单使用 `docs/templates/feature_execution_template.md`。一次性功能执行说明放入 `docs/plans/`，长期规则才沉淀到顶层 `docs/*.md`。

## 扁平化规则

前端路由、后端接口、后台路由和工程目录都默认扁平化。复杂领域关系通过参数、DTO、类型、服务、注释和文档表达，不通过多层目录或多段 URL 表达。

统一规则：

1. 小程序路由默认只表达 `分包 / 页面`，不把饭搭子、原空间、菜谱、版本和状态流全部写进路径。
2. 后端 API 默认只表达资源和动作的最短稳定入口，不按数据库关系层层嵌套。
3. 后台路由按运营页面扁平组织，不按菜单树、权限树或数据模型树嵌套。
4. NestJS 模块按领域一级拆分，不在模块下继续堆多层子模块。
5. 共享包只保留一级能力目录，避免 `domain/recipe/version/public/...` 这类路径。
6. 路径超过两个业务语义层级时，必须先确认是否可以用 query、body、DTO、类型或注释承载上下文。

推荐方向：

```text
pages_recipe/detail
pages_meal/poll
pages_pantry/gap

GET /dining-groups/current
GET /recipes/{recipeId}
POST /meal-plans
GET /admin/dining-groups

modules/
  recipes/
  meals/
  shopping/
```

避免方向：

```text
pages/dining-group/recipe/version/detail
pages/admin/content/recipe/import/review

GET /dining-groups/{diningGroupId}/recipes/{recipeId}/versions/{versionId}/ingredients
POST /admin/content/recipes/import/batches/{batchId}/rows/{rowId}/publish

modules/dining-groups/recipes/versions/public/adoptions
```

## 模块状态

| 状态 | 定义 | 实现要求 |
| --- | --- | --- |
| Active | V1 实际跑业务 | 注册 Controller、Service、Guard，并开放客户端或后台入口 |
| Disabled | 表和接口骨架存在，但业务不执行 | Controller 返回 503，客户端不注册入口 |
| Reserved | 只建表，不写服务实现 | 没有 Service，没有 Controller |

V1 模块状态：

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| Auth / User / DiningGroup | Active / 待扩展 | 登录、本人口味资料、唯一当前空间、加入冻结、退出恢复和快照头已实现 |
| Recipe | Active | 概念、模板、入口、版本、写时复制 |
| Meal / Poll | Active | 计划、点菜、我想吃 |
| Fridge / Shopping | Active | 冰箱、购物清单、缺口计算 |
| RecipeImport / Admin | Active | 系统菜谱导入、发布、治理 |
| Share | Active | 分享快照、预览、导入 |
| Public | Disabled | 表和接口骨架保留，客户端不开放公共投稿入口；优秀推荐后续启用 |
| Worker / Outbox | Disabled | 表保留，V1 不启动 Worker |
| Entitlement | Active / 待扩展 | 最小 Plus 授权、有效权益接口和成员席位解析已实现 |
| Membership / Storage | Target | 会员订单和真实空间账本按 `plans/dining-group-lifecycle-plan.md` 分阶段实现 |
| Payment | Target | 会员只允许直接付费；实现个人 Plus 到饭搭子 Plus 的现金补差和到期选择 |
| Activity / Achievement | Target / 待契约 | 非货币活动、成就和勋章墙方向已确认；当前只允许客户端入口占位，API/Schema/后台待完成事实冻结后再建 |
| Point / Ticket / OCR / AI / Pro | Reserved | 当前不创建业务入口或占位服务 |

## 核心领域模型

菜谱版本模型：

```text
DishConcept
  -> RecipeTemplate
  -> RecipeContentVersion
  -> Recipe
       sourceVersionId
       currentVersionId
```

核心规则：

1. `RecipeContentVersion` 统一承载系统模板、家庭修订、临时菜谱和公共菜谱内容。
2. `RecipeContentVersion` 一旦创建即不可变。
3. 修改食材、用量、步骤或步骤顺序时，基于当前内容创建新的技术快照，再原子切换 `currentVersionId`；该快照不作为用户可见编辑历史。
4. 修改本地名称、备注、分类和展示信息时，只更新饭搭子入口，不创建内容版本。
5. `MealPlanItem`、公共版本和分享快照必须引用具体 `RecipeContentVersion`。
6. 系统模板升级不影响已经收录到饭搭子的固定版本。
7. 私人饭搭子菜谱不能通过全局搜索、相似指纹或采用统计泄露给其他饭搭子。
8. 来源材料中的 `RestaurantRecipe` 不进入当前 Schema；当前实现统一使用 `Recipe`。
9. 旧技术快照没有任何计划、分享或迁出引用时可以清理；Free/Plus 均不提供用户可见编辑历史。
10. Plus 的“另存为新做法”创建独立菜谱：根菜谱 `rootRecipeId = null`，派生做法指向根菜谱，同一根最多 2 个且不能再次派生。

## 关键事务边界

以下流程必须使用服务端事务和版本校验：

1. 菜谱写时复制：检查 `baseVersionId`，创建新版本，原子切换当前版本。
2. 派生做法：锁定根菜谱，校验写权限、个人/饭搭子 Plus、派生总数、菜谱数和空间后创建独立菜谱。
3. 加入餐食计划：锁定当前 `RecipeContentVersion`，`MealPlanItem` 不引用可变饭搭子入口。
4. 购物项合并：按 `operationId` 去重，同一清单内按 `mergeGroupKey` 原子合并。
5. 点菜确认：关闭征集、汇总回应、生成计划必须同事务完成。
6. 结束购物：归档清单、迁移未购项、批量入库必须同事务完成。
7. 成员加入：校验唯一活跃饭搭子、成员上限、原空间冻结和邀请状态，不能产生部分成功。
8. 成员退出：结束成员关系、恢复原空间、生成迁出快照和保留参与关系必须保持一致。
9. 会员升级：补差订单、支付回调和权益切换必须幂等且原子。

所有可重试写操作必须携带 `operationId`；共享可变对象必须携带 `version`。

## 数据库约束

Prisma Schema 覆盖基础表结构、普通索引和普通唯一约束。PostgreSQL partial index、check constraint 和触发器语义必须通过手写 SQL 迁移补充。

必须保留的约束：

1. `DishConcept` 全局 `searchKey` 唯一。
2. 饭搭子私有 `DishConcept` 必须在饭搭子作用域内唯一。
3. 同一饭搭子同一来源版本只能有一个未归档入口。
4. `MealPlan` 同饭搭子、日期、餐次只能有一个未取消计划。
5. 每个饭搭子同一时间只能有一份 `ACTIVE` 购物清单。
6. `RecipeContentVersion` 的 `ingredients` 和 `steps` 不能原地更新。
7. 公共菜谱只有安全通过后才能曝光；V1 中公共曝光保持 `NONE`，系统推荐广场不依赖用户投稿。
8. `UsageQuota` 数值不能为负；饭票和积分钱包当前不建业务模型或约束。
9. `Asset` 归属必须匹配 `scope`。
10. `IdempotencyRecord` 在操作作用域下唯一。
11. `FridgeItem(diningGroupId, ingredientId)` 唯一，V1 不表达多批次库存。
12. 唯一当前饭搭子和快照有效期约束已经落地；空间账本和回收清理约束在对应模块实现时补齐。

## API 协议

所有接口统一返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "serverTime": "2026-07-18 12:00:00"
}
```

Disabled 模块统一返回：

```json
{
  "code": 503,
  "message": "功能开发中，敬请期待",
  "data": null
}
```

前端业务判断优先使用返回体 `code`，但 HTTP 状态码仍保持语义化。

## 命名规则

命名必须短、直接、按职责表达。代码标识符使用简短驼峰，最多 3 个单词。

禁止用加工过程或空泛抽象命名，例如：

- `normalizedX`
- `formattedX`
- `processedX`
- `dataManager`
- `serviceAdapter`
- `handlerCenter`
- `commonBaseX`

推荐用结果角色或业务含义命名，例如：

- `searchKey`
- `dishName`
- `currentDish`
- `buildMeal`
- `resolveQuota`
- `createPlan`

如果短命名不足以解释上下文，通过注释说明职责、边界或特殊原因，不要把完整解释塞进变量名。

## 权限与安全

1. 所有饭搭子数据写入前必须校验唯一活跃饭搭子、成员状态、空间状态和角色权限。
2. 前端隐藏按钮不能替代服务端校验。
3. 被移除成员立即失去完整饭搭子访问权，但保留本文允许的参与记录、退出快照和数据带回能力。
4. 分享预览只读可打开；收录、迁入和饭搭子写操作必须建立可信微信身份。
5. 分享快照只包含公开白名单字段，不能包含冰箱、忌口、过敏、内部主键或私人备注。
6. 对象存储访问必须先做业务权限校验，再签发短期 URL。
7. 过敏和忌口提醒永久免费，敏感原始资料不向无关参与人暴露。
8. 空间超额只读时仍允许查看、永久清理、导出、退出和续费，不得阻断数据迁出。

## 验证要求

开发完成后至少验证：

1. 主成功路径可用。
2. 参数错误、权限失败或状态冲突路径有明确结果。
3. 统一返回结构符合协议。
4. 涉及写操作时，弱网重试不会重复写入。
5. 涉及共享状态时，版本冲突不会静默覆盖。
6. 涉及菜谱时，历史计划、分享快照和已导入版本不被后续修改影响。
