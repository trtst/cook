# 下一餐客户端 API 手册

## 简介

本文面向小程序和后台调用方，只记录当前真实接口与已经冻结的待实现接口。DTO 权威见 `docs/api-contract.md` 和 `packages/api-client`。

默认本地地址：

```text
http://127.0.0.1:3100/api
```

统一响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "serverTime": "2026-07-20T12:00:00.000Z"
}
```

除登录外，小程序接口使用：

```text
Authorization: Bearer <user-token>
```

后台接口使用独立管理员 token，不得与用户 token 混用。

## 变更日志

| 日期 | 变更 |
| --- | --- |
| 2026-07-20 | 饭搭子接口直接切换为唯一当前空间；删除多列表、手动创建和详情接口；实现原空间冻结、退出恢复与快照头。 |
| 2026-07-20 | 冻结迁入迁出、权益、空间、口味、饭局、菜谱收录与派生契约。 |
| 2026-07-19 | 接入真实 Auth、User 和后台只读接口。 |

## 快速索引

| 编号 | 方法 | Path | api-client | 状态 |
| --- | --- | --- | --- | --- |
| C-001 | POST | `/api/auth/login` | `auth.loginWithPassword` | 已实现 |
| C-002 | POST | `/api/auth/refresh` | `auth.refreshSession` | 已实现 |
| C-003 | GET | `/api/users/me` | `user.getCurrent` | 已实现 |
| C-004 | PUT | `/api/users/me` | `user.updateCurrent` | 已实现 |
| C-005 | GET | `/api/dining-groups/current` | `diningGroup.getCurrent` | 已实现 |
| C-006 | GET | `/api/dining-group-members` | `diningGroup.listMembers` | 已实现 |
| C-007 | POST | `/api/dining-group-invites` | `diningGroup.createInvite` | 已实现 |
| C-008 | POST | `/api/dining-group-invites/{inviteToken}/accept` | `diningGroup.acceptInvite` | 已实现 |
| C-009 | POST | `/api/dining-groups/{diningGroupId}/leave` | `diningGroup.leave` | 已实现 |
| A-001 | POST | `/api/admin/auth/login` | `admin.login` | 已实现 |
| A-002 | GET | `/api/admin/users` | `admin.listUsers` | 已实现 |
| A-003 | GET | `/api/admin/dining-groups` | `admin.listDiningGroups` | 已实现 |

## 1. 用户认证

### 1.1 手机号密码登录

```text
POST /api/auth/login
Auth: none
```

请求：

```json
{
  "phone": "13800000000",
  "password": "change-me"
}
```

成功 `data`：

```json
{
  "token": "<token>",
  "expiresAt": "2026-08-03T12:00:00.000Z",
  "userId": "00000000-0000-4000-8000-000000000001",
  "user": {
    "id": "00000000-0000-4000-8000-000000000001",
    "uid": 52738164,
    "nickname": "下一餐用户",
    "avatarUrl": null,
    "phone": "13800000000"
  }
}
```

手机号、密码错误或账号禁用统一返回 `401`。

### 1.2 刷新登录态

```text
POST /api/auth/refresh
Auth: UserBearerAuth
```

成功 `data`：

```json
{
  "token": "<new-token>",
  "expiresAt": "2026-08-03T12:00:00.000Z"
}
```

### 1.3 当前用户

```text
GET /api/users/me
PUT /api/users/me
Auth: UserBearerAuth
```

更新请求允许：

```json
{
  "nickname": "小明",
  "avatarUrl": "https://example.com/avatar.png",
  "phone": "13800000000"
}
```

GET 和 PUT 都返回 `UserBasic`。

## 2. 当前饭搭子

### 2.1 获取唯一当前空间

```text
GET /api/dining-groups/current
Auth: UserBearerAuth
```

成功 `data`：

```ts
interface GetCurrentDiningGroupContextResponse {
  currentSpace: CurrentSpaceSummary;
  originalSpace: OriginalSpaceSummary | null;
  carryBackSnapshots: CarryBackSnapshotSummary[];
  entitlements: EffectiveEntitlementSnapshot;
  storage: StorageUsageSummary;
}
```

单人状态下 `originalSpace = null`。加入别人后，`currentSpace` 是目标饭搭子，`originalSpace.status = FROZEN`。

客户端只保存这一份服务端上下文，不保存本地当前饭搭子 ID，也不提供普通切换操作。

### 2.2 当前饭搭子成员

```text
GET /api/dining-group-members?diningGroupId=<currentDiningGroupId>
Auth: UserBearerAuth
```

成功 `data`：

```ts
interface DiningGroupMembersResult {
  diningGroupId: UUID;
  members: DiningGroupMemberSummary[];
}
```

参数必须是服务端当前空间；修改参数访问其他空间返回 `404`。受限成员不能读取完整成员列表。

### 2.3 创建长期邀请

```text
POST /api/dining-group-invites
Auth: UserBearerAuth
```

请求：

```json
{
  "diningGroupId": "<currentDiningGroupId>",
  "operationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

成功 `data`：

```ts
interface CreateInviteResult {
  inviteToken: string;
  sharePath: string;
  expiresAt: IsoDateTime;
}
```

规则：

1. 只保存 token 哈希。
2. 邀请是单次凭证。
3. 相同 `operationId` 返回第一次生成的同一个 token 和有效期。
4. 当前配置中心未接入时使用服务端安全默认有效期。

### 2.4 接受长期邀请

```text
POST /api/dining-group-invites/{inviteToken}/accept
Auth: UserBearerAuth
```

请求：

```json
{
  "operationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

成功 `data`：

```ts
interface AcceptInviteResponse {
  currentSpace: CurrentSpaceSummary;
  originalSpace: OriginalSpaceSummary;
  pendingImportCounts: PendingImportCounts;
}
```

一个事务内完成：锁定邀请和饭搭子、校验席位、冻结单人原空间、建立成员、切换当前空间、消费邀请、写审计和幂等结果。

以下情况拒绝：

1. 邀请不存在、已过期或已消费。
2. 用户已经加入另一个长期饭搭子。
3. 用户主理的原空间已经有其他长期成员。
4. 目标饭搭子成员已满。
5. 用户尝试加入自己的饭搭子。

### 2.5 退出长期饭搭子

```text
POST /api/dining-groups/{diningGroupId}/leave
Auth: UserBearerAuth
```

请求：

```json
{
  "operationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

成功 `data`：

```ts
interface LeaveDiningGroupResponse {
  restoredSpace: CurrentSpaceSummary;
  carryBackSnapshot: CarryBackSnapshotSummary | null;
  futureParticipationCount: number;
}
```

当前业务模块尚未建表，所以快照头的三类条目数量为 `0`，`futureParticipationCount = 0`。后续模块接入后由真实数据填充，不能在客户端模拟。

主理人不能通过本接口退出自己的空间。

## 3. 后台接口

### 3.1 管理员登录

```text
POST /api/admin/auth/login
Auth: none
```

请求：

```json
{
  "username": "admin",
  "password": "change-me"
}
```

### 3.2 用户只读查询

```text
GET /api/admin/users?page=1&pageSize=20&keyword=
Auth: AdminBearerAuth
```

返回 `PageResult<UserProfile>`。

### 3.3 饭搭子只读查询

```text
GET /api/admin/dining-groups?page=1&pageSize=20&keyword=&status=ACTIVE
Auth: AdminBearerAuth
```

`status` 支持 `ACTIVE / FROZEN / ARCHIVED`，返回 `PageResult<AdminDiningGroupSummary>`。

## 4. 已契约、待实现

| 能力 | Path |
| --- | --- |
| 原空间资料 | `GET /api/original-space/importable-data` |
| 原空间迁入 | `POST /api/original-space/imports` |
| 迁出快照列表 | `GET /api/carry-back-snapshots` |
| 迁出快照带回 | `POST /api/carry-back-snapshots/{snapshotId}/imports` |
| 当前权益 | `GET /api/entitlements/current` |
| 空间明细 | `GET /api/storage-usage` |
| 我的口味 | `GET/PUT /api/users/me/taste-profile` |
| 饭局邀请 | `POST /api/meal-plans/{mealPlanId}/guest-invitations` |
| 饭局回应 | `POST /api/meal-guest-invitations/{invitationId}/respond` |
| 菜谱详情 | `GET /api/recipes/{recipeId}` |
| 菜谱收录 | `POST /api/recipe-imports` |
| 另存新做法 | `POST /api/recipe-variants` |

菜谱列表筛选、系统菜谱分页、菜谱创建/更新成功响应和会员订单仍待补契约。

## 5. 客户端规则

1. 所有请求通过 `packages/api-client`。
2. 任何 `401` 清理用户 session、用户资料和饭搭子上下文。
3. 写操作生成并复用 `operationId`，成功后再清除。
4. 客户端不计算会员、成员上限、快照期限、空间状态或图片参数。
5. 不使用多字段 fallback 或本地 mock 隐藏契约缺失。
