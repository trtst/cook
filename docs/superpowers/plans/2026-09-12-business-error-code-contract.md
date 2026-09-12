# 业务错误码与空态合同迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以独立业务数值码表达预期失败，并让首页“没有候选”使用成功空数据合同。

**Architecture:** 后端异常过滤器将 Nest 的预期 HTTP 异常映射为 `10001-10007`，仍返回 HTTP 200 envelope。Client、Admin、Site 分别在本应用请求层定义同一份本地常量，先区分 HTTP transport error，再按业务码处理认证或页面状态。首页最近安排和当前专题分别以 `data: null` 表示正常无候选。

**Tech Stack:** NestJS、TypeScript、Vue 3、uni-app、Element Plus、OpenAPI、Node test。

**Spec:** `docs/superpowers/specs/2026-09-12-business-error-code-contract-design.md`

## Global Constraints

- 业务成功为 `code: 0`；单资源正常缺失是 `data: null`，分页空结果保持 `items: []`。
- 预期业务失败为 HTTP 200 + 非零业务码；路由、网关、网络、协议和未捕获系统错误保留 HTTP 非 2xx。
- `message` 仅供展示；不通过文本判断客户端分支。
- 各应用自行维护请求层及码表；不跨应用导入源码。
- 不新增数据库 schema、迁移、权限中心、旧 DTO fallback 或请求层自动 Toast。
- 保留无关未提交改动；完成时更新 `docs/plans/minor_change_log.md`。

---

### Task 1: 后端映射和回归测试

**Files:**
- Create: `apps/api/src/common/business-code.ts`
- Modify: `apps/api/src/common/api-exception.filter.ts`
- Modify: `apps/api/src/common/api-exception.filter.test.ts`
- Modify: `apps/api/src/common/rate-limit.service.ts`
- Modify: `apps/api/src/modules/auth/auth-risk.service.ts`

**Interfaces:**
- Produces `BusinessCode`: `INVALID_REQUEST=10001`、`UNAUTHENTICATED=10002`、`FORBIDDEN=10003`、`RESOURCE_NOT_FOUND=10004`、`CONFLICT=10005`、`RATE_LIMITED=10006`、`FEATURE_UNAVAILABLE=10007`。
- Produces an exception filter that maps expected Nest HTTP exceptions to those values while route misses and unexpected errors retain HTTP status.

- [ ] **Step 1: Write failing tests.** Add assertions that `BadRequestException` returns code 10001, `UnauthorizedException` 10002, `NotFoundException` 10004, `ConflictException` 10005, and `Cannot GET` stays HTTP 404.

- [ ] **Step 2: Prove the tests fail.**

Run: `pnpm --filter @next-meal/api exec tsx --test src/common/api-exception.filter.test.ts`

Expected: FAIL because the existing filter returns 400/401/404/409/429/503 as business codes.

- [ ] **Step 3: Implement the mapping.** Add:
~~~
export const BusinessCode = {
  INVALID_REQUEST: 10001,
  UNAUTHENTICATED: 10002,
  FORBIDDEN: 10003,
  RESOURCE_NOT_FOUND: 10004,
  CONFLICT: 10005,
  RATE_LIMITED: 10006,
  FEATURE_UNAVAILABLE: 10007
} as const;
~~~
Map only expected exception statuses in the filter. Update the two explicit 429 payloads to `BusinessCode.RATE_LIMITED`.

- [ ] **Step 4: Prove the tests pass.**

Run: `pnpm --filter @next-meal/api exec tsx --test src/common/api-exception.filter.test.ts`

Expected: PASS; route miss stays HTTP 404 and unknown error stays HTTP 500.

### Task 2: 三端请求层和旧码判断

**Files:**
- Modify: `apps/client/src/apis/http.ts`, `apps/client/src/apis/http.test.ts`
- Modify: `apps/admin/src/apis/http.ts`, `apps/admin/src/apis/http.test.js`
- Modify: `apps/site/src/apis/content.ts`, `apps/site/src/apis/content.test.js`
- Modify: `apps/client/src/components/Login/LoginModal.vue`
- Modify: `apps/client/src/pages_me/phone/index.vue`, `apps/client/src/pages_me/password/index.vue`, `apps/client/src/pages_meal/event/index.vue`
- Modify: `apps/admin/src/pages/UsersPage.vue`
- Modify: `apps/client/src/test-utils/meal-assistant-fixture.js`, `apps/client/src/test-utils/medal-fixture.js`, `apps/client/src/pages_pantry/gap/index.test.js`, `apps/client/src/pages_me/recommend/index.test.js`

**Interfaces:**
- Consumes the Task 1 numeric contract.
- Produces an app-local exported `BusinessCode` in each request layer.

- [ ] **Step 1: Write failing source assertions.** Client and Admin request tests must assert `UNAUTHENTICATED: 10002` and that refresh/session clearing uses `BusinessCode.UNAUTHENTICATED`; Site keeps HTTP non-2xx before nonzero-code handling.

- [ ] **Step 2: Prove the tests fail.**

Run: `pnpm --filter @next-meal/client exec tsx src/apis/http.test.ts`

Run: `node apps/admin/src/apis/http.test.js`

Run: `node apps/site/src/apis/content.test.js`

Expected: Client/Admin assertions fail because they still compare code 401.

- [ ] **Step 3: Implement local constants and replace comparisons.** Add the seven nonzero constants plus `SUCCESS: 0` in each request layer. Keep `get/post/put/del` rejecting nonzero codes. Use `UNAUTHENTICATED` for session cleanup, `CONFLICT` for existing idempotency retry checks, and mapped constants for Login/Admin local error copy.

- [ ] **Step 4: Prove all three request tests pass.**

Run the three commands in Step 2.

Expected: PASS; HTTP transport failures remain `HttpError`, and 10002 still clears/replays authentication.

### Task 3: 两个已确认首页空态合同

**Files:**
- Modify: `apps/api/src/common/api-response.ts`
- Modify: `apps/api/src/modules/home/home.controller.ts`
- Modify: `apps/api/src/modules/home/home-topic.service.ts`, `apps/api/src/modules/home/home-topic.controller.ts`
- Modify: `apps/api/src/contracts/types.ts`, `apps/api/src/contracts/openapi.ts`
- Modify: `apps/client/src/apis/home.ts`, `apps/client/src/pages_home/topic/index.vue`
- Modify: `apps/api/src/modules/home/home-topic-like-removal.service.test.ts`
- Create: `apps/api/src/common/api-response.test.ts`
- Test: `apps/client/src/pages_home/topic/index.test.js`

**Interfaces:**
- Produces `ok(data, message = "ok")`.
- Produces `GET /home/recent-arrangement` no candidate as `200 / 0 / null / "暂无最近安排"`.
- Produces `GET /home-topics/current` no topic as `200 / 0 / null / "暂无本周灵感专题"`; otherwise `data: HomeTopicDetail`.

- [ ] **Step 1: Write failing tests.** Assert `ok(null, "暂无最近安排").message` is that message. Add a no-listed-topic assertion to `home-topic-like-removal.service.test.ts` that `getCurrentTopic()` returns `null`. Update the topic page test to assert loading assigns `topic.value = result`, not `result.topic`.

- [ ] **Step 2: Prove failures.**

Run: the new/updated API helper or topic-service test.

Run: `pnpm --filter @next-meal/client exec tsx src/pages_home/topic/index.test.js`

Expected: FAIL because `ok` only accepts data and current topic returns `{ topic: null }`.

- [ ] **Step 3: Implement the stable shapes.** Extend `ok` with an optional message. Pass the recent-arrangement empty message only when result is null. Change current-topic service and DTO/OpenAPI/client type to `HomeTopicDetail | null`; controller uses `ApiOkNullableModel(HomeTopicDetailModel, ...)`; topic page directly assigns the response. Do not change paginated response shapes or ID/token details.

- [ ] **Step 4: Prove tests pass.**

Run the commands in Step 2.

Expected: PASS; no-topic page uses existing empty visual state.

### Task 4: API verifiers, contract documents, and final acceptance

**Files:**
- Modify: `apps/api/scripts/verify-auth-system-flow.ts`, `verify-dto-flow.ts`, `verify-login-flow.ts`, `verify-admin-user-management-flow.ts`, `verify-admin-readonly-flow.ts`, `verify-admin-operations-flow.ts`, `verify-admin-recipe-flow.ts`, `verify-shopping-share-flow.ts`, `verify-shopping-fridge-flow.ts`, `verify-meal-assistant-flow.ts`, `verify-taste-profile-flow.ts`, `verify-recipe-flow.ts`, `verify-dining-event-flow.ts`, `verify-medal-flow.ts`, `verify-knowledge-article-flow.ts`, `verify-recipe-history-flow.ts`, `verify-random-page-flow.ts`, `verify-home-weekly-topic-flow.ts`
- Modify: `docs/api-contract.md`, `docs/api-database-rules.md`, `docs/plans/minor_change_log.md`

**Interfaces:**
- Consumes Tasks 1-3.
- Produces verification scripts that still assert HTTP 200 for expected business failure, but assert `10001-10007` rather than HTTP-status numbers.

- [ ] **Step 1: Replace every verifier comparison of business 400/401/403/404/409/429/503.** Imports use `BusinessCode` where module execution permits it; otherwise use the documented numeric value. Share expiration, public content hiding, and unknowable resources assert 10004; token expiration asserts 10002.

- [ ] **Step 2: Update contract docs.** Replace the error table in `docs/api-contract.md` and the hidden-resource rule in `docs/api-database-rules.md`. Preserve historical plan/log text; append only the new central change-log record.

- [ ] **Step 3: Run focused then broad validation.**

Run: `pnpm --filter @next-meal/api verify:auth-system-flow`

Run: `pnpm --filter @next-meal/api verify:dto-flow`

Run: `pnpm --filter @next-meal/api type-check`

Run: `pnpm --filter @next-meal/client type-check`

Run: `pnpm --filter @next-meal/admin type-check`

Run: `pnpm --filter @next-meal/site type-check`

Run: `git diff --check`

Expected: all available checks PASS. Record a concrete environment blocker rather than weakening an unavailable integration verifier.

- [ ] **Step 4: Real response acceptance.** With a running API, verify: a protected endpoint without token is HTTP 200 + 10002; absent resource is HTTP 200 + 10004; absent route is HTTP 404; both confirmed homepage no-candidate paths are HTTP 200 + 0 + null with displayable messages. Record exact evidence and any unrun device/browser gates in `minor_change_log.md`.

- [ ] **Step 5: Commit only after user authorizes a commit.** Inspect `git status --short`, preserve unrelated work, then create separately reviewable backend, client/admin/site, and documentation commits if requested.
