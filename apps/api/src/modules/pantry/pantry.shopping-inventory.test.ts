import assert from "node:assert/strict";
import test from "node:test";
import { buildAutomaticStockIn, type StockInInput } from "./pantry.shopping-inventory";

test("automatic stock-in creates presence-only inventory without fake quantity or expiry", () => {
  const result = buildAutomaticStockIn({
    itemId: 11,
    ingredientId: 7,
    name: "牛腩",
    explicitQuantity: null,
    explicitUnitId: null,
    explicitUnitName: null,
    explicitExpireAt: null
  });

  assert.deepEqual(result, {
    itemId: 11,
    ingredientId: 7,
    name: "牛腩",
    quantityText: null,
    exactQuantity: null,
    exactUnitId: null,
    expireAt: null,
    availabilityState: "UNKNOWN"
  });
});

test("explicit exact quantity remains eligible for later automatic consumption", () => {
  const input: StockInInput = {
    itemId: 12,
    ingredientId: 7,
    name: "牛腩",
    explicitQuantity: "800",
    explicitUnitId: 2,
    explicitUnitName: "克",
    explicitExpireAt: "2026-09-28T00:00:00.000Z"
  };

  assert.deepEqual(buildAutomaticStockIn(input), {
    itemId: 12,
    ingredientId: 7,
    name: "牛腩",
    quantityText: "800 克",
    exactQuantity: "800",
    exactUnitId: 2,
    expireAt: "2026-09-28T00:00:00.000Z",
    availabilityState: "READY"
  });
});
