import { PrismaClient } from "@prisma/client";
import type { RecipeDraftContentInput, RecipeImportRawBody, RecipeImportRecipeBody } from "../src/contracts/types";
import { rebuildItemState } from "../src/modules/admin/recipe-import-markdown";
import {
  buildDraftSearchText,
  buildRecipeSearchText,
  buildSearchKey,
  contentSizeBytes,
  draftSizeBytes,
  fromJson,
  toJson,
  versionToContent
} from "../src/modules/recipe/recipe-content";

const prisma = new PrismaClient();

const legacySystemUnitNames = ["斤", "两", "只", "颗", "根", "块", "片", "把", "条", "张", "节", "朵", "串", "段", "撮", "勺", "茶匙", "碗", "杯", "袋", "份"] as const;

type LegacyUnitUsage = {
  id: number;
  name: string;
};

type RecipeIngredientRow = {
  unitId?: unknown;
  unitName?: unknown;
  unitType?: unknown;
  defaultUnitId?: unknown;
  amount?:
    | {
        kind?: unknown;
        unitId?: unknown;
        unitName?: unknown;
        unitType?: unknown;
      }
    | null;
};

function readDraftIngredients(value: unknown) {
  const content = fromJson<Partial<RecipeDraftContentInput>>(value);
  return Array.isArray(content.ingredients) ? content.ingredients : [];
}

function hasLegacyDraftUnit(item: { unitId?: unknown; defaultUnitId?: unknown }, legacyUnitIdSet: Set<number>) {
  return legacyUnitIdSet.has((item.unitId as number) ?? -1) || legacyUnitIdSet.has((item.defaultUnitId as number) ?? -1);
}

function hasLegacyRecipeUnit(item: unknown, legacyUnitIdSet: Set<number>) {
  if (!item || typeof item !== "object") return false;
  const row = item as RecipeIngredientRow;
  return (
    legacyUnitIdSet.has((row.unitId as number) ?? -1) ||
    legacyUnitIdSet.has((row.defaultUnitId as number) ?? -1) ||
    legacyUnitIdSet.has((row.amount?.unitId as number) ?? -1)
  );
}

function rewriteDraftContent(content: RecipeDraftContentInput, legacyUnitIdSet: Set<number>, gramUnitId: number) {
  let changedCount = 0;
  const nextContent: RecipeDraftContentInput = {
    ...content,
    ingredients: content.ingredients.map(item => {
      if (!hasLegacyDraftUnit(item, legacyUnitIdSet)) return item;
      changedCount += 1;
      return {
        ...item,
        unitId: gramUnitId,
        defaultUnitId: gramUnitId
      };
    })
  };
  return { nextContent, changedCount };
}

function rewriteVersionIngredients(items: unknown[], legacyUnitIdSet: Set<number>, gramUnit: { id: number; name: string; type: string }) {
  let changedCount = 0;
  const nextItems = items.map(item => {
    if (!hasLegacyRecipeUnit(item, legacyUnitIdSet)) return item;
    changedCount += 1;
    const row = item as RecipeIngredientRow;
    const nextRow: Record<string, unknown> = { ...(row as Record<string, unknown>) };
    if ("unitId" in nextRow) nextRow.unitId = gramUnit.id;
    if ("unitName" in nextRow) nextRow.unitName = gramUnit.name;
    if ("unitType" in nextRow) nextRow.unitType = gramUnit.type;
    if ("defaultUnitId" in nextRow) nextRow.defaultUnitId = gramUnit.id;
    if (row.amount && typeof row.amount === "object" && row.amount.kind === "EXACT") {
      nextRow.amount = {
        ...row.amount,
        unitId: gramUnit.id,
        unitName: gramUnit.name,
        unitType: gramUnit.type
      };
    }
    return nextRow;
  });
  return { nextItems, changedCount };
}

async function collectLegacyUnitUsage(): Promise<LegacyUnitUsage[]> {
  const units = await prisma.unit.findMany({
    where: {
      ownerId: null,
      name: { in: [...legacySystemUnitNames] }
    },
    select: {
      id: true,
      name: true
    },
    orderBy: { id: "asc" }
  });
  return units;
}

async function main() {
  const legacyUnits = await collectLegacyUnitUsage();
  const legacyUnitIds = legacyUnits.map(item => item.id);
  const legacyUnitIdSet = new Set(legacyUnitIds);
  const gramUnit = await prisma.unit.findFirst({
    where: {
      ownerId: null,
      searchKey: buildSearchKey("克")
    },
    select: {
      id: true,
      name: true,
      type: true
    }
  });
  if (!gramUnit) {
    throw new Error("系统单位“克”不存在，无法统一清理旧单位");
  }

  const ingredientResult = await prisma.ingredient.updateMany({
    where: {
      defaultUnitId: {
        in: legacyUnitIds
      }
    },
    data: {
      defaultUnitId: gramUnit.id
    }
  });

  const recommendationResult = await prisma.ingredientRecommendation.updateMany({
    where: {
      defaultUnitId: {
        in: legacyUnitIds
      }
    },
    data: {
      defaultUnitId: gramUnit.id,
      defaultUnitName: gramUnit.name
    }
  });

  const drafts = await prisma.recipeDraft.findMany({
    select: {
      id: true,
      title: true,
      contentJson: true
    },
    orderBy: { id: "asc" }
  });
  let updatedDraftCount = 0;
  for (const draft of drafts) {
    const content = fromJson<RecipeDraftContentInput>(draft.contentJson);
    const result = rewriteDraftContent(content, legacyUnitIdSet, gramUnit.id);
    if (!result.changedCount) continue;
    await prisma.recipeDraft.update({
      where: { id: draft.id },
      data: {
        contentJson: toJson(result.nextContent),
        searchText: buildDraftSearchText(result.nextContent),
        contentSizeBytes: draftSizeBytes(result.nextContent),
        version: { increment: 1 }
      }
    });
    updatedDraftCount += 1;
  }

  const versions = await prisma.recipeContentVersion.findMany({
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
    },
    orderBy: { id: "asc" }
  });
  let updatedVersionCount = 0;
  for (const version of versions) {
    const items = Array.isArray(version.ingredientsJson) ? version.ingredientsJson : [];
    const result = rewriteVersionIngredients(items, legacyUnitIdSet, gramUnit);
    if (!result.changedCount) continue;
    const nextContent = versionToContent({
      name: version.name,
      story: version.story,
      baseServings: version.baseServings,
      difficulty: version.difficulty,
      duration: version.duration,
      estimatedCalories: version.estimatedCalories,
      tips: version.tips,
      ingredientsJson: result.nextItems,
      stepsJson: version.stepsJson
    });
    await prisma.recipeContentVersion.update({
      where: { id: version.id },
      data: {
        ingredientsJson: toJson(result.nextItems),
        searchText: buildRecipeSearchText(nextContent),
        contentSizeBytes: contentSizeBytes(nextContent)
      }
    });
    updatedVersionCount += 1;
  }

  const imports = await prisma.recipeImportItem.findMany({
    select: {
      id: true,
      rawBodyJson: true,
      recipeBodyJson: true
    },
    orderBy: { id: "asc" }
  });
  let updatedImportCount = 0;
  for (const row of imports) {
    const rawBody = row.rawBodyJson as RecipeImportRawBody;
    const recipeBody = row.recipeBodyJson as RecipeImportRecipeBody;
    const ingredients = Array.isArray(recipeBody?.ingredients) ? recipeBody.ingredients : [];
    let changed = false;
    const nextIngredients = ingredients.map(item => {
      if (!item || !legacyUnitIdSet.has(item.unitId ?? -1)) return item;
      changed = true;
      return {
        ...item,
        unitId: gramUnit.id
      };
    });
    if (!changed) continue;
    const nextRecipeBody: RecipeImportRecipeBody = {
      ...recipeBody,
      ingredients: nextIngredients
    };
    const images = Array.isArray(rawBody?.images) ? rawBody.images : [];
    const nextState = rebuildItemState(nextRecipeBody, images);
    await prisma.recipeImportItem.update({
      where: { id: row.id },
      data: {
        status: nextState.errorItems.length > 0 ? "NEEDS_FIX" : "READY",
        recipeBodyJson: nextRecipeBody as never,
        errorJson: nextState.errorItems as never,
        warnJson: nextState.warnItems as never,
        version: { increment: 1 }
      }
    });
    updatedImportCount += 1;
  }

  const deletedResult = await prisma.unit.deleteMany({
    where: {
      id: {
        in: legacyUnitIds
      }
    }
  });

  console.log(
    JSON.stringify(
      {
        targetUnit: gramUnit,
        updatedIngredientCount: ingredientResult.count,
        updatedRecommendationCount: recommendationResult.count,
        updatedDraftCount,
        updatedVersionCount,
        updatedImportCount,
        deletedCount: deletedResult.count,
        deleted: legacyUnits
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
