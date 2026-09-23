import assert from "node:assert/strict";
import test from "node:test";
import { inspectInventoryRows, type InventoryAuditRow } from "./pantry.inventory-audit";

test("reports unsafe legacy rows without guessing by name", () => {
  const rows: InventoryAuditRow[] = [
    {
      id: 1,
      ingredientId: null,
      ingredientStatus: null,
      mergedToId: null,
      quantityText: "一袋",
      exactQuantity: null,
      exactUnitId: null,
      available: true,
      expireAt: null
    },
    {
      id: 2,
      ingredientId: 12,
      ingredientStatus: "MERGED",
      mergedToId: 20,
      quantityText: "2 个",
      exactQuantity: "2",
      exactUnitId: 3,
      available: true,
      expireAt: null
    },
    {
      id: 3,
      ingredientId: 20,
      ingredientStatus: "ACTIVE",
      mergedToId: null,
      quantityText: "500 克",
      exactQuantity: "500",
      exactUnitId: 4,
      available: true,
      expireAt: new Date("2026-09-19T00:00:00.000Z")
    }
  ];

  const report = inspectInventoryRows(rows, new Date("2026-09-20T00:00:00.000Z"));

  assert.deepEqual(report.missingIngredientIds, [1]);
  assert.deepEqual(report.mergedIngredientIds, [{ id: 2, targetId: 20 }]);
  assert.deepEqual(report.fuzzyQuantityIds, [1]);
  assert.deepEqual(report.expiredAvailableIds, [3]);
});

test("reports vague and invalid quantities without normalizing their text", () => {
  const report = inspectInventoryRows([
    {
      id: 8,
      ingredientId: 20,
      ingredientStatus: "ACTIVE",
      mergedToId: null,
      quantityText: "半盒",
      exactQuantity: null,
      exactUnitId: null,
      available: true,
      expireAt: null
    },
    {
      id: 9,
      ingredientId: 20,
      ingredientStatus: "ACTIVE",
      mergedToId: null,
      quantityText: "0 克",
      exactQuantity: "0",
      exactUnitId: 4,
      available: true,
      expireAt: null
    }
  ], new Date("2026-09-20T00:00:00.000Z"));

  assert.deepEqual(report.fuzzyQuantityIds, [8]);
  assert.deepEqual(report.invalidQuantityIds, [9]);
  assert.deepEqual(report.missingIngredientIds, []);
});
