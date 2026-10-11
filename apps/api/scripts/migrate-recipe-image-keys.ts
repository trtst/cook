import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Prisma, PrismaClient } from "@prisma/client";
import { AssetStorageService, assetKey } from "../src/common/asset-storage.service";
import { loadLocalEnv } from "../src/common/load-env";
import { recipeImageFileName, type RecipeImagePosition } from "../src/common/recipe-image-name";
import {
  assertRecipeMigrationTarget,
  parseRecipeMigrationTarget,
  recipeMigrationFingerprint
} from "./recipe-migration-target";

loadLocalEnv();

type ImageLocation = {
  recipeVersionId: number;
  recipeId: number | null;
  position: RecipeImagePosition;
  imageUrl: string;
};

type ObjectMove = {
  sourceKey: string;
  targetKey: string;
  sourceHash: string;
};

type VersionChange = {
  id: number;
  imagesBefore: Prisma.JsonValue;
  imagesAfter: Prisma.JsonValue;
  stepsBefore: Prisma.JsonValue;
  stepsAfter: Prisma.JsonValue;
};

type AssistantChange = {
  recipeVersionId: number;
  before: Prisma.JsonValue;
  after: Prisma.JsonValue;
};

type RecipeChange = {
  id: number;
  coverBefore: string | null;
  coverAfter: string | null;
  originCoverBefore: string | null;
  originCoverAfter: string | null;
};

type CoverSnapshotMismatch = {
  recipeId: number;
  contentVersionId: number;
  sourceKey: string | null;
  sourceReadable: boolean;
};

type MigrationPlan = {
  format: "recipe-image-key-migration.v2";
  target: "TEST" | "ONLINE";
  targetFingerprint: string;
  createdAt: string;
  objects: ObjectMove[];
  versions: VersionChange[];
  assistants: AssistantChange[];
  recipes: RecipeChange[];
  coverSnapshotMismatches: CoverSnapshotMismatch[];
  conflicts: string[];
};

const prisma = new PrismaClient();
const storage = new AssetStorageService();
const batchSize = 200;

function parseTargetArg(): "TEST" | "ONLINE" {
  return parseRecipeMigrationTarget(process.argv);
}

function targetFingerprint() {
  return recipeMigrationFingerprint(process.env);
}

function assertTargetConfiguration(target: "TEST" | "ONLINE", write: boolean) {
  assertRecipeMigrationTarget(target, write, process.env, process.argv);
}

function assertExecutionTarget(plan: MigrationPlan) {
  const target = parseTargetArg();
  assertTargetConfiguration(target, true);
  if (target !== plan.target) throw new Error(`迁移清单目标为 ${plan.target}，当前指定 ${target}，拒绝执行`);
  if (targetFingerprint() !== plan.targetFingerprint) throw new Error("当前数据库或对象存储与迁移清单生成环境不同，拒绝执行");
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function recipeImagePath(imageUrl: string) {
  let pathname: string;
  try {
    pathname = new URL(imageUrl, "https://recipe-image-migration.invalid").pathname;
  } catch {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const rootIndex = segments.findIndex(segment => segment === "uploads");
  if (rootIndex < 0) return null;
  const namespace = segments[rootIndex + 1];
  const isRecipeImage = namespace === "recipe-images" && rootIndex + 3 === segments.length - 1;
  const isSnapshotAsset = namespace === "system-data-snapshots" && rootIndex + 3 === segments.length - 1;
  const hasEmbeddedSourceKey = namespace === "system-data-snapshots"
    && segments[rootIndex + 3] === "source"
    && segments[rootIndex + 4] === "uploads"
    && segments[rootIndex + 5] === "recipe-images"
    && segments.length === rootIndex + 8;
  if (!isRecipeImage && !isSnapshotAsset && !hasEmbeddedSourceKey) return null;

  let owner: string;
  let fileName: string;
  let snapshotId = "";
  try {
    owner = decodeURIComponent(segments[hasEmbeddedSourceKey ? rootIndex + 6 : rootIndex + 2] ?? "");
    fileName = decodeURIComponent(segments[hasEmbeddedSourceKey ? rootIndex + 7 : rootIndex + 3] ?? "");
    if (isSnapshotAsset || hasEmbeddedSourceKey) snapshotId = decodeURIComponent(segments[rootIndex + 2] ?? "");
  } catch {
    return null;
  }
  if ((isRecipeImage || hasEmbeddedSourceKey) && !/^\d+$/.test(owner)) return null;
  if ((isSnapshotAsset || hasEmbeddedSourceKey) && !/^[\da-f-]{36}$/i.test(snapshotId)) return null;
  if (!/^[^/]+\.(?:jpg|jpeg|png|webp)$/i.test(fileName) || owner === ".tmp" || fileName === ".") return null;

  const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  return {
    namespace,
    recipeId: isRecipeImage || hasEmbeddedSourceKey ? Number(owner) : null,
    fileName,
    extension: extension === "jpeg" ? "jpg" : extension
  };
}

function isCurrentName(fileName: string, recipeId: number, versionId: number, position: RecipeImagePosition) {
  const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  try {
    return fileName === recipeImageFileName(recipeId, versionId, position, extension === "jpeg" ? "jpg" : extension);
  } catch {
    return false;
  }
}

function isKnownLegacyName(fileName: string, recipeId: number) {
  const escapedRecipeId = String(recipeId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return /^[0-9a-f-]+\.(?:jpg|jpeg|png|webp)$/i.test(fileName)
    || new RegExp(`^${escapedRecipeId}(?:_[1-9]\\d*|-[1-9]\\d*|_(?:step|wiki-step)-[1-9]\\d*)?\\.(?:jpg|jpeg|png|webp)$`, "i").test(fileName);
}

function positionLabel(position: RecipeImagePosition) {
  if (position.type === "COVER") return "cover";
  return `${position.type.toLowerCase()}-${position.order}`;
}

function storageKeyFromUrl(imageUrl: string) {
  try {
    const segments = new URL(imageUrl, "https://recipe-image-migration.invalid").pathname.split("/").filter(Boolean);
    const uploadsIndex = segments.indexOf("uploads");
    if (uploadsIndex < 0) return null;
    return segments.slice(uploadsIndex).map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
}

async function addLocation(
  location: ImageLocation,
  objectTargets: Map<string, ObjectMove>,
  targetHashes: Map<string, string>,
  conflicts: string[]
): Promise<string | null> {
  const parsed = recipeImagePath(location.imageUrl);
  if (!parsed) return null;
  const recipeId = parsed.recipeId ?? location.recipeId;
  if (!recipeId) {
    conflicts.push(`快照资源无法关联到唯一菜谱 ID（版本 ${location.recipeVersionId}，${positionLabel(location.position)}）：${parsed.namespace}/${parsed.fileName}`);
    return null;
  }
  const targetFileName = recipeImageFileName(recipeId, location.recipeVersionId, location.position, parsed.extension);
  if (parsed.namespace === "recipe-images" && isCurrentName(parsed.fileName, recipeId, location.recipeVersionId, location.position)) {
    const targetKey = assetKey("uploads", "recipe-images", recipeId, targetFileName);
    try {
      await storage.readBuffer(targetKey);
    } catch {
      conflicts.push(`新格式图片对象不存在（版本 ${location.recipeVersionId}，${positionLabel(location.position)}）：${targetKey}`);
    }
    return null;
  }
  if (parsed.namespace === "recipe-images" && !isKnownLegacyName(parsed.fileName, recipeId)) {
    conflicts.push(`无法识别的历史图片文件名（版本 ${location.recipeVersionId}，${positionLabel(location.position)}）：${recipeId}/${parsed.fileName}`);
    return null;
  }

  const sourceKey = storageKeyFromUrl(location.imageUrl);
  if (!sourceKey) {
    conflicts.push(`图片 URL 无法转换成对象 key（版本 ${location.recipeVersionId}，${positionLabel(location.position)}）`);
    return null;
  }
  const targetKey = assetKey("uploads", "recipe-images", recipeId, targetFileName);
  try {
    const sourceHash = sha256(await storage.readBuffer(sourceKey));
    const priorTargetHash = targetHashes.get(targetKey);
    if (priorTargetHash && priorTargetHash !== sourceHash) {
      conflicts.push(`多个不同源图片映射到同一目标（版本 ${location.recipeVersionId}，${positionLabel(location.position)}）：${targetKey}`);
      return null;
    }
    targetHashes.set(targetKey, sourceHash);
    const existing = objectTargets.get(`${sourceKey}\n${targetKey}`);
    if (existing && existing.sourceHash !== sourceHash) {
      conflicts.push(`源对象读取结果不一致（版本 ${location.recipeVersionId}，${positionLabel(location.position)}）：${sourceKey}`);
      return null;
    }
    objectTargets.set(`${sourceKey}\n${targetKey}`, { sourceKey, targetKey, sourceHash });
    return storage.publicUrl({}, targetKey);
  } catch {
    conflicts.push(`源对象不存在或无法读取（版本 ${location.recipeVersionId}，${positionLabel(location.position)}）：${sourceKey}`);
    return null;
  }
}

async function buildPlan(): Promise<MigrationPlan> {
  const target = parseTargetArg();
  assertTargetConfiguration(target, false);
  const objects = new Map<string, ObjectMove>();
  const targetHashes = new Map<string, string>();
  const conflicts: string[] = [];
  const versions: VersionChange[] = [];
  const assistants: AssistantChange[] = [];
  const recipes: RecipeChange[] = [];
  const coverSnapshotMismatches: CoverSnapshotMismatch[] = [];
  const versionRecipeIds = new Map<number, Set<number>>();
  const addVersionRecipe = (versionId: number | null | undefined, recipeId: number) => {
    if (!versionId) return;
    const recipeIds = versionRecipeIds.get(versionId) ?? new Set<number>();
    recipeIds.add(recipeId);
    versionRecipeIds.set(versionId, recipeIds);
  };
  const [recipeRefs, collectionRefs, recommendationRefs] = await Promise.all([
    prisma.recipe.findMany({ select: { id: true, currentVersionId: true, originVersionId: true } }),
    prisma.recipeCollection.findMany({ select: { sourceRecipeId: true, sourceVersionId: true } }),
    prisma.recipeRecommendation.findMany({ select: { recipeId: true, sourceVersionId: true } })
  ]);
  for (const row of recipeRefs) {
    addVersionRecipe(row.currentVersionId, row.id);
    addVersionRecipe(row.originVersionId, row.id);
  }
  for (const row of collectionRefs) addVersionRecipe(row.sourceVersionId, row.sourceRecipeId);
  for (const row of recommendationRefs) addVersionRecipe(row.sourceVersionId, row.recipeId);
  const uniqueRecipeForVersion = (versionId: number) => {
    const recipeIds = versionRecipeIds.get(versionId);
    if (recipeIds?.size === 1) return Array.from(recipeIds)[0];
    if ((recipeIds?.size ?? 0) > 1) {
      conflicts.push(`内容版本 ${versionId} 同时关联多个菜谱 ID，无法安全命名图片：${Array.from(recipeIds!).sort((a, b) => a - b).join(",")}`);
    }
    return null;
  };
  const recipeIdForImage = (versionId: number, imageUrl: string) =>
    recipeImagePath(imageUrl)?.recipeId ?? uniqueRecipeForVersion(versionId);

  let cursor = 0;
  while (true) {
    const rows = await prisma.recipeContentVersion.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      take: batchSize,
      select: {
        id: true,
        imagesJson: true,
        stepsJson: true,
        cookAssistant: { select: { snapshotJson: true } }
      }
    });
    if (!rows.length) break;

    for (const row of rows) {
      cursor = row.id;
      const originalImages = jsonClone(row.imagesJson);
      const originalSteps = jsonClone(row.stepsJson);
      const originalAssistant = row.cookAssistant?.snapshotJson == null ? null : jsonClone(row.cookAssistant.snapshotJson);
      const imageSnapshot = jsonClone(originalImages);
      const stepsSnapshot = jsonClone(originalSteps);
      const assistantSnapshot = originalAssistant === null ? null : jsonClone(originalAssistant);
      if (isRecord(imageSnapshot) && typeof imageSnapshot.coverImageUrl === "string") {
        imageSnapshot.coverImageUrl = await addLocation(
          { recipeVersionId: row.id, recipeId: recipeIdForImage(row.id, imageSnapshot.coverImageUrl), position: { type: "COVER" }, imageUrl: imageSnapshot.coverImageUrl },
          objects, targetHashes, conflicts
        ) ?? imageSnapshot.coverImageUrl;
      }
      if (Array.isArray(stepsSnapshot)) {
        for (const [index, step] of stepsSnapshot.entries()) {
          if (!isRecord(step) || typeof step.imageUrl !== "string") continue;
          step.imageUrl = await addLocation(
            { recipeVersionId: row.id, recipeId: recipeIdForImage(row.id, step.imageUrl), position: { type: "STEP", order: index + 1 }, imageUrl: step.imageUrl },
            objects, targetHashes, conflicts
          ) ?? step.imageUrl;
        }
      }
      if (isRecord(imageSnapshot) && Array.isArray(imageSnapshot.stepImages)) {
        for (const [index, stepImage] of imageSnapshot.stepImages.entries()) {
          if (!isRecord(stepImage) || typeof stepImage.imageUrl !== "string") continue;
          const stepIndex = Number.isInteger(stepImage.index) ? Number(stepImage.index) : index;
          if (stepIndex < 0) continue;
          stepImage.imageUrl = await addLocation(
            { recipeVersionId: row.id, recipeId: recipeIdForImage(row.id, stepImage.imageUrl), position: { type: "STEP", order: stepIndex + 1 }, imageUrl: stepImage.imageUrl },
            objects, targetHashes, conflicts
          ) ?? stepImage.imageUrl;
        }
      }
      if (isRecord(assistantSnapshot) && Array.isArray(assistantSnapshot.steps)) {
        for (const step of assistantSnapshot.steps) {
          if (!isRecord(step) || typeof step.imageUrl !== "string" || !Number.isInteger(step.order) || Number(step.order) <= 0) continue;
          step.imageUrl = await addLocation(
            { recipeVersionId: row.id, recipeId: recipeIdForImage(row.id, step.imageUrl), position: { type: "WIKI_STEP", order: Number(step.order) }, imageUrl: step.imageUrl },
            objects, targetHashes, conflicts
          ) ?? step.imageUrl;
        }
      }

      if (!isDeepStrictEqual(originalImages, imageSnapshot) || !isDeepStrictEqual(originalSteps, stepsSnapshot)) {
        versions.push({ id: row.id, imagesBefore: originalImages, imagesAfter: imageSnapshot as Prisma.JsonValue, stepsBefore: originalSteps, stepsAfter: stepsSnapshot as Prisma.JsonValue });
      }
      if (originalAssistant !== null && !isDeepStrictEqual(originalAssistant, assistantSnapshot)) {
        assistants.push({ recipeVersionId: row.id, before: originalAssistant, after: assistantSnapshot as Prisma.JsonValue });
      }
    }
  }

  cursor = 0;
  while (true) {
    const rows = await prisma.recipe.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      take: batchSize,
      select: {
        id: true,
        currentVersionId: true,
        originVersionId: true,
        coverImageUrl: true,
        originCoverImageUrl: true,
        currentVersion: { select: { imagesJson: true } }
      }
    });
    if (!rows.length) break;
    for (const row of rows) {
      cursor = row.id;
      const currentImages = row.currentVersion.imagesJson;
      const currentCover = isRecord(currentImages) && typeof currentImages.coverImageUrl === "string"
        ? currentImages.coverImageUrl
        : null;
      if (row.coverImageUrl && currentCover !== row.coverImageUrl) {
        const sourceKey = storageKeyFromUrl(row.coverImageUrl);
        let sourceReadable = false;
        if (sourceKey) {
          try {
            await storage.readBuffer(sourceKey);
            sourceReadable = true;
          } catch {
            sourceReadable = false;
          }
        }
        coverSnapshotMismatches.push({ recipeId: row.id, contentVersionId: row.currentVersionId, sourceKey, sourceReadable });
      }
      const coverAfter = row.coverImageUrl
        ? await addLocation({ recipeVersionId: row.currentVersionId, recipeId: row.id, position: { type: "COVER" }, imageUrl: row.coverImageUrl }, objects, targetHashes, conflicts) ?? row.coverImageUrl
        : null;
      const originCoverAfter = row.originCoverImageUrl && row.originVersionId
        ? await addLocation({ recipeVersionId: row.originVersionId, recipeId: row.id, position: { type: "COVER" }, imageUrl: row.originCoverImageUrl }, objects, targetHashes, conflicts) ?? row.originCoverImageUrl
        : row.originCoverImageUrl;
      if (coverAfter !== row.coverImageUrl || originCoverAfter !== row.originCoverImageUrl) {
        recipes.push({ id: row.id, coverBefore: row.coverImageUrl, coverAfter, originCoverBefore: row.originCoverImageUrl, originCoverAfter });
      }
    }
  }

  const objectList = Array.from(objects.values());
  for (const object of objectList) {
    try {
      const targetBuffer = await storage.readBuffer(object.targetKey);
      if (sha256(targetBuffer) !== object.sourceHash) conflicts.push(`目标对象已存在但内容不同：${object.targetKey}`);
    } catch {
      // The destination will be copied during --apply.
    }
  }

  return {
    format: "recipe-image-key-migration.v2",
    target,
    targetFingerprint: targetFingerprint(),
    createdAt: new Date().toISOString(),
    objects: objectList,
    versions,
    assistants,
    recipes,
    coverSnapshotMismatches,
    conflicts: Array.from(new Set(conflicts))
  };
}

async function applyPlan(plan: MigrationPlan) {
  if (plan.format !== "recipe-image-key-migration.v2") throw new Error("迁移清单格式不支持");
  assertExecutionTarget(plan);
  if (plan.conflicts.length) throw new Error(`迁移清单包含 ${plan.conflicts.length} 个冲突，拒绝执行`);

  for (const object of plan.objects) {
    let targetHash: string | null = null;
    try {
      targetHash = sha256(await storage.readBuffer(object.targetKey));
    } catch {
      // Target does not exist yet.
    }
    if (targetHash && targetHash !== object.sourceHash) throw new Error(`目标对象冲突：${object.targetKey}`);
    if (!targetHash) {
      const sourceHash = sha256(await storage.readBuffer(object.sourceKey));
      if (sourceHash !== object.sourceHash) throw new Error(`源对象在生成清单后发生变化：${object.sourceKey}`);
      await storage.copyObject(object.sourceKey, object.targetKey);
      const copiedHash = sha256(await storage.readBuffer(object.targetKey));
      if (copiedHash !== object.sourceHash) throw new Error(`复制后校验失败：${object.targetKey}`);
    }
  }

  for (const change of plan.versions) {
    await prisma.$transaction(async tx => {
      const current = await tx.recipeContentVersion.findUnique({ where: { id: change.id }, select: { imagesJson: true, stepsJson: true } });
      if (!current) throw new Error(`内容版本不存在：${change.id}`);
      if (isDeepStrictEqual(current.imagesJson, change.imagesAfter) && isDeepStrictEqual(current.stepsJson, change.stepsAfter)) return;
      if (!isDeepStrictEqual(current.imagesJson, change.imagesBefore) || !isDeepStrictEqual(current.stepsJson, change.stepsBefore)) {
        throw new Error(`内容版本已变化，拒绝覆盖：${change.id}`);
      }
      await tx.recipeContentVersion.update({ where: { id: change.id }, data: { imagesJson: toJson(change.imagesAfter), stepsJson: toJson(change.stepsAfter) } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  for (const change of plan.assistants) {
    await prisma.$transaction(async tx => {
      const current = await tx.recipeCookAssistant.findUnique({ where: { recipeVersionId: change.recipeVersionId }, select: { snapshotJson: true } });
      if (!current) throw new Error(`Wiki 助理快照不存在：${change.recipeVersionId}`);
      if (isDeepStrictEqual(current.snapshotJson, change.after)) return;
      if (!isDeepStrictEqual(current.snapshotJson, change.before)) throw new Error(`Wiki 快照已变化，拒绝覆盖：${change.recipeVersionId}`);
      await tx.recipeCookAssistant.update({ where: { recipeVersionId: change.recipeVersionId }, data: { snapshotJson: toJson(change.after) } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  for (const change of plan.recipes) {
    await prisma.$transaction(async tx => {
      const current = await tx.recipe.findUnique({ where: { id: change.id }, select: { coverImageUrl: true, originCoverImageUrl: true } });
      if (!current) throw new Error(`菜谱不存在：${change.id}`);
      if (current.coverImageUrl === change.coverAfter && current.originCoverImageUrl === change.originCoverAfter) return;
      if (current.coverImageUrl !== change.coverBefore || current.originCoverImageUrl !== change.originCoverBefore) {
        throw new Error(`菜谱图片已变化，拒绝覆盖：${change.id}`);
      }
      await tx.recipe.update({
        where: { id: change.id },
        data: { coverImageUrl: change.coverAfter, originCoverImageUrl: change.originCoverAfter, version: { increment: 1 } }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

async function rollbackPlan(plan: MigrationPlan) {
  if (plan.format !== "recipe-image-key-migration.v2") throw new Error("迁移清单格式不支持");
  assertExecutionTarget(plan);

  for (const change of [...plan.recipes].reverse()) {
    await prisma.$transaction(async tx => {
      const current = await tx.recipe.findUnique({ where: { id: change.id }, select: { coverImageUrl: true, originCoverImageUrl: true } });
      if (!current) throw new Error(`菜谱不存在：${change.id}`);
      if (current.coverImageUrl === change.coverBefore && current.originCoverImageUrl === change.originCoverBefore) return;
      if (current.coverImageUrl !== change.coverAfter || current.originCoverImageUrl !== change.originCoverAfter) {
        throw new Error(`菜谱图片已变化，拒绝回滚：${change.id}`);
      }
      await tx.recipe.update({
        where: { id: change.id },
        data: { coverImageUrl: change.coverBefore, originCoverImageUrl: change.originCoverBefore, version: { increment: 1 } }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  for (const change of [...plan.assistants].reverse()) {
    await prisma.$transaction(async tx => {
      const current = await tx.recipeCookAssistant.findUnique({ where: { recipeVersionId: change.recipeVersionId }, select: { snapshotJson: true } });
      if (!current) throw new Error(`Wiki 助理快照不存在：${change.recipeVersionId}`);
      if (isDeepStrictEqual(current.snapshotJson, change.before)) return;
      if (!isDeepStrictEqual(current.snapshotJson, change.after)) throw new Error(`Wiki 快照已变化，拒绝回滚：${change.recipeVersionId}`);
      await tx.recipeCookAssistant.update({ where: { recipeVersionId: change.recipeVersionId }, data: { snapshotJson: toJson(change.before) } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  for (const change of [...plan.versions].reverse()) {
    await prisma.$transaction(async tx => {
      const current = await tx.recipeContentVersion.findUnique({ where: { id: change.id }, select: { imagesJson: true, stepsJson: true } });
      if (!current) throw new Error(`内容版本不存在：${change.id}`);
      if (isDeepStrictEqual(current.imagesJson, change.imagesBefore) && isDeepStrictEqual(current.stepsJson, change.stepsBefore)) return;
      if (!isDeepStrictEqual(current.imagesJson, change.imagesAfter) || !isDeepStrictEqual(current.stepsJson, change.stepsAfter)) {
        throw new Error(`内容版本已变化，拒绝回滚：${change.id}`);
      }
      await tx.recipeContentVersion.update({
        where: { id: change.id },
        data: { imagesJson: toJson(change.imagesBefore), stepsJson: toJson(change.stepsBefore) }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

function summarize(plan: MigrationPlan) {
  return {
    format: plan.format,
    target: plan.target,
    targetFingerprint: plan.targetFingerprint,
    createdAt: plan.createdAt,
    objectCount: plan.objects.length,
    versionCount: plan.versions.length,
    wikiSnapshotCount: plan.assistants.length,
    recipeCount: plan.recipes.length,
    coverSnapshotMismatchCount: plan.coverSnapshotMismatches?.length ?? 0,
    readableCoverSnapshotCount: plan.coverSnapshotMismatches?.filter(item => item.sourceReadable).length ?? 0,
    unreadableCoverSnapshotCount: plan.coverSnapshotMismatches?.filter(item => !item.sourceReadable).length ?? 0,
    conflictCount: plan.conflicts.length,
    conflicts: plan.conflicts
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rollback = process.argv.includes("--rollback");
  const manifestArg = process.argv.find(argument => argument.startsWith("--manifest="))?.slice("--manifest=".length);
  if (apply && rollback) throw new Error("--apply 和 --rollback 不能同时使用");
  if (rollback && !manifestArg) throw new Error("回滚迁移必须指定 --manifest=<清单路径>");

  let plan: MigrationPlan;
  if (rollback || (apply && manifestArg)) {
    plan = JSON.parse(await readFile(resolve(manifestArg as string), "utf8")) as MigrationPlan;
    if (apply) await applyPlan(plan);
    else await rollbackPlan(plan);
    console.log(JSON.stringify({ ...summarize(plan), applied: apply, rolledBack: rollback }, null, 2));
    return;
  }

  plan = await buildPlan();
  if (manifestArg) {
    const manifestPath = resolve(manifestArg);
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  }
  if (apply) await applyPlan(plan);
  console.log(JSON.stringify({ ...summarize(plan), manifest: manifestArg ? resolve(manifestArg) : null, applied: apply }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
