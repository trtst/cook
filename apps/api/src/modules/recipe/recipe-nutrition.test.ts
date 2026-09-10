import assert from "node:assert/strict";
import test from "node:test";
import { canReuseRecipeNutritionSnapshot, loadRecipeNutritionSummary, recipeNutritionSnapshotWhere } from "./recipe-nutrition";

test("nutrition regeneration is keyed by recipe version, not source version", () => {
  assert.deepEqual(recipeNutritionSnapshotWhere(274), { recipeVersionId: 274 });
});

test("nutrition snapshot is reused only when its source version is current", () => {
  assert.equal(canReuseRecipeNutritionSnapshot("source-v1", "source-v1"), true);
  assert.equal(canReuseRecipeNutritionSnapshot("source-v1", "source-v2"), false);
});

test("nutrition summary is calculated from ingredient mappings and persisted for a recipe version", async () => {
  const upserts: Array<Record<string, unknown>> = [];
  const tx = {
    nutrientSourceBatch: {
      findFirst: async () => ({ sourceVersion: "nutrient-v1" })
    },
    recipeNutritionSnapshot: {
      findUnique: async () => null,
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        upserts.push(create);
        return {
          ...create,
          calculatedAt: new Date("2026-09-09T00:00:00.000Z")
        };
      }
    },
    ingredientNutrientMapping: {
      findMany: async () => [{
        ingredientId: 321,
        status: "CONFIRMED",
        nutrientFood: { calories: 100, protein: 20, fat: 3, carbohydrate: 5 }
      }]
    },
    ingredientUnitNutrientConversion: {
      findMany: async () => [{ ingredientId: 321, unitId: 3, gramsPerUnit: 1 }]
    }
  };
  const summary = await loadRecipeNutritionSummary(tx as never, 901, {
    name: "测试菜谱",
    story: "测试介绍",
    baseServings: 2,
    difficulty: "EASY",
    duration: "BETWEEN_15_30",
    estimatedCalories: null,
    tips: "测试建议",
    keywords: [],
    tools: [{ name: "炒锅" }],
    ingredients: [{
      ingredientId: 321,
      ingredientName: "新食材",
      source: "SYSTEM",
      categoryId: 777,
      amount: { kind: "EXACT", quantity: "100", unitId: 3, unitName: "克", unitType: "WEIGHT" }
    }],
    steps: [{ text: "完成。", imageUrl: null }]
  });

  assert.equal(summary.status, "COMPLETE");
  assert.equal(summary.perServing?.calories, 50);
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0]?.sourceVersion, "nutrient-v1");
});
