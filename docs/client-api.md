# 下一餐 API 服务 V1 - 客户端接口文档

## 简介

本文面向小程序前端和后台前端，记录当前可调用接口、待创建接口、接口详情和变更记录。

本文只写已经由代码或契约确认的字段。Recipe、Meal、Poll、Fridge、Shopping、Share 等模块尚未完成详细契约，当前只记录待创建状态和确认点，不提前编造请求响应结构。

接口权威来源分工：

1. 本文：调用方快速查接口、请求响应示例、鉴权和状态记录。
2. `docs/api-index.md`：接口状态看板，查看已创建、待创建、暂不创建和实现位置。
3. `docs/api-contract.md`：共享契约基线，维护 DTO、错误码、幂等、权限、版本和三端同步规则。
4. `packages/api-client`：小程序和后台实际调用入口。

## 变更日志

| 日期 | 变更内容 |
| --- | --- |
| 2026-07-20 | 入档唯一活跃饭搭子、原空间迁入迁出、饭局、口味、Free/Plus、统一空间和到期超额目标规则；新增接口均为 v0.2 待契约，当前代码未实现。 |
| 2026-07-19 | 小程序请求层移除 mock 通道，统一走真实 API；无本地数据时通过 seed 或真实创建接口生成。 |
| 2026-07-19 | 小程序请求默认增加 `X-Cook-From`、`X-Cook-Version`；新增 `POST /api/auth/refresh` 用于登录态自动续期。 |
| 2026-07-19 | 新增 V1 客户端接口文档，按客户端调用视角整理 Auth、User、DiningGroup、Admin 首条纵切链路。 |
| 2026-07-19 | 新增接口状态记录：已创建接口、待创建接口、暂不创建接口，并明确待创建模块先补契约再开发。 |
| 2026-07-19 | 记录本地联调路径：默认 API 服务为 `http://127.0.0.1:3100/api`，小程序 `api-client` 内部 path 省略 `/api` 前缀。 |

## 路由分组

| 分组 | 外部路径前缀 | api-client baseUrl | 鉴权 | 说明 |
| --- | --- | --- | --- | --- |
| 小程序公开接口 | `/api` | `http://127.0.0.1:3100/api` | 无 | 当前只有手机号密码登录 |
| 小程序用户接口 | `/api` | `http://127.0.0.1:3100/api` | `UserBearerAuth` | 当前覆盖登录刷新、当前用户、饭搭子列表、饭搭子详情、邀请 |
| 后台公开接口 | `/api/admin` | `http://127.0.0.1:3100/api` | 无 | 当前只有管理员登录 |
| 后台管理接口 | `/api/admin` | `http://127.0.0.1:3100/api` | `AdminBearerAuth` | 当前覆盖用户和饭搭子只读查询 |

说明：

1. 本文 `Path` 使用外部 HTTP 完整路径，例如 `/api/auth/login`。
2. `packages/api-client` 调用时基于 `baseUrl=http://127.0.0.1:3100/api`，内部 route path 使用 `/auth/login`、`/users/me` 这类路径。
3. 小程序用户 token 和后台管理员 token 不能混用。
4. 小程序端不再内置 mock 请求通道。没有数据时，使用后端 seed 或真实创建接口生成数据。

## v0.1 与 v0.2 边界

本文后续 Auth/User/DiningGroup 详情描述当前 v0.1 已实现接口。`GET /api/dining-groups/mine` 的列表、`currentDiningGroupId` 和旧 limits 不能再解释为普通多饭搭子切换能力。

v0.2 产品目标以 `docs/dining-group.md` 和 `docs/configuration.md` 为准。原空间、退出快照、饭局、口味、会员和空间接口尚未实现；在 `docs/api-contract.md` 冻结 DTO 并同步 `packages/api-client` 前，小程序不得猜字段或用本地 fallback 模拟契约。

## 状态说明

| 状态 | 含义 |
| --- | --- |
| 已实现 | 后端 Controller / Service 已存在，`packages/api-client` 已有调用入口 |
| 已契约 | 契约已写明，代码可能尚未完整接入 |
| 待契约 | 产品规则已确认，但 v0.2 API/DTO/数据库尚未完成评审 |
| 待创建 | V1 范围内需要，但尚未定义接口详情或尚未实现 |
| 暂不创建 | V1 不做、Disabled 或 Reserved 模块，当前不开放业务入口 |

## 已创建接口

| 编号 | 模块 | 方法 | Path | 端侧 | 状态 | api-client |
| --- | --- | --- | --- | --- | --- | --- |
| C-001 | Auth | POST | `/api/auth/login` | 小程序 | 已实现 | `auth.loginWithPassword` |
| C-010 | Auth | POST | `/api/auth/refresh` | 小程序 | 已实现 | `auth.refreshSession` |
| C-002 | User | GET | `/api/users/me` | 小程序 | 已实现 | `user.getCurrent` |
| C-003 | User | PUT | `/api/users/me` | 小程序 | 已实现 | `user.updateCurrent` |
| C-004 | DiningGroup | GET | `/api/dining-groups/mine` | 小程序 | 已实现 | `diningGroup.listMine` |
| C-005 | DiningGroup | POST | `/api/dining-groups` | 小程序 | 已实现 | `diningGroup.create` |
| C-006 | DiningGroup | GET | `/api/dining-groups/{diningGroupId}` | 小程序 | 已实现 | `diningGroup.get` |
| C-007 | DiningGroup | GET | `/api/dining-group-members?diningGroupId={diningGroupId}` | 小程序 | 已实现 | `diningGroup.listMembers` |
| C-008 | DiningGroup | POST | `/api/dining-group-invites` | 小程序 | 已实现 | `diningGroup.createInvite` |
| C-009 | DiningGroup | POST | `/api/dining-group-invites/{inviteToken}/accept` | 小程序 | 已实现 | `diningGroup.acceptInvite` |
| A-001 | AdminAuth | POST | `/api/admin/auth/login` | 后台 | 已实现 | `admin.login` |
| A-002 | AdminUser | GET | `/api/admin/users` | 后台 | 已实现 | `admin.listUsers` |
| A-003 | AdminDiningGroup | GET | `/api/admin/dining-groups` | 后台 | 已实现 | `admin.listDiningGroups` |

## 待创建接口

以下接口属于 V1 主路径，但还没有完整接口详情。创建前必须先补 `docs/api-contract.md` 和本文，再分配前端、后端、后台实现。

| 模块 | 建议 Path | 端侧 | 状态 | 创建前必须确认 |
| --- | --- | --- | --- | --- |
| Recipe | `GET /api/recipes` | 小程序 | 待创建 | 饭搭子筛选、分页、系统/私有来源区分 |
| Recipe | `GET /api/recipes/{recipeId}` | 小程序 | 待创建 | 固定内容版本、私有菜谱权限 |
| Recipe | `POST /api/recipes` | 小程序 | 待创建 | `operationId`、本地字段、内容版本创建规则 |
| Recipe | `PUT /api/recipes/{recipeId}` | 小程序 | 待创建 | 哪些字段创建新版本、哪些字段只更新展示元数据 |
| Recipe | `GET /api/system-recipes` | 小程序 | 待创建 | 系统推荐广场筛选和分页 |
| RecipeImport | `POST /api/recipe-imports` | 小程序 | 待创建 | v0.1 建议路径；v0.2 产品操作名为“收录”，最终路径待契约 |
| Meal | `POST /api/meal-plans` | 小程序 | 待创建 | 下一餐事务边界、`operationId` |
| Meal | `GET /api/meal-plans` | 小程序 | 待创建 | 当前计划和历史计划查询口径 |
| Poll | `POST /api/meal-polls` | 小程序 | 待创建 | 点菜征集状态、截止、权限 |
| Poll | `POST /api/meal-poll-votes` | 小程序 | 待创建 | 投票幂等、重复点菜、关闭后处理 |
| Fridge | `GET /api/fridge-items` | 小程序 | 待创建 | 冰箱归属、三态、分页或全量 |
| Fridge | `PUT /api/fridge-items/{fridgeItemId}` | 小程序 | 待创建 | `version` 乐观锁、权限 |
| Shopping | `GET /api/shopping-lists/current` | 小程序 | 待创建 | 当前清单生成和关闭规则 |
| Shopping | `POST /api/shopping-items` | 小程序 | 待创建 | `operationId`、重复食材合并规则 |
| Shopping | `POST /api/shopping-items/check` | 小程序 | 待创建 | 勾选状态、多人并发、版本 |
| Share | `POST /api/share-snapshots` | 小程序 | 待创建 | 快照内容固定版本、隐私字段 |
| Share | `GET /api/share-snapshots/{snapshotId}` | 小程序 | 待创建 | 只读预览、过期、导入入口 |
| AdminRecipe | `GET /api/admin/recipes` | 后台 | 待创建 | 系统菜谱治理字段、分页和状态 |
| AdminRecipe | `POST /api/admin/imports` | 后台 | 待创建 | 导入批次、校验结果、错误回传 |
| AdminRecipe | `POST /api/admin/imports/{batchId}/publish` | 后台 | 待创建 | 发布事务、重复发布、审计 |
| DiningGroup | `GET /api/dining-groups/current` | 小程序 | 待契约 | 唯一活跃饭搭子、原空间摘要和服务端权益 |
| DiningGroup | `POST /api/dining-groups/{diningGroupId}/leave` | 小程序 | 待契约 | 退出、恢复和迁出快照事务 |
| OriginalSpace | `GET /api/original-space/importable-data` | 小程序 | 待契约 | 可迁入资料白名单 |
| OriginalSpace | `POST /api/original-space/imports` | 小程序 | 待契约 | 容量预检与幂等 |
| CarryBack | `GET /api/carry-back-snapshots` | 小程序 | 待契约 | 私有快照与服务端有效期 |
| CarryBack | `POST /api/carry-back-snapshots/{snapshotId}/imports` | 小程序 | 待契约 | 分批幂等导入 |
| Storage | `GET /api/storage-usage` | 小程序 | 待契约 | 模块逻辑空间明细 |
| Entitlement | `GET /api/entitlements/current` | 小程序 | 待契约 | 服务端解析权益 |
| Taste | `GET /api/users/me/taste-profile` | 小程序 | 待契约 | 用户级口味资料 |
| Taste | `PUT /api/users/me/taste-profile` | 小程序 | 待契约 | 更新口味资料 |
| MealGuest | `POST /api/meal-plans/{mealPlanId}/guest-invitations` | 小程序 | 待契约 | 临时饭局邀请 |
| MealGuest | `POST /api/meal-guest-invitations/{invitationId}/respond` | 小程序 | 待契约 | 饭局回应和本次口味快照 |

## 暂不创建接口

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| Public | 暂不创建 | V1 不开放用户公共投稿和公开 UGC 运营闭环 |
| Worker / Outbox | 暂不创建 | V1 建表但不启动 Worker，不开放业务接口 |
| Point / OCR / AI / Pro | 暂不创建 | Reserved，不开放服务和客户端入口 |
| Receipt / FridgePhoto | 暂不创建 | 当前不做小票识别和冰箱物品图片 |
| Chat / Comment / Follow / PrivateMessage | 暂不创建 | V1 明确不做聊天、评论、关注和私信 |

## 通用约定

### 统一响应

所有接口返回统一 JSON 包装。

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "serverTime": "2026-07-19T10:30:00Z"
}
```

规则：

1. 成功时 `code=0`。
2. 业务数据只放在 `data`。
3. 失败时 `data` 可以为 `null` 或错误上下文。
4. 前端业务判断优先看响应体 `code`，HTTP 状态码保持语义化。

### 鉴权 Header

小程序用户接口：

```text
Authorization: Bearer <userAccessToken>
```

后台管理接口：

```text
Authorization: Bearer <adminAccessToken>
```

### 小程序默认 Header

小程序请求层会统一附加以下 Header。它们不是业务参数，不写入每个接口的 body 或 query。

```text
X-Cook-From: mini_program
X-Cook-Version: 0.1.0
```

| Header | 来源 | 说明 |
| --- | --- | --- |
| `X-Cook-From` | `apps/client/src/config/env.ts` | 优先使用 `VITE_COOK_FROM`；未配置时按 userAgent 实时判断 `h5` / `pc` / `ios` / `android` / `harmony`，无法判断时回退 `mini_program` |
| `X-Cook-Version` | `apps/client/src/config/env.ts` | 默认读取 `apps/client/src/config/app.ts` 的 `APP_VERSION`，应与小程序 `manifest.json` 的 `versionName` 保持一致 |

说明：

1. 当前只传 `X-Cook-From` 和 `X-Cook-Version`。
2. 开发 / 正式环境由后端部署环境决定，不信任前端 Header。
3. token 有效期由后端环境变量控制，前端只按 `expiresAt` 判断是否需要刷新或退出。
4. `X-Cook-From` 每次请求从运行时配置读取，不写 storage；H5、PC、iOS、Android、鸿蒙场景按 userAgent 判断。

### 分页

列表接口默认使用 `page` + `pageSize`。

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

### 错误码

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

## 接口列表

### 1.1 手机号密码登录

* **编号**: `C-001`
* **Method**: `POST`
* **Path**: `/api/auth/login`
* **Auth**: 无
* **实现**: `apps/api/src/modules/auth/auth.controller.ts`
* **api-client**: `auth.loginWithPassword(body)`

**Body**:

```json
{
  "phone": "13800000000",
  "password": "用户已创建的密码"
}
```

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "user.jwt.token",
    "expiresAt": "2026-07-20T10:30:00Z",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "uid": 10000001,
      "nickname": "小明",
      "avatarUrl": null,
      "phone": "13800000000"
    }
  },
  "serverTime": "2026-07-19T10:30:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 无需登录 |
| 数据职责 | 只完成身份校验并返回用户 token、`userId` 和用户基础资料 |
| 密码规则 | 密码由用户或种子数据预先创建；前端不内置默认密码 |
| 失败口径 | 手机号不存在、密码错误或用户禁用统一返回 `401` 和 `手机号或密码错误` |
| 后续请求 | 登录成功后可直接用返回的 `user` 展示基础信息，不立即重复请求 `/api/users/me`，也不默认请求饭搭子、菜谱、冰箱或购物数据 |

### 1.1.1 刷新登录态

* **编号**: `C-010`
* **Method**: `POST`
* **Path**: `/api/auth/refresh`
* **Auth**: `UserBearerAuth`
* **实现**: `apps/api/src/modules/auth/auth.controller.ts`
* **api-client**: `auth.refreshSession()`

**Header**:

```text
Authorization: Bearer <userAccessToken>
X-Cook-From: mini_program
X-Cook-Version: 0.1.0
```

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "new-user.jwt.token",
    "expiresAt": "2026-08-02T10:30:00Z"
  },
  "serverTime": "2026-07-19T10:30:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 小程序用户 token |
| 调用时机 | 小程序启动或回到前台时，距离过期不足 3 天自动调用 |
| 数据职责 | 只刷新 token 和 `expiresAt`，不返回用户资料 |
| 有效期 | 开发默认 30 天，生产默认 14 天；以后端 `USER_TOKEN_EXPIRES_SECONDS` 为准 |
| 降频 | 本地 10 分钟内最多检查一次，避免频繁前后台切换重复请求 |
| 失败处理 | `401` 时清理本地 session 并退出登录 |

### 1.2 获取当前用户

* **编号**: `C-002`
* **Method**: `GET`
* **Path**: `/api/users/me`
* **Auth**: `UserBearerAuth`
* **实现**: `apps/api/src/modules/user/user.controller.ts`
* **api-client**: `user.getCurrent()`

**Header**:

```text
Authorization: Bearer <userAccessToken>
```

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "uid": 10000001,
    "nickname": "小明",
    "avatarUrl": null,
    "phone": "13800000000"
  },
  "serverTime": "2026-07-19T10:30:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 小程序用户 token |
| 数据职责 | 只返回当前用户基础资料，不返回治理字段、饭搭子、菜谱、冰箱或购物集合 |
| 调用时机 | 启动恢复只用本地缓存；缓存缺失或过期不自动请求，由当前页面按需请求 |
| 缓存 | 小程序本地缓存用户资料 10 分钟，只缓存当前账号资料 |
| 失败处理 | `401` 时清理 session，由页面决定是否展示登录组件 |

### 1.3 更新当前用户

* **编号**: `C-003`
* **Method**: `PUT`
* **Path**: `/api/users/me`
* **Auth**: `UserBearerAuth`
* **实现**: `apps/api/src/modules/user/user.controller.ts`
* **api-client**: `user.updateCurrent(body)`

**Header**:

```text
Authorization: Bearer <userAccessToken>
```

**Body**:

```json
{
  "nickname": "小明",
  "avatarUrl": "https://example.com/avatar.png",
  "phone": "13800000000"
}
```

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "uid": 10000001,
    "nickname": "小明",
    "avatarUrl": "https://example.com/avatar.png",
    "phone": "13800000000"
  },
  "serverTime": "2026-07-19T10:35:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 小程序用户 token |
| Body | `nickname`、`avatarUrl`、`phone` 都是可选字段 |
| 数据职责 | 更新并返回当前用户基础资料，不处理饭搭子成员资料，不返回治理字段或业务集合 |
| 安全 | 只能更新当前 token 对应用户，不能通过 body 指定其他用户 ID |

### 2.1 我的饭搭子列表

> 当前实现快照：本接口仍返回 v0.1 多列表形状。v0.2 不提供普通多饭搭子切换，调用端不得基于本接口扩展切换 UI；目标接口与 DTO 见 `docs/api-contract.md`。

* **编号**: `C-004`
* **Method**: `GET`
* **Path**: `/api/dining-groups/mine`
* **Auth**: `UserBearerAuth`
* **实现**: `apps/api/src/modules/dining-group/dining-group.controller.ts`
* **api-client**: `diningGroup.listMine()`

**Header**:

```text
Authorization: Bearer <userAccessToken>
```

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "diningGroups": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "我的饭搭子",
        "ownerId": "550e8400-e29b-41d4-a716-446655440000",
        "collaborationMode": "SHARED",
        "sharedQuotaPolicy": "ALL_WRITERS",
        "memberLimit": 5,
        "status": "ACTIVE",
        "version": 1,
        "myRole": "OWNER",
        "myMemberStatus": "ACTIVE",
        "memberCount": 1,
        "createdAt": "2026-07-19T10:30:00Z",
        "updatedAt": "2026-07-19T10:30:00Z"
      }
    ],
    "currentDiningGroupId": "550e8400-e29b-41d4-a716-446655440000",
    "limits": {
      "ownedLimit": 1,
      "joinedLimit": 5,
      "freeMemberLimit": 5
    }
  },
  "serverTime": "2026-07-19T10:30:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 小程序用户 token |
| 数据职责 | 返回当前 v0.1 实现中的用户创建或已加入饭搭子；不代表 v0.2 产品允许多饭搭子 |
| currentDiningGroupId | v0.1 服务端建议值；不得据此实现普通切换 UI |
| 权限 | 被移除成员不可继续读取饭搭子数据 |

### 2.2 创建饭搭子

* **编号**: `C-005`
* **Method**: `POST`
* **Path**: `/api/dining-groups`
* **Auth**: `UserBearerAuth`
* **实现**: `apps/api/src/modules/dining-group/dining-group.controller.ts`
* **api-client**: `diningGroup.create(body)`

**Header**:

```text
Authorization: Bearer <userAccessToken>
```

**Body**:

```json
{
  "name": "我的饭搭子",
  "operationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "diningGroup": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "我的饭搭子",
      "ownerId": "550e8400-e29b-41d4-a716-446655440000",
      "collaborationMode": "SHARED",
      "sharedQuotaPolicy": "ALL_WRITERS",
      "memberLimit": 5,
      "status": "ACTIVE",
      "version": 1,
      "myRole": "OWNER",
      "myMemberStatus": "ACTIVE",
      "memberCount": 1,
      "createdAt": "2026-07-19T10:30:00Z",
      "updatedAt": "2026-07-19T10:30:00Z"
    },
    "ownerMember": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "diningGroupId": "550e8400-e29b-41d4-a716-446655440000",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "uid": 10000001,
        "nickname": "小明",
        "avatarUrl": null
      },
      "role": "OWNER",
      "status": "ACTIVE",
      "joinedAt": "2026-07-19T10:30:00Z",
      "invitedAt": null,
      "version": 1
    }
  },
  "serverTime": "2026-07-19T10:30:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 小程序用户 token |
| operationId | 客户端生成 UUID，用于弱网重试幂等 |
| 数据职责 | 事务内创建饭搭子和 owner 成员关系 |
| 业务规则 | v0.1 每个用户最多创建 1 个；v0.2 注册后自动创建单人饭搭子，普通流程不再手动创建 |

### 2.3 饭搭子详情

* **编号**: `C-006`
* **Method**: `GET`
* **Path**: `/api/dining-groups/{diningGroupId}`
* **Auth**: `UserBearerAuth`
* **实现**: `apps/api/src/modules/dining-group/dining-group.controller.ts`
* **api-client**: `diningGroup.get(diningGroupId)`

**Header**:

```text
Authorization: Bearer <userAccessToken>
```

**Path 参数**:

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `diningGroupId` | 是 | 饭搭子 UUID |

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "我的饭搭子",
    "ownerId": "550e8400-e29b-41d4-a716-446655440000",
    "collaborationMode": "SHARED",
    "sharedQuotaPolicy": "ALL_WRITERS",
    "memberLimit": 5,
    "status": "ACTIVE",
    "version": 1,
    "myRole": "OWNER",
    "myMemberStatus": "ACTIVE",
    "memberCount": 1,
    "createdAt": "2026-07-19T10:30:00Z",
    "updatedAt": "2026-07-19T10:30:00Z"
  },
  "serverTime": "2026-07-19T10:30:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 小程序用户 token |
| 权限 | 只有有效成员可以读取饭搭子详情 |
| 安全 | 修改参数访问其他饭搭子必须返回 `403` 或 `404`，不能泄露隐私 |

### 2.4 饭搭子成员列表

* **编号**: `C-007`
* **Method**: `GET`
* **Path**: `/api/dining-group-members?diningGroupId={diningGroupId}`
* **Auth**: `UserBearerAuth`
* **实现**: `apps/api/src/modules/dining-group/dining-group.controller.ts`
* **api-client**: `diningGroup.listMembers(diningGroupId)`

**Header**:

```text
Authorization: Bearer <userAccessToken>
```

**Query**:

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `diningGroupId` | 是 | 饭搭子 UUID |

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "diningGroupId": "550e8400-e29b-41d4-a716-446655440000",
    "members": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "diningGroupId": "550e8400-e29b-41d4-a716-446655440000",
        "user": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "uid": 10000001,
          "nickname": "小明",
          "avatarUrl": null
        },
        "role": "OWNER",
        "status": "ACTIVE",
        "joinedAt": "2026-07-19T10:30:00Z",
        "invitedAt": null,
        "version": 1
      }
    ]
  },
  "serverTime": "2026-07-19T10:30:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 小程序用户 token |
| 数据职责 | 返回饭搭子成员及成员角色 |
| 权限 | 有效成员可以查看成员列表 |
| 安全 | 被移除、已退出成员不应继续获得数据访问权 |

### 2.5 创建邀请

* **编号**: `C-008`
* **Method**: `POST`
* **Path**: `/api/dining-group-invites`
* **Auth**: `UserBearerAuth`
* **实现**: `apps/api/src/modules/dining-group/dining-group.controller.ts`
* **api-client**: `diningGroup.createInvite(body)`

**Header**:

```text
Authorization: Bearer <userAccessToken>
```

**Body**:

```json
{
  "diningGroupId": "550e8400-e29b-41d4-a716-446655440000",
  "operationId": "550e8400-e29b-41d4-a716-446655440002"
}
```

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "inviteToken": "opaque-random-token",
    "sharePath": "/pages/dining-group/invite?token=opaque-random-token",
    "expiresAt": "2026-07-26T10:30:00Z"
  },
  "serverTime": "2026-07-19T10:30:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 小程序用户 token |
| 权限 | `OWNER` 可以邀请和移除成员；`ADMIN` 可以邀请成员；`MEMBER` 不能邀请 |
| operationId | 相同 `operationId` 重试必须返回第一次生成的邀请结果 |
| 安全 | 邀请 token 是不透明随机串；后端只保存 token hash，不保存原始 token |

### 2.6 接受邀请

* **编号**: `C-009`
* **Method**: `POST`
* **Path**: `/api/dining-group-invites/{inviteToken}/accept`
* **Auth**: `UserBearerAuth`
* **实现**: `apps/api/src/modules/dining-group/dining-group.controller.ts`
* **api-client**: `diningGroup.acceptInvite(inviteToken, body)`

**Header**:

```text
Authorization: Bearer <userAccessToken>
```

**Path 参数**:

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `inviteToken` | 是 | 邀请 token 原文 |

**Body**:

```json
{
  "operationId": "550e8400-e29b-41d4-a716-446655440003"
}
```

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "diningGroup": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "我的饭搭子",
      "ownerId": "550e8400-e29b-41d4-a716-446655440000",
      "collaborationMode": "SHARED",
      "sharedQuotaPolicy": "ALL_WRITERS",
      "memberLimit": 5,
      "status": "ACTIVE",
      "version": 1,
      "myRole": "MEMBER",
      "myMemberStatus": "ACTIVE",
      "memberCount": 2,
      "createdAt": "2026-07-19T10:30:00Z",
      "updatedAt": "2026-07-19T10:35:00Z"
    },
    "member": {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "diningGroupId": "550e8400-e29b-41d4-a716-446655440000",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440005",
        "uid": 10000002,
        "nickname": "小红",
        "avatarUrl": null
      },
      "role": "MEMBER",
      "status": "ACTIVE",
      "joinedAt": "2026-07-19T10:35:00Z",
      "invitedAt": "2026-07-19T10:30:00Z",
      "version": 1
    }
  },
  "serverTime": "2026-07-19T10:35:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 小程序用户 token |
| 事务 | v0.2 必须事务内校验唯一活跃长期饭搭子、目标成员上限、邀请有效期、成员状态和原空间冻结条件 |
| 幂等 | 同一用户重复接受同一邀请不得重复创建成员 |
| 并发 | 多人并发接受邀请不能突破成员上限 |

### 3.1 管理员登录

* **编号**: `A-001`
* **Method**: `POST`
* **Path**: `/api/admin/auth/login`
* **Auth**: 无
* **实现**: `apps/api/src/modules/auth/admin.controller.ts`
* **api-client**: `admin.login(body)`

**Body**:

```json
{
  "username": "admin",
  "password": "管理员已创建的密码"
}
```

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "admin.jwt.token",
    "expiresAt": "2026-07-20T10:30:00Z",
    "admin": {
      "id": "550e8400-e29b-41d4-a716-446655440100",
      "username": "admin",
      "displayName": "管理员",
      "roles": ["SUPER_ADMIN"]
    }
  },
  "serverTime": "2026-07-19T10:30:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 无需登录 |
| 数据职责 | 只完成后台管理员身份校验并返回 admin token |
| 隔离 | 后台管理员登录不复用小程序用户登录 |
| 安全 | admin token 只能调用后台管理接口 |

### 3.2 用户只读查询

* **编号**: `A-002`
* **Method**: `GET`
* **Path**: `/api/admin/users`
* **Auth**: `AdminBearerAuth`
* **实现**: `apps/api/src/modules/auth/admin.controller.ts`
* **api-client**: `admin.listUsers(query)`

**Header**:

```text
Authorization: Bearer <adminAccessToken>
```

**Query**:

| 参数 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `page` | 否 | `1` | 页码，从 1 开始 |
| `pageSize` | 否 | `20` | 每页条数，最大 100 |
| `keyword` | 否 | - | 用户关键字 |

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "uid": 10000001,
        "nickname": "小明",
        "avatarUrl": null,
        "phone": "13800000000",
        "status": "ACTIVE",
        "createdAt": "2026-07-19T10:30:00Z",
        "updatedAt": "2026-07-19T10:30:00Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "hasNext": false
  },
  "serverTime": "2026-07-19T10:30:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 后台管理员 token |
| 数据职责 | 后台只读查询用户列表 |
| 分页 | `page` 从 1 开始，`pageSize` 最大 100 |
| 安全 | 小程序用户 token 不能调用该接口 |

### 3.3 饭搭子只读查询

* **编号**: `A-003`
* **Method**: `GET`
* **Path**: `/api/admin/dining-groups`
* **Auth**: `AdminBearerAuth`
* **实现**: `apps/api/src/modules/auth/admin.controller.ts`
* **api-client**: `admin.listDiningGroups(query)`

**Header**:

```text
Authorization: Bearer <adminAccessToken>
```

**Query**:

| 参数 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `page` | 否 | `1` | 页码，从 1 开始 |
| `pageSize` | 否 | `20` | 每页条数，最大 100 |
| `keyword` | 否 | - | 饭搭子关键字 |
| `status` | 否 | - | 饭搭子状态，例如 `ACTIVE` |

**Response**:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "我的饭搭子",
        "ownerId": "550e8400-e29b-41d4-a716-446655440000",
        "collaborationMode": "SHARED",
        "sharedQuotaPolicy": "ALL_WRITERS",
        "memberLimit": 5,
        "status": "ACTIVE",
        "version": 1,
        "myRole": "OWNER",
        "myMemberStatus": "ACTIVE",
        "memberCount": 1,
        "createdAt": "2026-07-19T10:30:00Z",
        "updatedAt": "2026-07-19T10:30:00Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "hasNext": false
  },
  "serverTime": "2026-07-19T10:30:00Z"
}
```

**说明**：

| 项目 | 说明 |
| --- | --- |
| 鉴权 | 后台管理员 token |
| 数据职责 | 后台只读查询饭搭子列表 |
| 筛选 | 当前支持 `keyword` 和 `status` |
| 安全 | 小程序用户 token 不能调用该接口 |

## 维护规则

1. 新接口先进入本文的 `待创建接口`，只写建议路径、端侧、状态和必须确认点。
2. 契约确认后，同步 `docs/api-contract.md`，再补本文的 Method、Path、Header、Body、Response 和说明。
3. 后端、`packages/api-client`、小程序或后台接入完成后，把本文和 `docs/api-index.md` 状态改为 `已实现`。
4. 已实现接口必须写明调用入口和后端实现文件，方便前端、后端、后台同步联调。
5. 禁止用多字段 fallback 或猜测响应字段绕过未确认契约。
