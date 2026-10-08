# 厨房知识文章未读标识 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 登录用户在文章发布后的 7×24 小时内看到个人未读提示，读过或窗口过期后隐藏提示。

**Architecture:** API 为用户与文章保存唯一已读事实；文章列表在当前分页内返回 `isUnread`，新增栏目摘要接口用固定数量的存在性查询返回 `hasUnread`。详情页复用现有幂等阅读写入，在同一事务内累计阅读数并记录窗口内已读状态。客户端只在页面显示或返回时刷新，不轮询。

**Tech Stack:** NestJS、Prisma、PostgreSQL、OpenAPI、uni-app、Vue 3、TypeScript、WeChat Mini Program。

**Spec:** [docs/superpowers/specs/2026-10-05-knowledge-article-unread-design.md](../specs/2026-10-05-knowledge-article-unread-design.md)

## Global Constraints

- 文章新标识只针对发布时间在服务端当前时刻往前 7×24 小时内的文章。
- 打开文章详情后记录当前登录用户已读；栏目圆点在栏目至少有一篇窗口内未读文章时显示。
- 最近 7 天内发布的上线前存量文章也参与判断；更早文章默认已读。
- 不添加轮询、定时任务、清理 Worker、缓存或通知消息。
- 保持未登录文章列表/详情公开读取；匿名列表的 `isUnread` 固定为 `false`。
- 保持 `apps/client`、`apps/api`、`apps/admin` 各自拥有本地 API 类型与实现，不跨应用导入源代码。
- 修改 API、Prisma、OpenAPI 与 migration 时遵守 `docs/api-database-rules.md`；使用前向 migration。
- 不修改 Admin 页面，不扩大到官方消息或其他栏目。

---

### Task 1: 增加用户文章已读事实与窗口查询接口

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261005140000_site_content_article_reads/migration.sql`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/src/modules/admin/admin-site-content.controller.ts`
- Modify: `apps/api/src/modules/admin/admin-site-content.service.ts`
- Modify: `docs/api-contract.md`

**Interfaces:**
- `SiteContentArticleListItem` extends `SiteContentArticleSummary` with `isUnread: boolean`; anonymous summaries always return `false`.
- `GET /site-contents/articles/unread-summary` requires `UserBearerAuth` and returns `channels: Array<{ channelCode: "KITCHEN" | "COOK" | "FOOD"; hasUnread: boolean }>`.
- `recordPublicArticleView(userId, articleId, operationId)` retains the current response and idempotency key while recording a unique user/article read fact when `publishedAt >= requestNow - 7 days`.

- [x] Add `SiteContentArticleRead` with `id`, `userId`, `contentId`, and `readAt`; add a unique constraint on `(userId, contentId)` and cascading user/content foreign keys. Add relation arrays to `User` and `SiteContent`.
- [x] Create the forward SQL migration for the read table and its unique index. Do not apply it to a shared or production database.
- [x] Extend the existing public list mapping: collect IDs only for the current page's articles in the 7-day window; fetch the current user's matching read rows once; set `isUnread` per item. For anonymous callers and out-of-window items, set `false` without querying read rows.
- [x] Add the authenticated summary method. Resolve the three existing channel IDs, use one `requestNow` value, and run one `findFirst` existence query per channel filtered to published articles inside the window with no read relation for the current user. Return all three channel codes, including `hasUnread: false` entries.
- [x] Register `GET unread-summary` before `GET :articleId` in `SiteContentArticleController` and document its response model in OpenAPI.
- [x] In `recordPublicArticleView`, retain the existing `Idempotency-Key` behavior and transaction. Select the published article's `publishedAt`, increment `viewCount`, and `createMany(..., skipDuplicates: true)` the read fact only when it is inside the window.
- [x] Update `docs/api-contract.md` with the list-only `isUnread`, the authenticated summary endpoint, and the view endpoint's read-state side effect.
- [x] Generate Prisma Client, run API/Client type-checks, OpenAPI verification, Prisma validation, and the WeChat production build.

### Task 2: Render and refresh article unread indicators in the client

**Files:**
- Modify: `apps/client/src/pages_me/apis/knowledge.ts`
- Modify: `apps/client/src/pages_me/knowledge-list/index.vue`
- Modify: `apps/client/src/pages/me/index.vue`
- Create: `apps/client/src/apis/knowledge-unread.ts`

**Interfaces:**
- Client `KnowledgeArticleListItem.isUnread: boolean` mirrors the API list summary.
- `knowledgeUnreadApi.getSummary()` returns one boolean state for each of `KITCHEN`, `COOK`, and `FOOD`.
- `PageEntry.showBadgeDot` drives the existing “我的” service-entry dot and the knowledge-entry dot without introducing cross-page store state.

- [x] Add the client summary type and `knowledgeUnreadApi.getSummary()` through the existing request layer. Use the authenticated `get` helper; do not add raw platform requests or local storage.
- [x] Add the three-channel `hasUnread` state to `pages/me/index.vue`. On `onShow`, refresh it for logged-in users after the existing session restoration; clear it for guests and on account change/logout.
- [x] Derive each `knowledgeEntries` row's `showBadgeDot` from its matching channel summary and render a small red dot beside that row's title. Keep the current entry title, icon, and route unchanged.
- [x] Add the dedicated `icon-new` cookfont glyph at U+E6A6 and render it only when `item.isUnread` is true. Do not add the marker to article detail or other lists.
- [x] Reload the current knowledge list when returning from detail so the newly recorded read state removes `NEW`. Guard the initial `onLoad`/`onShow` pair so it does not issue duplicate list requests.
- [x] Run `pnpm --filter @next-meal/client type-check` and `pnpm --filter @next-meal/client build:mp-weixin`.

### Task 3: Record the implementation and audit the delivery scope

**Files:**
- Modify: `docs/plans/site-content-knowledge-article-execution.md`
- Modify: `docs/plans/minor_change_log.md`

- [x] Update the existing feature execution sheet with the confirmed 7-day unread rules, API additions, verification evidence, and remaining live-database / WeChat acceptance gates.
- [x] Append one dated entry to `minor_change_log.md` listing only files actually changed, successful validations, migration application status, and unverified WeChat behavior. Preserve unrelated pre-existing edits in that file.
- [x] Run `git diff --check` on the feature files and inspect the final staged and unstaged diffs. Do not include the pre-existing `apps/admin/src/main.ts` change or unrelated log edits in the feature commit.
- [x] Report that the migration was generated and validated but not applied; report that real WeChat UI acceptance was not performed.

## Completion Review

- Confirm the list query only checks read facts for the current page and the rolling 7-day window.
- Confirm the channel summary makes a fixed three existence queries and returns all three channels.
- Confirm the view counter and read fact commit atomically and duplicate view operations cannot create duplicate read facts.
- Confirm detail response fields and article publication/admin flows are unchanged.
- Confirm client refresh uses `onShow` and no timer, poll, store persistence, or cleanup task was introduced.
