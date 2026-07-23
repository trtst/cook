# 下一餐客户端 API 手册

## 简介

本文面向小程序和后台调用方，记录当前个人数据与多饭搭子关系模型的调用边界。完整路径索引见 `docs/api-index.md`，共享 DTO 见 `docs/api-contract.md`。

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
  "serverTime": "2026-07-23T12:00:00.000Z"
}
```

小程序用户接口使用 `Authorization: Bearer <user-token>`。后台接口使用独立管理员 token，两种 token 不得混用。

## 变更日志

| 日期 | 变更 |
| --- | --- |
| 2026-07-23 | 用户、会员事实、饭搭子关系和存储用量按领域拆分；移除客户端全局权益快照依赖。 |
| 2026-07-23 | 背景图字段暂时保留，当前统一返回空 URL 和 `false` 能力位；背景设置写接口返回 `503`。 |
| 2026-07-23 | 饭搭子切换为多关系列表，关系变化不迁移、不冻结个人数据。 |

## 快速索引

| 方法 | Path | 客户端调用 | 职责 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | `authApi.loginWithPassword` | 登录并创建会话 |
| POST | `/api/auth/refresh` | `authApi.refreshSession` | 刷新会话 |
| GET | `/api/users/me` | `userApi.getCurrent` | 身份、展示占位和会员事实 |
| PUT | `/api/users/me` | `userApi.updateCurrent` | 更新昵称和头像 |
| PUT | `/api/users/me/display` | `userApi.updateDisplay` | 预留背景设置，当前返回 `503` |
| PUT | `/api/users/me/password` | `userApi.changeCurrentPassword` | 修改密码 |
| GET | `/api/users/me/taste-profile` | `userApi.getTasteProfile` | 本人口味与安全资料 |
| PUT | `/api/users/me/taste-profile` | `userApi.updateTasteProfile` | 更新本人口味与安全资料 |
| GET | `/api/dining-groups` | `diningGroupApi.getMine` | 关系列表和关系用量 |
| GET | `/api/dining-group-members` | `diningGroupApi.listMembers` | 指定关系的成员列表 |
| GET | `/api/storage-usage` | `diningGroupApi.getStorageUsage` | 个人存储用量 |
| POST | `/api/dining-group-invites` | `diningGroupApi.createInvite` | 创建关系邀请 |
| POST | `/api/dining-group-invites/{inviteToken}/accept` | `diningGroupApi.acceptInvite` | 接受邀请并建立关系 |
| POST | `/api/dining-groups/{diningGroupId}/leave` | `diningGroupApi.leave` | 退出关系 |
| GET | `/api/admin/user-entitlements` | `userApi.getEntitlements` | 后台分域审计视图 |

## 1. 用户与会员

### 1.1 登录

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

```ts
interface PasswordLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  user: {
    uid: number;
    nickname: string | null;
    avatarUrl: string | null;
  };
}
```

登录响应只提供建立会话所需的最小用户摘要。登录成功后调用 `/api/users/me` 拉取完整本人资料。

### 1.2 当前用户

```text
GET /api/users/me
Auth: UserBearerAuth
```

成功 `data`：

```ts
interface MeResponse {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  display: {
    profileBackgroundUrl: string | null;
    homeBackgroundUrl: string | null;
    canUseProfileBackground: boolean;
    canUseHomeBackground: boolean;
  };
  membership: {
    tier: "FREE" | "PLUS" | "PRO" | "ULTRA";
    validUntil: IsoDateTime | null;
  };
}
```

当前背景图能力未开放，因此四个展示字段固定为：

```json
{
  "profileBackgroundUrl": null,
  "homeBackgroundUrl": null,
  "canUseProfileBackground": false,
  "canUseHomeBackground": false
}
```

客户端不下载、不预缓存背景图，也不持久化背景 URL。后续开放图片资产能力时，再单独冻结上传、访问 URL、缓存失效和清理规则。

### 1.3 更新资料

```text
PUT /api/users/me
Auth: UserBearerAuth
```

请求只允许昵称和头像：

```json
{
  "nickname": "小明",
  "avatarUrl": "https://example.com/avatar.png"
}
```

成功返回 `MeResponse`。背景图不得混入本接口。

### 1.4 背景设置预留接口

```text
PUT /api/users/me/display
Auth: UserBearerAuth
```

路径和请求类型暂时保留，但能力未开放，当前统一返回：

```json
{
  "code": 503,
  "message": "功能开发中，敬请期待",
  "data": null
}
```

客户端当前不展示背景 URL 输入或上传入口。

## 2. 饭搭子关系

### 2.1 本人关系列表

```text
GET /api/dining-groups
Auth: UserBearerAuth
```

成功 `data`：

```ts
interface GetMyDiningGroupsResponse {
  items: DiningGroupSummary[];
  usage: {
    ownedCount: number;
    joinedCount: number;
    joinLimit: number;
    state: "NORMAL" | "OVER_MEMBER_LIMIT";
  };
}
```

`items` 只返回本人主理或加入的有效关系。`usage` 只属于关系域，不包含会员详情、存储用量、菜谱配额或展示设置。

客户端可以保存当前页面选中的 `diningGroupId`，但它只是 UI 选择，不是数据空间切换，也不得改变菜谱、冰箱、计划或购物数据的 `userId` 归属。

### 2.2 成员列表

```text
GET /api/dining-group-members?diningGroupId=<diningGroupId>
Auth: UserBearerAuth
```

成功 `data` 为：

```ts
interface DiningGroupMembersResult {
  diningGroupId: UUID;
  members: DiningGroupMemberSummary[];
}
```

调用人必须是该饭搭子的有效成员。

### 2.3 邀请与退出

所有写操作携带并复用 UUID `operationId`：

```text
POST /api/dining-group-invites
POST /api/dining-group-invites/{inviteToken}/accept
POST /api/dining-groups/{diningGroupId}/leave
POST /api/dining-groups/{diningGroupId}/remove-member
POST /api/dining-groups/{diningGroupId}/dissolve
```

接受邀请只建立成员关系；退出、移除和解散只结束关系。以上操作都不迁移、不复制、不冻结、不恢复个人数据。

## 3. 个人存储

```text
GET /api/storage-usage
Auth: UserBearerAuth
```

成功 `data`：

```ts
interface StorageUsageSummary {
  state: "NORMAL" | "OVER_STORAGE_READONLY";
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  byModule: Array<{ module: string; usedBytes: number }>;
  calculatedAt: IsoDateTime;
}
```

该接口只负责个人逻辑存储账本。客户端不得从会员等级自行计算额度，也不得把 `byModule` 当成业务对象列表。

## 4. 后台审计

```text
GET /api/admin/user-entitlements?userId=<userId>
Auth: AdminBearerAuth
```

返回分域结构：`membership`、`display`、`diningGroupUsage`、`diningGroups`、`storage`、`recipePolicy`、`invitePolicy` 和 `imagePolicy`。

该接口只用于 `SUPER_ADMIN` 审计，不是小程序共享快照。背景图能力当前在后台也固定显示为未开放。

## 5. 客户端规则

1. 小程序和后台分别通过本端 `apis/` 请求层调用接口，不跨应用导入类型。
2. `401` 清理 session、用户资料和关系状态。
3. 可重试写操作生成并复用 `operationId`，成功后再清除。
4. 会员事实只读 `/users/me.membership`；关系用量只读 `/dining-groups.usage`；存储只读 `/storage-usage`。
5. 不使用旧字段兼容、多个字段 fallback 或本地拼装全局权益对象。
