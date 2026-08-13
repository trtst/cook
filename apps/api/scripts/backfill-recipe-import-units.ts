import { PrismaClient } from "@prisma/client";
import type { RecipeImportRawBody, RecipeImportRecipeBody } from "../src/contracts/types";
import { rebuildItemState } from "../src/modules/admin/recipe-import-markdown";
import { buildSearchKey } from "../src/modules/recipe/recipe-content";
import { allowedSystemUnitNames } from "../src/modules/recipe/system-unit-policy";

const prisma = new PrismaClient();

const allowedUnitKeySet = new Set(allowedSystemUnitNames.map(item => buildSearchKey(item)));

async function main() {
  const legacyUnits = await prisma.unit.findMany({
    where: {
      ownerId: null,
      NOT: {
        searchKey: {
          in: Array.from(allowedUnitKeySet)
        }
      }
    },
    select: {
      id: true,
      name: true
    }
  });
  const legacyUnitIdSet = new Set(legacyUnits.map(item => item.id));
  const legacyUnitNameMap = new Map(legacyUnits.map(item => [item.id, item.name]));
  const gramUnit = await prisma.unit.findFirst({
    where: {
      ownerId: null,
      searchKey: buildSearchKey("克")
    },
    select: {
      id: true,
      name: true
    }
  });
  if (!gramUnit) {
    throw new Error("系统单位“克”不存在，无法统一清理旧单位");
  }

  const rows = await prisma.recipeImportItem.findMany({
    select: {
      id: true,
      rawBodyJson: true,
      recipeBodyJson: true
    },
    orderBy: { id: "asc" }
  });

  let updatedCount = 0;
  let clearedCount = 0;
  const updatedItems: Array<{ id: number; clearedUnits: string[] }> = [];

  for (const row of rows) {
    const rawBody = row.rawBodyJson as RecipeImportRawBody;
    const recipeBody = row.recipeBodyJson as RecipeImportRecipeBody;
    const ingredients = Array.isArray(recipeBody?.ingredients) ? recipeBody.ingredients : [];

    let changed = false;
    const clearedUnits = new Set<string>();
    const nextIngredients = ingredients.map(item => {
      if (!item || !legacyUnitIdSet.has(item.unitId ?? -1)) return item;
      changed = true;
      clearedCount += 1;
      const legacyName = legacyUnitNameMap.get(item.unitId as number);
      if (legacyName) clearedUnits.add(legacyName);
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

    updatedCount += 1;
    updatedItems.push({
      id: row.id,
      clearedUnits: Array.from(clearedUnits).sort()
    });
  }

  console.log(
    JSON.stringify(
      {
        legacyUnitCount: legacyUnits.length,
        targetUnit: gramUnit,
        updatedCount,
        clearedCount,
        updatedItems
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
