import assert from "node:assert/strict";
import test from "node:test";
import { applyIngredientSelection, chooseFuzzyAmount } from "./ingredient-row-policy";

function buildRow() {
  return {
    ingredientId: 10000002 as number | "",
    name: "盐",
    quantity: "",
    unitId: "" as number | "",
    fuzzyText: "适量" as "适量" | "",
    categoryId: 5006 as number | "",
    categoryCode: "SEASONING",
    defaultUnitId: 3001 as number | "",
    source: "SYSTEM" as "SYSTEM" | "PERSONAL" | ""
  };
}

test("non-seasoning rows cannot switch to 适量", () => {
  const row = { ...buildRow(), categoryCode: "PRODUCE", fuzzyText: "" as const, quantity: "2", unitId: 3005 as number | "" };

  assert.equal(chooseFuzzyAmount(row), false);
  assert.deepEqual(
    { quantity: row.quantity, unitId: row.unitId, fuzzyText: row.fuzzyText },
    { quantity: "2", unitId: 3005, fuzzyText: "" }
  );
});

test("replacing an exact ingredient clears its quantity and uses the new default unit", () => {
  const row = { ...buildRow(), fuzzyText: "" as const, quantity: "2", unitId: 3001 as number | "" };

  applyIngredientSelection(row, {
    id: 10000001,
    name: "番茄",
    categoryId: 5001,
    categoryCode: "PRODUCE",
    defaultUnitId: 3005,
    source: "SYSTEM"
  });

  assert.deepEqual(
    { ingredientId: row.ingredientId, quantity: row.quantity, unitId: row.unitId },
    { ingredientId: 10000001, quantity: "", unitId: 3005 }
  );
});

test("reselecting the same ingredient keeps its exact amount", () => {
  const row = { ...buildRow(), fuzzyText: "" as const, quantity: "2", unitId: 3005 as number | "" };

  applyIngredientSelection(row, {
    id: 10000002,
    name: "盐",
    categoryId: 5006,
    categoryCode: "SEASONING",
    defaultUnitId: 3001,
    source: "SYSTEM"
  });

  assert.deepEqual(
    { quantity: row.quantity, unitId: row.unitId },
    { quantity: "2", unitId: 3005 }
  );
});

test("replacing a fuzzy seasoning with a non-seasoning clears 适量 and keeps the new identity", () => {
  const row = buildRow();

  applyIngredientSelection(row, {
    id: 10000001,
    name: "番茄",
    categoryId: 5001,
    categoryCode: "PRODUCE",
    defaultUnitId: 3005,
    source: "SYSTEM"
  });

  assert.deepEqual(row, {
    ingredientId: 10000001,
    name: "番茄",
    quantity: "",
    unitId: 3005,
    fuzzyText: "",
    categoryId: 5001,
    categoryCode: "PRODUCE",
    defaultUnitId: 3005,
    source: "SYSTEM"
  });
});
