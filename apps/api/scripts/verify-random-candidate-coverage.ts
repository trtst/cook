import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import {
  candidateCoverageKeysFromConfirmedRecipeTags,
  missingRandomCandidateSlotTypes,
  requiredRandomCandidateCoverage
} from "../src/modules/recipe/random-candidate-coverage";

loadLocalEnv();

const prisma = new PrismaClient();

async function main() {
  const recipes = await prisma.recipe.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      currentVersion: {
        select: {
          versionTags: {
            where: { status: "CONFIRMED" },
            select: { tagCode: true, tagValue: true }
          }
        }
      }
    }
  });
  const counts = new Map<string, number>(requiredRandomCandidateCoverage.map(item => [item.key, 0]));
  for (const recipe of recipes) {
    for (const coverageKey of new Set(candidateCoverageKeysFromConfirmedRecipeTags(recipe.currentVersion.versionTags))) {
      counts.set(coverageKey, (counts.get(coverageKey) ?? 0) + 1);
    }
  }
  const slots = requiredRandomCandidateCoverage.map(item => ({
    mealSlot: item.mealSlot,
    slotType: item.slotType,
    candidateCount: counts.get(item.key) ?? 0
  }));
  const missingSlotTypes = missingRandomCandidateSlotTypes(counts);
  console.log(JSON.stringify({
    activeRecipeCount: recipes.length,
    slots,
    missingSlotTypes,
    releaseEligible: missingSlotTypes.length === 0
  }, null, 2));
  if (missingSlotTypes.length) process.exitCode = 1;
}

void main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
