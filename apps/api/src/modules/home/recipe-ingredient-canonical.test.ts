import assert from "node:assert/strict";
import test from "node:test";
import { canonicalRecipeIngredientIds } from "./recipe-ingredient-canonical";

test("historical merged recipe ingredients match the active target ingredient once", () => {
  const ids = canonicalRecipeIngredientIds(
    [501, 502, 503, 503],
    new Map([[501, 900], [502, 900]])
  );

  assert.deepEqual(ids, [503, 900]);
});
