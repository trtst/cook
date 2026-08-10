# 炊火记客户端 API 手册

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
| 2026-07-26 | 冻结菜谱 R1 契约，新增个人分类/场景、食材单位、草稿发布、我的菜谱和匿名灵感路径；当前客户端尚未实现，不可按已可调用功能使用。 |
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
| POST | `/api/dining-groups` | `diningGroupApi.create` | 显式开启并创建本人主理的首个饭搭子 |
| GET | `/api/dining-group-members` | `diningGroupApi.listMembers` | 指定关系的成员列表 |
| PUT | `/api/dining-groups/{diningGroupId}` | `diningGroupApi.update` | 更新当前饭搭子名称和简介 |
| GET | `/api/storage-usage` | `diningGroupApi.getStorageUsage` | 个人存储用量 |
| POST | `/api/dining-group-invites` | `diningGroupApi.createInvite` | 创建关系邀请 |
| POST | `/api/dining-group-invites/{inviteToken}/accept` | `diningGroupApi.acceptInvite` | 接受邀请并建立关系 |
| POST | `/api/dining-groups/{diningGroupId}/leave` | `diningGroupApi.leave` | 退出关系 |
| GET | `/api/inspiration-recipes` | `recipeApi.listInspirationRecipes` | 匿名灵感菜谱分页 |
| POST | `/api/recipe-drafts` | `recipeApi.createDraft` | 首次保存草稿 |
| POST | `/api/recipe-drafts/{draftId}/publish` | `recipeApi.publishDraft` | 发布草稿到“我的” |
| GET | `/api/recipes` | `recipeApi.listMyRecipes` | 我的已发布菜谱分页 |
| POST | `/api/collections/recipes` | `recipeApi.collectRecipe` | 收藏灵感固定版本到合集 |
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

`DiningGroupSummary` 当前还会返回：

1. `description`：饭搭子简介。
2. `coverImageUrl`：当前主页主图；未上传时返回 `null`。
3. `canManageCover`：当前调用人是否可以管理主图；当前只会对主理人的 `Pro / Ultra` 返回 `true`。
4. `createdDays / memberCount / pollCount / diningEventCount`：饭搭子主页聚合摘要。
5. `hasAttention / latestActivityTitle / latestActivityAt`：关系切换卡片和悬浮切换入口使用的轻提醒字段。

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

### 2.3 开启与编辑

所有写操作通过请求头 `Idempotency-Key` 携带并复用纯数字字符串幂等键：

```text
POST /api/dining-groups
PUT /api/dining-groups/{diningGroupId}
```

创建请求体：

```ts
interface CreateDiningGroupRequest {
  name: string;
  description: string | null;
}
```

更新请求体：

```ts
interface UpdateDiningGroupRequest extends CreateDiningGroupRequest {
  expectedVersion: number;
}
```

开启只在用户显式进入饭搭子页并提交表单后发生；新用户默认不自动创建饭搭子。更新只允许当前主理人修改名称和简介。

### 2.4 主页主图

所有写操作通过请求头 `Idempotency-Key` 携带并复用纯数字字符串幂等键：

```text
POST /api/dining-groups/{diningGroupId}/cover
```

请求体为 `multipart/form-data`：

```ts
interface UpdateDiningGroupCoverRequest {
  expectedVersion: number;
  file: File;
}
```

返回：

```ts
interface UpdateDiningGroupCoverResponse {
  diningGroup: DiningGroupSummary;
}
```

当前只有 `OWNER` 且个人套餐为 `Pro / Ultra` 时允许上传或替换主页主图。主图计入主理人的个人空间，未开放删除重置接口；需要再次变更时继续走替换上传。

### 2.5 邀请与退出

所有写操作通过请求头 `Idempotency-Key` 携带并复用纯数字字符串幂等键：

```text
POST /api/dining-group-invites
POST /api/dining-group-invites/{inviteToken}/accept
POST /api/dining-groups/{diningGroupId}/leave
POST /api/dining-groups/{diningGroupId}/remove-member
POST /api/dining-groups/{diningGroupId}/dissolve
```

接受邀请只建立成员关系；退出、移除和解散只结束关系。以上操作都不迁移、不复制、不冻结、不恢复个人数据。

### 2.5 协作与轻动态

当前饭搭子协作主链路新增：

```text
GET  /api/meal-polls
POST /api/meal-polls
GET  /api/meal-polls/{pollId}
POST /api/meal-polls/{pollId}/vote
POST /api/meal-polls/{pollId}/confirm
GET  /api/dining-group-activities
POST /api/dining-events/{eventId}/cook
POST /api/dining-events/{eventId}/memory-shares
GET  /api/memory-shares/{shareToken}/preview
```

#### 点菜征集

`GET /api/meal-polls` 只返回当前饭搭子的征集摘要列表。当前支持的查询参数是：

```ts
{
  diningGroupId: UUID;
  status?: "OPEN" | "CLOSED" | "CONFIRMED" | "COMPLETED";
  planDate?: string;
  mealSlot?: "BREAKFAST" | "LUNCH" | "DINNER";
  limit?: number;
}
```

首页和征集入口只读取摘要，不返回成员逐条回应。

`POST /api/meal-polls` 用于由 `OWNER / ADMIN` 发起征集。请求体：

```ts
interface CreateMealPollRequest {
  diningGroupId: UUID;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  deadlineAt: IsoDateTime;
  choiceLimit: number;
  note: string | null;
  candidateRecipeVersionIds: UUID[];
}
```

约束：

1. 同一饭搭子、同一 `planDate + mealSlot` 只允许一条有效征集。
2. `choiceLimit` 当前固定 `1~3`，并在创建时冻结。
3. 候选菜必须能落到固定 `recipeVersionId`。

`GET /api/meal-polls/{pollId}` 返回 `MealPollDetail`，用于征集详情与结果汇总。`POST /api/meal-polls/{pollId}/vote` 用于当前成员提交或覆盖自己的一份回应。请求体：

```ts
interface VoteMealPollRequest {
  expectedVersion: number;
  selectedCandidateIds: UUID[];
  suggestionTitle: string | null;
  note: string | null;
}
```

`suggestionTitle` 只是建议菜名，不直接进入最终菜单。截止后提交返回明确失败，不静默丢弃。

`POST /api/meal-polls/{pollId}/confirm` 用于关闭征集、汇总回应并确认最终菜单。请求体：

```ts
interface ConfirmMealPollRequest {
  expectedVersion: number;
  finalRecipeVersionIds: UUID[];
  scheduledAt: IsoDateTime | null;
  location: string | null;
}
```

该接口会同事务完成“关闭征集 -> 汇总回应 -> 生成或更新当前餐次 -> 生成或更新对应饭局”。客户端不再拆成“先确认计划，再单独建饭局”的两步。

#### 首页轻动态

`GET /api/dining-group-activities?diningGroupId=<diningGroupId>&limit=5` 返回当前饭搭子最近 `3~5` 条结构化事项摘要，只服务首页轻动态卡片，不提供完整历史翻页，也不是聊天记录。

动态只允许返回：

1. 发起征集。
2. 成员选择。
3. 建议补菜。
4. 成员备注。
5. 菜单确认。
6. “我来做”认领。
7. “我带菜”更新。
8. 餐次完成。
9. 饭搭子卡生成。
10. 成员加入或待加入占位。

动态不得混入冰箱、购物明细、过敏、忌口、内部备注、未采用候选菜或投票明细。

#### 我来做

`POST /api/dining-events/{eventId}/cook` 用于对已确认菜单中的单道菜执行“我来做”认领或释放。请求体：

```ts
interface ClaimCookRequest {
  expectedVersion: number;
  menuItemId: UUID;
  action: "CLAIM" | "RELEASE";
}
```

同一道菜同一时刻只允许一位有效认领人；并发冲突返回 `409`。该接口只改写菜级责任人，不改写购物、库存或菜谱所有权。

#### 饭搭子卡快照

`POST /api/dining-events/{eventId}/memory-shares` 用于在已完成饭局上生成一张不可变饭搭子卡。请求体：

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

`GET /api/memory-shares/{shareToken}/preview` 用于读取公开饭搭子卡，不要求登录。返回字段只允许包含：

```ts
interface DiningMemorySharePreview {
  title: string;
  planDate: string | null;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER" | null;
  menuItems: Array<{
    title: string;
    coverUrl: string | null;
    cookName: string | null;
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

## 6. 客户端规则

1. 小程序和后台分别通过本端 `apis/` 请求层调用接口，不跨应用导入类型。
2. `401` 清理 session、用户资料和关系状态。
3. 可重试写操作生成并复用 `Idempotency-Key`，成功后再清除。
4. 会员事实只读 `/users/me.membership`；关系用量只读 `/dining-groups.usage`；存储只读 `/storage-usage`。
5. 不使用旧字段兼容、多个字段 fallback 或本地拼装全局权益对象。
