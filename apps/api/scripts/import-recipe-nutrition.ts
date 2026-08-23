import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import {
  primaryIngredientNutritionSeeds,
  recipeNutritionSourceRepo,
  recipeNutritionSourceVersion
} from "../src/modules/recipe/recipe-nutrition-catalog";

loadLocalEnv();

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

function groupSourceSeeds() {
  const groups = new Map<string, typeof primaryIngredientNutritionSeeds>();
  for (const seed of primaryIngredientNutritionSeeds) {
    if (!seed.nutrientFood) continue;
    const current = groups.get(seed.nutrientFood.sourcePath) ?? [];
    current.push(seed);
    groups.set(seed.nutrientFood.sourcePath, current);
  }
  return groups;
}

async function main() {
  const sourceGroups = groupSourceSeeds();
  const confirmedCount = primaryIngredientNutritionSeeds.filter(item => item.status === "CONFIRMED").length;
  const candidateCount = primaryIngredientNutritionSeeds.filter(item => item.status !== "CONFIRMED").length;
  const conversionCount = primaryIngredientNutritionSeeds.reduce((total, item) => total + item.conversions.length, 0);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          sourceRepo: recipeNutritionSourceRepo,
          sourceVersion: recipeNutritionSourceVersion,
          sourcePathCount: sourceGroups.size,
          confirmedCount,
          candidateCount,
          conversionCount
        },
        null,
        2
      )
    );
    return;
  }

  const nutrientFoodIdMap = new Map<string, number>();

  for (const [sourcePath, items] of sourceGroups) {
    const batch = await prisma.nutrientSourceBatch.upsert({
      where: {
        sourceRepo_sourceVersion_sourcePath: {
          sourceRepo: recipeNutritionSourceRepo,
          sourceVersion: recipeNutritionSourceVersion,
          sourcePath
        }
      },
      update: {
        importedAt: new Date()
      },
      create: {
        sourceRepo: recipeNutritionSourceRepo,
        sourceVersion: recipeNutritionSourceVersion,
        sourcePath
      }
    });

    for (const item of items) {
      const nutrientFood = item.nutrientFood!;
      await prisma.nutrientSourceFood.upsert({
        where: {
          batchId_sourceFoodCode: {
            batchId: batch.id,
            sourceFoodCode: nutrientFood.sourceFoodCode
          }
        },
        update: {
          sourceName: nutrientFood.sourceFoodName,
          rawJson: nutrientFood
        },
        create: {
          batchId: batch.id,
          sourceFoodCode: nutrientFood.sourceFoodCode,
          sourceName: nutrientFood.sourceFoodName,
          rawJson: nutrientFood
        }
      });

      const savedFood = await prisma.nutrientFood.upsert({
        where: {
          sourceVersion_sourceFoodCode: {
            sourceVersion: recipeNutritionSourceVersion,
            sourceFoodCode: nutrientFood.sourceFoodCode
          }
        },
        update: {
          name: nutrientFood.sourceFoodName,
          edibleRate: nutrientFood.edibleRate,
          calories: nutrientFood.calories,
          protein: nutrientFood.protein,
          fat: nutrientFood.fat,
          carbohydrate: nutrientFood.carbohydrate
        },
        create: {
          sourceFoodCode: nutrientFood.sourceFoodCode,
          name: nutrientFood.sourceFoodName,
          edibleRate: nutrientFood.edibleRate,
          calories: nutrientFood.calories,
          protein: nutrientFood.protein,
          fat: nutrientFood.fat,
          carbohydrate: nutrientFood.carbohydrate,
          sourceVersion: recipeNutritionSourceVersion
        }
      });
      nutrientFoodIdMap.set(nutrientFood.sourceFoodCode, savedFood.id);
    }
  }

  for (const seed of primaryIngredientNutritionSeeds) {
    const nutrientFoodId = seed.nutrientFood ? nutrientFoodIdMap.get(seed.nutrientFood.sourceFoodCode) ?? null : null;
    await prisma.ingredientNutrientMapping.upsert({
      where: {
        ingredientId_sourceVersion: {
          ingredientId: seed.ingredientId,
          sourceVersion: recipeNutritionSourceVersion
        }
      },
      update: {
        nutrientFoodId,
        status: seed.status,
        matchType: seed.matchType,
        confidence: seed.confidence
      },
      create: {
        ingredientId: seed.ingredientId,
        nutrientFoodId,
        status: seed.status,
        matchType: seed.matchType,
        confidence: seed.confidence,
        sourceVersion: recipeNutritionSourceVersion
      }
    });

    for (const conversion of seed.conversions) {
      await prisma.ingredientUnitNutrientConversion.upsert({
        where: {
          ingredientId_unitId_sourceVersion: {
            ingredientId: seed.ingredientId,
            unitId: conversion.unitId,
            sourceVersion: recipeNutritionSourceVersion
          }
        },
        update: {
          gramsPerUnit: conversion.gramsPerUnit
        },
        create: {
          ingredientId: seed.ingredientId,
          unitId: conversion.unitId,
          gramsPerUnit: conversion.gramsPerUnit,
          sourceVersion: recipeNutritionSourceVersion
        }
      });
    }
  }

  await prisma.recipeNutritionSnapshot.deleteMany({
    where: {
      sourceVersion: recipeNutritionSourceVersion
    }
  });

  console.log(
    JSON.stringify(
      {
        sourceRepo: recipeNutritionSourceRepo,
        sourceVersion: recipeNutritionSourceVersion,
        sourcePathCount: sourceGroups.size,
        confirmedCount,
        candidateCount,
        conversionCount,
        clearedSnapshotCount: true
      },
      null,
      2
    )
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
