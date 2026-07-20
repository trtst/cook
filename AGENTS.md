# Next Meal Agent Guide

This repository is the **Next Meal** workspace.

Read `docs/AGENT.md` first. It is the current short AI coding guide for this
project. Use this file as the Codex entrypoint for orchestration rules and
project-scoped agents.

## Project Context

- Product: family meal planning mini program.
- Client: `apps/client`, uni-app + Vue 3 + TypeScript + Pinia, WeChat mini program.
- API: `apps/api`, NestJS + TypeScript.
- Admin: `apps/admin`, Vue 3 + Element Plus.
- Shared contracts and reusable types belong in `packages/`.
- Product, schema, and SQL source material lives under `docs/cook/`.

Do not let one app import source code from another app. Shared domain types,
API response types, errors, and platform interfaces must go through
`packages/domain`, `packages/api-client`, or `packages/platform`.

## Main Agent Workflow

The user communicates with the main agent by default. The user should not need
to manually choose subagents for normal work.

Default flow:

1. Understand the requirement, scope, boundaries, and acceptance criteria.
2. If the requirement affects V1 scope, module state, API contracts, recipe
   version semantics, permission rules, database constraints, payment, points,
   membership, public UGC, or compliance gates, stop and confirm first.
3. Before code changes, discuss the plan with the user when the task is not a
   small local edit with an obvious target.
4. After the plan is confirmed, the main agent decides whether subagents are
   useful and which ones to use.
5. Subagents default to read-only analysis unless the main agent explicitly
   assigns implementation.
6. Only one implementation owner may edit the same file or module.
7. The main agent maintains a task ledger when subagents are used: task,
   owner, status, output, conflicts, blockers, and next action.
8. The main agent integrates results, checks for scope drift, runs the smallest
   relevant validation, and reports the final status.

The default topology is hierarchical: main agent -> subagents -> main agent.
Do not let subagents negotiate with each other or change scope independently.

## Subagent Dispatch Rules

When assigning a subagent, the main agent must provide a structured task brief:

1. Background: user-confirmed facts and decisions.
2. Goal: the exact outcome expected from the subagent.
3. Scope: files, modules, docs, or commands the subagent may inspect or change.
4. Non-goals: explicit things the subagent must not touch.
5. Confirmed facts: known fields, endpoints, routes, UI rules, or design rules.
6. Unknowns: questions the subagent should verify from code, docs, logs, or UI.
7. Stop conditions: contract mismatch, missing evidence, scope conflict, or
   required user decision.
8. Deliverable: summary, evidence, patch, validation result, or risk list.

After a subagent returns, the main agent must verify:

1. The result answers the assigned task.
2. No scope boundary was crossed.
3. Claims are backed by code, docs, request/response evidence, screenshot, or
   command output.
4. No guessed contract or fallback chain was introduced.
5. Validation is appropriate for the touched surface.
6. Contradictions between subagent outputs are resolved explicitly before
   implementation continues.

The main agent must handle these return states:

- All expected subagent results are present: synthesize and continue.
- Partial results are present: continue only for independent, non-blocked work;
  otherwise ask the missing branch again or report the blocker.
- Results contradict each other: stop, cite the conflicting evidence, and
  resolve through code/docs/logs or user confirmation.
- No useful result is returned: retry with a narrower brief or stop with the
  concrete missing information.

For implementation and QA loops, use at most three passes for the same issue.
After three failed passes, stop and report the blocker instead of continuing to
rewrite around it.

## Scope Self-Check

Before finalizing a code change, the main agent or implementation subagent must
walk the diff and answer:

1. Task as confirmed: what exact user-confirmed requirement does this satisfy?
2. Files touched: why was each file required?
3. Lines not added: what tempting follow-ups were intentionally left out?
4. Abstractions rejected: what was kept local because reuse is not proven?
5. Could the diff be smaller without breaking the confirmed requirement?

Follow-ups may be listed in the final response, but must not be smuggled into
the patch.

## Available Project Agents

- `cook-product`: requirement boundary, V1 scope, user flow, acceptance criteria.
- `cook-codebase-reader`: read-only codebase orientation and real path tracing.
- `cook-ui-designer`: UI/UX review, design consistency, screenshots, Figma-aligned feedback.
- `cook-frontend`: mini program client pages, components, state, request layer.
- `cook-backend`: API, service logic, DTOs, permissions, database-facing behavior.
- `cook-admin`: admin app pages, Element Plus UI, admin API integration.
- `cook-reviewer`: release risk review, regressions, missing tests, contract drift.

Use parallel subagents mainly for read-heavy work: exploration, contract
checking, UI review, test review, and risk review. Be conservative with
parallel code edits.

## Documentation Map

- `docs/AGENT.md`: short AI execution guide. Read first.
- `docs/project.md`: full developer overview.
- `docs/technical.md`: technical rules, naming, style, validation.
- `docs/dining-group.md`: current long-term dining-group lifecycle, original-space migration, exit snapshot, meal guests, and taste rules.
- `docs/configuration.md`: current Free/Plus, storage, image, recipe-variant, recycle-bin, downgrade, and configuration rules.
- `docs/api-contract.md`: shared API contract and error rules.
- `docs/uniapp.md`: mini program engineering rules.
- `docs/uniapp-architecture.md`: `apps/client` scaffold and boundary rules.
- `docs/architecture.md`: frontend/backend layering and dependency direction.
- `docs/decision.md`: scope, non-goals, and delivery language.
- `docs/components.md`: frontend component rules.
- `docs/runbook.md`: execution, debug, validation, and delivery process.
- `docs/templates/feature_execution_template.md`: joint feature execution sheet.
- `docs/plans/dining-group-lifecycle-plan.md`: staged v0.2 contract and implementation plan.

## Commands

- Install dependencies: `pnpm install`
- Type check all packages/apps: `pnpm type-check`
- Check alias: `pnpm check`
- API dev: `pnpm dev:api`
- Client dev: `pnpm dev:client`
- Admin dev: `pnpm dev:admin`
- Worker dev: `pnpm dev:worker` (disabled status check only in V1)
- API build: `pnpm build:api`
- Client build: `pnpm build:client`
- Admin build: `pnpm build:admin`
- Worker build: `pnpm build:worker`

Run the smallest relevant command for the change. Use full `pnpm type-check`
when shared contracts, cross-app types, or broad TypeScript behavior changed.

## Hard Rules

1. Do not guess API fields, route params, permission rules, recipe version
   semantics, or database constraints.
2. Do not use defensive multi-field fallback chains to hide an unknown contract.
3. Do not expand V1 scope without user confirmation.
4. Do not introduce generic manager/adapter/center abstractions without real
   boundary pressure.
5. Keep folder, route, and API path shapes flat unless a documented rule says
   otherwise.
6. Keep changes tied to the named artifact or confirmed plan.
7. Preserve `docs/cook/` as source material; put current project execution
   rules in top-level `docs/*.md` or this file.
8. Do not import React-oriented patterns, examples, or assumptions into this
   Vue 3 + uni-app project.
9. Do not add "while here" cleanup, modernization, or consistency edits unless
   the user explicitly includes them in scope.
10. Treat `docs/cook/` Prisma v0.1, SQL, and older product plans as historical
    source material when they conflict with `docs/dining-group.md` or
    `docs/configuration.md`; create a new schema/SQL version instead of
    overwriting history.
11. Do not implement or advertise OCR, AI, receipt scanning, Pro, multi-family,
    or multi-dining-group switching unless the user explicitly reopens them.
