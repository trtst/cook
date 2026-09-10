import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadLocalEnv } from "../src/common/load-env";
import { recipeNutritionSourceRepo, recipeNutritionSourceVersion } from "../src/modules/recipe/recipe-nutrition-catalog";
import { parseNutritionCsvText } from "../src/modules/admin/nutrition-import";
import { buildNutritionDerivedInvalidationWhere } from "../src/modules/admin/nutrition-admin";

loadLocalEnv();
const prisma = new PrismaClient();
const input = resolve(process.argv[2] ?? resolve(__dirname, "../data/nutrition/food_composition_primary.csv"));
const sourcePath = "data/nutrition/food_composition_primary.csv";

async function main() {
  const rows = parseNutritionCsvText(await readFile(input, "utf8"));
  const foodCodes = rows.map(row => row.foodCode);
  const result = await prisma.$transaction(async tx => {
    const batch = await tx.nutrientSourceBatch.upsert({
      where: { sourceRepo_sourceVersion_sourcePath: { sourceRepo: recipeNutritionSourceRepo, sourceVersion: recipeNutritionSourceVersion, sourcePath } },
      update: { importedAt: new Date() },
      create: { sourceRepo: recipeNutritionSourceRepo, sourceVersion: recipeNutritionSourceVersion, sourcePath }
    });
    const staleFoods = await tx.nutrientFood.findMany({ where: { sourceVersion: recipeNutritionSourceVersion, sourceFoodCode: { notIn: foodCodes } }, select: { id: true } });
    if (staleFoods.length) {
      const staleIds = staleFoods.map(item => item.id);
      await tx.ingredientNutrientMapping.updateMany({ where: { sourceVersion: recipeNutritionSourceVersion, nutrientFoodId: { in: staleIds } }, data: { nutrientFoodId: null, status: "UNMAPPED", matchType: "MANUAL", confidence: null } });
      await tx.nutrientFood.deleteMany({ where: { id: { in: staleIds } } });
    }
    await tx.nutrientSourceFood.deleteMany({ where: { batchId: batch.id, sourceFoodCode: { notIn: foodCodes } } });
    for (const row of rows) {
      const rawJson = row.raw;
      await tx.nutrientSourceFood.upsert({ where: { batchId_sourceFoodCode: { batchId: batch.id, sourceFoodCode: row.foodCode } }, update: { sourceName: row.foodName, rawJson }, create: { batchId: batch.id, sourceFoodCode: row.foodCode, sourceName: row.foodName, rawJson } });
      await tx.nutrientFood.upsert({
        where: { sourceVersion_sourceFoodCode: { sourceVersion: recipeNutritionSourceVersion, sourceFoodCode: row.foodCode } },
        update: { name: row.foodName, category: row.category, edibleRate: row.edible, calories: row.energyKCal, protein: row.protein, fat: row.fat, carbohydrate: row.CHO },
        create: { sourceFoodCode: row.foodCode, name: row.foodName, category: row.category, edibleRate: row.edible, calories: row.energyKCal, protein: row.protein, fat: row.fat, carbohydrate: row.CHO, sourceVersion: recipeNutritionSourceVersion }
      });
    }
    await tx.recipeNutritionSnapshot.deleteMany({ where: buildNutritionDerivedInvalidationWhere(recipeNutritionSourceVersion) });
    await tx.recipeCompletenessSnapshot.deleteMany({ where: { sourceVersion: recipeNutritionSourceVersion } });
    return { staleFoodCount: staleFoods.length };
  });
  console.log(JSON.stringify({ sourceVersion: recipeNutritionSourceVersion, rows: rows.length, sourcePath, ...result }));
}

void main().finally(() => prisma.$disconnect());
