import type { Prisma } from "@prisma/client";
import type { RecipeAmountSnapshot, RecipeContentSnapshot, RecipeDraftContentInput } from "../../contracts/types";
import { sizeOfJson } from "../../common/storage-ledger";

export function buildSearchKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function cleanDraftContent(content: RecipeDraftContentInput): RecipeDraftContentInput {
  return {
    name: content.name.trim(),
    story: content.story?.trim() || null,
    categoryId: content.categoryId,
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
  return [content.name, content.story ?? ""].join(" ").trim();
}

export function buildRecipeSearchText(content: RecipeContentSnapshot) {
  return [content.name, content.story ?? "", ...content.ingredients.map(item => item.ingredientName)].join(" ").trim();
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
    tips: version.tips,
    ingredients: fromJson<RecipeContentSnapshot["ingredients"]>(version.ingredientsJson),
    steps: steps.map(item => ({
      text: item.text,
      imageUrl: item.imageUrl ?? null
    }))
  };
}

export function formatRecipeAmount(amount: RecipeAmountSnapshot) {
  if (amount.kind === "FUZZY") return amount.text;
  return `${amount.quantity}${amount.unitName}`;
}
