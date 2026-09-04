# Cook Login System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Cook 的登录体系统一为手机号主账号，完成真实微信手机号授权、短信验证码、手机号密码、会话续期和退出清理，并让 LoginModal 在最后承接完整状态机和新的视觉设计。

**Architecture:** 手机号是唯一业务账号标识，微信身份只作为 `user_id` 下的登录身份。短期 access token 继续由服务端签发，长期 refresh token 使用随机不透明凭证且仅保存哈希，由 `auth_sessions` 管理过期、吊销和设备信息；微信短会话和短信验证码均为一次性、短时效凭证。客户端由统一 session store 和请求层负责恢复、续期、401 重试和清理，业务入口继续通过全局 LoginModal 触发登录。

**Tech Stack:** NestJS + Prisma + PostgreSQL + Redis/现有限流边界、uni-app + Vue 3 + TypeScript + Pinia、微信小程序 `wx.login` 与 `button open-type="getPhoneNumber"`、个人资质阶段的阿里云 PNVS 短信认证、现有 API envelope/OpenAPI 和 HBuilderX/微信开发者工具验证链路。

**Spec:** `docs/plans/cook-login-implementation-plan.md`

## Global Constraints

- V1 只实现手机号主账号、微信手机号快捷登录、短信验证码登录、手机号密码备用登录、续期、退出和必要风控。
- 不接邮箱登录、其他 OAuth、用户注销/恢复流程、图形验证码 UI、独立登录页、后台登录改造或会员/权限扩展。
- 一个手机号只能对应一个 `user_id`；微信身份只能绑定到已有或新建的该 `user_id`，不得按登录方式重复创建账号。
- 真实微信手机号授权必须经过客户端微信组件和服务端微信接口；不能用 `openid` 登录替代手机号授权，也不能用固定验证码替代短信通道。
- 验证码、微信短会话凭证和 refresh token 只保存哈希；微信 `openid`、`unionid`、`session_key` 不返回给客户端。
- 所有登录入口共享手机号/IP/设备/微信身份的限流和账号风险判断；短信与微信手机号换取的成本限制单独统计。
- API、DTO、Prisma、迁移和客户端请求类型必须按 `docs/api-database-rules.md` 与 `docs/api-contract.md` 同步更新；应用之间不得导入源码。
- 可重试写接口使用数字字符串 `Idempotency-Key`；本轮不自动提交 Git，完成后保留工作区供用户审阅。
- 静态检查和 API 脚本不能替代 HBuilderX、微信开发者工具和真机的微信授权验收。

## Confirmed Scope And Explicit Non-Goals

本轮必须完成：

1. 统一账号归并：微信手机号、短信和密码最终登录同一个手机号账号。
2. 微信流程：`wx.login` 获取 code，服务端识别已绑定身份；未绑定时由微信手机号组件授权，再完成绑定或建号。
3. 短信流程：真实发送、冷却、过期、一次性消费和登录。
4. 密码流程：登录、已登录用户设置和修改密码；密码失败次数进入统一风险限制。
5. 会话流程：access token、refresh token、服务端 session、客户端单飞续期、401 只重放一次。
6. 退出流程：服务端吊销 session，客户端清理 token、用户和通知角标等用户态缓存，并禁止主动退出后启动静默恢复完整登录。
7. UI 流程：最后重构 LoginModal，加入微信手机号授权按钮、手机号登录入口、协议勾选和随机两行底部文案；文案在同一次弹窗生命周期内保持稳定，下次打开再随机。

明确不做：邮箱、其他第三方登录、注销/恢复账号、图形验证码、外部告警平台、登录页之外的全局视觉改造，以及与登录无关的业务页面重构。

## Planned File Map

- `docs/api-contract.md`: 当前 auth 请求、响应、错误码和鉴权语义。
- `apps/api/prisma/schema.prisma` 与新 migration：用户微信身份、认证 session、微信短会话、短信验证码和风险事件的数据库事实。
- `apps/api/src/contracts/types.ts`: API 内部请求/响应类型。
- `apps/api/src/contracts/dtos.ts`: 严格白名单 DTO 和校验。
- `apps/api/src/contracts/openapi.ts`: 成功响应的 OpenAPI model。
- `apps/api/src/modules/auth/auth.controller.ts`: auth 路由、匿名/登录态 guard 和统一 envelope。
- `apps/api/src/modules/auth/auth.service.ts`: 账号归并、会话签发、刷新、退出和密码流程。
- `apps/api/src/modules/auth/wechat-auth.service.ts`: code2session、手机号换取和微信错误映射；外部调用可注入替身测试。
- `apps/api/src/modules/auth/sms-auth.service.ts`: 短信生成、哈希、发送和按手机号/IP/设备限流；短信网关可注入替身测试。
- `apps/api/src/modules/auth/auth-risk.service.ts`: 登录失败锁定、成本通道和风险事件记录。
- `apps/api/src/common/security/user-token.service.ts`: access token 和 refresh token 的签发/校验边界。
- `apps/client/src/platform/uni.ts`: 微信登录 code、手机号授权回调和设备标识的唯一平台入口。
- `apps/client/src/apis/auth.ts`、`apps/client/src/apis/http.ts`: auth 请求类型、请求路径、refresh 单飞和 401 重放。
- `apps/client/src/stores/session.ts`、`apps/client/src/stores/user.ts`、`apps/client/src/utils/session-cleanup.ts`: 完整登录态和退出清理。
- `apps/client/src/components/Login/LoginModal.vue`、`apps/client/src/components/Login/login.scss`、`apps/client/src/components/Login/types.ts`: 真实登录状态机和最终 UI。
- `apps/api/scripts/verify-login-flow.ts`、`apps/api/scripts/verify-login-modal-flow.ts` 及新增 auth 测试：真实 API 验收脚本和回归覆盖。
- `docs/plans/minor_change_log.md`: 完成后的中央变更记录，记录实际验证命令和未完成的真机条件。

### Task 1: Freeze Auth Contract And Test Boundaries

**Files:**
- Modify: `docs/api-contract.md`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/client/src/apis/auth.ts`
- Test: `apps/api/src/modules/auth/auth.contract.test.ts`

**Interfaces:**
- `WechatSessionRequest = { code: string; deviceId: string }`
- `WechatSessionResult = { status: "BOUND"; session: AuthSessionResult } | { status: "UNBOUND"; wechatSessionId: string } | { status: "BLOCKED"; retryAfterSeconds: number }`
- `WechatPhoneLoginRequest = { wechatSessionId: string; phoneCode: string; deviceId: string }`
- `SmsSendRequest = { phone: string; scene: "LOGIN"; deviceId: string }`
- `SmsSendResult = { cooldownSeconds: number }`
- `SmsLoginRequest = { phone: string; code: string; deviceId: string; wechatSessionId?: string }`
- `PasswordLoginRequest = { phone: string; password: string; deviceId: string }`
- `SetPasswordRequest = { password: string }`
- `ChangePasswordRequest = { currentPassword: string; newPassword: string }`
- `RefreshRequest = { refreshToken: string; deviceId: string }`
- `LogoutRequest = { refreshToken: string; deviceId: string }`
- `AuthSessionResult = { accessToken: string; refreshToken: string; accessExpiresAt: IsoDateTime; refreshExpiresAt: IsoDateTime; user: SessionUser }`

- [ ] **Step 1: Write the failing contract tests** for each new request and response shape, including strict rejection of old field names, no raw `openid`/`session_key`, and consistent 400/401/429 error semantics.
- [ ] **Step 2: Run the contract test** with `pnpm --filter @next-meal/api exec tsx src/modules/auth/auth.contract.test.ts` and record the expected failure against the current legacy contract.
- [ ] **Step 3: Update the central API contract and local API types** with the exact routes `/auth/wechat/session`, `/auth/wechat/phone-login`, `/auth/sms/send`, `/auth/sms/login`, `/auth/password/login`, `/auth/password/set`, `/auth/password/change`, `/auth/refresh`, `/auth/logout`, and `/auth/me`.
- [ ] **Step 4: Update DTO and OpenAPI models** so strict validation and generated documentation use the same fields and status literals.
- [ ] **Step 5: Update the client auth type declarations** without importing API source types, and run the contract test again until it passes.
- [ ] **Step 6: Review the route replacement**: update all in-repository callers in the later client/API tasks and remove reliance on `/auth/wechat-login`, `/auth/code-send`, `/auth/code-login`, and `/auth/login` instead of adding fallback payloads.

### Task 2: Add Minimal Auth Database Facts

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260903183000_auth_sessions_and_identities/migration.sql`
- Test: `apps/api/src/modules/auth/auth.persistence.test.ts`

**Interfaces:**
- `UserWechatIdentity`: `userId`, `appid`, `openid`, nullable `unionid`, timestamps; unique `(appid, openid)` and `(userId, appid)`.
- `AuthSession`: `userId`, unique `refreshTokenHash`, `deviceId`, `ip`, nullable `userAgent`, `expiresAt`, nullable `revokedAt`, timestamps; indexes for user/session expiry lookup.
- `WechatLoginSession`: `appid`, `openid`, nullable `unionid`, `sessionKeyHash`, unique `wechatSessionIdHash`, `expiresAt`, nullable `consumedAt`, timestamps.
- `SmsCode`: `phone`, `scene`, nullable `codeHash`, nullable PNVS `providerOutId`, `expiresAt`, nullable `consumedAt`, `ip`, `deviceId`, timestamps; index by phone/scene/created time.
- `AuthRiskEvent`: scene, nullable phone/openid, ip, deviceId, decision, reason, createdAt; index by phone/device/ip/time.

- [ ] **Step 1: Write failing persistence tests** for unique phone account reuse, one WeChat identity per appid/openid, one active short session consumption, one-time SMS consumption, refresh-session revocation, and cascade behavior for deleted users.
- [ ] **Step 2: Run the persistence tests** against the local test database and confirm the new models/constraints are absent.
- [ ] **Step 3: Audit current references** to `User.openid`, `User.unionid`, `User.phone`, `sessionVersion`, and the existing token guard before changing ownership of WeChat identity facts.
- [ ] **Step 4: Add the Prisma models and constraints**. Migrate existing non-null `users.openid`/`users.unionid` values into `user_wechat_identities` before removing duplicate identity columns; retain `UserStatus.ACTIVE|DISABLED` and map `DISABLED` to `USER_BLOCKED` rather than introducing an unconfirmed account-deletion lifecycle.
- [ ] **Step 5: Generate Prisma client and apply the migration** with the repository migration command, then rerun persistence tests.
- [ ] **Step 6: Inspect the SQL** for foreign keys, unique constraints, timestamp types, indexes tied to real queries, and no plaintext credential columns.

### Task 3: Implement Token, Session, And Account Services

**Files:**
- Modify: `apps/api/src/common/security/user-token.service.ts`
- Modify: `apps/api/src/common/user-auth.guard.ts`
- Modify: `apps/api/src/common/optional-user-auth.guard.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`
- Create: `apps/api/src/modules/auth/auth-session.service.ts`
- Test: `apps/api/src/modules/auth/auth-session.service.test.ts`
- Test: `apps/api/src/modules/auth/auth.service.test.ts`

**Interfaces:**
- `AuthSessionService.create(userId, context): Promise<AuthSessionResult>`
- `AuthSessionService.refresh(refreshToken, deviceId, context): Promise<AuthSessionResult>`
- `AuthSessionService.revoke(refreshToken, deviceId): Promise<void>`
- `AuthService.getMe(userId): Promise<MeResponse>`
- `AuthService.loginWithPassword(body): Promise<AuthSessionResult>`
- `AuthService.setPassword(userId, body): Promise<void>`
- `AuthService.changePassword(userId, body): Promise<void>`

- [ ] **Step 1: Write failing session tests** for random refresh token generation, hash-only persistence, access expiry, refresh expiry, device/session lookup, rotation, revocation, blocked users, and a second refresh using a rotated token.
- [ ] **Step 2: Run the tests** and confirm the current JWT-only `refreshSession(userId)` implementation fails the refresh-token contract.
- [ ] **Step 3: Implement `AuthSessionService`** with cryptographically random opaque refresh tokens, SHA-256 hashes, bounded expiry, transactionally rotated sessions, and explicit `revokedAt` handling.
- [ ] **Step 4: Update access token issuance and guards** so access tokens identify the user while refresh/logout use the opaque refresh token; keep guard responses within the current `UserBearerAuth` envelope.
- [ ] **Step 5: Write failing password and `/auth/me` tests** for active users, disabled users, absent password, wrong password, set/change password, and masked phone output.
- [ ] **Step 6: Implement password login, set/change password, `/auth/me`, refresh, and logout** with explicit field mapping, ownership checks, password hashing, and risk-service calls; never pass request bodies directly into Prisma.
- [ ] **Step 7: Run the focused auth tests** and verify concurrent refresh callers share one operation at the client boundary later, while the server rejects revoked/expired sessions.

### Task 4: Implement Real WeChat And SMS Providers

**Files:**
- Create: `apps/api/src/modules/auth/wechat-auth.service.ts`
- Create: `apps/api/src/modules/auth/sms-auth.service.ts`
- Create: `apps/api/src/modules/auth/auth-risk.service.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`
- Test: `apps/api/src/modules/auth/wechat-auth.service.test.ts`
- Test: `apps/api/src/modules/auth/sms-auth.service.test.ts`
- Modify: `apps/api/scripts/verify-login-flow.ts`

**Interfaces:**
- `WechatAuthService.login(code): Promise<{ appid: string; openid: string; unionid: string | null; sessionKey: string }>`
- `WechatAuthService.getPhoneNumber(phoneCode): Promise<{ phone: string }>`
- `SmsAuthService.sendLoginCode(phone, context): Promise<{ cooldownSeconds: number }>`
- `SmsAuthService.consumeLoginCode(phone, code): Promise<void>`
- `AuthRiskService.assertAllowed(input): Promise<void>`
- `AuthRiskService.record(input): Promise<void>`

- [ ] **Step 1: Write failing WeChat provider tests** for successful `code2session`, missing configuration, timeout, invalid WeChat response, phone-code exchange, and mapping external errors to 400/503 without exposing secrets.
- [ ] **Step 2: Run provider tests** with network calls replaced by an injected fake client and confirm the provider boundary does not yet exist.
- [ ] **Step 3: Implement the WeChat provider** using backend-only `WECHAT_APP_ID`, `WECHAT_APP_SECRET`, access-token acquisition and `wxa/business/getuserphonenumber`; store only the hashed short session credential and keep `session_key` server-side.
- [ ] **Step 4: Write failing SMS tests** for PNVS send/check, 60-second cooldown, expiry, one-time consumption, provider failure, and no plaintext code in database or logs.
- [ ] **Step 5: Implement the SMS gateway boundary** with backend-only Aliyun PNVS credentials, fixed server-side template parameters, `SMS_ACCESS_KEY_ID`, `SMS_ACCESS_KEY_SECRET`, `SMS_SIGN_NAME`, and `SMS_TEMPLATE_CODE`; no client-supplied message content.
- [ ] **Step 6: Write failing risk tests** for per-phone, IP, device, and openid limits, five consecutive password failures causing a 15-minute lock, and cost-channel rejection with `429` and `retryAfterSeconds`.
- [ ] **Step 7: Implement risk events and limits** using the existing rate-limit boundary plus persisted events for auditable login decisions; do not add a graph-captcha or external alert system in this task.
- [ ] **Step 8: Implement `/auth/wechat/session` and `/auth/wechat/phone-login`**: bound identities issue a session, unbound identities create a short-lived server record without creating a user, and phone authorization binds or creates the unique phone account in one transaction.
- [ ] **Step 9: Implement `/auth/sms/send` and `/auth/sms/login`**: consume codes once, reuse the unique phone user, optionally consume and bind a valid WeChat short session, then issue one auth session.
- [ ] **Step 10: Run provider, risk, and auth integration tests** with fake WeChat/SMS clients, then run `pnpm --filter @next-meal/api type-check`.

### Task 5: Build The Client Session State Machine

**Files:**
- Modify: `apps/client/src/platform/uni.ts`
- Modify: `apps/client/src/apis/auth.ts`
- Modify: `apps/client/src/apis/http.ts`
- Modify: `apps/client/src/stores/session.ts`
- Modify: `apps/client/src/stores/user.ts`
- Modify: `apps/client/src/utils/session-cleanup.ts`
- Test: `apps/client/src/stores/session.test.ts`
- Test: `apps/client/src/apis/auth.test.ts`

**Interfaces:**
- `uniPlatform.auth.login(): Promise<{ code: string }>`
- `uniPlatform.auth.getPhoneNumberCode(event): Promise<string>`
- `useSessionStore.state = { accessToken, refreshToken, user, authStatus, logoutExplicit, expiresAt, refreshExpiresAt, restored }`
- `authApi.refresh(refreshToken, deviceId): Promise<AuthSessionResult>`
- `authApi.logout(refreshToken, deviceId): Promise<void>`
- `refreshSessionIfNeeded(): Promise<void>`
- `clearUserSessionState(options?: { explicitLogout?: boolean }): Promise<void>`

- [ ] **Step 1: Write failing store tests** for restore, guest, authenticated, refreshing, expired, blocked, explicit logout, and persisted access/refresh token snapshots.
- [ ] **Step 2: Run the store tests** and confirm the current single-token store cannot represent the required states.
- [ ] **Step 3: Extend the session store** with explicit state, user snapshot, refresh token, logout marker, storage migration from the current `token` snapshot, and no fallback between unrelated field names.
- [ ] **Step 4: Write failing request-layer tests** for access-token preflight refresh, a single refresh promise for concurrent calls, one 401 replay, refresh failure cleanup, and no refresh after explicit logout.
- [ ] **Step 5: Implement request-layer refresh and replay** while preserving optional-auth requests and ensuring replayed requests carry the new access token exactly once.
- [ ] **Step 6: Add the platform phone-code adapter** so LoginModal uses the supported uni-app API and business code never calls `wx.*` directly.
- [ ] **Step 7: Update user and notification cleanup** so explicit logout clears user state, notification badge caches, pending login actions, and all persisted auth secrets.
- [ ] **Step 8: Run client focused tests, `pnpm --filter @next-meal/client type-check`, and a development mini-program build** before changing visual styles.

### Task 6: Reconnect LoginModal To The Real Login Flows

**Files:**
- Modify: `apps/client/src/components/Login/LoginModal.vue`
- Modify: `apps/client/src/components/Login/types.ts`
- Modify: `apps/client/src/components/Login/login.scss`
- Modify: `apps/client/src/stores/login-modal.ts`
- Modify: `apps/client/src/stores/login-modal-actions.ts`
- Test: `apps/client/src/stores/login-modal-actions.test.ts`
- Modify: `apps/api/scripts/verify-login-modal-flow.ts`

**Interfaces:**
- `LoginModalMode = "wechat" | "phone" | "password"`
- `LoginModalStore.open(options: { scene: LoginScene; afterLogin?: () => void }): void`
- `LoginModalStore.completeLogin(session: AuthSessionResult): Promise<void>`
- `handleWeChatPhoneLogin(event): Promise<void>`
- `handleSmsLogin(): Promise<void>`
- `handlePasswordLogin(): Promise<void>`

- [ ] **Step 1: Write failing modal tests** for agreement gating, mode transitions, WeChat unbound flow, authorization denial, SMS cooldown, password failure, risk lock, successful callback execution, and no duplicate modal instances.
- [ ] **Step 2: Run the modal tests** against the current “微信一键登录” openid-only action and record failures for the phone authorization state.
- [ ] **Step 3: Add the three-mode state machine**: default WeChat phone authorization, SMS fallback, and password fallback; preserve close/back behavior and do not add a second login CTA to business empty states.
- [ ] **Step 4: Connect WeChat button to the platform event** with `open-type="getPhoneNumber"`; first obtain or reuse the short WeChat session, then send the component code to `/auth/wechat/phone-login`.
- [ ] **Step 5: Connect SMS and password forms** to the new API routes, display server cooldown/risk messages, disable duplicate submits, and retain agreement enforcement for every login method.
- [ ] **Step 6: On success, persist the session, refresh user data, close the modal, and execute `afterLogin` once**; on failure, retain the current mode and show the mapped error.
- [ ] **Step 7: Run modal tests and `pnpm --filter @next-meal/api verify:login-modal-flow`** after updating the verification script to use real endpoint shapes with fake external providers.

### Task 7: Apply The Final Login UI And Random Copy

**Files:**
- Modify: `apps/client/src/components/Login/LoginModal.vue`
- Modify: `apps/client/src/components/Login/login.scss`
- Modify: `apps/client/src/components/Login/types.ts`
- Test: `apps/client/src/components/Login/login-copy.test.ts`
- Test: `apps/client/src/themes/token-usage.test.ts`

**Interfaces:**
- `loginCopyCandidates: readonly [string, string][]`
- `pickLoginCopy(seed?: number): { firstLine: string; secondLine: string }`
- `getLoginLogo(theme: "light" | "dark"): string`

- [ ] **Step 1: Write failing UI tests** for light/dark Logo selection, two-line copy shape, copy stability during rerender, new copy on a later modal open, agreement visibility, and no layout overflow at narrow mini-program widths.
- [ ] **Step 2: Run the UI tests** and confirm the current image-based hero UI does not satisfy the pure-color requirement or theme-specific Logo requirement.
- [ ] **Step 3: Replace the hero background with a pure-color layout** using existing theme tokens and restrained theme-color blocks/cloud-like shapes; keep the visual hierarchy focused on Logo, slogan, and the three login choices.
- [ ] **Step 4: Use `apps/client/src/assets/logo.png` for light mode and `apps/client/src/assets/assets-logo.png` for dark mode**, without copying or re-encoding the supplied assets.
- [ ] **Step 5: Add the confirmed slogan, agreement row, and candidate two-line copy pool**. Select once when the modal opens, retain through state changes, and select again only on a new open; do not rerandomize on every render.
- [ ] **Step 6: Verify button and input dimensions, safe-area spacing, dark/light contrast, loading/disabled/error states, and no overlapping text with the client theme static checks and a rendered mini-program build.

### Task 8: End-To-End Verification And Documentation

**Files:**
- Modify: `apps/api/scripts/verify-login-flow.ts`
- Modify: `apps/api/scripts/verify-login-modal-flow.ts`
- Create: `apps/api/scripts/verify-auth-system-flow.ts`
- Modify: `docs/plans/minor_change_log.md`

**Interfaces:**
- Verification script exits non-zero on any failed assertion and restores all fixture rows it mutates.
- Real-provider verification is enabled only when the required WeChat and Aliyun environment variables are present; fake-provider integration remains deterministic in local tests.

- [ ] **Step 1: Write failing end-to-end assertions** for unbound WeChat recognition, denied phone authorization, new-user phone login, binding an existing phone user, SMS expiry/replay, password fallback, refresh rotation, revoked logout, disabled user rejection, and one shared user id across methods.
- [ ] **Step 2: Run the new verification script** against the local API/test database and confirm every missing path fails before the preceding tasks are complete.
- [ ] **Step 3: Implement fixture setup and cleanup** with unique numeric phone/device identifiers, no production-user mutation, and no secret/token/code logging.
- [ ] **Step 4: Run focused API tests and scripts**, then `pnpm type-check`, `pnpm build:api`, `pnpm --filter @next-meal/client check`, and the generated mp-weixin import inspection.
- [ ] **Step 5: Start the API and client dev processes**, verify the API listener and auth responses independently, then import the generated client into WeChat DevTools.
- [ ] **Step 6: Perform manual WeChat/real-device acceptance** for success, denied authorization, SMS fallback, password fallback, refresh without modal, refresh expiry with modal, logout and re-login; record any unavailable credentials or tool-only gaps explicitly.
- [ ] **Step 7: Update `docs/plans/minor_change_log.md`** with dated file scope, commands actually run, API results, build results, and separate HBuilderX/DevTools/real-device status.
- [ ] **Step 8: Run `git diff --check` and the scope self-check**: every touched file must map to a task, no unrelated staged Logo asset change may be reverted, and no commit is created unless the user separately requests one.

## Acceptance Matrix

| Area | Evidence required |
| --- | --- |
| Account merge | Integration test and API script prove WeChat, SMS, and password resolve to one phone user. |
| WeChat | Injected provider tests plus DevTools/real-device component authorization prove bound, unbound, success, denial, expired session, and risk paths. |
| SMS | Provider boundary tests and API script prove cooldown, expiry, one-time consumption, provider failure, and no plaintext persistence. |
| Password | Tests prove correct fallback after SMS exhaustion, wrong-password lock, set/change, and disabled-user rejection. |
| Session | Tests prove access expiry, refresh rotation, concurrent refresh single-flight, revoked session, 401 replay once, and failed refresh cleanup. |
| Logout | API and client tests prove server revocation and clearing of token, user, notification badge, pending action, and persisted state. |
| LoginModal | Modal tests and rendered client build prove all modes, agreement gating, callback once, errors, cooldown, and no duplicate modal. |
| UI | Rendered light/dark screens prove supplied Logo selection, pure-color background, slogan, controls, random two-line copy stability, safe-area layout, and no overlap. |
| Delivery | `pnpm type-check`, API build, client check/build, `git diff --check`, API script output, and separate DevTools/real-device status are recorded. |

## Review Checkpoints

1. After Task 2: review the migration SQL and identity ownership before applying it to a shared environment.
2. After Task 4: review external provider configuration and risk limits before enabling real SMS/WeChat calls.
3. After Task 6: review the functional LoginModal state machine before visual restyling.
4. After Task 8: review the complete diff and verification evidence; do not commit automatically.
