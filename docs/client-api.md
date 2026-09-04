# 炊火记客户端 API 手册

## 简介

本文面向小程序和后台调用方，记录当前个人数据、饭局协作与个人会员模型的调用边界。完整路径索引见 `docs/api-index.md`，共享 DTO 见 `docs/api-contract.md`。

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
| 2026-09-04 | 登录改为真实微信手机号授权、真实短信验证码、手机号密码和可轮换 refresh session；旧 `/api/auth/login`、`/api/auth/code-*`、`/api/auth/wechat-login` 已移除。 |
| 2026-08-19 | 饭搭子功能已整体下线，客户端不再保留 `/api/dining-groups*`、`/api/dining-group-invites*` 和后台饭搭子审计字段。 |
| 2026-07-26 | 冻结菜谱 R1 契约，新增个人分类/场景、食材单位、草稿发布、我的菜谱和匿名灵感路径；当前客户端尚未实现，不可按已可调用功能使用。 |
| 2026-07-23 | 用户、会员事实、饭搭子关系和存储用量按领域拆分；移除客户端全局权益快照依赖。 |
| 2026-07-23 | 背景图字段暂时保留，当前统一返回空 URL 和 `false` 能力位；背景设置写接口返回业务 `code=503`。 |
| 2026-07-23 | 饭搭子切换为多关系列表，关系变化不迁移、不冻结个人数据。 |

## 快速索引

| 方法 | Path | 客户端调用 | 职责 |
| --- | --- | --- | --- |
| POST | `/api/auth/wechat/session` | `authApi.wechatSession` | 识别微信身份并返回绑定状态 |
| POST | `/api/auth/wechat/phone-login` | `authApi.loginWithWechatPhone` | 使用微信手机号组件授权登录 |
| POST | `/api/auth/sms/send` | `authApi.sendSmsCode` | 发送真实短信登录验证码 |
| POST | `/api/auth/sms/login` | `authApi.loginWithSms` | 使用短信验证码登录或创建手机号账号 |
| POST | `/api/auth/password/login` | `authApi.loginWithPassword` | 使用手机号密码登录并创建会话 |
| POST | `/api/auth/password/set` | `authApi.setPassword` | 设置初始密码 |
| POST | `/api/auth/password/change` | `authApi.changePassword` | 修改当前密码 |
| POST | `/api/auth/refresh` | `authApi.refresh` | 轮换 refresh token 并刷新会话 |
| POST | `/api/auth/logout` | `authApi.logout` | 吊销 refresh token |
| GET | `/api/auth/me` | `authApi.getMe` | 读取最小认证资料 |
| GET | `/api/users/me` | `userApi.getCurrent` | 账号状态、展示占位和会员事实 |
| PUT | `/api/users/me` | `userApi.updateCurrent` | 更新昵称和头像 |
| PUT | `/api/users/me/display` | `userApi.updateDisplay` | 预留背景设置，当前返回业务 `code=503` |
| PUT | `/api/users/me/password` | `userApi.changeCurrentPassword` | 修改密码 |
| GET | `/api/users/me/taste-profile` | `userApi.getTasteProfile` | 本人口味与安全资料 |
| PUT | `/api/users/me/taste-profile` | `userApi.updateTasteProfile` | 更新本人口味与安全资料 |
| GET | `/api/inspiration-recipes` | `recipeApi.listInspirationRecipes` | 匿名灵感菜谱分页 |
| POST | `/api/recipe-drafts` | `recipeApi.createDraft` | 首次保存草稿 |
| POST | `/api/recipe-drafts/{draftId}/publish` | `recipeApi.publishDraft` | 发布草稿到“我的” |
| GET | `/api/recipes` | `recipeApi.listMyRecipes` | 我的已发布菜谱分页 |
| POST | `/api/collections/recipes` | `recipeApi.collectRecipe` | 收藏灵感固定版本到合集 |
| GET | `/api/admin/user-entitlements` | `userApi.getEntitlements` | 后台分域审计视图 |

## 1. 用户与会员

### 1.1 微信手机号快捷登录

```text
POST /api/auth/wechat/session
Auth: none
```

请求：

```json
{
  "code": "081xYfll2l7mBh4sFEnl2H0jQY0xYfli",
  "deviceId": "device-8c5c"
}
```

已绑定微信身份成功 `data`：

```ts
interface WechatSessionResult {
  status: "BOUND" | "UNBOUND" | "BLOCKED";
  session: AuthSessionResult | null;
  wechatSessionId: string | null;
  retryAfterSeconds: number | null;
}
```

未绑定时，客户端使用返回的短期 `wechatSessionId` 和微信按钮的 `getPhoneNumber` 事件 `phoneCode` 调用：

```text
POST /api/auth/wechat/phone-login
Auth: none
```

```json
{
  "wechatSessionId": "short-wechat-session",
  "phoneCode": "phone-code-from-wechat",
  "deviceId": "device-8c5c"
}
```

该接口返回 `AuthSessionResult`。已绑定身份不需要手机号组件二次绑定；未绑定身份会按微信授权手机号创建或复用手机号账号，并在同一事务中绑定微信身份。

### 1.2 短信验证码登录

```text
POST /api/auth/sms/send
Auth: none
```

```json
{
  "phone": "13800000000",
  "scene": "LOGIN",
  "deviceId": "device-8c5c"
}
```

返回 `{ "cooldownSeconds": 60 }`。验证码有效期为 5 分钟且只能消费一次；当前个人资质阶段由阿里云 PNVS 平台生成并核验，服务端不保存明文验证码。

```text
POST /api/auth/sms/login
Auth: none
```

```json
{
  "phone": "13800000000",
  "code": "123456",
  "deviceId": "device-8c5c"
}
```

返回 `AuthSessionResult`。手机号不存在时，验证成功后创建手机号账号。

### 1.3 密码登录与会话

```text
POST /api/auth/password/login
POST /api/auth/password/set
POST /api/auth/password/change
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

登录、刷新返回：

```ts
interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: IsoDateTime;
  refreshExpiresAt: IsoDateTime;
  user: SessionUser & { phone: string | null };
}
```

`/api/auth/password/set` 和 `/api/auth/password/change` 使用 `UserBearerAuth`，写入的新密码统一要求 8-20 位字符，且至少包含字母、数字、符号中的任意两类。`/api/auth/refresh` 和 `/api/auth/logout` 使用请求体中的 `refreshToken` 与 `deviceId`，不要求 access token；refresh token 每次刷新后立即轮换，旧 token 不能再次使用；logout 成功时 `data=null`。

### 1.4 当前用户

```text
GET /api/users/me
Auth: UserBearerAuth
```

成功 `data`：

```ts
interface MeResponse {
  avatarUrl: string | null;
  profile: {
    cookNo: string | null;
    bio: string | null;
    gender: "MALE" | "FEMALE" | "UNSPECIFIED" | null;
    birthDate: string | null;
  };
  hasPassword: boolean;
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

请求只允许当前资料页已经确认的可编辑字段，每次字段编辑页只提交一个字段：

```json
{
  "nickname": "小明",
  "cookNo": "cook520",
  "bio": "喜欢记录家里的晚饭",
  "gender": "FEMALE",
  "birthDate": "1990-09-04"
}
```

`nickname` 为 2-24 个字符，不能包含 `@<>/`；`cookNo` 为 5-20 位，只允许字母、数字和下划线，服务端用唯一约束兜底；默认 `cookNo` 等于公开 `uid` 时允许首次设置为自定义值，设置为自定义值后只能重复提交相同值，不允许再次修改；`bio` 最多 80 个字符；`gender` 只允许 `MALE / FEMALE / UNSPECIFIED` 或 `null`；`birthDate` 使用 `YYYY-MM-DD`，不能晚于今天，年龄小于等于 14 岁时返回“未满14岁需实名认证”，客户端提示后要求重新选择。成功返回 `MeResponse`。背景图不得混入本接口。手机号绑定或换绑成功后，客户端需刷新 `/auth/me` 并同步 session 中的脱敏手机号展示。

`PUT /users/me` 不接受 `avatarUrl`。头像不通过当前资料写入口直接提交本地路径或外部 URL。客户端在编辑资料页点击头像后，先复用菜谱图片裁剪页，使用固定 1:1 的 `profileAvatar` 裁剪策略，再调用：

```text
POST /api/users/me/avatar
Auth: UserBearerAuth
Header: Idempotency-Key
Content-Type: multipart/form-data
```

请求文件字段为 `file`，服务端只接受 JPG、PNG、WEBP 图片，上传成功后写入当前用户 `avatarUrl` 并返回最新 `MeResponse`。

### 1.4 背景设置预留接口

```text
PUT /api/users/me/display
Auth: UserBearerAuth
```

路径和请求类型暂时保留，但能力未开放，当前统一返回 HTTP 200 和业务错误码：

```json
{
  "code": 503,
  "message": "功能开发中，敬请期待",
  "data": null
}
```

客户端当前不展示背景 URL 输入或上传入口。

## 2. 饭局协作与回忆分享

饭搭子功能已整体下线；当前前台协作入口只保留饭局邀请、参与、我想吃池、带菜和回忆分享，不再提供 `/api/dining-groups*` 或 `/api/dining-group-invites*`。

### 2.1 协作与回忆分享

当前饭局协作主链路保留：

```text
GET  /api/dining-events
POST /api/dining-events/{eventId}/wishes
POST /api/dining-events/{eventId}/wishes/{wishItemId}/support
POST /api/dining-events/{eventId}/wishes/{wishItemId}/menu
POST /api/dining-events/{eventId}/bring
POST /api/dining-events/{eventId}/memory-shares
GET  /api/memory-shares/{shareToken}/preview
```

动态不得混入冰箱、购物明细、过敏、忌口、内部备注、未采用候选菜或投票明细。

#### 计划详情做饭助手

`GET /api/meal-plans/{planItemId}/cook-assistant` 用于读取当前计划餐次下的做饭助手结果；如果还没生成过，接口仍返回同一份结构，但 `hasSnapshot = false`。`POST /api/meal-plans/{planItemId}/cook-assistant` 用于首次生成或在菜单变化后重新生成。

客户端接入约束：

1. 入口固定放在计划详情页，不单独做新页面。
2. 助手结果挂在当前计划下，计划删除后不再保留。
3. 若接口返回 `isStale = true`，页面必须提示“当前菜单已变更”，并由用户手动点击重新生成；不得静默覆盖。
4. 第一版只展示三段：`prepTasks`、`cookTimeline`、`serveTasks`，以及 `summary` 里的总时长/建议开做时间/提醒。
5. 不在客户端自行拼多道菜步骤，不按 `recipeId` 逐个详情拼装；统一以这个接口结果为准。

#### 饭局列表

`GET /api/dining-events` 用于读取当前用户可见的饭局摘要列表。查询参数：

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

客户端接入约束：

1. 饭局页主列表必须直接走这条接口的服务端分页和筛选，不再先拉 `/api/meal-plans` 再本地筛。
2. `planDate + mealSlot` 只用于按某一餐精确回查是否已经挂饭局，不用于替代常规分页列表。
3. 当 `stage = ALL` 时，客户端只能把它用于局部回查，不要把它作为饭局页主 tab 的默认查询。
4. 饭局页触底加载必须沿用 `page / pageSize / hasNext`，不要再自造前端分页。

#### 我想吃池

`POST /api/dining-events/{eventId}/wishes` 用于参与人从自己的菜谱里选一道菜放进当前饭局的我想吃池。请求体：

```ts
interface ChooseDiningEventWishRecipeRequest {
  recipeId: UUID;
}
```

`POST /api/dining-events/{eventId}/wishes/{wishItemId}/support` 用于参与人附议或取消附议一道现有提议。请求体：

```ts
interface UpdateDiningEventWishSupportRequest {
  action: "SUPPORT" | "UNSUPPORT";
}
```

`POST /api/dining-events/{eventId}/wishes/{wishItemId}/menu` 用于发起人把某条提议加入本次菜单，不需要额外请求体。`我想吃池` 只影响菜单确认参考，不进入采购、库存或带菜事实。

#### 餐桌回忆卡快照

`POST /api/dining-events/{eventId}/memory-shares` 用于在已完成饭局上生成一张不可变餐桌回忆卡。请求体：

```ts
interface CreateDiningMemoryShareRequest {
  showParticipants: boolean;
  caption: string | null;
}
```

当前客户端接入约束：

1. 只有饭局主理人可生成，其他成员只读公开快照。
2. 饭局未完成时，页面只能展示生成前预览，不能真正生成公开卡片。
3. `showParticipants` 只控制是否公开成员摘要，不影响饭局真实参与数据。
4. `caption` 最长 `120` 个字符，传空字符串时应先裁剪为 `null`。

`GET /api/memory-shares/{shareToken}/preview` 用于读取公开餐桌回忆卡，不要求登录。返回字段只允许包含：

```ts
interface DiningMemorySharePreview {
  title: string;
  planDate: string | null;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER" | null;
  menuItems: Array<{
    title: string;
    coverUrl: string | null;
  }>;
  participants: Array<{
    displayName: string;
    avatarUrl: string | null;
    role: "ORGANIZER" | "PARTICIPANT" | "GUEST";
  }>;
  caption: string | null;
  sharedAt: IsoDateTime;
  snapshotVersion: number;
}
```

客户端不得把饭局详情页里的实时参与人 UID、投票明细、带菜备注、购物或冰箱信息拼进公开卡片；公开预览只能信任快照接口返回的白名单字段。

### 2.2 随机页最小真实流程

随机页当前确认的目标不是“摇一摇玩具”，而是：

```text
选条件 -> 生成一桌 -> 逐道调整 -> 本桌缺口预检 -> 加入计划或去采购
```

这部分当前已落最小真实流程。客户端按以下边界接入，不得额外扩展 owner、缓存草稿或共享写入口。

当前最小接口面评审为：

```text
POST /api/random-menus/generate
POST /api/random-menu-slots/replace
POST /api/random-menu-gap/preview
POST /api/meal-plans
POST /api/shopping-items/from-random-menu
```

#### 生成一桌

```text
POST /api/random-menus/generate
Auth: UserBearerAuth
```

最小请求：

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

客户端约束：

1. 没有 `mealSlot` 和 `peopleCount` 不发请求。
2. 不把“随机页入口名”当成真实餐次；必须显式传 `BREAKFAST / LUNCH / DINNER`。
3. 不自行拼展示文本回传服务端。

#### 替换单个菜位

```text
POST /api/random-menu-slots/replace
Auth: UserBearerAuth
```

最小请求：

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

客户端约束：

1. `requestSeq` 由当前菜位单独维护。
2. 旧响应不得覆盖新响应。
3. 只替换目标菜位，不要因为“状态统一”把整桌重置。

#### 本桌缺口预检

```text
POST /api/random-menu-gap/preview
Auth: UserBearerAuth
```

最小请求：

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

客户端约束：

1. `unknown` 不自动视为 `missing`。
2. 存在未处理 `unknown` 时，不允许直接触发加入计划。
3. 这里只处理当前这桌，不去混用 `GET /api/shopping-gap` 的全局汇总结果。

#### 计划写入升级

随机页最终写计划仍回真实 owner：`POST /api/meal-plans`。

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

客户端约束：

1. `purchaseState = PENDING` 对应“保留但暂不采购”。
2. 覆盖已有计划时，必须带 `expectedVersion`。
3. 计划写入只接受完整 `menuItems[]`，不再存在裸菜谱 ID 输入。
4. 计划页“添加计划”允许对当前选中日期 + 餐次发送 `menuItems = []`，先建一条空白计划；若该餐次已有计划，则应直接打开已有计划，不重复发空白新建。
5. 随机页和详情页调整菜单时，仍必须提交至少一道菜，不允许用空数组清空已有菜单。

#### 缺口写入购物

```text
POST /api/shopping-items/from-random-menu
Auth: UserBearerAuth
Idempotency-Key: 172251000101
```

最小请求：

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

客户端约束：

1. 只提交用户明确决定采购的缺口。
2. 不自己拼 `sourceKey`。
3. 成功后按购物域返回结果刷新，不假定写入一定命中某张特定共享清单。

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

返回分域结构：`membership`、`display`、`storage`、`recipePolicy`、`invitePolicy` 和 `imagePolicy`。

该接口只用于 `SUPER_ADMIN` 审计，不是小程序共享快照。背景图能力当前在后台也固定显示为未开放。

## 5. 菜谱调用示例

现行菜谱主链路不是旧的 `scope=system/mine` 或 `/recipes/{recipeId}/import`。当前调用顺序固定为：

```text
匿名读取灵感 -> 保存草稿 -> 发布到“我的” -> 收藏灵感固定版本
```

### 5.1 匿名读取灵感

```text
GET /api/inspiration-recipes?page=1&pageSize=20
Auth: none
```

### 5.2 首次保存草稿

幂等键只走请求头，不再放在 body：

```text
POST /api/recipe-drafts
Auth: UserBearerAuth
Idempotency-Key: 172251000001
```

```json
{
  "recipeId": null,
  "content": {
    "name": "番茄炒蛋",
    "story": null,
    "categoryId": 1,
    "sceneIds": [1],
    "baseServings": 2,
    "difficulty": "EASY",
    "duration": "WITHIN_15",
    "tips": "番茄最后下锅",
    "ingredients": [
      {
        "ingredientId": 4001,
        "name": "番茄",
        "quantity": "",
        "unitId": null,
        "fuzzyText": "适量",
        "categoryId": 301,
        "defaultUnitId": 21,
        "source": "SYSTEM"
      }
    ],
    "steps": [{ "text": "热锅下油后翻炒" }]
  }
}
```

保存草稿时后端只强制校验标题非空；分类、场景、食材、单位引用即使已失效，也不会阻塞保存，原始输入会继续保留在草稿 `content` 中。草稿里的精确用量允许先保存为空数量或空单位；发布前再由 `recipeApi.publishDraft` 对完整性做严格校验。

### 5.3 发布草稿到“我的”

```text
POST /api/recipe-drafts/1/publish
Auth: UserBearerAuth
Idempotency-Key: 172251000002
```

```json
{
  "expectedVersion": 2
}
```

### 5.4 收藏灵感固定版本

`sourceVersionId` 必须来自 `GET /api/inspiration-recipes/{recipeId}` 返回的 `contentVersionId`：

```text
POST /api/collections/recipes
Auth: UserBearerAuth
Idempotency-Key: 172251000003
```

```json
{
  "sourceRecipeId": 2001,
  "sourceVersionId": 1001,
  "sceneIds": [1]
}
```

### 5.5 从灵感保存到私房菜

`POST /api/recipes/from-inspiration` 供灵感详情和加入计划 Sheet 复用；分类可稍后再分，不再提交场景。

```text
POST /api/recipes/from-inspiration
Auth: UserBearerAuth
Idempotency-Key: 172251000004
```

```json
{
  "sourceRecipeId": 2001,
  "sourceVersionId": 1001,
  "categoryId": null
}
```

## 6. 客户端规则

1. 小程序和后台分别通过本端 `apis/` 请求层调用接口，不跨应用导入类型。
2. `401` 清理 session、用户资料和关系状态。
3. 可重试写操作生成并复用 `Idempotency-Key`，成功后再清除。
4. 会员事实只读 `/users/me.membership`；存储只读 `/storage-usage`。
5. 不使用旧字段兼容、多个字段 fallback 或本地拼装全局权益对象。
6. 对随机页，客户端不得提前抽出 `manager / engine / adapter / center` 类通用层；先按页面局部 owner 和正式契约实现。
