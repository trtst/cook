import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

function expectIncludes(snippet: string) {
  assert.ok(source.includes(snippet), `Expected meal plan page to include: ${snippet}`);
}

function expectExcludes(snippet: string) {
  assert.ok(!source.includes(snippet), `Expected meal plan page to exclude: ${snippet}`);
}

function expectSelectorIncludes(selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(match[1].includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

expectSelectorIncludes(".meal-card__event-badge", [
  "background: var(--meal-slot-dinner-soft);",
  "color: var(--meal-slot-dinner);"
]);
expectSelectorIncludes(".meal-card--breakfast .meal-card__event-badge", [
  "background: var(--meal-slot-breakfast-soft);",
  "color: var(--meal-slot-breakfast);"
]);
expectExcludes(":disabled=");
expectIncludes("finishCreatePlanSheet();");
expectIncludes("function finishCreatePlanSheet()");

console.log("meal plan style tests passed");
