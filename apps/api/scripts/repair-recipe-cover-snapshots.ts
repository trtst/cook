import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Prisma, PrismaClient } from "@prisma/client";
import { AssetStorageService, assetKey } from "../src/common/asset-storage.service";
import { loadLocalEnv } from "../src/common/load-env";
import { recipeImageFileName } from "../src/common/recipe-image-name";
import {
  assertRecipeMigrationTarget,
  parseRecipeMigrationTarget,
  recipeMigrationFingerprint,
  type RecipeMigrationTarget
} from "./recipe-migration-target";

loadLocalEnv();

type RepairItem = {
  recipeId: number;
  recipeVersion: number;
  sourceVersionId: number;
  nextVersionId: number | null;
  coverBefore: string;
  sourceKey: string;
  targetKey: string | null;
  targetUrl: string | null;
  sourceHash: string;
};

type RepairPlan = {
  format: "recipe-cover-snapshot-repair.v2";
  target: RecipeMigrationTarget;
  targetFingerprint: string;
  createdAt: string;
  items: RepairItem[];
  conflicts: string[];
};

const prisma = new PrismaClient();
const storage = new AssetStorageService();

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function storageKeyFromUrl(imageUrl: string) {
  try {
    const segments = new URL(imageUrl, "https://recipe-cover-repair.invalid").pathname.split("/").filter(Boolean);
    const uploadsIndex = segments.indexOf("uploads");
    if (uploadsIndex < 0 || uploadsIndex + 1 >= segments.length) return null;
    const parts = segments.slice(uploadsIndex).map(decodeURIComponent);
    if (!/\.(?:jpg|jpeg|png|webp)$/i.test(parts.at(-1) ?? "")) return null;
    if (parts[1] === "recipe-images" && parts.length === 4 && /^\d+$/.test(parts[2] ?? "")) {
      return { key: parts.join("/"), recipeId: Number(parts[2]), fileName: parts[3] as string };
    }
    if (parts[1] === "system-data-snapshots" && /^[\da-f-]{36}$/i.test(parts[2] ?? "")) {
      if (parts.length === 4) return { key: parts.join("/"), recipeId: null, fileName: parts[3] as string };
      if (parts.length === 8 && parts[3] === "source" && parts[4] === "uploads" && parts[5] === "recipe-images" && /^\d+$/.test(parts[6] ?? "")) {
        return { key: parts.join("/"), recipeId: Number(parts[6]), fileName: parts[7] as string };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function reserveVersionId() {
  const rows = await prisma.$queryRaw<Array<{ id: bigint | number }>>`
    SELECT nextval(pg_get_serial_sequence('recipe_content_versions', 'id')) AS id
  `;
  const id = Number(rows[0]?.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("无法预留新的菜谱内容版本 ID");
  return id;
}

async function buildPlan(target: RecipeMigrationTarget): Promise<RepairPlan> {
  const items: RepairItem[] = [];
  const conflicts: string[] = [];
  const recipes = await prisma.recipe.findMany({
    where: { coverImageUrl: { not: null } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      version: true,
      currentVersionId: true,
      coverImageUrl: true,
      currentVersion: { select: { imagesJson: true } }
    }
  });

  for (const recipe of recipes) {
    const coverImageUrl = recipe.coverImageUrl;
    if (!coverImageUrl) continue;
    const images = recipe.currentVersion.imagesJson;
    const currentCover = isRecord(images) && typeof images.coverImageUrl === "string"
      ? images.coverImageUrl
      : null;
    if (currentCover) continue;

    const source = storageKeyFromUrl(coverImageUrl);
    if (!source || (source.recipeId !== null && source.recipeId !== recipe.id)) {
      let pathname = "<invalid-url>";
      try { pathname = new URL(coverImageUrl, "https://recipe-cover-repair.invalid").pathname; } catch { /* no URL path */ }
      conflicts.push(`菜谱 ${recipe.id} 的封面 URL 无法解析为本菜谱 OSS 对象：${pathname}`);
      continue;
    }
    try {
      const sourceBytes = await storage.readBuffer(source.key);
      const sourceHash = sha256(sourceBytes);
      items.push({
        recipeId: recipe.id,
        recipeVersion: recipe.version,
        sourceVersionId: recipe.currentVersionId,
        nextVersionId: null,
        coverBefore: coverImageUrl,
        sourceKey: source.key,
        targetKey: null,
        targetUrl: null,
        sourceHash
      });
    } catch {
      conflicts.push(`菜谱 ${recipe.id} 的封面对象无法读取：${source.key}`);
    }
  }

  return {
    format: "recipe-cover-snapshot-repair.v2",
    target,
    targetFingerprint: recipeMigrationFingerprint(process.env),
    createdAt: new Date().toISOString(),
    items,
    conflicts
  };
}

function withoutIds<T extends { id: number; recipeVersionId: number; createdAt?: Date; updatedAt?: Date }>(rows: T[], recipeVersionId: number) {
  return rows.map(({ id: _id, recipeVersionId: _oldVersionId, createdAt: _createdAt, updatedAt: _updatedAt, ...row }) => ({
    ...row,
    recipeVersionId
  }));
}

async function applyItem(item: RepairItem) {
  if (!item.nextVersionId || !item.targetKey || !item.targetUrl) throw new Error(`菜谱 ${item.recipeId} 的目标版本尚未准备`);
  const sourceBytes = await storage.readBuffer(item.sourceKey);
  if (sha256(sourceBytes) !== item.sourceHash) throw new Error(`源对象已变化，停止处理菜谱 ${item.recipeId}`);
  const targetExists = await storage.exists(item.targetKey);
  if (targetExists) {
    if (sha256(await storage.readBuffer(item.targetKey)) !== item.sourceHash) throw new Error(`目标对象冲突：${item.targetKey}`);
  } else {
    await storage.copyObject(item.sourceKey, item.targetKey);
    if (sha256(await storage.readBuffer(item.targetKey)) !== item.sourceHash) throw new Error(`复制校验失败：${item.targetKey}`);
  }

  await prisma.$transaction(async tx => {
    const recipe = await tx.recipe.findUnique({
      where: { id: item.recipeId },
      include: {
        currentVersion: {
          include: {
            versionTags: true,
            nutritionSnapshots: true,
            completenessSnapshots: true,
            cookAssistant: true,
            cookAssistantUnlocks: true,
            ingredientLinks: true
          }
        }
      }
    });
    if (!recipe) throw new Error(`菜谱不存在：${item.recipeId}`);
    if (recipe.currentVersionId === item.nextVersionId && recipe.coverImageUrl === item.targetUrl) return;
    if (recipe.currentVersionId !== item.sourceVersionId || recipe.version !== item.recipeVersion || recipe.coverImageUrl !== item.coverBefore) {
      throw new Error(`菜谱 ${item.recipeId} 在生成清单后已变化，拒绝覆盖`);
    }
    const sourceImages = recipe.currentVersion.imagesJson;
    if (isRecord(sourceImages) && typeof sourceImages.coverImageUrl === "string" && sourceImages.coverImageUrl) {
      throw new Error(`菜谱 ${item.recipeId} 当前版本封面已补齐，拒绝重复创建版本`);
    }

    const nextImages = isRecord(sourceImages)
      ? { ...sourceImages, coverImageUrl: item.targetUrl }
      : { coverImageUrl: item.targetUrl, stepImages: [] };
    const sourceVersion = recipe.currentVersion;
    const nextVersion = await tx.recipeContentVersion.create({
      data: {
        id: item.nextVersionId,
        createdByUserId: sourceVersion.createdByUserId,
        name: sourceVersion.name,
        story: sourceVersion.story,
        baseServings: sourceVersion.baseServings,
        difficulty: sourceVersion.difficulty,
        duration: sourceVersion.duration,
        estimatedCalories: sourceVersion.estimatedCalories,
        tips: sourceVersion.tips,
        keywordsJson: toJson(sourceVersion.keywordsJson),
        toolsJson: toJson(sourceVersion.toolsJson),
        ingredientsJson: toJson(sourceVersion.ingredientsJson),
        stepsJson: toJson(sourceVersion.stepsJson),
        imagesJson: toJson(nextImages),
        searchText: sourceVersion.searchText,
        contentSizeBytes: sourceVersion.contentSizeBytes
      }
    });

    if (sourceVersion.ingredientLinks.length) {
      await tx.recipeVersionIngredient.createMany({
        data: sourceVersion.ingredientLinks.map(link => ({ recipeVersionId: nextVersion.id, ingredientId: link.ingredientId }))
      });
    }
    if (sourceVersion.versionTags.length) {
      await tx.recipeVersionTag.createMany({
        data: withoutIds(sourceVersion.versionTags, nextVersion.id) as Prisma.RecipeVersionTagCreateManyInput[]
      });
    }
    if (sourceVersion.nutritionSnapshots.length) {
      await tx.recipeNutritionSnapshot.createMany({
        data: withoutIds(sourceVersion.nutritionSnapshots, nextVersion.id).map(snapshot => ({
          ...snapshot,
          perServingJson: snapshot.perServingJson ?? Prisma.DbNull,
          perRecipeJson: snapshot.perRecipeJson ?? Prisma.DbNull
        })) as Prisma.RecipeNutritionSnapshotCreateManyInput[]
      });
    }
    if (sourceVersion.completenessSnapshots.length) {
      await tx.recipeCompletenessSnapshot.createMany({
        data: withoutIds(sourceVersion.completenessSnapshots, nextVersion.id).map(snapshot => ({
          ...snapshot,
          contentBlockingReasons: toJson(snapshot.contentBlockingReasons),
          structuredDataBlockingReasons: toJson(snapshot.structuredDataBlockingReasons),
          tagBlockingReasons: toJson(snapshot.tagBlockingReasons),
          nutritionBlockingReasons: toJson(snapshot.nutritionBlockingReasons),
          assistantBlockingReasons: toJson(snapshot.assistantBlockingReasons),
          frontendBlockingReasons: toJson(snapshot.frontendBlockingReasons),
          randomMenuBlockingReasons: toJson(snapshot.randomMenuBlockingReasons)
        })) as Prisma.RecipeCompletenessSnapshotCreateManyInput[]
      });
    }
    if (sourceVersion.cookAssistant) {
      const assistant = sourceVersion.cookAssistant;
      await tx.recipeCookAssistant.create({
        data: {
          recipeVersionId: nextVersion.id,
          status: assistant.status,
          candidateJson: assistant.candidateJson == null ? Prisma.DbNull : toJson(assistant.candidateJson),
          snapshotJson: assistant.snapshotJson == null ? Prisma.DbNull : toJson(assistant.snapshotJson),
          generatedAt: assistant.generatedAt,
          lastAttemptAt: assistant.lastAttemptAt,
          attemptCount: assistant.attemptCount,
          lastError: assistant.lastError,
          source: assistant.source,
          isLocked: assistant.isLocked,
          isQueueDismissed: assistant.isQueueDismissed,
          updatedByAdminId: assistant.updatedByAdminId
        }
      });
    }
    if (sourceVersion.cookAssistantUnlocks.length) {
      await tx.cookAssistantUnlock.createMany({
        data: sourceVersion.cookAssistantUnlocks.map(({ id: _id, recipeVersionId: _oldVersionId, ...unlock }) => ({
          ...unlock,
          recipeVersionId: nextVersion.id,
          planItemId: null,
          countsTowardDailyLimit: false
        }))
      });
    }

    const updated = await tx.recipe.updateMany({
      where: {
        id: item.recipeId,
        currentVersionId: item.sourceVersionId,
        version: item.recipeVersion,
        coverImageUrl: item.coverBefore
      },
      data: { currentVersionId: nextVersion.id, coverImageUrl: item.targetUrl, version: { increment: 1 } }
    });
    if (updated.count !== 1) throw new Error(`菜谱 ${item.recipeId} 当前版本切换失败`);

    await tx.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        action: "RECIPE_COVER_SNAPSHOT_REPAIRED",
        objectType: "RECIPE",
        objectId: item.recipeId,
        payload: {
          sourceVersionId: item.sourceVersionId,
          nextVersionId: nextVersion.id,
          sourceKey: item.sourceKey,
          targetKey: item.targetKey
        }
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function verifyPlan(plan: RepairPlan) {
  const failures: string[] = [];
  let verifiedCount = 0;
  for (const item of plan.items) {
    if (!item.nextVersionId || !item.targetKey || !item.targetUrl) {
      failures.push(`菜谱 ${item.recipeId} 的目标版本 ID 不在清单中`);
      continue;
    }
    const [recipe, sourceVersion] = await Promise.all([
      prisma.recipe.findUnique({
        where: { id: item.recipeId },
        select: { currentVersionId: true, coverImageUrl: true, currentVersion: { select: { imagesJson: true } } }
      }),
      prisma.recipeContentVersion.findUnique({
        where: { id: item.sourceVersionId },
        select: { id: true, name: true, ingredientsJson: true, stepsJson: true }
      })
    ]);
    if (!recipe || recipe.currentVersionId !== item.nextVersionId || recipe.coverImageUrl !== item.targetUrl) {
      failures.push(`菜谱 ${item.recipeId} 未切换到预期的新版本`);
      continue;
    }
    const images = recipe.currentVersion.imagesJson;
    if (!isRecord(images) || images.coverImageUrl !== item.targetUrl) {
      failures.push(`菜谱 ${item.recipeId} 当前版本封面快照不一致`);
      continue;
    }
    if (!sourceVersion || sourceVersion.id !== item.sourceVersionId) {
      failures.push(`菜谱 ${item.recipeId} 的旧版本快照未保留`);
      continue;
    }
    const [currentVersion, targetBytes] = await Promise.all([
      prisma.recipeContentVersion.findUnique({
        where: { id: item.nextVersionId },
        select: { name: true, ingredientsJson: true, stepsJson: true }
      }),
      storage.readBuffer(item.targetKey)
    ]);
    if (!currentVersion || currentVersion.name !== sourceVersion.name
      || !isDeepStrictEqual(currentVersion.ingredientsJson, sourceVersion.ingredientsJson)
      || !isDeepStrictEqual(currentVersion.stepsJson, sourceVersion.stepsJson)) {
      failures.push(`菜谱 ${item.recipeId} 的正文内容未按旧版本复制`);
      continue;
    }
    if (sha256(targetBytes) !== item.sourceHash) {
      failures.push(`菜谱 ${item.recipeId} 的新封面对象 SHA-256 不匹配`);
      continue;
    }
    verifiedCount += 1;
  }
  return { verifiedCount, failureCount: failures.length, failures: failures.slice(0, 20) };
}

function summarize(plan: RepairPlan) {
  return {
    format: plan.format,
    plannedCount: plan.items.length,
    conflictCount: plan.conflicts.length,
    conflicts: plan.conflicts.slice(0, 10),
    sample: plan.items.slice(0, 10).map(({ recipeId, sourceVersionId, nextVersionId }) => ({ recipeId, sourceVersionId, nextVersionId }))
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const verify = process.argv.includes("--verify");
  const skipConflicts = process.argv.includes("--skip-conflicts");
  const manifestArg = process.argv.find(argument => argument.startsWith("--manifest="))?.slice("--manifest=".length);
  const target = parseRecipeMigrationTarget(process.argv);
  assertRecipeMigrationTarget(target, apply, process.env, process.argv);
  if ((apply || verify) && !manifestArg) throw new Error("执行或验证修复必须指定 --manifest=<清单路径>");
  if (apply && verify) throw new Error("--apply 和 --verify 不能同时使用");

  let plan: RepairPlan;
  if (apply || verify) {
    plan = JSON.parse(await readFile(resolve(manifestArg as string), "utf8")) as RepairPlan;
    if (plan.format !== "recipe-cover-snapshot-repair.v2") throw new Error("修复清单格式不支持");
    if (plan.target !== target) throw new Error(`修复清单目标为 ${plan.target}，当前指定 ${target}，拒绝执行`);
    if (recipeMigrationFingerprint(process.env) !== plan.targetFingerprint) {
      throw new Error("当前数据库或对象存储与修复清单生成环境不同，拒绝执行");
    }
    if (apply) {
      if (plan.conflicts.length && !skipConflicts) {
        throw new Error("清单包含冲突；仅处理无冲突项请显式指定 --skip-conflicts");
      }
      for (const item of plan.items) {
        if (item.nextVersionId && item.targetKey && item.targetUrl) continue;
        const source = storageKeyFromUrl(item.coverBefore);
        if (!source || source.key !== item.sourceKey || (source.recipeId !== null && source.recipeId !== item.recipeId)) {
          throw new Error(`菜谱 ${item.recipeId} 的源图信息与清单不一致`);
        }
        const extension = source.fileName.slice(source.fileName.lastIndexOf(".") + 1).toLowerCase();
        item.nextVersionId = await reserveVersionId();
        item.targetKey = assetKey("uploads", "recipe-images", item.recipeId,
          recipeImageFileName(item.recipeId, item.nextVersionId, { type: "COVER" }, extension === "jpeg" ? "jpg" : extension));
        item.targetUrl = storage.publicUrl({}, item.targetKey);
      }
      await writeFile(resolve(manifestArg as string), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
      for (const item of plan.items) await applyItem(item);
    } else {
      const verification = await verifyPlan(plan);
      console.log(JSON.stringify({ ...summarize(plan), ...verification, manifest: resolve(manifestArg as string), applied: false }, null, 2));
      if (verification.failureCount) process.exitCode = 1;
      return;
    }
  } else {
    plan = await buildPlan(target);
    if (manifestArg) {
      const manifestPath = resolve(manifestArg);
      await mkdir(dirname(manifestPath), { recursive: true });
      await writeFile(manifestPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    }
  }
  console.log(JSON.stringify({
    ...summarize(plan),
    skippedConflictCount: apply && skipConflicts ? plan.conflicts.length : 0,
    skippedConflicts: apply && skipConflicts ? plan.conflicts : [],
    manifest: manifestArg ? resolve(manifestArg) : null,
    applied: apply
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
