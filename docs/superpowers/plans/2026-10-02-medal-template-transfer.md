# 勋章模板配置导入导出实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Admin 勋章模板页按勾选导出已上架模板配置，并允许任意环境预览和导入 JSON 包。

**Architecture:** 在现有 Admin 勋章模板 API/Service 中增加独立的模板同步包能力，不扩展通用系统数据包。包以 `code` 作为跨环境键，不包含图片字段；任意环境均可单事务按 `code` 新增或更新，保留目标环境图片和包内缺失的模板。

**Tech Stack:** NestJS、Prisma、class-validator、Vue 3、Element Plus、TypeScript、OpenAPI 3.0。

**Spec:** `docs/superpowers/specs/2026-10-02-medal-template-transfer-design.md`

## Global Constraints

- 只导出用户勾选且服务端确认状态为 `LISTED` 的模板。
- 列表每页保持 20 条；跨页保留选择；本页全选仅作用于当前页；修改关键词、状态或类别时清空选择。
- JSON 包版本为 `cook.medal-templates.v1`；来源和目标环境信息仅供展示，缺失时显示 `UNKNOWN`，不限制同步方向。
- JSON 只包含 `code / awardRule / category / name / description / condition / status / targetCount / sortOrder / isLimited / startAt / endAt`；不包含 ID、版本、图片 URL 或图片文件。
- 匹配同一 `code` 时 `awardRule` 必须一致；导入更新不得修改模板 code、发放规则或任何图片字段。
- 数据包缺失的目标环境记录保留；新增和更新必须处于同一事务，冲突时整批回滚。
- 导入/导出/预览仅限 `SUPER_ADMIN`；导入必须使用数字字符串幂等键并写审计。
- 不新增 Prisma Model 或 migration；实现后更新 `docs/api-contract.md`、`docs/api-index.md`、`docs/plans/medal-execution.md` 和 `docs/plans/minor_change_log.md`。
- 保留当前工作区中与生图工作台有关的已有修改。

---

### Task 1: API 勋章同步包

**Files:**
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/src/modules/auth/admin.controller.ts`
- Modify: `apps/api/src/modules/user/medal.service.ts`
- Modify: `docs/api-contract.md`
- Modify: `docs/api-index.md`

**Interfaces:**
- `AdminMedalTemplateExportDto`: `{ templateIds: number[] }`, 非空、正整数、最多 500 个。
- Package: `{ schemaVersion: "cook.medal-templates.v1", sourceEnvironment: "TEST" | "ONLINE" | "UNKNOWN", exportedAt: string, templates: MedalTemplateTransferItem[] }`; environment is informational only.
- `MedalTemplateTransferItem`: `{ code, awardRule, category, name, description, condition, status: "LISTED", targetCount, sortOrder, isLimited, startAt, endAt }`。
- `AdminMedalTemplateTransferPreview`: `{ schemaVersion, targetEnvironment: "TEST" | "ONLINE" | "UNKNOWN", sourceEnvironment: "TEST" | "ONLINE" | "UNKNOWN", counts: { total, new, existing }, conflicts: string[] }`; environment labels do not restrict operations.
- Export endpoint: `POST /admin/medal-templates/export`, JSON body with selected `templateIds`, returns the package.
- Preview endpoint: `POST /admin/medal-templates/preview`, multipart `file`, returns preview.
- Import endpoint: `POST /admin/medal-templates/import`, multipart `file`, `Idempotency-Key`, returns `{ importedCount, createdCount, updatedCount }`.

- [x] **Step 1: Add DTO, transfer package, preview, and result types.** Reuse current medal enum types; cap selected IDs and package rows at 500 and upload size at 2 MB; reject malformed dates, invalid time ranges, duplicate codes, non-`LISTED` rows, and wrong schema version. Environment labels are informational.
- [x] **Step 2: Add export, preview, and import controller routes.** Place routes before parameterized `medal-templates/:templateId` routes. Apply `AdminAuthGuard` and `SuperAdminGuard`; parse multipart packages with the same bounded-file pattern used by Admin system-data imports.
- [x] **Step 3: Implement export projection.** Read selected IDs, require every row to exist and be `LISTED`, then return only the package fields. Record configured environment as informational metadata; do not reject export based on environment.
- [x] **Step 4: Implement preview and code matching.** Allow preview in any environment and accept packages regardless of source label. Count new/matching codes. Report invalid values and same-code/different-awardRule conflicts without writing.
- [x] **Step 5: Implement atomic import by code.** For new rows create with the provided code and `LISTED` status; derive `iconKey` from `awardRule`, initialize absent image fields to null, and initialize version. For matching rows update only category, display copy, threshold, sort order, limited dates, status, and version; preserve existing `code`, `awardRule`, image fields, and all rows absent from the package. Record one admin audit event and persist the idempotent result in the transaction.
- [x] **Step 6: Update OpenAPI and contract indexes.** Document request/response fields, file and record bounds, environment restrictions, role, idempotency, conflicts, and image exclusion.
- [x] **Step 7: Run API type-check and build.** Confirm DTO decorators, controller signatures, Prisma writes, and OpenAPI model registration compile.

### Task 2: Admin selection, export, and import preview

**Files:**
- Modify: `apps/admin/src/apis/medal.ts`
- Modify: `apps/admin/src/pages/MedalTemplatesPage.vue`

**Interfaces:**
- `medalApi.exportSelected(templateIds: number[])` returns the transfer package.
- `medalApi.previewImport(file: File)` returns the API preview model.
- `medalApi.importPackage(file: File, operationId: OperationId)` returns import counts.

- [x] **Step 1: Add Admin transfer package types and request methods.** Use JSON request for selected-ID export and multipart upload for preview/import; import includes `createOperationId()` as the idempotency key.
- [x] **Step 2: Add cross-page selected ID state.** Track selected IDs separately from visible `items`; merge page checkbox changes without discarding IDs on other pages. Clear all selections when keyword, status, or category filters change. Keep page size at 20.
- [x] **Step 3: Add checkbox behavior.** Add row selection keyed by template ID, disable selection when status is not `LISTED`, and scope header select-all to the current page.
- [x] **Step 4: Add selected export.** Disable export when no eligible templates are selected. Call the API, download a dated JSON file, and report failures through existing Element Plus messages.
- [x] **Step 5: Add package file validation and preview.** Accept `.json`, cap at 2 MB, clear the file input after selection, request server preview, and show source/target, total/new/existing counts, and every conflict.
- [x] **Step 6: Add explicit import confirmation.** Disable confirmation while preview has conflicts. Confirm with the user before writing; on success show created/updated counts, clear preview, and reload the current template page.
- [x] **Step 7: Run Admin type-check and production build.** Confirm Element Plus table selection types, multipart API calls, and download flow compile.

### Task 3: Execution records and final review

**Files:**
- Modify: `docs/plans/medal-execution.md`
- Modify: `docs/plans/minor_change_log.md`

- [x] **Step 1: Update the medal execution sheet.** Record transfer scope, API paths, environment direction, and remaining runtime acceptance.
- [x] **Step 2: Append a dated minor-change entry.** List only files changed for the feature and exact validations performed.
- [x] **Step 3: Run scoped non-test verification.** API/Admin type-check and builds, API OpenAPI verification, `git diff --check`, and the exact feature diff review passed. No test suite was run.
- [x] **Step 4: Perform the scope self-check.** The feature changes only medal-template API/Admin behavior and its contract/execution records; no user medal facts, image URLs/files, other system-data collections, or unrelated worktree files were included in the feature commits. Existing unrelated dirty files remain untouched.

---

## Expected Acceptance

- Only explicitly selected `LISTED` rows appear in the package, including selections retained across pages.
- Package JSON contains no database ID, image bytes, or image URL fields.
- Export and import succeed in any environment; environment labels are informational only.
- A valid package imports into empty production as new `LISTED` templates.
- Reimport updates same-code/same-rule configuration while retaining production image values.
- Same-code/different-rule or malformed input rejects the whole package without partial writes.
- API and Admin scoped type-check/build and OpenAPI verification pass; browser interaction and production import remain separate acceptance steps.

## Delivery status

- API and Admin source plus production builds are ready; the feature and execution records are pushed to `origin/main`.
- The latest environment-neutral change still needs deployment and browser interaction. Template import remains a separate action after deployment; the user chooses templates in Admin and confirms import into the current environment.
