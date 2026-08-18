# 功能执行单：饭局详情页协同收口

## 目标

- 本功能要跑通的最小业务闭环：
  - 从计划进入饭局详情
  - 查看饭局主信息、参与人、菜单
  - 继续邀请参与人
  - 点击菜谱进入菜谱详情
  - 对已确认菜单执行“待认领 / 认领 / 释放”最小协作动作
- 对应 V1 范围：
  - 饭局是“这顿和谁一起吃”的多人事件
  - 计划和饭局共用同一餐次详情页
  - 参与人只访问本次饭局必要信息
  - 邀请分享继续复用现有分享预览页，不单独新开页面

## 本轮范围

- 小程序端：
  - `pages_meal/detail` 收口为“主信息卡 + 参与人 + 菜单 + 做饭助手”
  - 顶部滚动标题改成当前内容标题
  - 菜单区改成行式列表
  - 参与人区补“管理”入口与 `Sheet` 壳子
  - 分享邀请改为点击时实时生成链接，不再依赖详情接口回传旧 token
  - 未完成前主分享保持“分享邀请”，完成后切到“分享饭局卡”
  - 底部改成“状态条 + 吸底 footer”结构，承载当前阶段下一步动作
  - 菜单头部补“设置截止”轻入口，但当前只先落前端入口提示
  - 接通菜单掌勺认领 / 释放的现有接口
- 后端 API：
  - 复用现有 `POST /api/dining-events/:eventId/cook`
  - 新增 `POST /api/dining-events/:eventId/share-link`
- 后台管理：
  - 不涉及
- 共享契约：
  - 复用现有 `DiningEventSummary.menuItems[].cookUserUid / cookName`

## 本轮不做

- 协管角色与发起者转移
- 待确认邀请列表、删除邀请、移出成员
- 菜单确认时间持久化
- “开始开席 / 进行中”真实状态写入
- 预计总时长倒推 1.5 倍提醒
- 进度卡最终方案

## 业务流程与页面行为门禁

### 业务流程

- 用户目标：
  - 进入某顿饭的详情后，继续邀请人、查看谁来、确认菜单归属并开始做饭准备
- 触发条件：
  - 从计划页或饭局列表进入统一餐次详情页
- 主成功路径：
  - 查看主信息 -> 查看参与头像 -> 打开参与人管理 -> 点击“分享邀请”实时生成链接 -> 在菜单里认领某道菜 -> 打开做饭助手
- 失败 / 阻断路径：
  - 饭局不存在、当前用户不是发起人、饭局已完成/已取消、当前用户无权认领掌勺
- 结束状态：
  - 页面结构收口，菜单掌勺认领链路可用
- 确认人 / 确认记录：
  - 当前 Codex 会话内用户逐项确认

### 页面行为

- 页面入口：
  - 计划页、饭局列表
- 展示内容及用途：
  - 主信息卡：饭局/计划标题、状态、时间、菜单摘要、头像
  - 参与人区：查看参与状态并进入管理 `Sheet`
  - 菜单区：查看菜谱并认领掌勺
  - 做饭助手：进入建议 / 做菜模式
  - 底部 footer：展示当前阶段说明和下一步操作
- 用户操作：
  - 点击标题编辑入口
  - 点击圆形虚线加号继续邀请
  - 点击参与人管理
  - 点击菜谱名进入菜谱详情
  - 点击“待认领”或本人头像执行认领/释放
  - 点击 footer 里的分享邀请、去菜谱、补菜单、做饭助手、完成饭局
  - 点击菜单头部“设置截止”入口查看当前能力提示
- 加载 / 空态 / 失败态：
  - 继续沿用当前详情页已有状态壳子
- 成功后的页面变化：
  - 掌勺认领后，菜单右侧从“待认领”切到头像态
- 本流程不需要的页面数据：
  - 泛进度卡、未冻结的新状态机持久化字段、协管列表

### 门禁结论

- [x] 业务流程已确认
- [x] 页面行为已确认
- [x] 现有接口、表和页面仅作为候选实现，没有被当作需求证据

## 领域与商业化评估

- 数据归属：`USER / PARTICIPATION`
- Free 基础：
  - 可查看饭局详情、菜单、参与情况
- 付费增量：
  - 本轮不涉及
- 权益作用域：`不付费`
- 权益类型：`功能`
- 到期与超额行为：
  - 本轮不涉及
- 数据保留与迁出：
  - 饭局详情和掌勺认领继续归本次饭局事实
- 配置来源：`INSTANCE`
- 隐私、安全与合规：
  - 只显示本次饭局必要参与信息
- 是否涉及 Reserved 的 OCR、AI、Pro 或多家庭：
  - 否

## CTO 拆解

| 端 | 负责人 | 最小任务 | 输入 | 输出 | 依赖 | 验收 |
| --- | --- | --- | --- | --- | --- | --- |
| 小程序 | Codex | 收口详情页结构、参与人管理 `Sheet`、菜单认领交互 | 当前 `DiningEventSummary` | 新页面结构与交互 | 现有详情页代码、现有认领接口 | `type-check` / `build:mp-weixin` |
| 后端 | Codex | 补饭局分享链接写接口 | `eventId + Idempotency-Key` | `DiningEventShareLinkResponse` | 现有 Meal 模块 | `type-check` |
| 后台 | 无 | 不做 | - | - | - | - |
| 共享契约 | 复用 | 复用 `cookUserUid / cookName` | 现有契约 | 小程序渲染与点击认领 | 现有开放契约 | 联调通过 |

## 开发者最小任务确认

### 小程序确认

- 最小交付：
  - 页面结构收口
  - 参与人管理 `Sheet`
  - 菜单行式列表
  - 掌勺认领 / 释放
  - 吸底 footer 和状态条
  - 菜单头部“设置截止”入口提示
- 依赖：
  - `DiningEventSummary`
  - `POST /api/dining-events/:eventId/cook`
- 是否先用 mock：
  - 否
- 不做项：
  - 待确认邀请管理、协管、菜单确认时间持久化、开始开席写状态、提醒
- 验收方式：
  - `pnpm --filter @next-meal/client type-check`
  - `pnpm --filter @next-meal/client build:mp-weixin`

### 后端确认

- 最小交付：
  - `POST /api/dining-events/:eventId/share-link`
  - `POST /api/dining-events/:eventId/share-link/disable`
  - `POST /api/dining-events/:eventId/share-members`
  - `POST /api/dining-events/:eventId/participants/:participantId/revoke`
  - `POST /api/dining-events/:eventId/participants/:participantId/reinvite`
- 数据表 / 事务边界：
  - 好友外链继续复用现有 `DiningEventShareInvite`
  - 饭搭子定向邀请继续复用现有 `DiningEventParticipant`
- 错误码：
  - 发起人之外不可生成邀请链接或饭搭子邀请；已取消 / 已完成统一拒绝
- 不做项：
  - 不新增独立分享页，不保存历史明文 token
- 验收方式：
  - `pnpm --filter @next-meal/api type-check`
- 状态机 / 权限矩阵：
  - 认领掌勺继续沿用现有规则；分享邀请先只开放给发起人，直到完成前一直可用
- 配置解析与实例冻结：
  - 不涉及
- 到期 / 清理任务：
  - 不涉及

### 后台确认

- 最小交付：
  - 无
- 页面入口 / 权限：
  - 无
- 依赖：
  - 无
- 不做项：
  - 无
- 验收方式：
  - 无

## 接口契约

| 方法 | 路径 | 用途 | 权限 | 幂等 | 版本字段 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `POST` | `/api/dining-events/:eventId/share-link` | 生成或重置邀请分享链接 | 仅发起人 | 是 | 无 | 新增 |
| `POST` | `/api/dining-events/:eventId/share-link/disable` | 主动关闭当前好友邀请外链 | 仅发起人 | 是 | 无 | 新增 |
| `POST` | `/api/dining-events/:eventId/share-members` | 向指定饭搭子成员发送饭局邀请 | 仅发起人 | 是 | 无 | 新增 |
| `POST` | `/api/dining-events/:eventId/participants/:participantId/revoke` | 撤回一条待确认邀请 | 仅发起人 | 是 | 无 | 新增 |
| `POST` | `/api/dining-events/:eventId/participants/:participantId/reinvite` | 再次邀请一位已拒绝成员 | 仅发起人 | 是 | 无 | 新增 |
| `POST` | `/api/dining-events/:eventId/cook` | 认领或释放一道菜的掌勺 | 发起者或有效参与人 | 是 | `expectedVersion` | 已复用 |

## 最小数据表与约束

| 主事实 / 关系 | owner | 必要字段 | 生命周期 | 外键 / 唯一 / Check | 对应真实查询 | 是否复用现有结构 |
| --- | --- | --- | --- | --- | --- | --- |
| `DiningEventMenuItem.cookUserId` | 饭局 | `cookUserId` | 随饭局菜单项存在 | 现有关系约束 | 饭局详情菜单行 | 是 |

- 可以从现有主事实重算、不新增持久化的内容：
  - 菜单右侧头像
  - 菜单状态文字
  - 分享链接明文路径
- 明确不新增的表、字段、枚举和索引：
  - 协管、菜单确认时间字段、开始开席状态字段、准备提醒
- migration 部署与回退边界：
  - 本轮无 migration

## 各端类型

- `apps/api` DTO / 响应：
  - 新增 `DiningEventShareLinkResponse`，继续复用 `DiningEventModel / ClaimCookDto`
- `apps/client` API 类型：
  - 补接 `ClaimCookRequest` 与 `createDiningEventShareLink`
- `apps/admin` API 类型：
  - 不涉及

## 联调清单

- [x] 小程序调用现有认领接口
- [x] 小程序点击分享时现取邀请链接
- [ ] 参与人管理能力后续扩展时补新接口
- [x] 权限 / 未登录 / 无权限路径沿用当前详情页逻辑

## 验收状态

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 开发完成 | 进行中 | 当前文档 + 小程序改造 |
| 联调完成 | 未完成 | 待页面人工验收 |
| 机器检查 | 进行中 | 见 minor log |
| 手动验收 | 未完成 | 待小程序端查看 |
| 可发布 | 否 | 后续协同契约仍未冻结 |

## 风险与遗留

- 风险：
  - 现有 `DiningEventSummary` 不返回待确认邀请列表，参与人管理 `Sheet` 只能先做壳子和继续邀请
  - 现有菜单项不直接返回掌勺人头像，前端只能从发起者/参与人列表回推头像
  - 现有契约没有 `menuConfirmDeadline` 与“开始开席”写接口，footer 第一版只能先把阶段文案、倒计时和入口层级落成前端映射
  - 现有 `DiningEventSummary.shareTokenPath` 不是可重进复用的稳定字段，后续继续分享仍需再次调写接口
- 遗留：
  - 协管
  - 菜单确认时间持久化
  - 准备提醒
  - “开始开席 / 进行中”真实状态流
- 发布前必须处理：
  - 页面人工验收

## 范围自检

- 本次满足的用户确认规则：
  - 主信息卡 / 参与头像 / 菜单行态 / 参与人管理入口 / 吸底 footer / 菜单头部轻入口
- 每个文件为什么必须修改：
  - `pages_meal/detail`：页面结构与交互
  - `pages_meal/apis/meal`：补接分享链接接口与现有认领接口
  - `apps/api/src/modules/meal/*`：补饭局分享链接生成逻辑
  - 本文：冻结当前执行边界
- 明确没有顺手加入的功能：
  - 协管、提醒、新状态机
- 因复用未被证明而没有提前增加的抽象：
  - 未提前抽象饭局协作中心
- 是否还能缩小改动而不破坏需求：
  - 不能再缩，否则菜单认领与管理入口无法落地
