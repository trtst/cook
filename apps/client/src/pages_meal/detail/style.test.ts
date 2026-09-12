import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

function expectIncludes(snippet: string) {
  assert.ok(source.includes(snippet), `Expected meal detail page to include: ${snippet}`);
}

function expectExcludes(snippet: string) {
  assert.ok(!source.includes(snippet), `Expected meal detail page to exclude: ${snippet}`);
}

function expectSelectorIncludes(selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(match[1].includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

expectIncludes("'meal-footer__button--disabled': footerPrimaryAction.disabled || submitting");
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
]);
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
expectExcludes("wx-button[disabled]");
expectExcludes("button[disabled]");
expectExcludes(":disabled=");
expectExcludes("邀请链接暂时不可用");

console.log("meal detail style tests passed");
