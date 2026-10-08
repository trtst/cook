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

路径中的资源 ID 使用正整数，格式错误统一返回业务 `code=400`。`inviteToken`、`shareToken` 和 `Idempotency-Key` 等不透明凭证不是资源 ID，不使用资源 ID 校验。存在覆盖风险的写操作提交 `expectedVersion`；服务端锁定资源后比较当前版本，不一致返回业务 `code=409`，客户端刷新详情后再决定是否重试。

当前 ID 规则：用户公开 `uid` 为服务端随机生成的唯一 8 位数字；菜谱、菜谱正文版本、食材以及个人分类/场景从 `10000000` 起递增；系统单位、系统食材分类、系统菜谱分类分别从 `3001`、`5001`、`6001` 起递增。菜谱、食材不按系统、个人或改编来源拆分 ID 段。`Recipe.id` 在菜谱修改后保持不变，正文修改时只新建不可变的 `RecipeContentVersion.id`；正文版本 ID 仅供接口和数据库关联使用，不在前台展示，也不拼接为组合编号。

OpenAPI 的成功响应必须描述完整统一 envelope 和具体 `data` schema；对象、数组和分页响应不得退化为无字段的 `object`。本文、服务端 OpenAPI 和各应用本地类型共同变更，不直接复用 Prisma Model。

请求 DTO 使用严格白名单：请求体或查询参数包含未声明字段时返回业务 `code=400`，不静默忽略旧字段。嵌套对象必须递归校验。菜谱食材最多 100 项，用户私房菜步骤最多 20 项；批量消耗冰箱条目最多 100 个且不允许空数组或重复 ID。

## 鉴权

| 鉴权 | 用途 |
| --- | --- |
| `UserBearerAuth` | 小程序用户接口 |
| `AdminBearerAuth` | 后台管理接口 |

两种 token 不得混用。任何鉴权接口返回业务 `code=401` 时，客户端清理 session 和用户级缓存。

## 错误规则

业务接口成功进入服务端处理后，无论成功或可预期业务失败，HTTP 状态统一为 `200`，调用方只按返回体 `code` 判断业务结果。HTTP 非 2xx 只用于路由未命中、协议、网关、网络或未捕获系统异常，不承载业务语义。

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

interface AuthSessionUser extends SessionUser {
  phone: string | null;
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

interface MeResponse {
  avatarUrl: string | null;
  hasPassword: boolean;
  display: UserDisplay;
  membership: UserMembership;
}

interface NotificationMealTimes {
  breakfast: string;
  lunch: string;
  afternoonTea: string;
  dinner: string;
  lateNight: string;
}

interface NotificationSettings {
  meal: {
    enabled: boolean;
    times: NotificationMealTimes;
  };
  recommend: {
    enabled: boolean;
  };
}

interface NotificationBadgeResponse {
  unreadCount: number;
  latestTime: IsoDateTime | "";
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

登录成功响应里的 `AuthSessionUser.phone`、`/auth/me` 和后台 `UserProfile.phone` 当前统一返回脱敏手机号，格式如 `138xxxxx000`。页面展示可以直接使用返回值，但不能再把响应里的手机号当作可回填的明文表单值。手机号绑定或换绑成功后，客户端必须刷新认证身份摘要并同步本地 session。登录密码只服务于手机号密码登录，未绑定手机号的账号不能设置或修改登录密码。`MeResponse.hasPassword` 只表示当前账号是否已设置登录密码，用于账号设置展示“设置密码 / 修改密码”，不返回密码哈希或密码策略内部信息。`/users/me` 不再返回 `uid / nickname / phone`，这些登录身份摘要只来自登录成功、refresh 后的认证会话或 `/auth/me`。

`uid` 是非连续公开用户号，不是主键，不能用来推算注册量。
用户侧接口默认不返回 `User.id` 这类数据库内部主键；空间等业务对象如果前端需要定位，保留业务对象自身 id。

## 权益与空间 DTO

```ts
type EntitlementTier = "FREE" | "PLUS" | "PRO" | "ULTRA";
type RelationshipState = "NORMAL" | "OVER_MEMBER_LIMIT";
interface EffectiveImagePolicy {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  maxOutputBytes: number;
  maxInputBytes: number;
}

```

会员事实归属 `/users/me`。`/storage-usage` 暂时保留路径并返回业务 `code=503`；已下线的饭搭子接口不再参与当前客户端契约，客户端不得自行拼出全局权益快照。

## 当前已实现接口

### Auth 与 User

```text
POST /auth/wechat/bind
POST /auth/sms/send
POST /auth/sms/login
POST /auth/password/login
POST /auth/password/set
POST /auth/password/change
POST /auth/refresh
POST /auth/logout
GET  /auth/me
GET  /app-config
GET  /home-entries
GET  /home/recent-arrangement
GET  /users/me
GET  /users/me/medals
GET  /users/me/notification-settings
GET  /users/me/notification-badge
GET  /users/me/notification-feed
PUT  /users/me/profile
PUT  /users/me/notification-settings
PUT  /users/me/notification-badge-seen
PUT  /users/me/notification-read
PUT  /users/me/notification-feed-read
POST /membership-codes/redeem
PUT  /users/me/display
PUT  /users/me/password
POST /users/me/avatar
POST /users/me/phone/bind
POST /users/me/phone/change-current-code
POST /users/me/phone/change-start
POST /users/me/phone/change-new-code
POST /users/me/phone/change-complete
```

```ts
interface AuthWechatBindRequest {
  code: string;
  deviceId: string;
}

interface SmsSendRequest {
  phone: string;
  scene: "LOGIN";
  deviceId: string;
}

interface SmsLoginRequest {
  phone: string;
  code: string;
  deviceId: string;
}

interface PasswordLoginRequest {
  phone: string;
  password: string;
  deviceId: string;
}

// 写入密码统一要求 8-20 位，且至少包含字母、数字、符号中的任意两类。
interface SetPasswordRequest {
  password: string;
}

interface ChangePasswordRequest {
  currentPassword?: string;
  newPassword: string;
}

interface RefreshSessionRequest {
  refreshToken: string;
  deviceId: string;
}

interface LogoutSessionRequest extends RefreshSessionRequest {}

type LogoutSessionResult = null;

interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: IsoDateTime;
  refreshExpiresAt: IsoDateTime;
  user: AuthSessionUser;
}

interface AuthWechatBindResult {
  wechatLinked: true;
}

interface SmsSendResult {
  cooldownSeconds: number;
}

interface ChangePasswordResult {
  changedAt: IsoDateTime;
}

interface PhoneCodeSendRequest {
  phone: string;
  deviceId: string;
}

interface NewPhoneCodeSendRequest extends PhoneCodeSendRequest {
  changeToken: string;
}

interface StartPhoneChangeRequest {
  phone: string;
  code: string;
}

interface StartPhoneChangeResult {
  changeToken: string;
}

interface CompletePhoneChangeRequest {
  changeToken: string;
  phone: string;
  code: string;
}

旧的 `/auth/login`、`/auth/code-send`、`/auth/code-login` 和 `/auth/wechat-login` 已从当前实现移除，不提供兼容别名。登录短信验证码只支持 `scene="LOGIN"`；换绑手机号使用用户域专用接口和 `PHONE_CHANGE` 服务端场景，不复用登录路径。

小程序只使用短信验证码或手机号密码建立炊火记账号会话。登录成功后，客户端查询 `/auth/me.wechatLinked`；未关联时调用 `wx.login / uni.login` 获取一次性 `code`，并携带当前账号 Bearer token 提交 `/auth/wechat/bind`。服务端通过微信 `code2session` 获取当前小程序 `openid`，将身份唯一关联到当前账号；响应只返回 `wechatLinked=true`，不返回 `openid / unionid / session_key`。绑定失败不会撤销账号登录，详情页点击微信提醒时会重新检查关联并尝试补绑，成功后再发起订阅授权。未登录启动不会调用微信身份接口，也不会静默建立会话。

`/auth/logout` 吊销 refresh token，成功时 `data=null`；`/auth/refresh` 每次轮换 refresh token。refresh token 仅以哈希形式落库，微信 `session_key` 仅在服务端短期使用并以哈希形式保存。

interface AuthMeResponse extends SessionUser {
  id: UUID;
  phone: string | null;
  hasPassword: boolean;
  status: "ACTIVE" | "DISABLED";
  wechatLinked: boolean;
}

interface AppConfigResponse {
  login: {
    imageUrl: string | null;
  };
  cookAssistant: {
    activityEnabled: boolean;
    startsAt: IsoDateTime | null;
    endsAt: IsoDateTime | null;
    timeZone: string;
    dailyUnlockLimit: number;
    tipText: string;
  };
}

type HomeEntryPlacement = "QUICK_1" | "QUICK_2" | "QUICK_3" | "QUICK_4";
type HomeEntryTargetType = "PAGE" | "WEB_VIEW";
type HomeEntryStatus = "LISTED" | "UNLISTED";
type HomeRecentArrangementStatus =
  | "EMPTY_MENU"
  | "PENDING_CONFIRM"
  | "PENDING_SHOPPING"
  | "READY_TO_COOK"
  | "TIME_UP_SHARE";

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

interface HomeRecentArrangement {
  sourceType: "PLAN" | "EVENT";
  planItemId: UUID;
  planDate: string;
  eventId: UUID | null;
  title: string;
  scheduledAt: IsoDateTime | null;
  participantCount: number;
  menuCount: number;
  gapCount: number | null;
  status: HomeRecentArrangementStatus;
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

interface UpdateNotificationSettingsRequest extends NotificationSettings {}

interface ChangeCurrentPasswordRequest {
  currentPassword?: string;
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

`GET /users/me/notification-settings` 只返回当前登录用户自己的提醒偏好：餐次提醒、推荐提醒，以及餐次默认时间。餐次与推荐提醒开关目前只保存用户偏好，不代表已启用微信订阅消息发送；当前没有对应发送任务。

`PUT /users/me/notification-settings` 完整替换当前用户的提醒偏好，请求体固定提交完整 `NotificationSettings`。服务端校验布尔值和餐次时间格式；前台当前只开放两个提醒开关，不提供餐次具体时钟编辑。前端不再以本地 `storage` 作为权威来源。

`GET /users/me/notification-badge` 只返回当前用户通知中心入口的聚合未读事实：`unreadCount / latestTime`。该接口由服务端统一聚合当前真实来源，不新增独立消息表，也不要求客户端再并发多个业务接口自行计算未读。`unreadCount` 与通知流卡片的 `isUnread` 共用 `feedReadAt` 和单条消息版本已读事实。

`GET /users/me/notification-feed` 返回当前登录用户自己的通知中心统一时间流分页列表，查询参数固定为 `page + pageSize`，`page` 为 1–50，`pageSize` 为 1–100；第 50 页后 `hasNext` 为 `false`，限制多源合并和排序的最大读取量。服务端继续复用真实来源，不新增独立消息表，但由服务端统一完成多源读取、混排和倒序分页；当前承接食材/单位推荐、菜谱推荐审核、系统食材纠错、菜谱举报处理、购物清单协作、官方消息和菜谱 Wiki。审核来源按真实记录状态生成消息，审核结果更新后形成新的未读消息版本；拒绝或处理备注随消息展示。举报处理消息只返回给举报人。餐次与推荐提醒不是通知流消息，也不会由此接口触发微信发送。首页周计划状态摘要不得合成通知中心消息。每条消息统一返回 `id / isUnread / typeLabel / tone / title / desc / timeValue / targetPath`，其中 `timeValue` 作为时间倒序排序依据，`isUnread` 只服务通知中心内的弱标识，`targetPath` 为空时表示只读消息。客户端通知中心首页只消费这一接口，不再自行按类型并发请求后本地混排。

`PUT /users/me/notification-badge-seen` 在进入通知中心时确认当前通知流，和卡片未读状态共用同一条总已读游标：服务端将进入时已有消息推进为已读并返回 `NotificationBadgeResponse`，客户端同步清理当前列表中的未读点；进入期间新到达的消息不受影响。`PUT /users/me/notification-read` 接收 `notificationId + notificationTime`，服务端校验该消息当前仍属于调用用户且版本时间一致后，写入该用户对这一消息版本的单条已读事实，并同步影响入口未读数。`PUT /users/me/notification-feed-read` 接收进入页面时取得的 `beforeTime`；离开通知中心时，服务端仅把不晚于该边界的卡片写入同一条总已读游标，不会清掉用户停留期间新到达的通知。三个写接口均要求 `Idempotency-Key`；它们只执行单调推进或同键 upsert，因此重复请求不会重复改变通知状态。入口徽标、单条卡片和离页批量已读均以服务端状态为准，客户端本地 storage 只保存最新入口徽标快照。

`PUT /users/me/password` 修改当前登录用户的手机号账号密码，必须携带 `Idempotency-Key`。若当前账号尚未设置密码，请求只提交 `newPassword`；若当前账号已设置密码，请求必须同时提交 `currentPassword` 和 `newPassword`。前端可以先做一致性和强度提示，但服务端仍必须校验新密码长度和强度。新密码统一要求 8-20 位字符，且至少包含字母、数字、符号中的任意两类；`currentPassword` 只用于校验已有密码哈希，不按新强度规则重新判断，避免存量密码阻断改密。

`POST /users/me/phone/bind` 仅用于当前账号尚未绑定手机号时绑定手机号，提交手机号和登录短信验证码，必须携带 `Idempotency-Key`。已绑定账号更换手机号必须走换绑流程：`change-current-code` 先按当前绑定手机号、短信频控和 30 天限制发送原手机号验证码；`change-start` 消费原手机号验证码并返回短期 `changeToken`，必须携带 `Idempotency-Key`；`change-new-code` 提交 `changeToken` 后发送新手机号验证码；`change-complete` 提交 `changeToken`、新手机号和新验证码，必须携带 `Idempotency-Key`，在事务内完成唯一性校验、换绑、换绑时间记录和审计。一个账号 30 天内只能更换一次手机号。

`POST /auth/wechat/bind` 仅允许当前登录用户调用，请求体为微信登录 code 与设备 ID。服务端调用微信 `code2session`，在事务内按 `appid + openid` 唯一性将身份关联到当前账号，只保存提醒所需的 AppID 与 OpenID；如果该 OpenID 已属于其他站内账号则返回业务 `code=400`，不自动合并账号。微信配置缺失或微信侧不可达时返回业务 `code=503`；微信 code 无效时返回业务 `code=400`，不暴露外部凭据。`GET /auth/me` 返回 `wechatLinked`，只表示当前账号是否关联本小程序身份，不返回 OpenID。

`POST /auth/sms/send` 和 `POST /auth/sms/login` 是手机号短信登录链路。发码请求固定为 `phone + scene=LOGIN + deviceId`，由服务端调用真实短信认证 provider；当前个人资质阶段使用阿里云号码认证服务 PNVS 短信认证，验证码由平台生成并由平台核验。验证码有效期为 5 分钟、60 秒冷却、只能消费一次，并按手机号 / IP / 设备做频控；服务端不保存明文验证码，只保存发送挑战流水、过期时间、消费状态、IP 和设备事实。短信登录成功后按手机号创建或复用账号，不承担微信身份绑定。短信验证码登录错误和密码登录错误共同进入登录失败风控：同一手机号、IP 或设备在 10 分钟内连续 3 次登录失败时限制登录 1 分钟；1 分钟内累计失败超过 10 次时限制登录 10 分钟；成功登录后清除该手机号、IP 和设备的连续失败计数。风控限制返回业务 `code=429` 和 `retryAfterSeconds`。

`POST /auth/password/login` 使用 `phone + password + deviceId` 登录，不消耗短信或微信手机号授权额度，但仍受账号安全风控限制。`POST /auth/password/set` 为当前账号设置初始密码，`POST /auth/password/change` 修改当前密码；设置初始密码和修改新密码均执行 8-20 位、字母 / 数字 / 符号任意两类的统一强度规则，登录密码本身只做哈希比对和登录失败风控。密码只以哈希形式保存。上述登录方式最终都签发统一的 `accessToken + refreshToken` 会话。

`GET /app-config` 只返回公开启动配置。`login.imageUrl` 由后台维护登录弹窗背景图；登录图公开 URL 使用真实静态对象路径，未配置静态域名时为 `/static/uploads/admin/login-image/login-image.{ext}`，配置 `ASSET_PUBLIC_BASE_URL` 时为静态域名下的 `/uploads/admin/login-image/login-image.{ext}`。接口失败、字段为空、图片失效时，客户端回退本地图。`cookAssistant` 只承接活动是否开放、起止时间、服务端日界时区、每日首次解锁上限和顶部 Tips 文案，不返回任何用户态用量或会员结论；个人当日用量必须读取 `GET /users/me/cook-assistant-usage`。除这两类公开配置外，本接口不得混入权限、会员、饭搭子或展示背景配置。

`GET /home-entries` 只返回首页快捷入口四宫格中当前 `LISTED` 的入口，`placement` 仅允许 `QUICK_1 ... QUICK_4`。响应字段为 `placement + title + subtitle + targetType + targetValue + imageUrl + badgeText`；`targetType` 当前只允许 `PAGE` 和 `WEB_VIEW` 两种，站内页面从后台白名单选择，外链必须以 `https://` 开头。首屏三卡和顶部 hero 内容由客户端展示，不属于该接口或后台首页入口配置；右侧固定卡片分别使用“本周灵感｜这周吃点不一样”和“餐桌话题｜看看最近吃什么”。

`GET /home/week-overview` 只服务首页左侧“这周吃饭安排”状态聚合主卡，职责上与 `GET /home-entries`、`GET /home/recent-arrangement` 分离。它返回当前登录用户首页主卡真正需要的最小摘要：`status + title + summary + actionText + targetType + targetValue + notificationTime + plannedDayCount + totalDayCount + activeListCount + expiringCount + arrangement + days[]`。其中 `status` 只允许 `NO_ARRANGEMENT / EMPTY_MENU / PENDING_CONFIRM / PENDING_SHOPPING / READY_TO_COOK / COMPLETED`；`targetType` 当前固定为 `PAGE`，`targetValue` 由服务端按当前最值得处理的状态给出真实落地页；`notificationTime` 是给通知中心排序和已读游标对齐用的服务端时间，不要求首页卡片直接展示；`plannedDayCount` 与 `days[]` 只覆盖从今天起未来 `7` 天的轻量周视图，不扩成完整计划详情；`arrangement` 复用现有首页最近安排最小摘要，供主卡在存在近期餐次时显示更具体的时间与状态。该接口不得返回完整菜单、购物清单明细、冰箱明细、参与人 UID、运营样式或通用任务流字段；首页左侧主卡点击后只跳转到真实页面继续处理，不在首页直接写入。

`GET /home/fridge-recipes?page=1` 只服务首页“按冰箱食材”菜谱区，要求登录，并基于近期明确标记为“有”的食材痕迹与可访问菜谱做最小匹配；超过食材展示窗口的记录不参与匹配。服务端只返回首页卡片需要的菜谱摘要、匹配数量、缺失数量、`fridgeFit` 和 `hasNext`，不返回数量、单位换算结果或采购缺口决策。每次按稳定推荐顺序返回最多 `3` 个候选；客户端首页每屏展示当前响应中的菜谱，点击“换一换”时请求下一页，候选用尽后从第 `1` 页重新开始。加载期间显示三张菜谱 skeleton，成功后整体替换为本次响应。

`GET /home/recent-arrangement` 只服务首页“最近安排”条件卡，和 `GET /home-entries` 的运营入口配置职责分离。它只返回当前登录用户最近一顿、且还有下一步动作的计划或饭局摘要；若当前没有符合窗口与权限条件的候选，则返回 `data = null`。候选窗口固定为：先看未来 `24` 小时，若没有再补看未来 `24~36` 小时；在同一窗口内若同时存在饭局和计划候选，统一优先饭局，再按状态优先级 `TIME_UP_SHARE > READY_TO_COOK > PENDING_SHOPPING > PENDING_CONFIRM > EMPTY_MENU` 和离当前时间更近排序。接口最小只返回当前首页卡真正需要的字段：`sourceType + planItemId + planDate + eventId + title + scheduledAt + participantCount + menuCount + gapCount + status`。其中 `planDate` 用于客户端继续复用现有统一餐次详情页路由；`participantCount` 对饭局返回当前参与人数，对纯计划固定返回 `1`；`gapCount` 只有在当前服务端已存在可靠缺口事实时才返回数字，否则返回 `null`。该接口不得返回菜单明细、投票明细、冰箱明细、购物清单明细、参与人 UID、内部备注，也不直接返回首页按钮文案或跳转 URL；客户端根据 `status` 本地映射“去加菜 / 确认菜单 / 去采购 / 开始做饭 / 分享回忆”等主动作。

`GET /home-topics/current` 和 `GET /home-topics/{topicId}` 共同承接首页“本周灵感”专题页。公开读取只返回当前专题真正需要的最小数据：头图、标题、副标题、推荐类别、期数、寄语、本期推荐菜谱和往期专题摘要；不返回评论、打卡、主持人、收藏专题、互动人数或任何社区关系字段。只有 `LISTED` 状态的专题允许公开读取；`GET /home-topics/current` 返回最新一条已上架专题，不存在已上架专题时返回 `topic = null`；读取指定专题时若该专题不存在或未上架，统一返回业务 `code=404`。本期推荐菜谱固定只收平台灵感菜谱，摘要字段固定为 `id / sourceVersionId / sort / title / coverImageUrl / ownedRecipeId / difficulty / duration / category / collectCount / updatedAt`，其中 `sourceVersionId` 是当前专题卡片对应的固定正文版本 ID，供首页专题页直接走“添加到我的”写链路；`ownedRecipeId` 只在请求带有效用户 token 且当前用户已持有该灵感固定版本对应的有效“我的菜谱”时返回个人菜谱 ID，匿名或尚未持有时返回 `null`；`collectCount` 仅作为菜谱事实透传，不扩展为专题互动统计。往期专题当前按 `publishedAt desc` 排序，但只返回当前专题之后的更老已上架专题，避免查看较老专题时又回看到更新专题。

`GET /table-topics`、`GET /table-topics/{topicId}` 和 `POST /table-topics/{topicId}/participate` 共同承接首页“餐桌话题”。列表接口只返回当前列表卡真正需要的最小字段：`id / title / coverImageUrl / activityAt / participantCount`，并按 `activityAt desc, id desc` 倒序返回全部已上架话题。详情接口在列表摘要基础上补 `summary / joined / targetType / targetValue`；`joined` 只在请求带有效用户 token 且当前用户已经参与时返回 `true`，匿名或未参与时返回 `false`。详情页内的“查看活动详情”继续由 `targetType + targetValue` 承接：`PAGE` 表示站内页，`WEB_VIEW` 表示以 `https://` 开头的 H5 地址，`targetValue = null` 表示该期话题只用原生详情页承接。`POST /table-topics/{topicId}/participate` 要求登录，并按 `(topicId, userId)` 唯一事实去重；同一用户重复参与不再新增第二条记录，也不支持取消参与。未上架或不存在的话题统一返回业务 `code=404`。

`GET /users/me` 返回 `MeResponse`。该响应只承接账号设置、资料展示、展示能力和会员入口所需状态，不返回 `uid / nickname / phone`；登录身份摘要由 `AuthSessionResult.user` 承接。`MeResponse.profile` 返回当前用户可编辑资料：`cookNo / bio / gender / birthDate`。`cookNo` 是公开唯一炊火号，6-20 位，只允许字母、数字和下划线；新用户默认用公开 `uid` 字符串生成，存量用户由迁移回填。默认 `cookNo` 等于公开 `uid` 时允许首次设置为自定义值，设置为自定义值后只能重复提交相同值，不允许再次修改。`PUT /users/me/profile` 是轻量保存资料接口，每次字段编辑页只提交一个字段，允许 `nickname / cookNo / bio / gender / birthDate`，其中 `nickname` 为 2-24 个字符且不能包含 `@<>/`，`nickname / cookNo` 不接受 `null`，`bio` 最多 80 个字符且允许 `null`，`gender` 只允许 `MALE / FEMALE / UNSPECIFIED` 或 `null`，`birthDate` 使用 `YYYY-MM-DD`、不能晚于今天且年龄小于等于 14 岁时返回“未满14岁需实名认证”。资料保存成功只返回 `data = null`，客户端直接合并本次成功提交字段，不再为了保存结果额外请求 `/users/me`。`PUT /users/me/profile` 不接收 `avatarUrl`，避免绕过裁剪上传链路。头像由 `POST /users/me/avatar` 承接，客户端必须先按 1:1 裁剪，原图不超过 `2 MB`，再以 `multipart/form-data` 的 `file` 字段上传并携带 `Idempotency-Key`；服务端实际解码、应用 EXIF 方向并重编码，成品不超过 `150 KB`。服务端只接受 JPG、PNG、WEBP，成功后按公开 `uid` 生成头像对象路径，不在公开 URL 中使用内部用户 id，并写入当前用户 `avatarUrl`、只返回最终可展示的 `{ avatarUrl }`。当前用户背景图能力未开放，`display` 中两个 URL 固定为 `null`，两个 `canUse` 字段固定为 `false`。`PUT /users/me/display` 保留路径，但当前统一返回业务 `code=503`，不得通过 URL 绕过背景上传能力。`GET /users/me/medals` 返回当前用户勋章墙摘要，包含 `earnedCount / totalCount / categories / items`。`items` 当前按模板返回 `code / awardRule / iconKey / imageUrl / earnedImageUrl / lockedImageUrl / category / categoryName / name / description / condition / earnedUserCount / earned / isLimited / startAt / endAt / awardedAt`，不返回进度条、差几次或会员专属字段。客户端应优先按 `earned` 状态选择 `earnedImageUrl / lockedImageUrl`，`imageUrl` 仅作为已获得图兼容字段。

`POST /membership-codes/redeem` 只接受登录用户调用，必须携带 `Idempotency-Key`。请求体只收 `code`；服务端会在事务内完成单码锁定、SKU/批次开放校验、体验累计天数校验、正式码 30 天冷却校验、当前会员冲突校验、有效会员到账、单码置已用和审计。DTO/鉴权/限流均返回 HTTP `200`，并分别使用业务 `code=400 / 401 / 429`；可预期的兑换业务拒绝同样返回 HTTP `200` + 业务 `code/message`，其中正式码 30 天冷却返回 `code = 4601, message = "30天内仅可兑换一次"`，无效/停用/未上架/会员状态冲突/超过体验上限等其余内部原因统一收口为 `code = 4602, message = "兑换码无效或不可用"`。成功返回更新后的 `membership` 摘要和 `redeemedAt`。

### 关系功能下线说明

`/dining-groups*`、`/dining-group-members` 和 `/dining-group-invites*` 已从当前 API 装配中移除，不再作为现行前台或后台合同。后续协作主链路统一挂在饭局、购物清单分享和个人会员/空间事实上，不再新增饭搭子对外接口。

### 个人存储用量（暂未开放）

```text
GET /storage-usage
Auth: UserBearerAuth
```

该接口暂时保留路径并固定返回业务 `code=503`、`message="个人空间统计暂未开放"`、`data=null`。当前不计算图片或其他个人空间用量，不按空间额度拦截写入；客户端和后台不展示用户/会员空间大小。

### 后台管理

```text
POST /admin/auth/login
GET  /admin/dashboard/summary
GET  /admin/dashboard/trends
GET  /admin/material-images
POST /admin/material-images
DELETE /admin/material-images/{imageId}
GET  /admin/users
POST /admin/users
PUT  /admin/users/{userId}
POST /admin/users/{userId}/status
POST /admin/users/{userId}/reset-password
POST /admin/users/{userId}/phone/reveal
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
POST /admin/medal-templates/export
POST /admin/medal-templates/preview
POST /admin/medal-templates/import
POST /admin/medal-templates/swap-images
PUT  /admin/medal-templates/{templateId}
POST /admin/medal-templates/{templateId}/status
PUT  /admin/medal-templates/{templateId}/image/{imageType}
GET  /admin/ingredient-categories
POST /admin/ingredient-categories
PUT  /admin/ingredient-categories/{categoryId}
POST /admin/ingredient-categories/{categoryId}/status
DELETE /admin/ingredient-categories/{categoryId}
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
POST /admin/ingredients/{ingredientId}/merge
POST /admin/ingredients/{ingredientId}/image
DELETE /admin/ingredients/{ingredientId}/image
POST /admin/ingredients/reorder
GET  /admin/pending-ingredients
POST /admin/pending-ingredients/{ingredientId}/review
POST /admin/ingredient-import-jobs/json
GET  /admin/ingredient-import-jobs
GET  /admin/ingredient-import-jobs/{jobId}
DELETE /admin/ingredient-import-jobs/{jobId}
GET  /admin/ingredient-import-items/{itemId}
PUT  /admin/ingredient-import-items/{itemId}
POST /admin/ingredient-import-items/{itemId}/import
DELETE /admin/ingredient-import-items/{itemId}
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
GET  /admin/content/articles/calendar?month={month}
GET  /admin/content/{contentId}
POST /admin/content
PUT  /admin/content/{contentId}
POST /admin/content/{contentId}/status
POST /admin/content/{contentId}/schedule
DELETE /admin/content/{contentId}
POST /admin/content/images
GET  /static/uploads/material-store/{fileName}
GET  /site-contents/articles
GET  /site-contents/articles/{articleId}
POST /site-contents/articles/{articleId}/view
POST /site-contents/articles/{articleId}/like
DELETE /site-contents/articles/{articleId}/like
GET  /site-contents/official-messages
GET  /site-contents/official-messages/{contentId}
GET  /site-contents/resolve?path={path}
GET  /static/uploads/site-content-images/{fileName}
```

`GET /admin/dashboard/summary` 是后台首页只读摘要接口，只返回首页当前需要的计数，不混入分页列表、明细、趋势和策略对象。当前响应新增 `overview`，固定返回 `todayNewUsers / sevenDayNewUsers / totalUsers / openReportCount / pendingRecipeCount / pendingIngredientCount / todayRedeemedCount` 这组首页核心卡片数据；同时继续保留四组结构化统计：用户 `total / activeCount / disabledCount`，饭搭子 `total / activeCount / memberCount`，菜谱 `total / activeCount / blockedCount / recycledCount / openReportCount`，以及基础资料 `categoryCount / itemCount / unitCount`。其中 `memberCount` 继续沿用后台饭搭子列表的有效成员口径，只统计 `ACTIVE / RESTRICTED`。

`GET /admin/dashboard/trends` 是后台首页趋势图接口，只允许 `SUPER_ADMIN` 调用，查询参数固定为 `range=7D | 30D`，默认 `7D`。响应返回按日补齐的趋势点数组，每个点固定包含 `date / label / newUsers / totalUsers / openReportCount / pendingRecipeCount / pendingIngredientCount / membershipGeneratedCount / membershipRedeemedCount`，用于后台首页直接绘制轻量趋势图，不返回分页和明细列表。

`GET /admin/material-images`、`POST /admin/material-images` 和 `DELETE /admin/material-images/{imageId}` 共同维护后台图片素材库。该能力只允许 `SUPER_ADMIN` 使用，是运营素材库，不是用户头像、用户首页背景、菜谱草稿图、首页入口图或富文本图片的替代上传入口。图片对象固定写入独立静态资源目录 `uploads/material-store/`；生产环境使用 OSS driver 时，该目录对应 OSS 中的独立文件夹，用于存放杂乱运营素材，不在前台公开地址中暴露 `admin` 命名。上传请求必须带 `Idempotency-Key`，使用 multipart form-data 提交 `file + note`，`note` 为 1 到 120 字备注；单图大小上限 `8 MB`，只接受 `JPG / PNG / WEBP`，服务端读取真实宽高并限制最大 `4096x4096`。列表固定分页返回 `PageResult<AdminMaterialImageItem>`，每项包含 `id / imageUrl / note / contentType / sizeBytes / width / height / uploader / createdAt / updatedAt`，后台页面可复制 `imageUrl` 供前台页面配置粘贴使用。删除请求必须带 `Idempotency-Key`，服务端删除素材记录后删除对应对象存储文件；当前不做跨首页配置、文章、专题等业务引用保护，后台只提示“删除后已使用该地址的前台页面图片会失效”。公开读取走 `GET /static/uploads/material-store/{fileName}`。

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

interface AdminUserPhoneRevealResponse {
  phone: string | null;
}
```

后台 `POST /admin/users` 的 `password` 和 `POST /admin/users/{userId}/reset-password` 的 `newPassword` 必须执行与前台一致的写入密码规则：8-20 位字符，且至少包含字母、数字、符号中的任意两类。后台页面可以先做本地提示，但服务端仍必须在哈希前重新校验，避免后台创建或重置出弱密码。

```ts
interface AdminUserEntitlementResponse {
  user: Pick<UserProfile, "id" | "uid" | "nickname" | "avatarUrl" | "phone" | "status" | "cookNo" | "bio" | "gender" | "birthDate">;
  membership: UserMembership;
  display: Pick<UserDisplay, "canUseProfileBackground" | "canUseHomeBackground">;
  recipePolicy: { recipeLimit: number; recycleDays: number; variantLimitPerRoot: number };
  invitePolicy: { inviteLimit: number; memberLimit: number };
  imagePolicy: EffectiveImagePolicy;
}
```

后台 `GET /admin/users` 的用户摘要返回 `cookNo / bio / gender / birthDate`，列表页只展示炊火号，高频排查可按 `UID / 昵称 / 炊火号 / 手机号` 搜索。`AdminUserEntitlementResponse.user` 额外返回 `avatarUrl / cookNo / bio / gender / birthDate`，用于权益抽屉内的“个人资料”只读展示，不开放后台改个人资料入口。

`AdminUserEntitlementResponse.user.phone` 只返回脱敏手机号，用于后台权益抽屉默认展示。`POST /admin/users/{userId}/phone/reveal` 是后台完整手机号敏感读取接口，仅 `SUPER_ADMIN` 可调用；服务端每次调用都重新校验管理员实时状态和角色、校验目标用户存在、写入 `USER_PHONE_REVEALED` 审计事件，并且响应只返回 `{ phone }`。审计 payload 不记录完整手机号。后台页面点击“查看手机号”前必须二次确认，关闭抽屉后不得继续保留完整手机号状态。前台用户完成手机号换绑、后台管理员编辑用户手机号时均写入 `USER_PHONE_CHANGED` 审计事件，payload 只记录脱敏 `oldPhone / newPhone`，不得写入明文手机号。

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
POST /admin/content/{contentId}/schedule
POST /admin/content/images
GET  /site-contents/official-messages
GET  /site-contents/official-messages/{contentId}
GET  /site-contents/resolve?path={path}
GET  /static/uploads/site-content-images/{fileName}
```

这一组接口共同承接后台“内容治理”。栏目治理只服务站点内容栏目，不扩成通用分类中心。`GET /admin/content/channels` 固定返回分页 `PageResult<AdminSiteContentChannelSummary>`，支持按 `code` 模糊过滤；`POST /admin/content/channels` 要求 `Idempotency-Key`，创建时维护 `code / name / description / sortOrder`；`PUT /admin/content/channels/{channelId}` 也要求 `Idempotency-Key`，但只维护 `name / description / sortOrder`，并通过 `expectedVersion` 防并发覆盖，已创建栏目的 `code` 不支持修改。V1 后台“栏目配置”页面只展示和维护前台知识文章可用的 `KITCHEN / COOK / FOOD` 三个栏目，对应 `厨房百事 / 烹调技法 / 饮食文化`，不在运营入口继续开放新建栏目。

`GET /admin/content/pages` 固定返回 5 个受控官网固定页：`about / privacy / terms / product / faq`。这些固定页在服务端自动落种，后台只能编辑正文与展示信息，路径固定分别为 `/about / /privacy / /terms / /product / /faq`，不得新增第 6 个固定页，也不得改成其他路径。服务端同时自动保留受控栏目 `OFFICIAL_NOTICE`，专门承接系统官方消息，不额外新建消息表。

隐私政策 `/privacy` 与用户协议 `/terms` 在后台使用正文优先编辑模式：标题和路径保持固定，只编辑正文；摘要可提交空字符串，现有标签、栏目及其他展示字段随记录原值保留。编辑页预览只显示正文，不显示摘要、标签、头部说明或封面。此规则不适用于其他官网固定页和文章。

`GET /admin/content/articles` 返回文章分页，查询参数固定为 `page / pageSize`，并支持 `channelId / status / keyword / publishedDate` 过滤；`keyword` 匹配标题、摘要、关键词和 slug；`status` 只允许 `DRAFT / PUBLISHED / UNLISTED`。`publishedDate` 是可选的 `YYYY-MM-DD` 北京时间日期，仅用于知识文章月历的日期筛选；按该日 `[00:00, 次日 00:00)` 匹配 `publishedAt`，或匹配仍处于 `DRAFT` 的 `scheduledPublishAt`，且只匹配 `KITCHEN / COOK / FOOD` 栏目，和其他过滤项同时生效。文章列表按 `publishedAt desc` 排序，无发布时间的文章排在末尾；发布时间相同时按 `updatedAt desc, id desc` 排序。`GET /admin/content/{contentId}` 返回后台详情。`POST /admin/content` 与 `PUT /admin/content/{contentId}` 都要求 `Idempotency-Key`，当前只治理两类内容：`PAGE` 与 `ARTICLE`。`PAGE` 必须命中受控固定页 slug；后台手工保存 `ARTICLE` 必须选择栏目，路径由服务端固定生成 `/guides/{slug}`，后台提交的自定义 `path` 不生效。导入脚本可以先写入无栏目草稿，但这类文章必须重新编辑选择栏目后才能发布；发布 `ARTICLE` 时服务端必须校验栏目存在且属于 `KITCHEN / COOK / FOOD / OFFICIAL_NOTICE`。文章关键词是后台运营字段，最多 200 字符，多个词用分号分隔；服务端会把中文分号规范为英文分号并去掉空项。正文固定使用 `bodyHtml + bodyText` 双写；服务端 HTML 白名单只保留 `p / br / h2 / h3 / strong / b / u / blockquote / ul / ol / li / a / img`，不开放 `h1 / em / i / s`、对齐、表格、视频、内嵌组件或任意 class/style；链接只允许 HTTPS 或站内路径，图片只允许本站内容图片路径；`bodyText` 为空时从 HTML 提取纯文本兜底。

`GET /admin/content/articles/calendar` 只供后台知识文章月历使用，要求 `month` 为 `YYYY-MM` 格式的北京时间月份。响应是最多 31 项的数组，每项固定为 `date + channelCodes`；每个日期仅出现一次，`channelCodes` 只包含当天至少有一篇文章发布或预约发布的 `KITCHEN / COOK / FOOD` 栏目。实际发布日期使用 `publishedAt`；仍为 `DRAFT` 且保留预约的文章使用 `scheduledPublishAt`。统计不受后台列表分页、搜索和筛选影响；下架文章仍保留原发布日标记，转为草稿后发布时间清空且不再有预约时，不再产生标记。预约取消后预约标记移除；自动发布成功后按实际 `publishedAt` 日期展示。

`POST /admin/content/images` 使用 multipart form-data 的 `file + scene`，其中 `scene` 必填且只允许 `ARTICLE_COVER / OTHER`，请求头必须带 `Idempotency-Key`。后台普通文章封面上传使用 `ARTICLE_COVER`，服务端居中裁切并重编码为 `4:3`；正文图片、固定页面及官方消息上传使用 `OTHER`，沿用原图片处理规则。上传成品仍通过 `imageUrl` 返回；该场景字段只决定上传处理方式，不写入文章内容或新增持久化字段。

后台普通文章发布页只暴露 `标题 / 摘要 / 关键词 / 栏目 / 封面图 / 正文` 六类运营输入；`slug / path / label / heroNote / effectiveAt / sortOrder / type` 由页面和服务端自动处理或沿用既有值。普通文章正文编辑器只提供 `h2 / h3 / 加粗 / 下划线 / 引用 / 有序列表 / 无序列表 / 链接 / 图片 / 清除格式`，不提供 H1、斜体、对齐、表格、视频或更多通用编辑能力。普通文章正文支持从本地 Markdown 文件导入为富文本，转换结果仍走同一套 `bodyHtml + bodyText` 保存和服务端 HTML 清洗；Markdown 导入只转换标题、加粗、引用、列表、图片和链接，`#` 正文标题降级为 `h2`，`####` 及更深层级收敛为 `h3`，斜体语法按普通文本处理。后台文章列表支持导入单个 JSON 文件，根对象固定为 `{ "articles": [...] }`，一次最多 100 篇；每篇必填 `title`（最多 80 字符）、`summary`（最多 240 字符）、`channelCode`（仅 `KITCHEN / COOK / FOOD`）和 `bodyMarkdown`，可选 `keywords`（字符串，最多 200 字符）与 `coverImageUrl`（最多 512 字符或 `null`）。导入前整批校验；正文使用同一 Markdown 转换器生成 `bodyHtml + bodyText`，正文图片仅接受本站内容图片路径。成功项通过既有 `POST /admin/content` 逐篇创建为 `DRAFT`，`slug` 从标题生成，`path / label / type` 由系统处理；不从 JSON 导入状态或发布时间。若创建中途请求失败，已成功创建的草稿保留，后台提示成功数量与失败项。该入口只服务知识文章，不导入官方消息。菜谱导入固定为 `files[]` 批量 JSON，不提供 ZIP、Markdown、Excel 等菜谱导入入口。

`POST /admin/content/{contentId}/status` 只切换 `DRAFT / PUBLISHED / UNLISTED` 三种状态，且要求 `expectedVersion`。公开知识文章只有 `PUBLISHED` 可下架；`UNLISTED` 必须先转成 `DRAFT` 才能发布。官方消息继续使用原有状态操作。`DELETE /admin/content/{contentId}` 只允许删除 `ARTICLE`，要求 `Idempotency-Key + expectedVersion`；`PUBLISHED` 内容必须先切到 `UNLISTED` 或 `DRAFT` 后才能删除，官网固定页 `PAGE` 不支持删除。删除只移除内容记录及数据库级联的点赞关系，不删除富文本图片文件，因为正文图片当前没有独立引用表且可能被复用。内容摘要和详情固定返回 `type / status / channel / slug / path / title / summary / keywords / label / heroNote / coverImageUrl / publishedAt / scheduledPublishAt / effectiveAt / sortOrder / version / updatedBy / createdAt / updatedAt`；详情额外返回 `bodyHtml / bodyText`。

`POST /admin/content/{contentId}/schedule` 仅用于 `KITCHEN / COOK / FOOD` 知识文章，要求 `Idempotency-Key`，请求体固定为 `scheduledPublishAt + expectedVersion`；`scheduledPublishAt` 是晚于当前时间且必须包含 `Z` 或 UTC offset 的 ISO 8601 时间，传 `null` 表示取消现有预约。只有 `DRAFT` 可以预约；`UNLISTED` 必须先通过状态接口转为 `DRAFT`，`PUBLISHED` 不支持预约。预约不会改变 `DRAFT` 状态。编辑保存保留预约时间；立即发布、下架和取消预约会清空预约时间。管理员预约、取消，及 Worker 自动发布均写入 `AuditEvent`。响应摘要和详情新增 `scheduledPublishAt`，表示仍待处理的预约时间，已发布或已取消时为 `null`。Worker 使用独立的 `ARTICLE_SCHEDULED_PUBLISH_WORKER_ENABLED` 开关轮询到期文章，不消费其他 Outbox 事件。

`POST /admin/content/images` 是后台内容图片上传入口，只允许 `SUPER_ADMIN` 调用，请求头必须带 `Idempotency-Key`。普通文章封面由浏览器居中裁剪并保存为 `4:3`，正文图片沿用 `4:3` 校验与处理；官方消息封面规则不变。宽度超过 `1875 px` 时按当前图片比例缩小。所选原图不限制文件大小；处理后的文件以 `JPG` 上传，接口单图上限为 `8 MB`。服务端把文件写入统一静态资源存储，并返回 `imageUrl`；公开读取统一走 `GET /static/uploads/site-content-images/{fileName}`，当前只做静态资源读取，不建独立数据库表。后台图片素材库另走 `/admin/material-images`，用于可列表、可复制、可删除的运营素材，不复用这个富文本上传入口。

`GET /site-contents/resolve` 是站点和官网的公开内容读取接口，只按 `path` 返回已发布内容。当前只返回 `PUBLISHED` 内容，固定响应 `id / type / slug / path / title / summary / label / heroNote / coverImageUrl / bodyHtml / bodyText / publishedAt / effectiveAt / updatedAt / channelCode / channelName`，不返回草稿和下架内容。

`GET /site-contents/articles`、`GET /site-contents/articles/unread-summary`、`GET /site-contents/articles/{articleId}`、`POST /site-contents/articles/{articleId}/view`、`POST /site-contents/articles/{articleId}/like` 和 `DELETE /site-contents/articles/{articleId}/like` 共同承接小程序“厨房百事 / 烹调技法 / 饮食文化”三条知识文章链路。文章列表和详情是公开读取接口：未登录也可以直接浏览；登录用户可调用 `GET /site-contents/articles/unread-summary` 获取 `KITCHEN / COOK / FOOD` 三个栏目的 `hasUnread`，该接口要求 `UserBearerAuth` 且固定返回三个栏目；请求带有效 `UserBearerAuth` 时，详情会按当前用户返回 `viewerHasLiked`，未登录时固定为 `false`。点击后的写操作继续要求登录：`POST /site-contents/articles/{articleId}/view`、`POST /site-contents/articles/{articleId}/like` 和 `DELETE /site-contents/articles/{articleId}/like` 都要求 `UserBearerAuth`。列表查询参数固定为 `channelCode + page + pageSize`，其中 `channelCode` 只允许 `KITCHEN / COOK / FOOD` 三个受控栏目；列表只返回当前栏目下 `PUBLISHED` 的文章分页，响应为 `PageResult<SiteContentArticleListItem> + channel`，其中 `channel` 固定返回当前栏目 `code / name / description`，摘要固定为 `id / title / summary / keywords / coverImageUrl / publishedAt / viewCount / likeCount / isUnread`，其中 `isUnread` 仅对登录用户且发布时间在最近 7×24 小时内的文章按当前用户已读关系判断；匿名列表和窗口外文章固定为 `false`。按 `sortOrder asc, publishedAt desc, id desc` 排序。三类栏目关系固定为：`KITCHEN` 表示“厨房百事”，承接用什么、怎么买、怎么存、怎么备；`COOK` 表示“烹调技法”，承接怎么做、为什么这样做、失败怎么救；`FOOD` 表示“饮食文化”，承接餐桌上的节气、地域、传统、人情。详情接口只读取同三类受控栏目里的已发布文章，固定返回 `id / slug / path / title / summary / keywords / label / heroNote / coverImageUrl / bodyHtml / bodyText / publishedAt / updatedAt / channelCode / channelName / viewCount / likeCount / viewerHasLiked`，不返回作者、评论、收藏或相关推荐。`POST /site-contents/articles/{articleId}/view` 用于在详情页成功进入后累积一次阅读数，请求头必须带 `Idempotency-Key`，响应只返回最新 `articleId / viewCount`；若文章发布时间处于请求时刻前 7×24 小时内，同一事务还会为当前用户幂等写入已读关系；阅读数只累计总数；为未读提示另按用户与文章保留唯一已读事实。点赞与取消点赞也都要求 `Idempotency-Key`，服务端以 `site_content_likes` 做单用户单文章唯一约束；重复点赞或重复取消点赞都返回当前最新状态，不再报错。点赞相关响应固定返回 `articleId / likeCount / viewerHasLiked`。这组接口当前不开放评论、收藏、点赞用户列表、作者主页、推荐排序或其他社区能力。

`GET /site-contents/official-messages` 与 `GET /site-contents/official-messages/{contentId}` 共同承接小程序通知中心里的“系统官方消息”。两个接口都要求 `UserBearerAuth`，未登录时客户端先走登录链路。列表查询参数固定为 `page + pageSize`，只返回 `channel.code = OFFICIAL_NOTICE` 且 `status = PUBLISHED` 的内容，按 `publishedAt desc, updatedAt desc, id desc` 排序。列表和详情当前统一返回最小站内承接字段：`id / type / slug / path / title / summary / label / heroNote / coverImageUrl / bodyHtml / bodyText / publishedAt / effectiveAt / updatedAt / channelCode / channelName`。通知中心只消费其中的 `title / summary / publishedAt|updatedAt` 生成消息卡；若正文里存在 `https://` 链接，则前台可直接跳内嵌 H5，否则进入站内官方消息详情页。这组接口当前不开放阅读数、点赞、评论、已读回执、定向投放或发送统计。

`POST /admin/users`、`PUT /admin/users/{userId}`、`POST /admin/users/{userId}/status`、`POST /admin/users/{userId}/reset-password` 和 `POST /admin/users/{userId}/phone/reveal` 使用 `AdminBearerAuth`，且仅 `SUPER_ADMIN` 可访问。当前范围只支持新增用户、修改昵称/手机号、启用/禁用、重置密码和经审计查看完整手机号；不支持物理删除用户，也不通过后台直接改用户归属数据。

用户 token 绑定服务端 `sessionVersion`。后台启用、禁用或重置密码时递增该版本；此前签发的 token 从下一次鉴权请求起统一返回业务 `code=401`，重新启用用户不会恢复旧 token。

用户权益查询使用 `AdminBearerAuth`，仅 `SUPER_ADMIN` 可访问。它是后台审计视图，按领域分段返回，不作为小程序的聚合契约。背景图能力当前统一返回 `false`。

`GET /admin/app-config`、`POST /admin/app-config/login-image` 和 `DELETE /admin/app-config/login-image` 共同维护登录弹窗图片。它们只服务这一条已确认配置，不扩成通用配置中心或通用素材库。上传成功和清空成功都返回最新 `AppConfigResponse`。

`GET /admin/membership-codes/skus`、`POST /admin/membership-codes/skus/{skuId}/status`、`GET /admin/membership-codes/batches`、`POST /admin/membership-codes/batches`、`POST /admin/membership-codes/batches/{batchId}/status`、`POST /admin/membership-codes/batches/{batchId}/generate`、`GET /admin/membership-codes`、`GET /admin/membership-codes/generations`、`GET /admin/membership-codes/redemptions` 和 `POST /admin/membership-codes/{codeId}/disable` 共同组成后台会员兑换码治理面。固定 SKU 目录由服务端自动同步，当前只允许 `PLUS_30D / PRO_30D / PRO_TRIAL_1D / PRO_TRIAL_3D / PRO_TRIAL_7D` 五项；后台不得新增第六种 SKU，也不得基于其他数据库遗留 SKU 发码。SKU 摘要新增 `version`，只用于后台切换该 SKU 的核销开关；切换请求体固定提交 `redeemEnabled + expectedVersion`，服务端成功后才会递增 `version`。SKU 目录同步只负责校正 `code / kind / tier / durationDays` 这类固定事实，不会覆盖后台已设置的 `redeemEnabled`。批次读取固定返回分页 `PageResult<AdminMembershipCodeBatchItem>`，并附带 `windowState + version + codeCount / activeCodeCount / redeemedCodeCount / disabledCodeCount`，用于后台判断上架状态、时间窗和发码规模。创建批次时只收 `skuCode / name / redeemEnabled / startsAt / endsAt` 最小字段，`startsAt < endsAt` 由服务端校验；切换上下架时必须带 `expectedVersion`，避免多人后台覆盖。`POST /admin/membership-codes/batches/{batchId}/generate` 只收 `quantity`，单次上限 `1000`；服务端高熵生成明文码，但数据库、审计和后台列表只保留 `codeHash + codeMask`，明文码只在该次响应的 `codes[]` 中返回一次供导出。`GET /admin/membership-codes` 只返回掩码、批次、SKU、状态、使用人和使用时间；若后台输入完整兑换码查询，服务端只做哈希精确匹配，不回显明文。`GET /admin/membership-codes/generations` 按 `audit_events` 中的 `membership-code.generate` 事实分页返回生成记录，首版支持按 `batchId / skuCode` 过滤，响应只包含 `批次 / SKU / 生成数量 / 操作人 / 时间`，不回放明文码。`GET /admin/membership-codes/redemptions` 只返回已核销兑换码分页，首版支持按 `batchId / skuCode / uid / redeemedFrom / redeemedTo / code` 过滤，用于后台独立查看兑换使用事实。`POST /admin/membership-codes/{codeId}/disable` 仅允许停用未使用兑换码，已使用码不得再改状态。

`GET /admin/home-entries`、`PUT /admin/home-entries`、`POST /admin/home-entries/{placement}/status`、`POST /admin/home-entries/{placement}/image` 和 `DELETE /admin/home-entries/{placement}/image` 共同维护首页快捷入口四宫格。后台固定返回 `QUICK_1 ... QUICK_4` 四个坑位，不支持新增、删除或拖出第 5 个入口；读取接口返回 `items + pageTargets`，供后台展示配置和选择站内页面。`PUT /admin/home-entries` 支持部分保存，请求至少提交 `1` 个、最多提交 `4` 个入口，每个入口都带 `expectedVersion`，且同一次请求内 `placement` 不得重复；`PAGE` 只能使用白名单页面，`WEB_VIEW` 必须以 `https://` 开头。状态接口只允许四宫格入口，`LISTED` 表示首页展示，`UNLISTED` 表示保留该坑位配置但首页隐藏。图片支持直接填写 `https` 地址或逐入口上传/清空；上传和清空都要求 `expectedVersion`，上传后的数据库值保存为站内相对资源路径，由公开接口转换成可访问 URL。首屏三卡不再由后台管理或接口配置，右侧卡片文案及跳转由客户端固定。

`GET /admin/home-topics`、`GET /admin/home-topics/recipes`、`POST /admin/home-topics`、`PUT /admin/home-topics/{topicId}`、`POST /admin/home-topics/{topicId}/status`、`DELETE /admin/home-topics/{topicId}`、`POST /admin/home-topics/{topicId}/image` 和 `DELETE /admin/home-topics/{topicId}/image` 共同维护“运营 / 本周灵感”。后台读取接口返回 `topics + recTypes`：`topics` 返回全部专题，并额外携带 `status` 供后台做列表、预览和上架状态切换；`LISTED` 表示前台可见，`UNLISTED` 表示仅后台可见；`recTypes` 返回当前允许的推荐类别枚举与中文文案。`GET /admin/home-topics/recipes` 只搜索可曝光的灵感菜谱，当前最多返回 `20` 条，供后台把菜谱加入本期推荐。`POST /admin/home-topics` 和 `PUT /admin/home-topics/{topicId}` 只写入基础信息和推荐菜谱顺序，请求体固定提交 `title / subTitle / recType / issueNo / description / items`；`items` 当前至少 `3` 条，每条固定提交 `recipeId + recommendNote`，其中 `recommendNote` 可空，表示这道菜在本期专题推荐里的可选推荐说明；同一次提交内不得重复提交同一 `recipeId`，不再限制最多条数。前台专题详情和后台专题详情都返回每道菜的 `recommendNote`，有值才显示。新建专题默认写成 `UNLISTED`，由后台确认后再通过 `POST /admin/home-topics/{topicId}/status` 显式上架；切状态请求体固定提交 `status + expectedVersion`。`DELETE /admin/home-topics/{topicId}` 只允许删除 `UNLISTED` 专题，请求体固定提交 `expectedVersion`，删除后同时移除该专题的推荐项和自管封面图；`LISTED` 专题必须先下架。封面图不混进专题写 DTO，统一走单独上传/清空接口，并通过 `expectedVersion` 防并发覆盖；新上传或替换的封面在服务端居中裁切并保存为 `3:4`，既有图片对象不重裁。专题当前没有草稿态、定时发布、专题收藏或专题推荐统计；历史专题长期保留，但下架后不会继续出现在前台当前专题和往期滑卡里。

`GET /admin/table-topics`、`POST /admin/table-topics`、`PUT /admin/table-topics/{topicId}`、`POST /admin/table-topics/{topicId}/status`、`DELETE /admin/table-topics/{topicId}`、`POST /admin/table-topics/{topicId}/image` 和 `DELETE /admin/table-topics/{topicId}/image` 共同维护“运营 / 餐桌话题”。后台读取接口只返回 `topics` 数组；每项固定包含 `id / title / summary / coverImageUrl / activityAt / participantCount / targetType / targetValue / status / version / updatedAt`。`participantCount` 是服务端根据 `table_topic_participants` 真实计数返回，后台不可手改。`POST /admin/table-topics` 与 `PUT /admin/table-topics/{topicId}` 当前只写基础信息和详情承接目标，请求体固定提交 `title / summary / activityAt / targetType / targetValue`；`title` 最多 `30` 字，`summary` 最多 `240` 字。`targetType = PAGE` 时，`targetValue` 为空表示只使用小程序原生详情页，非空时必须以 `/` 开头；`targetType = WEB_VIEW` 时，`targetValue` 必须是以 `https://` 开头的 H5 地址。新建话题默认写成 `UNLISTED`，由后台确认后再通过 `POST /admin/table-topics/{topicId}/status` 显式上架。`DELETE /admin/table-topics/{topicId}` 只允许删除 `UNLISTED` 话题，请求体固定提交 `expectedVersion`，删除后同时移除参与事实和自管封面图；`LISTED` 话题必须先下架。封面图继续走单独上传 / 清空接口，并通过 `expectedVersion` 防并发覆盖；新上传或替换的封面在服务端居中裁切并保存为 `3:4`，既有图片对象不重裁。后台当前不提供取消参与、手工补人数或历史回滚能力。

后台勋章治理当前新增：

```text
GET  /admin/medal-templates
POST /admin/medal-templates
PUT  /admin/medal-templates/{templateId}
POST /admin/medal-templates/{templateId}/status
POST /admin/medal-templates/{templateId}/image/{imageType}
PUT  /admin/medal-templates/{templateId}/image/{imageType}
DELETE /admin/medal-templates/{templateId}/image/{imageType}
POST /admin/medal-templates/swap-images
```

这一组接口治理 `勋章模板`，不治理用户已获得勋章事实。模板摘要固定返回 `id / code / awardRule / category / categoryName / name / description / condition / iconKey / imageUrl / earnedImageUrl / lockedImageUrl / status / targetCount / sortOrder / isLimited / startAt / endAt / version / createdAt / updatedAt`。`awardRule` 当前允许 `MEAL_COMPLETION / DINING_EVENT_COMPLETION / GROUP_MEAL_COMPLETION / FULL_LOOP_COMPLETION / SHOPPING_COMPLETION / FRIDGE_MAINTENANCE / MEMORY_SHARE_STARTED_TOTAL / RECOMMENDATION_ADOPTED_TOTAL`；`category` 当前允许 `MEAL_CHECKIN / DINING_COLLABORATION / RECOMMENDATION_CONTRIBUTION / HOLIDAY_LIMITED`，其展示名称依次为“厨房日常 / 饭局相聚 / 好味分享 / 节日限定”；`status` 当前允许 `DRAFT / LISTED / UNLISTED / ARCHIVED`。`targetCount` 用于累计型勋章阈值，最小为 `1`。用户侧勋章名称、简介和获取说明不展示档位门槛数字；服务端仍按模板 `targetCount` 派发。`GET /admin/medal-templates` 固定使用 `page / pageSize` 分页，并支持 `keyword / status / category` 过滤。`POST /admin/medal-templates` 允许后台创建模板并指定初始状态，`code` 改为服务端自动生成；`PUT /admin/medal-templates/{templateId}` 只编辑展示与时间配置，不改 `code` 和 `awardRule`；`POST /admin/medal-templates/{templateId}/status` 只切换模板状态；`POST /admin/medal-templates/{templateId}/image/{imageType}`、`PUT /admin/medal-templates/{templateId}/image/{imageType}` 和 `DELETE /admin/medal-templates/{templateId}/image/{imageType}` 分别负责上传、设置图片地址和清空图片，其中 `imageType` 仅允许 `earned / locked`。手动地址只接受 `ASSET_PUBLIC_BASE_URL` 配置域名下 HTTPS `/uploads/` 路径；未配置静态资源域名时不能手动填写地址，但图片上传仍可用。后台上传当前允许 `JPG / PNG / WEBP / SVG`；其中 `SVG` 只允许纯静态矢量内容，服务端会拒绝带脚本、事件处理器或外部资源引用的文件。`POST /admin/medal-templates/swap-images` 仅限 `SUPER_ADMIN` 并要求数字字符串 `Idempotency-Key`；它逐个交换当前环境模板的获得图/未获得图对象内容、更新时间和自定义图片地址，跳过无图片及已修复模板，每个模板执行版本校验和审计，部分失败后可重试未完成项。后台不得通过任何接口直接给用户补发、撤销或修改勋章获得时间。

勋章模板配置同步仅限 `SUPER_ADMIN`，不限制运行环境和同步方向。`POST /admin/medal-templates/export` 在任意环境可用，请求为 `{ "templateIds": number[] }`，须选 1 至 500 个不同的正整数 ID；服务端确认所有记录存在且为 `LISTED` 后返回 `cook.medal-templates.v1` JSON 包。包顶层为 `schemaVersion / sourceEnvironment / exportedAt / templates`；`sourceEnvironment` 仅记录导出时的环境信息，缺失或未知时规范为 `UNKNOWN`，不参与导入校验。每条模板仅包含 `code / awardRule / category / name / description / condition / status: LISTED / targetCount / sortOrder / isLimited / startAt / endAt`，不包含数据库 ID、版本、图片字段或用户获得事实。

`POST /admin/medal-templates/preview` 和 `POST /admin/medal-templates/import` 在任意环境可用，使用 multipart 字段 `file` 上传最大 2 MB 的 JSON 包，最多 500 条，不限制包内来源环境。服务端校验结构、字段、日期范围和唯一 `code`。预览返回 `{ schemaVersion, targetEnvironment, sourceEnvironment, counts: { total, new, existing }, conflicts: string[] }`，环境字段仅作信息展示，未知值为 `UNKNOWN`；预览不写入，同编码不同 `awardRule` 作为冲突展示。导入须携带数字字符串 `Idempotency-Key`，有非法记录或规则冲突时整批拒绝。成功响应 `{ importedCount, createdCount, updatedCount }`；按 `code` 新增或更新 `LISTED` 模板，已存在模板仅更新分类、展示文案、阈值、排序、限时日期、状态和版本，保留 `code`、`awardRule`、全部图片字段及目标环境包内缺失的模板。新增模板的 `iconKey` 由 `awardRule` 推导，图片字段为 `null`，版本从 1 开始。导入在单事务内保存管理员审计和幂等结果；重复使用同一键和同一包返回首次结果。

勋章图片公开 URL 使用稳定对象 key：已获得图为 `/static/uploads/medals/{templateId}`，锁定图为 `/static/uploads/medals/{templateId}/locked`；读取端兼容历史带扩展名对象。

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
GET  /admin/pending-units
POST /admin/pending-units/{recommendationId}/review
DELETE /admin/pending-units/{recommendationId}
GET  /admin/ingredients
POST /admin/ingredients
PUT  /admin/ingredients/{ingredientId}
POST /admin/ingredients/{ingredientId}/status
POST /admin/ingredients/{ingredientId}/merge
DELETE /admin/ingredients/{ingredientId}
POST /admin/ingredients/{ingredientId}/image
DELETE /admin/ingredients/{ingredientId}/image
POST /admin/ingredients/reorder
GET  /admin/pending-ingredients
POST /admin/pending-ingredients/{ingredientId}/review
DELETE /admin/pending-ingredients/{ingredientId}
GET  /admin/ingredient-feedbacks
POST /admin/ingredient-feedbacks/{feedbackId}/review
DELETE /admin/ingredient-feedbacks/{feedbackId}
```

这一组接口治理 `系统食材分类 + 系统食材 + 系统单位 + 个人食材推荐审核 + 单位建议审核 + 系统食材纠错审核`。系统单位是后台运营面维护的公共基础数据，多个后台录入入口统一复用这一组接口并按 `type` 分组展示；个人食材只通过待审列表进入后台，不在系统食材列表里直接混排编辑。

`GET /admin/ingredient-categories` 返回全部系统食材分类摘要，按后台排序返回。分类摘要新增 `code`、`isSelectable`、`version`、`ingredientCount` 和 `updatedAt`，用于后台编辑、兜底分类识别、上架/下架和排序并发控制；当前 `ingredientCount` 统计后台仍可治理的系统食材总数，即 `ACTIVE + DISABLED + MERGED`，隐藏兜底分类 `待归类` 还额外包含该分类的 `PENDING`。系统正式分类在上线前固定，后台不再开放常规新增，只保留名称微调、上下架、无引用删除和排序；隐藏兜底分类 `待归类` 会通过 `isSelectable = false` 返回，且不能上架、下架或删除。`POST /admin/ingredient-categories/{categoryId}/status` 要求 `Idempotency-Key + expectedVersion`，用 `ACTIVE / DISABLED` 映射 `isSelectable = true / false`；下架分类不再进入前台分类和系统食材选择口径。`DELETE /admin/ingredient-categories/{categoryId}` 要求 `Idempotency-Key + expectedVersion`，仅在该分类没有食材和纠错引用时允许删除，否则返回冲突错误。`POST /admin/ingredient-categories/reorder` 提交完整分类集合的 `id + expectedVersion` 顺序，成功后统一重写排序并递增对应 `version`。

`GET /admin/units` 返回全部系统单位摘要，按 `type -> systemSortOrder -> name` 排序；系统单位摘要新增 `version` 和 `updatedAt`，用于后台编辑、删除和拖拽排序的并发控制。`POST /admin/units` 新建一个系统单位；`PUT /admin/units/{unitId}` 修改单位名称或类型；`DELETE /admin/units/{unitId}` 只在该单位未被任何食材引用时允许删除，否则返回冲突错误；`POST /admin/units/reorder` 只重排某一个 `type` 分组下的完整系统单位集合，成功后统一重写该分组顺序。`GET /admin/pending-units` 返回待审核单位建议分页，支持按单位名、提交人昵称或 UID 搜索；摘要固定返回 `name / type / version / createdAt / user`。`POST /admin/pending-units/{recommendationId}/review` 只支持 `APPROVE / REJECT` 两种结果；通过时可调整 `name + type`，若系统库已存在同名系统单位，则直接归并并把建议记为 `MERGED`，否则新建系统单位并记为 `ADOPTED`；拒绝时回写简短 `reason`，前台“推荐审核”直接展示。`DELETE /admin/pending-units/{recommendationId}` 要求 `Idempotency-Key + expectedVersion`，只删除仍为 `PENDING` 的单位建议记录，不创建或删除系统单位。

`GET /admin/ingredients` 只返回系统食材分页，查询参数固定为 `page`、`pageSize`，并支持 `categoryId`、`keyword`、`status`、`factStatus` 和 `imageStatus` 过滤；`status` 允许 `PENDING / ACTIVE / DISABLED / MERGED / ALL`，默认 `ACTIVE`，`ALL` 返回四种治理状态，`factStatus` 允许 `ALL / MISSING`，默认 `ALL`。选择隐藏兜底分类 `待归类` 时，后台默认按 `ALL` 显示其待归类食材；`PENDING` 项标记为“待归类”，其“处理”动作仍进入 `GET /admin/pending-ingredients` 对应的审核工作台，统一完成通过、归并或拒绝，避免绕过导入引用回写和审计。分类摘要的 `待归类` 计数额外包含该分类的 `PENDING` 项，其他分类统计 `ACTIVE + DISABLED + MERGED`。当传 `categoryId` 时，列表按该分类内系统顺序返回；不传 `categoryId` 时，列表进入后台虚拟“全部食材”视图，按系统食材全局展示顺序返回，用于统一查看、编辑和拖拽控制前台“全部食材”口径。`factStatus = MISSING` 用于后台快速查看仍建议补录结构化属性的系统食材，当前按既有自动识别规则检查 `主蛋白 / 主食 / 辣味食材` 三类缺口；`imageStatus` 允许 `ALL / MISSING`，默认 `ALL`，其中 `MISSING` 只返回 `imageUrl IS NULL` 的系统食材。系统食材摘要固定返回四态 `status`，并增加 `mergedTo: { id; name } | null`；`MERGED` 行显示主食材且只读，不提供编辑、上下架、删除或再次合并。系统食材同时维护两套顺序：`分类内顺序` 只服务真实分类管理，`全局展示顺序` 只服务后台“全部食材”视图和前台“全部食材”展示。`POST /admin/ingredients/{ingredientId}/status` 用于把系统食材切到 `ACTIVE / DISABLED`；重新上架时服务端会把该食材同时放到当前分类排序末尾和全局展示顺序末尾，避免与现有启用中食材顺序冲突；若一条 `ACTIVE` 食材仍被 `MERGED` 归并项指向，则禁止直接下架，应改为将它归并到另一条 `ACTIVE` 主食材。`POST /admin/ingredients/{ingredientId}/merge` 要求数字字符串 `Idempotency-Key`，请求体固定为 `{ expectedVersion, targetIngredientId }`，响应 `data` 为 `{ sourceIngredientId, targetIngredientId, mergedAt }`；来源只允许系统 `ACTIVE / DISABLED`，目标必须是另一条系统 `ACTIVE`。服务端在单事务中锁定并重新校验来源和目标，把来源及其已有归并项改指最终目标，切换冰箱、购物和未发布导入草稿的可变引用并写 `INGREDIENT_MERGED` 审计；不覆盖目标资料，不改写已发布固定菜谱版本、审核历史、来源营养映射或来源单位换算，首版不支持解除归并。`DELETE /admin/ingredients/{ingredientId}` 要求 `Idempotency-Key + expectedVersion`，只在该系统食材未被个人数据、菜谱草稿、已引用固定版本、购物清单、冰箱、审核记录、归并关系和营养映射引用时允许物理删除；存在任一引用时返回冲突错误，管理员应改用下架。`POST /admin/ingredients/{ingredientId}/image` 接收 JPG 原图，服务端限制原图 `6 MB`、边长不超过 `1125` 且至少 `300×300`，并校验严格 `1:1`；成功后缩小、重新编码到最长边不超过 `500` 像素且成品不超过 `250 KB`，再覆盖系统食材图片、持久化公开 `imageUrl` 并递增 `version`。`DELETE /admin/ingredients/{ingredientId}/image` 清空系统食材图片 URL 并递增 `version`。食材图片 URL 带 OSS `image/resize,m_fixed,w_300,h_300` 参数；访问处理结果为 `300×300`。公开图片读取走 `GET /static/uploads/ingredients/{ingredientId}.jpg`，只有数据库中仍为启用中的系统食材且 `imageUrl` 非空时才返回资源；已下架食材即使静态资源还在也不得继续外露。旧记录不回填，`imageUpdatedAt` 不用于推导图片 URL。`POST /admin/ingredients/reorder` 支持两种模式：传 `categoryId` 时，只接收该分类下启用中系统食材的完整集合顺序并重写分类内顺序；不传 `categoryId` 时，只接收全部启用中系统食材的完整集合顺序并重写全局展示顺序。服务端统一校验集合完整性和 `expectedVersion`。`GET /admin/pending-ingredients` 返回待审核食材分页，同样固定使用 `page`、`pageSize`，同时包含个人食材推荐和 JSON 导入创建的 `PENDING` 系统食材；`POST /admin/pending-ingredients/{ingredientId}/review` 允许后台按 `通过为系统食材 / 通过并归并到现有系统食材 / 拒绝` 三种结果处理，并可在通过前调整 `名称 + 分类 + 默认单位`。拒绝时必须选择预设 `rejectReasonCode`：`NAME_NOT_CLEAR / NAME_HAS_BRAND / CATEGORY_NOT_FIT / UNIT_NOT_FIT / OUT_OF_SCOPE / OTHER`；只有 `OTHER` 仍要求补充详细 `reason`。服务端会把对应建议写入推荐记录，供前台“我的推荐”直接展示。若审核通过时命中同名但已下架的系统食材，服务端直接复用该系统食材并恢复为启用中，不再额外创建重复系统食材。`DELETE /admin/pending-ingredients/{ingredientId}` 要求 `Idempotency-Key + expectedVersion`，只删除仍为 `PENDING` 的个人食材推荐记录，不删除用户自己的个人食材。`GET /admin/ingredient-feedbacks` 只返回待审核的系统食材纠错分页，支持按当前食材名、建议食材名、分类、备注、提交人昵称或 UID 搜索；列表摘要固定返回 `当前名字/分类 + 建议名字/分类 + 备注 + 提交人 + ingredientVersion`。`POST /admin/ingredient-feedbacks/{feedbackId}/review` 只支持 `APPROVE / REJECT` 两种结果；采纳时后台可在用户建议基础上再次调整最终 `name + categoryId`，服务端直接更新对应系统食材并递增其 `version`，再把该纠错记录标记为 `ADOPTED`；驳回时只回写 `reviewNote` 并标记为 `REJECTED`。`DELETE /admin/ingredient-feedbacks/{feedbackId}` 要求 `Idempotency-Key + expectedVersion`，只删除仍为 `PENDING` 的纠错记录，不修改系统食材。

系统食材图片 URL 指向 JPG 对象并使用 `x-oss-process=image/resize,m_fixed,w_300,h_300`；未配置静态域名时持久化 API 相对路径，避免把临时请求 Host 写入食材记录。

后台食材图片仅接受 JPG 原图，单张和批量每张原图不超过 `6 MB`、最长边不超过 `1125` 像素且必须为正方形，批量不设张数上限并按文件顺序串行上传。服务端解码后缩小到最长边 `500` 像素并重新编码，成品不超过 `250 KB`；公开 URL 使用 OSS 参数返回 `300×300` 图片。批量结果每页显示 50 项。

当前 `/admin/pending-ingredients` 统一返回待审核食材，包含用户提交的个人食材推荐和 JSON 导入创建的 `PENDING` 系统食材，并返回 `source = PERSONAL / JSON_IMPORT`；JSON 导入项的 `user` 为 `null`。JSON 未提供可识别单位时仍创建真实 `PENDING` 食材，响应中的 `defaultUnitId / defaultUnitName` 返回 `null`，后台显示“待补充”并要求管理员在通过前补齐，不推断默认单位。`GET /admin/ingredients` 的 `PENDING` 摘要允许 `defaultUnit = null`，`ACTIVE` 摘要仍保证非空。导入按规范化名称匹配系统食材，优先级固定为 `ACTIVE > MERGED（取 ACTIVE 目标） > PENDING > DISABLED`，命中后以最终食材分类覆盖 JSON 分类；命中 `MERGED` 或显式提交已归并 `ingredientId` 时保存目标 ID、名称和分类，目标无效则拒绝继续；`DISABLED` 保留引用并阻止发布，不自动上架、不重复创建 PENDING。导入任务详情条目摘要补充 `categoryCode / categoryName / defaultUnitName`，后台列表不展示内部 `sourcePath`；`GET /admin/ingredient-import-items/{itemId}` 仍保留原始来源路径供详情追溯。导入条目详情的 `ingredientRefs` 只批量返回当前 `recipeBody.ingredients` 实际引用的 `ACTIVE / PENDING / DISABLED` 后台食材摘要；归并操作会在事务内把所有未发布草稿的旧引用切到目标，因此不保留 `MERGED` 草稿引用。`recipeBody.ingredients[].categoryCode` 响应允许正式分类代码、`UNCLASSIFIED` 或 `null`。导入修正页据此分别显示正式选项、“待归类”和“已下架”，只有 `ingredientId = null` 才显示“未匹配”，PENDING 和 DISABLED 都不能作为新的正式匹配候选；已有 `ingredientId` 时分类控件只读。保存导入修正时，服务端按实际引用的系统食材批量覆盖 `ingredientName / categoryCode`，不接受客户端把系统分类改成另一分类。审核通过、归并或拒绝 JSON 导入项时，同步更新未发布导入草稿的食材引用、名称、分类和状态；`DELETE /admin/ingredient-import-items/{itemId}` 要求 `Idempotency-Key + expectedVersion`，删除导入条目；若条目创建的是仍为 `PENDING` 且无任何业务引用的系统食材，则事务内一并删除该食材及其营养/单位关联，否则只删除导入条目并保留已有食材。导入任务详情列表支持快捷审核和快捷删除；删除任务仍只删除导入记录，不删除已入库食材。`DELETE /admin/pending-ingredients/{ingredientId}` 仍只删除个人食材推荐记录。

后台菜谱治理当前补充为：

```text
GET /admin/inspiration-categories
POST /admin/inspiration-categories
PUT /admin/inspiration-categories/{categoryId}
DELETE /admin/inspiration-categories/{categoryId}
POST /admin/inspiration-categories/reorder
GET /admin/recipes
POST /admin/recipes
GET /admin/recipes/export
POST /admin/recipes/{recipeId}/images/backfill
GET /admin/recipes/{recipeId}
PUT /admin/recipes/{recipeId}
POST /admin/recipe-images
GET /admin/image-generation/settings
PUT /admin/image-generation/settings
GET /admin/image-generation/targets
POST /admin/image-generation/generate
DELETE /admin/image-generation/candidates/{candidateId}
POST /admin/image-generation/candidates/{candidateId}/apply
GET /admin/recipe-reports
POST /admin/recipes/{recipeId}/block
POST /admin/recipes/{recipeId}/unblock
DELETE /admin/recipes/{recipeId}
POST /admin/recipes/wiki/confirm-candidates
POST /admin/recipes/content/sync-import
PUT /admin/recipes/{recipeId}/wiki-candidate
POST /admin/recipe-reports/{reportId}/resolve
POST /admin/recipe-import-jobs/json
GET  /admin/recipe-import-jobs
DELETE /admin/recipe-import-jobs/{jobId}
GET  /admin/recipe-import-jobs/{jobId}
GET  /admin/recipe-import-items/{itemId}
PUT  /admin/recipe-import-items/{itemId}
DELETE /admin/recipe-import-items/{itemId}
POST /admin/recipe-import-items/{itemId}/publish
GET  /admin/recipe-wiki
GET  /admin/recipe-wiki/{recipeId}/export
POST /admin/recipe-wiki/export
POST /admin/recipe-wiki/import
POST /admin/recipe-wiki/{recipeId}/quick-fill
POST /admin/recipe-wiki/{recipeId}/reject
```

菜谱导入接口接收批量选择的 `.json` / `.zip`，字段为 `files[]`；单菜使用 `recipe.import.v1`，批次使用 `recipe.import.batch.v1.recipes[]`，每道菜独立创建待审核项。ZIP 只允许 JSON；单 JSON 不超过 10 MB，展开后最多 100 道菜、总 JSON 不超过 20 MB；不支持 Markdown 或 Excel。`GET /admin/recipes/{recipeId}` 的后台详情返回当前正文版本、工具、业务标签、营养分析、做饭助手 Wiki 和七个 Wiki 质量卡；质量卡按当前版本实时返回状态、分数和阻断原因。

`DELETE /admin/recipe-import-items/{itemId}` 接收 `expectedVersion`，只删除一条 JSON 导入记录，保留关联的正式菜谱，并更新任务统计与审计。已关联正式菜谱的导入条目不可再编辑；重复发布返回该条目及原 `recipeId`，不得重复创建菜谱。导入菜谱只有完整 Wiki 才能发布。

`GET /admin/recipes` 的菜谱摘要增加 `hasWikiCandidate`。`POST /admin/recipes/wiki/confirm-candidates` 最多接收 100 个已勾选菜谱 ID，批量确认当前版本候选标签并锁定；完整助理步骤同时发布为 `READY`，不完整助理步骤保留待复核。系统菜谱详情返回 `assistantCandidate`；`PUT /admin/recipes/{recipeId}/wiki-candidate` 可编辑当前版本候选标签与助理步骤，要求 `expectedContentVersionId` 与当前正文版本一致，编辑只替换候选标签并保留已确认及自动推导标签，编辑后仍为候选。写入要求 `SUPER_ADMIN` 和数字字符串 `Idempotency-Key`。

`POST /admin/recipes/content/sync-import` 最多接收 100 个已勾选系统菜谱 ID，从各菜谱唯一关联且状态为 `PUBLISHED` 的导入 JSON 同步名称、故事、结构化食材与用量、厨具、关键词、步骤正文和步骤图片提示词；保留现有分类、基准人数、难度、时长、小贴士、封面图、正文步骤图及完整 Wiki（人工标签、重算后的自动标签、助理候选/快照、Wiki 步骤图、已消费解锁权），并重新计算新版本营养快照。复制的解锁权不重复计入每日额度，未完成的预约不复制。成功项创建新的不可变 `RecipeContentVersion`，历史版本和固定版本引用不变。只有步骤数量相同，且有图片的步骤文字仍与相同序号对应时才同步；找不到唯一导入来源、结构化匹配不完整或图片不能安全对位的项目返回 `SKIPPED + message`，其他菜谱继续处理。响应包含 `syncedCount / skippedCount / items[{recipeId,status,contentVersionId,nextContentVersionId,message}]`。接口要求 `SUPER_ADMIN` 和数字字符串 `Idempotency-Key`，每批最多 100 项。

`GET /admin/inspiration-categories` 返回后台系统菜谱分类列表，摘要包含 `id / name / iconKey / version / recipeCount / updatedAt`；`POST /admin/inspiration-categories`、`PUT /admin/inspiration-categories/{categoryId}` 和 `POST /admin/inspiration-categories/reorder` 分别用于新增、编辑和重排，`DELETE /admin/inspiration-categories/{categoryId}` 仅允许删除没有菜谱和待审核推荐引用的分类。请求头统一使用 `Idempotency-Key`，重排请求提交完整的 `id + expectedVersion` 集合。`GET /admin/recipes` 只返回后台系统菜谱列表最小摘要，查询参数固定为 `page`、`pageSize`，并支持 `categoryId`、`keyword`、`status` 过滤；系统菜谱口径固定为 `isInspiration = true` 且 `inspirationCategoryId != null`，列表摘要补充 `inspirationCategoryId / inspirationCategoryName / version`，排序统一按 `updatedAt desc`；后台页面将 `BLOCKED` 菜谱集中展示为“下架”视图。`POST /admin/recipe-images` 是后台系统菜谱临时图片上传入口，只允许 `SUPER_ADMIN` 使用，只接受单张 JPG、PNG 或 WEBP 图片，原图上限为 `10 MB`、解码像素不超过 `4000 万`；封面校验 `3:4`，普通步骤图支持 `3:4`、`1:1`、`16:9` 或原尺寸。服务端应用 EXIF 方向并重新编码移除元数据，临时和正式图片成品均不超过 `500 KB`。接口返回处理后临时图片的 `tempKey + 图片元信息`；后台 JSON 导入的远程图片和批量回填图片也使用相同的原图与成品限制。

`GET /admin/recipes/export` 按可选 `categoryId / keyword / status` 筛选系统菜谱，并接收 `page + pageSize` 分页参数（每页最多 100 条），返回统一 `PageResult`：`items / page / pageSize / total / hasNext`。每条只含导出所需的菜谱 ID、当前 `contentVersionId`、标题、故事、关键词、小贴士、正文步骤提示词和 Wiki 步骤提示词。Admin 按页依次读取并整理全部筛选结果为以菜谱 ID 为 key 的 JSON；步骤序号各自从 1 开始。

`POST /admin/recipe-images` 是后台系统菜谱临时图片上传入口，只允许 `SUPER_ADMIN` 使用，只接受单张 JPG、PNG 或 WEBP 图片，原图上限为 `10 MB`、解码像素不超过 `4000 万`；封面校验 `3:4`，普通步骤图支持 `3:4`、`1:1`、`16:9` 或原尺寸。服务端应用 EXIF 方向并重新编码移除元数据，临时和正式图片成品均不超过 `500 KB`。接口返回处理后临时图片的 `tempKey + 图片元信息`；后台 JSON 导入的远程图片和批量回填图片也使用相同的原图与成品限制。

`/admin/image-generation/*` 是临时后台图片工作台，仅 `SUPER_ADMIN` 可调用。`GET/PUT settings` 读取并保存跨管理员共享的默认生图服务、食材关键词、食谱封面关键词和食谱步骤关键词；PUT 必须提交 `expectedVersion`，设置更新成功后 `version` 递增；`GET targets` 按食材 ID 或菜谱 ID 聚合候选位置，支持按分类和缺图状态过滤并分页，Admin 每页读取 20 条，勾选菜谱跨页保留，“全选”只作用于当前页。食材仍使用 `missingOnly` 控制缺图列表；菜谱使用 `recipeImageFilter=ALL|ANY|COVER|STEP|WIKI_STEP`，默认 `ANY`，“仅显示缺图片”匹配其适用图片槽至少缺一张，`COVER/STEP/WIKI_STEP` 分别匹配对应适用槽至少缺一张。筛选由数据库侧判断并分页，只将当前页菜谱正文和 Wiki 加载到应用层。只有作者属于固定 100 人公共内容池且挂有系统分类的系统菜谱，才包含封面和正文步骤图；所有符合条件的菜谱都可包含 Wiki 步骤图。普通用户菜谱即使推荐审核通过并展示在灵感广场，也仍只包含 Wiki 步骤图，不生成封面/基础信息图片和正文普通步骤图。资格按菜谱作者的公共内容池成员关系判断，不能只看 `isInspiration` 或灵感广场展示状态。封面使用食谱封面关键词，正文步骤和 Wiki 步骤共用食谱步骤关键词。`POST generate` 每次只生成一个位置，按共享默认服务选择 Ark Seedream 或火山视觉智能通用 3.0 Provider，提交可编辑 `prompt` 和目标定位，必须带数字字符串 `Idempotency-Key`；同一管理员每分钟最多发起 10 次生图请求。视觉智能按官方 `LogoInfo` 参数添加明水印“炊火记”（`add_logo=true`、`logo_text_content="炊火记"`）。Admin 可为所选系统菜谱单独批量生成当前缺失的封面候选图，已存在封面或候选的图位会跳过；也可按所选菜谱的全部适用缺图位置批量生成。以上批量生图均复用单图生成接口，结果先作为候选预览，不直接替换。候选图可逐张替换，也可按所选菜谱或单个菜谱一键顺序回填其全部现存候选图，失败项保留候选供重试。替换接口的幂等结果覆盖回填和候选清理，重复请求返回首次结果。Admin 复用 `POST candidates/{candidateId}/apply`，不增加批量写接口。列表仅返回候选 DTO 字段，不返回候选行的创建管理员 ID 等内部字段。API 内部 `ImageGenerationProvider` 隔离供应商，首版提供 Ark Seedream 和火山视觉智能通用 3.0 两种实现，切换共享默认服务不改变 Admin/候选/回填契约。`ARK_API_KEY`、`ARK_IMAGE_MODEL` 和可选 `VOLCENGINE_CV_API_KEY` 必须仅配置在 API 服务环境；视觉智能通过 `openapi.cv.volces.com/api/common/v3/process` 调用，固定 `req_key=high_aes_general_v30l_zt2i`，`ARK_IMAGE_ENDPOINT` 可选，缺省为北京方舟图像生成地址。候选图先进入后台临时 OSS 区，数据库仅保存目标、提示词和临时 key；重新生成成功后清理旧候选，失败时保留旧候选。公共内容池系统菜谱图片替换遵循创建不可变内容版本的规则；普通用户 Wiki 图片（包括已推荐到灵感广场的菜谱）只更新 Wiki 快照。删除或替换只清理临时候选 OSS 图，不删除任何已发布图片。食材成品固定为 500×500、≤250 KB；菜谱图成品 ≤500 KB，封面候选自动裁切为 3:4；步骤与 Wiki 步骤候选默认 3:4，可选 1:1、16:9 或由生图服务返回原生尺寸。`POST generate` 对菜谱目标可选提交 `aspectRatio=3:4|1:1|16:9|ORIGINAL`，省略时默认 `3:4`；食材固定使用 `1:1`。

`POST /admin/recipes/{recipeId}/images/backfill` 只允许 `SUPER_ADMIN` 调用，必须带数字字符串 `Idempotency-Key`。请求按菜谱分组，提交 `images[{fileName, tempKey}]`；文件名严格使用 `{contentVersionId}_{recipeId}.jpg`、`{contentVersionId}_{recipeId}_step{n}.jpg` 或 `{contentVersionId}_{recipeId}_step_wiki{n}.jpg`。服务端必须校验菜谱仍为 ACTIVE 系统菜谱、文件名 ID 对应路径菜谱、版本仍为当前版本、槽位存在且目标唯一，再将临时图片固化并回填。仅封面图时更新 `Recipe.coverImageUrl`；任一正文或 Wiki 步骤图回填时，创建新的当前 `RecipeContentVersion`，仅替换命中的图片 URL，并复制原版本的标签、营养、完整度、Wiki 快照与已解锁记录；历史固定版本和其引用不变。版本冲突或目标校验失败时不写入数据库并清理本次已固化的未引用图片。封面图片校验 `3:4`，步骤图片按裁剪结果保留对应比例。

`GET /admin/recipe-wiki` 只返回 `Recipe.status = ACTIVE` 且当前固定正文版本 Wiki 尚未 `READY` 的菜谱，草稿、回收、下架和删除菜谱不进入列表。列表同时返回 `contentVersionId`、来源（用户 UID/昵称或“公共内容池”）、Wiki 状态、是否存在申请、最近申请时间和最近申请人。`GET /admin/recipe-wiki/{recipeId}/export` 与 `POST /admin/recipe-wiki/export` 分别导出单个或批量 `recipe.wiki.v1` / `recipe.wiki.batch.v1` JSON；每条数据必须带 `recipeId`、`contentVersionId`，正文不在导出范围内。`POST /admin/recipe-wiki/import` 只接受这两种 JSON，服务端校验菜谱仍为 ACTIVE 且正文版本 ID 一致，只替换当前版本的 Wiki 标签和助理步骤，并将 Wiki 置为 `READY`，不创建或修改菜谱正文；READY 会把对应申请的预扣次数转为正式消耗并通知申请人。`POST /admin/recipe-wiki/{recipeId}/reject` 写入拒绝原因、释放当前版本所有申请人的预扣次数并向申请人提供拒绝提示。上述后台写接口均要求管理员权限和数字字符串 `Idempotency-Key`（单纯导出和列表除外）。

`GET /admin/recipe-wiki` 的摘要包含 `hasImportWiki`；`POST /admin/recipe-wiki/{recipeId}/quick-fill` 请求体必须提交 `expectedContentVersionId`，从关联导入记录读取 Wiki 标签和助理步骤，写入菜谱当前版本，不修改正文或封面。服务端校验正文版本未变化，且当前 Wiki 尚未 `READY`；版本过期或已有可用 Wiki 时返回冲突。该操作替换 OPS 来源的待审核标签和助理步骤，保留已确认及自动推导标签；单值标签已有记录时不重复导入，多值餐别只跳过相同值。写入要求 `SUPER_ADMIN` 和数字字符串 `Idempotency-Key`。

## 后台系统数据同步

`GET /admin/system-data/export?categories=...` 导出 `cook.data-snapshot.v2` ZIP 快照；manifest 带 `sourceEnvironment = TEST | ONLINE`、导出时间、所选类别和图片清单。`POST /admin/system-data/preview` 与 `POST /admin/system-data/import` 通过 multipart 字段 `file` 接收 ZIP。三条接口只允许 `SUPER_ADMIN`，导入写操作还要求数字字符串 `Idempotency-Key`。

预览响应包含 `cleanupEffects`，逐类列出替换目标记录时由数据库级联删除或解除关联的本地行数；`retainedUserCount` 返回因受保护关联而保留的目标 TEST 本地账号数，`remappedUserCount` 返回按手机号匹配并沿用本地关联 ID 的线上账号数。目标为 TEST 且选择用户类别时，线上账号按手机号与被保留的本地账号匹配，快照内指向该用户的外键同步改写到本地 ID；会员兑换码、公共内容池、存储账本或用户审计关联保持不变。若无法唯一匹配或快照中的另一个账号占用映射目标 ID，预览阻止导入。菜谱营养快照/版本标签唯一键若命中本次选择类别所管理的菜谱版本，会纳入本次替换；仍属于未选类别的数据继续阻止导入。

类别包括用户及个人数据、勋章、菜谱分类、菜谱、食材分类、系统食材、食材营养表、单位、文章和文章栏目。营养表和单位可不选。用户快照包含所选账号自己的个人食材和个人单位，按快照用户 ID 限定归属；不导出或导入密码哈希、微信身份、认证会话、短信/风控记录、提醒任务、分享令牌/凭据、幂等/审计记录、兑换码、支付记录、存储账本或临时上传。用户快照保留手机号、账号 ID 和业务记录关联（包含餐桌话题参与记录，依赖话题本身已存在于测试环境）。目标 TEST 中依赖被替换用户/饭局的分享凭据等本地关联会按预览所列数量级联清理或解除；提醒任务同样不从线上导入。用户在测试环境通过本地手机号/微信手机号授权登录同手机号账号。菜谱和文章引用的受管图片文件随 ZIP 搬迁并在目标环境生成新 URL；外部图片 URL 保持原值。本轮不搬迁头像、勋章图、饭局照片/小程序码。

导入只替换 manifest 列出的类别，并清理这些类别中目标环境额外记录；未选择类别保持不变。预览显示各类别总数、新增、覆盖和清理数量，另列出未打包但会随所选记录级联删除或解除关联的本地行数，并返回受保护关联对应的保留账号数、手机号匹配复用本地 ID 的账号数及绑定 ZIP 摘要、目标环境和所选类别当前数据的指纹；导入事务会重新核对指纹，文件或目标数据变化时必须重新预览。所有所选数据的外键依赖必须由包内记录或目标环境现存记录满足；菜谱正文 JSON 引用将清理的食材或单位也作为阻断依赖。缺失时按依赖类别和数量提示并阻止导入，管理员需补选依赖类别、重新导出。TEST 用户类别替换时，仍被会员兑换码、公共内容池、存储账本或用户审计记录引用的账号不删除，其受保护关联保留；同手机号的线上用户快照复用本地 ID，并改写包内相应用户外键，其他所选个人数据仍按快照替换。存储账本不读取、复制或清理。用户类别仅对 TEST 全量替换放开普通本地账号 ID/手机号冲突；涉及保留账号的映射歧义仍阻断。导入数据库写入在一个事务内完成；新写入图片采用失败补偿。系统菜谱归属账号使用目标环境现有公共内容池，不同步系统池账号。ZIP 压缩文件最大 200 MB，单个解压文件最大 200 MB、解压后最大 1 GB、记录最多 200,000 条；模型未知和关联字段会被拒绝。导出响应为 `application/zip` 二进制内容。

目标环境必须配置 `SYSTEM_DATA_ENVIRONMENT=TEST | ONLINE`。线上只接受来自测试环境的一次导入；导入成功后，线上到测试环境的同步成为唯一允许方向，且测试环境拒绝非线上来源的数据包。未配置环境标识时接口拒绝同步。该能力不自动同步或记录数据集版本历史；旧 v1 JSON 包不接受导入。

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

> 2026-09-24 低维护 V1：食材只记录“有 / 没有 / 未确认”，不保存精确数量、批次、到期日，不计算库存差额、不预占或扣减。购物项勾选“已买”只记录购买行为；用户完成清单时，服务端将已勾选项记为食材“有”，未勾选项保持未买。

```text
GET  /users/me/medals
GET  /users/me/cook-assistant-usage
GET  /meal-plans
GET  /meal-plans/{planItemId}/cook-context
GET  /meal-plans/{planItemId}/cook-assistant
POST /meal-plans/{planItemId}/cook-assistant/unlock
POST /meal-plans
POST /meal-plans/{planItemId}/complete
POST /meal-plans/{planItemId}/start-cooking
POST /meal-plans/{planItemId}/cancel
POST /meal-plans/{planItemId}/confirm-menu
POST /meal-plans/{planItemId}/cooking-complete
GET  /dining-events
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
POST /dining-events/{eventId}/wishes
POST /dining-events/{eventId}/wishes/{wishItemId}/support
POST /dining-events/{eventId}/wishes/{wishItemId}/menu
DELETE /dining-events/{eventId}/wishes/{wishItemId}/menu
POST /dining-events/{eventId}/respond
POST /dining-events/{eventId}/bring
POST /dining-events/{eventId}/my-note
POST /dining-events/{eventId}/complete
POST /dining-events/{eventId}/cancel
POST /dining-events/{eventId}/preparations
POST /dining-events/{eventId}/prepare
POST /dining-events/{eventId}/start-cooking
GET  /fridge-traces
GET  /fridge-traces/summary
POST /fridge-traces/present
POST /fridge-traces/present/batch
POST /fridge-traces/empty
POST /fridge-traces/empty/batch
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
POST /shopping-lists/{listId}/items/check
POST /shopping-lists/{listId}/items/{itemId}/remove
POST /shopping-lists/{listId}/void
POST /shopping-lists/{listId}/complete
POST /shopping-lists/{listId}/restore
POST /shopping-lists/{listId}/copy
POST /shopping-lists/{listId}/delete
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
GET  /meal-plans/{planItemId}/shopping-gap
GET  /dining-events/{eventId}/shopping-gap
```

```ts
type MealPlanStatus = "PLANNED" | "COMPLETED" | "CANCELLED";
type MealSlot = "BREAKFAST" | "LUNCH" | "AFTERNOON_TEA" | "DINNER" | "LATE_NIGHT";
type MealPollStatus = "OPEN" | "CLOSED" | "CONFIRMED" | "COMPLETED";
type MealPollCandidateStatus = "ACTIVE" | "PENDING" | "REJECTED";
type ActivityState = "PENDING" | "DONE" | "EXPIRED";
type MedalAwardRule =
  | "MEAL_COMPLETION"
  | "DINING_EVENT_COMPLETION"
  | "GROUP_MEAL_COMPLETION"
  | "FULL_LOOP_COMPLETION"
  | "SHOPPING_COMPLETION"
  | "FRIDGE_MAINTENANCE"
  | "MEMORY_SHARE_STARTED_TOTAL"
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
  cookingStartedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  hasDiningEvent: boolean;
  diningEventId: UUID | null;
  shoppingListId: UUID | null;
  shoppingListName: string | null;
  shoppingListStatus: "ACTIVE" | "COMPLETED" | "VOIDED" | null;
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
  displayName: string | null;
  avatarUrl: string | null;
  guestName: string | null;
  sourceType: "DINING_GROUP" | "SHARE";
  status: "INVITED" | "ACCEPTED" | "DECLINED" | "REMOVED";
  bringRecipes: Array<{
    recipeId: UUID | null;
    recipeVersionId: UUID;
    title: string;
  }>;
  note: string | null;
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
  keywords: string[];
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
  shoppingListId: UUID | null;
  shoppingListName: string | null;
  shoppingListStatus: "ACTIVE" | "COMPLETED" | "VOIDED" | null;
  menu: RecipeContentSnapshot;
  menuItems: DiningEventMenuItemSummary[];
  participants: DiningEventParticipantSummary[];
  hasActiveShareLink: boolean;
  shareTokenPath: string | null;
  completedAt: IsoDateTime | null;
  ingredientsReadyAt: IsoDateTime | null;
  cookingStartedAt: IsoDateTime | null;
  version: number;
  createdAt: IsoDateTime;
}

interface DiningEventShareLinkResponse {
  shareTokenPath: string;
  expiresAt: IsoDateTime | null;
}

interface SharePreviewResponse {
  organizerText: string;
  title: string;
  eventId: UUID;
  planItemId: UUID | null;
  planDate: string | null;
  mealSlot: MealSlot | null;
  scheduledAt: IsoDateTime;
  coverImageUrl: string | null;
  organizerName: string | null;
  organizerAvatarUrl: string | null;
  inviteStatus: "ACTIVE" | "OPENED" | "ACCEPTED";
  participants: Array<{
    displayName: string | null;
    avatarUrl: string | null;
  }>;
  menuPreview: Array<{
    title: string;
    recipeId: UUID | null;
    recipeKind: "my" | "inspiration";
  }>;
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

interface FridgeTraceIngredientSummary {
  id: UUID;
  ingredientId: UUID | null;
  name: string;
  categoryName: string | null;
  kind: "PURCHASED" | "USED" | "MANUAL_PRESENT" | "MANUAL_EMPTY";
  presence: "PRESENT" | "EMPTY" | "UNCONFIRMED";
  label: string;
  recordedAt: IsoDateTime;
  windowDays: 7 | 15;
  archived: boolean;
  recentlyPurchased: boolean;
}

interface FridgeTraceSummaryResponse {
  totalCount: number;
  recentCount: number;
  latestTime: IsoDateTime | null;
}

interface FridgeTraceRemovalResult {
  deletedCount: number;
}
```

`GET /fridge-traces?page=1&pageSize=20&categoryId=5001` 按食材聚合返回当前用户的家里食材痕迹，在数据库内完成状态归并后筛选和分页；最新状态为旧 `MANUAL_EMPTY` 的食材不再计入列表或摘要，其历史痕迹由前向迁移清理。`categoryId` 可省略以读取全部分类，或传正式食材分类 ID 进行服务端筛选。单页最多 100 项。蔬菜、水果等易腐食材 7 天、其他或未知分类 15 天后降为“未确认”；超过 30 天移入折叠区但不删除。最近购买提示仅保留 3 天。痕迹不包含数量、单位、批次或到期日，不参与采购差额计算。未关联到当前有效食材分类的历史痕迹只出现在未筛选列表中。

`POST /fridge-traces/present` 使用 `Idempotency-Key`，请求体为 `{ ingredientId?: UUID | null, name, categoryName?: string | null }`，记录用户明确确认的“有”。`POST /fridge-traces/empty` 使用相同请求体，删除当前用户该食材身份下的全部家里食材痕迹，不写入“没有”状态；单项和批量删除接口都返回 `{ deletedCount }`。`POST /fridge-traces/present/batch` 与 `POST /fridge-traces/empty/batch` 使用 `Idempotency-Key`，请求体为 `{ items: Array<{ ingredientId?: UUID | null, name, categoryName?: string | null }> }`，最多 100 项；服务端在单个事务中去重处理，“确认有”写入痕迹，“家里没有”删除当前用户各食材身份下的全部痕迹，重复请求返回同一结果。食材 ID 仅在对应食材为系统可用或当前用户 ACTIVE 个人食材时关联；其他 ID 按名称痕迹处理。分类由服务端从已验证食材读取，忽略客户端分类。删除只作用于当前用户的家里食材痕迹，不删除系统/个人食材主档或购物清单记录。购物项勾选“已买”会记录 `PURCHASED` 痕迹；饭局完成后的逐项确认调用对应单项状态接口。`GET /fridge-traces/summary` 返回不同食材的最新痕迹总数 `totalCount`、仍在 7/15 天确认窗口内的食材数 `recentCount`，以及最近记录时间 `latestTime`。两个计数都是食材种类记录数，不代表可用数量或精确库存。

`POST /meal-plans` 继续用于创建或更新本人某一天某餐次的计划，但当前一个餐次可同时承载多道菜；请求体固定提交：

```ts
interface CreateMealPlanRequest {
  planDate: string;
  mealSlot: MealSlot;
  expectedVersion?: number | null;
  title?: string | null;
  menuItems: Array<{
    slotType?: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE" | null;
    sortOrder: number;
    recipeId: UUID | null;
    recipeVersionId: UUID;
    purchaseState: "READY" | "PENDING";
  }>;
  note?: string | null;
}
```

同一用户同一 `planDate + mealSlot` 同时只允许一条非取消计划；取消记录保留菜单与状态，不占用该日期餐次，新计划会创建独立记录；公开 `menuItems[]` 写入表示“按本次整顿菜单覆盖当前餐次”。`recipeId = null` 仅可用于保留当前同一计划中已存在且 `recipeId` 为空的菜品，服务端按原菜品保留菜位与采购状态；不能用它新增或引用其他计划的菜谱版本。新建时若未显式传 `title`，服务端默认写成 `餐次 + 饮食计划`，例如 `早餐饮食计划`、`晚餐饮食计划`；后续整餐更新若不传 `title`，继续保留现有标题。计划页新增“添加计划”时，允许用空数组 `menuItems = []` 先创建一条当前日期 + 餐次的空白计划壳子，菜单快照默认写成 `餐次待补充`，后续再去详情页补菜；但这条放宽只适用于“当前餐次原本不存在计划”的新建场景。覆盖已有计划时必须提交当前 `expectedVersion`，版本不一致返回业务 `code=409`；已有计划不允许用空数组把菜单整体清空，已经完成的餐次也不允许再被覆盖。旧 `recipeIds[]` 不再接受。当前历史老计划项允许 `slotType = null`；新计划项若省略或传 `null`，服务端按固定菜谱版本的已确认餐次/菜位标签推导菜位类型，无法推导时返回业务错误，提示先补充标签。保留当前计划中已有的历史菜品时允许继续保留其 `slotType = null`。新写入仍须提供 `recipeVersionId / purchaseState`。`POST /meal-plans/{planItemId}/complete` 只允许计划拥有者调用，并把该餐次从 `PLANNED` 推进到 `COMPLETED`，语义为计划拥有者明确确认这顿饭已完成；若计划仍关联未完成饭局，则必须先由饭局发起人完成饭局，不能借计划接口代替饭局确认。取消计划不计入开饭打卡。`POST /meal-plans/{planItemId}/cancel` 只允许所有者在计划日期结束前、且未关联有效饭局时调用；计划状态改为 `CANCELLED`，菜单和历史保留，不进入完成后的食材更新流程。同日期同餐次可以另建计划，取消记录保留但不占用餐次。`POST /meal-plans/{planItemId}/dining-event` 继续从计划餐次创建饭局，但已完成餐次不得再发起新饭局；若当前计划已经固定菜单，新饭局直接以 `CONFIRMED` 状态创建。若该餐次已经挂有未结束饭局，后续继续改计划菜单时，服务端会同步刷新这场饭局的标题、菜单快照和菜单项，避免计划与饭局各自漂移成两份事实。

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

`POST /meal-plans/{planItemId}/confirm-menu` 只允许计划 owner 调用，要求当前餐次至少已有一道菜，且必须提交最新 `expectedVersion`。成功后服务端把 `MealPlanSummary.menuLocked` 置为 `true`，并同步把当前未结束饭局推进到 `CONFIRMED`。菜单固定后，不再允许通过 `POST /meal-plans` 或 `POST /meal-plans/items` 修改结构性内容，包括换菜、增删、排序和切换菜谱版本；但计划标题、饭局时间、餐次时间展示仍可继续调整。确认成功只锁定菜单，不创建采购清单、不写购物项，也不读取冰箱库存；详情页展示当前固定菜谱的完整准备需求，用户点击“去采购”后才生成完整需求清单。来源需求按同食材且同单位合并，`适量` 保留为文字，不伪造精确数量。

做饭完成可记录本顿涉及的食材痕迹，不做数量扣减：

```ts
interface CompleteCookingRequest {
  markWholeTable?: boolean;
}

interface CookingTraceResponse {
  planItemId: UUID;
  recordedAt: IsoDateTime;
  usedCount: number;
  message: string;
}
```

`POST /meal-plans/{planItemId}/cooking-complete` 只记录当前用户负责菜涉及的“用过”痕迹；饭局没有责任菜时，需明确提交 `markWholeTable = true` 才记录整桌。该痕迹不改变食材“有 / 没有”状态，不参与采购或库存计算，不提供撤销写口。数字字符串 `Idempotency-Key` 重复提交返回第一次结果。

饭局列表统一走摘要接口：

```ts
GET /dining-events?page=1&pageSize=20&role=ALL&stage=TODO&planDate=2026-08-24&mealSlot=DINNER
```

查询参数最小固定为：

```ts
interface DiningEventListQuery {
  page?: number;
  pageSize?: number;
  role?: "ALL" | "ORGANIZER" | "PARTICIPANT";
  stage?: "ALL" | "TODO" | "ACTIVE" | "DONE";
  planDate?: string;
  mealSlot?: MealSlot;
}
```

`GET /dining-events` 只返回当前用户可见的饭局摘要和分页信息，不再允许前端先拉整包 `/meal-plans` 再本地筛饭局、也不应再按列表项逐条补 `GET /dining-events/{eventId}`。`role` 和 `stage` 都由服务端执行筛选；`stage = ALL` 只用于“按某个餐次精确回查当前饭局”这类局部场景。`planDate + mealSlot` 是可选精确过滤条件，当前用于“直接发起饭局”冲突后回查同餐次已存在饭局，避免一次性拉整天或整月所有计划。列表继续按 `page / pageSize` 分页，饭局页触底加载必须直接复用这条分页接口。

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

> 做饭助手目标契约已于 2026-09-13 确认并完成第一阶段核心迁移；旧 `POST /meal-plans/{planItemId}/cook-assistant`、会员实时补洞、`isStale` 和覆盖重生成不再作为用户侧助手链路继续扩展。

按菜谱做饭与做饭助手是两条独立读取链路：

- `GET /meal-plans/{planItemId}/cook-context` 只返回当前菜单固定版本及原始菜谱步骤，供计划和关联饭局的多菜谱沉浸模式使用；它不读取 Wiki、不生成快照、不扣次数。
- `GET /meal-plans/{planItemId}/cook-assistant` 读取同一餐次的共享内容状态和当前用户解锁状态；未解锁时不得返回快照正文。
- `POST /meal-plans/{planItemId}/cook-assistant/unlock` 负责首次生成或复用共享快照，并在成功后完成当前用户的永久解锁；请求体为空，必须携带数字字符串 `Idempotency-Key`。

本餐助手目标始终是 `MealPlanItem`。计划和其关联饭局复用同一个目标、同一份成功快照；主理人和参与者不会得到各自不同的助手内容。新建饭局必须关联计划餐次，历史脱钩饭局不提供做饭助手；存在关联饭局时，不允许物理删除计划并留下脱钩饭局。

计划所有者和关联饭局中状态为 `INVITED / ACCEPTED` 的用户可以读取做饭上下文并使用助手；`DECLINED / REMOVED` 或无关系用户不可读取。饭局角色只决定对象访问权，不改变活动次数、Loading、快照内容或永久解锁规则。

```ts
type CookAssistantContentStatus = "NOT_GENERATED" | "GENERATING" | "READY" | "FAILED";
type CookAssistantStepSource = "WIKI" | "ORIGINAL";

interface CookAssistantUsageResponse {
  activityEnabled: boolean;
  businessDate: string;
  dailyUnlockLimit: number;
  usedCount: number;
  remainingCount: number;
  resetsAt: IsoDateTime | null;
}

interface MealCookContextDish {
  dishId: UUID;
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  coverImageUrl: string | null;
  sortOrder: number;
  content: RecipeContentSnapshot;
}

interface MealCookContextResponse {
  planItemId: UUID;
  diningEventId: UUID | null;
  title: string;
  planDate: string;
  mealSlot: MealSlot;
  dishes: MealCookContextDish[];
}

interface MealCookAssistantDishSource {
  dishId: UUID;
  recipeVersionId: UUID;
  title: string;
  source: CookAssistantStepSource;
}

interface MealCookAssistantStep {
  order: number;
  phase: RecipeAssistantStepPhase;
  title: string;
  detail: string;
  dishIds: UUID[];
  imageUrl: string | null;
  durationText: string | null;
  source: CookAssistantStepSource;
  parallelKey: string | null;
}

interface MealCookAssistantSnapshot {
  contractVersion: number;
  generatedAt: IsoDateTime;
  title: string;
  summary: string | null;
  dishes: MealCookAssistantDishSource[];
  steps: MealCookAssistantStep[];
  notes: string[];
}

interface MealCookAssistantResponse {
  planItemId: UUID;
  diningEventId: UUID | null;
  status: CookAssistantContentStatus;
  unlocked: boolean;
  unlockedAt: IsoDateTime | null;
  generatedAt: IsoDateTime | null;
  assistant: MealCookAssistantSnapshot | null;
}

interface UnlockMealCookAssistantResponse extends MealCookAssistantResponse {
  newlyUnlocked: boolean;
}
```

`GET /users/me/cook-assistant-usage` 返回服务端当前活动日的用量事实。活动期间默认每日首次解锁上限为 `2`，单菜与本餐共用；当日未用次数不累计。成功解锁事实永久保留，不受活动结束或未来会员到期影响。

本餐第一次成功生成时冻结菜单、固定菜谱版本、每道菜实际使用的 `WIKI / ORIGINAL` 来源和生成时间。部分菜没有可用 Wiki 时可以明确使用原始步骤参与编排；全部菜都没有可用 Wiki 时不生成助手并返回业务 `code=409`。之后菜谱、Wiki、菜单或开饭时间变化均不得覆盖成功快照，也不对外暴露 `isStale` 或普通用户重生成入口。

共享内容尚未生成时，首次解锁可以启动同一份生成任务；并发请求必须复用任务。只有内容成功且当前用户仍有次数时，才在同一短事务中完成当日计数、永久解锁和幂等完成记录。生成失败不扣次数；生成成功但该用户的次数已被其他并发请求用完时，可保留共享内容，但不得写入该用户解锁事实。

每个用户首次成功解锁后，客户端独立展示一次随机时长的“思考 Loading”；这只是体验层，不得通过服务端阻塞或重复生成模拟。重复进入已解锁助手不再展示首次 Loading，也不扣次数。

隐藏对象或调用者无权得知其存在时返回业务 `code=404`；对象已知但饭局参与状态无权时返回 `code=403`；Wiki 不可用、全部菜无 Wiki、成功快照禁止重生成或幂等键冲突时返回 `code=409`；活动未开放或当日次数耗尽时返回 `code=429`。正常未生成、生成中、已生成通过成功响应的 `status` 表达，客户端不得解析展示 `message` 控制流程。

### 随机页最小真实流程

随机页当前已确认的业务目标不是“娱乐型摇一摇”，而是：

```text
选条件 -> 生成一桌 -> 逐道调整 -> 加入计划
```

随机菜单不读取或确认库存，生成及调整后的菜谱可直接加入计划。当前接口固定为 4 个最小动作：

```text
POST /random-menus/generate
GET  /random-menu-quota
POST /random-menu-slots/replace
POST /meal-plans
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
  currentItems?: Array<{
    slotId: string;
    slotType: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE";
    sourceType: "MY" | "INSPIRATION";
    recipeId: UUID;
    recipeVersionId: UUID;
  }>;
  rejectedRecipeVersionIds?: UUID[];
}

interface RandomMenuQuotaResponse {
  limitCount: number;
  usedCount: number;
  remainingCount: number;
  windowStartedAt: IsoDateTime;
  windowEndsAt: IsoDateTime;
}
```

约束：

1. `peopleCount` 当前建议限制为 `1 ~ 12`。
2. 单次总菜位数当前建议最大 `12`。
3. 生成次数由服务端按 7 天窗口校验并扣减，V1 最多 7 次，`RANDOM_MENU_WEEKLY_LIMIT` 环境配置可调低但不能超过 7；仅当本次至少生成一道菜时扣减。全空结果不扣次数，但同一用户在 60 秒内连续 11 次全空生成时返回业务 `code=429` 与 `data.retryAfterSeconds`；具体额度以后端返回为准，前端不得写死。
4. 接口不写随机结果历史、不做缓存。
5. 响应只返回当前菜单摘要、来源、推荐理由、`matchedIngredients: string[]` 和最新次数摘要；`matchedIngredients` 仅包含当前用户可用冰箱食材与该菜谱食材交集的展示名称，不返回库存数量、冰箱条目 ID、完整菜谱正文、步骤或全量食材明细。

`GET /random-menu-quota` 用于读取当前用户随机一桌生成次数，不扣减次数，响应为 `RandomMenuQuotaResponse`。

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
    sourceType: "MY" | "INSPIRATION";
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
    recipeId: UUID | null;
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
4. 若该餐次已完成或菜单已固定，返回业务 `code=409`。
5. 响应继续返回最新 `MealPlanSummary`，不额外返回无关上下文数据。
3. `purchaseState = PENDING` 对应“保留但暂不采购”。
4. `recipeVersionId` 由客户端显式提交，服务端必须校验与 `recipeId` 的真实匹配关系。

#### 购物写入

随机页 V1 不提供直接写入采购清单入口，也不接入随机菜单购物写入接口。用户确认这一桌后先保存到计划，食材缺口由计划详情和采购清单链路继续处理。

#### 安全、性能与过渡边界

1. 随机页所有接口都要求登录。
2. 服务端不得信任客户端传回的 `title / durationText / estimatedCalories / flavorTags / quantityText` 作为事实。
3. 随机计算接口默认不缓存；只有证明查询成本高且失效边界清晰时才允许单独评审缓存。
4. 本功能当前不新增随机草稿表、随机历史表、随机候选缓存表。
5. 计划写入只接受 `menuItems[]`，不保留 `recipeIds[]` 兼容输入。

购物域以“购物清单 + 清单项”为唯一采购主流程。购物清单页面负责展示需求、手动添加食材和勾选已买；不保留独立超市模式、采购历史页或旧个人购物事实接口。

计划或饭局需求预览返回：

```ts
interface ShoppingGapPreviewItem {
  id: UUID;
  name: string;
  quantityText: string | null;
  note: string | null;
  sourceCount: number;
  sourceTitles: string[];
  sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
  sourceKey: string | null;
  status: "OPEN" | "BOUGHT" | "DELETED";
  preparationStatus: "OPEN" | "BOUGHT" | "HOME" | "READY";
  updatedAt: IsoDateTime;
}

type ShoppingListStatus = "ACTIVE" | "COMPLETED" | "VOIDED";
type ShoppingListRole = "OWNER" | "COLLABORATOR";
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
  recipeKind: "my" | "inspiration" | null;
  sourceVersionId: UUID | null;
  planItemId: UUID | null;
  planDate: string | null;
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
  amount: RecipeAmountSnapshot | null;
  note: string | null;
  status: "OPEN" | "CHECKED" | "REMOVED";
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

1. 新购物流程统一使用 `/shopping-lists*`；随机菜单不直接写购物项，加入计划后在计划详情选择“去采购”。

`GET /shopping-lists/summary` 返回购物首页顶部 3 张状态卡片所需的统计：

```ts
interface ShoppingListSummaryResponse {
  statuses: ShoppingListStatusCount[];
  defaultStatus: ShoppingListStatus;
  activeListCount: number;
  pendingItemCount: number;
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

食材项按创建时间倒序返回；勾选状态更新不改变清单顺序。客户端按该顺序聚合展示，不按已购/未购状态移动食材行。

1. `categoryName`、`imageUrl`：供食材卡片直接展示分类和封面；没有图片时客户端显示占位图。
2. `quantityText` 是展示用需求量；`amount` 是可精确汇总的结构化用量快照，单位以 `unitId` 判断。手动添加项的 `amount` 为空；其文本仅在数量与单位文字均可解析且单位文字相同时汇总，勾选“已买”不改写需求量，也不扣减库存。
3. `categoryName`、`imageUrl` 用于展示食材分类和封面，没有图片时显示占位图。
4. 清单摘要里的 `progressDoneCount / progressTotalCount` 按食材项统计；已勾选项计入完成数。

同食材的多个结构化来源仅在全部为精确用量且 `unitId` 相同时累加；只要有模糊用量或单位不同，分组行统一显示“适量”。手动文本无法解析或单位文字不同，也显示“适量”。

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
若这顿餐次已经绑定过另一张采购清单，服务端直接返回冲突，不允许把同一顿餐次改绑到别的清单；若本次写入的就是当前已绑定清单，则允许只补新增来源，不重复改绑。

`POST /shopping-lists/{listId}/items/from-plan` 用于把一顿计划里的完整准备需求一次性写入购物清单，避免前端逐菜循环时出现部分成功：

```ts
interface AddPlanToShoppingListRequest {
  planItemId: UUID;
}
```

服务端必须校验该计划属于当前用户，并读取当前固定菜谱版本生成完整需求：不读取或扣除冰箱库存；同食材合并为一项，同单位的精确数量相加；单位不一致或任一来源为 `适量` 时，该项显示 `适量`，不做单位换算；底层仍按各菜谱食材来源保存，未移除来源跳过，计划来源的移除墓碑恢复为移除前的 `OPEN / BOUGHT` 状态，手动来源项不被修改。重新打开关联计划清单时会执行本接口以同步和恢复来源项。任一菜谱版本或当前食材状态校验失败时整单回滚，不允许留下部分成功的购物项。
写入成功后，服务端会把这顿餐次绑定到当前采购清单，并在后续 `MealPlanSummary / DiningEventSummary` 里回传 `shoppingListId / shoppingListName / shoppingListStatus`，供前台优先回跳到已绑定清单。若该餐次已绑定别的采购清单，则返回冲突；若已绑定当前清单，则只补当前来源键尚不存在的需求，不重复累计已有来源。来源键以计划 ID 为前缀，详情读取仍可反查计划来源。

`POST /shopping-lists/{listId}/items/from-gap` 用于把需求页当前选中的食材写入指定购物清单：

```ts
type ShoppingGapWindow = "NEXT_48_HOURS" | "NEXT_7_DAYS" | "LATER";

interface AddShoppingGapItemsRequest {
  window: ShoppingGapWindow;
  gapKeys: string[];
}
```

服务端必须按当前登录用户当下的饭局菜单重新生成完整需求，只接受当前时间层里仍有效的 `gapKeys`；写入时按真实来源饭局拆成 `EVENT` 来源购物项，同一张清单里已存在相同 `sourceKey` 的来源项（包括已买或用户移除的墓碑）时跳过，不重复堆叠，也不读取冰箱库存。

`POST /shopping-lists/{listId}/items/from-event-gap` 用于把某个饭局当前完整需求写入指定购物清单，供饭局详情定向写入：

```ts
interface AddEventGapToShoppingListRequest {
  eventId: UUID;
}
```

服务端必须校验该饭局属于当前登录用户，并只按这一个饭局的当前菜单重新生成完整需求；不能把同一时间层里其他饭局碰巧同名同单位的食材一起写入，也不读取冰箱库存。
若该饭局对应的餐次尚未绑定采购清单，写入成功后同样把这顿餐次绑定到当前清单；若此前已绑定其他清单，则返回冲突，不允许跨清单改绑。

`POST /shopping-lists/{listId}/items/{itemId}/check` 用于勾选或取消采购完成：

```ts
interface UpdateShoppingListItemCheckRequest {
  version: number;
  checked: boolean;
}
```

低维护 V1 中所有 `ACTIVE` 清单项都通过这条勾选链路标记 `已买`；不根据冰箱库存禁用或替代勾选。

这条接口成功后不再回整份 `ShoppingListDetail`，而是返回 `ShoppingListItemPatchResponse`：只带清单新 `version`、顶部进度，以及当前变更的购物项。

`POST /shopping-lists/{listId}/items/check` 用于原子保存同一食材分组卡片的一次勾选变化。客户端点击勾选或取消勾选后立即请求；分组卡片下关联的多条来源项通过 `items` 一次更新：

```ts
interface UpdateShoppingListItemChecksRequest {
  version: number;
  items: Array<{ itemId: UUID; checked: boolean }>;
}
```

`items` 必须为 1 至 500 项且 `itemId` 不重复。服务端在一个事务中校验清单版本和所有项目，应用勾选变化并最多递增一次清单版本；任一项目无效或版本冲突时整批回滚。成功后返回更新后的 `ShoppingListDetail`。客户端只提交本次分组卡片里状态实际发生变化的项目；请求期间锁定该卡片，防止重复提交和清单版本竞争。

`POST /shopping-lists/{listId}/items/{itemId}/remove` 用于把食材项从当前有效采购项中移除，不抹掉来源事实：

```ts
interface RemoveShoppingListItemRequest {
  version: number;
}
```

这条接口成功后返回 `ShoppingListItemPatchResponse`，其中 `removedItemId` 表示需要从当前列表移除的那一项。

`POST /shopping-lists/{listId}/members/{memberUserId}/remove` 只允许清单创建者在 `ACTIVE` 状态下移除一个已加入的普通协作者；创建者本人和 `OWNER` 角色当前不能通过这条路径移除：

```ts
interface RemoveShoppingListMemberRequest {
  version: number;
}
```

购物清单状态流转：

1. `ACTIVE`：采购中，可编辑、可共享、可勾选完成、可作废。
2. `COMPLETED`：已完成，可复制和删除。
3. `VOIDED`：已作废；自 `voidedAt` 起保留 30 天，期限内可恢复、复制和删除。超过期限后禁止恢复/复制，后台任务每日 00:00（Asia/Shanghai）开始分批永久清理过期清单和食材项；个人空间统计暂停期间不读取、更新或清理对应空间账本记录。已完成清单不受此期限影响。

`POST /shopping-lists/{listId}/void`、`POST /shopping-lists/{listId}/complete` 和 `POST /shopping-lists/{listId}/restore` 当前只接收并发控制字段：

```ts
interface UpdateShoppingListStatusRequest {
  version: number;
}
```

`POST /shopping-lists/{listId}/complete` 仅允许清单创建者完成采购。服务端在一个事务中校验清单版本、把清单改为 `COMPLETED` 并关闭清单分享；将 `BOUGHT` 项记为当前用户食材状态“有”，不改变未勾选项，也不修改计划或饭局状态。该操作带 `Idempotency-Key`，并发版本冲突时整体回滚。

`POST /shopping-lists/{listId}/copy` 会复制当前清单的有效食材项，并生成一张新的 `ACTIVE` 清单；若操作者是协作者，复制结果默认归该操作者个人所有，不继承原协作成员。

`POST /shopping-lists/{listId}/delete` 只允许清单创建者删除 `COMPLETED / VOIDED` 清单，当前也只接收并发控制字段：

```ts
interface DeleteShoppingListRequest {
  version: number;
}
```

删除后，这张清单及其清单项不再出现在购物清单首页和详情中。

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

`GET /shopping-gap` 当前只汇总“当前用户待处理饭局”的时间分层菜单需求，不再要求先选某一场饭局。它不读取冰箱食材状态、不计算库存差额；是否购买由用户自行决定，只有显式加入后才写入清单。响应固定分成 `NEXT_48_HOURS / NEXT_7_DAYS / LATER` 三段，每段按食材平铺。同食材合并为一项；所有来源用量都是同一精确单位时相加，否则显示 `适量`，不做单位换算，并返回：

1. `key`：当前时间层内该条需求的稳定键，供后续 `from-gap` 写入使用。
2. `ingredientId / name / quantityText`：食材主视角摘要。
3. `sourceCount / eventCount`：当前条目覆盖了几道菜、几场饭局。
4. `events[]`：每场来源饭局的 `eventId / title / scheduledAt / recipeTitles[]`，用于页面展示“这条需求对应哪些饭局、哪些菜谱”。

`GET /meal-plans/{planItemId}/shopping-gap` 只预览当前用户指定计划餐次的完整准备需求，不写入购物清单。服务端校验计划归属，读取该餐次固定菜谱版本生成完整需求，并按对应计划来源购物项是否已买返回 `preparationStatus = OPEN / BOUGHT`；不读取或扣除冰箱库存。响应为 `ShoppingGapPreviewItem[]`，供计划详情页展示准备状态和剩余待准备数量。没有需求时返回空数组。

`POST /meal-plans/{planItemId}/start-cooking` 只允许计划 owner 对已确认菜单且没有关联饭局的计划调用；服务端校验计划需求均已标记为已买后写入 `cookingStartedAt`，并增加计划 `version`。重复调用返回已经记录的计划状态。`POST /meal-plans/{planItemId}/complete` 只允许计划 owner 在开始做饭后确认计划完成；关联饭局的计划仍由饭局完成流程推进。两个写接口均接受数字字符串幂等键。

`POST /dining-events/{eventId}/preparations` 只允许饭局发起人在已确认菜单、尚未“已备齐”或开始做饭前，按当前预览返回的 `sourceKey` 设置或撤销本顿“家里有”；该确认只属于当前饭局，不写入长期食材状态。`POST /dining-events/{eventId}/prepare` 由发起人确认整顿已备齐，服务端写入 `ingredientsReadyAt`；`POST /dining-events/{eventId}/start-cooking` 仅在整顿已备齐或所有需求都已买/家里有时成功，并写入 `cookingStartedAt`。两者均要求菜单已确认并接受数字字符串幂等键。饭局完成接口在开始做饭后允许无接受参与人的饭局结束。

`GET /dining-events/{eventId}/shopping-gap` 只预览当前用户指定饭局的完整准备需求，不写入购物清单。服务端允许饭局发起人和状态为 `ACCEPTED` 的参与人读取；按当前菜单的固定菜谱版本生成需求，不读取或扣除冰箱库存。响应为 `ShoppingGapPreviewItem[]`，供饭局详情页展示当前饭局的食材、用量和准备状态；准备状态为 `OPEN / BOUGHT / HOME / READY`，分别代表待准备、已买、家里有和整顿已备齐。客户端采购预览不显示菜谱来源名。没有需求时返回空数组。对应的购物清单写入仍按饭局发起人和清单权限规则单独校验。

准备需求合并规则当前保持：

1. 只围绕固定菜谱版本生成需求，不以冰箱库存判断是否需要购买。
2. 同种食材自动合并为一项；全部来源用量为同一精确单位时相加，单位不一致或任一来源为 `适量` 时显示 `适量`。
3. `sourceCount` 返回该条需求实际覆盖了几道菜。
4. 来源菜谱事实仍分别保留；模糊或混合单位只影响合并项的数量提示，不做虚假单位换算。

共享清单当前不要求实时协同。详情页使用“操作后刷新 + 页面重进刷新 + 下拉刷新 + 轻轮询”即可；所有写接口必须提交 `version`，冲突时返回业务 `code=409`，提示客户端刷新后重试。

饭局创建时会同时生成一条当前有效的好友邀请。创建响应和后续 `GET /dining-events/{eventId}` 仅向饭局发起人返回该条 `shareTokenPath`；参与人只能看到 `shareTokenPath = null`。小程序据此在首次点击“分享邀请”时直接进入微信原生分享，不再先请求生成链接。

邀请路径由邀请记录 ID 加服务端签名构成，服务端不保存可复原的明文 token。饭局完成、取消或发起人主动关闭前，当前未使用链接保持不变；一条链接被某个账号接受后，服务端自动补一条新的待分享链接给发起人，原链接仍只对已接受账号保留只读查看语义。

本合同从旧哈希 token 切换到签名邀请 ID 时，服务端无法从旧哈希还原此前已发出的明文链接；部署后，未结束饭局会获得新的当前链接，发起人需要重新分享一次。

`POST /dining-events/{eventId}/share-link` 仅用于发起人明确“更换邀请链接”时生成或重置当前饭局的邀请分享链接，请求头继续使用 `Idempotency-Key`，请求体为空。饭局未取消、未完成时可成功。响应最小固定为：

```ts
interface DiningEventShareLinkResponse {
  shareTokenPath: string;
  expiresAt: IsoDateTime | null;
}
```

分享页继续复用现有 `/pages_share/preview/index?token=...` 预览页，不单独新开页面；饭局完成后主分享动作切到饭局卡快照。

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

`POST /dining-events/{eventId}/my-note` 用于当前参与人补充或清空本次饭局专属备注，请求头继续使用 `Idempotency-Key`，请求体最小固定为：

```ts
interface UpdateDiningEventParticipantNoteRequest {
  note: string | null;
}
```

该备注属于“饭局 + 参与人”关系，不会写回个人口味档案，也不替代主家的公开 `DiningEventSummary.note`。仅当前饭局成员可写，空字符串按 `null` 处理，最大 `255` 个字符；参与人摘要里的 `note` 供主家参与人管理和饭局成员查看。成员读取饭局详情时，`shoppingListId / shoppingListName / shoppingListStatus` 固定返回 `null`，客户端不展示采购清单、食材准备和缺口区域。

`GET /share/{shareToken}/preview` 继续作为饭局邀请落地页读取口，但现在只返回登录前可公开展示的轻信息，不再直接暴露完整菜单食材和精确地点。最小响应固定为：

```ts
interface SharePreviewResponse {
  organizerText: string;
  title: string;
  eventId: UUID;
  planItemId: UUID | null;
  planDate: string | null;
  mealSlot: MealSlot | null;
  scheduledAt: IsoDateTime;
  coverImageUrl: string | null;
  organizerName: string | null;
  organizerAvatarUrl: string | null;
  inviteStatus: "ACTIVE" | "OPENED" | "ACCEPTED";
  participants: Array<{
    displayName: string | null;
    avatarUrl: string | null;
  }>;
  menuPreview: Array<{
    title: string;
    recipeId: UUID | null;
    recipeKind: "my" | "inspiration";
  }>;
  countdownText: string | null;
  locationHint: string | null;
}
```

`GET /share/{shareToken}/viewer` 只在登录后调用，用来读取当前账号对这条邀请的真实动作权限，避免客户端按预览态猜按钮。最小响应固定为：

```ts
interface SharePreviewViewerResponse {
  action: "ACCEPT" | "VIEW" | "BLOCKED";
  statusHint: string | null;
}
```

`POST /share/{shareToken}/accept` 仍要求登录；当前采用“一条链接先到先得”的受控好友邀请策略：同一条链接首次被某个账号接受后，会把这位用户固化到这条邀请记录上，后续其他账号再拿到同一链接时统一拒绝进入。由于当前账号体系还没有微信身份绑定，这里只能做到“单链接单账号消费”，不能强校验“分享目标 A 的微信身份必须等于登录账号 A”。

`POST /dining-events/{eventId}/cover` 用于上传或替换饭局封面图，小程序原图最多 `5 MB`，服务端居中裁切并重新编码为 `4:3`，成品最多 `500 KB`；请求头继续使用 `Idempotency-Key`，表单字段最小固定为：

```ts
interface UpdateDiningEventCoverRequest {
  expectedVersion: number;
  file: File;
}
```

当前只允许饭局发起人调用；服务端按 `expectedVersion` 防并发覆盖，并把图片固化成饭局公开资源。读取 `GET /dining-events/{eventId}` 时，若当前饭局已有封面图，摘要里的 `coverImageUrl` 返回可直接展示的公开地址，路径必须指向真实对象 key，例如 `/static/uploads/dining-event-covers/{eventId}/{fileName}.{ext}` 或静态域名下的 `/uploads/dining-event-covers/{eventId}/{fileName}.{ext}`；若没有封面图则返回 `null`。

`POST /dining-events/{eventId}/wishes` 用于参与人把自己的私房菜一次性加入当前饭局的我想吃池，请求体只接收 1～3 道不重复菜谱：

```ts
interface ChooseDiningEventWishRecipeRequest {
  recipeIds: UUID[];
}
```

`POST /dining-events/{eventId}/wishes/{wishItemId}/support` 用于参与人附议或取消附议一道现有提议，请求体只接收：

```ts
interface UpdateDiningEventWishSupportRequest {
  action: "SUPPORT" | "UNSUPPORT";
}
```

提议者不能撤回已经被主理人加入当前菜单的自己的提议；服务端以当前饭局菜单为准校验该限制。

`POST /dining-events/{eventId}/wishes/{wishItemId}/menu` 用于饭局发起人把某道我想吃加入本次菜单，不接收额外请求体。`我想吃池` 只作为菜单确认参考，不改写个人购物、冰箱、带菜或菜谱所有权。

`DELETE /dining-events/{eventId}/wishes/{wishItemId}/menu` 用于饭局发起人把对应菜谱从当前饭局菜单及绑定的计划餐次移除，不删除成员的心愿或支持记录，也不接收额外请求体。请求必须携带 `Idempotency-Key`；饭局必须仍可编辑、菜单未固定，且计划餐次至少保留一道菜。移除与计划菜单快照更新在同一事务内完成。

`POST /dining-events/{eventId}/bring` 继续用于“我带菜”，请求体为 0～3 道不重复的 `recipeIds`，每次提交完整替换当前参与人的带菜集合；空数组用于清空自己的带菜安排，非空菜谱必须属于当前参与人并引用其固定版本。`POST /dining-events/{eventId}/complete` 只允许饭局发起人调用；当且仅当该饭局至少已有 1 位状态为 `ACCEPTED` 的参与人时才允许完成。已取消饭局不得完成，已完成饭局重复调用时直接返回当前摘要，不再次改写状态。

`POST /dining-events/{eventId}/cancel` 只允许饭局发起人取消尚未到开饭时间、且没有任何 `ACCEPTED` 参与人的饭局。取消会在同一事务内删除饭局及其对应计划和内容，包括饭局子项、计划菜单和活动摘要；并删除这场饭局与计划产生的未购买采购来源，更新受影响的采购清单版本。已购买采购项及已写入冰箱的痕迹属于独立事实，继续保留；关联投票解除已确认资源关联。取消不生成回忆、不派发完成勋章、不触发做饭库存消耗。事务提交后清理饭局封面对象。响应仅为 `{ id, status: "CANCELLED" }`，不回传已删除内容；幂等记录也仅保存该最小结果。同一幂等键重放返回该结果；资源删除后以其他幂等键请求返回不存在。客户端二次确认说明饭局、对应计划和菜单内容将删除且无法恢复，并在成功后回到“我的饭局”列表。

饭局与纯计划详情另提供 `GET /dining-events/{eventId}/reminder`、`POST /dining-events/{eventId}/reminder`、`GET /meal-plans/{planItemId}/reminder` 和 `POST /meal-plans/{planItemId}/reminder`。状态响应只包含 `status: NOT_SCHEDULED | SCHEDULED | SENT | FAILED` 与 `scheduledAt: IsoDateTime | null`；写接口不接收用户、时间或模板字段，必须携带数字字符串 `Idempotency-Key`。饭局发起人和状态为 `ACCEPTED` 的参与人只能为自己预约；计划只允许计划所有者预约。服务端要求当前用户已有与 `WECHAT_APP_ID` 匹配的微信身份，并在同一事务保存用户提醒和 `MEAL_REMINDER_SEND` Outbox 项。

饭局按 `scheduledAt - 2 小时` 投递；纯计划按服务端参考时点（早餐 08:00、午餐 12:00、下午茶 15:30、晚餐 18:30、夜宵 21:30，Asia/Shanghai）提前两小时投递，但模板预约时间只展示计划日期。若目标时间不足两小时，不创建预约。模板 ID 为 `LJwjRWjXD6Hod0iJnswKX91ZTyq3bqQM6HtDb1FiiDo`，模板 2233「预约到期提醒」，字段为 `date2.DATA` 与 `thing3.DATA`；饭局备注按微信 `thing` 字段最多 20 字的限制压缩为类似 `18:30开饭，约2小时后开始，可准备。`，计划备注类似 `今天有晚餐计划，可提前准备。`。饭局调整时间时重排未发提醒；饭局/计划完成或取消时删除待发提醒及未处理 Outbox 工作。Worker 只消费 `MEAL_REMINDER_SEND`，不得处理其他 Outbox 类型。

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
4. 饭局发起人第一次从饭局详情打开活动回忆卡时，客户端会调用本接口创建首份快照，并生成该饭局唯一的微信小程序码；之后创建新快照、重新导出海报或修改本地标题都复用这张码，不再向微信重复申请。
5. 每次生成仍会固化为新的 `snapshotVersion`，后续饭局改动不会回写历史快照；二维码的稳定公开入口则始终读取该饭局最新一份回忆快照。
6. 快照只允许包含 `title / planDate / mealSlot / coverImageUrl / miniCodeUrl / menuItems(title, coverUrl) / participants(displayName, avatarUrl, role) / caption / sharedAt / snapshotVersion` 这些白名单字段。`coverImageUrl` 是生成时复制出的封面资产，不读取后续活动封面；`miniCodeUrl` 归饭局所有，使用饭局 ID 的服务端签名作为 `scene`，只打开既有 `pages_share/memory/index` 公开回忆卡页，不暴露饭局或计划 ID。

`GET /memory-shares/{shareToken}/preview` 是餐桌回忆卡的公开读取路径，无需登录；它校验饭局稳定签名后，只返回该饭局最新回忆快照的白名单字段。不得暴露投票详情、内部备注、个人冰箱、购物清单、过敏忌口、内部主键、权限字段或调试字段。该路径与现有 `GET /share/{shareToken}/preview` 的饭局邀请预览分离，不能复用或混淆。

`POST /dining-events/{eventId}/memory-share-started` 只记录回忆分享发起事实，不生成快照。仅饭局发起人可调用，饭局必须已完成且已有回忆卡快照；请求体为空对象并携带数字字符串 `Idempotency-Key`。同一饭局只记录首次成功调起分享菜单的时间，重复调用返回 `recorded=false`，首次记录返回 `recorded=true`。小程序仅在微信页面分享回调触发或 `showShareImageMenu` 调用成功后调用；保存图片到相册、预览、自动创建快照和生成海报不调用该接口。该事实只证明分享已发起，不证明图片送达、对方打开或保存。

`GET /users/me/medals` 当前按模板返回可见勋章，不再写死在接口层。服务端当前只根据真实完成事实和真实审核收录事实自动点亮，包括：

- `MEAL_COMPLETION`：明确确认完成用餐累计达到模板阈值；饭局完成时发起人和完成时仍为已接受状态的参与人各计一餐；已完成的关联计划与饭局合并为一餐。
- `DINING_EVENT_COMPLETION`：完成饭局累计达到模板阈值，统计发起人和已接受参与人。
- `GROUP_MEAL_COMPLETION`：作为发起人完成至少有 1 位已接受参与人的饭局，累计达到模板阈值。
- `FULL_LOOP_COMPLETION`：首发只统计饭局：所需食材均已通过准备流程确认完成（已买、家里已有或无需采购），且饭局由发起人确认完成，累计达到模板阈值。纯计划餐次没有逐项准备事实，不计入首发完整闭环。
- `SHOPPING_COMPLETION`：非空清单成功完成采购且所有未删除项均为已买；每人每天最多计两张。
- `FRIDGE_MAINTENANCE`：食材库发生真实新增或“有”改为“没有”的变化；重复确认相同状态不计，每人每自然周最多计一周。
- `MEMORY_SHARE_STARTED_TOTAL`：已完成饭局的发起人主动发起微信回忆分享，同一场饭局最多计一次；只证明分享发起，不代表送达。
- `RECOMMENDATION_ADOPTED_TOTAL`：推荐收录累计达到模板阈值，只统计菜谱推荐和食材推荐审核收录或归并，不统计单位推荐。

当前勋章接口不返回任务进度、差几次、会员加成、排行榜、分享送达奖励或后台发放状态。勋章图片改为后台独立上传，后台可分别维护 `earnedImageUrl / lockedImageUrl` 两张图；用户侧优先按获得状态读取对应图片，没有对应图片时才回退到另一张图，再回退到现有 `iconKey` 展示。公开资源接口会按原始文件类型返回 `image/png / image/jpeg / image/webp / image/svg+xml`；微信小程序场景下，勋章若使用 `SVG`，继续走后台公开 URL，由页面 `<image>` 直接加载网络资源。勋章只能由服务端在完成餐次、完成饭局、完成采购清单、食材库真实状态变化、回忆分享发起事实或后台审核通过推荐事务里派生；客户端不得提交任何“点亮勋章”字段。

### 菜谱

菜谱当前链路冻结为：`草稿 -> 发布到私房菜`、`灵感系统菜谱 -> 改编为私房菜`，以及“灵感菜谱按固定版本直接加入计划”。加入计划不创建或更新私房菜；用户创建、编辑和保存不会自动进入系统库，只有推荐审核通过后才生成系统菜谱。合集不再是前台菜谱入口，历史合集接口暂不删除，以保留已有固定引用。

当前规则补充：系统菜谱统一使用 `isInspiration = true` 且挂系统分类作为业务口径，不能仅以 owner 判断灵感菜谱。每条菜谱都必须有 owner；后台直接创建和导入发布从 100 人公共内容用户池随机选择 active owner，用户推荐审核收录则保留推荐者为 owner。池成员必须保持 `ACTIVE`，后台不得将其禁用；初始化脚本会先移除已禁用成员，再补足至 100 人。菜谱创建时冻结 owner 昵称快照，后续改名不回写。用户菜谱满足发布必填项即可发布，标签、营养、Wiki 和完整度等派生事实由服务端按当前 `RecipeContentVersion` 持久化；Wiki 发布时只登记 `PENDING`，不在发布事务内同步生成。正式菜谱用量接受互斥的精确结构 `EXACT(quantity + unitId)` 与唯一模糊结构 `FUZZY(text = "适量")`；“适量”不是系统单位，所有食材类别均可使用，服务端仍校验模糊用量与精确数量、单位互斥。

```ts
type RecipeDifficulty = "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING";
type RecipeDuration = "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60";
type UnitType = "WEIGHT" | "VOLUME" | "COMMON" | "PACKAGE";
type IngredientSource = "SYSTEM" | "PERSONAL";
type InspirationSort = "RECOMMENDED" | "LATEST";

type RecipeAmountInput =
  | { kind: "EXACT"; quantity: string; unitId: UUID }
  | { kind: "FUZZY"; text: "适量" };

type RecipeAmountSnapshot =
  | { kind: "EXACT"; quantity: string; unitId: UUID; unitName: string; unitType: UnitType }
  | { kind: "FUZZY"; text: "适量" };

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
  code: string;
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
  durationMinutes: number | null;
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

interface RecipeCookAssistantResponse {
  recipeVersionId: UUID;
  status: "MISSING" | "PENDING" | "GENERATING" | "NEEDS_REVIEW" | "READY" | "FAILED" | "REJECTED";
  unlocked: boolean;
  unlockedAt: IsoDateTime | null;
  generatedAt: IsoDateTime | null;
  requestAt: IsoDateTime | null;
  rejectionReason: string | null;
  assistant: RecipeAssistantSnapshot | null;
}

interface UnlockRecipeCookAssistantResponse extends RecipeCookAssistantResponse {
  newlyUnlocked: boolean;
}

interface RequestRecipeCookAssistantResponse extends RecipeCookAssistantResponse {
  newlyRequested: boolean;
  usage: CookAssistantUsageResponse;
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
    fuzzyText: "适量" | null;
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

保存草稿时仅强制校验 `content.name` 非空；其余发布必填项允许暂时为空。草稿里的分类、场景、食材和单位引用即使当前已失效，也不阻塞保存，原始输入继续保留在 `content` 里；详情里的 `category / scenes / ingredientRefs / unitRefs` 只回填当前仍能解析到的真实引用。用户私房菜草稿最多包含 20 个步骤，保存请求和发布服务均不得接受更多步骤。发布时再统一校验名称、有效个人分类、`1～20` 人份、已选择难度、已选择时长、至少一个有效食材、精确用量必须同时具备正数数量和单位、模糊用量必须固定为“适量”且与精确数量/单位互斥，以及至少一个“文本或图片至少其一非空”的步骤；模糊用量不受食材分类限制。食材最多 100 项；精确数量使用最多三位小数的十进制字符串。切换到“适量”时清空数量与单位，切回精确单位时数量保持空且不恢复旧值。菜谱编辑页中已绑定 `ingredientId` 的食材名称只读；更换食材通过选择器完成，选择不同 `ingredientId` 时清空原精确数量并使用新食材默认单位，重新选择同一食材时保留当前数量和单位；提交与正式版本名称快照均以 `ingredientId` 对应的服务端食材为准。

菜谱图片的当前链路固定为：

1. 编辑阶段图片只保留在小程序本地缓存，不写服务端。
2. 本地图片在进入上传链路前，先经过客户端裁剪页处理：封面固定 `3:4`；步骤图默认 `3:4`，可选 `1:1`、`16:9` 或原尺寸；小程序选择的原图最多 `5 MB`。服务端实际解码、应用 EXIF 方向、重编码并限制解码像素不超过 `4000 万`，临时和正式成品最多 `500 KB`。
3. 用户点击“存草稿”或“发布”时，若还没有 `draftId`，先创建草稿。
4. 前端随后调用 `POST /uploads/images` 逐张上传本地图片，服务端创建或替换同一 `slotKey` 的临时图片，并将草稿图写入 `uploads/recipe-images/.tmp/{draftId}/{publicId}.{ext}`；返回的 `imageUrl` 指向该临时对象。临时图片读取必须登录且只允许草稿所有者，响应为 `Cache-Control: private, no-store`；小程序通过带鉴权的文件下载接口取本地临时路径供图片组件预览。
5. 上传成功后，前端再把 `coverUploadId / coverImageUrl / steps[].uploadId / steps[].imageUrl` 写回草稿正文。
6. 发布时服务端先取得正式 `recipeId`，在数据库事务外为每张当前草稿图片生成新的 `publicId` 并复制到 `uploads/recipe-images/{recipeId}/{publicId}.{ext}`，再于事务内重新校验草稿版本、图片归属及复制时的 `storageKey / publicId / updatedAt / sourceHash`，更新图片记录的 `publicId / storageKey` 并绑定发布版本；事务失败时清理本次独立目标对象，提交成功后删除临时源对象。图片记录 ID 保留。独立目标键避免并发发布互相覆盖或清理对方对象；已发布旧版本继续保留自己已引用的图片，不因新版本替换而删掉。

后台菜谱正式图片与小程序共用 `uploads/recipe-images/{recipeId}/{fileName}`，不再写入 `admin-recipe-images/`。后台上传待保存图片使用 `uploads/recipe-images/.tmp/admin/{tempKey}`，正式保存时按所属菜谱 ID 归档。

菜谱图片读取不兼容旧后台路径。删除清理时仅兼容解析历史 `uploads/admin-recipe-images/{fileName}` 与 `admin-recipe-images/{fileName}` 对象键，清理器不会为这些路径提供读取服务。

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

分类和场景重排提交完整作用域的 `ReorderItem[]`，分类内菜谱重排提交 `ReorderRecipesRequest`。三者都不得缺失、重复或混入越权 ID。服务端锁定最小作用域并逐项比较版本，冲突返回业务 `code=409`。

```ts
interface MyRecipeSummary {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  difficultyText: string | null;
  durationText: string | null;
  keywords: string[];
  estimatedCalories: number | null;
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
  category: RecipeCategorySummary | null;
  inspirationCategory: InspirationCategorySummary | null;
  scenes: RecipeSceneSummary[];
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  assistantAvailable: boolean;
  planLinks: RecipePlanLinkSummary[];
  ingredientRefs: IngredientSummary[];
  unitRefs: UnitSummary[];
  canRecommend: boolean;
  recommendation: RecipeRecommendationSummary | null;
  owner: RecipeOwnerSummary;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface RecipeDetailPersonal {
  category: RecipeCategorySummary | null;
  scenes: RecipeSceneSummary[];
  planLinks: RecipePlanLinkSummary[];
  ingredientRefs: IngredientSummary[];
  unitRefs: UnitSummary[];
  canRecommend: boolean;
  recommendation: RecipeRecommendationSummary | null;
  owner: RecipeOwnerSummary;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  version: number;
  createdAt: IsoDateTime;
}

interface RecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  difficultyText: string | null;
  durationText: string | null;
  inspirationCategory: InspirationCategorySummary | null;
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  nutrition: RecipeNutritionSummary;
  assistantAvailable: boolean;
  personal: RecipeDetailPersonal | null;
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
  assistantAvailable: boolean;
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
  keywords: string[];
  estimatedCalories: number | null;
  category: InspirationCategorySummary;
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
  assistantAvailable: boolean;
  collectCount: number;
  owner: { uid: number; nickname: string | null };
  updatedAt: IsoDateTime;
}

type RecipeViewSourceType = "MY" | "INSPIRATION";

interface RecipeViewHistoryItem {
  id: ResourceId;
  recipeId: ResourceId | null;
  title: string;
  coverImageUrl: string | null;
  sourceType: RecipeViewSourceType;
  lastViewedAt: IsoDateTime;
  isAvailable: boolean;
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

三类普通菜谱详情只返回当前固定版本的 `assistantAvailable`，不返回 Wiki 或助手正文。该字段只有在固定版本存在已经验证的 `READY` Wiki 时为 `true`；`PENDING / GENERATING / NEEDS_REVIEW / FAILED` 均为 `false`。按菜谱做饭始终读取 `content.steps`，不根据该字段切换步骤来源。

R1 用户写接口与私有读路径：

```text
GET/POST /recipe-categories
PUT /recipe-categories/{categoryId}
POST /recipe-categories/reorder
GET/POST /recipe-scenes
PUT /recipe-scenes/{sceneId}
POST /recipe-scenes/reorder
POST /ingredients
PUT /ingredients/{ingredientId}
POST /ingredients/{ingredientId}/recommendations
POST /ingredients/{ingredientId}/feedbacks
GET /ingredient-recommendations
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
GET /recipe-versions/{recipeVersionId}/cook-assistant
POST /recipe-versions/{recipeVersionId}/cook-assistant/request
POST /recipe-versions/{recipeVersionId}/cook-assistant/unlock
POST /recipes/reorder
  POST /recipes/{recipeId}/delete
  POST /users/me/recipe-history
  GET /users/me/recipe-history
  POST /users/me/recipe-history/{historyId}/delete
```

`GET /recipes` 只返回本人已发布私房菜，支持分页、关键词、个人分类、系统分类、难度和时长筛选。查询参数为 `page`、`pageSize`、`keyword`、`categoryId`、`inspirationCategoryId`、`difficulty` 和 `duration`。私房菜固定按个人分类顺序、更新时间返回，不提供灵感专属的推荐/最新排序；用户显式保存到私房菜但未指定分类时允许 `category = null`，客户端展示为“未分类”，用户可之后在编辑时归类。加入计划不创建私房菜。新建和编辑正文统一经过草稿发布，系统分类可由用户在高级设置中选择。

`GET /recipes/{recipeId}` 是菜谱详情的可选登录读取接口，响应使用 `RecipeDetail`。接口始终返回普通菜谱数据：标题、封面、正文固定版本、难度、时长、系统灵感分类、营养结果、做饭助手可用状态和更新时间；`personal` 只在请求带有效 `Authorization` 且当前用户是该菜谱持有人时返回，内容包括个人分类、场景、计划关联、编辑用食材/单位引用、自荐状态、持有人快照、状态、版本和创建时间。匿名请求、失效 token 匿名重试以及非持有人请求的 `personal` 均为 `null`，服务端不得为这些请求查询上述个人关系；页面正文仍正常展示。需要登录的编辑、计划、采购和助手操作由用户点击后再触发登录，不在详情读取阶段弹出登录。`POST /recipe-drafts/{draftId}/publish` 等仍返回 `MyRecipeDetail`，其顶层个人字段只供已识别的当前用户流程使用。

`GET /recipe-versions/{recipeVersionId}/cook-assistant` 只允许能访问该固定菜谱版本的登录用户调用，始终返回 Wiki 状态、当前用户申请时间/拒绝原因和是否已可直接打开；非 `READY` 时 `assistant = null`，不得泄露 Wiki 正文，不能用 Wiki 是否有值代替状态判断。`POST /recipe-versions/{recipeVersionId}/cook-assistant/request` 请求体为空，必须携带数字字符串 `Idempotency-Key`；首次申请立即预扣当前用户当日 `1` 次，重复申请只更新最近申请时间且不重复扣次，申请本身不因用户或菜谱来源共享次数。后台置为 `READY` 后预扣转为正式消耗，申请用户再次点击直接打开且不再扣次；后台拒绝时释放预扣并返回拒绝原因。申请中的 `PENDING / GENERATING / NEEDS_REVIEW` 和 `REJECTED` 不允许重复申请，拒绝后应先重新编辑菜谱生成新正文版本。`POST /recipe-versions/{recipeVersionId}/cook-assistant/unlock` 仅保留已存在的直接解锁兼容流程；单菜目标绑定 `recipeVersionId`，同一菜谱后续新版本是新的 Wiki 目标，不继承旧版本申请或解锁事实。

`POST /users/me/recipe-history` 只允许登录用户调用，请求体只接收当前可访问的 `recipeId`，请求头必须带 `Idempotency-Key`。服务端按用户和菜谱 ID 去重，重复查看更新 `lastViewedAt`，返回 `RecipeViewHistoryItem`。`GET /users/me/recipe-history` 只返回当前用户记录，按 `lastViewedAt desc, id desc` 分页，服务端当前最多返回最近 `100` 条，单页最多 `20` 条。列表会关联菜谱当前最新摘要；菜谱不可用时保留记录并返回 `isAvailable = false`、`title = "该菜谱已不可用"`、`coverImageUrl = null`。`POST /users/me/recipe-history/{historyId}/delete` 只删除当前登录用户自己的浏览记录，不删除菜谱；路径 `historyId` 为正整数，请求头必须带数字字符串 `Idempotency-Key`，成功返回 `data = null`。这组接口不返回固定正文版本，也不参与随机一桌推荐。

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

`POST /recipes/from-inspiration` 请求体只接收灵感来源和可选个人分类，用于用户显式保存到私房菜，不接收 `sceneIds`。加入计划通过 `POST /meal-plans` 直接引用可访问菜谱及固定正文版本，不调用此接口。

```json
{
  "sourceRecipeId": 10002101,
  "sourceVersionId": 10001101,
  "categoryId": null
}
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
    "categoryId": 10000000,
    "inspirationCategoryId": 6001,
    "sceneIds": [10000000],
    "coverUploadId": null,
    "coverImageUrl": null,
    "baseServings": 2,
    "difficulty": "EASY",
    "duration": "WITHIN_15",
    "tips": "番茄最后下锅",
    "ingredients": [
      {
        "ingredientId": 10004001,
        "quantity": "300",
        "unitId": 3001
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

`GET /inspiration-recipes` 支持 `page`、`pageSize`、`keyword`、`categoryId`、`sort`、`difficulty` 和 `duration`。`sort` 只允许 `RECOMMENDED` 或 `LATEST`，`duration` 只允许 `WITHIN_15 / BETWEEN_15_30 / BETWEEN_30_60 / OVER_60`。匿名只返回审核通过且允许曝光的固定版本，不返回个人持有、额度、分类、场景或可写状态。当前灵感口径同时覆盖平台直接创建的系统菜谱，以及后台审核通过后复制进系统库的用户推荐菜谱；详情返回菜谱冻结的 `owner { uid, nickname }`，其中 nickname 只用于展示“由某某整理”，不跳用户主页，空值隐藏。公共内容用户池成员资格只在后台用户列表返回，绝不进入用户侧接口。`GET /inspiration-recipes/{recipeId}` 在请求带有效用户 token 时，还会额外返回 `ownedRecipeId`：当前用户已持有该灵感固定版本对应的有效私房菜时返回个人菜谱 ID，否则返回 `null`，供详情页直接把主按钮切到“加入计划”。菜谱不提供点赞能力，推荐排序不使用点赞指标。

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

`GET /ingredient-categories` 允许匿名读取，只返回系统食材正式分类的最小摘要 `id + name`，隐藏兜底分类 `待归类` 不下发给前台录入入口。`GET /ingredients` 支持 `page`、`pageSize`、`keyword`、`categoryId` 和 `source`。`source` 只允许 `SYSTEM`、`PERSONAL` 或 `ALL`；登录态保持原有三种口径，匿名态服务端会强制按 `SYSTEM` 处理，因此不会混入任何个人食材。`SYSTEM` 和 `ALL` 都只返回当前启用中且分类可选的系统食材，`PERSONAL` 只返回本人仍可直接使用的个人食材，不返回已归并条目；当请求命中“全部食材”口径时，系统食材部分按后台全局展示顺序返回；当传了真实 `categoryId` 时，系统食材仍按该分类内顺序返回。食材摘要新增 `imageUrl`，仅系统食材在后台已补图时返回可读图片地址，个人食材固定返回 `null`；同时新增 `recommendationStatus`，当前只返回 `PENDING | REJECTED | null`，用于“我的食材”选择态最小展示 `审核中 / 拒绝后隐藏推荐入口`。`POST /ingredients` 新建一个个人食材，并在创建时拦截与现有系统食材重名的重复项，包括已下架但仍保留治理身份的系统食材；同时禁止使用隐藏兜底分类。`PUT /ingredients/{ingredientId}` 只允许编辑本人未处于审核中的个人食材，并继续禁止切到隐藏兜底分类。`POST /ingredients/{ingredientId}/recommendations` 是显式推荐入口：若系统库已存在启用中的同名食材，则服务端直接归并并生成一条“已归并”记录；否则进入待审核队列。`POST /ingredients/{ingredientId}/feedbacks` 是系统食材纠错入口，只允许对当前可用系统食材提交，请求体固定提交 `name + categoryId + note?`，并要求“名字、分类、备注”至少有一项真正发生变化；同一用户对同一系统食材同一时间只允许保留一条 `PENDING` 纠错。成功后返回 `IngredientFeedbackResult`，前台只做成功提示，不在当前页展开审核态。`GET /ingredient-recommendations` 分页返回“我的推荐”记录，用于显示 `审核中 / 已拒绝 / 已收录 / 已归并`；当状态为 `REJECTED` 时，响应额外返回 `reviewNote + reviewAdvice`，分别承载后台拒绝原因和修改建议。`GET /units` 支持 `page`、`pageSize`、`keyword`、`type` 和 `source`，并允许匿名读取系统单位；登录态保持原有口径，匿名态服务端同样强制按 `SYSTEM` 处理，因此只会返回系统单位。`POST /units` 不再创建个人单位，而是提交一条单位建议；若系统库已存在同名系统单位，则服务端直接归并并生成一条 `MERGED` 记录，否则进入待审核队列。`GET /unit-recommendations` 分页返回“我的单位建议”记录，用于显示 `审核中 / 已拒绝 / 已收录 / 已归并`；当状态为 `REJECTED` 时，同样返回 `reviewNote + reviewAdvice`。`GET /recipe-drafts` 只返回本人草稿箱，查询参数为 `page`、`pageSize` 和 `keyword`；`GET /recipes`、`GET /inspiration-recipes`、`GET /collections/recipes` 与它统一使用同一搜索语义，`keyword` 都按 `菜名 + 故事 + 食材名` 匹配，其中合集基于已收藏固定版本正文检索。`POST /recipe-drafts` 与 `PUT /recipe-drafts/{draftId}` 只返回最小保存结果 `id + recipeId + version + updatedAt`。`GET /recipe-drafts/{draftId}` 与 `GET /recipes/{recipeId}` 额外返回当前内容实际引用到的 `ingredientRefs`、`unitRefs`，用于编辑页补齐超出首屏分页的历史食材与单位；其中 `ingredientRefs.defaultUnit` 只表示食材默认单位，不等于正文里所有真实 `unitId`，因此详情接口仍需单独返回 `unitRefs`。`GET /recipes/{recipeId}`、`GET /inspiration-recipes/{recipeId}` 与 `GET /collections/recipes/{collectionRecipeId}` 现统一补充只读 `nutrition` block，字段固定为 `status / qualityLabel / perServing / perRecipe / calculatedAt / sourceVersion`；前台只展示 `热量 / 蛋白质 / 脂肪 / 碳水` 四项结果，不上传、也不回写任何营养值。`status = COMPLETE` 表示当前固定正文的主要系统食材映射和重量换算较完整；`ESTIMATED` 表示至少一部分食材通过代表值或近似单位换算得出；`INSUFFICIENT` 表示当前仍无法稳定算出结果；`NONE` 只用于当前库里还没有可读营养源版本时的静默空态。该营养结果属于平台派生快照，不进入草稿正文，也不把原始营养库明细、映射候选、人工审校记录暴露给前台。`GET /recipes/{recipeId}` 还返回布尔字段 `canRecommend`，由服务端统一结算当前版本是否允许继续“自荐美食”，前台只按这个结论显示或隐藏入口，不再自行根据来源字段猜测。`POST /recipes/from-inspiration` 是用户显式将灵感菜谱保存到私房菜的入口：请求体固定提交 `sourceRecipeId / sourceVersionId / categoryId?`，其中 `categoryId` 可省略或传 `null`，不再接收 `sceneIds`；服务端直接把当前灵感固定版本加入“我的”，未传分类时保存为“未分类”，不先创建草稿，也不要求客户端跳转编辑页。若同一用户已持有同一 `sourceVersionId` 的有效“我的”菜谱，本轮直接返回已有入口，不再额外创建第二条。 加入计划通过 `POST /meal-plans` 直接引用可访问菜谱及固定正文版本，不调用此接口。`POST /recipes/{recipeId}/recommendations` 是显式“推荐到灵感”入口：只允许本人对当前已发布个人菜谱提交当前固定正文版本，请求体只提交建议系统分类 `inspirationCategoryId`；服务端创建独立推荐记录，并把 `GET /recipes/{recipeId}` 的 `recommendation` 字段更新为最新推荐摘要。审核中时，该个人菜谱不允许继续创建编辑草稿、发布编辑草稿或删除，保证后台审核的固定内容不漂移；用户可通过 `POST /recipe-recommendations/{recommendationId}/withdraw` 撤回待审推荐，撤回后恢复可编辑/可删除。若该个人菜谱最初来自灵感菜谱升级为“我的”，且当前正文与封面仍与当时来源版本完全一致，服务端直接拒绝推荐，不允许把未改动的灵感菜谱再次作为个人投稿提交；对于历史上还没有来源快照的旧个人菜谱，服务端会按“是否与现有系统菜谱的正文和封面完全一致”做同样的识别与拦截。后台审核通过后，服务端复制一份 `sourceVersionId` 指向的固定正文到系统菜谱，新建 `isInspiration = true`、挂系统分类的系统菜谱，并保留来源菜谱的 owner 与冻结昵称快照；原个人菜谱继续保留在“我的”下，不被替换或删除。

详情字段边界补充：上文在菜谱接口总览中提到的 `ingredientRefs / unitRefs / canRecommend / recommendation`，对于 `GET /recipes/{recipeId}` 均归属于 `personal`，不属于匿名返回的普通数据；只有 `POST /recipe-drafts/{draftId}/publish` 等仍返回 `MyRecipeDetail` 的流程，才使用顶层个人字段。

个人空间计量暂缓开放。菜谱、草稿、饭局、计划、冰箱和购物清单写入不计算空间增量、不写入空间账本，也不按个人/会员空间额度拦截。图片上传仍执行文件体积和压缩安全上限，这些限制只用于单次上传安全，不作为空间用量。

个人分类和场景各最多 50 个；个人分类名称最多 8 字，个人场景名称最多 20 字；菜谱名最多 120 字，故事最多 2000 字，小贴士最多 1000 字，食材名最多 64 字，单位名最多 16 字。分类 R1 不提供删除，后续删除前必须先迁移其下菜谱。

完整 owner、主事实、事务、索引和数据库约束见 `plans/recipe-contract-review.md`。菜谱归用户本人，饭搭子关系不改变所有权。

完整现行路径索引见 `docs/api-index.md`。新增或修改字段时，先在对应领域冻结请求和响应，再同步三端本地类型。

## 数据库与事务规则

1. 用户数据以 `userId` 归属，饭搭子关系变化不得改写数据归属。
2. 接受邀请、退出、移除成员和解散必须在事务中完成关系、审计和幂等写入。
3. 动态成员上限通过锁定目标 `dining_groups` 行防止并发突破。
4. 邀请、成员状态和幂等记录使用数据库约束保护。
5. 菜谱生命周期、版本正数、非负计数、冰箱消费状态、购物来源、饭局参与人来源及带菜引用配对由数据库 Check 约束兜底。
6. 同一用户对同一菜谱最多存在一条 `OPEN` 举报，由数据库部分唯一索引保证。
7. 重要生命周期写入 `AuditEvent` 和 `OutboxEvent`；Worker 仅针对已确认的饭局微信提醒 `MEAL_REMINDER_SEND` 启用专用消费者，其他 Outbox 类型保持未消费。
8. 客户端隐藏按钮不是安全边界，所有权限必须在服务端验证。
