import type { Prisma } from "@prisma/client";
import type { RecipeContentInput, RecipeContentPayload } from "../../contracts/types";
import { sizeOfJson, sumImageBytes } from "../../common/storage-ledger";

export interface RecipeOverrideData {
  name?: string;
  ingredients?: RecipeContentPayload["ingredients"];
  steps?: RecipeContentPayload["steps"];
  servings?: string | null;
  durationMinutes?: number | null;
}

export function normalizeRecipeContent(content: RecipeContentInput): RecipeContentInput {
  return {
    name: content.name.trim(),
    ingredients: content.ingredients.map(item => ({
      name: item.name.trim(),
      amount: item.amount.trim()
    })),
    steps: content.steps.map(item => ({
      content: item.content.trim()
    })),
    servings: content.servings?.trim() || null,
    durationMinutes: content.durationMinutes ?? null
  };
}

export function buildRecipeSearchText(content: RecipeContentPayload) {
  return [content.name, ...content.ingredients.map(item => item.name)].join(" ").trim();
}

export function structureSizeBytes(content: RecipeContentPayload) {
  return sizeOfJson({
    name: content.name,
    ingredients: content.ingredients,
    steps: content.steps,
    servings: content.servings,
    durationMinutes: content.durationMinutes,
    imageMeta: content.images.map(item => ({
      key: item.key,
      url: item.url
    }))
  });
}

export function imageOnlyBytes(content: RecipeContentPayload) {
  return sumImageBytes(content.images);
}

export function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function fromJson<T>(value: unknown): T {
  return value as T;
}

export function versionToContent(version: {
  name: string;
  ingredientsJson: unknown;
  stepsJson: unknown;
  servings: string | null;
  durationMinutes: number | null;
  imagesJson: unknown;
}): RecipeContentPayload {
  return {
    name: version.name,
    ingredients: fromJson<RecipeContentPayload["ingredients"]>(version.ingredientsJson),
    steps: fromJson<RecipeContentPayload["steps"]>(version.stepsJson),
    servings: version.servings,
    durationMinutes: version.durationMinutes,
    images: fromJson<RecipeContentPayload["images"]>(version.imagesJson)
  };
}

export function mergeRecipeContent(
  base: RecipeContentPayload,
  overrideData: RecipeOverrideData | null,
  hiddenBaseImages: string[]
) {
  const hiddenKeys = new Set(hiddenBaseImages);
  return {
    name: overrideData?.name ?? base.name,
    ingredients: overrideData?.ingredients ?? base.ingredients,
    steps: overrideData?.steps ?? base.steps,
    servings: overrideData?.servings ?? base.servings,
    durationMinutes: overrideData?.durationMinutes ?? base.durationMinutes,
    images: base.images.filter(item => !hiddenKeys.has(item.key))
  } satisfies RecipeContentPayload;
}
