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

assert.doesNotMatch(pickerSource, /\bpinCreate\b/, "picker layout must not vary by caller");
assert.match(pickerSource, /:body-scroll="false"/, "picker should always keep its controls fixed above the list");
assert.match(pickerSource, /:panel-style="\{ maxHeight: ['\"]62vh['\"] \}"/, "picker should own its compact panel height");
assert.match(
  pickerSource,
  /{{\s*showCreateForm\s*\?\s*"取消"\s*:\s*createTitle\s*}}/,
  "the create action should switch to cancel while the form is open"
);
assert.match(
  pickerSource,
  /v-if="showCreateForm"\s+class="shopping-create"/,
  "the empty-list form should remain hidden until the create action is used"
);
assert.match(
  pickerSource,
  /function toggleCreateForm\(\)\s*\{[\s\S]*?showCreateForm\.value\s*=\s*!showCreateForm\.value;/,
  "the create action should toggle the form"
);
assert.match(
  pickerSource,
  /:class="\{\s*'shopping-create__button--disabled':\s*!canCreate\s*\}"/,
  "an empty create name should render a disabled confirmation button"
);
assert.match(
  pickerSource,
  /:disabled="!canCreate"/,
  "the native confirmation button should not be clickable with an empty name"
);
assert.match(
  pickerSource,
  /const canCreate = computed\(\(\) => !props\.submitting\);/,
  "the server should be allowed to generate a name for an empty create request"
);
assert.match(
  pickerSource,
  /function handleCreate\(\)\s*\{[\s\S]*?if \(!canCreate\.value\) return;[\s\S]*?emit\("create"\);/,
  "the create event should also be guarded in code"
);
assert.match(
  pickerSource,
  /const createPending = ref\(false\);/,
  "the picker should track an in-flight create request independently from submitting"
);
assert.match(
  pickerSource,
  /watch\(\s*\[\(\) => props\.items, \(\) => props\.selectedId\][\s\S]*?createPending\.value = false;[\s\S]*?showCreateForm\.value = false;/,
  "the create form should collapse after the newly created selected list arrives"
);
assert.match(pickerSource, /shoppingListMetaText\(row\.item\)/, "list cards should show progress and update time");
assert.doesNotMatch(pickerSource, /memberCount\s*}}\s*人/, "list cards should not show low-value member counts");

assert.match(sheetShellSource, /bodyScroll\?: boolean;/, "sheet shell should expose its body scroll boundary");
assert.match(sheetShellSource, /bodyScroll: true/, "sheet bodies should remain scrollable by default");
assert.match(sheetShellSource, /max-height: 82vh;/, "shared sheets should retain the default height");
assert.doesNotMatch(sheetShellSource, /max-height: 62vh;/, "shared sheets must not inherit the picker height");
assert.match(sheetShellSource, /'sheet-shell__body--fixed': !bodyScroll/);

const fixedBody = selectorBody(sheetShellSource, ".sheet-shell__body--fixed");
assert.match(fixedBody, /display: flex;/);
assert.match(fixedBody, /flex-direction: column;/);
assert.match(fixedBody, /overflow: hidden;/);

const pickerLayout = selectorBody(pickerSource, ".shopping-sheet");
assert.match(pickerLayout, /flex: 1 1 auto;/);
assert.match(pickerLayout, /min-height: 0;/);
assert.match(pickerLayout, /overflow: hidden;/);

const createSection = selectorBody(pickerSource, ".shopping-create-section");
assert.match(createSection, /flex: 0 0 auto;/);

const listSection = selectorBody(pickerSource, ".shopping-list-section");
assert.match(listSection, /flex: 1 1 auto;/);
assert.match(listSection, /min-height: 0;/);
assert.match(listSection, /overflow-y: auto;/);

assert.match(
  mealDetailSource,
  /<ShoppingListPickerSheet[\s\S]*?\/>/,
  "dining-event detail should use the shared picker"
);
assert.doesNotMatch(mealDetailSource, /\bpin-create\b/, "dining-event detail should not control picker layout");
assert.doesNotMatch(mealPlanSource, /\bpin-create\b/, "meal-plan picker should not control picker layout");
assert.doesNotMatch(recipeDetailSource, /\bpin-create\b/, "recipe-detail picker should not control picker layout");

console.log("shopping list picker layout tests passed");
