import assert from "node:assert/strict";
import test from "node:test";
import { RecipeService } from "./recipe.service";

function createService() {
  return new RecipeService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
}

function buildContent() {
  return {
    name: "番茄炒蛋",
    story: null,
    categoryId: 1,
    inspirationCategoryId: null,
    sceneIds: [],
    originVersionId: null,
    originCoverImageUrl: null,
    coverUploadId: null,
    coverImageUrl: null,
    baseServings: 2,
    difficulty: "EASY",
    duration: "BETWEEN_15_30",
    tips: null,
    ingredients: [{
      ingredientId: 10000001,
      name: "番茄",
      quantity: "",
      unitId: null,
      fuzzyText: "适量",
      categoryId: 5001,
      defaultUnitId: 3005,
      source: "SYSTEM"
    }],
    steps: [{ slotKey: "step-1", text: "炒熟。", uploadId: null, imageUrl: null }]
  };
}

test("publishing accepts 适量 when the referenced ingredient is not SEASONING", async () => {
  const service = createService();
  const tx = {
    ingredient: {
      findMany: async () => [{
        id: 10000001,
        name: "番茄",
        ownerId: null,
        status: "ACTIVE",
        categoryId: 5001,
        category: { code: "PRODUCE" },
        defaultUnit: { id: 3005, name: "个", type: "COMMON", ownerId: null },
        mergedTo: null
      }]
    },
    unit: {
      findMany: async () => []
    }
  };

  const result = await (service as any).buildPublishedContent(tx, 1, buildContent());
  assert.deepEqual(result.ingredients[0]?.amount, { kind: "FUZZY", text: "适量" });
});

test("publishing accepts 适量 when the referenced ingredient is SEASONING", async () => {
  const service = createService();
  const tx = {
    ingredient: {
      findMany: async () => [{
        id: 10000002,
        name: "盐",
        ownerId: null,
        status: "ACTIVE",
        categoryId: 5006,
        category: { code: "SEASONING" },
        defaultUnit: { id: 3001, name: "克", type: "WEIGHT", ownerId: null },
        mergedTo: null
      }]
    },
    unit: {
      findMany: async () => []
    }
  };
  const content = buildContent();
  content.ingredients[0] = {
    ...content.ingredients[0],
    ingredientId: 10000002,
    name: "盐",
    categoryId: 5006,
    defaultUnitId: 3001
  };

  const result = await (service as any).buildPublishedContent(tx, 1, content);

  assert.deepEqual(result.ingredients[0]?.amount, { kind: "FUZZY", text: "适量" });
});
