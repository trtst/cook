# 饭局与计划微信提醒 Implementation Plan

> Inline execution in the current task. Keep the existing user edits intact.

**Goal:** Let a user subscribe to one reminder for the current meal event or plan and receive it two hours before the applicable time.

**Architecture:** Persist per-user meal reminder state and Outbox work in PostgreSQL. The API authorizes event/plan ownership and builds template data; a dedicated worker claims only meal reminder Outbox rows and sends the configured WeChat subscription template. The meal detail page requests the one-time WeChat authorization, displays server state, and places existing shortcut/cancel actions in its floating management menu.

**Tech Stack:** NestJS, Prisma/PostgreSQL, TypeScript worker, uni-app Vue 3, WeChat Mini Program subscribe message API.

**Spec:** `docs/superpowers/specs/2026-09-28-meal-wechat-reminder-design.md`

## Global Constraints

- Use template ID `LJwjRWjXD6Hod0iJnswKX91ZTyq3bqQM6HtDb1FiiDo`, fields `date2.DATA` and `thing3.DATA`.
- Event reminders use `scheduledAt - 2 hours`; plan reminders use the server meal-slot reference time minus two hours, while displaying the plan date only.
- A reminder is scoped to the current user and one event or plan; event/plan cancellation removes pending reminder work.
- Worker may execute meal reminder Outbox rows only; unrelated Outbox jobs remain disabled.
- Preserve pre-existing staged and unstaged edits; never bulk-stage or reset.
- Do not add or run tests unless the user asks.

## File Map

- `apps/api/prisma/schema.prisma` and a new forward migration: reminder ownership/state and constraints.
- `apps/api/src/modules/meal/*`, contracts, OpenAPI and `docs/api-contract.md`: authenticated state/subscribe APIs plus transactional schedule/cancel synchronization.
- `apps/worker/src/main.ts`: server-side template sender and dedicated Outbox consumer using existing WeChat credentials; it only claims `MEAL_REMINDER_SEND` rows.
- `apps/worker/*`: bounded meal-reminder Outbox polling/claim/retry loop.
- `apps/client/src/platform/uni.ts`, `apps/client/src/apis/meal.ts`, `apps/client/src/pages_meal/apis/meal.ts`, `apps/client/src/pages_meal/detail/index.vue`: platform authorization, request types, fixed reminder action and floating management actions.
- `apps/client/src/pages_me/reminder/index.vue`: clarify detail-page reminder behavior.
- `apps/api/.env.example`, `docs/api-index.md`, `docs/plans/business-development-todo.md`, `docs/plans/minor_change_log.md`, Worker README: deployment config, current feature status, and runtime scope.

## Execution Tasks

1. Confirm exact existing dirty diffs and contracts; inspect all reminder-related cancellation, completion, schedule-change, and linked-plan transitions.
2. Add the minimal reminder model and forward migration, with one active reminder per user/target and a query index for due reminders. Do not alter historical migrations.
3. Implement API response DTOs and authenticated GET/subscribe endpoints. Validate target visibility/ownership, reject unsupported/terminal targets, reject less than two hours remaining, and persist reminder plus due Outbox row transactionally and idempotently.
4. Synchronize reminders transactionally when an event time changes or event/plan is cancelled, completed, deleted, or converted between plan and event. Ensure cancellation drops reminder content/work.
5. Add a WeChat template sender using `WECHAT_APP_ID` and `WECHAT_APP_SECRET`; validate template config and API responses, keep tokens/openids/remark out of logs, and format event versus plan values exactly as specified.
6. Implement a dedicated Worker claim loop for `MEAL_REMINDER` only, with database locking, bounded batches, status transitions, and finite retry/backoff. Leave every unrelated Outbox event untouched.
7. Add client `requestSubscribeMessage` platform adapter and API calls; only persist after `accept`; render current server state and useful failure/too-late copy in detail.
8. Move dynamic shortcut and cancel actions into the page floating manager; retain fixed `微信提醒` alongside the primary action. Update notification settings copy to explain this per-detail entry.
9. Update API contract, business todo, Worker README, and central minor change log. Review diff against the confirmed requirement and run scoped type/build checks plus `git diff --check` (no tests).

## Self-review

- Covers template fields, time rules, per-user state, event rescheduling, cancellation cleanup, worker isolation, page entry/actions, and WeChat failure boundaries from the spec.
- Any generated client/schema artifacts must match Prisma source; never edit generated output by hand.
- No generic notification framework, preference toggle changes, or unrelated worker consumers are included.
