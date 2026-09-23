import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { planBestEffortInventoryConsumption, planInventoryConsumption, type InventoryConsumptionCandidate } from "./pantry.inventory-write";

function candidate(overrides: Partial<InventoryConsumptionCandidate>): InventoryConsumptionCandidate {
  return {
    id: 21,
    exactQuantity: "2",
    exactUnitId: 3,
    reservedQuantity: "0",
    available: true,
    expireAt: new Date("2026-09-21T00:00:00.000Z"),
    createdAt: new Date("2026-09-18T00:00:00.000Z"),
    version: 1,
    ...overrides
  };
}

test("plans consumption across batches in earliest-expiry order", () => {
  const plan = planInventoryConsumption([
    candidate({ id: 22, exactQuantity: "5", expireAt: new Date("2026-09-25T00:00:00.000Z") }),
    candidate({ id: 21, exactQuantity: "2", expireAt: new Date("2026-09-21T00:00:00.000Z") })
  ], "6", 3);

  assert.deepEqual(plan.allocations, [
    { batchId: 21, quantity: "2", unitId: 3 },
    { batchId: 22, quantity: "4", unitId: 3 }
  ]);
});

test("rejects shortage, reserved quantity, and incomparable units before any update", () => {
  assert.throws(
    () => planInventoryConsumption([candidate({ exactQuantity: "5", reservedQuantity: "4" })], "2", 3),
    error => error instanceof ConflictException && /库存不足/.test(error.message)
  );
  assert.throws(
    () => planInventoryConsumption([candidate({ exactUnitId: 4 })], "2", 3),
    error => error instanceof ConflictException && /数量待确认/.test(error.message)
  );
});

test("rejects a non-positive or malformed requested quantity as bad input", () => {
  assert.throws(
    () => planInventoryConsumption([candidate({})], "0", 3),
    error => error instanceof BadRequestException && /大于 0/.test(error.message)
  );
  assert.throws(
    () => planInventoryConsumption([candidate({})], "not-a-number", 3),
    error => error instanceof BadRequestException && /有效/.test(error.message)
  );
});

test("keeps expired batches eligible for consumption", () => {
  const plan = planInventoryConsumption([
    candidate({ id: 30, exactQuantity: "1", expireAt: new Date("2026-09-19T00:00:00.000Z") })
  ], "1", 3);

  assert.deepEqual(plan.allocations, [{ batchId: 30, quantity: "1", unitId: 3 }]);
});

test("plans the available comparable quantity without failing when demand is short", () => {
  const plan = planBestEffortInventoryConsumption([
    candidate({ id: 11, exactQuantity: "3", exactUnitId: 3, expireAt: new Date("2026-09-22T00:00:00.000Z") })
  ], "5", 3);

  assert.deepEqual(plan.allocations, [{ batchId: 11, quantity: "3", unitId: 3 }]);
  assert.equal(plan.unfulfilledQuantity, "2");
});
