# API 契约基线

## 定位

本文是小程序、API 和后台共享的当前契约。项目尚未上线，不保留旧饭搭子列表、手动创建空间或多饭搭子切换契约。

> 过渡说明：`dining-group.md`、`recipe.md` 和 `configuration.md` 已确认新的“个人数据 + 多饭搭子关系 + 四档个人会员”目标规则。本文中的唯一当前空间、原空间冻结、迁出快照和饭搭子 Plus 契约是当前代码现状，等待新重构计划逐步替换；在替换契约冻结前，不得继续扩展这些旧接口，也不得猜测新字段。

契约变更顺序：

1. 更新本文。
2. 更新后端 DTO、响应类型与 OpenAPI。
3. 同步小程序本地 API 类型与请求。
4. 同步后台本地 API 类型与请求。
5. 运行最小真实验证。

## 应用边界

`apps/api` 维护服务端 DTO、响应类型、校验和 OpenAPI；`apps/client` 与 `apps/admin` 分别在本端 `apis/` 内维护所需类型和请求入口。应用之间不得直接导入对方源码，接口字段以本文和 OpenAPI 为准。

## 接口职责边界

1. 每个接口必须先定义一句话职责。
2. 一个接口只服务一个明确业务判断或操作上下文。
3. 不按页面机械开接口，也不把页面顺手需要的所有数据塞进一个接口。
4. 不因为数据库查到了就返回，不因为前端少一次请求就返回重数据。
5. 权限边界、生命周期、变化频率和缓存策略不同的数据，默认不放同一个接口。
6. `current` 类接口只返回入口态，不返回后续子流程详情。
7. 列表、详情、账本、快照和统计摘要要区分，不能混成全局大接口。
8. 写接口只接收完成操作所需字段；服务端能判断的状态不从前端传入。

## 返回数据边界

1. 每个返回字段都必须能说明用途：展示、判断、后续操作、幂等或并发控制。
2. 列表接口返回摘要；详情接口返回完整内容；状态接口返回状态结论。
3. 入口接口优先返回状态结论，不返回完整子模块对象。
4. 不返回调用方无权使用、当前流程不需要，或会诱导前端自行做权限判断的数据。
5. 不同时返回多套含义接近的数据，除非它们服务不同明确场景。
6. 大字段、明细数组、账本、历史记录和快照列表必须按需接口读取。
7. 前端展示用的 `canXxx` 可以返回，但后端写操作仍必须重新校验权限。
8. 返回字段命名要区分当前事实、历史快照和缓存摘要，例如 `name`、`sourceName`、`usedBytesCache` 不能混用含义。

## 统一格式

```ts
type UUID = string;
type IsoDateTime = string;

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  serverTime: IsoDateTime;
}

interface PageQuery {
  page: number;
  pageSize: number;
}

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}
```

所有时间使用 ISO 8601；数据库使用 `TIMESTAMPTZ(3)`。所有可重试写操作携带 UUID `operationId`。共享可变对象携带 `version`。

## 鉴权

| 鉴权 | 用途 |
| --- | --- |
| `UserBearerAuth` | 小程序用户接口 |
| `AdminBearerAuth` | 后台管理接口 |

两种 token 不得混用。任何鉴权接口返回 `401` 时，客户端清理 session 和用户级缓存。

## 错误规则

| code | 含义 |
| ---: | --- |
| `0` | 成功 |
| `400` | 参数、状态或业务前置条件错误 |
| `401` | 未登录或 token 失效 |
| `403` | 已识别身份但没有权限 |
| `404` | 资源不存在或无权得知资源存在 |
| `409` | version、operationId 或并发状态冲突 |
| `429` | 请求过于频繁 |
| `503` | 功能尚未开放 |

数据库异常、堆栈和内部字段不得直接返回调用方。

## 用户 DTO

```ts
interface UserBasic {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
}

interface UserSummary {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
}

interface UserProfile extends UserBasic {
  id: UUID;
  status: "ACTIVE" | string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
```

`uid` 是非连续公开用户号，不是主键，不能用来推算注册量。
用户侧接口默认不返回 `User.id` 这类数据库内部主键；空间等业务对象如果前端需要定位，保留业务对象自身 id。

## 饭搭子领域类型

```ts
type DiningGroupRole = "OWNER" | "ADMIN" | "MEMBER";
type DiningGroupStatus = "ACTIVE" | "FROZEN" | "ARCHIVED";
type LongTermMemberStatus = "ACTIVE" | "RESTRICTED" | "ENDED";
type LongTermMemberStatusReason = "LEFT" | "REMOVED" | "GROUP_DOWNGRADED" | "GROUP_DISSOLVED";
type DiningGroupInviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED";
type OriginalSpaceStatus = "ACTIVE" | "FROZEN";
type CarryBackSnapshotStatus = "AVAILABLE" | "EXPIRED" | "DELETED" | "INVALIDATED";
type SpaceState = "NORMAL" | "OVER_RECIPE_LIMIT" | "OVER_STORAGE_READONLY";
```

```ts
interface PendingImportCounts {
  recipe: number;
  fridgeItem: number;
  planDraft: number;
  shoppingItem: number;
}

interface CurrentSpaceSummary {
  id: UUID;
  name: string;
  ownerUid: number;
  myRole: DiningGroupRole;
  myStatus: LongTermMemberStatus;
  myStatusReason: LongTermMemberStatusReason | null;
  memberCount: number;
  memberLimit: number;
  recipeCount: number;
  isShared: boolean;
  sharedSince: IsoDateTime | null;
  sharedDays: number | null;
  state: SpaceState;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface OriginalSpaceSummary {
  id: UUID;
  name: string;
  status: OriginalSpaceStatus;
  frozenAt: IsoDateTime | null;
  canImport: boolean;
  pendingImportCounts: PendingImportCounts;
}

interface CarryBackSnapshotSummary {
  id: UUID;
  sourceDiningGroupId: UUID;
  sourceDiningGroupName: string;
  status: CarryBackSnapshotStatus;
  expiresAt: IsoDateTime;
  createdAt: IsoDateTime;
  itemCounts: {
    recipe: number;
    fridgeItem: number;
    shoppingItem: number;
  };
}

type CarryItemType = "RECIPE" | "FRIDGE_ITEM" | "SHOPPING_ITEM";

interface CarryRecipeItem {
  itemId: UUID;
  itemType: "RECIPE";
  name: string;
  fixedVersionId: UUID;
  estimatedBytes: number;
}

interface CarryFridgeItem {
  itemId: UUID;
  itemType: "FRIDGE_ITEM";
  ingredientName: string;
  quantityText: string | null;
  confirmRequired: true;
  estimatedBytes: number;
}

interface CarryShoppingItem {
  itemId: UUID;
  itemType: "SHOPPING_ITEM";
  title: string;
  estimatedBytes: number;
}

type CarryBackItem = CarryRecipeItem | CarryFridgeItem | CarryShoppingItem;

interface DiningGroupMemberSummary {
  id: UUID;
  diningGroupId: UUID;
  user: UserSummary;
  role: DiningGroupRole;
  status: LongTermMemberStatus;
  statusReason: LongTermMemberStatusReason | null;
  joinedAt: IsoDateTime;
  restrictedAt: IsoDateTime | null;
  endedAt: IsoDateTime | null;
  version: number;
}
```

## 权益与空间 DTO

```ts
type EntitlementTier = "FREE" | "PLUS";
type EntitlementScope = "USER" | "DINING_GROUP";
type StorageModule = "RECIPE" | "FRIDGE" | "MEAL" | "SHOPPING" | "MEAL_GUEST" | "TECHNICAL_SNAPSHOT" | "RECYCLE_BIN";

interface EffectiveImagePolicy {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  maxOutputBytes: number;
  maxInputBytes: number;
}

interface EffectiveEntitlementSnapshot {
  personalTier: EntitlementTier;
  diningGroupTier: EntitlementTier;
  currentScope: EntitlementScope;
  recipeLimit: number;
  memberLimit: number | null;
  storageLimitBytes: number;
  snapshotDays: number;
  recycleDays: number;
  variantLimitPerRoot: number;
  imagePolicy: EffectiveImagePolicy;
}

interface StorageUsageSummary {
  state: SpaceState;
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  byModule: Array<{ module: StorageModule; usedBytes: number }>;
}
```

客户端不得自行合并个人权益与饭搭子权益。

## 当前已实现接口

### Auth 与 User

```text
POST /auth/login
POST /auth/refresh
GET  /users/me
PUT  /users/me
PUT  /users/me/password
```

```ts
interface PasswordLoginRequest {
  phone: string;
  password: string;
}

interface PasswordLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  user: UserBasic;
}

interface RefreshSessionResult {
  token: string;
  expiresAt: IsoDateTime;
}

interface UpdateCurrentUserRequest {
  nickname?: string;
  avatarUrl?: string;
}

interface ChangeCurrentPasswordRequest {
  currentPassword: string;
  newPassword: string;
}

interface ChangeCurrentPasswordResult {
  changedAt: IsoDateTime;
}
```

### 当前唯一空间

```text
GET /dining-groups/current
Auth: UserBearerAuth
```

接口职责：返回当前登录用户进入饭搭子域所需的入口态。

```ts
interface GetCurrentDiningGroupContextResponse {
  currentSpace: CurrentSpaceSummary;
  originalSpace:
    | {
        status: OriginalSpaceStatus;
        canImport: boolean;
      }
    | null;
  entitlements: EffectiveEntitlementSnapshot;
}
```

规则：

1. 每个用户只有一个服务端当前空间。
2. 单人状态 `originalSpace = null`。
3. 加入别人后返回被冻结的本人原空间。
4. 服务端根据当前用户、当前饭搭子和有效 Plus 授权解析权益。
5. `currentSpace.memberCount` 按当前有效长期成员口径返回，即统计 `ACTIVE / RESTRICTED`，不把 `ENDED` 计入。
6. `currentSpace.isShared` 仅在当前存在非主理人的 `ACTIVE / RESTRICTED` 长期成员时为 `true`。
7. `currentSpace.sharedSince` 取当前有效非主理人长期成员最早加入时间；`sharedDays` 由服务端按该时间计算，当天为 1 天。
8. `currentSpace.recipeCount` 是当前饭搭子可见有效菜谱数；菜谱主表落地前实现返回 `0`。

打磨方向：

1. `/dining-groups/current` 应收敛为入口态接口。
2. 可保留 `currentSpace`、必要的 relation 状态和必要的 `entitlements`。
3. `originalSpace` 详情应在用户进入原空间流程时按需读取；当前接口最多返回是否处于加入别人饭搭子的状态结论。
4. `carryBackSnapshots` 属于迁出快照列表，应走 `/carry-back-snapshots`。
5. `storage` 属于空间计量或账本，应走 `/storage-usage` 或后续已冻结的存储接口。

### 当前有效权益

```text
GET /entitlements/current
Auth: UserBearerAuth
```

返回 `EffectiveEntitlementSnapshot`。Free 是默认解析结果，只有 Plus 授权落库；接口只解析登录用户和其当前饭搭子，不接受调用方传入主体 id。饭搭子 Plus 包含主理人的个人 Plus，普通成员的个人 Plus 不会叠加为饭搭子 Plus。

### 成员列表

```text
GET /dining-group-members?diningGroupId={currentDiningGroupId}
Auth: UserBearerAuth
```

```ts
interface DiningGroupMembersResult {
  diningGroupId: UUID;
  members: DiningGroupMemberSummary[];
}
```

只有当前 `ACTIVE` 成员可以读取完整成员列表。

### 创建邀请

```text
POST /dining-group-invites
Auth: UserBearerAuth
```

```ts
interface CreateInviteRequest {
  diningGroupId: UUID;
  operationId: UUID;
}

interface CreateInviteResult {
  inviteToken: string;
  sharePath: string;
  expiresAt: IsoDateTime;
}
```

邀请是单次不透明凭证，只保存 SHA-256 哈希。`OWNER / ADMIN` 可邀请，`MEMBER` 不可邀请。

### 接受邀请

```text
POST /dining-group-invites/{inviteToken}/accept
Auth: UserBearerAuth
```

```ts
interface AcceptInviteRequest {
  operationId: UUID;
}

interface AcceptInviteResponse {
  currentSpace: CurrentSpaceSummary;
  originalSpace: {
    status: OriginalSpaceStatus;
    canImport: boolean;
  };
  pendingImportCounts: PendingImportCounts;
}
```

同一事务完成邀请锁定、席位校验、原空间冻结、成员创建、当前空间切换、邀请消费、审计和幂等结果。用户已有长期饭搭子，或本人原空间已有其他成员时拒绝加入。

### 退出饭搭子

```text
POST /dining-groups/{diningGroupId}/leave
Auth: UserBearerAuth
```

```ts
interface LeaveDiningGroupRequest {
  operationId: UUID;
}

interface LeaveDiningGroupResponse {
  restoredSpace: CurrentSpaceSummary;
  carryBackSnapshot: CarryBackSnapshotSummary | null;
  futureParticipationCount: number;
}
```

同一事务结束成员关系、恢复原空间、切换当前空间并创建迁出快照头。主理人不能直接退出自己的空间。

### 后台只读

```text
POST /admin/auth/login
GET  /admin/users
GET  /admin/dining-groups
GET  /admin/user-entitlements?userId={userId}
```

后台饭搭子状态筛选支持 `ACTIVE / FROZEN / ARCHIVED`，返回 `PageResult<AdminDiningGroupSummary>`。

`memberCount` 按当前有效长期成员口径返回，即只统计 `ACTIVE / RESTRICTED`，不把 `ENDED` 计入后台列表摘要。

```ts
interface AdminUserEntitlementResponse {
  user: Pick<UserProfile, "id" | "uid" | "nickname" | "status">;
  currentSpace: {
    id: UUID;
    name: string;
  };
  entitlements: EffectiveEntitlementSnapshot;
}
```

用户权益查询使用 `AdminBearerAuth`，仅 `SUPER_ADMIN` 可访问。接口只返回用户最小摘要、当前空间最小摘要和服务端解析后的有效权益；不返回原始授权、历史、订单、支付、空间用量或其他私有数据。

## 已冻结、待实现接口

### 原空间迁入

```text
GET  /original-space/importable-data
POST /original-space/imports
```

```ts
type ImportableItemType = "RECIPE" | "FRIDGE_ITEM" | "PLAN_DRAFT" | "SHOPPING_ITEM";
type DuplicateState = "NONE" | "EXACT" | "SIMILAR";

interface GetOriginalSpaceImportableDataQuery extends PageQuery {
  itemType: ImportableItemType;
}

interface OriginalSpaceImportSelection {
  itemType: ImportableItemType;
  itemId: UUID;
}

interface ImportOriginalSpaceDataRequest {
  operationId: UUID;
  selections: OriginalSpaceImportSelection[];
}

interface ImportOriginalSpaceDataResponse {
  importedCount: number;
  skippedCount: number;
  state: SpaceState;
  usedBytes: number;
  limitBytes: number;
}
```

迁入是复制，不是移动。菜谱允许批量；冰箱仅迁入本人确认带入的真实物品；计划只复制本人未发布草稿；购物只复制本人未购买需求。

### 迁出快照带回

```text
GET  /carry-back-snapshots
GET  /carry-back-snapshot-items
POST /carry-back-snapshots/{snapshotId}/imports
Auth: UserBearerAuth
```

```ts
interface GetCarryBackSnapshotsResponse {
  snapshots: CarryBackSnapshotSummary[];
}

interface CarryItemsQuery extends PageQuery {
  snapshotId: UUID;
  itemType: CarryItemType;
}

type CarryItemsResponse = PageResult<CarryBackItem>;

interface CarryBackImportSelection {
  itemType: "RECIPE" | "FRIDGE_ITEM" | "SHOPPING_ITEM";
  itemId: UUID;
}

interface ImportCarryBackSnapshotRequest {
  operationId: UUID;
  selections: CarryBackImportSelection[];
}
```

快照头列表只返回退出人本人 `AVAILABLE` 且尚未到期的快照，按 `createdAt` 倒序排列；`itemCounts` 是快照冻结时的三类清单总数，不随分批导入递减。

清单项接口只返回尚可选择的冻结摘要，`itemId` 是快照清单项 ID，不是源饭搭子业务对象 ID。结果先按快照冻结顺序稳定排列，再以 `itemId` 作为最终同序项排序依据；指定类型没有可选项时返回成功的空分页。三类摘要不返回图片、成员信息或饭搭子内部备注。

只有快照本人可以读取 `AVAILABLE` 且尚未到期的清单。非本人、已过期、`DELETED` 或 `INVALIDATED` 均按不可探测资源返回 `404`。快照头和清单查询均不更新快照状态，也不读取原饭搭子的实时数据。导入数据永久保留；快照到期不回滚已导入数据。

### 空间

```text
GET /storage-usage
Auth: UserBearerAuth
```

返回 `StorageUsageSummary`。

当前账本尚未接入时，服务端返回真实 `0` 使用量，以及按当前有效权益解析出的 `limitBytes / remainingBytes`。

### 我的口味

```text
GET /users/me/taste-profile
PUT /users/me/taste-profile
```

```ts
interface UpdateTasteProfileRequest {
  allergies: string[];
  strictDislikes: string[];
  dislikedIngredients: string[];
  flavorPreferences: string[];
  note: string | null;
}
```

口味归用户本人，不参与空间迁移，不计入会员空间。过敏和严格忌口永久免费。

### 饭局邀请

```text
POST /meal-plans/{mealPlanId}/guest-invitations
POST /meal-guest-invitations/{invitationId}/respond
```

饭局参与人不是长期成员，不占长期席位，不获得冰箱、购物清单、完整菜谱库或其他内部计划权限。

### 菜谱

```ts
type RecipeRecordStatus = "ACTIVE" | "ARCHIVED" | "RECYCLED";
type RecipeOriginType = "MANUAL" | "SYSTEM" | "PUBLIC" | "SPACE_IMPORT" | "CARRY_BACK" | "DERIVED";

interface RecipeSummary {
  id: UUID;
  dishConceptId: UUID;
  rootRecipeId: UUID | null;
  name: string;
  variantName: string | null;
  originType: RecipeOriginType;
  status: RecipeRecordStatus;
  coverUrl: string | null;
  sourceVersionId: UUID | null;
  currentVersionId: UUID;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
```

已冻结：`GET /recipes/{recipeId}`、`POST /recipe-imports`、`POST /recipe-variants`。

待补契约：`GET /recipes`、`GET /system-recipes` 的筛选分页，以及 `POST /recipes`、`PUT /recipes/{recipeId}` 的成功响应。

普通保存不产生用户可见历史。派生只允许根菜谱创建，同一根最多两个，派生不能再次派生。

## 数据库与事务规则

1. 当前空间由 `UserSpace` 唯一指针保证。
2. 接受邀请和退出恢复使用延迟复合外键与事务。
3. 动态成员上限通过锁定目标 `dining_groups` 行防止并发突破。
4. 邀请、成员状态、快照和幂等记录有手写 SQL check/partial unique 约束。
5. 重要生命周期写入 `AuditEvent` 和 `OutboxEvent`；V1 不启动完整 Worker。
6. 客户端隐藏按钮不是安全边界，所有权限必须在服务端验证。
