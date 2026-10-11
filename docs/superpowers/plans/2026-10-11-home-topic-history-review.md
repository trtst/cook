# Home Topic History Review Implementation Plan

> **For agentic workers:** Execute inline in the current task. Keep the existing staged topic-page changes intact.

**Goal:** Bound the home-topic history API and client list, prevent repeated detail navigation from growing the mini-program page stack, and limit unverified visual changes.

**Architecture:** Keep the current and detail endpoints focused on one topic and at most five history previews. Add a public paginated summary endpoint for the full history list; load its pages on demand. Mark history browsing routes so later history selections replace the current detail page while preserving the list/current page beneath it.

**Tech Stack:** NestJS, Prisma, OpenAPI, TypeScript, Vue 3 uni-app, WeChat mini program.

**Spec:** `docs/api-contract.md` HomeTopic section; `docs/api-database-rules.md` pagination rules.

## Global Constraints

- Keep public topic reads limited to `LISTED` topics.
- List endpoints return summaries and cap `pageSize` at 100.
- Keep current-topic recipe detail loading separate from history summaries.
- Route all platform navigation through `uniPlatform`.
- Preserve existing staged work and avoid image-migration files.

---

### Task 1: Paginated history API

**Files:** `apps/api/src/modules/home/home-topic.service.ts`, `apps/api/src/modules/home/home-topic.controller.ts`, `apps/api/src/contracts/types.ts`, `apps/api/src/contracts/openapi.ts`, `apps/api/src/modules/home/home-topic-history.service.test.ts`, `docs/api-contract.md`, `docs/api-index.md`.

- [ ] Add a failing service test proving page bounds, `issueNo < latestIssueNo`, summary-only projection, and page metadata.
- [ ] Run the focused test and verify it fails because the history-list method is absent.
- [ ] Add `GET /home-topics/history?page=1&pageSize=20`; clamp `pageSize` to 100, return `PageResult<HomeTopicHistoryItem>`, and use filtered relation count without loading recipe rows.
- [ ] Change current/detail reads to fetch only their topic recipe rows and a five-item history preview.
- [ ] Update OpenAPI and docs; align history order with current-issue order (`issueNo desc`).
- [ ] Run the focused service test and OpenAPI verification.

### Task 2: Paginated client list and safe browsing navigation

**Files:** `apps/client/src/apis/home.ts`, `apps/client/src/pages_home/topic-list/index.vue`, `apps/client/src/pages_home/topic-list/index.test.ts`, `apps/client/src/pages_home/topic/index.vue`.

- [ ] Update the static contract to require the paginated API and load-more event; verify it fails against the current client.
- [ ] Add page/hasNext/loading/error state, append pages on lower-edge scroll, and retry a failed next-page request.
- [ ] Pass a history-browsing query flag on first navigation and replace the detail page on subsequent history navigation.
- [ ] Run the exact `gate:ci` TSX invocation on the static test plus Client type check.

### Task 3: Scope visual changes and release review

**Files:** `apps/client/src/pages_home/topic/index.vue`, `docs/plans/minor_change_log.md`.

- [ ] Restore the prior fixed hero backdrop, section spacing, and section surface until the new look has a DevTools screenshot acceptance.
- [ ] Run Client lint, Client build, relevant API tests, `git diff HEAD --check`, and review the complete diff for scope and contract drift.
- [ ] Record automated results and the remaining WeChat DevTools/device acceptance gate.
