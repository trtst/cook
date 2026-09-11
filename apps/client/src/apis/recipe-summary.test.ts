import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRecipeKeywords } from "./recipe-keywords";

test("normalizes a missing recipe keyword list before cards read its length", () => {
  assert.deepEqual(normalizeRecipeKeywords(undefined), []);
  assert.deepEqual(normalizeRecipeKeywords(null), []);
  assert.deepEqual(normalizeRecipeKeywords(["家常", "快手"]), ["家常", "快手"]);
});
