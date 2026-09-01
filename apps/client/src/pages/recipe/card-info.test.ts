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

const recipePageSource = readFile("./index.vue");

expectIncludes(recipePageSource, "durationText: string;");
expectIncludes(recipePageSource, "estimatedCalories: number | null;");
expectIncludes(recipePageSource, "caloriesText: string;");
expectIncludes(recipePageSource, 'v-if="item.durationText" class="recipe-card__meta"');
expectIncludes(recipePageSource, 'v-if="item.caloriesText" class="recipe-card__calories"');
expectIncludes(recipePageSource, "{{ item.caloriesText }}");
expectExcludes(recipePageSource, "item.tag");

expectSelectorIncludes(recipePageSource, ".recipe-card__calories", [
  "flex: 0 0 auto;",
  "max-width: 40%;",
  "color: var(--color-text-secondary);",
  "white-space: nowrap;"
]);

console.log("recipe card info tests passed");
