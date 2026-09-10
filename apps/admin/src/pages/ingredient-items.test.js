import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("./IngredientItemsPage.vue", import.meta.url), "utf8");

test("nutrition loading guards against stale ingredient responses", () => {
  assert.match(page, /let nutritionRequest = 0/);
  assert.match(page, /requestId !== nutritionRequest/);
  assert.match(page, /nutritionDetail\.value = null/);
  assert.match(page, /:disabled="!nutritionDetail/);
});
