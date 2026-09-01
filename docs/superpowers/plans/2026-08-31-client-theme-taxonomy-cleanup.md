# Client Theme Taxonomy Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `minimal-white` as an independent skin, remove `bold-contrast`, and make the theme settings page expose only real theme skins plus the four true `default` palettes.

**Architecture:** Update the theme registry first so the source of truth drops `bold-contrast` and stops treating `minimal-white` as a `default` palette choice. Then align the theme settings page, the asset/style entrypoints, and the focused tests to the same taxonomy.

**Tech Stack:** Vue 3, uni-app, TypeScript, Sass, Jest automator tests, tsx static tests

**Spec:** `docs/superpowers/specs/2026-08-31-client-theme-taxonomy-design.md`

## Global Constraints

- Keep the change inside the client theme system and the theme settings page.
- Do not change unrelated theme visuals or persistence rules.
- `minimal-white` must remain a standalone selectable theme skin.
- `bold-contrast` must disappear from registry, UI, assets, and tests.
- `default` palettes must be only `default`, `warm`, `olive`, and `cool`.
- Update `docs/plans/minor_change_log.md` for the completed change.

---

### Task 1: Lock the New Taxonomy with Failing Tests

**Files:**
- Modify: `apps/client/src/themes/presets.test.ts`
- Modify: `apps/client/src/pages_me/theme/index.test.js`
- Test: `apps/client/src/themes/presets.test.ts`
- Test: `apps/client/src/pages_me/theme/index.test.js`

**Interfaces:**
- Consumes: `THEME_SKIN_PRESETS`, `THEME_PICKER_SKINS`, theme page automator methods
- Produces: test expectations for the approved theme list and `default` palette list

- [ ] **Step 1: Write the failing preset test updates**

```ts
assert.deepEqual(THEME_PICKER_SKINS, [
  "default",
  "fresh-ingredient",
  "minimal-white",
  "apple-glass",
  "handdrawn-food"
]);
assert.equal(
  THEME_SKIN_PRESETS.some((preset) => preset.value === "bold-contrast"),
  false
);
```

- [ ] **Step 2: Run the preset test to verify it fails**

Run: `pnpm --filter @next-meal/client exec tsx src/themes/presets.test.ts`
Expected: FAIL because `bold-contrast` still exists in the preset registry

- [ ] **Step 3: Write the failing theme page test updates**

```js
expect(state.themeOptions).toEqual([
  "default",
  "fresh-ingredient",
  "minimal-white",
  "handdrawn-food",
  "apple-glass"
]);
expect(state.schemeOptionLabels).toEqual(["默认", "暖黄", "橄榄", "冷蓝"]);
```

- [ ] **Step 4: Run the theme page test to verify it fails**

Run: `/Applications/HBuilderX.app/Contents/MacOS/cli uniapp.test mp-weixin --project /Users/yangpenghui/personal/cook/apps/client/src --testcaseFile pages_me/theme/index.test.js`
Expected: FAIL because the page still exposes `default-theme` grouping plus `简白` and `反差` inside the palette card

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/themes/presets.test.ts apps/client/src/pages_me/theme/index.test.js
git commit -m "test: lock client theme taxonomy"
```

### Task 2: Remove `bold-contrast` from Theme Registry and Style Entry

**Files:**
- Modify: `apps/client/src/themes/presets.ts`
- Modify: `apps/client/src/themes/skins.scss`
- Delete: `apps/client/src/themes/bold-contrast/skins.scss`
- Modify: `apps/client/src/themes/skin-registry.test.ts`
- Test: `apps/client/src/themes/skin-registry.test.ts`

**Interfaces:**
- Consumes: theme preset registry and global Sass theme entry file
- Produces: runtime theme registry without `bold-contrast`

- [ ] **Step 1: Remove `bold-contrast` from the preset registry**

```ts
export const THEME_PICKER_SKINS = [
  "default",
  "fresh-ingredient",
  "minimal-white",
  "apple-glass",
  "handdrawn-food"
] as const;
```

- [ ] **Step 2: Remove the global Sass `@use` for `bold-contrast`**

```scss
@use "./apple-glass/skins.scss" as appleGlassSkin;
@use "./default/skins.scss" as defaultSkin;
@use "./fresh-ingredient/skins.scss" as freshIngredientSkin;
@use "./handdrawn-food/skins.scss" as handdrawnFoodSkin;
@use "./minimal-white/skins.scss" as minimalWhiteSkin;
```

- [ ] **Step 3: Delete the unused `bold-contrast` skin file**

```text
apps/client/src/themes/bold-contrast/skins.scss
```

- [ ] **Step 4: Run the registry test**

Run: `pnpm --filter @next-meal/client exec tsx src/themes/skin-registry.test.ts`
Expected: PASS with no `bold-contrast` lookup left in the registry

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/themes/presets.ts apps/client/src/themes/skins.scss apps/client/src/themes/skin-registry.test.ts
git commit -m "refactor: remove bold contrast theme"
```

### Task 3: Make the Theme Page Select Real Skins Directly

**Files:**
- Modify: `apps/client/src/pages_me/theme/index.vue`
- Modify: `apps/client/src/pages_me/theme/index.test.js`
- Test: `apps/client/src/pages_me/theme/index.test.js`

**Interfaces:**
- Consumes: `THEME_SKIN_LABELS`, `supportsDarkForSkin`, `ThemeSkin`, persisted theme settings
- Produces: direct theme options for `default`, `fresh-ingredient`, `minimal-white`, `handdrawn-food`, and `apple-glass`

- [ ] **Step 1: Replace the fake `default-theme` family with real theme IDs**

```ts
const THEME_OPTIONS = [
  { label: THEME_SKIN_LABELS.default, value: "default" },
  { label: THEME_SKIN_LABELS["fresh-ingredient"], value: "fresh-ingredient" },
  { label: THEME_SKIN_LABELS["minimal-white"], value: "minimal-white" },
  { label: THEME_SKIN_LABELS["handdrawn-food"], value: "handdrawn-food" },
  { label: THEME_SKIN_LABELS["apple-glass"], value: "apple-glass" }
] as const;
```

- [ ] **Step 2: Limit the palette card to the four true `default` palettes**

```ts
const DEFAULT_THEME_SCHEME_OPTIONS = [
  { label: THEME_PALETTE_LABELS.default, value: "default" },
  { label: THEME_PALETTE_LABELS.warm, value: "warm" },
  { label: THEME_PALETTE_LABELS.olive, value: "olive" },
  { label: THEME_PALETTE_LABELS.cool, value: "cool" }
] as const;
```

- [ ] **Step 3: Update family and mode branching to key off `effectiveSkin === "default"`**

```ts
const showSchemeCard = computed(() => effectiveSkin.value === "default");
const showModeCard = computed(() => effectiveSkin.value === "default" && supportsDarkForSkin(effectiveSkin.value));
```

- [ ] **Step 4: Run the theme page test**

Run: `/Applications/HBuilderX.app/Contents/MacOS/cli uniapp.test mp-weixin --project /Users/yangpenghui/personal/cook/apps/client/src --testcaseFile pages_me/theme/index.test.js`
Expected: PASS with direct `minimal-white` selection and no `反差`

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/pages_me/theme/index.vue apps/client/src/pages_me/theme/index.test.js
git commit -m "refactor: align theme page with skin taxonomy"
```

### Task 4: Remove Leftover Static Assertions and Record the Change

**Files:**
- Delete: `apps/client/src/themes/skin-shadow.test.ts`
- Modify: `docs/plans/minor_change_log.md`
- Test: `apps/client/src/pages/home/theme.test.js`
- Test: `pnpm --filter @next-meal/client type-check`

**Interfaces:**
- Consumes: home page theme runtime automator and central change log
- Produces: cleaned static checks and documented delivery note

- [ ] **Step 1: Remove the orphaned `bold-contrast` static shadow test**

```text
apps/client/src/themes/skin-shadow.test.ts
```

- [ ] **Step 2: Add the minor change log entry**

```md
- 2026-08-31 主题分类收口：`minimal-white` 保持独立主题，`bold-contrast` 从主题注册、主题设置页、样式入口和测试中移除，默认主题色系只保留 `default / warm / olive / cool`。验证：...
```

- [ ] **Step 3: Run the focused runtime and type checks**

Run: `pnpm --filter @next-meal/client exec jest src/pages/home/theme.test.js --runInBand`
Expected: PASS

Run: `pnpm --filter @next-meal/client type-check`
Expected: PASS

- [ ] **Step 4: Run diff hygiene**

Run: `git diff --check -- apps/client/src/themes apps/client/src/pages_me/theme/index.vue apps/client/src/pages_me/theme/index.test.js apps/client/src/pages/home/theme.test.js docs/plans/minor_change_log.md`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/themes apps/client/src/pages_me/theme/index.vue apps/client/src/pages_me/theme/index.test.js apps/client/src/pages/home/theme.test.js docs/plans/minor_change_log.md
git commit -m "refactor: simplify client theme taxonomy"
```
