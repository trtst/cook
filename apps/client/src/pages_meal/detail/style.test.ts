import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const fontSource = readFileSync(resolve(__dirname, "../../assets/fonts/font.scss"), "utf8");
const footerSource = readFileSync(resolve(__dirname, "../../components/Meal/MealFooterActions.vue"), "utf8");

function expectIncludes(snippet: string) {
  assert.ok(source.includes(snippet), `Expected meal detail page to include: ${snippet}`);
}

function expectExcludes(snippet: string) {
  assert.ok(!source.includes(snippet), `Expected meal detail page to exclude: ${snippet}`);
}

function expectSelectorIncludes(selector: string, snippets: string[], content = source) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(match[1].includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

expectIncludes("<MealFooterActions");
expectIncludes(":primary-action=\"footerPrimaryAction\"");
expectIncludes('import ImageEmpty from "@/components/ImageEmpty.vue";');
expectIncludes('<ImageEmpty v-else class="meal-hero__cover-empty" copy="封面图" ratio="fill" />');
expectIncludes('import RecipeListRow from "@/components/Recipe/RecipeListRow.vue";');
expectIncludes('<RecipeListRow');
expectExcludes('size="small"');
expectIncludes('@scrolltolower="loadMoreRecipeSheet"');
expectIncludes('const RECIPE_SHEET_PAGE_SIZE = 20;');
expectIncludes('const recipeSheetHasNext = ref(false);');
expectIncludes('const recipeSheetLoadingMore = ref(false);');
expectIncludes('function loadMoreRecipeSheet()');
expectIncludes('v-if="canInviteParticipants && inviteShareReady"');
expectIncludes('const canQuickShareInvite = computed(() => Boolean(eventDetail.value && !eventClosed.value && inviteShareReady.value));');
expectIncludes("'sheet-actions__button--disabled': recipeConfirmDisabled");
expectIncludes("'recipe-sheet__status-text--primary': isRecipePendingAdd(item) || isRecipeSelected(item)");
expectSelectorIncludes(".meal-footer__button--disabled", [
  "opacity: 0.46;",
  "box-shadow: var(--button-primary-shadow);"
], footerSource);
expectSelectorIncludes(".sheet-actions__button--disabled", [
  "opacity: 0.46;",
  "box-shadow: var(--button-primary-shadow);"
]);
expectSelectorIncludes(".meal-menu-empty__action", [
  "background: var(--button-primary-bg);",
  "color: var(--button-primary-text);"
]);
expectSelectorIncludes(".meal-hero--plan", [
  "background: var(--color-surface-primary-panel);"
]);
expectSelectorIncludes(".meal-hero::before", [
  "background: var(--color-surface-primary-panel-strong);"
]);
expectIncludes('class="cookfont icon-done-circle meal-shopping-preview__prepared-icon"');
assert.ok(fontSource.includes('.icon-done-circle::before {\n    content: "\\e6bc";\n}'));
expectIncludes(".meal-shopping-preview__row {\n  position: relative;");
expectSelectorIncludes(".meal-shopping-preview__state--status-only", [
  "justify-content: flex-end;"
]);
expectSelectorIncludes(".meal-shopping-preview__state", [
  "color: var(--color-text-tertiary);"
]);
expectSelectorIncludes(".meal-shopping-preview__prepared-mark", [
  "position: absolute;",
  "bottom: 6rpx;",
  "left: 24rpx;",
  "opacity: 0.1;",
  "box-sizing: border-box;"
]);
expectSelectorIncludes(".meal-shopping-preview__prepared-icon", [
  "line-height: 1;",
  "font-size: 100rpx;",
  "color: var(--color-text-tertiary);"
]);
expectExcludes("wx-button[disabled]");
expectExcludes("button[disabled]");
expectExcludes("邀请链接暂时不可用");

console.log("meal detail style tests passed");
