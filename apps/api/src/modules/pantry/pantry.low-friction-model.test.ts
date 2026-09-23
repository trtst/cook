import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInventoryUsageSummary,
  classifyRecipeIngredientGap,
  mergeRecipeConsumptionLines,
  type RecipeConsumptionLine
} from "./pantry.low-friction-model";

test("classifies exact enough, exact shortage, unknown stock, and missing separately", () => {
  assert.equal(classifyRecipeIngredientGap({
    required: "500",
    unitId: 1,
    exactStock: "800",
    exactStockUnitId: 1,
    hasRoughStock: false
  }), "READY");
  assert.equal(classifyRecipeIngredientGap({
    required: "500",
    unitId: 1,
    exactStock: "300",
    exactStockUnitId: 1,
    hasRoughStock: false
  }), "SHORTAGE");
  assert.equal(classifyRecipeIngredientGap({
    required: "500",
    unitId: 1,
    exactStock: null,
    exactStockUnitId: null,
    hasRoughStock: true
  }), "UNKNOWN");
  assert.equal(classifyRecipeIngredientGap({
    required: "500",
    unitId: 1,
    exactStock: null,
    exactStockUnitId: null,
    hasRoughStock: false
  }), "MISSING");
});

function exactLine(overrides: Partial<RecipeConsumptionLine>): RecipeConsumptionLine {
  return {
    ingredientKey: "egg",
    ingredientId: 7,
    ingredientName: "鸡蛋",
    unitId: 1,
    quantity: "1",
    recipeTitle: "番茄炒蛋",
    recipeVersionId: 20,
    precision: "EXACT",
    ...overrides
  };
}

test("merges exact lines by ingredient and unit while keeping recipe sources", () => {
  const result = mergeRecipeConsumptionLines([
    exactLine({ quantity: "2" }),
    exactLine({ quantity: "1", recipeTitle: "紫菜蛋花汤", recipeVersionId: 21 }),
    exactLine({ ingredientKey: "egg", unitId: 2, quantity: "3", recipeTitle: "茶叶蛋" }),
    exactLine({ ingredientKey: "salt", ingredientId: 8, ingredientName: "盐", quantity: "1", recipeTitle: "番茄炒蛋", precision: "FUZZY" })
  ]);

  assert.deepEqual(result.exactLines, [
    {
      ingredientKey: "egg",
      ingredientId: 7,
      quantity: "3",
      unitId: 1,
      sources: [
        { recipeTitle: "番茄炒蛋", recipeVersionId: 20 },
        { recipeTitle: "紫菜蛋花汤", recipeVersionId: 21 }
      ]
    },
    {
      ingredientKey: "egg",
      ingredientId: 7,
      quantity: "3",
      unitId: 2,
      sources: [{ recipeTitle: "茶叶蛋", recipeVersionId: 20 }]
    }
  ]);
  assert.deepEqual(result.skippedFuzzySources, ["盐"]);
});

test("builds a concise usage summary from exact, rough, shortage, and fuzzy results", () => {
  assert.deepEqual(buildInventoryUsageSummary({
    updatedCount: 4,
    unknownCount: 2,
    shortageCount: 1,
    skippedFuzzyCount: 1
  }), {
    updatedCount: 4,
    unknownCount: 2,
    shortageCount: 1,
    skippedFuzzyCount: 1,
    message: "已按菜谱用量估算，更新 4 项，其中 2 项数量未记录、1 项库存不足、1 项适量未扣减"
  });
});
