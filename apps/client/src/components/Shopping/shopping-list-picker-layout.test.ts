import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFile(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

function selectorBody(source: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector to exist: ${selector}`);
  return match[1];
}

const pickerSource = readFile("./ShoppingListPickerSheet.vue");
const sheetShellSource = readFile("../Sheet/SheetShell.vue");
const mealDetailSource = readFile("../../pages_meal/detail/index.vue");
const mealPlanSource = readFile("../../pages_meal/plan/index.vue");
const recipeDetailSource = readFile("../../pages_recipe/detail/index.vue");

assert.match(pickerSource, /pinCreate\?: boolean;/, "picker should expose the pinned-create layout explicitly");
assert.match(pickerSource, /pinCreate: false/, "shared picker should preserve the existing layout by default");
assert.match(
  pickerSource,
  /'shopping-sheet--pinned': pinCreate/,
  "pinned layout should only activate when requested"
);
assert.match(
  pickerSource,
  /:body-scroll="!pinCreate"/,
  "pinned picker should disable the outer sheet-body scroller"
);
assert.match(pickerSource, /shoppingListMetaText\(row\.item\)/, "list cards should show progress and update time");
assert.doesNotMatch(pickerSource, /memberCount\s*}}\s*人/, "list cards should not show low-value member counts");

assert.match(sheetShellSource, /bodyScroll\?: boolean;/, "sheet shell should expose its body scroll boundary");
assert.match(sheetShellSource, /bodyScroll: true/, "sheet bodies should remain scrollable by default");
assert.match(sheetShellSource, /'sheet-shell__body--fixed': !bodyScroll/);

const fixedBody = selectorBody(sheetShellSource, ".sheet-shell__body--fixed");
assert.match(fixedBody, /display: flex;/);
assert.match(fixedBody, /flex-direction: column;/);
assert.match(fixedBody, /overflow: hidden;/);

const pinnedLayout = selectorBody(pickerSource, ".shopping-sheet--pinned");
assert.match(pinnedLayout, /flex: 1 1 auto;/);
assert.match(pinnedLayout, /min-height: 0;/);
assert.match(pinnedLayout, /overflow: hidden;/);

const pinnedCreate = selectorBody(pickerSource, ".shopping-sheet--pinned .shopping-create-section");
assert.match(pinnedCreate, /order: 1;/);
assert.match(pinnedCreate, /flex: 0 0 auto;/);

const pinnedList = selectorBody(pickerSource, ".shopping-sheet--pinned .shopping-list-section");
assert.match(pinnedList, /order: 2;/);
assert.match(pinnedList, /flex: 1 1 auto;/);
assert.match(pinnedList, /min-height: 0;/);
assert.match(pinnedList, /overflow-y: auto;/);

assert.match(
  mealDetailSource,
  /<ShoppingListPickerSheet[\s\S]*?:pin-create="Boolean\(eventDetail\)"[\s\S]*?\/>/,
  "dining-event detail should opt into the pinned-create layout"
);
assert.doesNotMatch(mealPlanSource, /\bpin-create\b/, "meal-plan picker should keep the existing layout");
assert.doesNotMatch(recipeDetailSource, /\bpin-create\b/, "recipe-detail picker should keep the existing layout");

console.log("shopping list picker layout tests passed");
