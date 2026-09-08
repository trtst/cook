import assert from "node:assert/strict";
import test from "node:test";
import { canReuseRecipeNutritionSnapshot, recipeNutritionSnapshotWhere } from "./recipe-nutrition";

test("nutrition regeneration is keyed by recipe version, not source version", () => {
  assert.deepEqual(recipeNutritionSnapshotWhere(274), { recipeVersionId: 274 });
});

test("nutrition snapshot is reused only when its source version is current", () => {
  assert.equal(canReuseRecipeNutritionSnapshot("source-v1", "source-v1"), true);
  assert.equal(canReuseRecipeNutritionSnapshot("source-v1", "source-v2"), false);
});
