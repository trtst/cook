import assert from "node:assert/strict";
import test from "node:test";
import { buildShoppingDemandFactKey, buildShoppingDemandLines } from "./pantry.shopping-demand";

test("full shopping demand merges same ingredient and unit without reading inventory", () => {
  const lines = buildShoppingDemandLines([
    {
      sourceId: 501,
      sourceTitle: "周三晚餐",
      scheduledAt: new Date("2026-09-24T10:00:00.000Z"),
      updatedAt: new Date("2026-09-24T08:00:00.000Z"),
      recipeTitle: "番茄炒蛋",
      recipeId: 1001,
      sourceVersionId: 2001,
      baseServings: 2,
      ingredientSort: 1,
      ingredientId: 7,
      ingredientName: "鸡蛋",
      amount: { kind: "EXACT", quantity: "2", unitId: 1, unitName: "个", unitType: "COMMON" }
    },
    {
      sourceId: 501,
      sourceTitle: "周三晚餐",
      scheduledAt: new Date("2026-09-24T10:00:00.000Z"),
      updatedAt: new Date("2026-09-24T08:00:00.000Z"),
      recipeTitle: "紫菜蛋花汤",
      recipeId: 1002,
      sourceVersionId: 2002,
      baseServings: 2,
      ingredientSort: 2,
      ingredientId: 7,
      ingredientName: "鸡蛋",
      amount: { kind: "EXACT", quantity: "1", unitId: 1, unitName: "个", unitType: "COMMON" }
    },
    {
      sourceId: 501,
      sourceTitle: "周三晚餐",
      scheduledAt: new Date("2026-09-24T10:00:00.000Z"),
      updatedAt: new Date("2026-09-24T08:00:00.000Z"),
      recipeTitle: "紫菜蛋花汤",
      recipeId: 1002,
      sourceVersionId: 2002,
      baseServings: 2,
      ingredientSort: 3,
      ingredientId: 8,
      ingredientName: "盐",
      amount: { kind: "FUZZY", text: "适量" }
    }
  ]);

  assert.deepEqual(lines.map(line => ({
    sourceKey: line.sourceKey,
    ingredientId: line.ingredientId,
    ingredientName: line.ingredientName,
    quantityText: line.quantityText,
    sourceCount: line.sourceCount,
    sourceTitles: line.sourceTitles
  })), [
    {
      sourceKey: "ingredient:7:EXACT:1",
      ingredientId: 7,
      ingredientName: "鸡蛋",
      quantityText: "3个",
      sourceCount: 2,
      sourceTitles: ["番茄炒蛋", "紫菜蛋花汤"]
    },
    {
      sourceKey: "ingredient:8:FUZZY:适量:501:v2002:3",
      ingredientId: 8,
      ingredientName: "盐",
      quantityText: "适量",
      sourceCount: 1,
      sourceTitles: ["紫菜蛋花汤"]
    }
  ]);
});

test("merged demand keeps every source fact for later shopping-list writes", () => {
  const lines = buildShoppingDemandLines([
    {
      sourceId: 501,
      sourceTitle: "周三晚餐",
      scheduledAt: new Date("2026-09-24T10:00:00.000Z"),
      updatedAt: new Date("2026-09-24T08:00:00.000Z"),
      recipeTitle: "番茄炒蛋",
      recipeId: 1001,
      sourceVersionId: 2001,
      baseServings: 2,
      ingredientSort: 1,
      ingredientId: 7,
      ingredientName: "鸡蛋",
      amount: { kind: "EXACT", quantity: "2", unitId: 1, unitName: "个", unitType: "COMMON" }
    },
    {
      sourceId: 501,
      sourceTitle: "周三晚餐",
      scheduledAt: new Date("2026-09-24T10:00:00.000Z"),
      updatedAt: new Date("2026-09-24T08:00:00.000Z"),
      recipeTitle: "紫菜蛋花汤",
      recipeId: 1002,
      sourceVersionId: 2002,
      baseServings: 2,
      ingredientSort: 2,
      ingredientId: 7,
      ingredientName: "鸡蛋",
      amount: { kind: "EXACT", quantity: "1", unitId: 1, unitName: "个", unitType: "COMMON" }
    }
  ]);

  assert.deepEqual(
    (lines[0] as any)?.sourceFacts?.map((source: any) => [source.recipeId, source.sourceVersionId, source.ingredientSort]),
    [[1001, 2001, 1], [1002, 2002, 2]]
  );
  assert.deepEqual(
    lines[0]?.sourceFacts.map(source => buildShoppingDemandFactKey(lines[0]!.sourceKey, source)),
    [
      "501:ingredient:7:EXACT:1:r1001:v2001:i1",
      "501:ingredient:7:EXACT:1:r1002:v2002:i2"
    ]
  );
});

test("scoped demand source keys keep plan and event writes independent", () => {
  const source = {
    sourceId: 501,
    sourceTitle: "周三晚餐",
    scheduledAt: new Date("2026-09-24T10:00:00.000Z"),
    updatedAt: new Date("2026-09-24T08:00:00.000Z"),
    recipeTitle: "番茄炒蛋",
    recipeId: 1001,
    sourceVersionId: 2001,
    baseServings: 2,
    ingredientSort: 1,
    ingredientId: 7,
    ingredientName: "鸡蛋",
    amount: { kind: "EXACT" as const, quantity: "2", unitId: 1, unitName: "个", unitType: "COMMON" as const }
  };

  assert.equal(buildShoppingDemandLines([source], "501")[0]?.sourceKey, "501:ingredient:7:EXACT:1");
  assert.equal(buildShoppingDemandLines([source], "502")[0]?.sourceKey, "502:ingredient:7:EXACT:1");
});

test("shopping demand preserves decimal precision, separates units, and keeps fuzzy text", () => {
  const base = {
    sourceId: 501,
    sourceTitle: "周三晚餐",
    scheduledAt: new Date("2026-09-24T10:00:00.000Z"),
    updatedAt: new Date("2026-09-24T08:00:00.000Z"),
    recipeTitle: "番茄炒蛋",
    recipeId: 1001,
    sourceVersionId: 2001,
    baseServings: 2,
    ingredientSort: 1,
    ingredientId: 7,
    ingredientName: "番茄"
  };

  const lines = buildShoppingDemandLines([
    { ...base, amount: { kind: "EXACT", quantity: "0.1", unitId: 1, unitName: "千克", unitType: "WEIGHT" } },
    { ...base, ingredientSort: 2, amount: { kind: "EXACT", quantity: "0.02", unitId: 1, unitName: "千克", unitType: "WEIGHT" } },
    { ...base, ingredientSort: 3, amount: { kind: "EXACT", quantity: "1", unitId: 2, unitName: "个", unitType: "COMMON" } },
    { ...base, ingredientId: 8, ingredientName: "盐", ingredientSort: 4, amount: { kind: "FUZZY", text: "适量" } }
  ]);

  assert.deepEqual(lines.map(line => [line.ingredientName, line.quantityText]), [
    ["番茄", "0.12千克"],
    ["番茄", "1个"],
    ["盐", "适量"]
  ]);
});

test("fuzzy demand keeps same-text amounts separate across recipe sources", () => {
  const base = {
    sourceId: 501,
    sourceTitle: "周三晚餐",
    scheduledAt: new Date("2026-09-24T10:00:00.000Z"),
    updatedAt: new Date("2026-09-24T08:00:00.000Z"),
    recipeId: 1001,
    baseServings: 2,
    ingredientId: 7,
    ingredientName: "盐",
    amount: { kind: "FUZZY" as const, text: "适量" as const }
  };

  const lines = buildShoppingDemandLines([
    { ...base, recipeTitle: "番茄炒蛋", sourceVersionId: 2001, ingredientSort: 1 },
    { ...base, recipeTitle: "紫菜蛋花汤", sourceVersionId: 2002, ingredientSort: 1 }
  ]);

  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map(line => line.sourceTitles), [["番茄炒蛋"], ["紫菜蛋花汤"]]);
});
