import { loadLocalEnv } from "../src/common/load-env";
import type { RecipeContentSnapshot } from "../src/contracts/types";
import { primaryIngredientNutritionSeeds, recipeNutritionSourceVersion } from "../src/modules/recipe/recipe-nutrition-catalog";
import { buildRecipeNutritionPreview } from "../src/modules/recipe/recipe-nutrition";

loadLocalEnv();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const mappingRows = primaryIngredientNutritionSeeds.map(seed => ({
  ingredientId: seed.ingredientId,
  status: seed.status,
  nutrientFood: seed.nutrientFood
    ? {
        calories: seed.nutrientFood.calories,
        protein: seed.nutrientFood.protein,
        fat: seed.nutrientFood.fat,
        carbohydrate: seed.nutrientFood.carbohydrate
      }
    : null
}));

const conversionRows = primaryIngredientNutritionSeeds.flatMap(seed =>
  seed.conversions.map(conversion => ({
    ingredientId: seed.ingredientId,
    unitId: conversion.unitId,
    gramsPerUnit: conversion.gramsPerUnit
  }))
);

const completeRecipe: RecipeContentSnapshot = {
  name: "营养验收-完整",
  story: null,
  baseServings: 4,
  difficulty: "EASY",
  duration: "BETWEEN_30_60",
  estimatedCalories: null,
  tips: null,
  ingredients: [
    {
      ingredientId: 4020,
      ingredientName: "莲藕",
      source: "SYSTEM",
      categoryId: 5001,
      amount: { kind: "EXACT", quantity: "400", unitId: 3001, unitName: "克", unitType: "WEIGHT" }
    },
    {
      ingredientId: 4025,
      ingredientName: "排骨",
      source: "SYSTEM",
      categoryId: 5002,
      amount: { kind: "EXACT", quantity: "500", unitId: 3001, unitName: "克", unitType: "WEIGHT" }
    },
    {
      ingredientId: 4016,
      ingredientName: "生姜",
      source: "SYSTEM",
      categoryId: 5001,
      amount: { kind: "EXACT", quantity: "20", unitId: 3001, unitName: "克", unitType: "WEIGHT" }
    }
  ],
  steps: [{ text: "验证完整营养快照" }]
};

const estimatedRecipe: RecipeContentSnapshot = {
  name: "营养验收-估算",
  story: null,
  baseServings: 2,
  difficulty: "BEGINNER",
  duration: "WITHIN_15",
  estimatedCalories: null,
  tips: null,
  ingredients: [
    {
      ingredientId: 4001,
      ingredientName: "番茄",
      source: "SYSTEM",
      categoryId: 5001,
      amount: { kind: "EXACT", quantity: "2", unitId: 3007, unitName: "个", unitType: "COMMON" }
    },
    {
      ingredientId: 4002,
      ingredientName: "鸡蛋",
      source: "SYSTEM",
      categoryId: 5002,
      amount: { kind: "EXACT", quantity: "3", unitId: 3007, unitName: "个", unitType: "COMMON" }
    },
    {
      ingredientId: 4005,
      ingredientName: "青椒",
      source: "SYSTEM",
      categoryId: 5001,
      amount: { kind: "EXACT", quantity: "2", unitId: 3007, unitName: "个", unitType: "COMMON" }
    }
  ],
  steps: [{ text: "验证估算态营养快照" }]
};

const insufficientRecipe: RecipeContentSnapshot = {
  name: "营养验收-不足",
  story: null,
  baseServings: 2,
  difficulty: "BEGINNER",
  duration: "WITHIN_15",
  estimatedCalories: null,
  tips: null,
  ingredients: [
    {
      ingredientId: 999001,
      ingredientName: "自定义食材",
      source: "PERSONAL",
      categoryId: 5009,
      amount: { kind: "FUZZY", text: "适量" }
    }
  ],
  steps: [{ text: "验证不足态营养快照" }]
};

function main() {
  const complete = buildRecipeNutritionPreview(completeRecipe, recipeNutritionSourceVersion, mappingRows, conversionRows);
  const estimated = buildRecipeNutritionPreview(estimatedRecipe, recipeNutritionSourceVersion, mappingRows, conversionRows);
  const insufficient = buildRecipeNutritionPreview(insufficientRecipe, recipeNutritionSourceVersion, mappingRows, conversionRows);

  assert(complete.status === "COMPLETE", `expected COMPLETE, got ${complete.status}`);
  assert(complete.perRecipe?.calories !== null, "complete recipe should expose calories");
  assert(estimated.status === "ESTIMATED", `expected ESTIMATED, got ${estimated.status}`);
  assert(estimated.perRecipe?.protein !== null, "estimated recipe should still expose partial metrics");
  assert(insufficient.status === "INSUFFICIENT", `expected INSUFFICIENT, got ${insufficient.status}`);
  assert(insufficient.perRecipe === null, "insufficient recipe should not expose fake metrics");

  console.log(
    JSON.stringify(
      {
        sourceVersion: recipeNutritionSourceVersion,
        complete,
        estimated,
        insufficient
      },
      null,
      2
    )
  );
}

main();
