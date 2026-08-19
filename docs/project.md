# 炊火记项目总览

## 文档定位

本文是给开发人员阅读的项目总文档，描述当前仓库的产品定位、V1 范围、技术选型、工程边界和核心实现规则。

AI 快速执行规则见 `AGENT.md`。菜谱规则见 `recipe.md`，食材与单位规则见 `ingredient.md`，会员、配置和空间规则见 `configuration.md`。`docs/cook/` 中的 Prisma、SQL 和早期产品方案只是来源材料，不覆盖当前产品规则。

## 项目定位

产品名：**炊火记**。

英文名：**Ember**。

产品定义：帮助用户独立管理菜谱、冰箱、计划和购物清单，并通过饭局协作共同决定下一顿吃什么的轻量小程序。

Slogan：**炊烟晚，人归缓，烟火暖流年**。

首要业务闭环：

`我想吃 -> 共同选择 -> 确认下一餐 -> 核对冰箱 -> 生成清单 -> 完成采购 -> 做饭 -> 留下并分享记忆`

菜谱流转闭环：

`浏览灵感或手动创建 -> 保存到私房菜 -> 安排个人计划或饭局 -> 做饭并沉淀个人记录`

产品不是聊天工具。所有协作都围绕菜谱发现、饭局邀请、菜单和带菜发生；冰箱和购物清单始终属于个人。

## V1 交付范围

V1 目标是跑通家庭下一餐闭环，包含：

1. “私房菜 / 灵感”菜谱结构、固定基础版本、字段级覆盖、灵感改编、图片独立化、派生做法和可重算空间计量。
2. 菜谱不设个人可配置的可见权限；灵感只展示系统内容和人工审核通过的用户推荐固定版本。
3. 个人冰箱、稀疏周计划、个人购物清单和食材缺口。
4. 饭局邀请、外部分享、参与状态、“我带菜”和本人饭局记录。
5. 购物清单按单张清单协作，不扩成长期共享空间。
6. 个人 Free/Plus/Pro/Ultra、回收站、广告减免和个性化展示。
7. 用户级“我的口味”、过敏与忌口安全、基础审计和必要的内容治理。
8. 系统菜谱导入、用户菜谱受控推荐、点赞与收藏统计、统一食材和单位库、个人食材及后台审核。

## V1 不做

V1 明确不包含：

1. 聊天、群聊、评论、私信、关注关系和公开家庭动态流。
2. 外卖、食材电商、价格比对、超市导购、履约闭环和精细财务记账。
3. 仓储级批次库存、成本核算和强制自动扣减库存。
4. 用户动态流、投稿活动、榜单和完整公开 UGC 运营闭环；V1 只开放菜谱固定版本的受控推荐与人工审核。
5. 通用饭票、积分钱包、积分充值、积分商城和与当前 Plus 无关的复杂支付产品。
6. 小票识别、OCR、AI 菜谱解析、AI 周计划和食材推荐。
7. 冰箱、计划、购物和饭局独立图片。
8. 主理人转让、共享冰箱、共享购物、食材认领和通用细粒度权限中心。
9. 以过敏安全、基础用餐闭环和退出作为付费墙。

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

infra/
  docker-compose/  # 本地开发环境
  scripts/         # 迁移、导入和运维脚本
```

关键约束：

1. 小程序业务代码不直接调用 `wx.*`，统一通过 `apps/client/src/platform/uni.ts` 适配层。
2. 三端按统一契约各自在应用内维护 API 类型和请求实现。
3. 后台管理独立部署，不与小程序共用前端资源。
4. `docs/cook/` 是冻结方案来源，顶层 `docs/*.md` 是当前执行规则。

## 三端联合开发机制

当前仓库按小程序端、后端 API、后台管理三端并行开发组织。参考其他项目的协作经验时，只复用契约先行、分层验收和变更记录机制，不把本项目当成迁移项目处理。

长期分工：

1. CTO / 技术负责人：资深前后端专家，负责功能纵切拆解、接口契约、数据边界、权限规则、联调顺序和验收口径。
2. 小程序开发：负责 `apps/client` 页面、状态、请求接入、平台适配和真机体验。
3. 后端开发：负责 `apps/api` 接口、Prisma、事务、鉴权、错误码、接口测试和 OpenAPI 输出。
4. 后台开发：负责 `apps/admin` 管理页面、表格表单、权限展示和后台接口联调。
5. 契约维护：后端维护 DTO 和 OpenAPI，小程序与后台按契约同步各自本地 API 类型。

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

1. 小程序路由默认只表达 `分包 / 页面`，不把菜谱、版本和状态流全部写进路径。
2. 后端 API 默认只表达资源和动作的最短稳定入口，不按数据库关系层层嵌套。
3. 后台路由按运营页面扁平组织，不按菜单树、权限树或数据模型树嵌套。
4. NestJS 模块按领域一级拆分，不在模块下继续堆多层子模块。
5. 本端 API 类型与请求保持扁平，避免按领域模型深度复制多层目录。
6. 路径超过两个业务语义层级时，必须先确认是否可以用 query、body、DTO、类型或注释承载上下文。

推荐方向：

```text
pages_recipe/detail
pages_meal/poll
pages_pantry/gap

GET /users/me
GET /recipes/{recipeId}
POST /meal-plans
GET /admin/users

modules/
  recipes/
  meals/
  shopping/
```

避免方向：

```text
pages/meal/recipe/version/detail
pages/admin/content/recipe/import/review

GET /meal-plans/{planId}/recipes/{recipeId}/versions/{versionId}/ingredients
POST /admin/content/recipes/import/batches/{batchId}/rows/{rowId}/publish

modules/meals/recipes/versions/public/adoptions
```

## 模块状态

| 状态 | 定义 | 实现要求 |
| --- | --- | --- |
| Engineering Foundation | 通用工程能力可供业务开发使用 | 必须通过类型、构建及基础安全验证，不代表业务验收 |
| In Development | 存在候选页面、接口或数据结构 | 回到功能执行单逐项确认，不能承诺兼容或上线 |
| Accepted | 业务、页面、权限、接口、约束和真实流程均已验收 | 才能进入发布口径 |
| Deferred | 当前明确延期 | 保留必要空返回或记录，不继续补实现 |
| Disabled | 骨架存在但业务不执行 | Controller 返回 503，客户端不注册入口 |
| Reserved | 只保留方向 | 不创建 Service、Controller 或客户端入口 |

V1 模块状态：

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| Auth / User / Request Boundary | Engineering Foundation | 可支持后续业务开发，具体页面流程仍按功能执行单验收 |
| Idempotency / Audit / Outbox | Engineering Foundation | 幂等和审计可复用；Worker 不启动 |
| DiningGroup | Disabled | 前台与后台入口已下线；历史表与兼容字段暂保留，不再作为当前产品模块继续开发 |
| Recipe / RecipeImport | In Development | 产品与页面规则见 `recipe.md` 和 `plans/recipe-execution.md`；候选实现需重新设计和验收 |
| Ingredient / Unit | In Development | 统一库和个人项规则已确认；API、数据约束、审核与换算仍未设计 |
| Meal / DiningEvent | In Development | 周计划和饭局候选实现存在，参与者身份约束待业务确认 |
| Fridge / Shopping | In Development | 个人数据候选实现存在，缺口生成规则待业务确认 |
| Share / Admin | In Development | 候选实现存在，需随对应业务纵切验收 |
| Inspiration / Review | In Development | 仅系统内容和人工审核通过的用户推荐版本；不扩展为通用公共 UGC |
| Worker / Outbox | Disabled | 表保留，V1 不启动 Worker |
| Entitlement / Membership / Storage | In Development | 收藏和草稿计量口径已确认；全量重算算法和真实计量仍待设计验收 |
| Background Asset | Deferred | 接口保留空值和 `false`，不实现上传和资产管理 |
| Payment | Deferred | 价格、周期和升级规则确认后再开发 |
| Activity / Achievement | In Development | 当前开放非货币勋章墙：依赖服务端完成餐次、完成饭局、采购闭环和推荐审核收录事实；后台只管理勋章模板上下架与展示信息，不开放后台发放、排行榜或任务中心 |
| Point / Ticket / OCR / AI | Reserved | 当前不创建业务入口或占位服务 |

尚未进入业务确认的问题统一记录在 `plans/business-development-todo.md`。清单用于防遗漏，不等于契约确认。

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

1. `RecipeContentVersion` 统一承载系统模板、个人修订、临时菜谱和灵感收录内容。
2. `RecipeContentVersion` 一旦创建即不可变。
3. 导入菜谱创建指向固定基础版本的个人入口；文本修改保存结构化覆盖，由服务端合并有效菜谱。
4. 首次新增、替换或加工图片时，暂按当前规则固化为个人独立版本；仅删除图片保存隐藏标记。
5. `MealPlanItem`、灵感收录版本和分享快照必须引用具体 `RecipeContentVersion`。
6. 系统模板升级不影响已经收藏、加入计划或加入饭局的固定版本。
7. 菜谱不设用户可配置的可见权限，但用户只能编辑自己的菜谱，广泛发现前必须具备内容治理。
8. 来源材料中的 `RestaurantRecipe` 不进入当前 Schema；当前实现统一使用 `Recipe`。
9. 旧技术快照没有任何计划、分享或迁出引用时可以清理；Free/Plus 均不提供用户可见编辑历史。
10. “另存为新做法”创建独立派生菜谱；上限按个人四档套餐解析，派生做法不能再次派生。

## 关键事务边界

以下流程必须使用服务端事务和版本校验：

1. 菜谱编辑：检查基础和个人版本，原子写入覆盖；图片独立化时固化有效正文和媒体引用。
2. 派生做法：锁定根菜谱，校验本人套餐、派生总数、菜谱数和空间后创建独立菜谱。
3. 加入餐食计划：锁定当前 `RecipeContentVersion`，`MealPlanItem` 不引用可变协作上下文。
4. 购物项合并：按请求头 `Idempotency-Key` 去重，同一清单内按 `mergeGroupKey` 原子合并。
5. 点菜确认：关闭征集、汇总回应、生成计划必须同事务完成。
6. 结束购物：归档清单、迁移未购项、批量入库必须同事务完成。
7. 成员加入：同时校验主理人邀请额度、接受人加入额度、邀请状态和并发版本。
8. 成员退出或移除：结束成员关系并保留必要历史参与事实，不触碰个人业务数据。
9. 会员升级：订单、支付回调和个人权益切换必须幂等且原子。

所有可重试写操作必须携带请求头 `Idempotency-Key`；共享可变对象必须携带 `version`。

## 数据库约束

Prisma Schema 覆盖基础表结构、普通索引和普通唯一约束。PostgreSQL partial index、check constraint 和触发器语义必须通过手写 SQL 迁移补充。

必须保留的约束：

1. `DishConcept` 全局 `searchKey` 唯一。
2. 已下线的历史关系作用域约束不得继续对新功能暴露为当前产品合同。
3. 灵感改编、私房菜来源和再次创建原版的唯一性范围必须先按 `plans/recipe-execution.md` 评审；现有候选约束不得直接视为最终契约。
4. `MealPlan` 同用户、日期、餐次只能有一个未取消计划。
5. 每个用户同一时间只能有一份 `ACTIVE` 购物清单。
6. `RecipeContentVersion` 的 `ingredients` 和 `steps` 不能原地更新。
7. 灵感菜谱只有通过必要的内容安全和人工审核后才能曝光；用户推荐提交必须固定版本，不能直接公开实时个人正文。
8. `UsageQuota` 数值不能为负；饭票和积分钱包当前不建业务模型或约束。
9. `Asset` 归属必须匹配 `scope`。
10. `IdempotencyRecord` 在操作作用域下唯一。
11. `FridgeItem(userId, ingredientId)` 在个人范围唯一，V1 不表达多批次库存。
12. 历史关系表中的唯一性约束只作为兼容事实保留，不再新增新的前台依赖。

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

1. 所有协作写入前都必须校验当前参与事实、个人套餐额度和角色权限。
2. 前端隐藏按钮不能替代服务端校验。
3. 被撤回或移除的协作者立即失去对应协作入口，但保留本人饭局参与记录和个人数据。
4. 分享预览只读可打开；导入和协作写操作必须建立可信微信身份。
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
