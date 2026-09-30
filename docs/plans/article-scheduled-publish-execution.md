# 功能执行单：文章定时发布

## 已确认需求

- 文章仍使用 `DRAFT / PUBLISHED / UNLISTED` 状态；预约中的文章保留 `DRAFT`，由 `scheduledPublishAt` 表示预约时间。
- 只有草稿能预约。已下架文章必须先编辑并存为草稿；已发布文章不能预约。
- 到达预约时间后由独立启用的 Worker 自动发布，按北京时间在后台选择时间，数据库统一保存绝对时间。
- 普通草稿可以立即发布或预约。预约中的文章可取消预约；编辑保存时保留已有预约时间。
- 立即发布和下架会清除预约时间；下架文章存为草稿后才可继续预约。
- 列表与编辑页均提供定时发布入口；列表可取消预约，编辑页显示预约时间并允许取消。
- `ARTICLE_SCHEDULED_PUBLISH_WORKER_ENABLED` 独立控制新发布循环，不改变 `WORKER_ENABLED` 对微信提醒消费者的控制。

## 最小数据与接口

- `site_contents.scheduled_publish_at TIMESTAMPTZ NULL`：仅表示尚未执行的预约；成功发布或取消后置空。
- 索引 `(type, status, scheduled_publish_at)` 服务 Worker 的到期草稿扫描。
- `POST /admin/content/{contentId}/schedule` 写入未来时间或 `null` 取消预约，要求 `Idempotency-Key + expectedVersion`；只开放 `KITCHEN / COOK / FOOD` 知识文章。
- Admin 列表/详情返回 `scheduledPublishAt`。预约及自动发布均写入 `AuditEvent`。
- 独立 Worker 原子领取到期且栏目可发布的文章并发布，失败记录日志，下轮继续扫描；无新 Outbox 消费者。

## 页面与状态门禁

| 当前状态 | 列表 | 编辑页 |
| --- | --- | --- |
| 草稿（无预约） | 编辑、发布、定时发布 | 保存草稿、发布、定时发布 |
| 草稿（已预约） | 编辑、取消预约 | 保存草稿、发布、定时发布、取消预约 |
| 已下架 | 编辑 | 保存草稿 |
| 已发布 | 编辑、下架 | 发布更新、下架 |

## 验收边界

- 自动发布时间、管理员预约/取消时间均使用 UTC ISO 时间交换；后台时间选择器按本地北京时间操作。
- 服务端拒绝非草稿预约、过去时间、不可发布栏目和版本冲突。
- 预约时间只存在于尚未发布的草稿；编辑不会意外清除它。
- 本次不运行测试；使用 API/Admin/Worker 类型检查、构建、Prisma 校验和 `git diff --check` 做静态验证。
- 不部署迁移或 Worker，不执行 Git 提交；后台真实浏览器操作留待手动验收。

## 实施与当前验收

- 已完成：Prisma 字段和前向 migration、预约/取消 API、权限状态校验与审计、独立 Worker 轮询、Admin 列表和编辑页交互、接口与运行文档。
- 静态验证通过：API/Admin/Worker/Client type-check 与 build、Prisma validate、OpenAPI verify（330 operations / 289 response schemas）、`git diff --check`。
- 本地 `next_meal` 数据库已应用 `20260930120000_site_content_scheduled_publish`，Prisma migration status 为 up to date；该迁移未部署到其他环境。
- Admin 本地页面 `http://127.0.0.1:5174/` 返回 HTTP 200；公开文章 API 返回业务 `code=0`；预约路由在管理员版本头通过后进入管理员鉴权并返回业务 `code=401`，未完成带管理员会话的预约/取消联调。
- 未运行测试、未启用文章 Worker、未做后台浏览器实际预约/取消/编辑操作验收。

## 生产发布

- 首次在服务器创建 `apps/worker/.env`，只配置 Worker 需要的生产 `DATABASE_URL` 和 `ARTICLE_SCHEDULED_PUBLISH_WORKER_ENABLED=true`；保留 `WORKER_ENABLED` 当前的提醒开关策略，不要复制整份 API 环境文件。
- 此后使用 `cd /srv/cook && ./deploy.sh` 完整发布。脚本先校验 Worker 环境并构建 Worker，再部署 API 并应用待执行 migration；API 迁移成功后通过 PM2 启动或重载 `cook-worker`，最后部署 Admin/Site。
- 迁移失败时 Worker 不会启动或重载。执行后可用 `pm2 status cook-worker` 查看进程，用 `pm2 logs cook-worker --lines 50` 确认出现 `scheduled article publisher started`。
