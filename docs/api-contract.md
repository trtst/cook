# API 契约基线

## 目标

本文固化三端并行开发前必须共享的 API 契约基线。

第一版只覆盖：

1. 全局响应格式、错误码、分页、时间、ID、版本和幂等规则。
2. `packages/domain` 与 `packages/api-client` 的边界。
3. 小程序用户 token 与后台管理员 token 的隔离规则。
4. 第一条纵切链路：微信登录 -> 当前用户 -> 餐厅列表 / 当前餐厅。
5. 后台第一条链路：管理员登录 -> 用户 / 餐厅只读查询。

本文不是全量 API 手册。Recipe、Meal、Poll、Fridge、Shopping、Share 等模块在对应接口设计确认后再追加。

## 契约状态

本文为 v0.1 契约草案。三端可以基于本文并行脚手架和 mock 开发。

后端实现、OpenAPI 输出或字段命名需要调整时，必须先更新本文，再同步 `packages/api-client` 和调用端代码。

## 包边界

### packages/domain

`packages/domain` 只放稳定领域类型、枚举和少量纯规则。

可以放：

1. `RestaurantRole`
2. `MemberStatus`
3. `CollaborationMode`
4. `SharedQuotaPolicy`
5. 稳定 ID、时间、版本等基础类型别名

不放：

1. 数据库模型。
2. OpenAPI DTO。
3. 前端展示模型。
4. 请求函数。
5. token、storage、平台能力或运行时状态。

### packages/api-client

`packages/api-client` 是接口契约壳。

第一阶段可以手写最小版本，只覆盖 Auth / User / Restaurant。后端 OpenAPI 稳定后，再由 OpenAPI 生成替换或覆盖。

`packages/api-client` 不持有任何 token，也不直接读取 storage。

调用方必须注入：

1. `baseUrl`
2. `getAuthHeader`
3. `onUnauthorized`
4. `fetch` / request adapter

小程序和后台分别在 `apps/client` 与 `apps/admin` 的启动层注入自己的 token 读取、401 处理和错误展示逻辑。

## 接口路径扁平化

接口路径默认短、稳定、面向资源和业务动作，不按数据库外键链、前端页面层级或后台菜单层级嵌套。

规则：

1. URL 默认不超过两个业务语义层级。
2. 餐厅归属、筛选条件、版本号、状态和分页优先放 query 或 body。
3. 当前用户相关接口优先用 `/users/me`、`/restaurants/mine` 这类直接入口。
4. 管理后台接口统一以 `/admin` 开头，后面只接一级资源。
5. 批量导入、发布、确认这类动作可以用短 action，但不继续嵌套 row、version、review 等多层路径。

推荐：

```text
GET /recipes/{recipeId}
GET /recipes?restaurantId=...
POST /meal-plans
POST /shopping-items/check
GET /admin/restaurants
POST /admin/imports/{batchId}/publish
```

避免：

```text
GET /restaurants/{restaurantId}/recipes/{recipeId}/versions/{versionId}
POST /restaurants/{restaurantId}/shopping/lists/{listId}/items/{itemId}/checked
GET /admin/content/recipes/import/batches/{batchId}/rows/{rowId}
```

## 基础格式

### 统一响应

所有接口返回统一 JSON 包装。

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "serverTime": "2026-07-18T10:30:00Z"
}
```

规则：

1. 成功时 `code` 固定为 `0`。
2. 业务数据只放在 `data`。
3. `serverTime` 使用 ISO 8601 UTC 字符串。
4. HTTP 状态码保持语义化，但前端业务判断优先看响应体 `code`。
5. 失败时 `data` 可以为 `null` 或包含错误上下文，但不能承载成功数据。

### 分页格式

列表请求使用 `page` + `pageSize`。

请求参数：

```json
{
  "page": 1,
  "pageSize": 20
}
```

分页响应：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "hasNext": false
}
```

TypeScript 约定：

```ts
interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}
```

规则：

1. `page` 从 1 开始。
2. `pageSize` 默认 20。
3. 后端需要限制最大 `pageSize`，默认最大 100。
4. 游标分页出现前，不混用 `cursor` 和 `page`。

### ID 格式

业务主键使用标准 UUID 字符串。

```text
550e8400-e29b-41d4-a716-446655440000
```

前端不得假设 UUID 版本。若后端最终使用 UUID v7，仍以标准 UUID 字符串暴露。

### 时间格式

接口时间统一使用 ISO 8601 UTC 字符串。

```text
2026-07-18T10:30:00Z
```

前端展示本地时间时在应用层格式化，不要求接口返回本地化文案。

### 版本字段

共享可变对象必须返回 `version`。

写接口更新共享可变对象时必须携带 `version`，后端按乐观锁校验。

版本冲突返回 `409` 业务错误码，不允许静默覆盖。

### 幂等字段

所有可重试写接口必须携带 `operationId`。

`operationId` 由客户端生成 UUID，并在同一次用户意图重试时保持不变。

后端按操作作用域去重，避免弱网重试重复创建。

## 错误码

| code | HTTP | 含义 | 前端处理 |
| --- | --- | --- | --- |
| 0 | 2xx | 成功 | 使用 `data` |
| 400 | 400 | 参数错误 | 展示字段或表单错误 |
| 401 | 401 | 未登录或 token 失效 | 清 session，由页面决定是否展示登录组件 |
| 403 | 403 | 无权限 | 展示无权限状态，不自动重试 |
| 404 | 404 | 资源不存在 | 展示空态或兜底错误页 |
| 409 | 409 | 状态冲突或版本冲突 | 刷新数据后提示用户重新操作 |
| 422 | 422 | 业务规则不满足 | 展示业务提示 |
| 429 | 429 | 请求过于频繁 | 展示稍后重试 |
| 500 | 500 | 服务异常 | 展示通用错误 |
| 503 | 503 | 模块禁用或开发中 | 隐藏入口或展示开发中 |

Disabled 模块统一返回：

```json
{
  "code": 503,
  "message": "功能开发中，敬请期待",
  "data": null,
  "serverTime": "2026-07-18T10:30:00Z"
}
```

## Auth 方案

### 小程序用户鉴权

小程序使用 `UserBearerAuth`。

请求头：

```text
Authorization: Bearer <userAccessToken>
```

登录来源：

1. `apps/client` 调用 `platform.auth.login()` 获取微信 `code`。
2. 小程序调用 `/auth/wechat/login`。
3. 后端换取微信身份，创建或更新用户。
4. 后端返回用户 token 和用户摘要。

### 后台管理员鉴权

后台使用 `AdminBearerAuth`。

请求头：

```text
Authorization: Bearer <adminAccessToken>
```

后台管理员登录不复用小程序微信登录。

`packages/api-client` 只暴露 auth scheme 和请求函数，不保存用户 token 或管理员 token。

## 通用类型

```ts
type UUID = string;
type IsoDateTime = string;

type RestaurantRole = "OWNER" | "ADMIN" | "MEMBER";
type MemberStatus = "ACTIVE" | "INVITED" | "REMOVED" | "LEFT";
type CollaborationMode = "PERSONAL" | "SHARED";
type SharedQuotaPolicy = "ALL_WRITERS" | "ADMINS_ONLY" | "OWNER_ONLY";
```

## 用户 DTO

### UserProfile

```ts
interface UserProfile {
  id: UUID;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  status: "ACTIVE" | string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
```

### UserSummary

```ts
interface UserSummary {
  id: UUID;
  nickname: string | null;
  avatarUrl: string | null;
}
```

## 餐厅 DTO

### RestaurantSummary

```ts
interface RestaurantSummary {
  id: UUID;
  name: string;
  ownerId: UUID;
  collaborationMode: CollaborationMode;
  sharedQuotaPolicy: SharedQuotaPolicy;
  memberLimit: number;
  status: "ACTIVE" | string;
  version: number;
  myRole: RestaurantRole;
  myMemberStatus: MemberStatus;
  memberCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
```

### RestaurantMemberSummary

```ts
interface RestaurantMemberSummary {
  id: UUID;
  restaurantId: UUID;
  user: UserSummary;
  role: RestaurantRole;
  status: MemberStatus;
  joinedAt: IsoDateTime | null;
  invitedAt: IsoDateTime | null;
  version: number;
}
```

## 第一条纵切链路接口

### 微信登录

```text
POST /auth/wechat/login
Auth: none
```

请求：

```json
{
  "code": "wx-login-code"
}
```

响应 `data`：

```ts
interface WechatLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  user: UserProfile;
}
```

规则：

1. `code` 只能使用一次。
2. 用户不存在时自动创建用户。
3. 用户存在时更新微信身份相关信息，但不得覆盖用户主动填写的资料。
4. 返回 token 只代表用户身份，不代表当前餐厅已确定。

### 当前用户

```text
GET /users/me
Auth: UserBearerAuth
```

响应 `data`：

```ts
type GetCurrentUserResult = UserProfile;
```

### 更新当前用户

```text
PUT /users/me
Auth: UserBearerAuth
```

请求：

```ts
interface UpdateCurrentUserRequest {
  nickname?: string;
  avatarUrl?: string;
  phone?: string;
}
```

响应 `data`：

```ts
type UpdateCurrentUserResult = UserProfile;
```

### 我的餐厅列表

```text
GET /restaurants/mine
Auth: UserBearerAuth
```

响应 `data`：

```ts
interface MyRestaurantsResult {
  restaurants: RestaurantSummary[];
  currentRestaurantId: UUID | null;
  limits: {
    ownedLimit: number;
    joinedLimit: number;
    freeMemberLimit: number;
  };
}
```

规则：

1. 返回用户创建的餐厅和已加入餐厅。
2. 被移除成员不可继续访问餐厅数据。
3. `currentRestaurantId` 是服务端建议值；小程序可以在本地记忆最近选择，但写操作必须显式传 `restaurantId`。

### 创建餐厅

```text
POST /restaurants
Auth: UserBearerAuth
```

请求：

```ts
interface CreateRestaurantRequest {
  name: string;
  operationId: UUID;
}
```

响应 `data`：

```ts
interface CreateRestaurantResult {
  restaurant: RestaurantSummary;
  ownerMember: RestaurantMemberSummary;
}
```

规则：

1. 每个用户最多创建 1 个餐厅。
2. 创建餐厅后自动成为 `OWNER`。
3. 需要事务内同时创建餐厅和 owner 成员关系。
4. 弱网重试必须通过 `operationId` 幂等。

### 餐厅详情

```text
GET /restaurants/{restaurantId}
Auth: UserBearerAuth
```

响应 `data`：

```ts
type GetRestaurantResult = RestaurantSummary;
```

规则：

1. 只有有效成员可以读取餐厅详情。
2. 修改请求参数访问其他餐厅必须返回 403 或 404，不泄露隐私。

### 餐厅成员列表

```text
GET /restaurant-members?restaurantId={restaurantId}
Auth: UserBearerAuth
```

响应 `data`：

```ts
interface RestaurantMembersResult {
  restaurantId: UUID;
  members: RestaurantMemberSummary[];
}
```

规则：

1. 有效成员可以查看成员列表。
2. 被移除、已退出成员不应继续获得餐厅数据访问权。

### 创建邀请

```text
POST /restaurant-invites
Auth: UserBearerAuth
```

请求：

```ts
interface CreateInviteRequest {
  restaurantId: UUID;
  operationId: UUID;
}
```

响应 `data`：

```ts
interface CreateInviteResult {
  inviteToken: string;
  sharePath: string;
  expiresAt: IsoDateTime;
}
```

规则：

1. `OWNER` 可以邀请和移除成员。
2. `ADMIN` 可以邀请成员，但不能移除成员或转让主理人。
3. `MEMBER` 不能邀请成员。
4. 邀请 token 不暴露内部主键。

### 接受邀请

```text
POST /restaurant-invites/{inviteToken}/accept
Auth: UserBearerAuth
```

请求：

```ts
interface AcceptInviteRequest {
  operationId: UUID;
}
```

响应 `data`：

```ts
interface AcceptInviteResult {
  restaurant: RestaurantSummary;
  member: RestaurantMemberSummary;
}
```

规则：

1. 接受邀请必须事务内校验用户加入上限、餐厅成员上限、邀请有效期和成员状态。
2. 同一用户重复接受同一邀请不得重复创建成员。
3. 多人并发接受邀请不能突破成员上限。

## 后台第一条链路接口

后台管理端独立登录，不复用小程序登录。

### 管理员登录

```text
POST /admin/auth/login
Auth: none
```

请求：

```ts
interface AdminLoginRequest {
  username: string;
  password: string;
}
```

响应 `data`：

```ts
interface AdminLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  admin: {
    id: UUID;
    username: string;
    displayName: string;
    roles: string[];
  };
}
```

### 用户只读查询

```text
GET /admin/users
Auth: AdminBearerAuth
```

请求参数：

```ts
interface AdminListUsersQuery {
  page: number;
  pageSize: number;
  keyword?: string;
}
```

响应 `data`：

```ts
type AdminListUsersResult = PageResult<UserProfile>;
```

### 餐厅只读查询

```text
GET /admin/restaurants
Auth: AdminBearerAuth
```

请求参数：

```ts
interface AdminListRestaurantsQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
}
```

响应 `data`：

```ts
type AdminListRestaurantsResult = PageResult<RestaurantSummary>;
```

## 三端并行节奏

第一阶段共享契约只允许小步合入。

1. 先完成本文和 `Auth / User / Restaurant` v0.1 契约。
2. 创建 `packages/domain` 与 `packages/api-client` 的最小契约壳。
3. 创建 `apps/api` NestJS 最小壳并输出 OpenAPI。
4. 创建 `apps/client` 小程序脚手架，并使用 `api-client` 接入 mock / real 双通道。
5. 再创建 `apps/admin` 脚手架。
6. 小程序使用 mock 或最小 `api-client` 接入登录、当前用户和餐厅列表。
7. 后台使用 mock 或最小 `api-client` 接入管理员登录、用户列表和餐厅列表。
8. 后端完成真实接口后输出 OpenAPI v0.1。
9. 三端以第一条纵切链路作为首个联调验收点。

在第一条纵切链路验证通过前，其他业务模块可以脚手架或 mock 开发，但入口保持关闭或明确标记未联调。

## 首批验证命令

契约文档变更至少执行：

```bash
git diff --check -- docs/api-contract.md docs/index.md docs/AGENT.md docs/technical.md
pnpm --filter @next-meal/domain type-check
pnpm --filter @next-meal/api-client type-check
pnpm --filter @next-meal/api type-check
pnpm --filter @next-meal/client type-check
```

脚手架落地后再执行对应工程命令：

```bash
pnpm --filter @next-meal/api test
pnpm --filter @next-meal/client type-check
pnpm --filter @next-meal/admin type-check
```
