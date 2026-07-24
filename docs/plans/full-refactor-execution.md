# 功能执行单：全量重构总控

## 目标

- 本功能要跑通的最小业务闭环：在不改变炊火记既有业务规则的前提下，重建三端工程骨架，先收口数据库与 API，再让小程序和后台按冻结契约接入。
- 对应 V1 范围：不新增业务，只重构现有 `Auth / User / DiningGroup / Entitlement / Admin` 已落地范围，并为后续 `Recipe / Meal / Fridge / Shopping / Share` 留出稳定入口。

## 本轮范围

- 小程序端：只确认重构顺序与最小保留面，不先改业务页面。
- 后端 API：先重排一级领域模块入口，冻结数据库/API 优先级，后续从 `dining-group` 竖线开始收口。
- 后台管理：只确认最小保留面，不先改页面结构。
- 共享契约：以 `docs/api-contract.md` 和当前顶层文档为准，后续按阶段更新 DTO / OpenAPI / 各端本地 API 类型。

## 本轮不做

- 不改变 V1 业务规则、权限语义、生命周期语义或付费规则。
- 不同时铺开 `Recipe / Meal / Fridge / Shopping / Share` 的真实重构实现。
- 不提前引入 repository factory、manager、adapter center 一类泛化抽象。

## 领域与商业化评估

- 数据归属：`USER / DINING_GROUP / PLATFORM`
- Free 基础：保持当前文档定义，不在本轮改变。
- 付费增量：保持当前文档定义，不在本轮改变。
- 权益作用域：`USER / DINING_GROUP`
- 权益类型：`容量 / 时间 / 功能`
- 到期与超额行为：保持 `docs/configuration.md` 当前规则。
- 数据保留与迁出：保持 `docs/dining-group.md` 当前规则。
- 配置来源：`ENTITLEMENT / INSTANCE / SAFETY`
- 隐私、安全与合规：鉴权、权限、事务、幂等、审计边界均以后端为准。
- 是否涉及 Reserved 的 OCR、AI、Pro 或多家庭：否。

## CTO 拆解

CTO 负责把总重构拆成阶段性最小纵切，先定 owner，再推进实现。

| 端 | 负责人 | 最小任务 | 输入 | 输出 | 依赖 | 验收 |
| --- | --- | --- | --- | --- | --- | --- |
| 小程序 | 主线程后续执行 | 冻结客户端重构入口与保留面 | API 契约、客户端现状 | 客户端阶段顺序与后续改造清单 | 后端入口态契约冻结 | 不提前重构空壳业务域 |
| 后端 | 主线程当前执行 | 先按一级领域收口模块入口，再从 `dining-group` 竖线收表和收接口 | 顶层文档、当前 schema、当前 service/controller | 模块骨架、阶段执行顺序、后续 DB/API 收口清单 | 文档已冻结 | 不改业务行为，模块入口清晰 |
| 后台 | 主线程后续执行 | 冻结最小页面面与后接顺序 | API 契约、后台现状 | 后台阶段顺序与保留面 | 后端查询契约冻结 | 不提前扩菜单和流程 |
| 共享契约 | 主线程当前执行 | 确定总重构阶段和更新顺序 | 顶层文档、现状实现 | 总执行单 | 无 | 阶段边界明确 |

## 开发者最小任务确认

### 小程序确认

- 最小交付：先按 `platform -> session/http -> 已接真实接口页面` 的顺序重构。
- 依赖：后端 `auth / user / dining-group / entitlement` 契约冻结。
- 是否先用 mock：否，优先围绕当前已接真实接口的页面。
- 不做项：不先拆 `recipe / meal / pantry / share` 的空壳业务域。
- 验收方式：真实登录、401 清理、当前空间与成员页主路径跑通。

### 后端确认

- 最小交付：先补一级模块骨架，再进入 `dining-group` 竖线的表/接口收口。
- 数据表 / 事务边界：优先 `DiningGroup / UserSpace / DiningGroupMember`，其次 `Invite / CarryBackSnapshot / Entitlement / Idempotency / Audit / Outbox`。
- 错误码：保持当前统一 JSON 结构和业务码定义。
- 不做项：不提前展开 `Recipe / Meal / Fridge / Shopping / Share` 的数据实现。
- 验收方式：模块入口清晰、行为不变、类型检查通过。
- 状态机 / 权限矩阵：保持顶层文档现状。
- 配置解析与实例冻结：保持当前 `policy + entitlement` 机制，后续再收口。
- 到期 / 清理任务：本轮不扩 Worker 行为。

### 后台确认

- 最小交付：只保留登录、用户、饭搭子、权益查询的最小后台面。
- 页面入口 / 权限：以后端稳定查询契约为准。
- 依赖：后端只读查询接口冻结。
- 不做项：不先扩复杂菜单树或运营流程。
- 验收方式：最小查询页真实联调通过。

## 接口契约

总重构按下面顺序更新契约，不跨阶段并行膨胀：

| 方法 | 路径 | 用途 | 权限 | 幂等 | 版本字段 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/dining-groups/current` | 当前空间入口态 | 用户 | 否 | 当前返回含 `version` | 第一阶段收口 |
| `POST` | `/dining-group-invites` | 创建邀请 | 用户 | `operationId` | 否 | 第一阶段收口 |
| `POST` | `/dining-group-invites/:inviteToken/accept` | 接受邀请 | 用户 | `operationId` | 否 | 第一阶段收口 |
| `POST` | `/dining-groups/:diningGroupId/leave` | 退出并恢复原空间 | 用户 | `operationId` | 否 | 第一阶段收口 |
| `GET` | `/entitlements/current` | 当前有效权益 | 用户 | 否 | 否 | 第一阶段复核 |
| `GET` | `/users/me` | 当前用户 | 用户 | 否 | 否 | 第二阶段复核 |
| `GET` | `/admin/users` 等 | 后台只读查询 | 管理员 | 否 | 否 | 第三阶段复核 |

## 各端类型

- `apps/api` DTO / 响应：先按阶段收口 `dining-group` 与 `entitlement`。
- `apps/client` API 类型：后端冻结后同步本端 `apis/`。
- `apps/admin` API 类型：后端冻结后同步本端 `apis/`。

## 联调清单

- [ ] 后端模块骨架收口且类型检查通过
- [ ] `dining-group` 入口态契约收口完成
- [ ] 小程序接真实 `auth / user / dining-group / entitlement` 主路径通过
- [ ] 后台接真实只读查询主路径通过
- [ ] 401 / 403 / 409 路径验证通过
- [ ] 邀请 / 接受 / 退出幂等路径通过

## 验收状态

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 开发完成 | 进行中 | 已开始建立总执行单和后端模块骨架 |
| 联调完成 | 未完成 |  |
| 机器检查 | 未完成 |  |
| 手动验收 | 未完成 |  |
| 可发布 | 否 | 仍处于重构早期 |

## 风险与遗留

- 风险：`/dining-groups/current` 当前承担入口态之外的占位字段，后续需要收口但不能误改业务。
- 风险：客户端仍有大量 `uni.*` 直连点，若后端契约未先冻结就先拆页面，会返工。
- 风险：后台查询口径与前台有效成员口径可能继续漂移，需要在后端查询阶段统一。
- 遗留：`Recipe / Meal / Fridge / Shopping / Share` 暂不进入真实重构实现。
- 发布前必须处理：第一阶段 DB/API 收口完成后再进入前端/后台实施。

## 范围自检

- 本次满足的用户确认规则：按 `apps/api -> apps/client -> apps/admin` 顺序启动全量重构，先简化表和接口。
- 每个文件为什么必须修改：执行单用于冻结总范围；后端模块骨架用于建立后续收口 owner。
- 明确没有顺手加入的功能：没有改业务规则、没有扩新接口、没有拆空壳业务域。
- 因复用未被证明而没有提前增加的抽象：未新增 repository factory、manager、center。
- 是否还能缩小改动而不破坏需求：当前已压到“执行单 + 后端模块入口收口”的最小起步。
