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

test("home fridge recipes rank confirmed primary ingredient hit rate before hit count", async () => {
  const recipeWithFullHitRate = recipeRow({
    id: 101,
    currentVersionId: 201,
    isInspiration: false,
    title: "全命中菜谱",
    ingredients: [501, 700, 701].map(ingredientId => ({ ingredientId, ingredientName: "食材", amount: { kind: "FUZZY", text: "适量" } }))
  });
  const recipeWithMoreHits = recipeRow({
    id: 102,
    currentVersionId: 202,
    isInspiration: false,
    title: "主料命中更多的菜谱",
    ingredients: [501, 502, 503, 700].map(ingredientId => ({ ingredientId, ingredientName: "食材", amount: { kind: "FUZZY", text: "适量" } }))
  });
  const recipeWithStableTieBreak = recipeRow({
    id: 104,
    currentVersionId: 204,
    isInspiration: false,
    title: "同命中率菜谱",
    ingredients: [501, 502, 503].map(ingredientId => ({ ingredientId, ingredientName: "食材", amount: { kind: "FUZZY", text: "适量" } }))
  });
  const recipeForNextPage = recipeRow({
    id: 103,
    currentVersionId: 203,
    isInspiration: false,
    title: "下一页菜谱",
    ingredients: [501, 503, 504].map(ingredientId => ({ ingredientId, ingredientName: "食材", amount: { kind: "FUZZY", text: "适量" } }))
  });
  const confirmedTags = [
    { recipeVersionId: 201, tagValue: "501" },
    { recipeVersionId: 201, tagValue: "501" },
    { recipeVersionId: 202, tagValue: "501" },
    { recipeVersionId: 202, tagValue: "502" },
    { recipeVersionId: 202, tagValue: "503" },
    { recipeVersionId: 203, tagValue: "501" },
    { recipeVersionId: 203, tagValue: "503" },
    { recipeVersionId: 203, tagValue: "504" },
    { recipeVersionId: 204, tagValue: "501" },
    { recipeVersionId: 204, tagValue: "502" },
    { recipeVersionId: 204, tagValue: "503" }
  ];
  const capturedQueries: { fridge?: any; tags: any[]; recipes?: any } = { tags: [] };
  const prisma = {
    fridgeTrace: {
      findMany: async (args: any) => {
        capturedQueries.fridge = args;
        return [
          { ingredientId: 501, kind: "MANUAL_PRESENT", createdAt: new Date(), categoryName: null, categoryCode: null, ingredient: null },
          { ingredientId: 502, kind: "PURCHASED", createdAt: new Date(), categoryName: null, categoryCode: null, ingredient: null }
        ];
      }
    },
    recipeVersionTag: {
      findMany: async (args: any) => {
        capturedQueries.tags.push(args);
        return args.where.recipeVersionId
          ? confirmedTags.filter(tag => args.where.recipeVersionId.in.includes(tag.recipeVersionId))
          : confirmedTags.filter(tag => ["501", "502"].includes(tag.tagValue));
      }
    },
    recipe: {
      findMany: async (args: any) => {
        if (args.where.originVersionId) return [];
        capturedQueries.recipes = args;
        return [recipeWithFullHitRate, recipeWithMoreHits, recipeWithStableTieBreak, recipeForNextPage];
      }
    }
  };
  const service = new HomeService(prisma as never, {} as never, {} as never);

  const result = await service.getFridgeRecipes(1001);

  assert.deepEqual(result.items.map(item => item.recipeId), [101, 104, 102]);
  assert.equal(result.items[0]?.matchedIngredientCount, 1);
  assert.equal(result.items[0]?.totalIngredientCount, 1);
  assert.equal(result.hasNext, true);
  assert.ok(capturedQueries.fridge?.where.createdAt.gte instanceof Date);
  assert.ok(capturedQueries.fridge.where.createdAt.gte.getTime() >= Date.now() - 15 * 24 * 60 * 60 * 1000 - 1000);
  assert.ok(capturedQueries.tags.every(query => query.where.status === "CONFIRMED"));
  assert.deepEqual(capturedQueries.recipes?.select.currentVersion.select, { difficulty: true, duration: true });

  const nextPage = await service.getFridgeRecipes(1001, 2);
  assert.deepEqual(nextPage.items.map(item => item.recipeId), [103]);
  assert.equal(nextPage.hasNext, false);
});

test("home fridge recipes keep the owned copy instead of its inspiration source", async () => {
  const inspiration = recipeRow({
    id: 101,
    currentVersionId: 201,
    isInspiration: true,
    inspirationCategoryId: 301,
    title: "灵感菜谱",
    ingredients: [{ ingredientId: 501, ingredientName: "鸡腿", amount: { kind: "FUZZY", text: "适量" } }]
  });
  const owned = recipeRow({
    id: 102,
    currentVersionId: 202,
    isInspiration: false,
    title: "我的菜谱",
    ingredients: [{ ingredientId: 501, ingredientName: "鸡腿", amount: { kind: "FUZZY", text: "适量" } }]
  });
  const tags = [
    { recipeVersionId: 201, tagValue: "501" },
    { recipeVersionId: 202, tagValue: "501" }
  ];
  const prisma = {
    fridgeTrace: {
      findMany: async () => [
        { ingredientId: 501, kind: "MANUAL_PRESENT", createdAt: new Date(), categoryName: null, categoryCode: null, ingredient: null }
      ]
    },
    recipeVersionTag: {
      findMany: async (args: { where: { recipeVersionId?: { in: number[] } } }) =>
        args.where.recipeVersionId ? tags.filter(tag => args.where.recipeVersionId?.in.includes(tag.recipeVersionId)) : tags
    },
    recipe: {
      findMany: async (args: { where: { originVersionId?: { in: number[] } } }) =>
        args.where.originVersionId ? [{ id: owned.id, originVersionId: inspiration.currentVersionId }] : [inspiration, owned]
    }
  };
  const service = new HomeService(prisma as never, {} as never, {} as never);

  const result = await service.getFridgeRecipes(1001);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.kind, "MY");
  assert.equal(result.items[0]?.recipeId, owned.id);
});
