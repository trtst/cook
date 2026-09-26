import assert from "node:assert/strict";
import test from "node:test";
import { fridgePresenceState, fridgePresentIngredientIds, fridgeTraceLabel, fridgeTraceWindowDays, isFridgeTraceVisible } from "./pantry.fridge-trace";

const now = new Date("2026-09-24T00:00:00.000Z");

test("蔬菜水果和鲜食材只保留七天痕迹", () => {
  assert.equal(fridgeTraceWindowDays("蔬菜"), 7);
  assert.equal(fridgeTraceWindowDays("水果"), 7);
  assert.equal(fridgeTraceWindowDays("豆制品"), 7);
  assert.equal(fridgeTraceWindowDays("豆乳制品"), 15);
  assert.equal(fridgeTraceWindowDays(null, "PRODUCE"), 7);
  assert.equal(fridgeTraceWindowDays(null, "SOY_DAIRY"), 15);
  assert.equal(isFridgeTraceVisible(new Date("2026-09-17T00:00:00.000Z"), "蔬菜", now), false);
});

test("其他和未知分类保留十五天痕迹", () => {
  assert.equal(fridgeTraceWindowDays("调味品"), 15);
  assert.equal(fridgeTraceWindowDays(null), 15);
  assert.equal(isFridgeTraceVisible(new Date("2026-09-10T00:00:00.000Z"), "调味品", now), true);
  assert.equal(isFridgeTraceVisible(new Date("2026-09-08T23:59:59.000Z"), "调味品", now), false);
});

test("痕迹文案不承诺精确库存", () => {
  assert.equal(fridgeTraceLabel("PURCHASED"), "最近买过，可能有");
  assert.equal(fridgeTraceLabel("USED"), "用过，余量未知");
});

test("最新购买或手动确认决定有无，用过痕迹不覆盖食材状态", () => {
  const state = fridgePresenceState([
    { kind: "MANUAL_EMPTY", createdAt: new Date("2026-09-15T00:00:00.000Z"), categoryName: "蔬菜", categoryCode: null },
    { kind: "USED", createdAt: new Date("2026-09-23T00:00:00.000Z"), categoryName: "蔬菜", categoryCode: null },
    { kind: "PURCHASED", createdAt: new Date("2026-09-22T00:00:00.000Z"), categoryName: "蔬菜", categoryCode: null }
  ], now);

  assert.deepEqual(state, {
    status: "PRESENT",
    updatedAt: "2026-09-22T00:00:00.000Z",
    windowDays: 7,
    archived: false,
    recentlyPurchased: true
  });
});

test("有无确认超过七或十五天降为未确认，超过三十天移入折叠区", () => {
  const perishable = fridgePresenceState([
    { kind: "PURCHASED", createdAt: new Date("2026-09-16T00:00:00.000Z"), categoryName: "水果", categoryCode: null }
  ], now);
  const oldOther = fridgePresenceState([
    { kind: "MANUAL_EMPTY", createdAt: new Date("2026-08-20T00:00:00.000Z"), categoryName: "调味品", categoryCode: null }
  ], now);

  assert.equal(perishable?.status, "UNCONFIRMED");
  assert.equal(perishable?.archived, false);
  assert.equal(oldOther?.status, "UNCONFIRMED");
  assert.equal(oldOther?.archived, true);
});

test("最近买过只在三天内显示", () => {
  const state = fridgePresenceState([
    { kind: "PURCHASED", createdAt: new Date("2026-09-20T00:00:00.000Z"), categoryName: "蔬菜", categoryCode: null }
  ], now);

  assert.equal(state?.status, "PRESENT");
  assert.equal(state?.recentlyPurchased, false);
});

test("推荐只把近期最新状态为有的食材作为参考", () => {
  const ids = fridgePresentIngredientIds([
    { ingredientId: 1001, kind: "PURCHASED", createdAt: new Date("2026-09-23T00:00:00.000Z"), categoryName: "蔬菜", categoryCode: null },
    { ingredientId: 1001, kind: "MANUAL_EMPTY", createdAt: new Date("2026-09-23T12:00:00.000Z"), categoryName: "蔬菜", categoryCode: null },
    { ingredientId: 1002, kind: "MANUAL_PRESENT", createdAt: new Date("2026-09-22T00:00:00.000Z"), categoryName: "蔬菜", categoryCode: null },
    { ingredientId: 1003, kind: "MANUAL_PRESENT", createdAt: new Date("2026-09-08T00:00:00.000Z"), categoryName: "调味品", categoryCode: null }
  ], now);

  assert.deepEqual([...ids], [1002]);
});
