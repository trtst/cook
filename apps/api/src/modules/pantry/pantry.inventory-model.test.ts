import assert from "node:assert/strict";
import test from "node:test";
import { buildEmptyFridgeIngredientSummary, groupFridgeBatches, type InventoryBatchRecord } from "./pantry.inventory-model";

function batch(overrides: Partial<InventoryBatchRecord>): InventoryBatchRecord {
  return {
    id: 1,
    ingredientId: 7,
    name: "土豆",
    categoryName: "蔬菜",
    quantityText: null,
    exactQuantity: "1",
    exactUnitId: 1,
    exactUnitName: "个",
    note: null,
    available: true,
    version: 1,
    expireAt: null,
    createdAt: new Date("2026-09-18T00:00:00.000Z"),
    updatedAt: new Date("2026-09-18T00:00:00.000Z"),
    reservedQuantity: "0",
    reservations: [],
    ...overrides
  };
}

test("returns one ingredient summary for multiple batches", () => {
  const result = groupFridgeBatches([
    batch({ id: 10, exactQuantity: "500", exactUnitId: 1, exactUnitName: "克", expireAt: new Date("2026-09-22") }),
    batch({ id: 11, exactQuantity: "2", exactUnitId: 2, exactUnitName: "个", expireAt: new Date("2026-09-19") })
  ], new Date("2026-09-20T00:00:00.000Z"));

  assert.equal(result.length, 1);
  assert.equal(result[0]?.ingredientId, 7);
  assert.deepEqual(result[0]?.stockGroups, [
    { unitId: 2, unitName: "个", quantity: "2", batchCount: 1 },
    { unitId: 1, unitName: "克", quantity: "500", batchCount: 1 }
  ]);
  assert.equal(result[0]?.expiredBatchCount, 1);
  assert.equal(result[0]?.batches[0]?.id, 11);
});

test("keeps vague quantities visible without pretending they are comparable", () => {
  const result = groupFridgeBatches([
    batch({ id: 15, quantityText: "半盒", exactQuantity: null, exactUnitId: null, exactUnitName: null })
  ], new Date("2026-09-20T00:00:00.000Z"));

  assert.equal(result[0]?.needsConfirmation, true);
  assert.equal(result[0]?.stockText, "半盒");
  assert.equal(result[0]?.stockGroups.length, 0);
});

test("returns an empty current summary after the final batch is consumed", () => {
  const result = buildEmptyFridgeIngredientSummary([
    batch({ id: 18, exactQuantity: "0", available: false, updatedAt: new Date("2026-09-20T10:00:00.000Z") })
  ]);

  assert.equal(result.ingredientId, 7);
  assert.equal(result.stockText, "已用完");
  assert.equal(result.batchCount, 0);
  assert.deepEqual(result.batches, []);
});
