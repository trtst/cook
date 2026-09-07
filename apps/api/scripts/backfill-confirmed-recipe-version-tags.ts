import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { versionToContent } from "../src/modules/recipe/recipe-content";
import { isActiveCurrentVersion } from "../src/modules/recipe/recipe-version-tag-backfill";
import { replaceAutoRecipeVersionTags } from "../src/modules/recipe/recipe-version-tags";

loadLocalEnv();

const prisma = new PrismaClient();

function hasApplyFlag() {
  return process.argv.includes("--apply");
}

function readBatchSize() {
  const raw = process.argv.find(item => item.startsWith("--batch-size="));
  if (!raw) return 100;
  const value = Number(raw.slice("--batch-size=".length));
  if (!Number.isInteger(value) || value <= 0) throw new Error("--batch-size must be a positive integer");
  return value;
}

async function main() {
  const apply = hasApplyFlag();
  const batchSize = readBatchSize();
  let cursorId = 0;
  let scannedRecipeCount = 0;
  let rebuiltVersionCount = 0;
  const sampleRecipeIds: number[] = [];

  while (true) {
    const recipes = await prisma.recipe.findMany({
      where: {
        status: "ACTIVE",
        id: { gt: cursorId }
      },
      orderBy: { id: "asc" },
      take: batchSize,
      select: {
        id: true,
        status: true,
        currentVersion: {
          select: {
            id: true,
            name: true,
            story: true,
            baseServings: true,
            difficulty: true,
            duration: true,
            estimatedCalories: true,
            tips: true,
            ingredientsJson: true,
            stepsJson: true
          }
        }
      }
    });
    if (!recipes.length) break;

    for (const recipe of recipes) {
      cursorId = recipe.id;
      if (!isActiveCurrentVersion(recipe.status, recipe.currentVersion.id, recipe.currentVersion.id)) continue;
      scannedRecipeCount += 1;
      if (sampleRecipeIds.length < 20) sampleRecipeIds.push(recipe.id);
      if (!apply) continue;

      await prisma.$transaction(async tx => {
        await replaceAutoRecipeVersionTags(tx, recipe.currentVersion.id, versionToContent(recipe.currentVersion));
      });
      rebuiltVersionCount += 1;
    }
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    scope: "ACTIVE recipes and their currentVersion only",
    scannedRecipeCount,
    rebuiltVersionCount,
    sampleRecipeIds,
    nextStep: apply ? "Run verify:random-candidate-coverage before release." : "Re-run with --apply to rebuild active current versions."
  }, null, 2));
}

void main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
