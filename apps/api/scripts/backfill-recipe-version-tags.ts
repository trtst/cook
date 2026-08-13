import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { versionToContent } from "../src/modules/recipe/recipe-content";
import { buildAutoRecipeVersionTags, replaceAutoRecipeVersionTags } from "../src/modules/recipe/recipe-version-tags";

loadLocalEnv();

const prisma = new PrismaClient();

function hasApplyFlag() {
  return process.argv.includes("--apply");
}

function hasFlag(name: string) {
  return process.argv.includes(name);
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
  const refreshAuto = hasFlag("--refresh-auto");
  const batchSize = readNumberFlag("--batch-size") ?? 100;
  const limit = readNumberFlag("--limit");

  let cursorId = 0;
  let scannedCount = 0;
  let missingAnyTagCount = 0;
  let missingAutoTagCount = 0;
  let refreshedAutoTagCount = 0;
  let backfilledVersionCount = 0;
  let createdTagRowCount = 0;
  let emptyInferenceCount = 0;
  const sampleVersionIds: number[] = [];

  while (true) {
    const remaining = limit ? Math.max(limit - scannedCount, 0) : batchSize;
    if (limit && remaining === 0) break;

    const versions = await prisma.recipeContentVersion.findMany({
      where: {
        id: {
          gt: cursorId
        }
      },
      orderBy: {
        id: "asc"
      },
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
        versionTags: {
          where: {
            source: "AUTO"
          },
          select: {
            id: true
          },
          take: 1
        },
        _count: {
          select: {
            versionTags: true
          }
        }
      }
    });

    if (!versions.length) break;

    for (const version of versions) {
      scannedCount += 1;
      cursorId = version.id;

      const hasAnyTag = version._count.versionTags > 0;
      const hasAutoTag = version.versionTags.length > 0;

      if (!hasAnyTag) missingAnyTagCount += 1;
      if (hasAutoTag && !refreshAuto) continue;

      if (hasAutoTag) refreshedAutoTagCount += 1;
      else missingAutoTagCount += 1;
      if (sampleVersionIds.length < 20) sampleVersionIds.push(version.id);

      const content = versionToContent(version);
      const rows = buildAutoRecipeVersionTags(content);

      if (!rows.length) {
        emptyInferenceCount += 1;
        continue;
      }

      if (!apply) continue;

      await prisma.$transaction(async tx => {
        await replaceAutoRecipeVersionTags(tx, version.id, content);
      });

      backfilledVersionCount += 1;
      createdTagRowCount += rows.length;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        refreshAuto,
        scannedCount,
        missingAnyTagCount,
        missingAutoTagCount,
        refreshedAutoTagCount,
        backfilledVersionCount,
        createdTagRowCount,
        emptyInferenceCount,
        sampleVersionIds,
        nextStep: apply
          ? null
          : refreshAuto
            ? "Re-run with --apply --refresh-auto to rebuild existing AUTO tags for historical recipe versions."
            : "Re-run with --apply to persist AUTO tags for historical recipe versions that currently have none."
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
