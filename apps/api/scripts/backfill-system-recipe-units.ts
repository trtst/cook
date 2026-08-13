import { PrismaClient } from "@prisma/client";
import { buildSearchKey } from "../src/modules/recipe/recipe-content";
import { allowedSystemUnitNames } from "../src/modules/recipe/system-unit-policy";
import { closeSeedPrisma, syncSystemRecipeCatalog } from "../prisma/seed";

const prisma = new PrismaClient();

type LegacySummary = {
  id: number;
  name: string;
  versionCount: number;
};

const allowedUnitKeySet = new Set(allowedSystemUnitNames.map(item => buildSearchKey(item)));

function countLegacyUnitRefs(items: unknown[], legacyUnitIdSet: Set<number>) {
  let count = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      unitId?: unknown;
      defaultUnitId?: unknown;
      amount?: { unitId?: unknown } | null;
    };
    if (
      legacyUnitIdSet.has((row.unitId as number) ?? -1) ||
      legacyUnitIdSet.has((row.defaultUnitId as number) ?? -1) ||
      legacyUnitIdSet.has((row.amount?.unitId as number) ?? -1)
    ) {
      count += 1;
    }
  }
  return count;
}

async function collectLegacySystemVersionUsage() {
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
    },
    orderBy: { id: "asc" }
  });
  const legacyUnitIdSet = new Set(legacyUnits.map(item => item.id));

  const versions = await prisma.recipeContentVersion.findMany({
    where: {
      createdByUserId: null
    },
    select: {
      id: true,
      ingredientsJson: true
    },
    orderBy: { id: "asc" }
  });

  const summary = legacyUnits
    .map<LegacySummary>(unit => ({
      id: unit.id,
      name: unit.name,
      versionCount: versions.reduce((sum, version) => {
        const items = Array.isArray(version.ingredientsJson) ? version.ingredientsJson : [];
        return sum + countLegacyUnitRefs(items, new Set([unit.id]));
      }, 0)
    }))
    .filter(item => item.versionCount > 0);

  return {
    legacyUnitCount: legacyUnits.length,
    legacyUnitIdSet,
    versionCount: versions.length,
    summary
  };
}

async function main() {
  const before = await collectLegacySystemVersionUsage();
  await syncSystemRecipeCatalog();
  const after = await collectLegacySystemVersionUsage();

  console.log(
    JSON.stringify(
      {
        systemVersionCount: before.versionCount,
        beforeBlockedCount: before.summary.length,
        beforeBlocked: before.summary,
        afterBlockedCount: after.summary.length,
        afterBlocked: after.summary
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
    await closeSeedPrisma();
  });
