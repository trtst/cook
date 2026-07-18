# 下一餐项目总览

## 文档定位

本文是给开发人员阅读的项目总文档，描述当前仓库的产品定位、V1 范围、技术选型、工程边界和核心实现规则。

AI 快速执行规则见 `AGENT.md`。详细产品方案、Prisma Schema 和手写 SQL 约束继续保留在 `docs/cook/`，作为冻结依据和追溯材料，不在本文中全文重复。

## 项目定位

产品名：**下一餐**。

产品定义：一家人共同决定下一顿吃什么，管理餐厅菜谱、冰箱和购物清单，并通过分享快照沉淀真实家庭做法和用餐记忆的轻量小程序。

核心表达：**不是菜谱大全，而是你家的下一餐。**

首要业务闭环：

`我想吃 -> 共同选择 -> 确认下一餐 -> 核对冰箱 -> 生成清单 -> 完成采购 -> 做饭 -> 留下并分享记忆`

菜谱流转闭环：

`大厅发现或餐厅创建 -> 固定版本加入餐厅 -> 实际进入计划 -> 有权公开分享 -> 真实餐厅采用`

产品不是聊天工具。所有协作都围绕菜谱、点菜征集、餐食计划、冰箱和购物清单发生；备注必须附着于具体业务对象，不能脱离事项单独发送。

## V1 交付范围

V1 目标是跑通家庭下一餐闭环，包含：

1. 微信登录、用户账号、餐厅创建、邀请成员、角色权限和餐厅切换。
2. 每个用户最多创建 1 个餐厅，最多加入其他 3 个餐厅。
3. 免费餐厅默认 `主理人 + 最多 3 名成员`，上限通过权益配置读取，不能散落写死。
4. 餐厅菜谱创建、编辑、分类、重复提示、系统模板补全和导入。
5. 菜谱大厅中的系统推荐广场、系统精选、分类搜索、按菜品概念聚合、已拥有状态和导入指定餐厅。
6. 菜品概念、系统模板、餐厅入口、统一不可变内容版本和写时复制。
7. 下一餐计划、点菜征集、统一 `我想吃`、想吃池、成员备注和结果汇总。
8. 随机一道菜、随机一桌、柔性槽位、锁定和重摇。
9. 餐厅冰箱三态记录、库存可信度、食材缺口计算和手动清单兜底。
10. 购物清单幂等合并、多人勾选、超市购物模式、结束购物和批量入库。
11. 分享快照、只读预览、重复导入拦截和饭搭子卡。
12. 系统菜谱导入、标准食材与别名治理、基础审计和后台管理。
13. 会员、饭票、权益、配额、支付和退款只预留数据结构与用量记录，不在 V1 客户端开放入口。

## V1 不做

V1 明确不包含：

1. 聊天、群聊、评论、私信、关注关系和公开家庭动态流。
2. 外卖、食材电商、价格比对、超市导购、履约闭环和精细财务记账。
3. 仓储级批次库存、成本核算和强制自动扣减库存。
4. 用户公共投稿、优秀推荐曝光晋级和公开 UGC 运营闭环。
5. 正式支付订单、会员售卖、饭票充值和正式退款链路。
6. AI 生成菜谱、复杂营养、救急模式和正式图片识别能力。
7. 以基础菜谱数量、随机、计划、冰箱、购物或基础分享作为付费墙。

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

## 扁平化规则

前端路由、后端接口、后台路由和工程目录都默认扁平化。复杂领域关系通过参数、DTO、类型、服务、注释和文档表达，不通过多层目录或多段 URL 表达。

统一规则：

1. 小程序路由默认只表达 `分包 / 页面`，不把餐厅、菜谱、版本、状态流全部写进路径。
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

GET /restaurants/mine
GET /recipes/{recipeId}
POST /meal-plans
GET /admin/restaurants

modules/
  recipes/
  meals/
  shopping/
```

避免方向：

```text
pages/restaurant/recipe/version/detail
pages/admin/content/recipe/import/review

GET /restaurants/{restaurantId}/recipes/{recipeId}/versions/{versionId}/ingredients
POST /admin/content/recipes/import/batches/{batchId}/rows/{rowId}/publish

modules/restaurants/recipes/versions/public/adoptions
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
| Auth / User / Restaurant | Active | 登录、创建、成员、权限 |
| Recipe | Active | 概念、模板、入口、版本、写时复制 |
| Meal / Poll | Active | 计划、点菜、我想吃 |
| Fridge / Shopping | Active | 冰箱、购物清单、缺口计算 |
| RecipeImport / Admin | Active | 系统菜谱导入、发布、治理 |
| Share | Active | 分享快照、预览、导入 |
| Public | Disabled | 表和接口骨架保留，客户端不开放公共投稿入口；优秀推荐后续启用 |
| Worker / Outbox | Disabled | 表保留，V1 不启动 Worker |
| Payment / Membership / Point | Reserved | 只预留表，不开放服务 |

## 核心领域模型

菜谱版本模型：

```text
DishConcept
  -> RecipeTemplate
  -> RecipeContentVersion
  -> RestaurantRecipe
       sourceVersionId
       currentVersionId
```

核心规则：

1. `RecipeContentVersion` 统一承载系统模板、家庭修订、临时菜谱和公共菜谱内容。
2. `RecipeContentVersion` 一旦创建即不可变。
3. 修改食材、用量、步骤或步骤顺序时，基于当前版本创建新版本，再原子切换 `currentVersionId`。
4. 修改本地名称、备注、分类和展示信息时，只更新餐厅入口，不创建内容版本。
5. `MealPlanItem`、公共版本和分享快照必须引用具体 `RecipeContentVersion`。
6. 系统模板升级不影响已经导入餐厅的固定版本。
7. 私人餐厅菜谱不能通过全局搜索、相似指纹或采用统计泄露给其他餐厅。

## 关键事务边界

以下流程必须使用服务端事务和版本校验：

1. 菜谱写时复制：检查 `baseVersionId`，创建新版本，原子切换当前版本。
2. 加入餐食计划：锁定当前 `RecipeContentVersion`，`MealPlanItem` 不引用可变餐厅入口。
3. 购物项合并：按 `operationId` 去重，同一清单内按 `mergeGroupKey` 原子合并。
4. 点菜确认：关闭征集、汇总回应、生成计划必须同事务完成。
5. 结束购物：归档清单、迁移未购项、批量入库必须同事务完成。
6. 成员加入和主理人转让：校验创建数、加入数、成员上限和角色状态，不能产生部分成功。

所有可重试写操作必须携带 `operationId`；共享可变对象必须携带 `version`。

## 数据库约束

Prisma Schema 覆盖基础表结构、普通索引和普通唯一约束。PostgreSQL partial index、check constraint 和触发器语义必须通过手写 SQL 迁移补充。

必须保留的约束：

1. `DishConcept` 全局 `searchKey` 唯一。
2. 餐厅私有 `DishConcept` 在 `(ownerRestaurantId, searchKey)` 下唯一。
3. `RestaurantRecipe` 同餐厅同 `sourceVersionId` 只能有一个未归档入口。
4. `MealPlan` 同餐厅、日期、餐次只能有一个未取消计划。
5. 每个餐厅同一时间只能有一份 `ACTIVE` 购物清单。
6. `RecipeContentVersion` 的 `ingredients` 和 `steps` 不能原地更新。
7. 公共菜谱只有安全通过后才能曝光；V1 中公共曝光保持 `NONE`，系统推荐广场不依赖用户投稿。
8. `UsageQuota`、`PointWallet` 数值不能为负。
9. `Asset` 归属必须匹配 `scope`。
10. `IdempotencyRecord` 在操作作用域下唯一。
11. `FridgeItem(restaurantId, ingredientId)` 唯一，V1 不表达多批次库存。

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

1. 所有餐厅数据写入前必须校验当前餐厅、成员状态和角色权限。
2. 前端隐藏按钮不能替代服务端校验。
3. 被移除成员必须立即失去餐厅数据访问权限，但保留自己的个人草稿。
4. 分享预览只读可打开；收藏、导入和创建餐厅等写操作必须建立可信微信身份。
5. 分享快照只包含公开白名单字段，不能包含冰箱、忌口、过敏、内部主键或私人备注。
6. 对象存储访问必须先做业务权限校验，再签发短期 URL。

## 验证要求

开发完成后至少验证：

1. 主成功路径可用。
2. 参数错误、权限失败或状态冲突路径有明确结果。
3. 统一返回结构符合协议。
4. 涉及写操作时，弱网重试不会重复写入。
5. 涉及共享状态时，版本冲突不会静默覆盖。
6. 涉及菜谱时，历史计划、分享快照和已导入版本不被后续修改影响。
