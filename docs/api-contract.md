# API 契约基线

## 定位

本文是小程序、API 和后台共享的当前契约。现行模型是“个人数据 + 饭局协作 + 四档个人会员”。已下线的饭搭子关系接口不再作为当前对外合同。

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
9. 整资源写接口与局部增量写接口必须分离；禁止用整资源覆盖接口模拟“追加一项 / 删除一项 / 修改一项”。
10. 若一个局部动作需要调用方先读取旧资源、拼装完整快照后再提交，说明契约粒度错误，应新增或改造增量接口。

### 写接口粒度约束

1. 整资源接口用于创建整个资源、整体编辑、排序重排或批量替换结果，调用方提交完整目标状态。
2. 增量接口用于追加、删除、勾选、认领、局部修改等单动作写入，只提交当前动作所需字段。
3. 局部动作不得要求客户端提交与当前动作无关的现存子项、历史字段或完整数组。
4. 同一条写接口只表达一种写入语义，不同时承担“整体替换”和“局部追加”。
5. 允许修改或删除旧接口时，应优先收窄旧接口职责，而不是让前端承担兼容拼装逻辑。

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
type UUID = number;
type ResourceId = UUID;
type OperationId = string;
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

所有时间使用 ISO 8601；数据库使用 `TIMESTAMPTZ(3)`。所有可重试写操作通过请求头 `Idempotency-Key` 携带纯数字字符串幂等键。共享可变对象携带 `version`。

路径中的资源 ID 使用正整数，格式错误统一返回 `400`。`inviteToken`、`shareToken` 和 `Idempotency-Key` 等不透明凭证不是资源 ID，不使用资源 ID 校验。存在覆盖风险的写操作提交 `expectedVersion`；服务端锁定资源后比较当前版本，不一致返回 `409`，客户端刷新详情后再决定是否重试。

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
| `409` | version、幂等键或并发状态冲突 |
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

`MeResponse.phone` 和后台 `UserProfile.phone` 当前统一返回脱敏手机号，格式如 `138xxxxx000`。页面展示可以直接使用返回值，但不能再把响应里的手机号当作可回填的明文表单值。

`uid` 是非连续公开用户号，不是主键，不能用来推算注册量。
用户侧接口默认不返回 `User.id` 这类数据库内部主键；空间等业务对象如果前端需要定位，保留业务对象自身 id。

## 权益与空间 DTO

```ts
type EntitlementTier = "FREE" | "PLUS" | "PRO" | "ULTRA";
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

会员事实归属 `/users/me`，存储用量归属 `/storage-usage`。已下线的饭搭子接口不再参与当前客户端契约，客户端不得自行拼出全局权益快照。

## 当前已实现接口

### Auth 与 User

```text
POST /auth/login
POST /auth/code-login
POST /auth/wechat-login
POST /auth/refresh
GET  /app-config
GET  /home-entries
GET  /users/me
GET  /users/me/medals
PUT  /users/me
POST /membership-codes/redeem
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

interface WechatLoginRequest {
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

interface WechatLoginResult {
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

type HomeEntryPlacement = "MAIN" | "SIDE_TOP" | "SIDE_BOTTOM" | "QUICK_1" | "QUICK_2" | "QUICK_3" | "QUICK_4";
type HomeEntryTargetType = "PAGE" | "WEB_VIEW";
type HomeEntryStatus = "LISTED" | "UNLISTED";

interface HomeEntryItem {
  id: string;
  placement: HomeEntryPlacement;
  title: string;
  subtitle: string | null;
  targetType: HomeEntryTargetType;
  targetValue: string;
  imageUrl: string | null;
  badgeText: string | null;
}

interface HomeEntriesResponse {
  items: HomeEntryItem[];
}

interface HomeEntryPageTarget {
  label: string;
  value: string;
}

interface AdminHomeEntryItem extends HomeEntryItem {
  status: HomeEntryStatus;
  version: number;
}

interface AdminHomeEntriesResponse {
  items: AdminHomeEntryItem[];
  pageTargets: HomeEntryPageTarget[];
}

interface UpdateHomeEntryItemRequest {
  placement: HomeEntryPlacement;
  title: string;
  subtitle: string | null;
  targetType: HomeEntryTargetType;
  targetValue: string;
  imageUrl: string | null;
  badgeText: string | null;
  expectedVersion: number;
}

interface UpdateHomeEntriesRequest {
  items: UpdateHomeEntryItemRequest[];
}

interface SetHomeEntryStatusRequest {
  status: HomeEntryStatus;
  expectedVersion: number;
}

type HomeTopicType =
  | "WEEKEND_GATHERING"
  | "QUICK_AFTER_WORK"
  | "HOME_STYLE"
  | "ONE_PERSON"
  | "BREAKFAST"
  | "LIGHT_DINNER";

interface HomeTopicTypeOption {
  label: string;
  value: HomeTopicType;
}

纯展示读接口如果已经由服务端统一 owner 文案，继续返回稳定 key 供识别，同时额外返回独立中文展示字段；选择器、筛选器和写接口仍以稳定 key 或 `value + label` 结构为准，不复用同一个字段同时承载 key 和中文文案。

interface HomeTopicRecipeItem {
  id: UUID;
  sort: number;
  title: string;
  coverImageUrl: string | null;
  ownedRecipeId: UUID | null;
  recommendNote: string | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  difficultyText: string | null;
  durationText: string | null;
  category: InspirationCategorySummary;
  likeCount: number;
  collectCount: number;
  updatedAt: IsoDateTime;
}

interface HomeTopicHistoryItem {
  id: UUID;
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  recTypeText: string;
  issueNo: number;
  description: string;
  coverImageUrl: string | null;
  recipeCount: number;
  publishedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface HomeTopicDetail {
  id: UUID;
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  recTypeText: string;
  issueNo: number;
  description: string;
  coverImageUrl: string | null;
  recipeCount: number;
  publishedAt: IsoDateTime;
  updatedAt: IsoDateTime;
  items: HomeTopicRecipeItem[];
  history: HomeTopicHistoryItem[];
}

interface HomeTopicCurrentResponse {
  topic: HomeTopicDetail | null;
}

interface HomeTopicDetailResponse {
  topic: HomeTopicDetail;
}

interface AdminHomeTopicItem {
  id: UUID;
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  recTypeText: string;
  status: "LISTED" | "UNLISTED";
  issueNo: number;
  description: string;
  coverImageUrl: string | null;
  recipeCount: number;
  publishedAt: IsoDateTime;
  updatedAt: IsoDateTime;
  items: HomeTopicRecipeItem[];
  version: number;
}

interface AdminHomeTopicsResponse {
  topics: AdminHomeTopicItem[];
  recTypes: HomeTopicTypeOption[];
}

interface HomeTopicPickInput {
  recipeId: UUID;
  recommendNote: string | null;
}

interface CreateHomeTopicRequest {
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  issueNo: number;
  description: string;
  items: HomeTopicPickInput[];
}

interface UpdateHomeTopicRequest extends CreateHomeTopicRequest {
  expectedVersion: number;
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

interface RedeemMembershipCodeRequest {
  code: string;
}

interface RedeemMembershipCodeResult {
  membership: UserMembership;
  redeemedAt: IsoDateTime;
}
```

`POST /auth/wechat-login` 是当前小程序主登录入口。客户端先通过微信 `wx.login / uni.login` 获取一次性 `code`，服务端再调用微信 `code2session` 换取 `openid`，按 `openid` 识别或创建用户，并在可取到时同步记录 `unionid`。请求体只收 `code`；响应仍只返回 `token + expiresAt + user` 这组建立业务会话所需的最小摘要，不返回 `openid / unionid / session_key` 等微信身份细节。若微信配置缺失或微信侧不可达，统一返回“微信登录暂不可用”；若 `code` 无效或已失效，统一返回“微信登录失败，请重试”。

`POST /auth/code-login` 保留为手机号验证码链路。测试阶段固定验证码为 `123456`，服务端按手机号自动注册并复用同手机号唯一账号；它不新增短信表，也不复用密码登录 DTO。`POST /auth/login` 仍保留给现有脚本和旧链路，未在本轮下线。

`GET /app-config` 只返回公开启动配置。本轮只开放 `login.imageUrl`，由后台维护登录弹窗背景图；接口失败、字段为空、图片失效时，客户端回退本地图。它不得混入用户态、权限、会员、饭搭子或展示背景配置。

`GET /home-entries` 只返回小程序首页入口配置，统一使用一个按布局顺序排好的 `items` 数组。每个入口只返回当前布局真正需要的最小字段：`placement + title + subtitle + targetType + targetValue + imageUrl + badgeText`。`targetType` 当前只允许 `PAGE` 和 `WEB_VIEW` 两种；`PAGE` 的 `targetValue` 必须从后台白名单页面中选择，`WEB_VIEW` 的 `targetValue` 必须是以 `https://` 开头的外链地址。`imageUrl` 只服务入口内部视觉区或图标区，不是整张完成海报；如果后台使用上传能力，接口会返回可直接访问的公开图片 URL；如果后台手填外部图片地址，则原样返回该地址。标题、副标题、磨砂背景、主题字色、圆角和点击态都由客户端渲染，不由接口返回样式值。当前约定 `MAIN / SIDE_TOP / SIDE_BOTTOM` 固定用于首屏 3 卡并始终返回，`QUICK_1 ... QUICK_4` 固定对应首页四宫格 4 个坑位，但公开接口只返回当前 `LISTED` 的四宫格入口；客户端仍按 `placement` 自己拆出上 3 卡和下方快捷入口。

`GET /home-topics/current` 和 `GET /home-topics/{topicId}` 共同承接首页“本周灵感”专题页。公开读取只返回当前专题真正需要的最小数据：头图、标题、副标题、推荐类别、期数、寄语、本期推荐菜谱和往期专题摘要；不返回评论、打卡、主持人、收藏专题、互动人数或任何社区关系字段。只有 `LISTED` 状态的专题允许公开读取；`GET /home-topics/current` 返回最新一条已上架专题，不存在已上架专题时返回 `topic = null`；读取指定专题时若该专题不存在或未上架，统一返回 `404`。本期推荐菜谱固定只收平台灵感菜谱，摘要字段固定为 `id / sourceVersionId / sort / title / coverImageUrl / ownedRecipeId / difficulty / duration / category / likeCount / collectCount / updatedAt`，其中 `sourceVersionId` 是当前专题卡片对应的固定正文版本 ID，供首页专题页直接走“添加到我的”写链路；`ownedRecipeId` 只在请求带有效用户 token 且当前用户已持有该灵感固定版本对应的有效“我的菜谱”时返回个人菜谱 ID，匿名或尚未持有时返回 `null`；`likeCount / collectCount` 仅作为菜谱事实透传，不扩展为专题互动统计。往期专题当前按 `publishedAt desc` 排序，但只返回当前专题之后的更老已上架专题，避免查看较老专题时又回看到更新专题。

`GET /table-topics`、`GET /table-topics/{topicId}` 和 `POST /table-topics/{topicId}/participate` 共同承接首页“餐桌话题”。列表接口只返回当前列表卡真正需要的最小字段：`id / title / coverImageUrl / activityAt / participantCount`，并按 `activityAt desc, id desc` 倒序返回全部已上架话题。详情接口在列表摘要基础上补 `summary / joined / targetType / targetValue`；`joined` 只在请求带有效用户 token 且当前用户已经参与时返回 `true`，匿名或未参与时返回 `false`。详情页内的“查看活动详情”继续由 `targetType + targetValue` 承接：`PAGE` 表示站内页，`WEB_VIEW` 表示以 `https://` 开头的 H5 地址，`targetValue = null` 表示该期话题只用原生详情页承接。`POST /table-topics/{topicId}/participate` 要求登录，并按 `(topicId, userId)` 唯一事实去重；同一用户重复参与不再新增第二条记录，也不支持取消参与。未上架或不存在的话题统一返回 `404`。

`GET /users/me` 和 `PUT /users/me` 返回 `MeResponse`。当前用户背景图能力未开放，`display` 中两个 URL 固定为 `null`，两个 `canUse` 字段固定为 `false`。`PUT /users/me/display` 保留路径，但当前统一返回 `503`，不得通过 URL 绕过上传能力。`GET /users/me/medals` 返回当前用户勋章墙摘要，包含 `earnedCount / totalCount / categories / items`。`items` 当前按模板返回 `code / awardRule / iconKey / imageUrl / earnedImageUrl / lockedImageUrl / category / categoryName / name / description / condition / earnedUserCount / earned / isLimited / startAt / endAt / awardedAt`，不返回进度条、差几次或会员专属字段。客户端应优先按 `earned` 状态选择 `earnedImageUrl / lockedImageUrl`，`imageUrl` 仅作为已获得图兼容字段。

`POST /membership-codes/redeem` 只接受登录用户调用，必须携带 `Idempotency-Key`。请求体只收 `code`；服务端会在事务内完成单码锁定、SKU/批次开放校验、体验累计天数校验、正式码 30 天冷却校验、当前会员冲突校验、有效会员到账、单码置已用和审计。DTO/鉴权/限流仍按 HTTP `400 / 401 / 429` 返回；可预期的兑换业务拒绝改为 HTTP `200` + 业务 `code/message`，其中正式码 30 天冷却返回 `code = 4601, message = "30天内仅可兑换一次"`，无效/停用/未上架/会员状态冲突/超过体验上限等其余内部原因统一收口为 `code = 4602, message = "兑换码无效或不可用"`。成功返回更新后的 `membership` 摘要和 `redeemedAt`。

### 关系功能下线说明

`/dining-groups*`、`/dining-group-members` 和 `/dining-group-invites*` 已从当前 API 装配中移除，不再作为现行前台或后台合同。后续协作主链路统一挂在饭局、购物清单分享和个人会员/空间事实上，不再新增饭搭子对外接口。

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
GET  /admin/dashboard/trends
GET  /admin/users
POST /admin/users
PUT  /admin/users/{userId}
POST /admin/users/{userId}/status
POST /admin/users/{userId}/reset-password
GET  /admin/user-entitlements?userId={userId}
GET  /admin/app-config
GET  /admin/home-entries
POST /admin/app-config/login-image
DELETE /admin/app-config/login-image
PUT  /admin/home-entries
POST /admin/home-entries/{placement}/status
POST /admin/home-entries/{placement}/image
DELETE /admin/home-entries/{placement}/image
GET  /admin/medal-templates
POST /admin/medal-templates
PUT  /admin/medal-templates/{templateId}
POST /admin/medal-templates/{templateId}/status
GET  /admin/ingredient-categories
POST /admin/ingredient-categories
PUT  /admin/ingredient-categories/{categoryId}
POST /admin/ingredient-categories/reorder
GET  /admin/units
POST /admin/units
PUT  /admin/units/{unitId}
DELETE /admin/units/{unitId}
POST /admin/units/reorder
GET  /admin/pending-units
POST /admin/pending-units/{recommendationId}/review
GET  /admin/ingredients
POST /admin/ingredients
PUT  /admin/ingredients/{ingredientId}
POST /admin/ingredients/{ingredientId}/status
POST /admin/ingredients/{ingredientId}/image
DELETE /admin/ingredients/{ingredientId}/image
POST /admin/ingredients/reorder
GET  /admin/pending-ingredients
POST /admin/pending-ingredients/{ingredientId}/review
GET  /admin/membership-codes/skus
POST /admin/membership-codes/skus/{skuId}/status
GET  /admin/membership-codes/batches
POST /admin/membership-codes/batches
POST /admin/membership-codes/batches/{batchId}/status
POST /admin/membership-codes/batches/{batchId}/generate
GET  /admin/membership-codes
GET  /admin/membership-codes/generations
GET  /admin/membership-codes/redemptions
POST /admin/membership-codes/{codeId}/disable
GET  /admin/content/channels
POST /admin/content/channels
PUT  /admin/content/channels/{channelId}
GET  /admin/content/pages
GET  /admin/content/articles
GET  /admin/content/{contentId}
POST /admin/content
PUT  /admin/content/{contentId}
POST /admin/content/{contentId}/status
POST /admin/content/images
GET  /site-contents/resolve?path={path}
GET  /public-assets/site-content-images/{fileName}
```

`GET /admin/dashboard/summary` 是后台首页只读摘要接口，只返回首页当前需要的计数，不混入分页列表、明细、趋势和策略对象。当前响应新增 `overview`，固定返回 `todayNewUsers / sevenDayNewUsers / totalUsers / openReportCount / pendingRecipeCount / pendingIngredientCount / todayRedeemedCount` 这组首页核心卡片数据；同时继续保留四组结构化统计：用户 `total / activeCount / disabledCount`，饭搭子 `total / activeCount / memberCount`，菜谱 `total / activeCount / blockedCount / recycledCount / openReportCount`，以及基础资料 `categoryCount / itemCount / unitCount`。其中 `memberCount` 继续沿用后台饭搭子列表的有效成员口径，只统计 `ACTIVE / RESTRICTED`。

`GET /admin/dashboard/trends` 是后台首页趋势图接口，只允许 `SUPER_ADMIN` 调用，查询参数固定为 `range=7D | 30D`，默认 `7D`。响应返回按日补齐的趋势点数组，每个点固定包含 `date / label / newUsers / totalUsers / openReportCount / pendingRecipeCount / pendingIngredientCount / membershipGeneratedCount / membershipRedeemedCount`，用于后台首页直接绘制轻量趋势图，不返回分页和明细列表。

```ts
interface CreateAdminUserRequest {
  phone: string;
  password: string;
  nickname?: string;
  status?: "ACTIVE" | "DISABLED";
}

interface UpdateAdminUserRequest {
  phone?: string;
  nickname?: string;
}

interface SetAdminUserStatusRequest {
  status: "ACTIVE" | "DISABLED";
}

interface ResetAdminUserPasswordRequest {
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
  storage: StorageUsageSummary;
  recipePolicy: { recipeLimit: number; recycleDays: number; variantLimitPerRoot: number };
  invitePolicy: { inviteLimit: number; memberLimit: number };
  imagePolicy: EffectiveImagePolicy;
}
```

```ts
type MembershipCodeKind = "FORMAL" | "TRIAL";
type MembershipCodeStatus = "ACTIVE" | "REDEEMED" | "DISABLED";
type MembershipCodeBatchWindowState = "NO_LIMIT" | "PENDING" | "ACTIVE" | "EXPIRED";

interface AdminMembershipSkuItem {
  id: UUID;
  code: "PLUS_30D" | "PRO_30D" | "PRO_TRIAL_1D" | "PRO_TRIAL_3D" | "PRO_TRIAL_7D";
  kind: MembershipCodeKind;
  tier: EntitlementTier;
  durationDays: number;
  redeemEnabled: boolean;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface AdminMembershipSkuListResponse {
  items: AdminMembershipSkuItem[];
  syncedAt: IsoDateTime;
}

interface SetAdminMembershipSkuStatusRequest {
  redeemEnabled: boolean;
  expectedVersion: number;
}

interface CreateAdminMembershipCodeBatchRequest {
  skuCode: AdminMembershipSkuItem["code"];
  name: string;
  redeemEnabled: boolean;
  startsAt?: IsoDateTime | null;
  endsAt?: IsoDateTime | null;
}

interface SetAdminMembershipCodeBatchStatusRequest {
  redeemEnabled: boolean;
  expectedVersion: number;
}

interface AdminMembershipCodeBatchItem {
  id: UUID;
  sku: AdminMembershipSkuItem;
  name: string;
  redeemEnabled: boolean;
  startsAt: IsoDateTime | null;
  endsAt: IsoDateTime | null;
  windowState: MembershipCodeBatchWindowState;
  version: number;
  codeCount: number;
  activeCodeCount: number;
  redeemedCodeCount: number;
  disabledCodeCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface GenerateAdminMembershipCodesRequest {
  quantity: number;
}

interface GeneratedMembershipCodeRow {
  code: string;
  codeMask: string;
}

interface AdminMembershipCodeItem {
  id: UUID;
  batchId: UUID;
  batchName: string;
  skuCode: AdminMembershipSkuItem["code"];
  kind: MembershipCodeKind;
  tier: EntitlementTier;
  durationDays: number;
  codeMask: string;
  status: MembershipCodeStatus;
  redeemedBy: { id: UUID; uid: number; nickname: string | null } | null;
  redeemedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface AdminMembershipCodeGenerationItem {
  id: UUID;
  batchId: UUID;
  batchName: string;
  skuCode: AdminMembershipSkuItem["code"];
  generatedCount: number;
  generatedBy: { id: UUID; username: string; displayName: string } | null;
  exportedAt: IsoDateTime;
  createdAt: IsoDateTime;
}

interface AdminGenerateMembershipCodesResult {
  batch: AdminMembershipCodeBatchItem;
  generatedCount: number;
  exportedAt: IsoDateTime;
  codes: GeneratedMembershipCodeRow[];
}
```

后台内容治理本轮新增：

```text
GET  /admin/content/channels
POST /admin/content/channels
PUT  /admin/content/channels/{channelId}
GET  /admin/content/pages
GET  /admin/content/articles
GET  /admin/content/{contentId}
POST /admin/content
PUT  /admin/content/{contentId}
POST /admin/content/{contentId}/status
POST /admin/content/images
GET  /site-contents/resolve?path={path}
GET  /public-assets/site-content-images/{fileName}
```

这一组接口共同承接后台“内容治理”。栏目治理只服务站点内容栏目，不扩成通用分类中心。`GET /admin/content/channels` 固定返回分页 `PageResult<AdminSiteContentChannelSummary>`，支持按 `code` 模糊过滤；`POST /admin/content/channels` 与 `PUT /admin/content/channels/{channelId}` 都要求 `Idempotency-Key`，只维护 `code / name / description / sortOrder`，并通过 `expectedVersion` 防并发覆盖。

`GET /admin/content/pages` 固定返回 5 个受控固定页：`about / privacy / terms / product / faq`。这些固定页在服务端自动落种，后台只能编辑正文与展示信息，路径固定分别为 `/about / /privacy / /terms / /product / /faq`，不得新增第 6 个固定页，也不得改成其他路径。

`GET /admin/content/articles` 返回文章分页，查询参数固定为 `page / pageSize`，并支持 `channelId / status / keyword` 过滤；`status` 只允许 `DRAFT / PUBLISHED / UNLISTED`。`GET /admin/content/{contentId}` 返回后台详情。`POST /admin/content` 与 `PUT /admin/content/{contentId}` 都要求 `Idempotency-Key`，当前只治理两类内容：`PAGE` 与 `ARTICLE`。`PAGE` 必须命中受控固定页 slug；`ARTICLE` 必须选择栏目，路径由服务端固定生成 `/guides/{slug}`，后台提交的自定义 `path` 不生效。正文固定使用 `bodyHtml + bodyText` 双写；服务端会做基础 HTML 清洗，并在 `bodyText` 为空时从 HTML 提取纯文本兜底。

`POST /admin/content/{contentId}/status` 只切换 `DRAFT / PUBLISHED / UNLISTED` 三种状态，且要求 `expectedVersion`。内容摘要和详情固定返回 `type / status / channel / slug / path / title / summary / label / heroNote / coverImageUrl / publishedAt / effectiveAt / sortOrder / version / updatedBy / createdAt / updatedAt`；详情额外返回 `bodyHtml / bodyText`。

`POST /admin/content/images` 是后台富文本图片上传入口，只允许 `SUPER_ADMIN` 调用，请求头必须带 `Idempotency-Key`，单图大小上限 `8 MB`，只接受 `JPG / PNG / WEBP`。服务端把文件落到站内资源目录，并返回 `imageUrl`；公开读取统一走 `GET /public-assets/site-content-images/{fileName}`，当前只做静态资源读取，不建独立数据库表。

`GET /site-contents/resolve` 是站点和官网的公开内容读取接口，只按 `path` 返回已发布内容。当前只返回 `PUBLISHED` 内容，固定响应 `id / type / slug / path / title / summary / label / heroNote / coverImageUrl / bodyHtml / bodyText / publishedAt / effectiveAt / updatedAt / channelCode / channelName`，不返回草稿和下架内容。

`POST /admin/users`、`PUT /admin/users/{userId}`、`POST /admin/users/{userId}/status` 和 `POST /admin/users/{userId}/reset-password` 使用 `AdminBearerAuth`，且仅 `SUPER_ADMIN` 可访问。当前范围只支持新增用户、修改昵称/手机号、启用/禁用和重置密码；不支持物理删除用户，也不通过后台直接改用户归属数据。

用户 token 绑定服务端 `sessionVersion`。后台启用、禁用或重置密码时递增该版本；此前签发的 token 从下一次鉴权请求起统一返回 `401`，重新启用用户不会恢复旧 token。

用户权益查询使用 `AdminBearerAuth`，仅 `SUPER_ADMIN` 可访问。它是后台审计视图，按领域分段返回，不作为小程序的聚合契约。背景图能力当前统一返回 `false`。

`GET /admin/app-config`、`POST /admin/app-config/login-image` 和 `DELETE /admin/app-config/login-image` 共同维护登录弹窗图片。它们只服务这一条已确认配置，不扩成通用配置中心或通用素材库。上传成功和清空成功都返回最新 `AppConfigResponse`。

`GET /admin/membership-codes/skus`、`POST /admin/membership-codes/skus/{skuId}/status`、`GET /admin/membership-codes/batches`、`POST /admin/membership-codes/batches`、`POST /admin/membership-codes/batches/{batchId}/status`、`POST /admin/membership-codes/batches/{batchId}/generate`、`GET /admin/membership-codes`、`GET /admin/membership-codes/generations`、`GET /admin/membership-codes/redemptions` 和 `POST /admin/membership-codes/{codeId}/disable` 共同组成后台会员兑换码治理面。固定 SKU 目录由服务端自动同步，当前只允许 `PLUS_30D / PRO_30D / PRO_TRIAL_1D / PRO_TRIAL_3D / PRO_TRIAL_7D` 五项；后台不得新增第六种 SKU，也不得基于其他数据库遗留 SKU 发码。SKU 摘要新增 `version`，只用于后台切换该 SKU 的核销开关；切换请求体固定提交 `redeemEnabled + expectedVersion`，服务端成功后才会递增 `version`。SKU 目录同步只负责校正 `code / kind / tier / durationDays` 这类固定事实，不会覆盖后台已设置的 `redeemEnabled`。批次读取固定返回分页 `PageResult<AdminMembershipCodeBatchItem>`，并附带 `windowState + version + codeCount / activeCodeCount / redeemedCodeCount / disabledCodeCount`，用于后台判断上架状态、时间窗和发码规模。创建批次时只收 `skuCode / name / redeemEnabled / startsAt / endsAt` 最小字段，`startsAt < endsAt` 由服务端校验；切换上下架时必须带 `expectedVersion`，避免多人后台覆盖。`POST /admin/membership-codes/batches/{batchId}/generate` 只收 `quantity`，单次上限 `1000`；服务端高熵生成明文码，但数据库、审计和后台列表只保留 `codeHash + codeMask`，明文码只在该次响应的 `codes[]` 中返回一次供导出。`GET /admin/membership-codes` 只返回掩码、批次、SKU、状态、使用人和使用时间；若后台输入完整兑换码查询，服务端只做哈希精确匹配，不回显明文。`GET /admin/membership-codes/generations` 按 `audit_events` 中的 `membership-code.generate` 事实分页返回生成记录，首版支持按 `batchId / skuCode` 过滤，响应只包含 `批次 / SKU / 生成数量 / 操作人 / 时间`，不回放明文码。`GET /admin/membership-codes/redemptions` 只返回已核销兑换码分页，首版支持按 `batchId / skuCode / uid / redeemedFrom / redeemedTo / code` 过滤，用于后台独立查看兑换使用事实。`POST /admin/membership-codes/{codeId}/disable` 仅允许停用未使用兑换码，已使用码不得再改状态。

`GET /admin/home-entries`、`PUT /admin/home-entries`、`POST /admin/home-entries/{placement}/status`、`POST /admin/home-entries/{placement}/image` 和 `DELETE /admin/home-entries/{placement}/image` 共同维护小程序首页 7 个快捷入口。后台固定一次返回全部 7 个坑位，不支持新增、删除或拖出第 8 个入口。后台读取接口统一返回 `items + pageTargets`：`items` 是按布局顺序排好的 7 个入口数组，后台页面自己按 `placement` 拆成首页 3 卡和 action-dock 4 格；`pageTargets` 供“站内页面”下拉选择。`PUT /admin/home-entries` 写入时支持按提交的 `items` 做部分保存，请求至少提交 `1` 个、最多提交 `7` 个入口，每个入口都带 `expectedVersion`，且同一次请求内 `placement` 不得重复；`PAGE` 只能使用白名单页面，`WEB_VIEW` 必须以 `https://` 开头。`POST /admin/home-entries/{placement}/status` 当前只允许 `QUICK_1 ... QUICK_4`，请求体固定提交 `status + expectedVersion`；`LISTED` 表示该四宫格入口会出现在首页，`UNLISTED` 表示该坑位仍保留配置但不在首页展示，主卡 `MAIN / SIDE_TOP / SIDE_BOTTOM` 不支持下架。图片既支持直接手填 `https` 地址，也支持对单个 `placement` 单独上传/清空：上传和清空都要求 `expectedVersion`，成功后返回该坑位最新入口数据，并立即更新 `imageUrl + version`。上传后的数据库值固定保存为站内相对资源路径，由公开接口再转换成可访问 URL。这个后台面只服务 `运营 / 小程序首页`，不扩成通用首页装修或通用跳转配置中心。

`GET /admin/home-topics`、`GET /admin/home-topics/recipes`、`POST /admin/home-topics`、`PUT /admin/home-topics/{topicId}`、`POST /admin/home-topics/{topicId}/status`、`POST /admin/home-topics/{topicId}/image` 和 `DELETE /admin/home-topics/{topicId}/image` 共同维护“运营 / 本周灵感”。后台读取接口返回 `topics + recTypes`：`topics` 返回全部专题，并额外携带 `status` 供后台做列表、预览和上架状态切换；`LISTED` 表示前台可见，`UNLISTED` 表示仅后台可见；`recTypes` 返回当前允许的推荐类别枚举与中文文案。`GET /admin/home-topics/recipes` 只搜索可曝光的灵感菜谱，当前最多返回 `20` 条，供后台把菜谱加入本期推荐。`POST /admin/home-topics` 和 `PUT /admin/home-topics/{topicId}` 只写入基础信息和推荐菜谱顺序，请求体固定提交 `title / subTitle / recType / issueNo / description / items`；`items` 当前至少 `3` 条，每条固定提交 `recipeId + recommendNote`，其中 `recommendNote` 可空，表示这道菜在本期专题推荐里的可选推荐说明；同一次提交内不得重复提交同一 `recipeId`，不再限制最多条数。前台专题详情和后台专题详情都返回每道菜的 `recommendNote`，有值才显示。新建专题默认写成 `UNLISTED`，由后台确认后再通过 `POST /admin/home-topics/{topicId}/status` 显式上架；切状态请求体固定提交 `status + expectedVersion`。封面图不混进专题写 DTO，统一走单独上传/清空接口，并通过 `expectedVersion` 防并发覆盖。专题当前没有草稿态、定时发布、专题收藏或专题推荐统计；历史专题长期保留，但下架后不会继续出现在前台当前专题和往期滑卡里。

`GET /admin/table-topics`、`POST /admin/table-topics`、`PUT /admin/table-topics/{topicId}`、`POST /admin/table-topics/{topicId}/status`、`POST /admin/table-topics/{topicId}/image` 和 `DELETE /admin/table-topics/{topicId}/image` 共同维护“运营 / 餐桌话题”。后台读取接口只返回 `topics` 数组；每项固定包含 `id / title / summary / coverImageUrl / activityAt / participantCount / targetType / targetValue / status / version / updatedAt`。`participantCount` 是服务端根据 `table_topic_participants` 真实计数返回，后台不可手改。`POST /admin/table-topics` 与 `PUT /admin/table-topics/{topicId}` 当前只写基础信息和详情承接目标，请求体固定提交 `title / summary / activityAt / targetType / targetValue`；`title` 最多 `30` 字，`summary` 最多 `240` 字。`targetType = PAGE` 时，`targetValue` 为空表示只使用小程序原生详情页，非空时必须以 `/` 开头；`targetType = WEB_VIEW` 时，`targetValue` 必须是以 `https://` 开头的 H5 地址。新建话题默认写成 `UNLISTED`，由后台确认后再通过 `POST /admin/table-topics/{topicId}/status` 显式上架。封面图继续走单独上传 / 清空接口，并通过 `expectedVersion` 防并发覆盖。后台当前不提供取消参与、手工补人数或历史回滚能力。

后台勋章治理当前新增：

```text
GET  /admin/medal-templates
POST /admin/medal-templates
PUT  /admin/medal-templates/{templateId}
POST /admin/medal-templates/{templateId}/status
POST /admin/medal-templates/{templateId}/image/{imageType}
DELETE /admin/medal-templates/{templateId}/image/{imageType}
```

这一组接口治理 `勋章模板`，不治理用户已获得勋章事实。模板摘要固定返回 `id / code / awardRule / category / categoryName / name / description / condition / iconKey / imageUrl / earnedImageUrl / lockedImageUrl / status / targetCount / sortOrder / isLimited / startAt / endAt / version / createdAt / updatedAt`。`awardRule` 当前允许 `MEAL_COMPLETION / DINING_EVENT_COMPLETION / GROUP_MEAL_COMPLETION / FULL_LOOP_COMPLETION / RECOMMENDATION_ADOPTED_TOTAL`；`category` 当前允许 `MEAL_CHECKIN / DINING_COLLABORATION / RECOMMENDATION_CONTRIBUTION / HOLIDAY_LIMITED`；`status` 当前允许 `DRAFT / LISTED / UNLISTED / ARCHIVED`。`targetCount` 用于累计型勋章阈值，最小为 `1`。`GET /admin/medal-templates` 固定使用 `page / pageSize` 分页，并支持 `keyword / status / category` 过滤。`POST /admin/medal-templates` 允许后台创建模板并指定初始状态，`code` 改为服务端自动生成；`PUT /admin/medal-templates/{templateId}` 只编辑展示与时间配置，不改 `code` 和 `awardRule`；`POST /admin/medal-templates/{templateId}/status` 只切换模板状态；`POST /admin/medal-templates/{templateId}/image/{imageType}` 和 `DELETE /admin/medal-templates/{templateId}/image/{imageType}` 负责单独治理勋章图片，其中 `imageType` 仅允许 `earned / locked`。后台上传当前允许 `JPG / PNG / WEBP / SVG`；其中 `SVG` 只允许纯静态矢量内容，服务端会拒绝带脚本、事件处理器或外部资源引用的文件。后台不得通过任何接口直接给用户补发、撤销或修改勋章获得时间。

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
GET  /admin/ingredient-feedbacks
POST /admin/ingredient-feedbacks/{feedbackId}/review
```

这一组接口治理 `系统食材分类 + 系统食材 + 系统单位 + 个人食材推荐审核 + 单位建议审核 + 系统食材纠错审核`。系统单位是后台运营面维护的公共基础数据，多个后台录入入口统一复用这一组接口并按 `type` 分组展示；个人食材只通过待审列表进入后台，不在系统食材列表里直接混排编辑。

`GET /admin/ingredient-categories` 返回全部系统食材分类摘要，按后台排序返回。分类摘要新增 `code`、`isSelectable`、`version`、`ingredientCount` 和 `updatedAt`，用于后台编辑、兜底分类识别和排序并发控制；当前 `ingredientCount` 统计后台仍可治理的系统食材总数，即 `ACTIVE + DISABLED`，不包含已归并条目。系统正式分类在上线前固定，后台不再开放常规新增，只保留名称微调和排序；隐藏兜底分类 `待归类` 会通过 `isSelectable = false` 返回。`POST /admin/ingredient-categories/reorder` 提交完整分类集合的 `id + expectedVersion` 顺序，成功后统一重写排序并递增对应 `version`。

`GET /admin/units` 返回全部系统单位摘要，按 `type -> systemSortOrder -> name` 排序；系统单位摘要新增 `version` 和 `updatedAt`，用于后台编辑、删除和拖拽排序的并发控制。`POST /admin/units` 新建一个系统单位；`PUT /admin/units/{unitId}` 修改单位名称或类型；`DELETE /admin/units/{unitId}` 只在该单位未被任何食材引用时允许删除，否则返回冲突错误；`POST /admin/units/reorder` 只重排某一个 `type` 分组下的完整系统单位集合，成功后统一重写该分组顺序。`GET /admin/pending-units` 返回待审核单位建议分页，支持按单位名、提交人昵称或 UID 搜索；摘要固定返回 `name / type / version / createdAt / user`。`POST /admin/pending-units/{recommendationId}/review` 只支持 `APPROVE / REJECT` 两种结果；通过时可调整 `name + type`，若系统库已存在同名系统单位，则直接归并并把建议记为 `MERGED`，否则新建系统单位并记为 `ADOPTED`；拒绝时回写简短 `reason`，前台“推荐审核”直接展示。

`GET /admin/ingredients` 只返回系统食材分页，查询参数固定为 `page`、`pageSize`，并支持 `categoryId`、`keyword`、`status` 和 `factStatus` 过滤；`status` 允许 `ACTIVE / DISABLED / ALL`，默认 `ACTIVE`，`factStatus` 允许 `ALL / MISSING`，默认 `ALL`。当传 `categoryId` 时，列表按该分类内系统顺序返回；不传 `categoryId` 时，列表进入后台虚拟“全部食材”视图，按系统食材全局展示顺序返回，用于统一查看、编辑和拖拽控制前台“全部食材”口径。`factStatus = MISSING` 用于后台快速查看仍建议补录结构化属性的系统食材，当前按既有自动识别规则检查 `主蛋白 / 主食 / 辣味食材` 三类缺口。系统食材摘要新增 `version`、`status`、`categoryName`、`imageUrl` 和 `updatedAt`，用于后台编辑、图片治理和排序。系统食材同时维护两套顺序：`分类内顺序` 只服务真实分类管理，`全局展示顺序` 只服务后台“全部食材”视图和前台“全部食材”展示。`POST /admin/ingredients/{ingredientId}/status` 用于把系统食材切到 `ACTIVE / DISABLED`，下架不做物理删除；重新上架时服务端会把该食材同时放到当前分类排序末尾和全局展示顺序末尾，避免与现有启用中食材顺序冲突。`POST /admin/ingredients/{ingredientId}/image` 只接受后台裁好的 `50x50 PNG`，成功后覆盖当前系统食材图片并递增 `version`；`DELETE /admin/ingredients/{ingredientId}/image` 清空当前系统食材图片并递增 `version`。公开图片读取仍走 `GET /public-assets/ingredients/{ingredientId}`，但只有数据库中仍为启用中的系统食材且 `imageUpdatedAt` 非空时才返回资源，已下架食材即使静态文件还在也不得继续外露。`POST /admin/ingredients/reorder` 支持两种模式：传 `categoryId` 时，只接收该分类下启用中系统食材的完整集合顺序并重写分类内顺序；不传 `categoryId` 时，只接收全部启用中系统食材的完整集合顺序并重写全局展示顺序。服务端统一校验集合完整性和 `expectedVersion`。`GET /admin/pending-ingredients` 只返回待审核的个人食材推荐分页，同样固定使用 `page`、`pageSize`；`POST /admin/pending-ingredients/{ingredientId}/review` 允许后台按 `通过为系统食材 / 通过并归并到现有系统食材 / 拒绝` 三种结果处理，并可在通过前调整 `名称 + 分类 + 默认单位`。拒绝时必须选择预设 `rejectReasonCode`：`NAME_NOT_CLEAR / NAME_HAS_BRAND / CATEGORY_NOT_FIT / UNIT_NOT_FIT / OUT_OF_SCOPE / OTHER`；只有 `OTHER` 仍要求补充详细 `reason`。服务端会把对应建议写入推荐记录，供前台“我的推荐”直接展示。若审核通过时命中同名但已下架的系统食材，服务端直接复用该系统食材并恢复为启用中，不再额外创建重复系统食材。`GET /admin/ingredient-feedbacks` 只返回待审核的系统食材纠错分页，支持按当前食材名、建议食材名、分类、备注、提交人昵称或 UID 搜索；列表摘要固定返回 `当前名字/分类 + 建议名字/分类 + 备注 + 提交人 + ingredientVersion`。`POST /admin/ingredient-feedbacks/{feedbackId}/review` 只支持 `APPROVE / REJECT` 两种结果；采纳时后台可在用户建议基础上再次调整最终 `name + categoryId`，服务端直接更新对应系统食材并递增其 `version`，再把该纠错记录标记为 `ADOPTED`；驳回时只回写 `reviewNote` 并标记为 `REJECTED`。

后台菜谱治理当前补充为：

```text
GET /admin/inspiration-categories
POST /admin/inspiration-categories
PUT /admin/inspiration-categories/{categoryId}
POST /admin/inspiration-categories/reorder
GET /admin/recipes
POST /admin/recipes
GET /admin/recipes/{recipeId}
PUT /admin/recipes/{recipeId}
POST /admin/recipe-images
GET /admin/recipe-reports
POST /admin/recipes/{recipeId}/block
POST /admin/recipes/{recipeId}/unblock
POST /admin/recipe-reports/{reportId}/resolve
```

`GET /admin/inspiration-categories` 返回后台系统菜谱分类列表，摘要包含 `id / name / iconKey / version / recipeCount / updatedAt`；`POST /admin/inspiration-categories`、`PUT /admin/inspiration-categories/{categoryId}` 和 `POST /admin/inspiration-categories/reorder` 分别用于新增、编辑和重排系统菜谱分类，请求头统一使用 `Idempotency-Key`，重排请求提交完整的 `id + expectedVersion` 集合。`GET /admin/recipes` 只返回后台系统菜谱列表最小摘要，查询参数固定为 `page`、`pageSize`，并支持 `categoryId`、`keyword`、`status` 过滤；系统菜谱口径固定为 `ownerId = null` 且 `inspirationCategoryId != null`，列表摘要补充 `inspirationCategoryId / inspirationCategoryName`，排序统一按 `updatedAt desc`。`POST /admin/recipe-images` 是后台系统菜谱独立的临时图片上传入口，只允许 `SUPER_ADMIN` 使用，只接受后台裁好的单张图片，并返回 `tempKey + 图片元信息`；封面图场景固定要求 `4:3`，步骤图不锁定固定比例。后台上传成功后不再暴露临时公网图片地址，页面预览使用浏览器本地 `blob`；服务端只在 `POST /admin/recipes` / `PUT /admin/recipes/{recipeId}` 真正消费 `*TempKey` 时把临时图固化成正式公开资源，并对 24 小时前未消费的后台临时图做过期清理。`POST /admin/recipes` 允许后台直接新建一条系统菜谱，请求头必须携带 `Idempotency-Key`，请求体除 `inspirationCategoryId` 和完整正文输入外，还可携带 `coverImageUrl / coverImageTempKey / steps[].imageUrl / steps[].imageTempKey`；服务端会把本次引用的临时图固化为正式公开资源，写入当前系统菜谱封面和新版本正文，再创建 `ownerId = null` 的系统菜谱记录。`GET /admin/recipes/{recipeId}` 返回后台详情视图，覆盖系统菜谱和个人菜谱，但只读字段与正文内容分开：详情固定返回 `personalCategory / inspirationCategory`、`contentVersionId`、当前正文快照、`reportCount`、`blockedReason`、`likeCount`、`collectCount`、`canEdit`，以及单菜助理状态 `assistantState(status / hasSnapshot / generatedAt / lastAttemptAt / attemptCount / lastError)`。`PUT /admin/recipes/{recipeId}` 只允许 `SUPER_ADMIN` 编辑当前系统菜谱正文，且仅限 `ownerId = null`、当前仍挂系统分类的菜谱；保存时服务端不得原地覆盖旧正文版本，而是新建一条 `RecipeContentVersion`，再把菜谱 `currentVersionId`、`title`、`searchText`、`inspirationCategoryId` 和当前封面图切到新版本，保证已收藏、已引用和历史固定版本不漂移。若本次仍沿用旧图，则请求中的 `coverImageUrl` 与 `steps[].imageUrl` 只能引用当前系统菜谱现有图片；若替换图片，则必须提交新的 `*TempKey`。`POST /admin/recipes/{recipeId}/assistant/regenerate` 用于后台手动重试当前系统菜谱版本的单菜助理生成，请求头必须携带 `Idempotency-Key`，响应仍返回完整后台详情。`GET /admin/pending-recipes` 返回待审核个人菜谱推荐分页，只收 `status = PENDING` 且来源个人菜谱仍为有效发布态的推荐记录，支持按菜谱名、建议系统分类、个人分类、推荐人昵称或 UID 搜索。`POST /admin/pending-recipes/{recommendationId}/review` 只支持两种结果：`APPROVE` 或 `REJECT`；通过时必须选择最终归入的系统菜谱分类，可与用户建议分类不同，且本期不在审核弹窗内编辑正文。审核通过后，服务端按推荐记录中的 `sourceVersionId` 复制固定版本正文，创建新的系统菜谱并写回 `adoptedRecipeId`；拒绝时只回写 `reviewNote`。后台系统菜谱创建、审核收录与正文编辑时，食材和单位只允许引用当前可选的系统食材与系统单位；图片链路独立于用户草稿上传，不复用 `draftId`。每次创建新的系统固定版本时，服务端还要同步生成一份单菜助理快照并挂到该 `RecipeContentVersion`；当前覆盖后台新建、后台编辑、后台导入发布，以及个人推荐审核通过收录为系统菜谱这四条写路径。若生成失败，主菜谱版本写入不回滚，而是把失败状态、最近错误和尝试次数落到同一份助理记录里，供后台详情页查看并手动重试。该快照只作为固定版本附属数据保留，不回写正文主数据。

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

### 勋章、计划、饭局与购物

```text
GET  /users/me/medals
GET  /meal-plans
GET  /meal-plans/{planItemId}/cook-assistant
POST /meal-plans
POST /meal-plans/{planItemId}/complete
POST /meal-plans/{planItemId}/confirm-menu
POST /meal-plans/{planItemId}/cook-assistant
POST /dining-events
POST /dining-events/{eventId}/memory-shares
GET  /memory-shares/{shareToken}/preview
POST /meal-plans/{planItemId}/dining-event
GET  /dining-events/{eventId}
POST /dining-events/{eventId}/share-link
POST /dining-events/{eventId}/share-link/disable
POST /dining-events/{eventId}/share-members
POST /dining-events/{eventId}/participants/{participantId}/revoke
POST /dining-events/{eventId}/participants/{participantId}/reinvite
POST /dining-events/{eventId}/cover
POST /dining-events/{eventId}/cook
POST /dining-events/{eventId}/respond
POST /dining-events/{eventId}/bring
POST /dining-events/{eventId}/complete
GET  /fridge-items
POST /fridge-items
PUT  /fridge-items/{itemId}
POST /fridge-items/consume
GET  /shopping-items
POST /shopping-items
GET  /shopping-items/board
POST /shopping-items/from-recipe
POST /shopping-items/{itemId}/status
POST /shopping-items/group-status
GET  /shopping-lists/summary
GET  /shopping-lists
POST /shopping-lists
GET  /shopping-lists/{listId}
POST /shopping-lists/{listId}/rename
POST /shopping-lists/{listId}/items
POST /shopping-lists/{listId}/items/from-recipe
POST /shopping-lists/{listId}/items/from-plan
POST /shopping-lists/{listId}/items/from-gap
POST /shopping-lists/{listId}/items/{itemId}/check
POST /shopping-lists/{listId}/items/{itemId}/fridge
POST /shopping-lists/{listId}/items/{itemId}/remove
POST /shopping-lists/{listId}/void
POST /shopping-lists/{listId}/restore
POST /shopping-lists/{listId}/copy
POST /shopping-lists/{listId}/delete
POST /shopping-lists/{listId}/complete
POST /shopping-lists/{listId}/share-link
POST /shopping-lists/{listId}/share-link/disable
POST /shopping-lists/{listId}/share-members
POST /shopping-lists/{listId}/members/{memberUserId}/remove
GET  /shopping-list-invites
POST /shopping-list-invites/{inviteId}/accept
POST /shopping-list-invites/{inviteId}/decline
POST /shopping-lists/{listId}/leave
GET  /shopping-shares/{shareToken}
POST /shopping-shares/{shareToken}/join
GET  /shopping-gap
POST /dining-events/{eventId}/shopping-gap
```

```ts
type MealPlanStatus = "PLANNED" | "COMPLETED";
type MealSlot = "BREAKFAST" | "LUNCH" | "AFTERNOON_TEA" | "DINNER" | "LATE_NIGHT";
type MealPollStatus = "OPEN" | "CLOSED" | "CONFIRMED" | "COMPLETED";
type MealPollCandidateStatus = "ACTIVE" | "PENDING" | "REJECTED";
type ActivityState = "PENDING" | "DONE" | "EXPIRED";
type MedalAwardRule =
  | "MEAL_COMPLETION"
  | "DINING_EVENT_COMPLETION"
  | "GROUP_MEAL_COMPLETION"
  | "FULL_LOOP_COMPLETION"
  | "RECOMMENDATION_ADOPTED_TOTAL";
type DiningGroupActivityKind =
  | "POLL_OPENED"
  | "POLL_VOTED"
  | "POLL_SUGGESTED"
  | "POLL_NOTED"
  | "MENU_CONFIRMED"
  | "COOK_CLAIMED"
  | "BRING_UPDATED"
  | "MEAL_COMPLETED"
  | "MEMORY_CREATED"
  | "MEMBER_JOINED"
  | "INVITE_PENDING";

interface MealPlanSummary {
  id: UUID;
  planDate: string;
  mealSlot: MealSlot;
  title: string;
  menuItems: MealPlanMenuItemSummary[];
  menuLocked: boolean;
  status: MealPlanStatus;
  version: number;
  completedAt: IsoDateTime | null;
  hasDiningEvent: boolean;
  diningEventId: UUID | null;
  createdAt: IsoDateTime;
}

interface MealPlanMenuItemSummary {
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  servings: number | null;
  duration: RecipeDuration | null;
  durationText: string | null;
  slotType: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE" | null;
  purchaseState: "READY" | "PENDING";
  sortOrder: number;
}

interface DiningEventParticipantSummary {
  id: UUID;
  userUid: number | null;
  guestName: string | null;
  sourceType: "DINING_GROUP" | "SHARE";
  status: "INVITED" | "ACCEPTED" | "DECLINED" | "REMOVED";
  bringRecipeId: UUID | null;
  bringRecipeTitle: string | null;
}

interface MealPollSummary {
  id: UUID;
  diningGroupId: UUID;
  title: string;
  planDate: string;
  mealSlot: MealSlot;
  status: MealPollStatus;
  deadlineAt: IsoDateTime;
  choiceLimit: number;
  note: string | null;
  candidateCount: number;
  responseCount: number;
  confirmedPlanItemId: UUID | null;
  confirmedDiningEventId: UUID | null;
  version: number;
  createdAt: IsoDateTime;
}

interface MealPollCandidateSummary {
  id: UUID;
  recipeId: UUID | null;
  recipeVersionId: UUID | null;
  title: string;
  coverUrl: string | null;
  status: MealPollCandidateStatus;
  sourceType: "RECIPE" | "SUGGESTION";
  suggestedByUid: number | null;
  voteCount: number;
}

interface MealPollResponseSummary {
  id: UUID;
  userUid: number;
  selectedCandidateIds: UUID[];
  suggestionCandidateId: UUID | null;
  note: string | null;
  respondedAt: IsoDateTime;
}

interface MealPollDetail extends MealPollSummary {
  candidates: MealPollCandidateSummary[];
  responses: MealPollResponseSummary[];
}

interface DiningGroupActivitySummary {
  id: UUID;
  diningGroupId: UUID;
  kind: DiningGroupActivityKind;
  state: ActivityState;
  actorUid: number | null;
  actorName: string | null;
  title: string;
  detail: string | null;
  pollId: UUID | null;
  planItemId: UUID | null;
  diningEventId: UUID | null;
  createdAt: IsoDateTime;
}

interface DiningEventMenuItemSummary {
  id: UUID;
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  cookUserUid: number | null;
  cookName: string | null;
  version: number;
}

interface DiningEventSummary {
  id: UUID;
  title: string;
  scheduledAt: IsoDateTime;
  location: string | null;
  note: string | null;
  coverImageUrl: string | null;
  status: "PLANNED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  organizerUid: number | null;
  organizerName: string | null;
  organizerAvatarUrl: string | null;
  planItemId: UUID | null;
  diningGroupId: UUID | null;
  menu: RecipeContentSnapshot;
  menuItems: DiningEventMenuItemSummary[];
  participants: DiningEventParticipantSummary[];
  hasActiveShareLink: boolean;
  shareTokenPath: string | null;
  completedAt: IsoDateTime | null;
  version: number;
  createdAt: IsoDateTime;
}

interface DiningEventShareLinkResponse {
  shareTokenPath: string;
  expiresAt: IsoDateTime | null;
}

interface SharePreviewResponse {
  title: string;
  planItemId: UUID | null;
  planDate: string | null;
  mealSlot: MealSlot | null;
  scheduledAt: IsoDateTime;
  coverImageUrl: string | null;
  organizerName: string | null;
  menuPreview: string[];
  countdownText: string | null;
  locationHint: string | null;
}

interface UserMedalSummary {
  code: MedalCode;
  name: string;
  description: string;
  condition: string;
  earnedUserCount: number;
  earned: boolean;
  awardedAt: IsoDateTime | null;
}

interface MedalWallResponse {
  earnedCount: number;
  totalCount: number;
  items: UserMedalSummary[];
}

interface FridgeItemSummary {
  id: UUID;
  ingredientId: UUID | null;
  categoryName: string | null;
  name: string;
  quantityText: string | null;
  exactQuantity: string | null;
  exactUnitId: UUID | null;
  exactUnitName: string | null;
  note: string | null;
  available: boolean;
  expireAt: IsoDateTime | null;
  stockText: string | null;
  reservedText: string | null;
  availableText: string | null;
  reservations: Array<{
    shoppingListId: UUID;
    shoppingListName: string;
    shoppingItemId: UUID;
    reservedText: string;
  }>;
  updatedAt: IsoDateTime;
}
```

`GET /fridge-items?page=1&pageSize=50` 返回当前用户自己的冰箱条目分页，冰箱列表页用 `stockText / reservedText / availableText / reservations[]` 直接展示“实际库存 / 已预占 / 可用库存”和预占去向；其中 `categoryName` 给食材首页直接展示分类，`expireAt` 用于“临期 / 到期”状态展示。新增冰箱条目仍走 `POST /fridge-items`：

```ts
interface CreateFridgeItemRequest {
  name: string;
  ingredientId?: UUID | null;
  quantityText?: string | null;
  exactQuantity?: string | null;
  exactUnitId?: UUID | null;
  expireAt?: IsoDateTime | null;
  note?: string | null;
}
```

编辑已有冰箱条目改为只修改库存、到期时间和备注，不在这个接口里改食材名称或重新绑定系统食材：

```ts
interface UpdateFridgeItemRequest {
  quantityText?: string | null;
  exactQuantity?: string | null;
  exactUnitId?: UUID | null;
  expireAt?: IsoDateTime | null;
  note?: string | null;
}
```

规则：

1. `quantityText` 继续保存用户可读文案，比如 `半盒`、`1 把`。
2. `exactQuantity` 与 `exactUnitId` 必须成对出现或同时为空；只有这组结构化字段才参与后续库存自动抵扣。
3. `exactUnitId` 当前只接受系统单位；若数量或单位不可比较，购物清单详情只能给出“库存待确认”，不能自动算剩余采购量。
4. `PUT /fridge-items/{itemId}` 只维护这条个人库存事实，不改系统食材资料，也不支持在这里重绑食材身份。
5. `POST /fridge-items/consume` 继续只接收既有冰箱条目 ID 批量消耗，返回最新的 `PageResult<FridgeItemSummary>`。

`POST /meal-plans` 继续用于创建或更新本人某一天某餐次的计划，但当前一个餐次可同时承载多道菜；请求体固定提交：

```ts
interface CreateMealPlanRequest {
  planDate: string;
  mealSlot: MealSlot;
  expectedVersion?: number | null;
  title?: string | null;
  menuItems: Array<{
    slotType: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE";
    sortOrder: number;
    recipeId: UUID;
    recipeVersionId: UUID;
    purchaseState: "READY" | "PENDING";
  }>;
  note?: string | null;
}
```

同一用户同一 `planDate + mealSlot` 仍只保留一条计划记录；公开 `menuItems[]` 写入表示“按本次整顿菜单覆盖当前餐次”。新建时若未显式传 `title`，服务端默认写成 `餐次 + 饮食计划`，例如 `早餐饮食计划`、`晚餐饮食计划`；后续整餐更新若不传 `title`，继续保留现有标题。覆盖已有计划时必须提交当前 `expectedVersion`，版本不一致返回 `409`；已经完成的餐次不允许再被覆盖。旧 `recipeIds[]` 不再接受。当前历史老计划项允许 `slotType = null`，新写入必须显式提交 `slotType / recipeVersionId / purchaseState`。`POST /meal-plans/{planItemId}/complete` 只允许计划拥有者调用，并把该餐次从 `PLANNED` 推进到 `COMPLETED`；同一餐次进入完成态后不可逆。`POST /meal-plans/{planItemId}/dining-event` 继续从计划餐次创建饭局，但已完成餐次不得再发起新饭局；若当前计划已经固定菜单，新饭局直接以 `CONFIRMED` 状态创建。若该餐次已经挂有未结束饭局，后续继续改计划菜单时，服务端会同步刷新这场饭局的标题、菜单快照和菜单项，避免计划与饭局各自漂移成两份事实。

详情页单独改标题不再复用整餐覆盖接口，而是走独立写口：

```ts
interface UpdateMealPlanTitleRequest {
  expectedVersion: number;
  title?: string | null;
}
```

`POST /meal-plans/{planItemId}/title` 只修改当前计划标题；`title` 留空或显式传 `null` 时，服务端恢复成该餐次的默认 `餐次 + 饮食计划` 名称。该接口仍要求计划 owner 调用，并继续走 `expectedVersion` 防并发覆盖；若当前餐次已经挂有饭局，服务端会同步刷新饭局标题，保证饭局页和计划页标题一致。

菜单固定走独立写口：

```ts
interface ConfirmMealPlanMenuRequest {
  expectedVersion: number;
}
```

`POST /meal-plans/{planItemId}/confirm-menu` 只允许计划 owner 调用，要求当前餐次至少已有一道菜，且必须提交最新 `expectedVersion`。成功后服务端把 `MealPlanSummary.menuLocked` 置为 `true`，并同步把当前未结束饭局推进到 `CONFIRMED`。菜单固定后，不再允许通过 `POST /meal-plans` 或 `POST /meal-plans/items` 修改结构性内容，包括换菜、增删、排序和切换菜谱版本；但计划标题、饭局时间、餐次时间展示仍可继续调整。

`POST /dining-events` 新增“直接发起饭局”最小写入口，请求体固定为：

```ts
interface CreateDirectDiningEventRequest {
  planDate: string;
  mealSlot: MealSlot;
  scheduledAt: IsoDateTime;
  location?: string | null;
}
```

这条写接口只允许当前登录用户给“自己的某一天某一餐”直接开一场饭局，不额外接收菜单字段。若该餐次还没有计划项，服务端会先自动创建一条空菜单计划，再把饭局挂上去；若已有计划项，则直接复用原计划项。已完成餐次、同餐次已存在未结束饭局时统一返回冲突错误。直接创建得到的 `DiningEventSummary.menuItems` 可以为空，客户端随后继续走计划编辑链路补菜单即可。

计划详情新增“做饭助手”附属快照：`GET /meal-plans/{planItemId}/cook-assistant` 读取当前计划下最近一次生成结果；若从未生成，响应仍返回同一个对象，但 `hasSnapshot = false`，客户端据此显示空态。`POST /meal-plans/{planItemId}/cook-assistant` 在当前计划上生成或重生成一份规则型做饭安排，请求头继续使用 `Idempotency-Key`，请求体不额外接收业务字段。若当前菜单尚未固定，服务端先自动执行一次“固定菜单”，再继续生成本餐助理；自动固定成功后即使后续生成失败，也不回滚 `menuLocked`。该快照固定挂在 `MealPlanItem` 下，与计划同生命周期：计划删除时一并删除，不独立保留。服务端必须按当前 `MealPlanDish` 的 `recipeVersionId + slotType + purchaseState + sortOrder` 计算菜单签名；若当前 digest 与已存快照一致，则直接返回现有结果，不重复生成。

当前本餐助理的编排规则已经升级为：优先读取每道菜固定版本上的单菜助理快照，并按 `PREP / COOK / SERVE` 三段和 `EARLY / MID / LATE` 时序做规则编排；若某道菜还没有单菜助理，则回退读取该固定版本原始正文步骤与时长字段继续保守编排。也就是说，本餐助理现在是“单菜快照优先、原步骤兜底”。

实时补洞当前固定为同一个写接口内的受控分支：当本餐缺少单菜助理的菜数 `>= 2`，或缺失占比 `> 40%` 时，服务端会继续判断当前用户会员层级。若当前用户不是 `FREE`，则在生成本餐助理前，先为缺失的固定菜谱版本补齐单菜助理快照，再继续整桌编排；若当前用户是 `FREE`，则不自动补齐，只在 `summary.notes` 里明确提示“当前先按原步骤保守编排”。这个补洞过程仍然是一版本一次固化，不会在每次点击时反复重写。

返回结构最小固定为：

```ts
interface MealPlanCookAssistant {
  planItemId: UUID;
  hasSnapshot: boolean;
  isStale: boolean;
  generatedAt: IsoDateTime | null;
  summary: {
    dishCount: number;
    prepTaskCount: number;
    timelineStepCount: number;
    totalDurationText: string | null;
    suggestedStartTime: string | null;
    notes: string[];
  };
  prepTasks: Array<{
    title: string;
    detail: string;
    dishTitles: string[];
  }>;
  cookTimeline: Array<{
    order: number;
    title: string;
    detail: string;
    dishTitles: string[];
    parallelKey: string | null;
  }>;
  serveTasks: Array<{
    title: string;
    detail: string;
    dishTitles: string[];
  }>;
}
```

当前版本仍然不新增 AI 自由生成入口，也不把本餐助理结果另存成独立历史对象；实时补洞留待后续单独接入。

### 随机页最小真实流程

随机页当前已确认的业务目标不是“娱乐型摇一摇”，而是：

```text
选条件 -> 生成一桌 -> 逐道调整 -> 本桌缺口预检 -> 加入计划或去采购
```

这部分当前已落地为**最小真实流程**。当前现行接口先固定为 5 个最小动作：

```text
POST /random-menus/generate
POST /random-menu-slots/replace
POST /random-menu-gap/preview
POST /meal-plans
POST /shopping-items/from-random-menu
```

#### 生成一桌

`POST /random-menus/generate` 用于按餐次、人数和冰箱优先生成一桌候选菜单。请求最小字段：

```ts
interface GenerateRandomMenuRequest {
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  peopleCount: number;
  fridgePreferred: boolean;
  slotPlan?: {
    meatCount: number;
    vegetableCount: number;
    soupCount: number;
    stapleCount: number;
    breakfastStapleCount: number;
    breakfastProteinCount: number;
    breakfastSideCount: number;
  } | null;
}
```

约束：

1. `peopleCount` 当前建议限制为 `1 ~ 12`。
2. 单次总菜位数当前建议最大 `12`。
3. 接口不落库、不写幂等记录、不做缓存。
4. 响应只返回当前菜单摘要，不返回完整菜谱正文、步骤或全量食材明细。

#### 替换单个菜位

`POST /random-menu-slots/replace` 只替换当前单个菜位，不回传整桌重复数据。请求最小字段：

```ts
interface ReplaceRandomMenuSlotRequest {
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  peopleCount: number;
  fridgePreferred: boolean;
  slotPlan: {
    meatCount: number;
    vegetableCount: number;
    soupCount: number;
    stapleCount: number;
    breakfastStapleCount: number;
    breakfastProteinCount: number;
    breakfastSideCount: number;
  };
  currentItems: Array<{
    slotId: string;
    slotType: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE";
    recipeId: UUID;
    recipeVersionId: UUID;
  }>;
  targetSlotId: string;
  targetSlotType: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE";
  replaceConstraints: Array<
    | { kind: "FLAVOR"; value: "NOT_SPICY" | "MILD" | "LIGHT" }
    | { kind: "DURATION"; value: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" }
    | { kind: "INGREDIENT"; value: "USE_FRIDGE_FIRST" }
    | { kind: "AVOID_INGREDIENT"; ingredientId?: UUID; ingredientName: string }
  >;
  rejectedRecipeVersionIds: UUID[];
  requestSeq: number;
}
```

约束：

1. `replaceConstraints` 当前建议最大 `6` 条。
2. `rejectedRecipeVersionIds` 当前建议最大 `30` 条。
3. 服务端必须自行校验 `recipeId / recipeVersionId`、`slotType` 和当前用户可读范围。
4. 前端只接受与当前 `requestSeq` 相等的响应，旧响应不得覆盖新结果。

#### 本桌缺口预检

`POST /random-menu-gap/preview` 只计算当前这桌的局部缺口，不复用 `GET /shopping-gap` 的全局待处理饭局汇总语义。请求最小字段：

```ts
interface CheckRandomMenuGapRequest {
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  peopleCount: number;
  items: Array<{
    slotId: string;
    slotType: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE";
    recipeId: UUID;
    recipeVersionId: UUID;
  }>;
  inventoryDecisions: Array<{
    slotId: string;
    ingredientId?: UUID | null;
    ingredientName: string;
    decision: "HAS" | "MISSING";
  }>;
}
```

响应必须至少区分：

- `OK`
- `PARTIAL`
- `MISSING`
- `UNKNOWN`

规则：

1. `UNKNOWN` 不自动降成 `MISSING`。
2. 用户未处理 `UNKNOWN` 时，不允许直接加入计划。
3. 当前建议 `inventoryDecisions` 最大 `80` 条。
4. 响应只返回当前菜单相关缺口，不得混入全局冰箱或全局购物清单数据。

#### 计划写入升级

随机页不新增 `/random-menus/create-plan`。最终写入仍回真实 owner：`POST /meal-plans`。

随机页使用当前已冻结的计划写入契约：

```ts
interface CreateMealPlanRequestV2 {
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  expectedVersion?: number | null;
  menuItems: Array<{
    slotType: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE";
    sortOrder: number;
    recipeId: UUID;
    recipeVersionId: UUID;
    purchaseState: "READY" | "PENDING";
  }>;
  note?: string | null;
}
```

规则：

1. 覆盖已有计划时必须校验 `expectedVersion`。
2. 已完成餐次仍不允许覆盖。

`POST /meal-plans` 只用于整餐创建和整餐编辑，请求体继续提交完整 `menuItems[]` 快照。

当调用方只是向某个餐次追加一道菜时，不再复用整餐覆盖接口，而是使用增量写入：

```ts
POST /meal-plans/items

interface AddMealPlanItemRequest {
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "AFTERNOON_TEA" | "DINNER" | "LATE_NIGHT";
  recipeId: UUID;
  recipeVersionId: UUID;
  slotType?: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE" | null;
  purchaseState?: "READY" | "PENDING";
}
```

规则：

1. 这条接口只表达“把当前菜谱追加进对应餐次”，不接收完整 `menuItems[]`。
2. 若对应餐次不存在，服务端按 `planDate + mealSlot` 自动创建该餐次。
3. 若该餐次已存在相同 `recipeId` 的有效菜单项，服务端返回当前餐次摘要，不重复追加。
4. 若该餐次已完成或菜单已固定，返回 `409`。
5. 响应继续返回最新 `MealPlanSummary`，不额外返回无关上下文数据。
3. `purchaseState = PENDING` 对应“保留但暂不采购”。
4. `recipeVersionId` 由客户端显式提交，服务端必须校验与 `recipeId` 的真实匹配关系。

#### 购物写入

`POST /shopping-items/from-random-menu` 用于把当前缺口写入本人购物域。请求最小字段：

```ts
interface CreateRandomMenuShoppingItemsRequest {
  items: Array<{
    slotId: string;
    recipeId: UUID;
    recipeVersionId: UUID;
    ingredients: Array<{
      ingredientId?: UUID | null;
      ingredientName: string;
      quantityText: string | null;
    }>;
  }>;
}
```

规则：

1. 该接口写入 owner 仍是当前用户，不扩成共享清单批处理接口。
2. 来源 `sourceKey` 必须由服务端生成，不信任客户端拼接。
3. 接口应使用 `Idempotency-Key`。
4. 当前建议总缺口食材项最大 `80`。

#### 安全、性能与过渡边界

1. 随机页所有接口都要求登录。
2. 服务端不得信任客户端传回的 `title / durationText / estimatedCalories / flavorTags / quantityText` 作为事实。
3. 随机计算接口默认不缓存；只有证明查询成本高且失效边界清晰时才允许单独评审缓存。
4. 本功能当前不新增随机草稿表、随机历史表、随机候选缓存表。
5. 计划写入只接受 `menuItems[]`，不保留 `recipeIds[]` 兼容输入。

购物域当前改成“共享清单头 + 清单项”模型。`/shopping-items` 不再承担购物首页职责，只保留为个人购物事实查询接口，供超市模式、采购历史和底层兼容读取使用。购物清单首页与详情改读新的 `/shopping-lists*` 契约。

`ShoppingItemSummary` 当前统一返回：

```ts
interface ShoppingItemSummary {
  id: UUID;
  name: string;
  quantityText: string | null;
  note: string | null;
  sourceCount: number;
  sourceTitles: string[];
  sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
  sourceKey: string | null;
  status: "OPEN" | "BOUGHT" | "DELETED";
  updatedAt: IsoDateTime;
}

type ShoppingListStatus = "ACTIVE" | "COMPLETED" | "VOIDED";
type ShoppingListRole = "OWNER" | "COLLABORATOR";
type ShoppingListItemFridgeAction = "APPLY" | "UNDO";
type ShoppingListItemFridgeActionMode = "NONE" | "APPLY_FULL" | "APPLY_PARTIAL" | "NEED_CONFIRM" | "UNDO";

interface ShoppingListStatusCount {
  status: ShoppingListStatus;
  count: number;
}

interface ShoppingListSummary {
  id: UUID;
  name: string;
  status: ShoppingListStatus;
  role: ShoppingListRole;
  ownerUid: number;
  ownerNickname: string | null;
  memberCount: number;
  memberLimit: number;
  pendingInviteCount: number;
  progressDoneCount: number;
  progressTotalCount: number;
  hasActiveShareLink: boolean;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  completedAt: IsoDateTime | null;
  voidedAt: IsoDateTime | null;
}

interface ShoppingItemSourceSummary {
  sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
  title: string | null;
  recipeId: UUID | null;
  sourceVersionId: UUID | null;
  planItemId: UUID | null;
  diningEventId: UUID | null;
  sourceBatchKey: string | null;
  addCount: number | null;
  servings: number | null;
}

interface ShoppingListDetailItem {
  id: UUID;
  ingredientId: UUID | null;
  name: string;
  categoryName: string | null;
  imageUrl: string | null;
  quantityText: string | null;
  requiredQuantityText: string | null;
  remainingQuantityText: string | null;
  appliedInventoryQuantityText: string | null;
  note: string | null;
  status: "OPEN" | "CHECKED" | "REMOVED";
  fridgeText: string | null;
  inventoryStatus: "NONE" | "ENOUGH" | "SHORTAGE" | "UNKNOWN";
  inventoryApplied: boolean;
  inventoryCovered: boolean;
  fridgeStatusText: string | null;
  fridgeActionLabel: string | null;
  fridgeActionMode: ShoppingListItemFridgeActionMode;
  checkedAt: IsoDateTime | null;
  updatedAt: IsoDateTime;
  sources: ShoppingItemSourceSummary[];
}

interface ShoppingListCollaborator {
  userId: UUID;
  role: "OWNER" | "COLLABORATOR";
  joinedAt: IsoDateTime;
  user: {
    uid: number;
    nickname: string | null;
    avatarUrl: string | null;
  };
}

interface ShoppingListDetail extends ShoppingListSummary {
  collaborators: ShoppingListCollaborator[];
  items: ShoppingListDetailItem[];
}

interface ShoppingListItemPatchResponse {
  listId: UUID;
  version: number;
  progressDoneCount: number;
  progressTotalCount: number;
  item: ShoppingListDetailItem | null;
  removedItemId: UUID | null;
}
```

补充说明：

1. `POST /shopping-items/from-random-menu` 当前返回的仍是旧购物事实摘要 `ShoppingItemSummary[]`，来源类型固定为 `RANDOM_MENU`。
2. 这条随机菜单写链路当前只保证 `sourceType + sourceKey + note/sourceTitles` 可用于来源识别与去重，不进入旧 `RECIPE` 聚合口径，也不要求返回 `recipeId / sourceVersionId / servings` 这组菜谱聚合字段。
3. `/shopping-items` 与 `/shopping-items/board` 继续共存于过渡期：前者保留个人购物事实读取与兼容写链路，后者保留旧聚合板读取；共享购物清单首页和详情仍以 `/shopping-lists*` 为主。

`GET /shopping-lists/summary` 返回购物首页顶部 3 张状态卡片所需的统计：

```ts
interface ShoppingListSummaryResponse {
  statuses: ShoppingListStatusCount[];
  defaultStatus: ShoppingListStatus;
}
```

`GET /shopping-lists?status=ACTIVE|COMPLETED|VOIDED` 返回当前用户可见的清单列表：

```ts
interface ShoppingListPageResponse {
  items: ShoppingListSummary[];
}
```

`POST /shopping-lists` 只创建空白清单：

```ts
interface CreateShoppingListRequest {
  name: string | null;
}
```

服务端可在 `name = null` 时生成默认标题；购物清单没有“订单模板”或“整单一键买完”概念。清单名当前统一限制为最多 `20` 个字。

`GET /shopping-lists/{listId}` 返回单张清单详情，当前默认按食材项聚合展示，不强制提供“按菜谱 / 按食材”双视图。每个食材项必须保留来源摘要，至少能表达它来自哪些菜谱、计划或饭局。详情页额外下发：

1. `categoryName`、`imageUrl`：供食材卡片直接展示分类和封面；没有图片时客户端显示占位图。
2. `quantityText` 与 `requiredQuantityText` 只表示原始采购需求，不因点击 `已购` 或 `用库存` 改写。
3. `remainingQuantityText` 表示扣除当前清单库存预占后的待买量；`appliedInventoryQuantityText` 表示本清单已经预占的库存量。
4. `fridgeText` 显示当前可用库存摘要，`inventoryStatus` 明确表示无库存、库存足够、库存不足或数量待确认；`inventoryApplied / inventoryCovered` 是按钮和进度判断使用的事实状态。
5. `fridgeStatusText` 只负责展示 `库存不足，还需买 X`、`库存足够，不买了` 或 `库存待确认`，不能作为客户端状态判断依据。
6. `fridgeActionLabel`、`fridgeActionMode`：驱动详情页上的 `用库存 / 撤销` 按钮；当前只对清单创建者开放，协作者固定返回 `NONE`，且不读取创建者的冰箱精确数量。
7. 清单摘要里的 `progressDoneCount / progressTotalCount` 按合并后的食材组统计；组内所有采购项均已购或 `inventoryCovered = true` 才算完成。

`POST /shopping-lists/{listId}/rename` 只允许清单创建者调用：

```ts
interface RenameShoppingListRequest {
  version: number;
  name: string;
}
```

`POST /shopping-lists/{listId}/items` 只用于向指定清单手动增加食材项：

```ts
interface CreateShoppingListItemRequest {
  name: string;
  ingredientId: UUID | null;
  quantityText: string | null;
  note: string | null;
}
```

`POST /shopping-lists/{listId}/items/from-recipe` 把一份当前用户可读的固定菜谱版本写入该清单：

```ts
interface AddRecipeToShoppingListRequest {
  recipeId: UUID;
  sourceVersionId: UUID;
  planItemId?: UUID | null;
}
```

同一道菜再次加入同一张清单时，不覆盖旧来源批次；服务端保留 `sourceBatchKey`，以便详情页统计 `addCount` 和累计人份。

当请求携带 `planItemId` 时，服务端必须校验该计划属于当前用户，且该计划下确实包含本次写入的 `recipeId + sourceVersionId`。写入后的清单项来源摘要继续保留菜谱字段，同时把 `sourceType` 记为 `PLAN`、`planItemId` 记为对应计划，供后续按计划或按菜谱聚合展示。

`POST /shopping-lists/{listId}/items/from-plan` 用于把一顿计划里的菜谱整单写入购物清单，避免前端逐菜循环时出现部分成功：

```ts
interface AddPlanToShoppingListRequest {
  planItemId: UUID;
}
```

服务端必须校验该计划属于当前用户，并按计划当前保存的菜谱明细一次性完成整单写入；任一菜谱版本校验失败时整单回滚，不允许留下部分成功的购物项。

`POST /shopping-lists/{listId}/items/from-gap` 用于把缺口页当前选中的食材写入指定购物清单：

```ts
type ShoppingGapWindow = "NEXT_48_HOURS" | "NEXT_7_DAYS" | "LATER";

interface AddShoppingGapItemsRequest {
  window: ShoppingGapWindow;
  gapKeys: string[];
}
```

服务端必须按当前登录用户当下的饭局与冰箱重新计算缺口，只接受当前时间层里仍有效的 `gapKeys`；写入时按真实来源饭局拆成 `EVENT` 来源购物项，同一张清单里已存在相同 `sourceKey` 的未完成缺口项时跳过，不重复堆叠。

`POST /shopping-lists/{listId}/items/{itemId}/check` 用于勾选或取消采购完成：

```ts
interface UpdateShoppingListItemCheckRequest {
  version: number;
  checked: boolean;
}
```

已被库存完全覆盖的购物项当前不能再走这条勾选链路；它们通过库存动作直接变为“无需购买”。

这条接口成功后不再回整份 `ShoppingListDetail`，而是返回 `ShoppingListItemPatchResponse`：只带清单新 `version`、顶部进度，以及当前变更的购物项。

`POST /shopping-lists/{listId}/items/{itemId}/fridge` 用于为当前购物项创建或撤销个人库存预占：

```ts
interface ApplyShoppingListItemFridgeRequest {
  version: number;
  action: "APPLY" | "UNDO";
}
```

规则：

1. 当前只有清单 `OWNER` 能调用；协作者不读取、也不预占创建者的个人冰箱。
2. 只允许在 `ACTIVE` 清单下对 `OPEN` 状态食材项调用。
3. `APPLY` 时，若购物项和冰箱都具备可比较的结构化数量，服务端会为该购物项创建一组库存预占记录，并按“可用库存 = 实际库存 - 有效预占”自动计算：
   - 库存足够：把该项标记为 `inventoryCovered = true`，详情页显示 `库存足够，不买了`，`已购` 按钮应禁用。
   - 库存不足：只写入预占事实，`remainingQuantityText` 返回剩余待买量，详情页显示 `库存不足，还需买 X`。
4. 若命中了冰箱记录但缺少可比较的结构化数量，详情页返回 `fridgeActionMode = "NEED_CONFIRM"`；客户端应提示先补精确库存，服务端也会拒绝自动预占。
5. `UNDO` 会释放当前购物项尚未结算的库存预占，原始采购量字段不变。
6. 点击 `已购` 只更新采购状态，不改原始需求、剩余待买量、已预占量或真实库存；库存不足时允许与 `用库存` 同时成立，库存足够时两者互斥。
7. 预占不会在点击时立即扣减真实冰箱库存；只有 `POST /shopping-lists/{listId}/complete` 完成清单时，服务端才会事务性结算这些预占。

这条接口成功后同样返回 `ShoppingListItemPatchResponse`，不再回整份详情。

`POST /shopping-lists/{listId}/items/{itemId}/remove` 用于把食材项从当前有效采购项中移除，不抹掉来源事实：

```ts
interface RemoveShoppingListItemRequest {
  version: number;
}
```

如果该购物项存在尚未结算的库存预占，服务端会先释放预占，再把该项标记移除。这条接口成功后返回 `ShoppingListItemPatchResponse`，其中 `removedItemId` 表示需要从当前列表移除的那一项。

`POST /shopping-lists/{listId}/members/{memberUserId}/remove` 只允许清单创建者在 `ACTIVE` 状态下移除一个已加入的普通协作者；创建者本人和 `OWNER` 角色当前不能通过这条路径移除：

```ts
interface RemoveShoppingListMemberRequest {
  version: number;
}
```

`GET /shopping-items` 继续只返回当前用户自己的平铺购物条目，供超市模式、采购记录和简单列表使用。它不再作为购物清单首页的主数据源。

`POST /shopping-items`、`GET /shopping-items/board`、`POST /shopping-items/from-recipe`、`POST /shopping-items/{itemId}/status` 和 `POST /shopping-items/group-status` 当前保留为旧个人购物事实和旧聚合板写链路，供现有超市模式、历史页面和旧购物页兼容使用；共享购物清单主链路统一迁移到 `/shopping-lists*` 后，再整体评估是否下线这些兼容路径。当前不再为这些旧路径扩展共享清单语义。

购物清单状态流转：

1. `ACTIVE`：采购中，可编辑、可共享、可勾选完成、可作废。
2. `COMPLETED`：已完成，可复制和删除。
3. `VOIDED`：已作废，可恢复、复制和删除。

`POST /shopping-lists/{listId}/void` 和 `POST /shopping-lists/{listId}/restore` 当前只接收并发控制字段：

```ts
interface UpdateShoppingListStatusRequest {
  version: number;
}
```

`POST /shopping-lists/{listId}/copy` 会复制当前清单的有效食材项，并生成一张新的 `ACTIVE` 清单；若操作者是协作者，复制结果默认归该操作者个人所有，不继承原协作成员。

`POST /shopping-lists/{listId}/delete` 只允许清单创建者删除 `COMPLETED / VOIDED` 清单，当前也只接收并发控制字段：

```ts
interface DeleteShoppingListRequest {
  version: number;
}
```

删除后，这张清单及其清单项不再出现在共享清单首页、旧购物记录页或超市模式兼容链路里；已入库的冰箱事实保留，但来源引用允许因源清单删除而置空。

`POST /shopping-lists/{listId}/complete` 不是简单改状态，而是“完成采购并入库”的事务操作。完成前必须先进入入库确认：

```ts
interface CompleteShoppingListRequest {
  version: number;
  entries: Array<{
    itemId: UUID;
    store: boolean;
    quantityText: string | null;
    expireDays: number | null;
    expireAt: string | null;
  }>;
}
```

完成规则：

1. 默认只允许把当前清单中 `CHECKED` 的食材项带入入库确认。
2. 每一项只处理 `是否入库`、`数量` 和 `到期时间`；当前不要求生产日期。
3. 若 `expireDays = null` 且 `expireAt = null`，服务端按默认 `7 天` 推导到期时间。
4. 只有 `store = true` 的项会生成新的个人冰箱事实，并保留 `sourceShoppingListId/sourceShoppingItemId`。
5. 同一事务内完成“清单状态改为 `COMPLETED` + 选中项入库 + 审计记录”。

共享规则：

1. 清单分享当前只保留好友链接邀请入口。
2. 共享加入必须要求登录，不开放匿名协作编辑。
3. 首版角色只分 `OWNER` 与 `COLLABORATOR`，不建设管理员。
4. 创建者可改名、分享、移除成员、完成、作废、恢复、删除和复制清单。
5. 协作者可勾选完成、取消完成、添加食材、删除食材、从菜谱加入、退出和复制清单。
6. 协作者上限按“总人数”计算，包含创建者本人；普通用户当前最多 `2` 人协作。
7. 发出好友链接不预占名额，只有真正加入成功时才占坑。
8. 满员后旧成员不受影响，但新成员不能继续加入；移除成员后名额重新释放。

```ts
interface ShareShoppingListLinkResponse {
  shareToken: string;
  shareUrl: string;
}

interface ShoppingListInviteSummary {
  id: UUID;
  listId: UUID;
  name: string;
  ownerUid: number;
  ownerNickname: string | null;
  memberCount: number;
  memberLimit: number;
  itemCount: number;
  status: ShoppingListStatus;
  inviteStatus: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
  canJoin: boolean;
  invitedAt: IsoDateTime;
  handledAt: IsoDateTime | null;
}

interface ShoppingListInvitePageResponse {
  items: ShoppingListInviteSummary[];
}

interface ShoppingListInviteActionResponse {
  inviteId: UUID;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
  updatedAt: IsoDateTime;
}

interface LeaveShoppingListRequest {
  version: number;
}
```

`GET /shopping-shares/{shareToken}` 返回一张可加入共享清单的最小预览：

```ts
interface ShoppingSharePreview {
  listId: UUID;
  name: string;
  ownerUid: number;
  ownerNickname: string | null;
  memberCount: number;
  memberLimit: number;
  joined: boolean;
  canJoin: boolean;
  itemCount: number;
  status: ShoppingListStatus;
}
```

`POST /shopping-shares/{shareToken}/join` 只在登录后建立新的协作者关系；若当前已是成员则返回幂等成功，若协作者名额已满则返回冲突错误。

`GET /shopping-list-invites` 默认仍只返回当前登录用户待确认且对应清单仍为 `ACTIVE` 的邀请卡片，供购物清单首页的“待确认共享”直接使用。通知中心可通过 `filter` 读取真实邀请历史：

1. `filter=ALL`：返回当前用户最近 `7` 天内的清单协作消息，包含 `PENDING / ACCEPTED / DECLINED`。
2. `filter=PENDING`：返回最近 `7` 天内仍待处理、且对应清单仍为 `ACTIVE` 的邀请。
3. `filter=RESOLVED`：返回最近 `7` 天内已处理的邀请，当前包含 `ACCEPTED / DECLINED`。

`handledAt` 在 `ACCEPTED / DECLINED` 时返回处理时间，否则为 `null`。`POST /shopping-list-invites/{inviteId}/accept` 由被邀请人确认加入；若用户已经通过好友链接先加入同一张清单，服务端会把这条待确认邀请同步结清为 `ACCEPTED`，避免首页继续残留旧卡片。`POST /shopping-list-invites/{inviteId}/decline` 只把当前邀请标记为 `DECLINED`，不影响该清单后续重新发起新邀请。

`GET /shopping-gap` 当前返回“当前用户待处理饭局”的时间分层缺口，不再要求先选某一场饭局。响应固定分成 `NEXT_48_HOURS / NEXT_7_DAYS / LATER` 三段，每段按食材平铺，单条食材缺口继续只在“同食材且同精确单位”下合法合并数量，并返回：

1. `key`：当前时间层内该条缺口的稳定键，供后续 `from-gap` 写入使用。
2. `ingredientId / name / quantityText`：食材主视角摘要。
3. `sourceCount / eventCount`：当前条目覆盖了几道菜、几场饭局。
4. `events[]`：每场来源饭局的 `eventId / title / scheduledAt / recipeTitles[]`，用于页面展示“这条缺口对应哪些饭局、哪些菜谱”。

`POST /dining-events/{eventId}/shopping-gap` 仍保持单饭局写入旧个人购物事实链路的职责，不扩成整包写入所有饭局，也不作为新共享购物清单的主写入口。

缺口合并规则当前保持：

1. 只围绕当前用户自己的冰箱来判断缺口。
2. 相同食材只有在相同精确单位下才自动合并数量。
3. `sourceCount` 返回该条缺口实际覆盖了几道菜。
4. 模糊用量保持逐项提示，不自动相加成虚假的精确数量。

共享清单当前不要求实时协同。详情页使用“操作后刷新 + 页面重进刷新 + 下拉刷新 + 轻轮询”即可；所有写接口必须提交 `version`，冲突时返回 `409`，提示客户端刷新后重试。

`POST /dining-events/{eventId}/share-link` 用于生成或重置当前饭局的邀请分享链接，请求头继续使用 `Idempotency-Key`，请求体为空。当前只允许饭局发起人调用，且仅在饭局未取消、未完成时可成功。响应最小固定为：

```ts
interface DiningEventShareLinkResponse {
  shareTokenPath: string;
  expiresAt: IsoDateTime | null;
}
```

分享页仍复用现有 `/pages_share/preview/index?token=...` 预览页，不单独新开页面；邀请链接在饭局完成或取消前都可继续重生成和使用，完成后主分享动作切到饭局卡快照。由于服务端当前只持久化分享 token 的哈希，不保留历史明文 token，客户端后续若要继续分享，必须再次调用该写接口现生成链接；`GET /dining-events/{eventId}` 里的 `shareTokenPath` 不应被当作可长期复用的稳定链接来源。

同时，这条写口会让同一饭局之前仍处于 `ACTIVE / OPENED` 的旧好友邀请失效，当前只保留最新一条未使用外链，避免旧链接继续裸露在外。服务端会单独记录这条外链邀请事实及其打开、校验、接受、撤销/失效时间，供后续审计与回看使用。

`POST /dining-events/{eventId}/share-link/disable` 用于当前饭局发起人主动关闭好友邀请外链，请求头继续使用 `Idempotency-Key`，请求体为空。当前只允许饭局发起人调用，且仅在饭局未取消、未完成时可成功；服务端会把该饭局当前仍处于 `ACTIVE / OPENED` 的好友邀请统一改成 `REVOKED`，随后返回最新 `DiningEventSummary`。客户端应使用返回里的 `hasActiveShareLink=false` 刷新页面状态，而不是继续复用旧的本地分享状态。

`POST /dining-events/{eventId}/participants/{participantId}/revoke` 用于饭局发起人撤回一条仍处于待确认状态的邀请，请求头继续使用 `Idempotency-Key`，请求体为空。当前只允许饭局发起人调用，且仅在饭局未取消、未完成、该参与记录状态仍为 `INVITED` 时可成功；服务端会把这条记录改成 `REMOVED`，随后返回最新 `DiningEventSummary`。

`POST /dining-events/{eventId}/participants/{participantId}/reinvite` 用于饭局发起人再次邀请一位已经拒绝或被移除的饭搭子成员，请求头继续使用 `Idempotency-Key`，请求体为空。当前只允许饭局发起人调用，且仅在饭局未取消、未完成、该参与记录来自饭搭子成员且状态为 `DECLINED / REMOVED` 时可成功；服务端会把这条记录重置回 `INVITED`，随后返回最新 `DiningEventSummary`。

`POST /dining-events/{eventId}/schedule` 用于当前饭局发起人单独修改时间，请求头继续使用 `Idempotency-Key`，请求体最小固定为：

```ts
interface UpdateDiningEventScheduleRequest {
  expectedVersion: number;
  scheduledAt: IsoDateTime;
  location?: string | null;
}
```

当前只允许饭局发起人调用，且仅在饭局未取消、未完成时可成功；服务端继续按 `expectedVersion` 防并发覆盖。客户端当前主要用于“改时间”，`location` 未传时复用原值。

`POST /dining-events/{eventId}/note` 用于当前饭局发起人补充或清空一段公开备注，请求头继续使用 `Idempotency-Key`，请求体最小固定为：

```ts
interface UpdateDiningEventNoteRequest {
  expectedVersion: number;
  note: string | null;
}
```

当前只允许饭局发起人调用，且仅在饭局未取消、未完成时可成功；服务端继续按 `expectedVersion` 防并发覆盖。`note` 留空字符串时按 `null` 处理，读取 `GET /dining-events/{eventId}` 时统一通过 `DiningEventSummary.note` 回显给全部参与人。

`GET /share/{shareToken}/preview` 继续作为饭局邀请落地页读取口，但现在只返回登录前可公开展示的轻信息，不再直接暴露完整菜单食材和精确地点。最小响应固定为：

```ts
interface SharePreviewResponse {
  title: string;
  planItemId: UUID | null;
  planDate: string | null;
  mealSlot: MealSlot | null;
  scheduledAt: IsoDateTime;
  coverImageUrl: string | null;
  organizerName: string | null;
  menuPreview: string[];
  countdownText: string | null;
  locationHint: string | null;
}
```

`POST /share/{shareToken}/accept` 仍要求登录；当前采用“一条链接先到先得”的受控好友邀请策略：同一条链接首次被某个账号接受后，会把这位用户固化到这条邀请记录上，后续其他账号再拿到同一链接时统一拒绝进入。由于当前账号体系还没有微信身份绑定，这里只能做到“单链接单账号消费”，不能强校验“分享目标 A 的微信身份必须等于登录账号 A”。

`POST /dining-events/{eventId}/cover` 用于上传或替换饭局封面图，请求头继续使用 `Idempotency-Key`，表单字段最小固定为：

```ts
interface UpdateDiningEventCoverRequest {
  expectedVersion: number;
  file: File;
}
```

当前只允许饭局发起人调用；服务端按 `expectedVersion` 防并发覆盖，并把图片固化成饭局公开资源。读取 `GET /dining-events/{eventId}` 时，若当前饭局已有封面图，摘要里的 `coverImageUrl` 返回可直接展示的公开地址；若没有封面图则返回 `null`。

`POST /dining-events/{eventId}/cook` 用于对已确认菜单中的单道菜执行“我来做”认领或释放，请求体只接收：

```ts
interface ClaimCookRequest {
  expectedVersion: number;
  menuItemId: UUID;
  action: "CLAIM" | "RELEASE";
}
```

`menuItemId` 必须属于该饭局当前已确认菜单；`CLAIM` 表示当前操作者认领该菜；`RELEASE` 只能释放自己已认领的菜，或由发起人按后续权限规则释放。同一道菜同一时刻只有一位有效认领人；并发冲突返回 `409`。该接口只改写菜级责任人，不改写个人购物、冰箱或菜谱所有权。

`POST /dining-events/{eventId}/bring` 继续用于“我带菜”，不新增并行写路径。`POST /dining-events/{eventId}/complete` 只允许饭局发起人调用；当且仅当该饭局至少已有 1 位状态为 `ACCEPTED` 的参与人时才允许完成。已取消饭局不得完成，已完成饭局重复调用时直接返回当前摘要，不再次改写状态。

`POST /dining-events/{eventId}/memory-shares` 用于在已到开饭时间或已完成的饭局上生成一张不可变餐桌回忆卡快照。当前只允许饭局发起人调用，请求体只接收：

```ts
interface CreateDiningMemoryShareRequest {
  showParticipants: boolean;
  caption: string | null;
}
```

该接口必须满足：

1. 饭局必须已经到开饭时间或已经 `COMPLETED`，且已经冻结最终菜单；已取消饭局不得生成。
2. 只允许当前饭局发起人生成，不给其他参与成员开放代生成路径。
3. `showParticipants=false` 时公开快照不得返回任何成员摘要。
4. 每次生成都会固化为新的 `snapshotVersion`，后续饭局改动不会回写到历史快照。
5. 快照只允许包含 `title / planDate / mealSlot / menuItems(title, coverUrl, cookName) / participants(displayName, avatarUrl, role) / caption / sharedAt / snapshotVersion` 这些白名单字段。

`GET /memory-shares/{shareToken}/preview` 是餐桌回忆卡的公开读取路径，无需登录，只返回上述不可变白名单快照；不得暴露投票详情、内部备注、个人冰箱、购物清单、过敏忌口、内部主键、权限字段或调试字段。该路径与现有 `GET /share/{shareToken}/preview` 的饭局邀请预览分离，不能复用或混淆。

`GET /users/me/medals` 当前按模板返回可见勋章，不再写死在接口层。服务端当前只根据真实完成事实和真实审核收录事实自动点亮，包括：

- `MEAL_COMPLETION`：完成餐次累计达到模板阈值。
- `DINING_EVENT_COMPLETION`：完成饭局累计达到模板阈值，统计发起人和已接受参与人。
- `GROUP_MEAL_COMPLETION`：作为发起人完成至少有 1 位已接受参与人的饭局，累计达到模板阈值。
- `FULL_LOOP_COMPLETION`：完成饭局、事件采购已买、最终完成用餐的完整闭环累计达到模板阈值。
- `RECOMMENDATION_ADOPTED_TOTAL`：推荐收录累计达到模板阈值，当前只统计菜谱推荐审核通过、食材推荐审核通过或归并、单位建议审核通过或归并。

当前勋章接口不返回任务进度、差几次、会员加成、排行榜、分享奖励或后台发放状态。勋章图片改为后台独立上传，后台可分别维护 `earnedImageUrl / lockedImageUrl` 两张图；用户侧优先按获得状态读取对应图片，没有对应图片时才回退到另一张图，再回退到现有 `iconKey` 展示。公开资源接口会按原始文件类型返回 `image/png / image/jpeg / image/webp / image/svg+xml`；微信小程序场景下，勋章若使用 `SVG`，继续走后台公开 URL，由页面 `<image>` 直接加载网络资源。勋章只能由服务端在完成餐次、完成饭局或后台审核通过推荐事务里派生；客户端不得提交任何“点亮勋章”字段。

### 菜谱

菜谱当前链路冻结为：`草稿 -> 发布到私房菜`、`灵感系统菜谱 -> 改编为私房菜`，以及“灵感/周刊直接加入计划时，必要时先保存到私房菜”。灵感系统菜谱只读；用户创建、编辑和保存不会自动进入系统库，只有推荐审核通过后才生成系统菜谱。合集不再是前台菜谱入口，历史合集接口暂不删除，以保留已有固定引用。

```ts
type RecipeDifficulty = "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING";
type RecipeDuration = "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60";
type UnitType = "WEIGHT" | "VOLUME" | "COMMON" | "PACKAGE";
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

interface IngredientFeedbackResult {
  id: UUID;
  ingredientId: UUID;
  status: "PENDING";
  createdAt: IsoDateTime;
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
  imageUrl: string | null;
}

type UploadAssetScene = "RECIPE_COVER" | "RECIPE_STEP";
type UploadAssetStatus = "TEMP" | "BOUND" | "DELETED";

interface UploadImageSummary {
  id: UUID;
  publicId: string;
  scene: UploadAssetScene;
  slotKey: string;
  status: UploadAssetStatus;
  imageUrl: string;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime | null;
}

interface UploadImageResponse {
  upload: UploadImageSummary;
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

type RecipeAssistantStepPhase = "PREP" | "COOK" | "SERVE";

interface RecipeAssistantStep {
  order: number;
  phase: RecipeAssistantStepPhase;
  title: string;
  detail: string;
  imageUrl: string | null;
  durationText: string | null;
}

interface RecipeAssistantSummary {
  stepCount: number;
  prepStepCount: number;
  cookStepCount: number;
  serveStepCount: number;
  totalDurationText: string | null;
}

interface RecipeAssistantSnapshot {
  generatedAt: IsoDateTime;
  summary: RecipeAssistantSummary;
  steps: RecipeAssistantStep[];
}

interface RecipeDraftContentInput {
  name: string;
  story: string | null;
  categoryId: ResourceId | null;
  sceneIds: ResourceId[];
  coverUploadId: ResourceId | null;
  coverImageUrl: string | null;
  baseServings: number | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  tips: string | null;
  ingredients: Array<{
    ingredientId: ResourceId | null;
    name: string;
    quantity: string;
    unitId: ResourceId | null;
    fuzzyText: "适量" | "少许" | "按需" | null;
    categoryId: ResourceId | null;
    defaultUnitId: ResourceId | null;
    source: "SYSTEM" | "PERSONAL" | null;
  }>;
  steps: Array<{
    slotKey: string;
    text: string;
    uploadId: ResourceId | null;
    imageUrl: string | null;
  }>;
}
```

保存草稿时仅强制校验 `content.name` 非空；其余发布必填项允许暂时为空。草稿里的分类、场景、食材和单位引用即使当前已失效，也不阻塞保存，原始输入继续保留在 `content` 里；详情里的 `category / scenes / ingredientRefs / unitRefs` 只回填当前仍能解析到的真实引用。发布时再统一校验名称、有效个人分类、`1～20` 人份、已选择难度、已选择时长、至少一个有效食材、精确用量必须同时具备正数数量和单位，以及至少一个“文本或图片至少其一非空”的步骤。食材和步骤各最多 100 项；精确数量使用最多三位小数的十进制字符串。

菜谱图片的当前链路固定为：

1. 编辑阶段图片只保留在小程序本地缓存，不写服务端。
2. 本地图片在进入上传链路前，先经过客户端裁剪页处理：封面固定 `4:3`，步骤图自由裁剪；两者都在客户端导出受控宽高、质量后的本地文件。
3. 用户点击“存草稿”或“发布”时，若还没有 `draftId`，先创建草稿。
4. 前端随后调用 `POST /uploads/images` 逐张上传本地图片，服务端在草稿临时区创建或替换同一 `slotKey` 的图片。
5. 上传成功后，前端再把 `coverUploadId / coverImageUrl / steps[].uploadId / steps[].imageUrl` 写回草稿正文。
6. 发布时服务端把当前草稿引用的临时图片正式绑定到发布版本；已发布旧版本继续保留自己已引用的图片，不因新版本替换而删掉。

`slotKey` 是草稿步骤图片的稳定槽位键。封面固定使用 `cover`；步骤图由客户端为每一步生成稳定 `slotKey`，重复替换图片时必须沿用同一个键，服务端才会把旧临时图按槽位覆盖。

```ts
interface CreateRecipeDraftRequest {
  recipeId: ResourceId | null;
  content: RecipeDraftContentInput;
}

interface UpdateRecipeDraftRequest {
  expectedVersion: number;
  content: RecipeDraftContentInput;
}

interface PublishRecipeDraftRequest {
  expectedVersion: number;
}

interface UploadRecipeImageRequest {
  draftId: ResourceId;
  scene: UploadAssetScene;
  slotKey: string;
  file: binary;
}

interface ReorderItem {
  id: ResourceId;
  expectedVersion: number;
}

interface ReorderRecipesRequest {
  categoryId: ResourceId;
  items: ReorderItem[];
}

interface RecipeDraftSummary {
  id: ResourceId;
  recipeId: ResourceId | null;
  title: string | null;
  coverImageUrl: string | null;
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

`GET /recipe-drafts` 的摘要补充 `coverImageUrl`，用于草稿箱列表优先显示当前草稿封面；`POST /recipe-drafts` 与 `PUT /recipe-drafts/{draftId}` 返回 `SaveRecipeDraftResponse`，不再复用 `RecipeDraftDetail`。`GET /recipe-drafts/{draftId}` 继续返回完整 `RecipeDraftDetail`，供编辑页补齐历史食材和历史单位引用。

分类和场景重排提交完整作用域的 `ReorderItem[]`，分类内菜谱重排提交 `ReorderRecipesRequest`。三者都不得缺失、重复或混入越权 ID。服务端锁定最小作用域并逐项比较版本，冲突返回 `409`。

```ts
interface MyRecipeSummary {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  difficultyText: string | null;
  durationText: string | null;
  category: { id: UUID; name: string; version: number };
  version: number;
  updatedAt: IsoDateTime;
}

interface MyRecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  difficultyText: string | null;
  durationText: string | null;
  category: RecipeCategorySummary;
  inspirationCategory: InspirationCategorySummary | null;
  scenes: RecipeSceneSummary[];
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  assistant: RecipeAssistantSnapshot | null;
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
  difficultyText: string | null;
  durationText: string | null;
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
  difficultyText: string | null;
  durationText: string | null;
  category: InspirationCategorySummary;
  scenes: RecipeSceneSummary[];
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  assistant: RecipeAssistantSnapshot | null;
  collectedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface SaveCollectionRecipeRequest {
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
  difficultyText: string | null;
  durationText: string | null;
  category: InspirationCategorySummary;
  likeCount: number;
  collectCount: number;
  updatedAt: IsoDateTime;
}

interface InspirationRecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  difficultyText: string | null;
  durationText: string | null;
  category: InspirationCategorySummary;
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  assistant: RecipeAssistantSnapshot | null;
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

`assistant` 是固定菜谱版本附属快照，允许为 `null`。前台进入单菜做饭模式时默认优先展示 `assistant.steps`，只有快照不存在或步骤为空时才回退到 `content.steps`；步骤图片继续直接引用原始步骤图片，不复制资源。

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
POST /ingredients/{ingredientId}/feedbacks
GET /ingredient-recommendations
GET /units
POST /units
GET /unit-recommendations
GET/POST /recipe-drafts
GET/PUT /recipe-drafts/{draftId}
POST /recipe-drafts/{draftId}/delete
POST /recipe-drafts/{draftId}/publish
POST /uploads/images
GET /recipes
POST /recipes/from-inspiration
GET /recipes/{recipeId}
POST /recipes/{recipeId}/assistant
POST /recipes/reorder
POST /recipes/{recipeId}/delete
```

`GET /recipes` 只返回本人已发布私房菜，支持分页、关键词、个人分类、系统分类、难度和时长筛选。查询参数为 `page`、`pageSize`、`keyword`、`categoryId`、`inspirationCategoryId`、`difficulty` 和 `duration`。私房菜固定按个人分类顺序、更新时间返回，不提供灵感专属的推荐/最新排序。新建和编辑正文统一经过草稿发布，系统分类可由用户在高级设置中选择。`POST /recipes/{recipeId}/assistant` 只对本人已发布私房菜开放，且请求头必须带 `Idempotency-Key`：若当前固定版本已经有助理快照，则直接返回现有结果；若没有，则仅会员可触发首次生成并固化到该 `contentVersionId`。免费用户调用返回权限错误，但仍可继续读取原始步骤和做饭模式降级链路。

调用方不要再使用以下旧路径或旧参数：

```text
GET /recipes?scope=system
GET /recipes?scope=mine
POST /recipes/{recipeId}/import
```

当前现行链路固定为：

```text
GET /inspiration-recipes
POST /recipe-drafts
POST /recipe-drafts/{draftId}/publish
POST /recipes/from-inspiration
GET /recipes
POST /recipes/{recipeId}/recommendations
```

写接口的幂等键统一通过请求头 `Idempotency-Key` 传递，请求体不再出现 `operationId` 字段。例如：

```text
POST /recipe-drafts
Idempotency-Key: 172251000001
```

```json
{
  "recipeId": null,
  "content": {
    "name": "番茄炒蛋",
    "story": null,
    "categoryId": 1,
    "inspirationCategoryId": 2,
    "sceneIds": [1],
    "coverUploadId": null,
    "coverImageUrl": null,
    "baseServings": 2,
    "difficulty": "EASY",
    "duration": "WITHIN_15",
    "tips": "番茄最后下锅",
    "ingredients": [
      {
        "ingredientId": 4001,
        "amount": {
          "kind": "FUZZY",
          "text": "适量"
        }
      }
    ],
    "steps": [
      {
        "slotKey": "step-1",
        "text": "热锅下油后翻炒",
        "uploadId": null,
        "imageUrl": null
      }
    ]
  }
}
```

上传菜谱图片使用 multipart：

```text
POST /uploads/images
Idempotency-Key: 172251000002
Content-Type: multipart/form-data
```

表单字段固定为：

```text
draftId: 123
scene: RECIPE_COVER | RECIPE_STEP
slotKey: cover | step-1 | ...
file: <binary>
```

合集接口仍保留为历史兼容路径，不再出现在当前菜谱页面、创建编辑流程或加入计划 Sheet 中；新功能统一使用私房菜和灵感链路。已有固定引用继续按原版本读取，避免删除合集数据造成历史计划或饭局失效。

匿名灵感读取路径冻结为：

```text
GET /inspiration-categories
GET /inspiration-recipes
GET /inspiration-recipes/{recipeId}
```

`GET /inspiration-recipes` 支持 `page`、`pageSize`、`keyword`、`categoryId`、`sort`、`difficulty` 和 `duration`。`sort` 只允许 `RECOMMENDED` 或 `LATEST`，`duration` 只允许 `WITHIN_15 / BETWEEN_15_30 / BETWEEN_30_60 / OVER_60`。匿名只返回审核通过且允许曝光的固定版本，不返回个人持有、额度、分类、场景或可写状态。当前灵感口径同时覆盖平台直接创建的系统菜谱，以及后台审核通过后复制进系统库的用户推荐菜谱；后者详情页额外返回 `curatedByName`，仅用于展示 `由某某整理` 的昵称快照，不跳用户主页。`GET /inspiration-recipes/{recipeId}` 在请求带有效用户 token 时，还会额外返回 `ownedRecipeId`：当前用户已持有该灵感固定版本对应的有效私房菜时返回个人菜谱 ID，否则返回 `null`，供详情页直接把主按钮切到“加入计划”。点赞和推荐排序接口后续独立冻结。

历史合集主事实仍按“同一用户 + 同一灵感固定版本最多一条收藏记录”读取，但不再提供新的前台写入口。新建或编辑私房菜只维护个人分类和可选系统分类；来源固定版本仍用于系统侧治理、计划和历史引用。

后台只读查询本轮新增：

```text
GET /admin/users/{userId}/recipe-domain
GET /admin/users/{userId}/recipes
GET /admin/users/{userId}/recipe-drafts
GET /admin/users/{userId}/collections
GET /admin/users/{userId}/collections/{sceneId}/recipes
```

`GET /admin/users/{userId}/recipe-domain` 返回用户菜谱域概览；`/recipes` 与 `/recipe-drafts` 继续返回分页摘要；历史 `/collections` 路径仍返回该用户合集场景摘要，供旧固定引用治理。后台本轮只读，不返回编辑、发布、移出合集或改场景入口。

`GET /ingredient-categories` 只返回系统食材正式分类的最小摘要 `id + name`，隐藏兜底分类 `待归类` 不下发给前台录入入口。`GET /ingredients` 支持 `page`、`pageSize`、`keyword`、`categoryId` 和 `source`。`source` 只允许 `SYSTEM`、`PERSONAL` 或 `ALL`，其中 `SYSTEM` 和 `ALL` 都只返回当前启用中且分类可选的系统食材，`PERSONAL` 只返回本人仍可直接使用的个人食材，不返回已归并条目；当请求命中“全部食材”口径时，系统食材部分按后台全局展示顺序返回；当传了真实 `categoryId` 时，系统食材仍按该分类内顺序返回。食材摘要新增 `imageUrl`，仅系统食材在后台已补图时返回可读图片地址，个人食材固定返回 `null`；同时新增 `recommendationStatus`，当前只返回 `PENDING | REJECTED | null`，用于“我的食材”选择态最小展示 `审核中 / 拒绝后隐藏推荐入口`。`POST /ingredients` 新建一个个人食材，并在创建时拦截与现有系统食材重名的重复项，包括已下架但仍保留治理身份的系统食材；同时禁止使用隐藏兜底分类。`PUT /ingredients/{ingredientId}` 只允许编辑本人未处于审核中的个人食材，并继续禁止切到隐藏兜底分类。`POST /ingredients/{ingredientId}/recommendations` 是显式推荐入口：若系统库已存在启用中的同名食材，则服务端直接归并并生成一条“已归并”记录；否则进入待审核队列。`POST /ingredients/{ingredientId}/feedbacks` 是系统食材纠错入口，只允许对当前可用系统食材提交，请求体固定提交 `name + categoryId + note?`，并要求“名字、分类、备注”至少有一项真正发生变化；同一用户对同一系统食材同一时间只允许保留一条 `PENDING` 纠错。成功后返回 `IngredientFeedbackResult`，前台只做成功提示，不在当前页展开审核态。`GET /ingredient-recommendations` 分页返回“我的推荐”记录，用于显示 `审核中 / 已拒绝 / 已收录 / 已归并`；当状态为 `REJECTED` 时，响应额外返回 `reviewNote + reviewAdvice`，分别承载后台拒绝原因和修改建议。`GET /units` 支持 `page`、`pageSize`、`keyword`、`type` 和 `source`，当前前台常规入口只展示系统单位。`POST /units` 不再创建个人单位，而是提交一条单位建议；若系统库已存在同名系统单位，则服务端直接归并并生成一条 `MERGED` 记录，否则进入待审核队列。`GET /unit-recommendations` 分页返回“我的单位建议”记录，用于显示 `审核中 / 已拒绝 / 已收录 / 已归并`；当状态为 `REJECTED` 时，同样返回 `reviewNote + reviewAdvice`。`GET /recipe-drafts` 只返回本人草稿箱，查询参数为 `page`、`pageSize` 和 `keyword`；`GET /recipes`、`GET /inspiration-recipes`、`GET /collections/recipes` 与它统一使用同一搜索语义，`keyword` 都按 `菜名 + 故事 + 食材名` 匹配，其中合集基于已收藏固定版本正文检索。`POST /recipe-drafts` 与 `PUT /recipe-drafts/{draftId}` 只返回最小保存结果 `id + recipeId + version + updatedAt`。`GET /recipe-drafts/{draftId}` 与 `GET /recipes/{recipeId}` 额外返回当前内容实际引用到的 `ingredientRefs`、`unitRefs`，用于编辑页补齐超出首屏分页的历史食材与单位；其中 `ingredientRefs.defaultUnit` 只表示食材默认单位，不等于正文里所有真实 `unitId`，因此详情接口仍需单独返回 `unitRefs`。`POST /recipes/from-inspiration` 是灵感详情的显式“添加到我的”入口：请求体固定提交 `sourceRecipeId / sourceVersionId / categoryId / sceneIds`，其中 `categoryId` 必填，`sceneIds` 可为空数组；服务端直接把当前灵感固定版本加入“我的”，不先创建草稿，也不要求客户端跳转编辑页。若同一用户已持有同一 `sourceVersionId` 的有效“我的”菜谱，本轮直接返回已有入口，不再额外创建第二条。`POST /recipes/{recipeId}/recommendations` 是显式“推荐到灵感”入口：只允许本人对当前已发布个人菜谱提交当前固定正文版本，请求体只提交建议系统分类 `inspirationCategoryId`；服务端创建独立推荐记录，并把 `GET /recipes/{recipeId}` 的 `recommendation` 字段更新为最新推荐摘要。审核中时，该个人菜谱不允许继续创建编辑草稿、发布编辑草稿或删除，保证后台审核的固定内容不漂移；用户可通过 `POST /recipe-recommendations/{recommendationId}/withdraw` 撤回待审推荐，撤回后恢复可编辑/可删除。若该个人菜谱最初来自灵感菜谱升级为“我的”，且当前正文与封面仍与当时来源版本完全一致，服务端直接拒绝推荐，不允许把未改动的灵感菜谱再次作为个人投稿提交；对于历史上还没有来源快照的旧个人菜谱，服务端会按“是否与现有系统菜谱的正文和封面完全一致”做同样的识别与拦截。后台审核通过后，服务端复制一份 `sourceVersionId` 指向的固定正文到系统菜谱，新建 `ownerId = null`、挂系统分类的系统菜谱，并把审核通过时的昵称快照写入 `curatedByName`；原个人菜谱继续保留在“我的”下，不被替换或删除。

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
