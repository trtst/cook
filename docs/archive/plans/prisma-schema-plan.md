# 当前 Prisma Schema 与 SQL 实施方案

> **已归档（2026-07-25）**：本文基于旧“唯一当前空间/冻结恢复”数据模型，已不再指导当前实现。后续开发请改读 `../../api-database-rules.md`、`../../dining-group.md`、`../../configuration.md` 和 `../../plans/personal-data-refactor-plan.md`。

## 状态

- 当前项目尚未上线，不存在需要保留的多饭搭子或旧生命周期业务数据。
- 现有 Auth、User、DiningGroup 代码属于脚手架，直接按当前产品方案重构。
- 不做旧字段双写、旧邀请迁移、历史成员回填或多饭搭子清理。
- `docs/cook/` 只作为产品和早期技术来源，不作为当前实现兼容目标。

## 一、直接重构范围

按依赖拆成五批，但每一批都只保留当前模型：

| 批次 | 内容 |
| --- | --- |
| A | 唯一当前空间、长期成员、邀请、迁出快照头、幂等、审计、Outbox |
| B | 配置、最小权益授权、成员上限解析 |
| C | 原空间迁入、迁出快照清单与带回 |
| D | 空间账本、菜谱、技术内容快照、图片引用 |
| E | 冰箱、计划、参与关系、购物、饭局、口味 |

当前已完成 A、B；下一批进入 C，不同时建设未冻结的菜谱列表、支付订单和 MealPlan 字段。

## 二、统一空间

### DiningGroup

单人和多人都使用 `DiningGroup`，不再保存 `collaborationMode`。目标字段：

| 字段 | 规则 |
| --- | --- |
| `ownerId` | 主理人，一人一个原始空间 |
| `status` | `ACTIVE / FROZEN / ARCHIVED` |
| `frozenAt` | `FROZEN` 时必填 |
| `archivedAt` | `ARCHIVED` 时必填 |
| `version` | 共享写乐观锁 |

`DiningGroup.status` 是空间生命周期；额度状态继续使用 `SpaceState = NORMAL / OVER_RECIPE_LIMIT / OVER_STORAGE_READONLY`，两者不能混用。

### UserSpace

新增一对一 `UserSpace`：

| 字段 | 规则 |
| --- | --- |
| `userId` | 主键，每个用户一行 |
| `originalDiningGroupId` | 用户创建账号时生成的原空间，唯一 |
| `currentDiningGroupId` | 当前唯一长期空间 |
| `version` | 加入和退出时递增 |

```text
单人状态：currentDiningGroupId = originalDiningGroupId
加入别人：currentDiningGroupId = 目标饭搭子，原空间 FROZEN
退出以后：currentDiningGroupId = originalDiningGroupId，原空间 ACTIVE
```

不创建 `OriginalSpace` 表。原空间本身就是一个 `DiningGroup`，API 摘要由 `UserSpace + DiningGroup` 组合返回。

数据库约束：

1. `(original_dining_group_id, user_id)` 必须对应 `dining_groups(id, owner_id)`。
2. `(current_dining_group_id, user_id)` 必须对应 `dining_group_members(dining_group_id, user_id)`。
3. 复合外键使用 `DEFERRABLE INITIALLY DEFERRED`，允许加入和退出事务在提交时统一校验。
4. 当前成员只能是 `ACTIVE` 或 `RESTRICTED`，不能是 `ENDED`。

不在成员表上限制用户只能有一条 `ACTIVE` 行。冻结原空间中的 OWNER 关系继续存在；唯一当前空间由 `UserSpace` 保证。

## 三、长期成员

`DiningGroupMember` 使用：

```text
status: ACTIVE / RESTRICTED / ENDED
statusReason: LEFT / REMOVED / GROUP_DOWNGRADED / GROUP_DISSOLVED / null
```

约束：

1. `ACTIVE`：原因和限制/结束时间为空。
2. `RESTRICTED`：原因为 `GROUP_DOWNGRADED`，`restrictedAt` 必填。
3. `ENDED`：原因和 `endedAt` 必填。
4. 同一饭搭子和用户只有一行；重新加入时恢复该行并递增版本。
5. 一个饭搭子只有一个未结束 OWNER。
6. 主理人不能通过普通退出形成无主空间。

已有长期成员的主理人不能接受别人的长期邀请。只有当前原空间仍为单人空间时，才允许冻结并加入目标饭搭子。

## 四、邀请

`DiningGroupInvite` 使用：

```text
PENDING / ACCEPTED / DECLINED / REVOKED / EXPIRED
```

邀请是单次凭证。目标字段包括 `acceptedByUserId`、`acceptedAt`、`revokedAt`、`expiresAt`、`policyVersion` 和唯一 `tokenHash`。

接受邀请必须在一个事务中：

1. 锁定邀请和目标饭搭子。
2. 校验邀请状态与实例化有效期。
3. 校验受邀人当前仍为单人空间。
4. 解析目标饭搭子成员上限。
5. 冻结原空间。
6. 创建或恢复目标成员。
7. 更新 `UserSpace.currentDiningGroupId`。
8. 标记邀请 `ACCEPTED` 并写审计、幂等结果。

任何一步失败都整体回滚。

## 五、退出与迁出快照头

批次 A 先创建 `CarryBackSnapshot` 头，退出时即使业务模块尚无数据，也有稳定事务落点。

目标字段包括：用户、来源饭搭子、目标原空间、来源名称快照、状态、有效期、策略版本、三类条目数量和状态时间。

约束：

1. `expiresAt > createdAt`。
2. 同一用户和来源饭搭子最多一份 `AVAILABLE` 快照。
3. 重新加入同一饭搭子时，旧快照变为 `INVALIDATED`。
4. 到期按 `expiresAt` 即时判定，清理命令再幂等更新 `EXPIRED`。

退出事务同时完成：目标成员结束、原空间恢复、当前空间切回、快照头创建、审计和幂等结果。

## 六、幂等、审计与 Outbox

### IdempotencyRecord

`diningGroupId` 可空，新增 `requestHash`、`status`、`resultJson` 和 `expiresAt`。分别建立用户级和饭搭子级 partial unique index，禁止同一 operationId 更换请求体。

### AuditEvent

记录邀请接受、空间冻结、成员退出、空间恢复、快照创建、成员受限和权益切换。审计数据不计入用户空间。

### OutboxEvent

V1 建表但不启动 Worker。表保存事件类型、聚合对象、payload、状态、重试次数和执行时间；由部署命令处理。

## 七、后续批次边界

### 配置与权益

Free 是默认解析结果，只保存 Plus 或明确授权。饭搭子 Plus 包含主理人个人 Plus 是解析规则，不复制个人授权。支付订单字段等会员订单契约冻结后再建。

### 迁入与带回

使用 `SpaceImport / SpaceImportItem` 记录原空间迁入和快照带回的选择、结果与幂等状态，不复制成第二份业务真相。

### 空间账本

使用 `SpaceUsageItem` 保存每个逻辑资源占用，`SpaceUsageRollup` 保存模块聚合缓存。rollup 必须可以从 item 全量重建。

### 菜谱

菜谱批次至少包含 `DishConcept / Recipe / RecipeContentVersion / AssetReference`。必须保证私有概念饭搭子内唯一、来源版本未归档入口唯一、内容版本不可变、每根最多两个直接派生且派生不能再次派生。

### 饭局与口味

`UserTasteProfile` 独立归属用户并且不计空间；`MealGuestInvitation` 等 `MealPlan` 主表冻结后再创建真实外键。

## 八、第一批手写 SQL

Prisma 5.22.0 不能完整表达的首批约束：

1. `UserSpace` 两个复合外键。
2. 当前成员不能是 `ENDED` 的延迟约束触发器。
3. 一个饭搭子只能有一个未结束 OWNER 的 partial unique index。
4. 成员状态、原因和时间 check constraint。
5. 邀请状态和时间 check constraint。
6. 用户级、饭搭子级幂等 partial unique index。
7. `version > 0`、快照计数非负、快照有效期 check constraint。
8. 单一 AVAILABLE 快照 partial unique index。

动态成员上限由服务端事务锁定 `dining_groups` 行后解析和统计，不能仅靠静态 check constraint。

## 九、直接实施顺序

1. 修正共享契约中的 `StatusReason` 命名。
2. 直接修改 `schema.prisma` 为当前模型。
3. 创建当前开发 migration 和手写 SQL 约束。
4. 更新 seed，让每个测试用户都拥有单人空间与 `UserSpace`。
5. 重新生成 Prisma Client。
6. 重构后端当前空间、邀请、退出接口。
7. 删除小程序多饭搭子列表、本地偏好和切换逻辑。
8. 运行 Prisma 校验、全仓类型检查和生命周期事务验证。

本阶段不编写旧数据预检、回填、双写或收缩脚本。开发数据库如需重建，使用当前 seed 重新生成数据。

## 十、验收口径

1. 每个用户创建后都有原空间和唯一当前空间。
2. 接受邀请后原空间冻结且不自动迁入数据。
3. 不能同时加入两个长期饭搭子。
4. 多人饭搭子主理人不能再加入别人。
5. 接受邀请并发不能突破服务端成员上限。
6. 退出恢复与空快照头创建保持原子。
7. 代码、Schema、DTO 和客户端只存在一套当前语义。
