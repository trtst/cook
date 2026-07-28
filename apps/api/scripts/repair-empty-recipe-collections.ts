import { PrismaClient, type Prisma } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const prisma = new PrismaClient();

function collectionRecordKey(collectionId: string) {
  return `collection:${collectionId}`;
}

function hasApplyFlag() {
  return process.argv.includes("--apply");
}

function summarizeCollections(items: Array<{ id: string; userId: string; sourceRecipeId: string }>) {
  const userIds = new Set<string>();
  const sourceRecipeIds = new Set<string>();

  for (const item of items) {
    userIds.add(item.userId);
    sourceRecipeIds.add(item.sourceRecipeId);
  }

  return {
    collectionCount: items.length,
    userCount: userIds.size,
    sourceRecipeCount: sourceRecipeIds.size,
    sampleCollectionIds: items.slice(0, 10).map(item => item.id)
  };
}

async function refreshCollectCount(tx: Prisma.TransactionClient, sourceRecipeIds: string[]) {
  for (const sourceRecipeId of sourceRecipeIds) {
    const holders = await tx.recipeCollection.groupBy({
      by: ["userId"],
      where: { sourceRecipeId }
    });

    await tx.recipe.update({
      where: { id: sourceRecipeId },
      data: { collectCount: holders.length }
    });
  }
}

async function main() {
  const apply = hasApplyFlag();
  const orphanCollections = await prisma.recipeCollection.findMany({
    where: {
      sceneLinks: {
        none: {}
      }
    },
    select: {
      id: true,
      userId: true,
      sourceRecipeId: true,
      sourceVersionId: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });

  const summary = summarizeCollections(orphanCollections);

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          ...summary,
          nextStep: "Re-run with --apply to delete orphan collections, remove RECIPE storage ledger rows, and refresh collectCount."
        },
        null,
        2
      )
    );
    return;
  }

  if (orphanCollections.length === 0) {
    console.log(
      JSON.stringify(
        {
          mode: "apply",
          ...summary,
          deletedCollectionCount: 0,
          deletedLedgerCount: 0,
          updatedRecipeCount: 0
        },
        null,
        2
      )
    );
    return;
  }

  const sourceRecipeIds = [...new Set(orphanCollections.map(item => item.sourceRecipeId))];
  const deleteCollectionIds = orphanCollections.map(item => item.id);
  const ledgerFilters = orphanCollections.map(item => ({
    userId: item.userId,
    module: "RECIPE" as const,
    recordKey: collectionRecordKey(item.id)
  }));

  const result = await prisma.$transaction(async tx => {
    const deletedLedger = await tx.storageLedger.deleteMany({
      where: {
        OR: ledgerFilters
      }
    });

    const deletedCollections = await tx.recipeCollection.deleteMany({
      where: {
        id: {
          in: deleteCollectionIds
        }
      }
    });

    await refreshCollectCount(tx, sourceRecipeIds);

    return {
      deletedLedgerCount: deletedLedger.count,
      deletedCollectionCount: deletedCollections.count
    };
  });

  console.log(
    JSON.stringify(
      {
        mode: "apply",
        ...summary,
        ...result,
        updatedRecipeCount: sourceRecipeIds.length
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
