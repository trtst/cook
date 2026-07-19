# API 契约基线

## 目标

本文固化三端并行开发前必须共享的 API 契约基线。

第一版只覆盖：

1. 全局响应格式、错误码、分页、时间、ID、版本和幂等规则。
2. `packages/domain` 与 `packages/api-client` 的边界。
3. 小程序用户 token 与后台管理员 token 的隔离规则。
4. 第一条纵切链路：手机号密码登录 -> 当前用户 -> 饭搭子列表 / 当前饭搭子。
5. 后台第一条链路：管理员登录 -> 用户 / 饭搭子只读查询。

本文不是全量 API 手册。Recipe、Meal、Poll、Fridge、Shopping、Share 等模块在对应接口设计确认后再追加。

## 契约状态

本文为 v0.1 契约草案。三端可以基于本文并行脚手架和 mock 开发。

后端实现、OpenAPI 输出或字段命名需要调整时，必须先更新本文，再同步 `packages/api-client` 和调用端代码。

## 三端并行契约规则

接口契约是小程序、后端和后台并行开发的共同输入。功能进入正式开发前，CTO 必须先确认最小纵切链路，并把会影响三端的接口、DTO、错误码、权限、幂等和版本规则落到本文或对应功能执行单。

契约冻结前允许讨论和草案开发；契约冻结后变更必须同步三端。

契约变更流程：

1. CTO 或后端先更新本文中的接口路径、请求、响应、错误码和权限说明。
2. 同步 `packages/domain` 中稳定领域类型，避免把数据库模型或展示模型放入共享领域包。
3. 同步 `packages/api-client` 中调用端需要的 DTO、请求函数和返回类型。
4. 小程序和后台按 `packages/api-client` 接入，不各自复制一套字段定义。
5. 如果真实接口未完成，小程序和后台可以按契约使用 mock；mock 字段必须与本文一致。
6. 契约变更必须写入对应功能执行单或 `docs/plans/minor_change_log.md`，避免联调时出现隐性字段漂移。

最小契约确认清单：

1. 接口是否属于小程序、后台或两者共用。
2. 鉴权使用小程序用户 token 还是后台管理员 token。
3. 请求参数、响应字段和错误码是否足够支撑主路径和失败路径。
4. 写接口是否需要 `operationId`。
5. 共享可变对象是否需要 `version`。
6. 权限失败、资源不存在、状态冲突和模块禁用分别如何返回。
7. 字段命名是否已经同步到 `packages/api-client`。

## 包边界

### packages/domain

`packages/domain` 只放稳定领域类型、枚举和少量纯规则。

可以放：

1. `DiningGroupRole`
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

第一阶段可以手写最小版本，只覆盖 Auth / User / DiningGroup。后端 OpenAPI 稳定后，再由 OpenAPI 生成替换或覆盖。

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
2. 饭搭子归属、筛选条件、版本号、状态和分页优先放 query 或 body。
3. 当前用户相关接口优先用 `/users/me`、`/dining-groups/mine` 这类直接入口。
4. 管理后台接口统一以 `/admin` 开头，后面只接一级资源。
5. 批量导入、发布、确认这类动作可以用短 action，但不继续嵌套 row、version、review 等多层路径。

推荐：

```text
GET /recipes/{recipeId}
GET /recipes?diningGroupId=...
POST /meal-plans
POST /shopping-items/check
GET /admin/dining-groups
POST /admin/imports/{batchId}/publish
```

避免：

```text
GET /dining-groups/{diningGroupId}/recipes/{recipeId}/versions/{versionId}
POST /dining-groups/{diningGroupId}/shopping/lists/{listId}/items/{itemId}/checked
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

已落库执行成功的写接口，重复提交同一个 `operationId` 必须返回第一次保存的结果，不重新生成 token 或重复写入成员关系。

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

1. `apps/client` 展示手机号和密码输入。
2. 小程序调用 `/auth/login`。
3. 后端校验手机号、密码哈希和用户状态。
4. 后端返回用户 token 和用户摘要。

### 后台管理员鉴权

后台使用 `AdminBearerAuth`。

请求头：

```text
Authorization: Bearer <adminAccessToken>
```

后台管理员登录不复用小程序用户登录。

`packages/api-client` 只暴露 auth scheme 和请求函数，不保存用户 token 或管理员 token。

## 通用类型

```ts
type UUID = string;
type IsoDateTime = string;

type DiningGroupRole = "OWNER" | "ADMIN" | "MEMBER";
type MemberStatus = "ACTIVE" | "INVITED" | "REMOVED" | "LEFT";
type CollaborationMode = "PERSONAL" | "SHARED";
type SharedQuotaPolicy = "ALL_WRITERS" | "ADMINS_ONLY" | "OWNER_ONLY";
```

## 用户 DTO

### UserProfile

```ts
interface UserProfile {
  id: UUID;
  // 非连续公开用户号，只用于展示和客服检索，不用于主键或推算注册量。
  uid: number;
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
  // 非连续公开用户号，只用于展示和客服检索，不用于主键或推算注册量。
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
}
```

## 饭搭子 DTO

### DiningGroupSummary

```ts
interface DiningGroupSummary {
  id: UUID;
  name: string;
  ownerId: UUID;
  collaborationMode: CollaborationMode;
  sharedQuotaPolicy: SharedQuotaPolicy;
  memberLimit: number;
  status: "ACTIVE" | string;
  version: number;
  myRole: DiningGroupRole;
  myMemberStatus: MemberStatus;
  memberCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
```

### DiningGroupMemberSummary

```ts
interface DiningGroupMemberSummary {
  id: UUID;
  diningGroupId: UUID;
  user: UserSummary;
  role: DiningGroupRole;
  status: MemberStatus;
  joinedAt: IsoDateTime | null;
  invitedAt: IsoDateTime | null;
  version: number;
}
```

## 第一条纵切链路接口

### 手机号密码登录

```text
POST /auth/login
Auth: none
```

请求：

```ts
interface PasswordLoginRequest {
  phone: string;
  password: string;
}
```

响应 `data`：

```ts
interface PasswordLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  user: UserProfile;
}
```

规则：

1. 手机号必须是已存在的有效用户。
2. 密码只保存安全哈希，不保存明文。
3. 手机号不存在、密码错误或用户禁用时统一返回 `401` 和 `手机号或密码错误`。
4. 返回 token 只代表用户身份，不代表当前饭搭子已确定。

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

### 我的饭搭子列表

```text
GET /dining-groups/mine
Auth: UserBearerAuth
```

响应 `data`：

```ts
interface MyDiningGroupsResult {
  diningGroups: DiningGroupSummary[];
  currentDiningGroupId: UUID | null;
  limits: {
    ownedLimit: number;
    joinedLimit: number;
    freeMemberLimit: number;
  };
}
```

规则：

1. 返回用户创建的饭搭子和已加入饭搭子。
2. 被移除成员不可继续访问饭搭子数据。
3. `currentDiningGroupId` 是服务端建议值；小程序可以在本地记忆最近选择，但写操作必须显式传 `diningGroupId`。

### 创建饭搭子

```text
POST /dining-groups
Auth: UserBearerAuth
```

请求：

```ts
interface CreateDiningGroupRequest {
  name: string;
  operationId: UUID;
}
```

响应 `data`：

```ts
interface CreateDiningGroupResult {
  diningGroup: DiningGroupSummary;
  ownerMember: DiningGroupMemberSummary;
}
```

规则：

1. 每个用户最多创建 1 个饭搭子。
2. 创建饭搭子后自动成为 `OWNER`。
3. 需要事务内同时创建饭搭子和 owner 成员关系。
4. 弱网重试必须通过 `operationId` 幂等。

### 饭搭子详情

```text
GET /dining-groups/{diningGroupId}
Auth: UserBearerAuth
```

响应 `data`：

```ts
type GetDiningGroupResult = DiningGroupSummary;
```

规则：

1. 只有有效成员可以读取饭搭子详情。
2. 修改请求参数访问其他饭搭子必须返回 403 或 404，不泄露隐私。

### 饭搭子成员列表

```text
GET /dining-group-members?diningGroupId={diningGroupId}
Auth: UserBearerAuth
```

响应 `data`：

```ts
interface DiningGroupMembersResult {
  diningGroupId: UUID;
  members: DiningGroupMemberSummary[];
}
```

规则：

1. 有效成员可以查看成员列表。
2. 被移除、已退出成员不应继续获得饭搭子数据访问权。

### 创建邀请

```text
POST /dining-group-invites
Auth: UserBearerAuth
```

请求：

```ts
interface CreateInviteRequest {
  diningGroupId: UUID;
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
4. 邀请 token 必须是不透明随机串，不编码饭搭子 ID、用户 ID 或过期时间。
5. 后端只保存邀请 token 的 hash，不保存原始 token。
6. 相同 `operationId` 重试必须返回第一次生成的同一个 `inviteToken`、`sharePath` 和 `expiresAt`。

### 接受邀请

```text
POST /dining-group-invites/{inviteToken}/accept
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
  diningGroup: DiningGroupSummary;
  member: DiningGroupMemberSummary;
}
```

规则：

1. 接受邀请必须事务内校验用户加入上限、饭搭子成员上限、邀请有效期和成员状态。
2. 同一用户重复接受同一邀请不得重复创建成员。
3. 多人并发接受邀请不能突破成员上限。
4. 相同 `operationId` 重试必须返回第一次接受邀请保存的结果。

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

### 饭搭子只读查询

```text
GET /admin/dining-groups
Auth: AdminBearerAuth
```

请求参数：

```ts
interface AdminListDiningGroupsQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
}
```

响应 `data`：

```ts
type AdminListDiningGroupsResult = PageResult<DiningGroupSummary>;
```

## 三端并行节奏

第一阶段共享契约只允许小步合入。

1. 先完成本文和 `Auth / User / DiningGroup` v0.1 契约。
2. 创建 `packages/domain` 与 `packages/api-client` 的最小契约壳。
3. 创建 `apps/api` NestJS 最小壳并输出 OpenAPI。
4. 创建 `apps/client` 小程序脚手架，并使用 `api-client` 接入 mock / real 双通道。
5. 再创建 `apps/admin` 脚手架。
6. 小程序使用 mock 或最小 `api-client` 接入登录、当前用户和饭搭子列表。
7. 后台使用 mock 或最小 `api-client` 接入管理员登录、用户列表和饭搭子列表。
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
