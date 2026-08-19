import type { Prisma } from "@prisma/client";
import type {
  RecipeAmountSnapshot,
  RecipeAssistantSnapshot,
  RecipeAssistantStep,
  RecipeAssistantStepPhase,
  RecipeContentSnapshot,
  RecipeDraftContentInput
} from "../../contracts/types";
import { sizeOfJson } from "../../common/storage-ledger";

export function buildSearchKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function cleanDraftContent(content: RecipeDraftContentInput): RecipeDraftContentInput {
  return {
    name: content.name.trim(),
    story: content.story?.trim() || null,
    categoryId: content.categoryId,
    inspirationCategoryId: content.inspirationCategoryId ?? null,
    sceneIds: Array.from(new Set(content.sceneIds)),
    originVersionId: content.originVersionId ?? null,
    originCoverImageUrl: content.originCoverImageUrl?.trim() || null,
    coverUploadId: content.coverUploadId ?? null,
    coverImageUrl: content.coverImageUrl ?? null,
    baseServings: content.baseServings ?? null,
    difficulty: content.difficulty ?? null,
    duration: content.duration ?? null,
    tips: content.tips?.trim() || null,
    ingredients: content.ingredients.map(item => ({
      ingredientId: item.ingredientId,
      name: item.name.trim(),
      quantity: item.quantity.trim(),
      unitId: item.unitId ?? null,
      fuzzyText: item.fuzzyText ?? null,
      categoryId: item.categoryId ?? null,
      defaultUnitId: item.defaultUnitId ?? null,
      source: item.source ?? null
    })),
    steps: content.steps.map(item => ({
      slotKey: item.slotKey.trim(),
      text: item.text.trim(),
      uploadId: item.uploadId ?? null,
      imageUrl: item.imageUrl ?? null
    }))
  };
}

export function buildDraftSearchText(content: RecipeDraftContentInput) {
  return [
    content.name,
    content.story ?? "",
    ...content.ingredients.map(item => item.name).filter(name => Boolean(name.trim()))
  ]
    .join(" ")
    .trim();
}

export function buildRecipeSearchText(content: RecipeContentSnapshot) {
  return [content.name, content.story ?? "", ...content.ingredients.map(item => item.ingredientName)].join(" ").trim();
}

export function draftCoverImageUrl(value: unknown) {
  const content = fromJson<{ coverImageUrl?: string | null }>(value);
  const coverImageUrl = content.coverImageUrl?.trim();
  return coverImageUrl || null;
}

export function draftSizeBytes(content: RecipeDraftContentInput) {
  return sizeOfJson(content);
}

export function contentSizeBytes(content: RecipeContentSnapshot) {
  return sizeOfJson(content);
}

export function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function fromJson<T>(value: unknown): T {
  return value as T;
}

export function versionToContent(version: {
  name: string;
  story: string | null;
  baseServings: number;
  difficulty: string | null;
  duration: string | null;
  estimatedCalories?: number | null;
  tips: string | null;
  ingredientsJson: unknown;
  stepsJson: unknown;
}): RecipeContentSnapshot {
  const steps = fromJson<Array<{ text: string; imageUrl?: string | null }>>(version.stepsJson);
  return {
    name: version.name,
    story: version.story,
    baseServings: version.baseServings,
    difficulty: version.difficulty as RecipeContentSnapshot["difficulty"],
    duration: version.duration as RecipeContentSnapshot["duration"],
    estimatedCalories: version.estimatedCalories ?? null,
    tips: version.tips,
    ingredients: fromJson<RecipeContentSnapshot["ingredients"]>(version.ingredientsJson),
    steps: steps.map(item => ({
      text: item.text,
      imageUrl: item.imageUrl ?? null
    }))
  };
}

function summarizeRecipeAssistantTitle(text: string, phase: RecipeAssistantStepPhase, index: number) {
  const segment = text
    .split(/[，。；;！!?？\n]/)
    .map(item => item.trim())
    .find(Boolean);
  if (segment) {
    return segment.length > 14 ? `${segment.slice(0, 14)}...` : segment;
  }
  if (phase === "PREP") return `准备步骤 ${index + 1}`;
  if (phase === "SERVE") return `收尾步骤 ${index + 1}`;
  return `烹饪步骤 ${index + 1}`;
}

function resolveRecipeAssistantPhase(text: string, index: number, total: number): RecipeAssistantStepPhase {
  const prepKeywords = ["准备", "备", "切", "洗", "浸泡", "泡发", "腌", "调汁", "剁", "拍", "去皮", "焯水", "解冻", "打散", "淘洗", "沥干"];
  const serveKeywords = ["出锅", "装盘", "盛出", "上桌", "摆盘", "撒上", "淋上", "即可", "享用", "完成"];
  if (serveKeywords.some(keyword => text.includes(keyword)) && index >= Math.max(0, total - 2)) {
    return "SERVE";
  }
  if (prepKeywords.some(keyword => text.includes(keyword))) {
    return "PREP";
  }
  return "COOK";
}

function parseRecipeAssistantDurationMinutes(text: string) {
  let totalMinutes = 0;
  const matches = text.matchAll(/(\d+)\s*(小时|分钟)/g);
  for (const match of matches) {
    const value = Number(match[1] ?? 0);
    if (!Number.isFinite(value) || value <= 0) continue;
    totalMinutes += match[2] === "小时" ? value * 60 : value;
  }
  if (totalMinutes === 0 && text.includes("半小时")) {
    totalMinutes = 30;
  }
  return totalMinutes > 0 ? totalMinutes : null;
}

function formatRecipeAssistantDuration(totalMinutes: number | null) {
  if (!totalMinutes || totalMinutes <= 0) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}小时${minutes}分钟`;
  if (hours > 0) return `${hours}小时`;
  return `${minutes}分钟`;
}

type RecipeAssistantSnapshotBody = Omit<RecipeAssistantSnapshot, "generatedAt">;

export function buildRecipeAssistantSnapshot(content: RecipeContentSnapshot): RecipeAssistantSnapshotBody {
  const steps: RecipeAssistantStep[] = [];
  let totalMinutes = 0;
  let hasDuration = false;

  content.steps.forEach((item, index) => {
    const detail = item.text.trim();
    if (!detail && !item.imageUrl) return;
    const phase = resolveRecipeAssistantPhase(detail, index, content.steps.length);
    const durationMinutes = parseRecipeAssistantDurationMinutes(detail);
    if (durationMinutes) {
      totalMinutes += durationMinutes;
      hasDuration = true;
    }
    steps.push({
      order: steps.length + 1,
      phase,
      title: summarizeRecipeAssistantTitle(detail, phase, index),
      detail: detail || "按当前图片对应的步骤继续处理。",
      imageUrl: item.imageUrl ?? null,
      durationText: formatRecipeAssistantDuration(durationMinutes)
    });
  });

  const prepStepCount = steps.filter(item => item.phase === "PREP").length;
  const serveStepCount = steps.filter(item => item.phase === "SERVE").length;
  const cookStepCount = steps.length - prepStepCount - serveStepCount;

  return {
    summary: {
      stepCount: steps.length,
      prepStepCount,
      cookStepCount,
      serveStepCount,
      totalDurationText: hasDuration ? formatRecipeAssistantDuration(totalMinutes) : null
    },
    steps
  };
}

export function versionAssistantToSnapshot(
  record: { generatedAt: Date | null; snapshotJson: unknown } | null | undefined
): RecipeAssistantSnapshot | null {
  if (!record?.generatedAt || record.snapshotJson == null) return null;
  const snapshot = fromJson<RecipeAssistantSnapshotBody>(record.snapshotJson);
  return {
    generatedAt: record.generatedAt.toISOString(),
    summary: snapshot.summary,
    steps: snapshot.steps
  };
}

export function formatRecipeAmount(amount: RecipeAmountSnapshot) {
  if (amount.kind === "FUZZY") return amount.text;
  return `${amount.quantity}${amount.unitName}`;
}
