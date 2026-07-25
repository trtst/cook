# API 契约基线

## 定位

本文是小程序、API 和后台共享的当前契约。现行模型是“个人数据 + 多饭搭子关系 + 四档个人会员”。饭搭子只表达关系，不承载或切换用户数据。

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

路径中的资源 ID 使用 UUID v4，格式错误统一返回 `400`。`inviteToken`、`shareToken` 等不透明凭证不是 UUID，不使用 UUID 校验。存在覆盖风险的写操作提交 `expectedVersion`；服务端锁定资源后比较当前版本，不一致返回 `409`，客户端刷新详情后再决定是否重试。

OpenAPI 的成功响应必须描述完整统一 envelope 和具体 `data` schema；对象、数组和分页响应不得退化为无字段的 `object`。本文、服务端 OpenAPI 和各应用本地类型共同变更，不直接复用 Prisma Model。

请求 DTO 使用严格白名单：请求体或查询参数包含未声明字段时返回 `400`，不静默忽略旧字段。嵌套对象必须递归校验。当前菜谱正文的 `ingredients` 和 `steps` 分别最多 100 项，批量消耗冰箱条目最多 100 个且不允许空数组或重复 ID。

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
interface SessionUser {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
}

interface UserDisplay {
  profileBackgroundUrl: string | null;
  homeBackgroundUrl: string | null;
  canUseProfileBackground: boolean;
  canUseHomeBackground: boolean;
}

interface UserMembership {
  tier: EntitlementTier;
  validUntil: IsoDateTime | null;
}

interface MeResponse extends SessionUser {
  phone: string | null;
  display: UserDisplay;
  membership: UserMembership;
}

interface UserSummary {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
}

interface UserProfile extends SessionUser {
  id: UUID;
  phone: string | null;
  status: "ACTIVE" | string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
```

`uid` 是非连续公开用户号，不是主键，不能用来推算注册量。
用户侧接口默认不返回 `User.id` 这类数据库内部主键；空间等业务对象如果前端需要定位，保留业务对象自身 id。

## 饭搭子与用量 DTO

```ts
type EntitlementTier = "FREE" | "PLUS" | "PRO" | "ULTRA";
type DiningGroupRole = "OWNER" | "ADMIN" | "MEMBER";
type DiningGroupStatus = "ACTIVE" | "ARCHIVED";
type LongTermMemberStatus = "ACTIVE" | "RESTRICTED" | "ENDED";
type LongTermMemberStatusReason =
  | "LEFT"
  | "REMOVED"
  | "USER_OVER_LIMIT"
  | "OWNER_OVER_LIMIT"
  | "GROUP_DISSOLVED";
type RelationshipState = "NORMAL" | "OVER_MEMBER_LIMIT";
type StorageModule =
  | "RECIPE"
  | "FRIDGE"
  | "MEAL"
  | "SHOPPING"
  | "MEAL_GUEST"
  | "TECHNICAL_SNAPSHOT"
  | "RECYCLE_BIN"
  | "PROFILE_ASSET";

interface DiningGroupSummary {
  id: UUID;
  name: string;
  ownerUid: number;
  isOwned: boolean;
  myRole: DiningGroupRole;
  myStatus: LongTermMemberStatus;
  myStatusReason: LongTermMemberStatusReason | null;
  memberCount: number;
  memberLimit: number;
  state: RelationshipState;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface DiningGroupUsageSummary {
  ownedCount: number;
  joinedCount: number;
  joinLimit: number;
  state: RelationshipState;
}

interface GetMyDiningGroupsResponse {
  items: DiningGroupSummary[];
  usage: DiningGroupUsageSummary;
}

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

interface EffectiveImagePolicy {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  maxOutputBytes: number;
  maxInputBytes: number;
}

interface StorageUsageSummary {
  state: "NORMAL" | "OVER_STORAGE_READONLY";
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  byModule: Array<{ module: StorageModule; usedBytes: number }>;
  calculatedAt: IsoDateTime;
}
```

会员事实、关系用量和存储用量分别归属 `/users/me`、`/dining-groups` 和 `/storage-usage`。客户端不得自行拼出全局权益快照。

## 当前已实现接口

### Auth 与 User

```text
POST /auth/login
POST /auth/code-login
POST /auth/refresh
GET  /app-config
GET  /users/me
PUT  /users/me
PUT  /users/me/display
PUT  /users/me/password
```

```ts
interface PasswordLoginRequest {
  phone: string;
  password: string;
}

interface CodeLoginRequest {
  phone: string;
  code: string;
}

interface PasswordLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  user: SessionUser;
}

interface CodeLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  user: SessionUser;
}

interface RefreshSessionResult {
  token: string;
  expiresAt: IsoDateTime;
}

interface AppConfigResponse {
  login: {
    imageUrl: string | null;
  };
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

`POST /auth/code-login` 是当前客户端主登录入口。测试阶段固定验证码为 `123456`，服务端按手机号自动注册并复用同手机号唯一账号；它不新增短信表，也不复用密码登录 DTO。`POST /auth/login` 仍保留给现有脚本和旧链路，未在本轮下线。

`GET /app-config` 只返回公开启动配置。本轮只开放 `login.imageUrl`，由后台维护登录弹窗背景图；接口失败、字段为空、图片失效时，客户端回退本地图。它不得混入用户态、权限、会员、饭搭子或展示背景配置。

`GET /users/me` 和 `PUT /users/me` 返回 `MeResponse`。当前用户背景图能力未开放，`display` 中两个 URL 固定为 `null`，两个 `canUse` 字段固定为 `false`。`PUT /users/me/display` 保留路径，但当前统一返回 `503`，不得通过 URL 绕过上传能力。

### 本人饭搭子关系

```text
GET /dining-groups
Auth: UserBearerAuth
```

返回 `GetMyDiningGroupsResponse`。`items` 是本人主理和加入的有效关系，`usage` 只表达关系域计数和上限，不返回会员、菜谱、存储或展示设置。

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

只有该饭搭子的有效成员可以读取完整成员列表。

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
  diningGroup: DiningGroupSummary;
}
```

同一事务完成邀请锁定、关系上限校验、成员创建、邀请消费、审计和幂等结果。接受邀请只建立关系，不迁移、冻结或共享个人数据。

### 退出饭搭子

```text
POST /dining-groups/{diningGroupId}/leave
Auth: UserBearerAuth
```

```ts
interface LeaveDiningGroupRequest {
  operationId: UUID;
  expectedVersion: number;
}

interface LeaveDiningGroupResponse {
  diningGroupId: UUID;
  leftAt: IsoDateTime;
}
```

退出只结束成员关系，不迁移或回填个人数据。主理人不能通过该接口退出自己主理的饭搭子，应使用解散接口。

### 移除成员与解散

```text
POST /dining-groups/{diningGroupId}/remove-member
POST /dining-groups/{diningGroupId}/dissolve
Auth: UserBearerAuth
```

```ts
interface RemoveDiningGroupMemberRequest {
  operationId: UUID;
  expectedVersion: number;
  userId: UUID;
}

interface DissolveDiningGroupRequest {
  operationId: UUID;
  expectedVersion: number;
}
```

`leave`、`remove-member` 和 `dissolve` 都以 `GET /dining-groups` 返回的 `DiningGroupSummary.version` 作为预期版本。服务端在事务内锁定饭搭子并校验版本，成功变更后递增版本；相同幂等请求必须复用同一个 `operationId` 和 `expectedVersion`。

### 个人存储用量

```text
GET /storage-usage
Auth: UserBearerAuth
```

返回 `StorageUsageSummary`。该接口只负责个人存储账本，不返回会员详情、关系列表或业务对象明细。

### 后台管理

```text
POST /admin/auth/login
GET  /admin/users
POST /admin/users
PUT  /admin/users/{userId}
POST /admin/users/{userId}/status
POST /admin/users/{userId}/reset-password
GET  /admin/dining-groups
GET  /admin/user-entitlements?userId={userId}
GET  /admin/app-config
POST /admin/app-config/login-image
DELETE /admin/app-config/login-image
```

后台饭搭子状态筛选支持 `ACTIVE / ARCHIVED`，返回 `PageResult<AdminDiningGroupSummary>`。

`memberCount` 按当前有效长期成员口径返回，即只统计 `ACTIVE / RESTRICTED`，不把 `ENDED` 计入后台列表摘要。

```ts
interface CreateAdminUserRequest {
  operationId: UUID;
  phone: string;
  password: string;
  nickname?: string;
  status?: "ACTIVE" | "DISABLED";
}

interface UpdateAdminUserRequest {
  operationId: UUID;
  phone?: string;
  nickname?: string;
}

interface SetAdminUserStatusRequest {
  operationId: UUID;
  status: "ACTIVE" | "DISABLED";
}

interface ResetAdminUserPasswordRequest {
  operationId: UUID;
  newPassword: string;
}

interface AdminResetUserPasswordResponse {
  userId: UUID;
  resetAt: IsoDateTime;
}
```

```ts
interface AdminUserEntitlementResponse {
  user: Pick<UserProfile, "id" | "uid" | "nickname" | "status">;
  membership: UserMembership;
  display: Pick<UserDisplay, "canUseProfileBackground" | "canUseHomeBackground">;
  diningGroupUsage: DiningGroupUsageSummary;
  diningGroups: DiningGroupSummary[];
  storage: StorageUsageSummary;
  recipePolicy: { recipeLimit: number; recycleDays: number; variantLimitPerRoot: number };
  invitePolicy: { inviteLimit: number; memberLimit: number };
  imagePolicy: EffectiveImagePolicy;
}
```

`POST /admin/users`、`PUT /admin/users/{userId}`、`POST /admin/users/{userId}/status` 和 `POST /admin/users/{userId}/reset-password` 使用 `AdminBearerAuth`，且仅 `SUPER_ADMIN` 可访问。当前范围只支持新增用户、修改昵称/手机号、启用/禁用和重置密码；不支持物理删除用户，也不通过后台直接改用户归属数据。

用户 token 绑定服务端 `sessionVersion`。后台启用、禁用或重置密码时递增该版本；此前签发的 token 从下一次鉴权请求起统一返回 `401`，重新启用用户不会恢复旧 token。

用户权益查询使用 `AdminBearerAuth`，仅 `SUPER_ADMIN` 可访问。它是后台审计视图，按领域分段返回，不作为小程序的聚合契约。背景图能力当前统一返回 `false`。

`GET /admin/app-config`、`POST /admin/app-config/login-image` 和 `DELETE /admin/app-config/login-image` 共同维护登录弹窗图片。它们只服务这一条已确认配置，不扩成通用配置中心或通用素材库。上传成功和清空成功都返回最新 `AppConfigResponse`。

## 其他领域接口摘要

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

### 菜谱

```ts
interface RecipeContentInput {
  name: string;
  ingredients: RecipeIngredientInput[];
  steps: RecipeStepInput[];
  servings: string | null;
  durationMinutes: number | null;
}
```

`POST /recipes` 和 `PUT /recipes/{recipeId}` 只接受上述文本结构，当前不接受 `images`。请求包含 `images` 时返回 `400`；文本更新由服务端保留已有图片。详情响应的 `RecipeContentPayload` 仍可包含系统或历史图片的只读引用。

```ts
interface UpdateRecipeRequest {
  operationId: UUID;
  expectedVersion: number;
  content: RecipeContentInput;
}

interface DeleteRecipeRequest {
  operationId: UUID;
  expectedVersion: number;
}
```

更新和删除使用菜谱详情返回的 `version`。服务端锁定菜谱行后比较 `expectedVersion`，版本不一致返回 `409`，成功更新或删除后递增版本。创建、导入和举报不提交 `expectedVersion`。

```ts
interface RecipeSummary {
  id: UUID;
  ownerType: "USER" | "SYSTEM";
  title: string;
  coverImageUrl: string | null;
  sourceRecipeId: UUID | null;
  isCustomized: boolean;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  updatedAt: IsoDateTime;
}
```

现行路径为 `GET /recipes`、`GET /recipes/{recipeId}`、`POST /recipes`、`POST /recipes/{recipeId}/import`、`PUT /recipes/{recipeId}`、`POST /recipes/{recipeId}/delete` 和 `POST /recipes/{recipeId}/report`。菜谱归用户本人，饭搭子关系不改变所有权。

完整现行路径索引见 `docs/api-index.md`。新增或修改字段时，先在对应领域冻结请求和响应，再同步三端本地类型。

## 数据库与事务规则

1. 用户数据以 `userId` 归属，饭搭子关系变化不得改写数据归属。
2. 接受邀请、退出、移除成员和解散必须在事务中完成关系、审计和幂等写入。
3. 动态成员上限通过锁定目标 `dining_groups` 行防止并发突破。
4. 邀请、成员状态和幂等记录使用数据库约束保护。
5. 菜谱生命周期、版本正数、非负计数和空间、冰箱消费状态、购物来源、饭局参与人来源及带菜引用配对由数据库 Check 约束兜底。
6. 同一用户对同一菜谱最多存在一条 `OPEN` 举报，由数据库部分唯一索引保证。
7. 重要生命周期写入 `AuditEvent` 和 `OutboxEvent`；V1 不启动完整 Worker。
8. 客户端隐藏按钮不是安全边界，所有权限必须在服务端验证。
