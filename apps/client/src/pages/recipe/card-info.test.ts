import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFile(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

function expectIncludes(source: string, snippet: string) {
  assert.ok(source.includes(snippet), `Expected file to include: ${snippet}`);
}

function expectExcludes(source: string, snippet: string) {
  assert.ok(!source.includes(snippet), `Expected file to exclude: ${snippet}`);
}

function expectSelectorIncludes(source: string, selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(match[1].includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

function expectSelectorExcludes(source: string, selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(!match[1].includes(snippet), `Expected selector ${selector} to exclude: ${snippet}`);
  }
}

const recipePageSource = readFile("./index.vue");
const recipeManageListSource = readFile("../../pages_recipe/list/index.vue");
const recipeSearchBarSource = readFile("../../components/Recipe/RecipeSearchBar.vue");
const imageEmptySource = readFile("../../components/ImageEmpty.vue");

expectIncludes(recipePageSource, "durationText: string;");
expectIncludes(recipePageSource, "estimatedCalories: number | null;");
expectIncludes(recipePageSource, "caloriesText: string;");
expectIncludes(recipePageSource, 'import ImageEmpty from "@/components/ImageEmpty.vue";');
expectIncludes(recipePageSource, '<ImageEmpty v-else class="recipe-card__cover-fallback" />');
expectIncludes(recipePageSource, 'v-if="item.coverImageUrl"');
expectIncludes(recipePageSource, 'v-if="item.durationText" class="recipe-card__meta"');
expectIncludes(recipePageSource, 'v-if="item.caloriesText" class="recipe-card__calories"');
expectIncludes(recipePageSource, "{{ item.caloriesText }}");
expectExcludes(recipePageSource, 'class="recipe-card__cover-text font-black">封面图');
expectExcludes(recipePageSource, "item.tag");
expectExcludes(recipePageSource, "item.coverTag");
expectExcludes(recipePageSource, "coverTag:");
expectExcludes(recipePageSource, ".recipe-card__cover-tag");

expectIncludes(recipeManageListSource, 'import ImageEmpty from "@/components/ImageEmpty.vue";');
expectIncludes(recipeManageListSource, '<ImageEmpty v-else class="card__cover-fallback" />');
expectExcludes(recipeManageListSource, 'class="card__cover-text font-black">封面');
expectExcludes(recipeManageListSource, 'mode !== "drafts"');

expectIncludes(recipeSearchBarSource, 'class="cookfont icon-search recipe-search__icon"');
expectExcludes(recipeSearchBarSource, 'import searchIcon from "@/assets/recipe-page/search.svg";');
expectExcludes(recipeSearchBarSource, '<image class="recipe-search__icon" :src="searchIcon" mode="aspectFit" />');

expectIncludes(imageEmptySource, "iconClass?: string;");
expectIncludes(imageEmptySource, 'ratio?: "4-3" | "16-9" | "fill";');
expectIncludes(imageEmptySource, 'copy: "暂无图片"');
expectIncludes(imageEmptySource, 'iconClass: "icon-none-image"');
expectIncludes(imageEmptySource, 'ratio: "4-3"');
expectIncludes(imageEmptySource, ':class="[\'cookfont\', iconClass, \'image-empty__icon\']"');
expectIncludes(imageEmptySource, 'class="image-empty__copy font-medium"');
expectIncludes(imageEmptySource, "{{ copy }}");

expectSelectorIncludes(imageEmptySource, ".image-empty", [
  "display: flex;",
  "aspect-ratio: 4 / 3;",
  "align-items: center;",
  "justify-content: center;"
]);

expectSelectorIncludes(imageEmptySource, ".image-empty__body", [
  "display: flex;",
  "flex-direction: column;",
  "align-items: center;"
]);

expectSelectorIncludes(imageEmptySource, ".image-empty__icon", [
  "color: var(--color-icon-tertiary);",
  "font-size: 100rpx;"
]);

expectSelectorIncludes(imageEmptySource, ".image-empty--16-9", [
  "aspect-ratio: 16 / 9;"
]);

expectSelectorIncludes(imageEmptySource, ".image-empty--fill", [
  "height: 100%;",
  "aspect-ratio: auto;"
]);

expectSelectorIncludes(recipePageSource, ".recipe-card__calories", [
  "flex: 0 0 auto;",
  "max-width: 40%;",
  "color: var(--color-text-secondary);",
  "white-space: nowrap;"
]);

console.log("recipe card info tests passed");
