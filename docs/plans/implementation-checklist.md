# 炊火记落档功能执行清单

## 目的

本文把当前已经落档的功能文档整理成可执行清单，便于后续按项推进、打勾和回填状态。

使用规则：

1. 只把正式执行单中的功能放进本清单。
2. `规则稿 / 路线图 / 待确认问题池` 不作为可直接勾选的实现项。
3. 每完成一项，除了更新本清单，也必须同步更新 `docs/plans/minor_change_log.md`。
4. 状态以执行单中的“验收状态”和中央变更日志为准；若两者冲突，先回到执行单核对。

## 状态说明

- `[x]`：开发、真实联调与当前自动化主证据已完成，当前先直接标记，不因真机 / 微信开发者工具人工走查阻塞进度；待所有开发完成后，再按本清单统一做人工审查。
- `[~]`：已有实现或正在推进，但不是因为“只差最终人工走查”而留在这里；只有仍未完全可发布、仍有关键子项未冻结，或主实现还没真正收口的项才保留 `[~]`。
- `[ ]`：已落档但主实现未开始，或当前仍停留在文档 / 规则冻结阶段。
- `规则稿`：只提供规则和路线，不直接作为打勾项。

## 一、已落地或接近落地

| 状态 | 功能 | 当前结论 | 文档 |
| --- | --- | --- | --- |
| `[x]` | 后台用户管理 | 开发完成，联调完成，可发布；仍建议补后台浏览器与微信开发者工具手动验收 | `docs/plans/admin-user-management-execution.md` |
| `[x]` | 会员兑换码 / 体验码 / 后台发码 | 小程序核销、后台发码、状态治理已接通；剩余手动验收通过后可发首批真实码 | `docs/plans/membership-code-execution.md` |
| `[x]` | 登录基础链路 | 开发完成，`verify-login-flow` 已完成真实 API 联调，`HBuilderX cli launch mp-weixin --project /Users/yangpenghui/personal/cook/apps/client/src --compile true` 已于 Saturday, August 22, 2026 通过；另已于 Sunday, August 23, 2026 跑通 `/pages_me/account/index` 官方 `mp-weixin` 真实密码登录后的账号设置主状态自动化，已断言标题、`绑定手机号`、脱敏手机号与 `退出登录`；最终真机或微信开发者工具手验仍建议继续补齐 | `docs/plans/client-login-execution.md` |
| `[x]` | 菜谱创建 / 展示 / 后台 / 合集 | `verify:recipe-flow` 与 `verify:admin-recipe-flow` 已完成真实 API 联调，草稿/发布/我的/灵感/合集与后台用户菜谱域主路径已接通，`HBuilderX` 小程序编译链已通过；另已于 Sunday, August 23, 2026 跑通 `/pages/recipe/index` 真实登录态下的“我的菜谱”列表主状态自动化，已断言 `私房菜 / 灵感` Tab、激活态 `私房菜`、新发布菜谱标题与 `添加` 入口，以及 `/pages_recipe/detail/index` 真实灵感菜谱正文主状态自动化，已断言标题、`营养估算`、`食材清单`、`步骤`、`加入采购清单`；最终真机和浏览器主路径手验仍建议继续补齐 | `docs/plans/recipe-create-display-admin-collection-execution.md` |
| `[x]` | 厨房知识文章页 | 文章列表、详情、阅读、点赞接口已实现，`verify:knowledge-article-flow` 已于 Saturday, August 22, 2026 改为 `code-login` 干净账号后在本地 `3100` 实例重新真实通过，`HBuilderX` 小程序编译链已通过；另已于 Sunday, August 23, 2026 跑通 `/pages_me/knowledge-list/index` 真实登录列表主状态自动化，已断言后台新发布文章标题与 `阅读 / 点赞` 元信息，以及 `/pages_me/knowledge-detail/index` 真实登录态详情自动化，已断言已发布文章标题、阅读/点赞文案与点赞后 `已点赞` 状态切换；列表与详情主路径手验仍建议继续补齐 | `docs/plans/site-content-knowledge-article-execution.md` |
| `[~]` | 饭局详情 | 当前已按 Monday, August 24, 2026 最新 V1 第二批执行单重收口到“主家菜单 + 我想吃池 + 我带菜”：详情页旧 `待认领 / 认领 / 释放 / 我来做` 语义已退出前台，新增 `我想吃池` 最小链路与主家 `加入本次菜单`。本轮完成后需重新跑 `client/api type-check` 与饭局详情自动化，并继续补真机 / 微信开发者工具手验。 | `docs/plans/dining-event-detail-execution.md` |
| `[x]` | 首页最近安排 | 首页条件卡与 `/home/recent-arrangement` 已实现，`verify:dining-event-flow` 已覆盖未登录 `401`、无候选 `data: null`、`24~36h` 补位和同窗口饭局优先；`focus` 映射 / 解析 / 降级逻辑也已统一收口，并已通过客户端类型检查、`mp-weixin` 构建与 `HBuilderX` 编译链；另已于 Sunday, August 23, 2026 跑通 `/pages/home/index` 官方 `mp-weixin` 真实登录态下的首页最近安排主状态自动化，已断言无安排与有最近安排两条首页主状态、真实卡片标题/状态/动作，以及首页实际生成的 `focus` URL；并跑通 `/pages_meal/detail/index` 官方 `mp-weixin` `focus=shopping / focus=memory` 页面级自动化，已断言采购区块命中与无饭局时的正常降级；首页和详情页真机手验仍建议继续补齐 | `docs/plans/home-recent-arrangement-execution.md` |

## 二、已落档且仍有后续工作

### 2.1 主闭环与首页相关

| 状态 | 功能 | 当前结论 | 文档 |
| --- | --- | --- | --- |
| `[x]` | 首页四宫格 | 首页 `action-dock` 四坑位、按坑位上架/下架和四个场景页骨架已接通，`verify:home-action-dock-flow` 已于 Saturday, August 22, 2026 在本地 `3100` 实例真实通过，`HBuilderX cli launch mp-weixin --project /Users/yangpenghui/personal/cook/apps/client/src --compile true` 也已通过；另已于 Sunday, August 23, 2026 跑通 `/pages/home/index` 官方 `mp-weixin` 真实登录态下的首页主状态自动化，已断言 `饭局、计划、清单`、`还没有安排`、`今晚吃什么？`、未安排说明文案，以及四个 quick 入口标题 `翻菜谱 / 看食材 / 随机 / 缺什么`；首页真机走查与四个场景首页主路径手验仍建议继续补齐 | `docs/plans/home-action-dock-execution.md` |
| `[x]` | 首页本周灵感 | 本周灵感专题页、后台专题维护页、公开读取接口与首页专题入口路径已接通；`verify:home-weekly-topic-flow` 已于 Sunday, August 23, 2026 在本地 `3100` 实例真实跑通后台建专题/上架/公开读取与首页入口目标，`/pages_home/topic/index` 官方 `mp-weixin` 页面自动化同日也已在真实专题数据下断言专题标题、本期推荐、往期回顾、推荐菜标题与 `加入计划` 主状态；微信开发者工具或真机人工走查仍建议继续补齐 | `docs/plans/home-weekly-topic-execution.md` |
| `[x]` | 餐桌话题 | 餐桌话题列表页、详情页、后台维护页、公开读取接口、参与接口与首页入口路径已接通；`verify:table-topic-flow` 已于 Sunday, August 23, 2026 在本地 `3100` 实例真实跑通后台建话题/上架/公开读取/参与去重与首页入口目标，`/pages_home/table-topic/index`、`/pages_home/table-topic-detail/index` 官方 `mp-weixin` 页面自动化同日也已在真实话题数据下断言列表和详情主状态；微信开发者工具或真机人工走查仍建议继续补齐 | `docs/plans/table-topic-execution.md` |
| `[x]` | 随机页 | 随机页单桌决策、缺口预检、加入计划和随机购物写入已实现，`verify:random-page-flow` 已于 Saturday, August 22, 2026 在本地 `3100` 实例真实通过；脚本现已补齐“计划已存在”冲突重试，并覆盖 `unknown / missing` 阻断规则，当前可稳定重复验证，`HBuilderX` 小程序编译链也已通过；另已于 Sunday, August 23, 2026 跑通 `/pages_meal/random/index` 官方 `mp-weixin` 真实登录态下的随机决策台初始主状态自动化，已断言 `帮我决定`、已选条件后的页顶主标题 `先生成一桌，再逐道决定保留还是换掉` 与对应说明文案；小程序页面手验仍建议继续补齐 | `docs/plans/random-page-execution.md` |

### 2.2 菜谱、采购与协作相关

| 状态 | 功能 | 当前结论 | 文档 |
| --- | --- | --- | --- |
| `[x]` | 菜谱主执行单 | 主执行单已按当前阶段口径收口；`verify:recipe-flow` 与 `verify:admin-recipe-flow` 已于 Saturday, August 22, 2026 在本地 `3100` 实例真实通过，现阶段已落地草稿/发布、我的/灵感/合集与后台用户菜谱域主路径；另已于 Sunday, August 23, 2026 跑通 `/pages_recipe/edit/index` 官方 `mp-weixin` 真实草稿态自动化，已断言结构化录入页回填标题、故事、分类、食材、步骤与高级设置摘要；同日 `/pages_me/ingredient-units/index` 官方 `mp-weixin` 真实登录态自动化已断言系统食材列表和单位分组主状态，`/pages_me/recommend/index` 与 `/pages_me/recommend-detail/index` 官方 `mp-weixin` 真实登录态自动化也已断言推荐审核通知中心首页和详情页主状态，`/pages_recipe/detail/index` 官方 `mp-weixin` 真实登录态自动化还已断言个人菜谱详情里的 `投稿灵感 -> 投稿 -> 审核中` 主路径，并通过接口回查确认 `recommendation.status = PENDING`；`verify:recommendation-review-flow` 还已真实覆盖“后台拒绝个人食材推荐 -> 前台查看拒绝原因 -> 修改后重提 -> 后台通过”，以及“单位建议 -> 后台通过”。原计划补的后台浏览器治理页证据已按用户明确指示跳过，不再阻塞本轮完成标记 | `docs/plans/recipe-execution.md` |
| `[x]` | 采购清单共享 | 共享清单主链路、分享加入、协作者复制/退出/移除和关闭共享已实现，`verify:shopping-share-flow` 已于 Saturday, August 22, 2026 在本地 `3100` 实例真实通过；另已于 Sunday, August 23, 2026 跑通 `/pages_pantry/list/index` 官方 `mp-weixin` 真实登录态下的清单列表主状态自动化，已断言 `采购中 / 已完成 / 已作废` 三状态 Tab、真实清单标题、`采购进度`、`0/1` 以及 `协作人数 / 加入方式 / 关闭分享` 等正文文本，并跑通 `/pages_pantry/list-detail/index` 真实登录态下的清单正文主状态自动化，已断言真实清单标题、`采购进度`、食材名、数量、`查看来源` 以及 `当前食材 / 协作人数 / 加入方式 / 关闭分享` 等正文文本；owner 侧前台协作入口当前受控隐藏，页面手验仍建议继续补齐 | `docs/plans/shopping-list-shared-execution.md` |
| `[x]` | 采购清单库存预占 | 购物项预占、释放、完成结算和冰箱可用库存展示已落地，`verify:shopping-fridge-flow` 已于 Sunday, August 23, 2026 完成 `from-recipe -> shopping-gap -> from-gap -> from-plan -> from-event-gap -> fridge apply -> complete` 真实 API 联调；另已于 Sunday, August 23, 2026 跑通 `/pages_pantry/gap/index` 官方 `mp-weixin` 真实登录正文态自动化并真实点击 `加入清单`，已通过接口回查确认目标采购清单写入 `EVENT` 来源食材，同时 `/pages_pantry/list-detail/index` 真实登录态下的清单正文主状态自动化也已断言真实清单标题、`采购进度`、食材名、数量与 `查看来源`；购物清单与冰箱页面手验仍建议继续补齐 | `docs/plans/shopping-list-fridge-reservation-execution.md` |
| `[x]` | 做饭助手专项 | 单菜助理、本餐助理、菜单固定、会员门禁、沉浸式做饭切换和“到点后分享回忆”主闭环已收口；`verify:meal-assistant-flow` 已于 Sunday, August 23, 2026 在本地 `3100` 实例真实跑通系统菜谱预生成、会员/免费用户单菜与本餐助理边界、缺失单菜快照实时补洞、菜单锁定与饭局 `CONFIRMED` 推进；同日 `/pages_meal/assistant/index`、`/pages_meal/cook-mode/index`、`/pages_meal/detail/index` 官方 `mp-weixin` 自动化也已断言真实助理页、做饭模式切换，以及饭局到点后 footer 切到 `分享回忆`。正式 AI 生成链路与更细粒度跨菜并行编排保留为后续增强，不阻塞当前标记 | `docs/plans/meal-assistant-execution.md` |
| `[x]` | 勋章系统 | 勋章模板治理、用户勋章墙与详情页已收口；`verify:medal-flow` 已于 Sunday, August 23, 2026 在本地 `3100` 实例真实跑通 `admin medal-templates list/create/update/status/image -> code-login -> users/me/medals -> dining-event complete -> meal-plan complete`，并断言 owner 获得 `MEAL_COMPLETION / DINING_EVENT_COMPLETION / GROUP_MEAL_COMPLETION / FULL_LOOP_COMPLETION`，未获得且未上架模板不出现在勋章墙；同日 `/pages_me/medal/index` 与 `/pages_me/medal-detail/index` 官方 `mp-weixin` 自动化也已断言标题、副文案、分类切换、已获得/未获得状态、说明弹层和 `- 尚未获得 -` 文案；真机 / 微信开发者工具人工走查仍建议后续统一补齐 | `docs/plans/medal-execution.md` |

### 2.3 营养、知识与内容后台相关

| 状态 | 功能 | 当前结论 | 文档 |
| --- | --- | --- | --- |
| `[x]` | 营养展示 | 后端营养子集导入、快照与详情返回已实现并完成脚本和真实接口联调；`verify:recipe-nutrition` 已于 Sunday, August 23, 2026 再次跑通并输出 `COMPLETE / ESTIMATED / INSUFFICIENT` 三档真实结果；同日 `/pages_recipe/detail/index` 官方 `mp-weixin` 页面自动化也已覆盖真实灵感菜谱正文主状态，以及我的菜谱详情 `COMPLETE / ESTIMATED / INSUFFICIENT` 三档营养展示；真机或小程序预览手验仍建议继续补齐 | `docs/plans/nutrition-display-execution.md` |
| `[x]` | 菜品知识底座 | 第三批后端最小范围已落地：系统食材 `aliases` 已接入草稿、我的菜谱与历史菜谱版本的 `searchText` 构建；食材合并后相关 `searchText` 也会同步刷新；`verify:recipe-search-alias-flow` 已于 Sunday, August 23, 2026 在本地 `3100` 实例真实跑通“含 `番茄` 的草稿 / 菜谱，用 `西红柿` 搜索命中”，`backfill:recipe-search-text --apply` 同日已完成历史草稿、版本与菜谱回填，随后再次 `--dry-run` 已确认无残留待回填记录 | `docs/plans/v1-batch3-execution.md` |
| `[x]` | 登录弹窗验证码链路 | `POST /auth/code-send` 已补齐，`verify:login-modal-flow` 已于 Sunday, August 23, 2026 在本地 `3100` 实例真实跑通 `code-send(LOGIN/BIND_PHONE) -> code-login -> users/me -> admin app-config upload/clear -> public app-config`；同日 `/pages/me/index` 官方 `mp-weixin` 自动化也已断言“通知中心 -> 我的勋章”顺序、会员入口默认隐藏，以及 `pages/me` 中一个受控登录入口可拉起登录弹窗 `wechat / phone` 主状态与固定文案。当前 `我的勋章` 已改成直达落地页，这组弹窗回归应以后续仍受控的 `通知中心 / 我的口味 / 账号设置` 入口为准；真机 / 微信开发者工具人工走查仍建议后续统一补齐 | `docs/plans/login-modal-code-login-execution.md` |
| `[x]` | 后台运营重构 | 后台导航重组、会员治理拆页、内容治理、固定页承接、Dashboard 趋势与 `verify:admin-operations-flow` 真实接口联调已接通；当前执行单里剩余缺口主要是后台页面层人工点击与截图证据，按现口径不再阻塞标记 | `docs/plans/admin-operations-restructure-execution.md` |
| `[ ]` | 内容中心 / 官网内容总执行 | 已有总执行单，建议后续继续拆子项实现，不直接整单打勾 | `docs/plans/site-content-execution.md` |

## 三、总批次跟踪

以下文档用于看整体推进顺序，不建议直接作为打勾项：

| 类型 | 文档 | 用途 |
| --- | --- | --- |
| 总基线 | `docs/plans/v1-execution-baseline.md` | 看 V1 做什么、不做什么、按什么批次推进 |
| 第一批 | `docs/plans/v1-batch1-execution.md` | 跟踪首页下一顿、菜谱主系统、冰箱与采购 |
| 第一批补充 | `docs/plans/v1-batch1-shopping-meal-clarification.md` | 跟踪第一批采购与餐次补充口径 |
| 第二批 | `docs/plans/v1-batch2-execution.md` | 跟踪做饭执行与饭局轻协作 |
| 第三批 | `docs/plans/v1-batch3-execution.md` | 跟踪营养展示与菜品知识底座 |

## 四、不直接打勾的规则稿

下列文档是规则和路线图，后续实现时要遵守，但不直接在这里打勾：

| 类型 | 文档 | 说明 |
| --- | --- | --- |
| 规则稿 | `docs/plans/recipe-data-completion-rules.md` | 菜谱导入、补全、营养分析的字段与分层规则 |
| 规则稿 | `docs/plans/recipe-nutrition-mapping-rules.md` | 系统食材到营养基表的映射规则 |
| 规则稿 | `docs/plans/recipe-import-review-workbench-rules.md` | 导入校对工作台规则 |
| 路线图 | `docs/plans/recipe-data-roadmap.md` | 菜谱导入、补全、营养与健康规划阶段顺序 |
| 待确认池 | `docs/plans/business-development-todo.md` | 后续业务开发必须重新确认的问题 |

## 五、已实现但默认隐藏入口的能力

下列能力即使已有初版实现、后台能力或独立页面，也不应默认作为当前 V1 前台主闭环入口继续曝光。

处理原则：

1. 不在 `首页主入口 / 首页四宫格 / 我的页主服务区` 默认露出。
2. 若当前阶段必须保留，只允许保留低曝光、非主推入口。
3. 不得因为“已有实现”就自动视为应继续开放前台入口。

| 能力 | 当前处理 | 说明 |
| --- | --- | --- |
| 积分 / 灶火值 | 默认隐藏前台入口 | 当前不进入 V1 前台主闭环 |
| 会员 / 订阅展示引导 | 默认隐藏前台入口 | 当前不作为 V1 前台主能力推广 |
| 兑换码前台引导 | 默认隐藏前台入口 | 若后续确需核销，只保留低曝光入口，不做主推 |
| 广告减免前台扩展能力 | 默认隐藏前台入口 | 不单独开放前台扩展入口 |

补充说明：

1. 服务端会员事实、后台发码治理、兑换码核销后端能力可以保留，不等于必须开放前台入口。
2. 若后续重新开放入口，必须先在对应执行单和中央变更日志里明确恢复原因与范围。

### 当前代码侧入口审计结果

基于 Sunday, August 23, 2026 当前工作树代码核对：

1. `我的` 页会员角标、会员卡、权益中心和会员兑换码入口已默认隐藏，只保留底层页面与后端能力；`showMemberEntrances = false` 仍在当前代码生效。
2. `我的勋章` 已从概览卡区移到 `通知中心` 下方，顶部会员概览区继续随 `overview-grid` 一并隐藏；当前未发现仍在使用的 `overview-grid--single` 曝光入口。另已于 Sunday, August 23, 2026 跑通 `/pages/me/index` 官方 `mp-weixin` 页面级自动化，确认“通知中心 -> 我的勋章 -> 我的口味 -> 食材与单位 -> 厨具”顺序，以及会员相关入口默认不显示。
3. `积分 / 灶火值 / 广告减免` 未发现前台主入口暴露。
4. `采购清单共享` 已完成代码落地和真实 API 联调，但 owner 侧“协作”入口仍从采购清单首页和详情页主操作区受控隐藏；已有共享清单读取、邀请落点和后端能力保留，待页面手验完成并确认恢复范围后再重新开放前台入口。
5. 当前仍可见的“会员权益”相关文案主要是做饭助手或清单协作受限时的提示文案，不属于首页主入口、四宫格入口或“我的”页主服务区入口；本轮未发现新的会员/兑换码前台主推入口回流。
6. 本轮扩大到 `apps/client/src` 全局检索后，`benefit/index`、`membership-code/index` 当前仍只是保留页面与路由，不构成默认前台曝光；未发现新的 `积分 / 灶火值 / 兑换码 / 权益中心` 主入口从首页、随机页、菜谱页、饭局页或采购主链路回流。

## 六、并行执行视图

后续不按季度或单线程顺序推进，而按“多泳道同步进行、每项单独验证”执行。

### 泳道 A：验收收口

目标：先把已有代码但未完全验收的能力尽快收成真正完成。

包含：

1. 登录基础链路
2. 菜谱创建 / 展示 / 后台 / 合集
3. 厨房知识文章页
4. 饭局详情

执行要求：

1. 每项先补真实联调。
2. 开发完成后先做状态标记，不阻塞后续并行推进。
3. 只有真实联调、自动化主证据和关键实现都收口后，才把状态从 `[~]` 改成 `[x]`。

### 泳道 B：首页主闭环

目标：同步完善首页入口、承接和决策链，不把首页拆成多个分散阶段。

包含：

1. 首页四宫格
2. 首页最近安排
3. 随机页
4. 首页本周灵感
5. 餐桌话题

执行要求：

1. 可以并行开发，但统一按首页真实入口联调。
2. 每项做完后都要验证是否破坏首页状态卡和现有入口排序。

### 泳道 C：菜谱与采购主链路

目标：同步完善“菜谱 -> 缺口 -> 清单 -> 冰箱”的主闭环。

包含：

1. 菜谱主执行单
2. 采购清单共享
3. 采购清单库存预占

执行要求：

1. 共享和库存预占都不能脱离菜谱与缺口主链路单独验收。
2. 每项都必须回到真实采购链路验证，不只看单接口成功。

### 泳道 D：做饭与协作深化

目标：在主闭环不被打断的前提下，同步推进第二批能力。

包含：

1. 做饭助手专项
2. 饭局详情后续收口
3. 勋章系统

执行要求：

1. 不得反向要求首页、菜谱、采购链路返工后才能继续。
2. 依赖计划完成、饭局完成的能力，必须用真实完成流验证。

### 泳道 E：辅助层能力

目标：同步预研和实现辅助层，但不得阻塞 P0 主闭环发布。

包含：

1. 营养展示
2. 菜品知识底座
3. 登录弹窗验证码链路
4. 后台运营重构
5. 内容中心 / 官网内容总执行

执行要求：

1. 允许并行推进。
2. 任何延期都不能阻塞主闭环上线。
3. 这条泳道的接口、表和脚本改动必须与主闭环解耦。

## 七、逐项验证方式

每个功能都独立走完下面 4 步，不等所有功能一起做总验收：

1. 开发完成：
   - 完成最小代码改动和机器检查。
2. 联调完成：
   - 接真实接口或真实依赖验证主成功路径。
3. 手动验收：
   - 当前阶段统一后置，不阻塞 `[x] / [~] / [ ]` 标记。
   - 待所有开发完成后，再按已标记项统一走页面主路径、失败路径和关键边界路径。
4. 状态回填：
   - 更新对应执行单
   - 更新本文状态
   - 更新 `docs/plans/minor_change_log.md`

建议把每项状态统一收口为：

1. `[开发中]`
2. `[待联调]`
3. `[待手验]`
4. `[已完成]`

## 八、维护方式

每完成一项，建议同步做 3 件事：

1. 修改对应执行单里的“验收状态”。
2. 修改本文中的状态标记。
3. 在 `docs/plans/minor_change_log.md` 追加一条中央记录。
