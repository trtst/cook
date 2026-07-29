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
type ResourceId = UUID;
type OperationId = UUID;
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

路径中的资源 ID 使用 UUID v4，格式错误统一返回 `400`。`inviteToken`、`shareToken` 和 `operationId` 等不透明凭证不是资源 ID，不使用资源 ID 校验。存在覆盖风险的写操作提交 `expectedVersion`；服务端锁定资源后比较当前版本，不一致返回 `409`，客户端刷新详情后再决定是否重试。

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
GET  /admin/dashboard/summary
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
GET  /admin/ingredient-categories
POST /admin/ingredient-categories
PUT  /admin/ingredient-categories/{categoryId}
POST /admin/ingredient-categories/reorder
GET  /admin/units
POST /admin/units
PUT  /admin/units/{unitId}
DELETE /admin/units/{unitId}
POST /admin/units/reorder
GET  /admin/ingredients
POST /admin/ingredients
PUT  /admin/ingredients/{ingredientId}
POST /admin/ingredients/{ingredientId}/status
POST /admin/ingredients/{ingredientId}/image
DELETE /admin/ingredients/{ingredientId}/image
POST /admin/ingredients/reorder
GET  /admin/pending-ingredients
POST /admin/pending-ingredients/{ingredientId}/review
```

后台饭搭子状态筛选支持 `ACTIVE / ARCHIVED`，返回 `PageResult<AdminDiningGroupSummary>`。

`memberCount` 按当前有效长期成员口径返回，即只统计 `ACTIVE / RESTRICTED`，不把 `ENDED` 计入后台列表摘要。

`GET /admin/dashboard/summary` 是后台首页只读摘要接口，只返回首页当前需要的计数，不混入分页列表、明细、趋势和策略对象。当前固定返回四组统计：用户 `total / activeCount / disabledCount`，饭搭子 `total / activeCount / memberCount`，菜谱 `total / activeCount / blockedCount / recycledCount / openReportCount`，以及基础资料 `categoryCount / itemCount / unitCount`。其中 `memberCount` 继续沿用后台饭搭子列表的有效成员口径，只统计 `ACTIVE / RESTRICTED`。

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

后台系统食材治理本轮新增：

```text
GET  /admin/ingredient-categories
POST /admin/ingredient-categories
PUT  /admin/ingredient-categories/{categoryId}
POST /admin/ingredient-categories/reorder
GET  /admin/units
POST /admin/units
PUT  /admin/units/{unitId}
DELETE /admin/units/{unitId}
POST /admin/units/reorder
GET  /admin/ingredients
POST /admin/ingredients
PUT  /admin/ingredients/{ingredientId}
POST /admin/ingredients/{ingredientId}/status
POST /admin/ingredients/{ingredientId}/image
DELETE /admin/ingredients/{ingredientId}/image
POST /admin/ingredients/reorder
GET  /admin/pending-ingredients
POST /admin/pending-ingredients/{ingredientId}/review
```

这一组接口治理 `系统食材分类 + 系统食材 + 系统单位 + 个人食材推荐审核`。系统单位是后台运营面维护的公共基础数据，多个后台录入入口统一复用这一组接口并按 `type` 分组展示；个人食材只通过待审列表进入后台，不在系统食材列表里直接混排编辑。

`GET /admin/ingredient-categories` 返回全部系统食材分类摘要，按后台排序返回。分类摘要新增 `code`、`isSelectable`、`version`、`ingredientCount` 和 `updatedAt`，用于后台编辑、兜底分类识别和排序并发控制；当前 `ingredientCount` 统计后台仍可治理的系统食材总数，即 `ACTIVE + DISABLED`，不包含已归并条目。系统正式分类在上线前固定，后台不再开放常规新增，只保留名称微调和排序；隐藏兜底分类 `待归类` 会通过 `isSelectable = false` 返回。`POST /admin/ingredient-categories/reorder` 提交完整分类集合的 `id + expectedVersion` 顺序，成功后统一重写排序并递增对应 `version`。

`GET /admin/units` 返回全部系统单位摘要，按 `type -> systemSortOrder -> name` 排序；系统单位摘要新增 `version` 和 `updatedAt`，用于后台编辑、删除和拖拽排序的并发控制。`POST /admin/units` 新建一个系统单位；`PUT /admin/units/{unitId}` 修改单位名称或类型；`DELETE /admin/units/{unitId}` 只在该单位未被任何食材引用时允许删除，否则返回冲突错误；`POST /admin/units/reorder` 只重排某一个 `type` 分组下的完整系统单位集合，成功后统一重写该分组顺序。

`GET /admin/ingredients` 只返回系统食材分页，查询参数固定为 `page`、`pageSize`，并支持 `categoryId`、`keyword` 和 `status` 过滤；`status` 允许 `ACTIVE / DISABLED / ALL`，默认 `ACTIVE`。后台排序按“分类内系统顺序”返回，不再按创建时间倒序表达运营顺序。系统食材摘要新增 `version`、`status`、`categoryName`、`imageUrl` 和 `updatedAt`，用于后台编辑、图片治理和排序。`POST /admin/ingredients/{ingredientId}/status` 用于把系统食材切到 `ACTIVE / DISABLED`，下架不做物理删除；重新上架时服务端会把该食材放到当前分类排序末尾，避免与现有启用中食材顺序冲突。`POST /admin/ingredients/{ingredientId}/image` 只接受后台裁好的 `50x50 PNG`，成功后覆盖当前系统食材图片并递增 `version`；`DELETE /admin/ingredients/{ingredientId}/image` 清空当前系统食材图片并递增 `version`。公开图片读取仍走 `GET /public-assets/ingredients/{ingredientId}`，但只有数据库中仍为启用中的系统食材且 `imageUpdatedAt` 非空时才返回资源，已下架食材即使静态文件还在也不得继续外露。`POST /admin/ingredients/reorder` 只接收一个分类下的完整系统食材集合顺序，且仅针对当前启用中的系统食材；服务端校验集合完整性和 `expectedVersion` 后重写该分类的系统食材顺序。`GET /admin/pending-ingredients` 只返回待审核的个人食材推荐分页，同样固定使用 `page`、`pageSize`；`POST /admin/pending-ingredients/{ingredientId}/review` 允许后台按 `通过为系统食材 / 通过并归并到现有系统食材 / 拒绝` 三种结果处理，并可在通过前调整 `名称 + 分类 + 默认单位`。拒绝时必须选择预设 `rejectReasonCode`：`NAME_NOT_CLEAR / NAME_HAS_BRAND / CATEGORY_NOT_FIT / UNIT_NOT_FIT / OUT_OF_SCOPE / OTHER`；只有 `OTHER` 仍要求补充详细 `reason`。服务端会把对应建议写入推荐记录，供前台“我的推荐”直接展示。若审核通过时命中同名但已下架的系统食材，服务端直接复用该系统食材并恢复为启用中，不再额外创建重复系统食材。

后台菜谱治理当前补充为：

```text
GET /admin/recipes
GET /admin/recipes/{recipeId}
PUT /admin/recipes/{recipeId}
GET /admin/recipe-reports
POST /admin/recipes/{recipeId}/block
POST /admin/recipes/{recipeId}/unblock
POST /admin/recipe-reports/{reportId}/resolve
```

`GET /admin/recipes` 只返回后台菜谱列表最小摘要，查询参数固定为 `page`、`pageSize`，并支持 `keyword`、`status` 过滤；列表不再混入举报筛选、举报数和下架原因，排序统一按 `updatedAt desc`。`GET /admin/recipes/{recipeId}` 返回后台详情视图，覆盖系统灵感菜谱和个人菜谱，但只读字段与正文内容分开：详情固定返回 `personalCategory / inspirationCategory`、`contentVersionId`、当前正文快照、`reportCount`、`blockedReason`、`likeCount`、`collectCount` 和 `canEdit`。`PUT /admin/recipes/{recipeId}` 只允许 `SUPER_ADMIN` 编辑当前灵感菜谱正文，且仅限 `ownerId = null`、当前仍挂灵感分类的菜谱；请求体必须携带 `operationId`、`expectedVersion`、`inspirationCategoryId` 和完整正文输入。保存时服务端不得原地覆盖旧正文版本，而是新建一条 `RecipeContentVersion`，再把菜谱 `currentVersionId`、`title`、`searchText` 和 `inspirationCategoryId` 切到新版本，保证已收藏、已引用和历史固定版本不漂移。后台编辑正文时食材和单位只允许引用当前可选的系统食材与系统单位，不开放图片写入。

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

菜谱 R1 本轮冻结为两条最小链路：`草稿 -> 发布到我的`，以及 `灵感固定版本 -> 收藏到合集`。现有直接创建、直接更新和导入接口仍是候选实现，不属于 R1 契约；实现时直接替换，不保留旧字段 fallback。

```ts
type RecipeDifficulty = "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING";
type RecipeDuration = "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60";
type UnitType = "WEIGHT" | "VOLUME" | "COUNT" | "SHAPE" | "CONTAINER" | "PACKAGE" | "OTHER";
type IngredientSource = "SYSTEM" | "PERSONAL";
type InspirationSort = "RECOMMENDED" | "LATEST";

type RecipeAmountInput =
  | { kind: "EXACT"; quantity: string; unitId: UUID }
  | { kind: "FUZZY"; text: "适量" | "少许" | "按需" };

type RecipeAmountSnapshot =
  | {
      kind: "EXACT";
      quantity: string;
      unitId: UUID;
      unitName: string;
      unitType: UnitType;
    }
  | {
      kind: "FUZZY";
      text: "适量" | "少许" | "按需";
    };

interface RecipeCategorySummary {
  id: UUID;
  name: string;
  version: number;
}

interface RecipeSceneSummary {
  id: UUID;
  name: string;
  version: number;
}

interface InspirationCategorySummary {
  id: UUID;
  name: string;
  iconKey: string | null;
}

interface IngredientCategorySummary {
  id: UUID;
  name: string;
}

interface UnitSummary {
  id: UUID;
  name: string;
  type: UnitType;
  source: IngredientSource;
}

interface IngredientSummary {
  id: UUID;
  name: string;
  source: IngredientSource;
  categoryId: UUID;
  defaultUnit: UnitSummary;
  imageUrl: string | null;
  recommendationStatus: "PENDING" | "REJECTED" | null;
  version: number;
}

type IngredientRecommendationStatus = "PENDING" | "REJECTED" | "ADOPTED" | "MERGED";

interface IngredientRecommendationSummary {
  id: UUID;
  ingredientId: UUID;
  ingredientVersion: number;
  ingredientName: string;
  status: IngredientRecommendationStatus;
  category: IngredientCategorySummary;
  defaultUnit: UnitSummary;
  reviewNote: string | null;
  reviewAdvice: string | null;
  adoptedIngredient: IngredientSummary | null;
  mergedIngredient: IngredientSummary | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  reviewedAt: IsoDateTime | null;
}

interface RecipeIngredientInput {
  ingredientId: UUID;
  amount: RecipeAmountInput;
}

interface RecipeIngredientSnapshot {
  ingredientId: UUID;
  ingredientName: string;
  source: IngredientSource;
  categoryId: UUID;
  amount: RecipeAmountSnapshot;
}

interface RecipeStepSnapshot {
  text: string;
}

interface RecipeContentSnapshot {
  name: string;
  story: string | null;
  baseServings: number;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  tips: string | null;
  ingredients: RecipeIngredientSnapshot[];
  steps: RecipeStepSnapshot[];
}

interface RecipeDraftContentInput {
  name: string;
  story: string | null;
  categoryId: ResourceId | null;
  sceneIds: ResourceId[];
  baseServings: number | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  tips: string | null;
  ingredients: RecipeIngredientInput[];
  steps: Array<{ text: string }>;
}
```

草稿允许发布必填项暂时为空。发布时必须校验名称、有效个人分类、`1～20` 人份、已选择难度、已选择时长、至少一个有效食材和至少一个非空文本步骤。食材和步骤各最多 100 项；精确数量使用最多三位小数的十进制字符串。R1 不接受图片字段，提交图片字段返回 `400`。

```ts
interface CreateRecipeDraftRequest {
  operationId: OperationId;
  recipeId: ResourceId | null;
  content: RecipeDraftContentInput;
}

interface UpdateRecipeDraftRequest {
  operationId: OperationId;
  expectedVersion: number;
  content: RecipeDraftContentInput;
}

interface PublishRecipeDraftRequest {
  operationId: OperationId;
  expectedVersion: number;
}

interface ReorderItem {
  id: ResourceId;
  expectedVersion: number;
}

interface ReorderRecipesRequest {
  operationId: OperationId;
  categoryId: ResourceId;
  items: ReorderItem[];
}

interface RecipeDraftSummary {
  id: ResourceId;
  recipeId: ResourceId | null;
  title: string | null;
  category: RecipeCategorySummary | null;
  version: number;
  updatedAt: IsoDateTime;
}

interface SaveRecipeDraftResponse {
  id: ResourceId;
  recipeId: ResourceId | null;
  version: number;
  updatedAt: IsoDateTime;
}

interface RecipeDraftDetail {
  id: ResourceId;
  recipeId: ResourceId | null;
  version: number;
  content: RecipeDraftContentInput;
  ingredientRefs: IngredientSummary[];
  unitRefs: UnitSummary[];
  category: RecipeCategorySummary | null;
  scenes: RecipeSceneSummary[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface DeleteRecipeDraftResponse {
  draftId: ResourceId;
  deletedAt: IsoDateTime;
}

interface PublishRecipeDraftResponse {
  recipe: MyRecipeDetail;
}
```

`POST /recipe-drafts` 与 `PUT /recipe-drafts/{draftId}` 返回 `SaveRecipeDraftResponse`，不再复用 `RecipeDraftDetail`。`GET /recipe-drafts/{draftId}` 继续返回完整 `RecipeDraftDetail`，供编辑页补齐历史食材和历史单位引用。

分类和场景重排提交完整作用域的 `ReorderItem[]`，分类内菜谱重排提交 `ReorderRecipesRequest`。三者都不得缺失、重复或混入越权 ID。服务端锁定最小作用域并逐项比较版本，冲突返回 `409`。

```ts
interface MyRecipeSummary {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  category: { id: UUID; name: string; version: number };
  version: number;
  updatedAt: IsoDateTime;
}

interface MyRecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  category: RecipeCategorySummary;
  scenes: RecipeSceneSummary[];
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  ingredientRefs: IngredientSummary[];
  unitRefs: UnitSummary[];
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface CollectionSceneSummary {
  id: UUID;
  name: string;
  version: number;
  recipeCount: number;
  updatedAt: IsoDateTime | null;
}

interface CollectionListResponse {
  items: CollectionSceneSummary[];
  totalCount: number;
}

interface CollectedRecipeSummary {
  id: UUID;
  sourceRecipeId: UUID;
  title: string;
  coverImageUrl: string | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  category: InspirationCategorySummary;
  scenes: RecipeSceneSummary[];
  contentVersionId: UUID;
  collectedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface CollectedRecipeDetail {
  id: UUID;
  sourceRecipeId: UUID;
  title: string;
  coverImageUrl: string | null;
  category: InspirationCategorySummary;
  scenes: RecipeSceneSummary[];
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  collectedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface SaveCollectionRecipeRequest {
  operationId: UUID;
  sourceRecipeId: UUID;
  sourceVersionId: UUID;
  sceneIds: UUID[];
}

interface SaveCollectionRecipeResponse {
  recipe: CollectedRecipeDetail;
}

interface InspirationRecipeSummary {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  category: InspirationCategorySummary;
  likeCount: number;
  collectCount: number;
  updatedAt: IsoDateTime;
}

interface InspirationRecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  category: InspirationCategorySummary;
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  likeCount: number;
  collectCount: number;
  curatedByName: string | null;
  updatedAt: IsoDateTime;
}

interface AdminUserRecipeDomainOverview {
  user: Pick<UserProfile, "id" | "uid" | "nickname">;
  publishedCount: number;
  draftCount: number;
  collectionCount: number;
  sceneCount: number;
  latestPublishedAt: IsoDateTime | null;
  latestDraftAt: IsoDateTime | null;
  latestCollectionAt: IsoDateTime | null;
}
```

R1 鉴权路径：

```text
GET/POST /recipe-categories
PUT /recipe-categories/{categoryId}
POST /recipe-categories/reorder
GET/POST /recipe-scenes
PUT /recipe-scenes/{sceneId}
POST /recipe-scenes/reorder
GET /ingredient-categories
GET/POST /ingredients
PUT /ingredients/{ingredientId}
POST /ingredients/{ingredientId}/recommendations
GET /ingredient-recommendations
GET/POST /units
GET/POST /recipe-drafts
GET/PUT /recipe-drafts/{draftId}
POST /recipe-drafts/{draftId}/delete
POST /recipe-drafts/{draftId}/publish
GET /recipes
GET /recipes/{recipeId}
GET /collections
GET /collections/recipes
GET /collections/recipes/{collectionRecipeId}
POST /collections/recipes
POST /recipes/reorder
POST /recipes/{recipeId}/delete
```

`GET /recipes` 只返回本人已发布菜谱，支持分页、关键词和个人分类筛选。查询参数为 `page`、`pageSize`、`keyword` 和 `categoryId`。新建和编辑正文统一经过草稿发布，R1 不注册直接 `POST /recipes` 和 `PUT /recipes/{recipeId}`。

`GET /collections` 返回当前用户的合集场景摘要。`items` 按场景返回 `recipeCount` 和最近更新时间；`totalCount` 返回该用户当前收藏主记录总条数，不是场景条数。`GET /collections/recipes` 返回当前用户收藏快照分页，支持 `page`、`pageSize` 和可选 `sceneId`；传 `sceneId` 时只返回该合集内容。`GET /collections/recipes/{collectionRecipeId}` 返回一个固定版本快照详情。`POST /collections/recipes` 只接收 `operationId`、`sourceRecipeId`、`sourceVersionId` 和 `sceneIds`，不接受前端传正文快照；`sceneIds` 必须是非空数组，至少选择一个合集场景。

匿名灵感读取路径冻结为：

```text
GET /inspiration-categories
GET /inspiration-recipes
GET /inspiration-recipes/{recipeId}
```

`GET /inspiration-recipes` 支持 `page`、`pageSize`、`keyword`、`categoryId`、`sort`、`difficulty` 和 `duration`。`sort` 只允许 `RECOMMENDED` 或 `LATEST`，`duration` 只允许 `WITHIN_15 / BETWEEN_15_30 / BETWEEN_30_60 / OVER_60`。匿名只返回审核通过且允许曝光的固定版本，不返回个人持有、额度、分类、场景或可写状态。R1 先接已有系统内容；用户推荐、点赞和升级为我的接口后续独立冻结。

收藏主事实冻结为“同一用户 + 同一灵感固定版本最多一条收藏记录”。`sceneIds` 表达该收藏记录挂载到哪些个人场景，必须至少挂到 1 个场景；仅补挂新场景时服务端补关系并刷新 `updatedAt`，同一场景重复收藏返回 `409`。收藏详情和后台合集内容都读取当时固定版本快照，来源菜谱后续更新不得改写已收藏内容。

后台只读查询本轮新增：

```text
GET /admin/users/{userId}/recipe-domain
GET /admin/users/{userId}/recipes
GET /admin/users/{userId}/recipe-drafts
GET /admin/users/{userId}/collections
GET /admin/users/{userId}/collections/{sceneId}/recipes
```

`GET /admin/users/{userId}/recipe-domain` 返回用户菜谱域概览；`/recipes` 与 `/recipe-drafts` 继续返回分页摘要；`/collections` 返回该用户全部合集场景摘要；`/collections/{sceneId}/recipes` 返回该场景下的收藏快照分页。后台本轮只读，不返回编辑、发布、移出合集或改场景入口。

`GET /ingredient-categories` 只返回系统食材正式分类的最小摘要 `id + name`，隐藏兜底分类 `待归类` 不下发给前台录入入口。`GET /ingredients` 支持 `page`、`pageSize`、`keyword`、`categoryId` 和 `source`。`source` 只允许 `SYSTEM`、`PERSONAL` 或 `ALL`，其中 `SYSTEM` 和 `ALL` 都只返回当前启用中且分类可选的系统食材，`PERSONAL` 只返回本人仍可直接使用的个人食材，不返回已归并条目；食材摘要新增 `imageUrl`，仅系统食材在后台已补图时返回可读图片地址，个人食材固定返回 `null`；同时新增 `recommendationStatus`，当前只返回 `PENDING | REJECTED | null`，用于“我的食材”选择态最小展示 `审核中 / 拒绝后隐藏推荐入口`。`POST /ingredients` 新建一个个人食材，并在创建时拦截与现有系统食材重名的重复项，包括已下架但仍保留治理身份的系统食材；同时禁止使用隐藏兜底分类。`PUT /ingredients/{ingredientId}` 只允许编辑本人未处于审核中的个人食材，并继续禁止切到隐藏兜底分类。`POST /ingredients/{ingredientId}/recommendations` 是显式推荐入口：若系统库已存在启用中的同名食材，则服务端直接归并并生成一条“已归并”记录；否则进入待审核队列。`GET /ingredient-recommendations` 分页返回“我的推荐”记录，用于显示 `审核中 / 已拒绝 / 已收录 / 已归并`；当状态为 `REJECTED` 时，响应额外返回 `reviewNote + reviewAdvice`，分别承载后台拒绝原因和修改建议。`GET /units` 支持 `page`、`pageSize`、`keyword`、`type` 和 `source`。`GET /recipe-drafts` 只返回本人草稿箱，查询参数为 `page`、`pageSize` 和 `keyword`。`POST /recipe-drafts` 与 `PUT /recipe-drafts/{draftId}` 只返回最小保存结果 `id + recipeId + version + updatedAt`。`GET /recipe-drafts/{draftId}` 与 `GET /recipes/{recipeId}` 额外返回当前内容实际引用到的 `ingredientRefs`、`unitRefs`，用于编辑页补齐超出首屏分页的历史食材与单位；其中 `ingredientRefs.defaultUnit` 只表示食材默认单位，不等于正文里所有真实 `unitId`，因此详情接口仍需单独返回 `unitRefs`。

创建和保存草稿时，服务端按以下逻辑计量草稿空间：

1. 新建菜谱草稿：按整份草稿正文的逻辑大小计入 `RECIPE` 模块。
2. 已发布菜谱编辑草稿：按 `max(0, 草稿正文大小 - 当前已发布正文大小)` 的差量计入 `RECIPE` 模块。
3. 发布成功后删除草稿账本，写入已发布菜谱账本。
4. 首次收藏一个灵感固定版本：按该固定版本正文大小计入 `RECIPE` 模块；后续只补场景关系时不重复计量空间。

个人分类和场景各最多 50 个，名称最多 20 字；菜谱名最多 120 字，故事最多 2000 字，小贴士最多 1000 字，食材名最多 64 字，单位名最多 16 字。分类 R1 不提供删除，后续删除前必须先迁移其下菜谱。

完整 owner、主事实、事务、索引和数据库约束见 `plans/recipe-contract-review.md`。菜谱归用户本人，饭搭子关系不改变所有权。

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
