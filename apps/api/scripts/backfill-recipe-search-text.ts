import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import type { RecipeDraftContentInput, UUID } from "../src/contracts/types";
import { buildDraftSearchText, buildRecipeSearchText, fromJson, versionToContent } from "../src/modules/recipe/recipe-content";

loadLocalEnv();

const prisma = new PrismaClient();

function hasApplyFlag() {
  return process.argv.includes("--apply");
}

function readNumberFlag(name: string) {
  const prefix = `${name}=`;
  const raw = process.argv.find(item => item.startsWith(prefix));
  if (!raw) return null;
  const value = Number(raw.slice(prefix.length));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

async function loadIngredientAliasMap(ingredientIds: Array<UUID | null | undefined>) {
  const ids = Array.from(new Set(ingredientIds.filter((item): item is UUID => typeof item === "number" && item > 0)));
  if (!ids.length) return new Map<UUID, string[]>();
  const rows = await prisma.ingredient.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      aliases: true,
      mergedTo: {
        select: {
          id: true,
          aliases: true
        }
      }
    }
  });
  const aliasMap = new Map<UUID, string[]>();
  rows.forEach(row => {
    const resolved = row.mergedTo ?? row;
    aliasMap.set(row.id, resolved.aliases);
    aliasMap.set(resolved.id, resolved.aliases);
  });
  return aliasMap;
}

async function backfillDrafts(apply: boolean, batchSize: number, limit: number | null) {
  let cursorId = 0;
  let scannedCount = 0;
  let changedCount = 0;
  let updatedCount = 0;
  const sampleIds: number[] = [];

  while (true) {
    const remaining = limit ? Math.max(limit - scannedCount, 0) : batchSize;
    if (limit && remaining === 0) break;
    const drafts = await prisma.recipeDraft.findMany({
      where: { id: { gt: cursorId } },
      orderBy: { id: "asc" },
      take: Math.min(batchSize, remaining || batchSize),
      select: {
        id: true,
        searchText: true,
        contentJson: true
      }
    });
    if (!drafts.length) break;

    for (const draft of drafts) {
      scannedCount += 1;
      cursorId = draft.id;
      const content = fromJson<RecipeDraftContentInput>(draft.contentJson);
      const aliasMap = await loadIngredientAliasMap(content.ingredients.map(item => item.ingredientId));
      const nextSearchText = buildDraftSearchText(content, aliasMap);
      if (nextSearchText === draft.searchText) continue;
      changedCount += 1;
      if (sampleIds.length < 20) sampleIds.push(draft.id);
      if (!apply) continue;
      await prisma.recipeDraft.update({
        where: { id: draft.id },
        data: { searchText: nextSearchText }
      });
      updatedCount += 1;
    }
  }

  return { scannedCount, changedCount, updatedCount, sampleIds };
}

async function backfillVersions(apply: boolean, batchSize: number, limit: number | null) {
  let cursorId = 0;
  let scannedCount = 0;
  let changedCount = 0;
  let updatedCount = 0;
  const sampleIds: number[] = [];

  while (true) {
    const remaining = limit ? Math.max(limit - scannedCount, 0) : batchSize;
    if (limit && remaining === 0) break;
    const versions = await prisma.recipeContentVersion.findMany({
      where: { id: { gt: cursorId } },
      orderBy: { id: "asc" },
      take: Math.min(batchSize, remaining || batchSize),
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
        stepsJson: true,
        searchText: true
      }
    });
    if (!versions.length) break;

    for (const version of versions) {
      scannedCount += 1;
      cursorId = version.id;
      const content = versionToContent(version);
      const aliasMap = await loadIngredientAliasMap(content.ingredients.map(item => item.ingredientId));
      const nextSearchText = buildRecipeSearchText(content, aliasMap);
      if (nextSearchText === version.searchText) continue;
      changedCount += 1;
      if (sampleIds.length < 20) sampleIds.push(version.id);
      if (!apply) continue;
      await prisma.recipeContentVersion.update({
        where: { id: version.id },
        data: { searchText: nextSearchText }
      });
      updatedCount += 1;
    }
  }

  return { scannedCount, changedCount, updatedCount, sampleIds };
}

async function backfillRecipes(apply: boolean, batchSize: number, limit: number | null) {
  let cursorId = 0;
  let scannedCount = 0;
  let changedCount = 0;
  let updatedCount = 0;
  const sampleIds: number[] = [];

  while (true) {
    const remaining = limit ? Math.max(limit - scannedCount, 0) : batchSize;
    if (limit && remaining === 0) break;
    const recipes = await prisma.recipe.findMany({
      where: { id: { gt: cursorId } },
      orderBy: { id: "asc" },
      take: Math.min(batchSize, remaining || batchSize),
      select: {
        id: true,
        searchText: true,
        currentVersion: {
          select: {
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
      scannedCount += 1;
      cursorId = recipe.id;
      const content = versionToContent(recipe.currentVersion);
      const aliasMap = await loadIngredientAliasMap(content.ingredients.map(item => item.ingredientId));
      const nextSearchText = buildRecipeSearchText(content, aliasMap);
      if (nextSearchText === recipe.searchText) continue;
      changedCount += 1;
      if (sampleIds.length < 20) sampleIds.push(recipe.id);
      if (!apply) continue;
      await prisma.recipe.update({
        where: { id: recipe.id },
        data: { searchText: nextSearchText }
      });
      updatedCount += 1;
    }
  }

  return { scannedCount, changedCount, updatedCount, sampleIds };
}

async function main() {
  const apply = hasApplyFlag();
  const batchSize = readNumberFlag("--batch-size") ?? 100;
  const limit = readNumberFlag("--limit");
  const [drafts, versions, recipes] = await Promise.all([
    backfillDrafts(apply, batchSize, limit),
    backfillVersions(apply, batchSize, limit),
    backfillRecipes(apply, batchSize, limit)
  ]);

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        batchSize,
        limit,
        drafts,
        versions,
        recipes,
        nextStep: apply ? null : "Re-run with --apply to persist alias-aware recipe search text for historical drafts, versions, and recipes."
      },
      null,
      2
    )
  );
}

void main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
