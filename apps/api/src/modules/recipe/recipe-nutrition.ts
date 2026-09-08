import { Prisma, type IngredientNutrientMappingStatus, type RecipeNutritionStatus as DbRecipeNutritionStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import type { RecipeContentSnapshot, RecipeNutritionMetrics, RecipeNutritionSummary, UUID } from "../../contracts/types";
import { fromJson, toJson } from "./recipe-content";

type RecipeDb = Prisma.TransactionClient | PrismaService;
type MetricKey = keyof RecipeNutritionMetrics;

type MappingRow = {
  ingredientId: UUID;
  status: IngredientNutrientMappingStatus;
  nutrientFood: {
    calories: number | null;
    protein: number | null;
    fat: number | null;
    carbohydrate: number | null;
  } | null;
};

type ConversionRow = {
  ingredientId: UUID;
  unitId: UUID;
  gramsPerUnit: number;
};

type QuantityResolution = {
  grams: number;
  usedManualConversion: boolean;
};

const metricKeys: MetricKey[] = ["calories", "protein", "fat", "carbohydrate"];
const emptyMetrics: RecipeNutritionMetrics = {
  calories: null,
  protein: null,
  fat: null,
  carbohydrate: null
};

function roundMetric(key: MetricKey, value: number) {
  if (key === "calories") return Math.round(value);
  return Math.round(value * 10) / 10;
}

function createEmptySummary(sourceVersion: string | null, status: RecipeNutritionSummary["status"]): RecipeNutritionSummary {
  return {
    status,
    qualityLabel: status === "NONE" ? null : "当前数据不足",
    perServing: null,
    perRecipe: null,
    calculatedAt: null,
    sourceVersion
  };
}

function mapQualityLabel(status: RecipeNutritionSummary["status"]): RecipeNutritionSummary["qualityLabel"] {
  if (status === "COMPLETE") return "估算较完整";
  if (status === "ESTIMATED") return "结果为估算";
  if (status === "INSUFFICIENT") return "当前数据不足";
  return null;
}

function normalizeMetrics(totals: Partial<Record<MetricKey, number>>): RecipeNutritionMetrics | null {
  let hasValue = false;
  const result = { ...emptyMetrics };
  for (const key of metricKeys) {
    const current = totals[key];
    if (typeof current === "number" && Number.isFinite(current)) {
      result[key] = roundMetric(key, current);
      hasValue = true;
    }
  }
  return hasValue ? result : null;
}

function resolveQuantity(
  ingredientId: UUID,
  amount: RecipeContentSnapshot["ingredients"][number]["amount"],
  conversionMap: Map<string, ConversionRow>
): QuantityResolution | null {
  if (amount.kind !== "EXACT") return null;
  const quantity = Number(amount.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  if (amount.unitName === "克") {
    return { grams: quantity, usedManualConversion: false };
  }
  if (amount.unitName === "千克") {
    return { grams: quantity * 1000, usedManualConversion: false };
  }
  if (amount.unitName === "毫升") {
    return { grams: quantity, usedManualConversion: false };
  }
  if (amount.unitName === "升") {
    return { grams: quantity * 1000, usedManualConversion: false };
  }

  const conversion = conversionMap.get(`${ingredientId}:${amount.unitId}`);
  if (!conversion || !Number.isFinite(conversion.gramsPerUnit) || conversion.gramsPerUnit <= 0) {
    return null;
  }

  return {
    grams: quantity * conversion.gramsPerUnit,
    usedManualConversion: true
  };
}

function buildSummaryFromRows(
  content: RecipeContentSnapshot,
  sourceVersion: string,
  mappingRows: MappingRow[],
  conversionRows: ConversionRow[]
): RecipeNutritionSummary & { coverageRate: number | null } {
  if (!content.ingredients.length) {
    return {
      ...createEmptySummary(sourceVersion, "NONE"),
      coverageRate: 0
    };
  }

  const mappingMap = new Map(mappingRows.map(item => [item.ingredientId, item]));
  const conversionMap = new Map(conversionRows.map(item => [`${item.ingredientId}:${item.unitId}`, item]));
  const totals: Partial<Record<MetricKey, number>> = {};
  let convertibleCount = 0;
  let missingCount = 0;
  let usedManualConversion = false;
  let hadMetricGap = false;

  for (const item of content.ingredients) {
    const mapping = mappingMap.get(item.ingredientId);
    if (!mapping || mapping.status !== "CONFIRMED" || !mapping.nutrientFood) {
      missingCount += 1;
      continue;
    }

    const quantity = resolveQuantity(item.ingredientId, item.amount, conversionMap);
    if (!quantity) {
      missingCount += 1;
      continue;
    }

    usedManualConversion ||= quantity.usedManualConversion;
    convertibleCount += 1;
    for (const key of metricKeys) {
      const value = mapping.nutrientFood[key];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        hadMetricGap = true;
        continue;
      }
      totals[key] = (totals[key] ?? 0) + (value * quantity.grams) / 100;
    }
  }

  if (convertibleCount === 0) {
    return {
      ...createEmptySummary(sourceVersion, "INSUFFICIENT"),
      coverageRate: content.ingredients.length > 0 ? 0 : null
    };
  }

  const perRecipe = normalizeMetrics(totals);
  const perServingTotals: Partial<Record<MetricKey, number>> = {};
  const baseServings = content.baseServings > 0 ? content.baseServings : null;
  if (perRecipe && baseServings) {
    for (const key of metricKeys) {
      const value = perRecipe[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        perServingTotals[key] = value / baseServings;
      }
    }
  }
  const perServing = normalizeMetrics(perServingTotals);
  const coverageRate = content.ingredients.length > 0 ? convertibleCount / content.ingredients.length : null;
  const isComplete =
    convertibleCount === content.ingredients.length && missingCount === 0 && !usedManualConversion && !hadMetricGap;
  const status: RecipeNutritionSummary["status"] = isComplete ? "COMPLETE" : "ESTIMATED";

  return {
    status,
    qualityLabel: mapQualityLabel(status),
    perServing,
    perRecipe,
    calculatedAt: null,
    sourceVersion,
    coverageRate
  };
}

function snapshotToSummary(snapshot: {
  status: DbRecipeNutritionStatus;
  qualityLabel: string | null;
  perServingJson: unknown;
  perRecipeJson: unknown;
  calculatedAt: Date;
  sourceVersion: string;
}): RecipeNutritionSummary {
  const perServing = snapshot.perServingJson ? fromJson<RecipeNutritionMetrics>(snapshot.perServingJson) : null;
  const perRecipe = snapshot.perRecipeJson ? fromJson<RecipeNutritionMetrics>(snapshot.perRecipeJson) : null;
  return {
    status: snapshot.status,
    qualityLabel: (snapshot.qualityLabel as RecipeNutritionSummary["qualityLabel"]) ?? mapQualityLabel(snapshot.status),
    perServing,
    perRecipe,
    calculatedAt: snapshot.calculatedAt.toISOString(),
    sourceVersion: snapshot.sourceVersion
  };
}

async function loadActiveSourceVersion(tx: RecipeDb) {
  const batch = await tx.nutrientSourceBatch.findFirst({
    orderBy: [{ importedAt: "desc" }, { id: "desc" }]
  });
  return batch?.sourceVersion ?? null;
}

export function buildRecipeNutritionPreview(
  content: RecipeContentSnapshot,
  sourceVersion: string,
  mappingRows: MappingRow[],
  conversionRows: ConversionRow[]
) {
  return buildSummaryFromRows(content, sourceVersion, mappingRows, conversionRows);
}

export function recipeNutritionSnapshotWhere(recipeVersionId: UUID) {
  return { recipeVersionId };
}

export function canReuseRecipeNutritionSnapshot(existingSourceVersion: string, activeSourceVersion: string) {
  return existingSourceVersion === activeSourceVersion;
}

export async function loadRecipeNutritionSummary(tx: RecipeDb, recipeVersionId: UUID, content: RecipeContentSnapshot): Promise<RecipeNutritionSummary> {
  const sourceVersion = await loadActiveSourceVersion(tx);
  if (!sourceVersion) {
    return createEmptySummary(null, "NONE");
  }

  const existing = await tx.recipeNutritionSnapshot.findUnique({
    where: recipeNutritionSnapshotWhere(recipeVersionId)
  });
  if (existing && canReuseRecipeNutritionSnapshot(existing.sourceVersion, sourceVersion)) {
    return snapshotToSummary(existing);
  }

  const ingredientIds = Array.from(new Set(content.ingredients.map(item => item.ingredientId)));
  const [mappingRows, conversionRows] = await Promise.all([
    ingredientIds.length === 0
      ? Promise.resolve([] as MappingRow[])
      : tx.ingredientNutrientMapping.findMany({
          where: {
            ingredientId: { in: ingredientIds },
            sourceVersion
          },
          select: {
            ingredientId: true,
            status: true,
            nutrientFood: {
              select: {
                calories: true,
                protein: true,
                fat: true,
                carbohydrate: true
              }
            }
          }
        }),
    ingredientIds.length === 0
      ? Promise.resolve([] as ConversionRow[])
      : tx.ingredientUnitNutrientConversion.findMany({
          where: {
            ingredientId: { in: ingredientIds },
            sourceVersion
          },
          select: {
            ingredientId: true,
            unitId: true,
            gramsPerUnit: true
          }
        })
  ]);

  const summary = buildSummaryFromRows(content, sourceVersion, mappingRows, conversionRows);
  const persisted = await tx.recipeNutritionSnapshot.upsert({
    where: recipeNutritionSnapshotWhere(recipeVersionId),
    update: {
      status: summary.status,
      qualityLabel: summary.qualityLabel,
      perServingJson: summary.perServing ? toJson(summary.perServing) : Prisma.DbNull,
      perRecipeJson: summary.perRecipe ? toJson(summary.perRecipe) : Prisma.DbNull,
      coverageRate: summary.coverageRate,
      calculatedAt: new Date(),
      sourceVersion
    },
    create: {
      recipeVersionId,
      status: summary.status,
      qualityLabel: summary.qualityLabel,
      perServingJson: summary.perServing ? toJson(summary.perServing) : Prisma.DbNull,
      perRecipeJson: summary.perRecipe ? toJson(summary.perRecipe) : Prisma.DbNull,
      coverageRate: summary.coverageRate,
      sourceVersion
    }
  });

  return snapshotToSummary(persisted);
}
