import assert from "node:assert/strict";
import test from "node:test";
import { PantryService } from "./pantry.service";

function createService() {
  return new PantryService({} as never, {} as never, {} as never, {} as never);
}

function sourceSummary(overrides: Record<string, unknown> = {}) {
  return {
    sourceType: "PLAN" as const,
    note: "番茄炒蛋",
    sourceKey: "501:ingredient:7:EXACT:1",
    sourceRecipeId: 1001,
    sourceRecipeVersionId: 2001,
    sourceRecipeTitle: "番茄炒蛋",
    sourceBaseServings: 2,
    sourceBatchKey: "10001",
    ...overrides
  };
}

test("plan source keys with a demand suffix still resolve their plan metadata", () => {
  const service = createService();
  const result = (service as any).toShoppingItemSourceSummary(sourceSummary(), {
    planMap: new Map([[501, { title: "周三晚餐", planDate: "2026-09-24" }]]),
    eventMap: new Map(),
    recipeMap: new Map([[1001, "my"]])
  });

  assert.equal(result.planItemId, 501);
  assert.equal(result.title, "周三晚餐");
  assert.equal(result.planDate, "2026-09-24");
  assert.equal(result.recipeKind, "my");
});

test("plan demand summaries retain PLAN source type and a plan-scoped key", () => {
  const service = createService();
  const result = (service as any).buildLegacyGapSummary([
    {
      id: 501,
      title: "周三晚餐",
      scheduledAt: new Date("2026-09-24T10:00:00.000Z"),
      updatedAt: new Date("2026-09-24T08:00:00.000Z"),
      menuItems: [{
        title: "番茄炒蛋",
        recipeId: 1001,
        recipeVersionId: 2001,
        recipeVersion: {
          baseServings: 2,
          ingredientsJson: [{
            ingredientId: 7,
            ingredientName: "鸡蛋",
            source: "SYSTEM",
            categoryId: 1,
            amount: { kind: "EXACT", quantity: "2", unitId: 1, unitName: "个", unitType: "COMMON" }
          }]
        }
      }]
    }
  ], "EVENT", "PLAN", "501");

  assert.equal(result[0]?.sourceType, "PLAN");
  assert.equal(result[0]?.sourceKey, "501:ingredient:7:EXACT:1");
  assert.equal(result[0]?.quantityText, "2个");
});

test("event-scoped demand summaries keep identical ingredients independent", () => {
  const service = createService();
  const build = (eventId: number) => (service as any).buildLegacyGapSummary([
    {
      id: eventId,
      title: `饭局${eventId}`,
      scheduledAt: new Date("2026-09-24T10:00:00.000Z"),
      updatedAt: new Date("2026-09-24T08:00:00.000Z"),
      menuItems: [{
        title: "番茄炒蛋",
        recipeId: 1001,
        recipeVersionId: 2001,
        recipeVersion: {
          baseServings: 2,
          ingredientsJson: [{
            ingredientId: 7,
            ingredientName: "鸡蛋",
            source: "SYSTEM",
            categoryId: 1,
            amount: { kind: "EXACT", quantity: "2", unitId: 1, unitName: "个", unitType: "COMMON" }
          }]
        }
      }]
    }
  ], "EVENT", "EVENT", String(eventId));

  assert.equal(build(501)[0]?.sourceKey, "501:ingredient:7:EXACT:1");
  assert.equal(build(502)[0]?.sourceKey, "502:ingredient:7:EXACT:1");
});

test("plan demand preview applies current ingredient merge rules to fixed recipe content", async () => {
  const service = createService();
  const result = await (service as any).loadPlanGapSummary({
    mealPlanItem: {
      findUnique: async () => ({
        id: 501,
        title: "周三晚餐",
        planDate: new Date("2026-09-24T00:00:00.000Z"),
        updatedAt: new Date("2026-09-24T08:00:00.000Z"),
        userId: 9,
        dishes: [{
          recipeId: 1001,
          recipeVersionId: 2001,
        }]
      })
    },
    recipe: {
      findUnique: async () => ({ id: 1001, ownerId: 9, isInspiration: false, status: "ACTIVE", currentVersionId: 2001, inspirationCategoryId: null })
    },
    recipeContentVersion: {
      findUnique: async () => ({
        id: 2001,
        name: "番茄炒蛋",
        story: null,
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        estimatedCalories: null,
        tips: null,
        ingredientsJson: [{
          ingredientId: 7,
          ingredientName: "长茄子",
          source: "SYSTEM",
          categoryId: 1,
          amount: { kind: "EXACT", quantity: "1", unitId: 1, unitName: "根", unitType: "COMMON" }
        }],
        stepsJson: []
      })
    },
    ingredient: {
      findMany: async () => [{
        id: 7,
        status: "MERGED",
        mergedTo: { id: 8, ownerId: null, status: "ACTIVE", name: "茄子", categoryId: 1 }
      }]
    }
  }, 9, 501);

  assert.equal(result[0]?.ingredientId, 8);
  assert.equal(result[0]?.name, "茄子");
});

test("event demand loading selects recipe base servings for source facts", async () => {
  let selected: any;
  const service = createService();
  const result = await (service as any).loadEventGapSummary({
    diningEvent: {
      findUnique: async (args: any) => {
        selected = args.select;
        const hasBaseServings = Boolean(args.select.menuItems.select.recipeVersion.select.baseServings);
        return {
          id: 501,
          userId: 9,
          title: "周三晚餐",
          scheduledAt: new Date("2026-09-24T10:00:00.000Z"),
          updatedAt: new Date("2026-09-24T08:00:00.000Z"),
          menuItems: [{
            title: "番茄炒蛋",
            recipeVersionId: 2001,
            recipeVersion: {
              ...(hasBaseServings ? { baseServings: 4 } : {}),
              ingredientsJson: [{
                ingredientId: 7,
                ingredientName: "鸡蛋",
                amount: { kind: "EXACT", quantity: "2", unitId: 1, unitName: "个", unitType: "COMMON" }
              }]
            }
          }]
        };
      }
    }
  }, 9, 501);

  assert.equal(selected.menuItems.select.recipeVersion.select.baseServings, true);
  assert.equal(result[0]?.sourceBaseServings, 4);
});

test("event gap writes do not recreate a user-deleted source", async () => {
  let created = false;
  let existingWhere: Record<string, unknown> | null = null;
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    shoppingItem: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        existingWhere = where;
        return {
          id: 700,
          status: "DELETED",
          sourceKey: "501:ingredient:7:EXACT:1"
        };
      },
      create: async () => {
        created = true;
        return { id: 701 };
      }
    }
  };
  const service = createService();
  (service as any).loadEventGapSummary = async () => [{
    id: -1,
    name: "鸡蛋",
    quantityText: "2个",
    note: "番茄炒蛋",
    sourceCount: 1,
    sourceTitles: ["番茄炒蛋"],
    sourceType: "EVENT",
    sourceKey: "501:ingredient:7:EXACT:1",
    status: "OPEN",
    updatedAt: "2026-09-24T08:00:00.000Z",
    ingredientId: 7,
    amountJson: { kind: "EXACT", quantity: "2", unitId: 1, unitName: "个", unitType: "COMMON" },
    sourceRecipeId: null,
    sourceRecipeVersionId: null,
    sourceRecipeTitle: null,
    sourceBaseServings: null,
    sourceIngredientSort: null
  }];
  (service as any).assertShoppingListWritable = async () => ({ ownerUserId: 9 });
  (service as any).assertStorageWritable = async () => undefined;
  (service as any).bindDiningEventShoppingList = async () => undefined;
  (service as any).loadShoppingListDetailFromTx = async () => ({ id: 10 });
  (service as any).prisma = {
    $transaction: async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx)
  };

  await (service as any).addEventGapToShoppingList(9, 10, "10001", 501);

  assert.equal(created, false);
  assert.ok(existingWhere);
  assert.equal("status" in existingWhere!, false);
});

test("event gap writes keep one shopping row per source fact while preview stays merged", async () => {
  const creates: Array<Record<string, unknown>> = [];
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    shoppingItem: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        creates.push(data);
        return { ...data, id: creates.length, status: "OPEN", updatedAt: new Date() };
      }
    },
    storageLedger: {
      upsert: async () => ({})
    },
    shoppingList: {
      update: async () => ({})
    }
  };
  const service = createService();
  (service as any).loadEventGapSummary = async () => [{
    id: -1,
    name: "鸡蛋",
    quantityText: "3个",
    note: "来自菜单",
    sourceCount: 2,
    sourceTitles: ["番茄炒蛋", "紫菜蛋花汤"],
    sourceType: "EVENT",
    sourceKey: "501:ingredient:7:EXACT:1",
    status: "OPEN",
    updatedAt: "2026-09-24T08:00:00.000Z",
    ingredientId: 7,
    amountJson: { kind: "EXACT", quantity: "3", unitId: 1, unitName: "个", unitType: "COMMON" },
    sourceRecipeId: 1001,
    sourceRecipeVersionId: 2001,
    sourceRecipeTitle: "番茄炒蛋",
    sourceBaseServings: 2,
    sourceIngredientSort: 1,
    sourceFacts: [
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
    ]
  }];
  (service as any).assertShoppingListWritable = async () => ({ ownerUserId: 9 });
  (service as any).assertStorageWritable = async () => undefined;
  (service as any).bindDiningEventShoppingList = async () => undefined;
  (service as any).loadShoppingListDetailFromTx = async () => ({ id: 10 });
  (service as any).prisma = {
    $transaction: async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx)
  };

  await (service as any).addEventGapToShoppingList(9, 10, "10001", 501);

  assert.equal(creates.length, 2);
  assert.deepEqual(creates.map(item => item.sourceKey), [
    "501:ingredient:7:EXACT:1:r1001:v2001:i1",
    "501:ingredient:7:EXACT:1:r1002:v2002:i2"
  ]);
  assert.deepEqual(creates.map(item => item.sourceRecipeTitle), ["番茄炒蛋", "紫菜蛋花汤"]);
  assert.deepEqual(creates.map(item => item.quantityText), ["2个", "1个"]);
});

test("plan gap writes preserve each fixed recipe source behind a merged demand line", async () => {
  const creates: Array<Record<string, unknown>> = [];
  const tx = {
    mealPlanItem: {
      findFirst: async () => ({ shoppingListId: 602 })
    },
    shoppingItem: {
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        creates.push(data);
        return { ...data, id: creates.length };
      }
    },
    storageLedger: {
      upsert: async () => ({})
    },
    shoppingList: {
      update: async () => ({})
    }
  };
  const service = createService();
  (service as any).loadPlanGapSummary = async () => [{
    id: -1,
    name: "鸡蛋",
    quantityText: "3个",
    note: "来自待处理饭局菜单",
    sourceCount: 2,
    sourceTitles: ["番茄炒蛋", "紫菜蛋花汤"],
    sourceType: "PLAN",
    sourceKey: "501:ingredient:7:EXACT:1",
    status: "OPEN",
    updatedAt: "2026-09-24T08:00:00.000Z",
    ingredientId: 7,
    amountJson: { kind: "EXACT", quantity: "3", unitId: 1, unitName: "个", unitType: "COMMON" },
    sourceRecipeId: 1001,
    sourceRecipeVersionId: 2001,
    sourceRecipeTitle: "番茄炒蛋",
    sourceBaseServings: 2,
    sourceIngredientSort: 1,
    sourceFacts: [
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
    ]
  }];
  (service as any).assertShoppingListOwner = async () => ({ ownerUserId: 9, status: "ACTIVE" });
  (service as any).assertStorageWritable = async () => undefined;
  (service as any).bindMealPlanShoppingList = async () => undefined;

  await (service as any).syncPlanShoppingGapInTransaction(tx, 9, 501, "10001", 602);

  assert.equal(creates.length, 2);
  assert.deepEqual(creates.map(item => item.sourceKey), [
    "501:ingredient:7:EXACT:1:r1001:v2001:i1",
    "501:ingredient:7:EXACT:1:r1002:v2002:i2"
  ]);
});

test("meal plan can rebind to a new list after its previous list is completed", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const tx = {
    $queryRaw: async () => [],
    mealPlanItem: {
      findFirst: async () => ({ id: 501, shoppingListId: 601 }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return {};
      }
    },
    shoppingList: {
      findUnique: async ({ where }: { where: { id: number } }) => ({
        status: where.id === 601 ? "COMPLETED" : "ACTIVE"
      })
    }
  };
  const service = createService();

  await (service as any).bindMealPlanShoppingList(tx, 9, 501, 602);

  assert.deepEqual(updates, [{ shoppingListId: 602 }]);
});
