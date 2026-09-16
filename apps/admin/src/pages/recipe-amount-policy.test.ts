import assert from "node:assert/strict";
import test from "node:test";
import { applyRecipeIngredientCategory, canUseFuzzyAmount } from "./recipe-amount-policy";

test("only SEASONING allows 适量", () => {
  assert.equal(canUseFuzzyAmount("SEASONING"), true);
  assert.equal(canUseFuzzyAmount("PRODUCE"), false);
  assert.equal(canUseFuzzyAmount(null), false);
});

test("changing an admin recipe row to a non-seasoning resets fuzzy amount", () => {
  const row = {
    ingredientId: 10000001,
    amount: { kind: "FUZZY", text: "适量" } as const
  };

  applyRecipeIngredientCategory(row, "PRODUCE", 3005);

  assert.deepEqual(row.amount, { kind: "EXACT", quantity: "", unitId: 3005 });
});
