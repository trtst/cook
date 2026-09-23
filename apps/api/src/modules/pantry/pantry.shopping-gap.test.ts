import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAutomaticGapLine,
  buildShoppingStatusUpdate,
  planAutomaticGapWrite,
  type AutomaticGapCandidate,
  type ShoppingSourceFact
} from "./pantry.low-friction-model";

function candidate(overrides: Partial<AutomaticGapCandidate>): AutomaticGapCandidate {
  return {
    sourceKey: "plan:101:recipe:202:ingredient:7",
    state: "SHORTAGE",
    ...overrides
  };
}

test("automatic gap write only changes its own source items", () => {
  const result = planAutomaticGapWrite([
    candidate({ sourceKey: "plan:101:recipe:202:ingredient:7" }),
    candidate({ sourceKey: "plan:101:recipe:202:ingredient:8", state: "UNKNOWN" }),
    candidate({ sourceKey: "plan:101:recipe:202:ingredient:9", state: "READY" }),
    candidate({ sourceKey: "plan:101:recipe:202:ingredient:10", state: "MISSING" })
  ], [
    { sourceKey: "manual:egg", sourceType: "MANUAL", status: "OPEN" },
    { sourceKey: "plan:101:recipe:202:ingredient:10", sourceType: "PLAN", status: "DELETED", removedByUserId: 5 }
  ]);

  assert.deepEqual(result.createdSourceKeys, ["plan:101:recipe:202:ingredient:7"]);
  assert.deepEqual(result.pendingKeys, ["plan:101:recipe:202:ingredient:8"]);
  assert.deepEqual(result.skippedSourceKeys, ["plan:101:recipe:202:ingredient:9", "plan:101:recipe:202:ingredient:10"]);
  assert.equal(result.manualItemsChanged, 0);
});

test("repeated automatic gap write skips an existing active source without touching it", () => {
  const source: ShoppingSourceFact = {
    sourceKey: "plan:101:recipe:202:ingredient:7",
    sourceType: "PLAN",
    status: "OPEN"
  };
  const result = planAutomaticGapWrite([candidate({ sourceKey: source.sourceKey })], [source]);

  assert.deepEqual(result.createdSourceKeys, []);
  assert.deepEqual(result.pendingKeys, []);
  assert.deepEqual(result.skippedSourceKeys, [source.sourceKey]);
  assert.equal(result.manualItemsChanged, 0);
});

test("automatic gap write keeps an existing unknown source out of pending confirmation", () => {
  const sourceKey = "plan:101:recipe:202:ingredient:8";
  const result = planAutomaticGapWrite(
    [candidate({ sourceKey, state: "UNKNOWN" })],
    [{ sourceKey, sourceType: "PLAN", status: "OPEN" }]
  );

  assert.deepEqual(result.pendingKeys, []);
  assert.deepEqual(result.skippedSourceKeys, [sourceKey]);
});

test("automatic gap write keeps a user-removed source tombstone out of future sync", () => {
  const sourceKey = "plan:101:recipe:202:ingredient:10";
  const result = planAutomaticGapWrite(
    [candidate({ sourceKey, state: "MISSING" })],
    [{ sourceKey, sourceType: "PLAN", status: "DELETED", removedByUserId: 5 }]
  );

  assert.deepEqual(result.createdSourceKeys, []);
  assert.deepEqual(result.skippedSourceKeys, [sourceKey]);
});

test("automatic gap line writes only the definite shortage quantity", () => {
  assert.deepEqual(
    buildAutomaticGapLine({
      sourceKey: "plan:101:recipe:202:ingredient:7",
      ingredientId: 7,
      ingredientName: "牛腩",
      requiredQuantity: "500",
      requiredUnitId: 1,
      exactStock: "300",
      exactStockUnitId: 1,
      hasRoughStock: false
    }),
    {
      sourceKey: "plan:101:recipe:202:ingredient:7",
      ingredientId: 7,
      ingredientName: "牛腩",
      state: "SHORTAGE",
      quantity: "200"
    }
  );

  assert.deepEqual(
    buildAutomaticGapLine({
      sourceKey: "plan:101:recipe:202:ingredient:8",
      ingredientId: 8,
      ingredientName: "鸡蛋",
      requiredQuantity: "2",
      requiredUnitId: 2,
      exactStock: null,
      exactStockUnitId: null,
      hasRoughStock: true
    }),
    {
      sourceKey: "plan:101:recipe:202:ingredient:8",
      ingredientId: 8,
      ingredientName: "鸡蛋",
      state: "UNKNOWN",
      quantity: null
    }
  );
});

test("restoring an automatic source clears its user-removal tombstone", () => {
  assert.deepEqual(buildShoppingStatusUpdate("OPEN", 9, new Date("2026-09-21T01:00:00.000Z")), {
    status: "OPEN",
    checkedAt: null,
    checkedByUserId: null,
    removedAt: null,
    removedByUserId: null
  });
});
