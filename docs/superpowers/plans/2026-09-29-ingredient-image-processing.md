# Ingredient Image Processing Implementation Plan

> **For agentic workers:** Use this plan inline in the current authorized workspace. Do not delegate file ownership. Steps use checkbox syntax for tracking.

**Goal:** Convert system ingredient photos according to confirmed 1:1 size rules, store JPEG objects, and persist the OSS URL that returns a 300×300 derivative.

**Architecture:** A reusable Admin Canvas encoder receives an already selected source rectangle and an explicit output size/quality. The ingredient page validates the strict square/minimum/maximum policy and passes its selected crop to the encoder. The API validates the final JPEG dimensions, stores `{ingredientId}.jpg`, persists `imageUrl`, and returns that persisted field to ingredient consumers; legacy derived URLs are not used.

**Tech Stack:** Vue 3 + TypeScript + browser Canvas; NestJS + TypeScript; Prisma + PostgreSQL; existing AssetStorageService and OSS image processing URL.

**Spec:** `docs/superpowers/specs/2026-09-29-ingredient-export-image-batch-design.md`

## Global Constraints

- Ingredient images must be strictly 1:1.
- Reject an image if either original dimension is below 300 pixels.
- Keep dimensions from 300×300 through 500×500; downscale larger square images to 500×500.
- Encode single-upload objects as JPEG with quality `0.8`; batch-upload objects use quality `1`.
- Persist an OSS URL whose image processing parameter returns a 300×300 result.
- Do not backfill or fall back to URLs derived from `imageUpdatedAt`.
- Do not implement filtering, export, or batch file selection in this stage.
- Do not add or run tests in this stage; run scoped type, Prisma, build, and diff checks only.

---

### Task 1: Add the ingredient image URL as the persisted source

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_ingredient_image_url/migration.sql`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Modify: `apps/api/src/modules/admin/ingredient-image.service.ts`
- Modify: `apps/api/src/modules/app-config/public-assets.controller.ts`
- Modify: `apps/api/src/modules/pantry/pantry.service.ts`
- Modify: `apps/api/src/modules/recipe/recipe.service.ts`
- Modify: `apps/client/src/pages_pantry/apis/ingredient.ts` only if its local response type is stale
- Modify: `docs/api-contract.md`
- Modify: `docs/api-index.md`

**Interfaces:**
- `Ingredient.imageUrl` is nullable and authoritative for display/filtering.
- `AdminIngredientSummary.imageUrl` and public ingredient summaries return the stored value.
- Upload updates `imageUrl` together with the ingredient `version` and current image timestamp.

- [x] Add a nullable Prisma `imageUrl` column without copying old `imageUpdatedAt` values.
- [x] Update single-image upload storage naming/MIME validation to final `{ingredientId}.jpg` JPEG output.
- [x] Append OSS resize parameters `image/resize,m_fixed,w_300,h_300` to the generated public URL and persist that exact URL. Without `ASSET_PUBLIC_BASE_URL`, persist a stable API-relative path rather than the request Host.
- [x] Update ingredient list, pantry responses, recipe ingredient references, and public-image gating to read the stored field; a null URL means no registered image.
- [x] Update clear-image to set `imageUrl` to null and preserve the existing version/idempotency/audit/rollback behavior.
- [x] Update API contract and API index image semantics, including old records remaining null.

### Task 2: Add the configurable Canvas encoder and wire single upload

**Files:**
- Create: `apps/admin/src/utils/image-processing.ts`
- Modify: `apps/admin/src/pages/IngredientItemsPage.vue`
- Modify: `apps/admin/src/apis/ingredient.ts`
- Modify: `docs/ingredient.md`
- Modify: `docs/plans/ingredient-export-image-batch-execution.md`

**Interfaces:**
- `processImageFile(file, options)` receives output width/height, JPEG quality, source crop rectangle, and output filename; it returns a JPEG `File`.
- Ingredient policy validates natural image dimensions before conversion; selected crop output must be square.

- [x] Implement image decode, source rectangle drawing, configured Canvas dimensions, JPEG `toBlob` encoding, and `File` output.
- [x] In the existing crop flow reject non-square source images, reject either dimension below 300, keep 300–500 pixel square sources unchanged, and choose 500×500 for larger sources.
- [x] Export the selected square crop as the configured JPEG with quality `0.8`; set the uploaded filename to `{ingredientId}.jpg`.
- [x] Keep the current single-image crop interaction and pass the final JPEG into the existing upload API.
- [x] Replace the documented 50×50 PNG rule with the confirmed ingredient image policy.

### Task 3: Scoped validation and delivery record

**Files:**
- Modify: `docs/plans/minor_change_log.md`
- Modify: `docs/superpowers/specs/2026-09-29-ingredient-export-image-batch-design.md`

- [x] Run `pnpm --filter @next-meal/api prisma:generate` and API/Admin/Client type checks required by the touched contracts.
- [x] Run API and Admin production builds plus Prisma schema validation.
- [x] Run `git diff --check` and inspect every changed path against the image-processing-only scope.
- [x] No automated tests were added or run; real OSS/CDN and admin browser acceptance remain unverified.
- [x] Record the completed stage and remaining export/batch work in the central minor-change log.
