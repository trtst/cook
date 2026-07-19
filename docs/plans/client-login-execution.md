# 功能执行单：小程序用户手机号密码登录子纵切

## 目标

- 本功能要跑通的最小业务闭环：用户在小程序 `我的` 页面输入手机号和密码，调用 `/auth/login` 登录，保存用户 token，恢复 session，并在 401 时清理登录态。
- 对应 V1 范围：用户账号基础链路。本轮只是手机号密码登录子纵切，不代表完整 V1 微信登录完成。

## 本轮范围

- 小程序端：`apps/client` 登录组件、session store、请求层 401 清理、`我的` 页面主入口验收。
- 后端 API：复核或最小修正 `POST /auth/login`、`GET /users/me`、用户 token、登录限流和统一 401 行为。
- 后台管理：不纳入本轮；后台管理员登录独立处理。
- 共享契约：复核 `PasswordLoginRequest`、`PasswordLoginResult`、`UserBasic`、`UserProfile`、`UnauthorizedError`，必要时同步 `packages/api-client`。

## 本轮不做

- 微信授权登录、手机号授权、短信验证码、注册、找回密码。
- 后台管理员登录。
- 饭搭子创建、邀请、成员管理、当前饭搭子选择、登录后自动创建或选择饭搭子。
- 多设备管理、复杂登录态续期策略。
- 登录 UI 大改版或新建独立登录页。
- 全局登录弹窗、跨页面重试队列、登录后业务数据自动刷新。

## CTO 拆解

CTO 负责把功能拆成最小纵切链路，并确认接口契约、数据边界、权限规则、验收口径和集成顺序。

| 端 | 负责人 | 最小任务 | 输入 | 输出 | 依赖 | 验收 |
| --- | --- | --- | --- | --- | --- | --- |
| 小程序 | `cook-frontend` | 登录表单、表单校验、保存 session、401 清理、`我的` 页面登录态切换 | `/auth/login` 契约、session store、请求层 | 登录成功可展示已登录状态，失败统一提示 | `packages/api-client`、`apps/client/src/apis/http.ts` | `我的` 页面可完成成功/失败/未登录态验证 |
| 后端 | `cook-backend` | 只读复核并在必要时最小修正登录安全和契约缺口 | `docs/api-contract.md`、auth controller/service/token/guard | `/auth/login` 与 `/users/me` 行为符合契约 | Prisma 用户表、密码哈希、token service | 401 统一提示、限流存在、密码不进日志 |
| 后台 | 无 | 本轮不处理 |  |  |  | 不适用 |
| 共享契约 | 主代理 | 判断是否需要修改 `packages/api-client` | API 契约与现有类型 | 字段一致，不引入兜底字段 | 前后端真实实现 | 类型检查通过 |

## 开发者最小任务确认

### 小程序确认

- 最小交付：手机号密码登录组件不带默认账号；基础校验；登录成功写入 session/user；401 清理 session；`我的` 页面作为主验收入口。
- 依赖：`authApi.loginWithPassword()`、`useSessionStore()`、`useUserStore()`、请求层 `onUnauthorized`。
- 是否先用 mock：不再使用 mock 请求通道；登录链路以真实 API 和 seed 数据验证。
- 不做项：不做微信登录、注册、找回密码、饭搭子邀请、全局登录弹窗。
- 验收方式：`我的` 页面未登录展示登录组件；正确登录后展示用户信息；错误登录展示统一提示；401 后回到未登录态。

### 后端确认

- 最小交付：复核 `/auth/login`、`/users/me`、用户 token、登录限流、统一错误提示。
- 数据表 / 事务边界：本轮只读用户与密码哈希；登录成功生成 token，不涉及业务事务。
- 错误码：手机号不存在、密码错误、用户禁用统一 `401` 和 `手机号或密码错误`；token 缺失或失效统一 `401` 和 `未登录或 token 失效`。
- 不做项：不做注册、微信 code 换 session、管理员登录、多设备管理。
- 验收方式：接口行为与 `docs/api-contract.md` 一致；密码不写入日志；限流 guard 存在。

### 后台确认

- 最小交付：无。
- 页面入口 / 权限：后台管理员登录不属于本轮。
- 依赖：无。
- 不做项：不改 `apps/admin`。
- 验收方式：不适用。

## 接口契约

接口契约必须先更新 `docs/api-contract.md` 或在本文写明草案并标记待同步。

| 方法 | 路径 | 用途 | 权限 | 幂等 | 版本字段 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/auth/login` | 手机号密码登录，返回用户 token 和用户摘要 | none | 否 | 否 | 已确认 |
| GET | `/users/me` | 获取当前用户摘要 | UserBearerAuth | 否 | 否 | 已确认 |
| POST | `/auth/refresh` | 当前 token 临近过期时续期 | UserBearerAuth | 否 | 否 | 已确认 |

## 共享类型

- `packages/domain`：本轮预期不改。
- `packages/api-client`：复核 `PasswordLoginRequest`、`PasswordLoginResult`、`UserBasic`、`UserProfile`、`UnauthorizedError`；字段不够时按契约最小修改。
- DTO / 枚举 / 错误码：沿用 `docs/api-contract.md`，不新增错误码。

## 联调清单

- [x] 小程序真实 API 路径可跑通
- [ ] 小程序接真实接口通过
- [x] 登录表单空手机号 / 空密码不会提交
- [x] 登录失败统一提示，不暴露账号是否存在
- [x] 登录成功后 session 和 user store 写入
- [x] 登录成功后不自动请求 `/users/me`
- [x] 启动恢复登录态时只恢复本地用户缓存，缓存缺失或过期不自动补请求 `/users/me`
- [x] `GET /users/me` token 失效返回 401 后清理 session 并触发页面未登录态
- [x] 请求层 401 不跳转、不弹窗、不维护重试队列
- [x] 刷新或重启后可恢复已保存 session
- [x] token 临近过期时按 10 分钟检查节流自动续期
- [x] `/users/me` 用户资料按用户维度缓存 10 分钟，手动刷新或页面按需请求可绕过缓存
- [x] 密码不持久化、不进入日志或错误摘要

## mini_teach 对照吸收

本轮只吸收工程边界，不迁移业务代码。

| mini_teach 观察点 | cook 吸收方式 | 不吸收内容 |
| --- | --- | --- |
| `config/` 单独维护应用元信息和环境域名 | `apps/client/src/config/app.ts` 放应用常量，`env.ts` 放 API 地址、来源和版本，`index.ts` 聚合导出 | 不引入老师、课程、聊天域名等业务配置 |
| `apis/http.js` 统一附加默认来源、token、401 和网络错误处理 | `apps/client/src/apis/http.ts` 负责 token、401、refresh 节流；`adapters/uni.ts` 负责 `uni.request` 平台调用 | 不引入大型 `HttpRequest` 类和拦截器链，避免压过 `packages/api-client` 的类型契约 |
| 上传下载走同一请求边界 | `apps/client/src/apis/adapters/uni.ts` 封装 `uploadFile` / `downloadFile`，业务侧从 `http.ts` 调用并自动带 token | 不允许页面绕过 API 层直接拼鉴权头 |
| 本地 storage 加项目 prefix | 当前先保留现有 Pinia 持久化键；后续如果 storage 键增多，再单独做 `storage keys` 收口 | 不为当前少量 key 提前增加全局 storage 工具 |
| 路由工具会清理无效 query 并处理栈深 | cook 以后出现跨页鉴权、分享参数和复杂跳转时再评估 | 登录纵切不新增路由封装，避免过度拆分 |

## 验收状态

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 开发完成 | 已完成 | 去除默认凭据；登录表单校验；`我的` 页展示真实用户基础资料；401 清 session；token 解析统一 401；登录和 `/users/me` 改用 `UserBasic` |
| 联调完成 | 未完成 | 真实小程序和真实 API 手动联调未执行 |
| 机器检查 | 已完成 | `git diff --check`、`pnpm --filter @next-meal/api-client type-check`、`pnpm --filter @next-meal/client type-check`、`pnpm --filter @next-meal/api type-check`、`pnpm --filter @next-meal/admin type-check`、`pnpm check` |
| 手动验收 | 未完成 | 未在微信小程序真机或开发者工具中执行 |
| 可发布 | 否 |  |

## 风险与遗留

- 风险：当前环境未必具备真实小程序端手动验收能力；必须以真实接口联调结果作为验收证据。
- 遗留：微信登录、注册、找回密码、饭搭子邀请链路后续独立拆解。
- 发布前必须处理：去除前端默认手机号/密码；确认 401 清理路径可用；确认密码不进入日志或持久化；确认登录限流 guard 存在。
