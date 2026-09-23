import { Prisma } from "@prisma/client";

export type InventoryAvailabilityState = "READY" | "SHORTAGE" | "UNKNOWN" | "MISSING";
export type RecipeGapState = InventoryAvailabilityState;

export interface RecipeIngredientGapInput {
  required: Prisma.Decimal | number | string;
  unitId: number | null;
  exactStock: Prisma.Decimal | number | string | null;
  exactStockUnitId: number | null;
  hasRoughStock: boolean;
}

export interface RecipeConsumptionSource {
  recipeTitle: string;
  recipeVersionId: number | null;
}

export interface RecipeConsumptionLine {
  ingredientKey: string;
  ingredientId: number | null;
  ingredientName: string;
  unitId: number;
  quantity: Prisma.Decimal | number | string;
  recipeTitle: string;
  recipeVersionId: number | null;
  precision: "EXACT" | "FUZZY";
}

export interface MergedRecipeConsumptionLine {
  ingredientKey: string;
  ingredientId: number | null;
  quantity: string;
  unitId: number;
  sources: RecipeConsumptionSource[];
}

export interface RecipeConsumptionMergeResult {
  exactLines: MergedRecipeConsumptionLine[];
  skippedFuzzySources: string[];
}

export interface InventoryUsageSummaryInput {
  updatedCount: number;
  unknownCount: number;
  shortageCount: number;
  skippedFuzzyCount: number;
}

export interface InventoryUsageSummary extends InventoryUsageSummaryInput {
  message: string;
}

export interface AutomaticGapCandidate {
  sourceKey: string;
  state: RecipeGapState;
}

export interface AutomaticGapLineInput {
  sourceKey: string;
  ingredientId: number;
  ingredientName: string;
  requiredQuantity: Prisma.Decimal | number | string;
  requiredUnitId: number | null;
  exactStock: Prisma.Decimal | number | string | null;
  exactStockUnitId: number | null;
  hasRoughStock: boolean;
}

export interface AutomaticGapLine extends AutomaticGapCandidate {
  ingredientId: number;
  ingredientName: string;
  quantity: string | null;
}

export interface ShoppingSourceFact {
  sourceKey: string;
  sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
  status: "OPEN" | "BOUGHT" | "DELETED";
  removedByUserId?: number | null;
}

export interface ShoppingStatusUpdate {
  status: "OPEN" | "BOUGHT" | "DELETED";
  checkedAt: Date | null;
  checkedByUserId: number | null;
  removedAt: Date | null;
  removedByUserId: number | null;
}

export interface AutomaticGapWritePlan {
  createdSourceKeys: string[];
  pendingKeys: string[];
  skippedSourceKeys: string[];
  manualItemsChanged: number;
}

function decimal(value: Prisma.Decimal | number | string) {
  return new Prisma.Decimal(value);
}

export function classifyRecipeIngredientGap(input: RecipeIngredientGapInput): RecipeGapState {
  const required = decimal(input.required);
  const exactStock = input.exactStock === null ? null : decimal(input.exactStock);
  const canCompare = input.unitId !== null
    && input.exactStockUnitId !== null
    && input.unitId === input.exactStockUnitId
    && exactStock !== null;

  if (canCompare) {
    if (exactStock!.gte(required)) return "READY";
    if (input.hasRoughStock) return "UNKNOWN";
    return "SHORTAGE";
  }

  if (input.hasRoughStock || exactStock !== null) return "UNKNOWN";
  return "MISSING";
}

export function buildAutomaticGapLine(input: AutomaticGapLineInput): AutomaticGapLine {
  const state = classifyRecipeIngredientGap({
    required: input.requiredQuantity,
    unitId: input.requiredUnitId,
    exactStock: input.exactStock,
    exactStockUnitId: input.exactStockUnitId,
    hasRoughStock: input.hasRoughStock
  });
  const required = decimal(input.requiredQuantity);
  const quantity = state === "MISSING"
    ? required.toString()
    : state === "SHORTAGE" && input.exactStock !== null
      ? required.sub(input.exactStock).toString()
      : null;

  return {
    sourceKey: input.sourceKey,
    ingredientId: input.ingredientId,
    ingredientName: input.ingredientName,
    state,
    quantity
  };
}

export function buildShoppingStatusUpdate(
  status: ShoppingStatusUpdate["status"],
  userId: number,
  now: Date
): ShoppingStatusUpdate {
  return {
    status,
    checkedAt: status === "BOUGHT" ? now : null,
    checkedByUserId: status === "BOUGHT" ? userId : null,
    removedAt: status === "DELETED" ? now : null,
    removedByUserId: status === "DELETED" ? userId : null
  };
}

export function mergeRecipeConsumptionLines(lines: RecipeConsumptionLine[]): RecipeConsumptionMergeResult {
  const exactLines = new Map<string, MergedRecipeConsumptionLine>();
  const skippedFuzzySources: string[] = [];

  for (const line of lines) {
    if (line.precision === "FUZZY") {
      if (!skippedFuzzySources.includes(line.ingredientName)) skippedFuzzySources.push(line.ingredientName);
      continue;
    }

    const key = `${line.ingredientKey}:${line.unitId}`;
    const current = exactLines.get(key);
    const source = { recipeTitle: line.recipeTitle, recipeVersionId: line.recipeVersionId };
    if (current) {
      current.quantity = decimal(current.quantity).add(line.quantity).toString();
      if (!current.sources.some(item => item.recipeTitle === source.recipeTitle && item.recipeVersionId === source.recipeVersionId)) {
        current.sources.push(source);
      }
      continue;
    }

    exactLines.set(key, {
      ingredientKey: line.ingredientKey,
      ingredientId: line.ingredientId,
      quantity: decimal(line.quantity).toString(),
      unitId: line.unitId,
      sources: [source]
    });
  }

  return {
    exactLines: [...exactLines.values()],
    skippedFuzzySources
  };
}

export function buildInventoryUsageSummary(input: InventoryUsageSummaryInput): InventoryUsageSummary {
  const details: string[] = [];
  if (input.unknownCount > 0) details.push(`${input.unknownCount} 项数量未记录`);
  if (input.shortageCount > 0) details.push(`${input.shortageCount} 项库存不足`);
  if (input.skippedFuzzyCount > 0) details.push(`${input.skippedFuzzyCount} 项适量未扣减`);

  const message = `已按菜谱用量估算，更新 ${input.updatedCount} 项${details.length ? `，其中 ${details.join("、")}` : ""}`;
  return { ...input, message };
}

export function planAutomaticGapWrite(
  candidates: AutomaticGapCandidate[],
  existingSources: ShoppingSourceFact[]
): AutomaticGapWritePlan {
  const existingKeys = new Set(
    existingSources
      .map(source => source.sourceKey)
      .filter((sourceKey): sourceKey is string => Boolean(sourceKey))
  );
  const createdSourceKeys: string[] = [];
  const pendingKeys: string[] = [];
  const skippedSourceKeys: string[] = [];
  const seenKeys = new Set<string>();

  for (const candidate of candidates) {
    if (seenKeys.has(candidate.sourceKey)) continue;
    seenKeys.add(candidate.sourceKey);

    if (existingKeys.has(candidate.sourceKey)) {
      skippedSourceKeys.push(candidate.sourceKey);
      continue;
    }
    if (candidate.state === "UNKNOWN") {
      pendingKeys.push(candidate.sourceKey);
      continue;
    }
    if (candidate.state === "READY") {
      skippedSourceKeys.push(candidate.sourceKey);
      continue;
    }
    createdSourceKeys.push(candidate.sourceKey);
  }

  return {
    createdSourceKeys,
    pendingKeys,
    skippedSourceKeys,
    manualItemsChanged: 0
  };
}
