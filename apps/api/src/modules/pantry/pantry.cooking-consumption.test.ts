import assert from "node:assert/strict";
import test from "node:test";
import { buildCookingConsumptionPlan, scaleCookingQuantity, type CookingConsumptionLine } from "./pantry.cooking-consumption";
import { PantryService } from "./pantry.service";

function exactLine(overrides: Partial<CookingConsumptionLine>): CookingConsumptionLine {
  return {
    ingredientKey: "egg",
    ingredientId: 7,
    ingredientName: "鸡蛋",
    quantity: "1",
    unitId: 1,
    recipeTitle: "番茄炒蛋",
    recipeVersionId: 20,
    precision: "EXACT",
    ...overrides
  };
}

test("cooking completion merges duplicate ingredients and skips fuzzy seasoning", () => {
  const result = buildCookingConsumptionPlan([
    exactLine({ quantity: "2" }),
    exactLine({ quantity: "1", recipeTitle: "紫菜蛋花汤", recipeVersionId: 21 }),
    exactLine({
      ingredientKey: "salt",
      ingredientId: 8,
      ingredientName: "盐",
      quantity: "1",
      recipeTitle: "番茄炒蛋",
      precision: "FUZZY"
    })
  ]);

  assert.deepEqual(result.exactLines, [{
    ingredientKey: "egg",
    ingredientId: 7,
    quantity: "3",
    unitId: 1,
    sources: [
      { recipeTitle: "番茄炒蛋", recipeVersionId: 20 },
      { recipeTitle: "紫菜蛋花汤", recipeVersionId: 21 }
    ]
  }]);
  assert.deepEqual(result.skippedFuzzySources, ["盐"]);
});

test("scales exact recipe quantity by the current meal servings", () => {
  assert.equal(scaleCookingQuantity("250", 2, 5), "625");
  assert.equal(scaleCookingQuantity("1.5", 4, 2), "0.75");
});

test("records rough inventory use without pretending to know the remaining quantity", async () => {
  const roughRow = {
    id: 101,
    ingredientId: 7,
    name: "土豆",
    quantityText: "半袋",
    exactQuantity: null,
    exactUnitId: null,
    note: null,
    available: true,
    version: 4,
    expireAt: null,
    createdAt: new Date("2026-09-20T00:00:00.000Z"),
    updatedAt: new Date("2026-09-20T00:00:00.000Z"),
    ingredient: { id: 7, status: "ACTIVE", name: "土豆", mergedTo: null, category: { name: "蔬菜" } },
    exactUnit: null,
    sourceShoppingItem: null
  };
  const fridgeUpdates: unknown[] = [];
  const audits: unknown[] = [];
  let storedResult: unknown = null;
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async ({ where }: { where: { operationId?: string } }) => where.operationId === "202609230001" && storedResult
        ? { status: "SUCCEEDED", resultJson: storedResult }
        : null,
      create: async () => ({}),
      updateMany: async ({ data }: { data: { resultJson?: unknown } }) => {
        if (data.resultJson) storedResult = data.resultJson;
        return { count: 1 };
      }
    },
    mealPlanItem: {
      findUnique: async () => ({
        id: 500,
        userId: 1,
        diningEvent: null,
        dishes: [{
          recipeVersionId: 20,
          recipeVersion: {
            id: 20,
            name: "土豆炖肉",
            baseServings: 2,
            ingredientsJson: [{ ingredientId: 7, ingredientName: "土豆", amount: { kind: "EXACT", quantity: "2", unitId: 1 } }]
          }
        }]
      })
    },
    recipeContentVersion: { findMany: async () => [] },
    fridgeItem: {
      findMany: async () => [roughRow],
      findFirst: async () => ({ ...roughRow }),
      updateMany: async (args: { data: { quantityText?: string; version: { increment: number } } }) => {
        fridgeUpdates.push(args);
        if (args.data.quantityText) roughRow.quantityText = args.data.quantityText;
        roughRow.version += args.data.version.increment;
        return { count: 1 };
      }
    },
    shoppingItemFridgeReservation: { findMany: async () => [] },
    auditEvent: {
      findFirst: async () => null,
      create: async (args: unknown) => { audits.push(args); }
    }
  };
  const prisma = { $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx) };
  const service = new PantryService(prisma as never, {} as never, {} as never, {} as never);

  const result = await service.completeMealCooking(1, 500, "202609230001");
  await service.undoMealCooking(1, 500, "202609230002", "202609230001");

  assert.equal(result.updatedCount, 1);
  assert.equal(result.unknownCount, 1);
  assert.equal((fridgeUpdates[0] as { data: { quantityText: string; version: { increment: number } } }).data.quantityText, "本次使用过，余量未知");
  assert.equal((fridgeUpdates[0] as { data: { version: { increment: number } } }).data.version.increment, 1);
  assert.equal((audits[0] as { data: { payload: { servings: number; roughAllocations: unknown[] } } }).data.payload.servings, 1);
  assert.equal((audits[0] as { data: { payload: { roughAllocations: unknown[] } } }).data.payload.roughAllocations.length, 1);
  assert.equal((fridgeUpdates[1] as { data: { quantityText: string; exactQuantity: null; exactUnitId: null } }).data.quantityText, "半袋");
  assert.equal((fridgeUpdates[1] as { data: { quantityText: string; exactQuantity: null; exactUnitId: null } }).data.exactQuantity, null);
  assert.equal((fridgeUpdates[1] as { data: { quantityText: string; exactQuantity: null; exactUnitId: null } }).data.exactUnitId, null);
});

test("rejects a second cooking completion for the same meal and user even with a new idempotency key", async () => {
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    mealPlanItem: {
      findUnique: async () => ({ id: 500, userId: 1, diningEvent: null, dishes: [] })
    },
    fridgeItem: { findMany: async () => [] },
    shoppingItemFridgeReservation: { findMany: async () => [] },
    auditEvent: {
      findFirst: async () => ({ id: 900 }),
      create: async () => undefined
    }
  };
  const prisma = { $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx) };
  const service = new PantryService(prisma as never, {} as never, {} as never, {} as never);

  await assert.rejects(
    service.completeMealCooking(1, 500, "202609230003"),
    /本次餐次已完成库存扣减/
  );
});
