import type { Prisma } from "@prisma/client";

export const nutritionSourceVersion = "2026-08-22-primary-subset-v1";

export function buildNutritionFoodWhere(search: string | undefined, category: string | undefined): Prisma.NutrientFoodWhereInput {
  return {
    sourceVersion: nutritionSourceVersion,
    ...(category ? { category } : {}),
    ...(search ? { OR: [{ sourceFoodCode: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] } : {})
  };
}

export function buildNutritionSnapshotDeleteWhere(recipeVersionIds: number[]): Prisma.RecipeNutritionSnapshotWhereInput {
  return {
    sourceVersion: nutritionSourceVersion,
    source: "AUTO",
    isLocked: false,
    recipeVersionId: { in: recipeVersionIds }
  };
}

export function buildNutritionDerivedInvalidationWhere(sourceVersion: string): Prisma.RecipeNutritionSnapshotWhereInput {
  return {
    sourceVersion,
    source: "AUTO",
    isLocked: false
  };
}

export function normalizeNutritionSearch(value: string | undefined) {
  const text = value?.trim();
  return text ? text.slice(0, 80) : undefined;
}

export function normalizeNutritionCategory(value: string | undefined) {
  const text = value?.trim();
  return text ? text.slice(0, 128) : undefined;
}

type NutritionFoodRow = {
  id: number;
  sourceFoodCode: string;
  name: string;
  edibleRate: number | null;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbohydrate: number | null;
  sourceVersion: string;
  category: string | null;
  englishName?: string | null;
};

export function toAdminNutritionFood(row: NutritionFoodRow) {
  return {
    id: row.id,
    foodCode: row.sourceFoodCode,
    foodName: row.name,
    englishName: row.englishName ?? null,
    category: row.category,
    edibleRate: row.edibleRate,
    calories: row.calories,
    protein: row.protein,
    fat: row.fat,
    carbohydrate: row.carbohydrate,
    sourceVersion: row.sourceVersion
  };
}
