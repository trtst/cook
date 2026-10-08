import assert from "node:assert/strict";
import test from "node:test";
import { HomeService } from "./home.service";

function recipeRow({ id, currentVersionId, isInspiration, inspirationCategoryId = null, title, ingredients }: {
  id: number;
  currentVersionId: number;
  isInspiration: boolean;
  inspirationCategoryId?: number | null;
  title: string;
  ingredients: Array<{ ingredientId: number; ingredientName: string; amount: { kind: "FUZZY"; text: string } }>;
}) {
  return {
    id,
    ownerId: isInspiration ? 9001 : 1001,
    title,
    coverImageUrl: null,
    isInspiration,
    inspirationCategoryId,
    currentVersionId,
    currentVersion: {
      difficulty: "EASY",
      duration: "WITHIN_15",
      ingredientsJson: ingredients,
      stepsJson: []
    }
  };
}

test("reading homepage fridge recommendations returns the same cached batch without advancing it", async () => {
  const now = new Date();
  const candidate = {
    recipeId: 101,
    title: "当前推荐",
    recipeVersionId: 201,
    matchedIngredientIds: [501],
    totalIngredientCount: 2
  };
  const recipe = recipeRow({
    id: 101,
    currentVersionId: 201,
    isInspiration: false,
    title: "当前推荐",
    ingredients: [{ ingredientId: 501, ingredientName: "鸡腿", amount: { kind: "FUZZY", text: "适量" } }]
  });
  let cache = {
    userId: 1001,
    activeIngredientIds: [501],
    activeExpiresAt: new Date(now.getTime() + 60_000),
    candidatePoolExpiresAt: new Date(now.getTime() + 60_000),
    candidatePool: [],
    currentCandidates: [candidate],
    cursorRecipeVersionId: 201,
    seenRecipeNames: ["当前推荐"],
    seenIngredientSets: [[501]],
    hasMore: true
  };
  let updates = 0;
  const tx = {
    $queryRaw: async () => [],
    homeFridgeRecommendationCache: {
      upsert: async () => cache,
      findUniqueOrThrow: async () => cache,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates += 1;
        cache = { ...cache, ...data };
        return cache;
      }
    },
    recipe: {
      findMany: async () => [recipe]
    }
  };
  const prisma = { $transaction: async (run: (client: typeof tx) => unknown) => run(tx) };
  const service = new HomeService(prisma as never, {} as never, {} as never);

  const first = await service.getFridgeRecipes(1001);
  const second = await service.getFridgeRecipes(1001);

  assert.deepEqual(second, first);
  assert.deepEqual(first.items.map(item => item.recipeId), [101]);
  assert.equal(updates, 0);
});

test("retrying the same homepage recommendation advance key does not skip another batch", async () => {
  const candidate = {
    recipeId: 101,
    title: "下一组菜谱",
    recipeVersionId: 201,
    matchedIngredientIds: [501],
    totalIngredientCount: 1
  };
  const moreCandidates = [102, 103].map(id => ({ ...candidate, recipeId: id, title: `下一组菜谱${id}`, recipeVersionId: id + 100 }));
  const recipe = recipeRow({
    id: 101,
    currentVersionId: 201,
    isInspiration: false,
    title: "下一组菜谱",
    ingredients: [{ ingredientId: 501, ingredientName: "鸡腿", amount: { kind: "FUZZY", text: "适量" } }]
  });
  let cache = {
    userId: 1001,
    activeIngredientIds: [501],
    activeExpiresAt: new Date(Date.now() + 60_000),
    candidatePoolExpiresAt: new Date(Date.now() + 60_000),
    candidatePool: [candidate, ...moreCandidates],
    currentCandidates: [],
    cursorRecipeVersionId: 201,
    seenRecipeNames: ["下一组菜谱"],
    seenIngredientSets: [[501]],
    hasMore: true
  };
  const idempotencyRecords = new Map<string, any>();
  let cacheUpdates = 0;
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async ({ where }: { where: { operationId: string } }) => idempotencyRecords.get(where.operationId) ?? null,
      create: async ({ data }: { data: any }) => {
        idempotencyRecords.set(data.operationId, data);
        return data;
      },
      updateMany: async ({ where, data }: { where: { operationId: string }, data: any }) => {
        idempotencyRecords.set(where.operationId, { ...idempotencyRecords.get(where.operationId), ...data });
        return { count: 1 };
      }
    },
    homeFridgeRecommendationCache: {
      upsert: async () => cache,
      findUniqueOrThrow: async () => cache,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        cacheUpdates += 1;
        cache = { ...cache, ...data };
        return cache;
      }
    },
    recipe: {
      findMany: async () => [recipe, ...moreCandidates.map(item => recipeRow({
        id: item.recipeId,
        currentVersionId: item.recipeVersionId,
        isInspiration: false,
        title: item.title,
        ingredients: [{ ingredientId: 501, ingredientName: "鸡腿", amount: { kind: "FUZZY", text: "适量" } }]
      }))]
    }
  };
  const prisma = { $transaction: async (run: (client: typeof tx) => unknown) => run(tx) };
  const service = new HomeService(prisma as never, {} as never, {} as never);

  const first = await service.nextFridgeRecipes(1001, "1234567890");
  const retried = await service.nextFridgeRecipes(1001, "1234567890");

  assert.deepEqual(retried, first);
  assert.deepEqual(first.items.map(item => item.recipeId), [101, 102, 103]);
  assert.equal(cacheUpdates, 1);
});

test("fridge matching maps historical merged ingredient links to the active target id", async () => {
  const recipe = recipeRow({
    id: 101,
    currentVersionId: 201,
    isInspiration: false,
    title: "归并食材菜谱",
    ingredients: [501, 900].map(ingredientId => ({
      ingredientId,
      ingredientName: "食材",
      amount: { kind: "FUZZY", text: "适量" }
    }))
  });
  const tx = {
    $queryRaw: async () => [{ recipeVersionId: 201 }],
    recipe: { findMany: async () => [recipe] },
    recipeVersionIngredient: {
      findMany: async () => [
        { recipeVersionId: 201, ingredientId: 501 },
        { recipeVersionId: 201, ingredientId: 900 }
      ]
    },
    ingredient: { findMany: async () => [{ id: 501, mergedToId: 900 }] }
  };
  const service = new HomeService({} as never, {} as never, {} as never);
  const batch = await (service as any).loadFridgeRecipeBatch(tx, 1001, [900], 0, 10);

  assert.deepEqual(batch.items[0]?.matchedIngredientIds, [900]);
  assert.equal(batch.items[0]?.totalIngredientCount, 1);
});
