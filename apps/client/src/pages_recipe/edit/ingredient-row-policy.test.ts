import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyIngredientSelection, chooseFuzzyAmount } from "./ingredient-row-policy";

test("the edit page exposes 适量 in the unit sheet for every ingredient category", () => {
  const source = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");

  assert.match(source, /<text class="sheet-section__title">模糊用量<\/text>/);
  assert.doesNotMatch(source, /v-if="activeUnitRow\?\.categoryCode === 'SEASONING'"/);
  const unitSheetStart = source.indexOf('<template v-else-if="sheetMode === \'unit\'">');
  const unitGroupIndex = source.indexOf('v-for="group in unitGroups"', unitSheetStart);
  const fuzzySectionIndex = source.indexOf('<text class="sheet-section__title">模糊用量</text>', unitSheetStart);
  assert.ok(unitGroupIndex >= 0 && fuzzySectionIndex > unitGroupIndex, "Expected 适量 after all system unit groups");
});

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

test("all ingredient categories can switch to 适量", () => {
  const row = { ...buildRow(), categoryCode: "PRODUCE", fuzzyText: "" as const, quantity: "2", unitId: 3005 as number | "" };

  assert.equal(chooseFuzzyAmount(row), true);
  assert.deepEqual(
    { quantity: row.quantity, unitId: row.unitId, fuzzyText: row.fuzzyText },
    { quantity: "", unitId: "", fuzzyText: "适量" }
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

test("replacing a fuzzy ingredient keeps 适量 across categories", () => {
  const row = buildRow();

  applyIngredientSelection(row, {
    id: 10000001,
    name: "番茄",
    categoryId: 5001,
    categoryCode: "PRODUCE",
    defaultUnitId: 3005,
    source: "SYSTEM"
  });

  assert.deepEqual(
    { ingredientId: row.ingredientId, name: row.name, quantity: row.quantity, unitId: row.unitId, fuzzyText: row.fuzzyText },
    { ingredientId: 10000001, name: "番茄", quantity: "", unitId: "", fuzzyText: "适量" }
  );
});
