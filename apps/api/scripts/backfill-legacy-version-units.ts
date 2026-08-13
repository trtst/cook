import { PrismaClient, type UnitType } from "@prisma/client";
import { buildSearchKey, buildRecipeSearchText, contentSizeBytes, toJson, versionToContent } from "../src/modules/recipe/recipe-content";

const prisma = new PrismaClient();

const legacySystemUnitNames = ["斤", "两", "只", "颗", "根", "块", "片", "把", "条", "张", "节", "朵", "串", "段", "撮", "勺", "茶匙", "碗", "杯", "袋", "份"] as const;

type UnitTarget = {
  id: number;
  name: string;
  type: UnitType;
};

type RecipeIngredientRow = {
  ingredientId?: unknown;
  ingredientName?: unknown;
  unitId?: unknown;
  unitName?: unknown;
  unitType?: unknown;
  defaultUnitId?: unknown;
  amount?:
    | {
        kind?: unknown;
        quantity?: unknown;
        unitId?: unknown;
        unitName?: unknown;
        unitType?: unknown;
      }
    | null;
};

function rewriteVersionIngredients(
  items: unknown[],
  legacyUnitIdSet: Set<number>,
  targetUnit: UnitTarget
) {
  let changedCount = 0;
  const changedUnits = new Map<string, number>();

  const nextItems = items.map(item => {
    if (!item || typeof item !== "object") return item;

    const row = item as RecipeIngredientRow;
    const amountUnitId = typeof row.amount?.unitId === "number" ? row.amount.unitId : null;
    const rootUnitId = typeof row.unitId === "number" ? row.unitId : null;
    const defaultUnitId = typeof row.defaultUnitId === "number" ? row.defaultUnitId : null;
    const currentUnitId = amountUnitId ?? rootUnitId ?? defaultUnitId;

    if (!currentUnitId || !legacyUnitIdSet.has(currentUnitId)) return item;

    changedCount += 1;
    const changeKey = `${currentUnitId}->${targetUnit.id}`;
    changedUnits.set(changeKey, (changedUnits.get(changeKey) ?? 0) + 1);

    const nextRow: Record<string, unknown> = { ...(row as Record<string, unknown>) };
    if ("unitId" in nextRow) nextRow.unitId = targetUnit.id;
    if ("unitName" in nextRow) nextRow.unitName = targetUnit.name;
    if ("unitType" in nextRow) nextRow.unitType = targetUnit.type;
    if ("defaultUnitId" in nextRow) nextRow.defaultUnitId = targetUnit.id;

    if (row.amount && typeof row.amount === "object" && row.amount.kind === "EXACT") {
      nextRow.amount = {
        ...row.amount,
        unitId: targetUnit.id,
        unitName: targetUnit.name,
        unitType: targetUnit.type
      };
    }

    return nextRow;
  });

  return {
    nextItems,
    changedCount,
    changedUnits: Array.from(changedUnits.entries()).map(([change, count]) => ({
      change,
      count
    }))
  };
}

async function main() {
  const legacyUnits = await prisma.unit.findMany({
    where: {
      ownerId: null,
      name: {
        in: [...legacySystemUnitNames]
      }
    },
    select: {
      id: true,
      name: true
    },
    orderBy: { id: "asc" }
  });
  const legacyUnitIdSet = new Set(legacyUnits.map(item => item.id));
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

  const versions = await prisma.recipeContentVersion.findMany({
    select: {
      id: true,
      createdByUserId: true,
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
    },
    orderBy: { id: "asc" }
  });

  let updatedVersionCount = 0;
  let changedIngredientCount = 0;
  const updatedVersions: Array<{
    id: number;
    createdByUserId: number | null;
    name: string;
    changedCount: number;
  }> = [];

  for (const version of versions) {
    const items = Array.isArray(version.ingredientsJson) ? version.ingredientsJson : [];
    const result = rewriteVersionIngredients(items, legacyUnitIdSet, gramUnit);
    if (result.changedCount === 0) continue;

    if (result.changedCount > 0) {
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
    }

    updatedVersionCount += result.changedCount > 0 ? 1 : 0;
    changedIngredientCount += result.changedCount;
    updatedVersions.push({
      id: version.id,
      createdByUserId: version.createdByUserId,
      name: version.name,
      changedCount: result.changedCount
    });
  }

  const remainingLegacyUnits = await prisma.unit.findMany({
    where: {
      ownerId: null,
      name: {
        in: [...legacySystemUnitNames]
      }
    },
    select: {
      id: true,
      name: true
    },
    orderBy: { id: "asc" }
  });

  const remainingVersions = await prisma.recipeContentVersion.findMany({
    select: {
      id: true,
      createdByUserId: true,
      name: true,
      ingredientsJson: true
    },
    orderBy: { id: "asc" }
  });

  const blockers: Array<{
    id: number;
    createdByUserId: number | null;
    name: string;
    unitNames: string[];
  }> = [];
  const legacyUnitNameMap = new Map(remainingLegacyUnits.map(item => [item.id, item.name]));
  for (const version of remainingVersions) {
    const items = Array.isArray(version.ingredientsJson) ? version.ingredientsJson : [];
    const unitNames = new Set<string>();
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const row = item as RecipeIngredientRow;
      const unitId =
        (typeof row.amount?.unitId === "number" ? row.amount.unitId : null) ??
        (typeof row.unitId === "number" ? row.unitId : null) ??
        (typeof row.defaultUnitId === "number" ? row.defaultUnitId : null);
      if (!unitId || !legacyUnitIdSet.has(unitId)) continue;
      const unitName = legacyUnitNameMap.get(unitId);
      if (unitName) unitNames.add(unitName);
    }
    if (unitNames.size > 0) {
      blockers.push({
        id: version.id,
        createdByUserId: version.createdByUserId,
        name: version.name,
        unitNames: Array.from(unitNames)
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        legacyUnitCount: legacyUnits.length,
        targetUnit: gramUnit,
        updatedVersionCount,
        changedIngredientCount,
        updatedVersions,
        remainingBlockerCount: blockers.length,
        remainingBlockers: blockers
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
