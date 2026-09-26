import assert from "node:assert/strict";
import test from "node:test";
import { applyRecipeIngredientCategory, canUseFuzzyAmount } from "./recipe-amount-policy";

test("all ingredient categories allow 适量", () => {
  assert.equal(canUseFuzzyAmount("SEASONING"), true);
  assert.equal(canUseFuzzyAmount("PRODUCE"), true);
  assert.equal(canUseFuzzyAmount(null), true);
});

test("changing an admin recipe row to any category preserves fuzzy amount", () => {
  const row = {
    ingredientId: 10000001,
    amount: { kind: "FUZZY", text: "适量" } as const
  };

  applyRecipeIngredientCategory(row, "PRODUCE", 3005);

  assert.deepEqual(row.amount, { kind: "FUZZY", text: "适量" });
});
