# 灵感菜谱私房收藏与全站推荐排序实施计划

> **终端与模拟器收尾（2026-10-11）：**按用户指定不启动 HBuilderX。`pnpm build:client:dev` 成功，输出 `dist/build/mp-weixin`；`pnpm dev:client:dev` 的运行目录 `dist/dev/mp-weixin` 也存在。全仓 `pnpm type-check`、API/Admin build 成功；收藏 Service 7 项、后台排序 Service 2 项通过。通过微信开发者工具 CLI 使用 `--auto-port 9520` 后接通当前模拟器。排序交互 4 项通过：灵感推荐首屏与 API 一致、切至最新与 API 一致、再切回推荐恢复且两种排序不同。收藏交互 9 项通过：本地临时用户在 `recipeId=10002272` 页面收藏后显示“已收藏”，私房菜“收藏的灵感”列表出现“豆芽汤”并保留“由清晨煮粥香整理”，页面再次点击移除后显示“收藏到私房菜”，收藏列表移除且 `collectCount` 回到 0。临时用户、收藏/幂等数据已清理，模拟器登录态已清空。`pnpm --filter @next-meal/api verify:saved-inspiration-http` 通过 10 项并确认临时数据清理。容量脚本复跑 5 轮（10,000 候选、500,000 收藏、2,000,000 计划明细），SQL 执行时间 1,496.746–1,520.451 ms，中位数 1,507.471 ms，结果为 `MEASURED_NOT_SLO_VERIFIED`；用户确认暂时没有 P95/QPS 目标，故只记录测量、不判定达标。`git diff --check` 无输出。目录映射：`pnpm dev:client:dev` -> `dist/dev/mp-weixin`；`pnpm build:client:dev` -> `dist/build/mp-weixin`。

> **收尾核对（2026-10-11）：**本地只读历史数据审计复跑结果仍为旧副本 0、收藏关系 0、收藏计数差异 0。为直达页面而临时调整的忽略目录 `dist/build/mp-weixin/app.json` 已通过 `build:mp-weixin:dev` 重新生成，页面顺序恢复为项目配置顺序；本地 API 开发进程已停止，`git diff --check` 无输出。此前有一张截图误拍到 Codex 桌面；随后在微信开发者工具模拟器实际加载灵感菜谱页并看到菜谱卡片。模拟器页面交互、排序切换和收藏按钮仍未操作验收。

> **HTTP/类型收尾（2026-10-11）：**新增的 `apps/api/scripts/verify-saved-inspiration-http.ts` 在 loopback API/数据库上通过 10 项检查，覆盖固定版本收藏、拒绝旧版本、私房菜列表与原整理者、下架后读取/拒绝新增/移除、恢复与审计；临时用户、菜谱、版本及关系清理已验证。最终 API type-check 通过，`git diff --check` 无输出。微信开发者工具自动化 WebSocket 未启动（仅发现本地 HTTP 服务端口 12961，9420 未监听），HBuilderX 自动化编译在测试运行前因内置 Sass 编译器不支持既有 `if(sass(...))` 语法失败；因此设备交互验收仍未完成，未为通过工具编译而改动产品样式。

> **终端构建/容量测量（2026-10-11）：**按目录语义，`pnpm build:client:dev` 执行 `uni build`，输出 `dist/build/mp-weixin`（开发配置的构建包）；`pnpm dev:client:dev` 执行开发运行模式，输出 `dist/dev/mp-weixin`。本地使用后者成功编译，随后 DevTools CLI 打开 `dist/dev/mp-weixin`。CLI 自动化端口 9420 已连接，但 uni-automator runtime 端口 9520 没有模拟器连接，故未计为页面交互验收。新增长期可复跑容量脚本，按 10,000 候选、500,000 收藏、2,000,000 计划明细，在临时表事务中对当前完整排序 CTE 执行 5 轮 EXPLAIN；PostgreSQL 18.4 / Apple Silicon 12 核本地执行时间 1,486.632–1,569.785 ms，中位数 1,494.466 ms，每轮临时读/写 159,322 / 209,573 blocks。结果只表示本机该合成负载下的测量；产品 SLO 与生产数据分布尚未确定，因此不作达标结论。

> **补充验收（2026-10-11）：**收藏 Service 定向单测扩至 7 项并全部通过，覆盖“来源版本已更新时拒绝旧版本收藏”“灵感菜谱下架后拒绝新增收藏”“下架后读取已有固定版本并允许移除”；首次运行暴露测试夹具未按 `status: ACTIVE` 条件过滤，修正夹具后重跑通过。真实本地 GET `/api/inspiration-categories` 返回 9 个分类，RECOMMENDED/LATEST 两种列表均成功、各返回 187 条候选；模拟器灵感页加载了本地 API 列表。DevTools Console 显示两个远程字体 CORS 错误和开发工具域名/TLS 配置提示；当前未发现阻止菜谱卡片渲染的错误，但字体跨域需另行处理或确认。尝试用 System Events 点击模拟器返回错误 `-25200`，所以没有操作收藏、计划或排序控件。

> **执行说明（2026-10-10）：**代码、迁移和静态验证已完成；本地 PostgreSQL schema 最新。匿名类别、推荐、最新 API 通过。使用临时本地用户验证收藏、同键重放、新键重复、并发双请求、私房菜列表、详情原整理者署名、取消和计数恢复；无个人菜谱副本，临时用户及收藏/计划关系已清理。计划 API 验证加入后目标菜排名从 16 到 10，取消后回到 16。SUPER_ADMIN 降权、同键重放、复位通过；保留 2 条预期审计记录，目标菜版本号从 2 增到 4，排序档位/原因恢复原值。当前本地有 189 道灵感菜谱、17 条计划菜谱明细；187 个公开候选实际排序 SQL 热缓存 `EXPLAIN (ANALYZE, BUFFERS)` 约 3.7 ms，但该规模不代表生产容量。`recipeId=10002473` 在本地不存在，无法复现用户当前账号状态。mp-weixin 构建已在微信开发者工具导入并启动首页模拟器；本轮未完成灵感页面交互验收，控制台出现静态资源字体 CORS 提示。仍待微信开发者工具/真机交互和代表性数据容量评估；生产迁移/部署未执行。保留工作区原有混合暂存改动，不提交、不推送。

**目标：**将灵感菜谱的收藏统一为“收藏到私房菜”，并让全站“推荐”结合近期私房收藏、近期加入计划、后台有限降权和新菜试推排序。

**架构：**以用户对灵感菜谱固定版本的收藏关系作为收藏主事实；服务端在公开灵感列表中统一计算候选排序，客户端只消费排序结果；后台可降低推荐优先级并记录原因，不能绕过审核/曝光状态。第一版使用近 30 天行为和 7 天新菜试推，数据和权重由后端统一维护。

**技术栈：**NestJS、Prisma、PostgreSQL、uni-app/Vue 3、Admin Vue 3/Element Plus、OpenAPI 3.0。

**依据：**`docs/recipe.md` 第十节、`docs/api-contract.md` 当前灵感与菜谱写入契约，以及已确认的产品方向和排序参数。具体参数列在“实施前确认项”，当前均已确认并落地。

## 全局约束

- 用户侧只有“收藏到私房菜”的概念；不新增合集入口、合集筛选或合集操作。
- 收藏灵感菜谱只建立收藏关系，不创建可编辑的个人菜谱副本；实际编辑并发布仍走个人菜谱流程。
- 收藏者不能替代原整理者；灵感详情继续显示来源菜谱冻结的 owner 昵称。
- 只有审核通过且当前允许曝光的灵感菜谱可进入排序；推荐分不能放宽安全、状态或权限门槛。
- 请求类型、响应 DTO、Prisma Model、内部评分策略保持分离；幂等写入使用 `Idempotency-Key`。
- 排序只由 API 服务端计算；Client 不自行重排、不基于收藏状态修改全站分数。
- 不新增评分星级，不开放后台可任意填写的数值权重或通用 JSON 配置。
- 保留现有工作区中的用户改动；同文件实施时按语义合并，不 reset、restore 或覆盖其他变更。

---

## 1. 当前状态与目标边界

### 实施前基线（说明本次改造原因）

- `Recipe.collectCount` 是菜谱上的冗余计数；当前 `RECOMMENDED` 使用 `collectCount desc, updatedAt desc, id desc`。
- `createMyRecipeFromInspiration()` 当前创建一条个人 `Recipe`，不增加收藏计数。
- 旧 `collectRecipe()` 通过 `RecipeCollection` 创建关系并更新 `collectCount`，且要求至少一个场景；这属于需要退出用户产品流程的旧合集写入语义。
- 灵感列表和详情当前主要返回 `collectCount`、`ownedRecipeId`；后台菜谱摘要当前没有推荐运营调整字段。
- `MealPlanDish` 保存 `recipeId / recipeVersionId / createdAt`，可用于统计近期计划行为；`MealPlanItem` 有用户和取消状态。
- 本工作区已有其他暂存和未暂存改动，且与 API、Admin 和菜谱文件有交叉；实施时必须保留。

### 已确认规则

1. 收藏就是把灵感菜谱收藏到私房菜，不是收藏到合集。
2. 同一用户对同一灵感菜谱的多个固定版本，收藏人数只计一人。
3. 收藏到私房菜不创建个人菜谱副本、不更改原整理者署名。
4. 用户编辑并发布后，才产生其本人可编辑的个人菜谱。
5. 推荐综合近期收藏、近期加入计划、新菜试推和后台有限降权；收藏总人数仍可作为展示统计。
6. 本方案建议近期窗口 30 天、新菜试推 7 天；后台只提供正常、后移、明显后移三档，不提供手填星级或分数。

### 本轮范围

- API：私房菜收藏关系、收藏状态、去重人数、计划行为聚合、全站推荐排序、排序 DTO/OpenAPI。
- 数据库：收藏事实的约束和计数回填；系统菜谱后台降权字段及迁移；需要时添加经查询证明必要的索引。
- Client：灵感卡片/详情收藏状态、收藏和取消、私房菜内“收藏的灵感”列表。
- Admin：系统菜谱列表/详情的推荐优先级调整和原因；审计记录。
- 文档：菜谱产品规则、API 契约、API 索引、菜谱执行单和中心变更日志。

### 本轮不做

- 不做用户画像、个性化排序或不同用户看到不同的推荐榜。
- 不做点赞、评论、关注、公开评分、排行榜或用户间行为展示。
- 不让 Admin 手工设置星级、任意权重、绝对排名或常规置顶。
- 不记录每次卡片曝光；以固定试推期作为第一版冷启动策略。
- 不将计划中的菜谱完成/烹饪作为本轮信号；只看有效的计划加入事实。
- 不删除被计划、饭局、分享等固定版本引用的历史 Recipe/RecipeContentVersion。

## 2. 业务流程和页面行为

### 收藏主路径

1. 用户在灵感列表卡片或详情页点击收藏。
2. 未登录时执行既有登录门禁；登录后服务端校验灵感菜谱仍可访问、固定版本仍有效。
3. 服务端按用户、来源菜谱和固定版本幂等写入收藏关系，并在同一事务维护收藏去重计数。
4. 成功后按钮变为已收藏；私房菜页“收藏的灵感”列表出现该固定版本，详情仍显示来源整理者。
5. 用户可从详情或私房菜列表移除收藏；若该用户仍收藏同一灵感菜谱的其他版本，收藏人数不变；移除最后一版时减一。
6. 用户需要编辑时，从原灵感显式进入编辑并发布流程。该发布形成个人菜谱，不沿用收藏状态或收藏署名。

### 失败与并发路径

- 收藏版本与灵感当前版本不一致：返回明确冲突，客户端刷新详情后重试。
- 菜谱下架、屏蔽或删除：拒绝新增收藏；已有收藏关系可移除。
- 重复收藏：幂等返回当前已收藏状态，不重复计数。
- 并发收藏/移除：锁定来源菜谱行或用等效事务策略，数据库唯一约束为最终防线。
- 匿名列表/详情：返回 `isSavedToPrivate = false`，不查询任何个人收藏关系。

### 页面行为

- 灵感卡片收藏图标反映本人状态；不展示“加入合集”。
- 灵感详情提供收藏/取消收藏；收藏成功留在当前详情，不跳编辑页。
- 私房菜页在个人菜谱之外提供“收藏的灵感”列表，收藏项只读、按收藏时间倒序，并可打开原灵感详情或移除收藏。
- 加入计划直接使用灵感固定版本 ID；不要求先收藏，也不通过个人菜谱副本引用。
- 列表继续保留“推荐 / 最新”选项；推荐排序完全由 API 返回顺序决定。
- 加载、空态、错误和未登录态沿用私房菜/灵感现有页面模式；取消收藏失败时恢复原状态并提示。

## 3. 推荐排序规则草案

### 候选资格

先应用既有灵感公开条件：`isInspiration = true`、状态可公开、有效分类和可读固定版本。筛选条件（关键词、分类、难度、时长）先作用于候选集，再计算排序，不允许通过分数重新纳入不合格菜谱。

### 信号定义

- `saveUsers30d`：近 30 天内建立有效私房菜收藏的不同用户数；同一用户、同一来源菜谱多个版本只算一人。
- `planAdds30d`：近 30 天内有效加入计划的菜谱条目数；只统计未取消的计划，按来源灵感固定版本归因。为避免单个用户重复建计划刷高信号，每个用户每道灵感菜在窗口内最多贡献 3 次。
- `collectCount`：当前有效收藏该灵感菜谱的去重用户总数，仅用于展示和运营核对，不直接作为推荐排序的长期累计信号。
- `newTrial`：菜谱首次进入公开灵感库后的 7 天内为新内容试推候选；用户提交审核但尚未通过时不开始计时。当前 Recipe 创建时点作为首次公开时点，编辑更新不重置试推期。
- `adminRank`：`NORMAL / DOWNRANK / STRONG_DOWNRANK`，由后台授权操作设置；同一档内再按自动分数排序。

### 推荐顺序

第一版采用可解释的确定性排序：

1. `NORMAL` 优先于 `DOWNRANK`，`DOWNRANK` 优先于 `STRONG_DOWNRANK`。
2. 每个推荐列表前 10 个位置中，若存在符合条件且处于试推期的新菜，保留 1 个新菜位置；选择其余排序最高的新菜填入该位置。人工降权菜不占新菜试推位。
3. 其余位置按行为分从高到低：

   `score = ln(1 + saveUsers30d) + 2 × ln(1 + planAdds30d)`

   加入计划代表更明确的用餐意图，首版权重建议为收藏的 2 倍；对计数取对数以减缓头部菜谱的累积优势。

   直观换算：1 位近期收藏者约得 `0.693` 分，1 次有效计划加入约得 `1.386` 分，2 次计划加入约得 `2.197` 分。因此一次收藏会增加推荐分，但不会保证排在所有菜谱之前；推荐仍综合其他人的近期计划行为、运营档位和试推位。

4. 分数相同按首次公开时间从新到旧，再按菜谱 ID 从大到小，保证翻页顺序稳定。
5. `LATEST` 按首次公开时间从新到旧、ID 从大到小；内容编辑不重置首次公开时间。

**参数定位：**30 天、7 天、每类列表 1 个新菜位置、每用户计划贡献上限 3 次、计划信号权重 2 倍均为本方案建议值，必须在开始实现前由用户确认或调整。服务端常量集中定义，不在 Admin 暴露可随意改分的字段。上线后用真实曝光/收藏/计划数据复盘参数；本轮不增加曝光埋点。

### 后台运营调整

- 后台只管理 `NORMAL / DOWNRANK / STRONG_DOWNRANK` 和必填原因。
- 选择 `NORMAL` 清除人工降权；`DOWNRANK`、`STRONG_DOWNRANK` 只改变排序档位，不修改审核状态、菜谱正文、收藏人数或计划数据。
- 内容安全和曝光资格继续由现有状态治理处理；运营降权不能让已下架/屏蔽菜谱重新出现。
- 每次调整写现有 Admin 审计事实，记录操作者、菜谱、旧值、新值、原因和时间；不复制保存另一份人工审计表。
- 详情/列表响应返回当前档位和原因给 Admin；公开 Client 不返回人工调整值或原因。

## 4. 接口与数据草案

### 建议接口

| 方法 | 路径 | 用途 | 权限 | 幂等 |
| --- | --- | --- | --- | --- |
| `GET` | `/recipes/saved-inspiration` | 当前用户私房菜中的收藏灵感分页 | UserBearerAuth | 否 |
| `POST` | `/recipes/saved-inspiration` | 收藏灵感固定版本到私房菜 | UserBearerAuth | `Idempotency-Key` |
| `DELETE` | `/recipes/saved-inspiration/{saveId}` | 移除当前用户收藏 | UserBearerAuth | `Idempotency-Key` |
| `GET` | `/inspiration-recipes` | 返回公开灵感列表及可选登录用户收藏状态 | Optional UserBearerAuth | 否 |
| `GET` | `/inspiration-recipes/{recipeId}` | 返回公开灵感详情及可选登录用户收藏状态 | Optional UserBearerAuth | 否 |
| `PUT` | `/admin/recipes/{recipeId}/recommendation-rank` | 修改人工推荐档位及原因 | SUPER_ADMIN | `Idempotency-Key` + `expectedVersion` |

以上是契约草案，进入 API/数据库实现前必须检查现有路由消费者和 OpenAPI，冻结最终路径、DTO 与错误语义。不要让新接口沿用 `collections` 命名。旧 `/collections/*` 和 `/recipes/from-inspiration` 的处理以全仓消费者清点及数据迁移评估为前置，不在没有检查的情况下直接删除或保留兼容写入。

### 私房菜收藏关系

优先评估复用现有 `RecipeCollection` 物理关系表，作为内部收藏事实存储；新 API、DTO、Client 文案统一使用“私房菜收藏”，不暴露合集或场景概念。收藏关系最少需要：

| 字段 | 语义 |
| --- | --- |
| `id` | 收藏关系公开 ID |
| `userId` | 收藏者，服务端从 token 读取 |
| `sourceRecipeId` | 被收藏的系统灵感菜谱 |
| `sourceVersionId` | 被收藏的固定正文版本 |
| `createdAt` | 本版本最近一次有效收藏时间，支持近期信号 |

- 唯一约束：`userId + sourceRecipeId + sourceVersionId`。
- 计数去重键：`userId + sourceRecipeId`；同一用户的多版本记录只贡献一人。
- 计数维护与关系写入、移除处于同一事务；删除关系时检查同一用户是否还持有该来源菜谱其他版本。
- `Recipe.collectCount` 作为可重算缓存保留；迁移从收藏主事实重算，禁止从客户端提交计数。
- 不新增“星级”字段；菜谱推荐档位使用明确枚举并受 SUPER_ADMIN 权限保护。
- 收藏关系是否需要 `version` 由实际删除/并发操作模型决定；不为简单插入额外增加共享对象版本。

### 推荐行为查询

- 近期收藏数可从收藏主事实按 `sourceRecipeId + createdAt + userId` 聚合 distinct user。
- 近期计划数从 `MealPlanDish` 联查 `MealPlanItem`，以来源灵感 `recipeId`、`createdAt`、用户和取消状态聚合；按用户每菜最多计 3 个有效条目。
- 列表查询必须在数据库分页前完成资格过滤、聚合和排序；禁止先按旧收藏量分页后在内存局部重排。
- 首选一条参数化 CTE/聚合查询返回排序 ID 和分数，再按这些 ID 批量 hydrate 现有 DTO，并按排序 ID 恢复顺序。
- 为上述 where/join/group 真实查询增加最小匹配索引；先用 `EXPLAIN (ANALYZE, BUFFERS)` 验证代表性数据成本。若当前候选规模下聚合仍超出预算，单独评估汇总表；本轮不预建每日统计表或通用推荐平台。
- [x] 可复跑容量测量：`pnpm --filter @next-meal/api benchmark:inspiration-ranking`；单事务临时表构造 10,000 候选、500,000 收藏和 2,000,000 计划明细，对当前完整推荐 SQL 运行 5 轮 `EXPLAIN (ANALYZE, BUFFERS)` 并输出 PostgreSQL 设置、每轮执行时间与 buffer/temp I/O。事务结束后临时表自动删除，无持久业务写入。2026-10-11 本机结果为 1,486.632–1,569.785 ms，中位数 1,494.466 ms；PostgreSQL 18.4、shared_buffers 128 MB、work_mem 4 MB、12 核 Apple Silicon。此前无脚本来源的 LATERAL/批量分组压测数值仅作历史记录，不作为本轮验收依据。
- 公共接口不返回用户级计数明细、后台原因或内部 score；如产品需要显示收藏人数，只返回 `collectCount` 汇总。

### 历史数据迁移门

1. 先新增只读审计脚本/SQL，统计现有 `RecipeCollection`、用户个人菜谱 `originVersionId`、固定计划引用及无法唯一反查来源菜谱的记录。
2. 对现有 `RecipeCollection` 关系重算 `collectCount`，保留来源版本和引用，不清空历史数据。
3. 对旧 `/recipes/from-inspiration` 产生的个人 Recipe 副本，只有在来源版本可唯一定位、当前正文版本仍等于来源版本且封面未修改时，才列入“可转换为收藏关系”报告。
4. 旧个人 Recipe 可能被计划/饭局/采购等引用；不得直接物理删除。转换前确认这些引用的读取行为。无法唯一定位或已改编的记录保留为个人菜谱，不猜测、不丢弃。
5. 迁移必须可重复、事务化、先 dry-run 后 apply；部署前由用户审阅审计报告和转换数量。生产数据库迁移须另行授权。

## 5. 文件责任图

| 文件/目录 | 计划责任 |
| --- | --- |
| `apps/api/prisma/schema.prisma`、新 migration | 收藏关系约束、推荐档位和必要索引 |
| `apps/api/src/modules/recipe/recipe.controller.ts` | 收藏 CRUD、公开列表/详情收藏状态与排序参数 |
| `apps/api/src/modules/recipe/recipe.service.ts` | 事务收藏/取消、收藏计数、计划聚合和稳定排序 |
| `apps/api/src/modules/auth/admin.controller.ts` | Admin 推荐档位写接口 |
| `apps/api/src/modules/admin/admin.service.ts` | 后台列表/详情字段、权限、幂等和审计 |
| `apps/api/src/contracts/dtos.ts`、`types.ts`、`openapi.ts` | 三端共享契约定义源及 OpenAPI |
| `apps/client/src/apis/recipe.ts` | 收藏请求、收藏列表和收藏状态类型 |
| `apps/client/src/pages/recipe/index.vue`、`apps/client/src/pages/recipe/card-info.test.ts` | 灵感卡片收藏状态及排序保持 API 返回顺序 |
| `apps/client/src/pages_recipe/detail/index.vue` | 灵感详情收藏/取消及原作者展示 |
| `apps/client/src/pages_recipe/list/index.vue` | 私房菜内收藏灵感列表与移除入口 |
| `apps/admin/src/apis/recipe.ts`、`apps/admin/src/pages/RecipesPage.vue` | 推荐档位、调整原因及操作反馈 |
| `apps/api/src/modules/recipe/*.test.ts`、`apps/api/src/modules/admin/*.test.ts` | 收藏计数、聚合排序、权限、幂等和并发回归 |
| `docs/recipe.md`、`docs/api-contract.md`、`docs/api-index.md`、`docs/plans/recipe-execution.md`、本文、`docs/plans/minor_change_log.md` | 业务事实、API、实施状态和剩余验收边界 |

如实作中发现组件/接口文件名称与本文不同，先定位实际 owner 并更新本执行单，再改代码；不得新建平行的通用推荐服务来绕过现有 Recipe 模块。

## 6. 任务拆解与顺序

### Task 1：契约冻结与数据审计

**交付：**明确用户收藏与列表行为；完成旧数据只读审计；冻结参数与接口草案。

- [x] 对照现有 Controller、DTO、页面调用点列出所有 `/collections/*` 与 `/recipes/from-inspiration` 消费者；见 `docs/plans/recipe-inspiration-ranking-audit.md`。
- [x] 检查 `RecipeCollection` 唯一约束、场景关系、所有权、删除和固定版本引用；见审计记录和 `schema.prisma`。
- [x] 对当前本地数据库执行旧个人副本映射只读审计；结果为 0 条记录，不能代表生产历史；见 `docs/plans/recipe-inspiration-ranking-audit.md`。
- [x] 执行方案确认 30 天窗口、7 天试推、top 10 中 1 个试推位置、计划每用户最多 3 次和 `planAdds` 权重 2。
- [x] 旧个人副本不自动转换、不删除；只读本地审计为 0 条，历史数据处理不扩展到生产库；新 Schema/migration 仅改变收藏/排序结构并已在授权的本地库应用。

### Task 2：收藏主事实和计数事务

**文件：**`schema.prisma`、migration、`recipe.controller.ts`、`recipe.service.ts`、API DTO/OpenAPI、收藏服务测试。

- [x] 覆盖同用户多版本去重、重复请求幂等、移除非末版本和移除末版本的收藏计数用例。
- [x] 收藏写接口校验公开灵感、当前固定版本、当前用户和收藏幂等键。
- [x] 关系创建、来源菜谱锁和首个持有人 `collectCount + 1` 在同一事务内完成。
- [x] 删除按当前用户/关系 ID 校验；仅移除最后一条来源关系时减计数，并保护计数不小于 0。
- [x] 收藏 list/detail 返回固定版本与来源 owner 快照，不创建个人 Recipe。
- [x] 本地迁移已应用并回填计数；只读审计确认本地收藏、旧副本和计数差异均为 0。

### Task 3：收藏状态与私房菜视图

**文件：**`apps/client/src/apis/recipe.ts`、`pages/recipe/index.vue`、`pages_recipe/detail/index.vue`、`pages_recipe/list/index.vue` 及对应最小视图测试。

- [x] 列表和详情 API 按可选登录态返回收藏状态；匿名态不查询用户收藏关系。
- [x] 卡片/详情收藏按钮按 API 状态显示，收藏与移除使用幂等请求。
- [x] 私房菜提供“收藏的灵感”分页，固定版本详情保留来源整理者并支持移除。
- [x] 收藏灵感只读；加入计划直接引用来源菜谱和固定版本。
- [x] 收藏流程不创建个人 Recipe；显式改编仍走个人菜谱编辑发布流程。
- [x] 移除用户侧合集列表/写入口和草稿 DTO 场景字段；只保留历史固定版本详情读取兼容路径。

### Task 4：推荐分数与数据库分页

**文件：**`recipe.service.ts`、推荐服务测试、Prisma 索引 migration（仅在查询计划证明必要时）。

- [x] 排序 SQL 回归用例检查近 30 天收藏/计划窗口、取消计划排除、每用户 3 次上限、2 倍计划权重、7 天试推、档位分支和 SQL 顺序恢复；完整数据库边界矩阵仍需真实 API/数据库验收。
- [x] 写参数化 SQL 聚合：候选资格和 filters -> 近期不同收藏用户 -> 近期有效计划 -> 人工档位 -> 新菜试推位 -> 数据库分页排序。
- [x] 按 SQL 排名 ID 批量 hydrate DTO，并保留 SQL 返回顺序。
- [x] 推荐分不使用 lifetime `collectCount`；该字段只用于展示。
- [x] `LATEST` 与推荐 tie-break 使用首次公开时间和 ID，内容更新不重置首次公开时点。
- [x] 已对本地 187 个公开候选运行实际排序 SQL 的 `EXPLAIN (ANALYZE, BUFFERS)`：热缓存约 3.7 ms，收藏和计划信号均使用新索引；本地只有 17 条计划明细，不能代表高负载，仍需用接近预期线上规模的数据做容量评估。

### Task 5：后台有限运营降权

**文件：**`admin.controller.ts`、`admin.service.ts`、Admin/API 类型与 OpenAPI、`apps/admin/src/apis/recipe.ts`、`RecipesPage.vue` 和 Admin 定向测试。

- [x] 使用 `NORMAL / DOWNRANK / STRONG_DOWNRANK` 三档，支持复位 `NORMAL`。
- [x] 请求要求幂等键、`expectedVersion` 和非空原因；仅 SUPER_ADMIN 可调整系统灵感菜谱。
- [x] 校验对象类型、公开状态和版本；不修改正文版本或审核状态。
- [x] 使用现有审计记录保存操作者、对象、前后档位和原因。
- [x] Admin 列表/详情展示档位，支持调整/复位并回显原因。
- [x] Client 公共 DTO 不包含后台原因、档位或内部 score。

### Task 6：契约与文档收口

**文件：**`docs/recipe.md`、`docs/api-contract.md`、`docs/api-index.md`、`docs/plans/recipe-execution.md`、本文及 `minor_change_log.md`。

- [x] 当前规则和 API 文档不再把合集或个人副本作为收藏流程；旧读取路径注明为固定引用兼容。
- [x] 同步收藏 list/detail/remove、登录态、错误、幂等和后台权限契约。
- [x] 同步收藏关系主事实、唯一键、30 天行为、7 天试推、推荐档位和稳定排序。
- [x] 文档区分代码/本地验证与曝光转化、设备和生产验收，不宣称未完成验收。
- [x] 已更新中心变更记录，列出通过项及仍待完成的真实验收。

### Task 7：机器验证和真实路径验收

- [x] 收藏/排序/后台调节定向测试通过。
- [x] API、Client、Admin type-check 与 OpenAPI verify 通过。
- [x] Client 微信小程序构建、API build、Admin build 通过。
- [x] Prisma validate 通过；授权的本地数据库 migration 已应用，`migrate status` 显示 schema up to date；本地只读数据审计和计数差异均为 0。
- [x] 匿名 `GET /api/inspiration-categories`、`GET /api/inspiration-recipes?sort=RECOMMENDED` 和 `LATEST` 返回成功；无 token 的收藏 POST 返回业务 `401`。本地 `GET /api/inspiration-recipes/10002473` 返回业务 `404`，故不能代表用户实际登录环境。
- [x] 使用临时本地登录用户验证收藏、同键重放、新幂等键重复、两个不同幂等键并发收藏、私房菜列表/详情状态、原整理者署名、移除重放、去重计数恢复及不创建个人菜谱副本；临时用户和关系已清理。
- [x] 真实计划 API 验证加入计划提高推荐位置（第 16 -> 第 10），取消后回到第 16；已取消计划的活跃信号计数为 0，临时用户/计划已清理。
- [x] SUPER_ADMIN 真实 API 验证 `DOWNRANK`、相同幂等键重放和复位 `NORMAL`；排序档位与原因恢复原值。预期保留两条审计记录，菜谱并发版本从 2 增至 4。
- [x] 收藏和推荐排序相关 Service 用例本轮合计 9 项通过，覆盖不同固定版本的收藏去重、移除计数、下架后读取原固定版本并移除、旧版本写入冲突及排序 SQL 行为。
- [x] 收藏 Service 用例覆盖下架后拒绝新增收藏、当前版本更新后拒绝收藏旧版本，以及下架后读取原固定版本并允许移除；loopback HTTP 专项脚本 10 项通过并验证临时数据清理。
- [x] 微信开发者工具模拟器完成排序切换、灵感卡片收藏/移除、私房菜收藏列表和原整理者署名验收；首屏顺序与 API 响应一致。两种排序有不同首屏，切换后可恢复。
- [x] 临时登录态下收藏状态写入并从页面移除，私房菜列表随之增删，`collectCount` 回到基线；清理临时用户、收藏和幂等记录，确认模拟器本地 session 已清空。DevTools 曾提示远程字体 CORS 和开发工具 TLS 配置；这些提示不影响本次列表渲染及交互。
- [x] 可复跑本地合成负载容量测量已完成，执行单记录数据规模、PostgreSQL 版本/关键设置、硬件、5 轮时间和临时 I/O；不产生持久业务数据。用户确认暂时没有 P95/QPS 目标，因此只记录测量、不判定达标，也不外推到生产数据分布；将来有目标和代表性负载时再执行目标化验收。
- [x] 已记录代码/本地数据库、真实 API 和模拟器交互结果；容量结论保持“已测量、未判定 SLO”。生产迁移/部署不属于本次授权，未执行。

## 7. 验收标准

- 一个用户将同一灵感菜谱不同版本收藏进私房菜，`collectCount` 仍只增 1；第二用户收藏后增至 2。
- 用户保存不会创建新个人 Recipe，不改变来源 owner；编辑发布才产生个人 Recipe。
- 同一用户反复点击、并发重试或相同版本重复请求均不重复计数。
- 取消其中一个固定版本不会错误减数；取消最后一版只减一次。
- `RECOMMENDED` 按确认的行为窗口、计划上限、Admin 降权和新菜试推稳定排序；不合格/下架菜谱永不因分数进入结果。
- 同一输入跨页顺序稳定；更新内容不重置首次公开时间；`LATEST` 与“首次公开时间”规则一致。
- 后台可调降权/复位，必须提供原因、有权限校验、幂等保护和审计；客户端无法读写运营字段。
- 旧数据迁移报告与重算计数可解释；固定计划/饭局/采购引用不丢失；歧义行不自动改写。
- 所有文档、OpenAPI、API/Client/Admin 类型和实际行为一致。

## 8. 发布与风险控制

1. 先完成只读数据审计及本地 migration dry-run；输出源记录数、可识别旧副本数、冲突数和预计计数变化。
2. 用户审阅历史副本处理清单后再决定 apply；不得为满足“无合集”而物理删除固定版本或依赖实体。
3. 代码上线前本地测试库执行 migration 和回归；生产 migration 与 deploy 需单独授权。
4. 新版 Client/API 同步发布，避免旧 Client 继续调用创建副本的接口或旧合集写接口。
5. 上线后抽样核对公开推荐排序和 `collectCount` 主事实；参数调整通过代码发布，不提供运营可任意输入数值。

主要风险：历史个人副本缺少直接的 sourceRecipeId；必须通过 originVersionId 唯一定位并检查固定引用。近期计划聚合可能成为列表热查询；先做 SQL explain 和索引验证，不以应用层全量读后排序。没有曝光埋点时，7 天试推不能精确测转化；首版只保证机会，不宣称算法已学习曝光效果。

## 9. 实施前确认项

- [x] 30 天行为统计窗口。
- [x] 新菜审核通过后试推 7 天。
- [x] 每个符合条件的列表前 10 位保留 1 个新菜试推位。
- [x] 计划加入信号权重为私房菜收藏的 2 倍；每用户每菜近 30 天最多计 3 次。
- [x] Admin 只可选择正常、后移、明显后移；不设默认五星、不提供手填权重/分数。
- [x] 旧“从灵感创建 Recipe”记录不自动转收藏或删除；本地只读审计为 0，生产历史须另审计。

## 10. 范围自检

- 满足的已确认需求：没有合集产品概念；收藏到私房菜；全站推荐纳入近期收藏、近期计划、后台有限降权和新内容试推。
- 必要文件：Recipe API/Service/Schema/契约、Client 收藏和列表、Admin 降权 UI、相关文档；每个范围对应上文文件责任图。
- 明确不做：个性化推荐、点赞、评论、通用推荐平台、曝光埋点、自动 AI 质量评分、Admin 任意调权。
- 不提前抽象：第一版不建通用 Ranker/策略配置平台，不引入队列或每日统计汇总服务。
- 缩小空间：收藏写入复用现有来源固定版本关系；推荐指标只聚合公开列表实际需要的两个近期信号。
