import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

function expectIncludes(snippet: string) {
  assert.ok(source.includes(snippet), `Expected ingredient-units page to include: ${snippet}`);
}

function expectSelectorIncludes(selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(match[1].includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

expectIncludes('import ImageEmpty from "@/components/ImageEmpty.vue";');
expectIncludes('<ImageEmpty v-else class="ingredient-card__fallback" copy="封面图" ratio="fill" />');
expectSelectorIncludes(".ingredient-card__unit", [
  "background: var(--color-surface-raised);",
  "color: var(--color-text);"
]);

console.log("ingredient units style tests passed");
