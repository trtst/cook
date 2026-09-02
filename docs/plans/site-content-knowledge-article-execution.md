# 功能执行单：厨房知识文章页

## 目标

- 本功能要跑通的最小业务闭环：用户从“我的”页点击 `厨房百事 / 烹调技法 / 饮食文化` 任一入口，登录后进入对应文章列表页，再进入文章详情页，详情页可点赞并累积阅读数。
- 对应 V1 范围：已存在内容治理文章能力的小程序内消费闭环，不扩成社区、不开放评论或作者主页。

## 本轮范围

- 小程序端：三个入口改为登录后进入共用列表页与详情页，列表/详情默认展示 skeleton，详情支持点赞。
- 后端 API：基于 `site_contents` 新增文章列表、详情、阅读累积、点赞/取消点赞接口。
- 后台管理：复用现有内容治理文章与栏目，不新增新的后台页面。
- 共享契约：补齐文章列表、详情、点赞与阅读数接口契约。

## 本轮不做

- 不做评论、收藏、关注、作者主页、相关推荐。
- 不做新的后台编辑器交互或新的内容模型。
- 不做全局禁用隐藏主题皮肤，只在主题页先不展示另外两个皮肤。

## 业务流程与页面行为门禁

### 业务流程

- 用户目标：登录后浏览厨房知识文章，并在详情页点赞。
- 触发条件：点击“我的”页三个知识入口之一，或直接进入文章列表/详情页。
- 主成功路径：未登录先呼起登录 -> 登录成功后请求列表 -> 点击文章进入详情 -> 详情请求成功后累积阅读数 -> 用户可点赞/取消点赞。
- 失败 / 阻断路径：未登录时不发文章请求；接口失败时保留错误态并允许重试。
- 结束状态：列表展示对应栏目文章；详情展示正文、阅读数、点赞数与当前用户点赞态。
- 确认人 / 确认记录：用户于 2026-08-20 确认“需要登录、默认 skeleton、页面先不展示另外两个皮肤”。

### 页面行为

- 页面入口：“我的”页知识入口、直接路由进入列表/详情页；“我的”页未登录或接口失败时可使用本地栏目 code 兜底，登录后通过现有文章列表接口返回的 `channel` 元信息覆盖入口标题和说明。
- 展示内容及用途：列表页进入后沿用路由 `channelCode` 请求文章列表，接口同步返回当前栏目 `code / name / description`，页面标题和栏目说明以服务端返回值为准，接口未返回前使用本地静态文案兜底；列表卡片按上下结构展示，顶部封面固定 16:9，下方展示标题、摘要、关键词、时间 / 阅读 / 点赞，三个元信息前均使用字体图标；详情页按封面图、标题、时间 / 阅读 / 点赞、摘要、关键词、正文顺序平铺展示，三个元信息前均使用字体图标，不使用大 card 或正文圆角承载。
- 用户操作：登录、进入列表、打开详情、点赞、取消点赞、退出登录确认。
- 加载 / 空态 / 失败态：列表和详情首次都默认显示 skeleton；空列表显示空态；接口失败显示错误态与重试。
- 成功后的页面变化：详情页进入成功后阅读数增加；点赞成功后计数和按钮状态立即刷新。
- 本流程不需要的页面数据：不返回评论、作者、用户列表、排行榜、收藏量、相关推荐；关键词只作为文章内容辅助展示，不扩展成标签筛选或专题入口。

### 门禁结论

- [x] 业务流程已确认
- [x] 页面行为已确认
- [x] 现有接口、表和页面仅作为候选实现，没有被当作需求证据

## 领域与商业化评估

- 数据归属：`PLATFORM`
- Free 基础：登录后可浏览文章与点赞。
- 付费增量：无。
- 权益作用域：`不付费`
- 权益类型：`功能`
- 到期与超额行为：无。
- 数据保留与迁出：文章由平台治理；点赞关系跟随用户与文章生命周期删除。
- 配置来源：`GLOBAL`
- 隐私、安全与合规：点赞需登录，公开内容只开放指定栏目下已发布文章。
- 是否涉及 Reserved 的 OCR、AI、Pro 或多家庭：否。

## 接口契约

| 方法 | 路径 | 用途 | 权限 | 幂等 | 版本字段 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/site-contents/articles` | 读取指定知识栏目的文章列表 | `UserBearerAuth` | 否 | 无 | 已实现 |
| GET | `/site-contents/articles/{articleId}` | 读取文章详情与当前用户点赞态 | `UserBearerAuth` | 否 | 无 | 已实现 |
| POST | `/site-contents/articles/{articleId}/view` | 累积一次阅读数 | `UserBearerAuth` | 是 | 无 | 已实现 |
| POST | `/site-contents/articles/{articleId}/like` | 点赞文章 | `UserBearerAuth` | 是 | 无 | 已实现 |
| DELETE | `/site-contents/articles/{articleId}/like` | 取消点赞文章 | `UserBearerAuth` | 是 | 无 | 已实现 |

## 最小数据表与约束

| 主事实 / 关系 | owner | 必要字段 | 生命周期 | 外键 / 唯一 / Check | 对应真实查询 | 是否复用现有结构 |
| --- | --- | --- | --- | --- | --- | --- |
| `site_contents` 文章统计 | PLATFORM | `viewCount`、`likeCount` | 跟随文章 | 不允许负数由服务端写链控制 | 列表、详情显示统计 | 复用现有文章表 |
| `site_content_likes` 用户点赞关系 | USER x ARTICLE | `contentId`、`userId`、`createdAt` | 点赞创建，取消点赞删除 | `UNIQUE (content_id, user_id)` + 双外键 | 详情点赞态、点赞计数写链 | 新增 |

- 可以从现有主事实重算、不新增持久化的内容：当前用户点赞态由 `site_content_likes` 查询，不落到文章表。
- 明确不新增的表、字段、枚举和索引：不新增评论表、阅读明细表、作者表、推荐表。
- migration 部署与回退边界：新增一条 migration，为 `site_contents` 增加统计字段并新增 `site_content_likes` 表。

## 联调清单

- [ ] 小程序 mock 路径可跑通
- [x] 后端接口测试通过
- [ ] 小程序接真实接口通过
- [x] 权限 / 未登录 / 无权限路径通过
- [x] 重复提交 / 幂等路径通过

## 验收状态

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 开发完成 | 已完成 | 文章列表、详情、阅读、点赞/取消点赞链路及小程序入口页已实现 |
| 联调完成 | 已完成 | Saturday, August 22, 2026 已在 `http://127.0.0.1:3100/api` 重新跑通 `pnpm --filter @next-meal/api verify:knowledge-article-flow`；脚本现改为走 `/auth/code-login` 干净账号，不再依赖种子密码，当前结果覆盖未登录 `401`、文章发布、列表/详情读取、阅读数累积与点赞/取消点赞 |
| 机器检查 | 已完成 | `pnpm --filter @next-meal/api verify:knowledge-article-flow`、`pnpm --filter @next-meal/client type-check`、`node --check apps/client/src/pages_me/knowledge-list/index.test.js`、`node --check apps/client/src/pages_me/knowledge-detail/index.test.js`、`git diff --check -- apps/client/src/pages_me/knowledge-list/index.vue apps/client/src/pages_me/knowledge-list/index.test.js apps/client/src/pages_me/knowledge-detail/index.vue apps/client/src/pages_me/knowledge-detail/index.test.js docs/plans/site-content-knowledge-article-execution.md docs/plans/implementation-checklist.md docs/plans/minor_change_log.md`，此前已执行 `pnpm --filter @next-meal/api type-check`、`pnpm --filter @next-meal/client build:mp-weixin`、`pnpm --filter @next-meal/api build`；另已于 Saturday, August 22, 2026 跑通 `HBuilderX cli launch mp-weixin --project /Users/yangpenghui/personal/cook/apps/client/src --compile true`，并于 Sunday, August 23, 2026 跑通 `/Applications/HBuilderX.app/Contents/MacOS/cli uniapp.test mp-weixin --project /Users/yangpenghui/personal/cook/apps/client/src --testcaseFile pages_me/knowledge-list/index.test.js` 与 `pages_me/knowledge-detail/index.test.js`，其中知识列表已提升为真实登录列表主状态自动化，已断言后台新发布文章标题、`阅读 / 点赞` 元信息；文章详情已断言已发布文章标题、阅读/点赞文案与点赞后 `已点赞` 状态切换 |
| 手动验收 | 未完成 | 已补知识列表真实登录列表态和文章详情真实登录正文态官方 `mp-weixin` 自动化，但未在微信小程序真机或开发者工具中执行；文章列表、详情正文、阅读累积与点赞仍待人工主路径验收 |
| 可发布 | 否 | 仍缺小程序手动验收 |

## 手验清单

在微信开发者工具或真机里至少补下面 4 条：

1. 从 `我的 -> 厨房知识` 任一入口进入列表，确认未登录先走登录，再返回文章列表。
2. 列表首屏确认 skeleton、正文卡片、发布时间、阅读数与点赞数展示正常。
3. 打开文章详情，确认正文可读，进入后阅读数会按预期增加。
4. 点赞与取消点赞各执行一次，确认按钮状态和计数同步刷新，不需要手动重进页面。

## 风险与遗留

- 栏目关系：`KITCHEN` 为“厨房百事”，承接用什么、怎么买、怎么存、怎么备；`COOK` 为“烹调技法”，承接怎么做、为什么这样做、失败怎么救；`FOOD` 为“饮食文化”，承接餐桌上的节气、地域、传统、人情。
- 风险：后台现有文章需要运营归到 `KITCHEN / COOK / FOOD` 三个栏目下，前台列表才会有内容；导入脚本可以先写入无栏目草稿，但必须重新编辑选择栏目后才能发布。
- 遗留：阅读数当前只累计总数，不保留阅读明细。
- 发布前必须处理：部署 migration，并确认内容栏目与已发布文章数据准备完成。
