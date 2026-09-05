import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const membershipCodeSource = readFileSync(resolve(__dirname, "./pages_me/membership-code/index.vue"), "utf8");
const recipeEditSource = readFileSync(resolve(__dirname, "./pages_recipe/edit/index.vue"), "utf8");

test("disabled button visuals use explicit disabled classes instead of disabled attribute selectors", () => {
  const sources = [membershipCodeSource, recipeEditSource];

  for (const source of sources) {
    assert.doesNotMatch(source, /\.[\w-]+(?:__[\w-]+)?(?:\.[\w-]+(?:__[\w-]+)?)?\[disabled\]/);
  }

  assert.match(membershipCodeSource, /'redeem-button--disabled': !canSubmit \|\| submitting/);
  assert.match(recipeEditSource, /'sheet-confirm--disabled': ingredientConfirmDisabled/);
  assert.match(recipeEditSource, /'sheet-confirm--disabled': ingredientCreateSubmitting/);
  assert.match(recipeEditSource, /'sheet-creator__button--disabled': categorySubmitting \|\| !categoryDraftName\.trim\(\)/);
});
