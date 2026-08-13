import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { inferIngredientTagFacts } from "../src/modules/recipe/ingredient-tag-facts";

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

async function main() {
  const apply = hasApplyFlag();
  const batchSize = readNumberFlag("--batch-size") ?? 100;
  const limit = readNumberFlag("--limit");

  let cursorId = 0;
  let scannedCount = 0;
  let changedCount = 0;
  let proteinFilledCount = 0;
  let stapleMarkedCount = 0;
  let spicyMarkedCount = 0;
  let aliasAddedCount = 0;
  const sampleIds: number[] = [];

  while (true) {
    const remaining = limit ? Math.max(limit - scannedCount, 0) : batchSize;
    if (limit && remaining === 0) break;

    const items = await prisma.ingredient.findMany({
      where: {
        id: {
          gt: cursorId
        },
        ownerId: null
      },
      orderBy: {
        id: "asc"
      },
      take: Math.min(batchSize, remaining || batchSize),
      select: {
        id: true,
        name: true,
        proteinType: true,
        isStaple: true,
        isSpicyIngredient: true,
        aliases: true,
        category: {
          select: {
            code: true
          }
        }
      }
    });

    if (!items.length) break;

    for (const item of items) {
      scannedCount += 1;
      cursorId = item.id;

      const inferred = inferIngredientTagFacts({
        name: item.name,
        categoryCode: item.category.code,
        aliases: item.aliases
      });

      const nextProteinType = item.proteinType ?? inferred.proteinType;
      const nextIsStaple = item.isStaple || inferred.isStaple;
      const nextIsSpicyIngredient = item.isSpicyIngredient || inferred.isSpicyIngredient;
      const nextAliases = Array.from(new Set([...(item.aliases ?? []), ...inferred.aliases]));

      const changed =
        nextProteinType !== item.proteinType ||
        nextIsStaple !== item.isStaple ||
        nextIsSpicyIngredient !== item.isSpicyIngredient ||
        nextAliases.length !== item.aliases.length;

      if (!changed) continue;

      changedCount += 1;
      if (!item.proteinType && nextProteinType) proteinFilledCount += 1;
      if (!item.isStaple && nextIsStaple) stapleMarkedCount += 1;
      if (!item.isSpicyIngredient && nextIsSpicyIngredient) spicyMarkedCount += 1;
      if (nextAliases.length > item.aliases.length) aliasAddedCount += nextAliases.length - item.aliases.length;
      if (sampleIds.length < 20) sampleIds.push(item.id);

      if (!apply) continue;

      await prisma.ingredient.update({
        where: { id: item.id },
        data: {
          proteinType: nextProteinType,
          isStaple: nextIsStaple,
          isSpicyIngredient: nextIsSpicyIngredient,
          aliases: nextAliases
        }
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        scannedCount,
        changedCount,
        proteinFilledCount,
        stapleMarkedCount,
        spicyMarkedCount,
        aliasAddedCount,
        sampleIds,
        nextStep: apply ? null : "Re-run with --apply to persist inferred ingredient tag facts for system ingredients."
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
