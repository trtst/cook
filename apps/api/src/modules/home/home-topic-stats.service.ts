import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma, type RecipeVersionTagCode } from "@prisma/client";
import {
  completeAdminIdempotentOperation,
  getAdminIdempotentResult,
  startAdminIdempotentOperation
} from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import type {
  HomeTopicRecipeStatsDimensionKey,
  HomeTopicRecipeStatsFacet,
  HomeTopicRecipeStatsMissingRecipesResponse,
  HomeTopicRecipeStatsResponse,
  HomeTopicRecipeStatsSnapshot,
  RebuildHomeTopicRecipeStatsResponse
} from "../../contracts/types";
import type { HomeTopicRecipeStatsMissingQueryDto } from "../../contracts/dtos";
import { publicInspirationRecipeWhere } from "../recipe/public-content-user-pool";

const scope = "PUBLIC_INSPIRATION";
const operationType = "admin-home-topic-stats:rebuild";
const pageSize = 500;
const coreIngredientCategoryIds = [5001, 5002, 5003, 5004];
const tagFacetMap: Partial<Record<RecipeVersionTagCode, keyof HomeTopicRecipeStatsSnapshot["facets"]>> = {
  CUISINE: "cuisines",
  DISH_STYLE: "dishStyles",
  DISH_ROLE: "dishRoles",
  MAIN_PROTEIN_TYPE: "proteins"
};
const dimensionTagMap: Partial<Record<HomeTopicRecipeStatsDimensionKey, RecipeVersionTagCode>> = {
  cuisines: "CUISINE",
  dishStyles: "DISH_STYLE",
  dishRoles: "DISH_ROLE",
  proteins: "MAIN_PROTEIN_TYPE"
};

type IngredientRow = { ingredientId?: unknown; ingredientName?: unknown; name?: unknown };

function ingredientRows(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return [];
  return value.flatMap(rawItem => {
    if (typeof rawItem !== "object" || rawItem === null || Array.isArray(rawItem)) return [];
    const item = rawItem as IngredientRow;
    const ingredientId = Number(item.ingredientId);
    const name = typeof item.ingredientName === "string" ? item.ingredientName : typeof item.name === "string" ? item.name : "";
    const trimmed = name.trim();
    return Number.isInteger(ingredientId) && ingredientId > 0 && trimmed ? [{ ingredientId, name: trimmed }] : [];
  });
}

function buildFacetRows(values: Map<string, number>, totalPublicRecipes: number, confirmedCount: number): HomeTopicRecipeStatsFacet[] {
  return [...values.entries()]
    .map(([value, count]) => ({
      value,
      count,
      shareOfTotal: totalPublicRecipes ? count / totalPublicRecipes : 0,
      shareOfConfirmed: confirmedCount ? count / confirmedCount : 0
    }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value, "zh-CN"));
}

function buildDimension(values: Map<string, number>, confirmedCount: number, totalPublicRecipes: number, notApplicableCount = 0) {
  const missingCount = totalPublicRecipes - confirmedCount - notApplicableCount;
  return {
    confirmedCount,
    coverageApplicable: true,
    notApplicableCount,
    missingCount,
    coverageRate: totalPublicRecipes ? (confirmedCount + notApplicableCount) / totalPublicRecipes : 0,
    values: buildFacetRows(values, totalPublicRecipes, confirmedCount)
  };
}

function addCount(target: Map<string, number>, value: string) {
  const normalized = value.trim();
  if (normalized) target.set(normalized, (target.get(normalized) ?? 0) + 1);
}

function toSnapshot(row: {
  snapshotId: string;
  generatedAt: Date;
  eligibleRecipeCount: number;
  statsJson: Prisma.JsonValue;
}): HomeTopicRecipeStatsSnapshot | null {
  const saved = row.statsJson as unknown as Omit<HomeTopicRecipeStatsSnapshot, "snapshotId" | "generatedAt" | "totalPublicRecipes">;
  if (!saved?.nutrition || !saved.facets?.allIngredients || !Array.isArray(saved.facets.allIngredients.values)) return null;
  const facets = Object.fromEntries(Object.entries(saved.facets).map(([key, dimension]) => [key, {
    ...dimension,
    coverageApplicable: true,
    notApplicableCount: key === "allIngredients" ? row.eligibleRecipeCount - dimension.confirmedCount : 0,
    missingCount: key === "allIngredients" ? 0 : dimension.missingCount,
    coverageRate: key === "allIngredients" ? (row.eligibleRecipeCount ? 1 : 0) : dimension.coverageRate
  }])) as HomeTopicRecipeStatsSnapshot["facets"];
  return {
    snapshotId: row.snapshotId,
    generatedAt: row.generatedAt.toISOString(),
    totalPublicRecipes: row.eligibleRecipeCount,
    facets,
    nutrition: saved.nutrition
  };
}

@Injectable()
export class HomeTopicStatsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSnapshot(): Promise<HomeTopicRecipeStatsResponse> {
    const row = await this.prisma.homeTopicRecipeStatsSnapshot.findUnique({ where: { scope } });
    return { snapshot: row ? toSnapshot(row) : null };
  }

  async listMissingRecipes(query: HomeTopicRecipeStatsMissingQueryDto): Promise<HomeTopicRecipeStatsMissingRecipesResponse> {
    const dimension = query.dimension as HomeTopicRecipeStatsDimensionKey | "nutrition";
    const selectedValue = query.value?.trim();
    const nutritionValues = ["COMPLETE", "ESTIMATED", "INSUFFICIENT", "NONE", "HAS_ANALYSIS"];
    if (dimension === "nutrition" && selectedValue && !nutritionValues.includes(selectedValue)) {
      throw new BadRequestException("营养状态筛选值无效");
    }
    if (dimension === "allIngredients" && !selectedValue) {
      return {
        items: [],
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
        hasNext: false,
        checkedAt: new Date().toISOString()
      };
    }
    return this.prisma.$transaction(async tx => {
      const start = (query.page - 1) * query.pageSize;
      const end = start + query.pageSize;
      const items: HomeTopicRecipeStatsMissingRecipesResponse["items"] = [];
      let matchedCount = 0;
      const nutritionSource = await tx.nutrientSourceBatch.findFirst({
        orderBy: [{ importedAt: "desc" }, { id: "desc" }],
        select: { sourceVersion: true }
      });
      let cursorId = 0;
      for (;;) {
        const recipes = await tx.recipe.findMany({
          where: { ...publicInspirationRecipeWhere("ACTIVE"), id: { gt: cursorId } },
          orderBy: { id: "asc" },
          take: pageSize,
          select: {
            id: true,
            title: true,
            coverImageUrl: true,
            currentVersion: {
              select: {
                ingredientsJson: true,
                difficulty: true,
                duration: true,
                nutritionSnapshots: {
                  where: { sourceVersion: nutritionSource?.sourceVersion ?? "" },
                  take: 1,
                  select: { status: true }
                },
                versionTags: {
                  where: { status: "CONFIRMED" },
                  select: { tagCode: true, tagValue: true }
                }
              }
            }
          }
        });
        if (!recipes.length) break;
        cursorId = recipes[recipes.length - 1]!.id;

        const recipeIngredients = recipes.map(recipe => ingredientRows(recipe.currentVersion.ingredientsJson));
        const ingredientIds = [...new Set(recipeIngredients.flatMap(rows => rows.map(item => item.ingredientId)))];
        const coreIngredientIds = new Set<number>();
        if (ingredientIds.length) {
          const coreIngredients = await tx.ingredient.findMany({
            where: {
              id: { in: ingredientIds },
              ownerId: null,
              status: "ACTIVE",
              categoryId: { in: coreIngredientCategoryIds }
            },
            select: { id: true }
          });
          for (const ingredient of coreIngredients) coreIngredientIds.add(ingredient.id);
        }

        for (const [index, recipe] of recipes.entries()) {
          const tags = recipe.currentVersion.versionTags;
          const currentIngredients = recipeIngredients[index] ?? [];
          const recipeIngredientIds = new Set(currentIngredients.map(item => item.ingredientId));
          let isMatch: boolean;
          if (dimension === "nutrition") {
            const status = recipe.currentVersion.nutritionSnapshots[0]?.status ?? "NONE";
            isMatch = selectedValue === "HAS_ANALYSIS"
              ? status !== "NONE"
              : status === (selectedValue || "NONE");
          } else if (selectedValue && dimension === "allIngredients") {
            isMatch = currentIngredients.some(item => coreIngredientIds.has(item.ingredientId) && item.name === selectedValue);
          } else if (selectedValue && dimension === "primaryIngredients") {
            isMatch = tags.some(item =>
              item.tagCode === "PRIMARY_INGREDIENT" &&
              recipeIngredientIds.has(Number(item.tagValue)) &&
              coreIngredientIds.has(Number(item.tagValue)) &&
              currentIngredients.some(ingredient => ingredient.ingredientId === Number(item.tagValue) && ingredient.name === selectedValue)
            );
          } else if (selectedValue && (dimension === "difficulties" || dimension === "durations")) {
            const fieldValue = dimension === "difficulties" ? recipe.currentVersion.difficulty : recipe.currentVersion.duration;
            isMatch = fieldValue === selectedValue;
          } else if (selectedValue) {
            const tagCode = dimensionTagMap[dimension];
            isMatch = Boolean(tagCode && tags.some(item => item.tagCode === tagCode && item.tagValue === selectedValue));
          } else if (dimension === "allIngredients") {
            isMatch = !currentIngredients.some(item => coreIngredientIds.has(item.ingredientId));
          } else if (dimension === "primaryIngredients") {
            isMatch = !tags.some(item =>
              item.tagCode === "PRIMARY_INGREDIENT" &&
              coreIngredientIds.has(Number(item.tagValue)) &&
              recipeIngredientIds.has(Number(item.tagValue))
            );
          } else if (dimension === "difficulties") {
            isMatch = recipe.currentVersion.difficulty === null;
          } else if (dimension === "durations") {
            isMatch = recipe.currentVersion.duration === null;
          } else {
            const tagCode = dimensionTagMap[dimension];
            isMatch = !tagCode || !tags.some(item => item.tagCode === tagCode);
          }
          if (isMatch) {
            if (matchedCount >= start && matchedCount < end) {
              items.push({ id: recipe.id, title: recipe.title, coverImageUrl: recipe.coverImageUrl });
            }
            matchedCount += 1;
          }
        }
        if (recipes.length < pageSize) break;
      }

      return {
        items,
        page: query.page,
        pageSize: query.pageSize,
        total: matchedCount,
        hasNext: end < matchedCount,
        checkedAt: new Date().toISOString()
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async rebuild(adminId: number, operationId: string): Promise<RebuildHomeTopicRecipeStatsResponse> {
    const requestHash = JSON.stringify({ scope, action: "rebuild" });
    const repeated = await this.prisma.$transaction(tx =>
      getAdminIdempotentResult<RebuildHomeTopicRecipeStatsResponse>(tx, operationId, operationType, adminId, requestHash)
    );
    if (repeated) return repeated;
    const computed = await this.prisma.$transaction(tx => this.computeSnapshot(tx), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead
    });
    const generatedAt = new Date();
    const snapshotId = randomUUID();
    const resultSnapshot: HomeTopicRecipeStatsSnapshot = {
      snapshotId,
      generatedAt: generatedAt.toISOString(),
      totalPublicRecipes: computed.eligibleRecipeCount,
      facets: computed.facets,
      nutrition: computed.nutrition
    };

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<RebuildHomeTopicRecipeStatsResponse>(
        tx,
        operationId,
        operationType,
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, operationType, adminId, requestHash);

      await tx.homeTopicRecipeStatsSnapshot.upsert({
        where: { scope },
        create: {
          scope,
          snapshotId,
          eligibleRecipeCount: computed.eligibleRecipeCount,
          statsJson: JSON.parse(JSON.stringify({ facets: computed.facets, nutrition: computed.nutrition })) as Prisma.InputJsonValue,
          generatedAt,
          updatedByAdminId: adminId
        },
        update: {
          snapshotId,
          eligibleRecipeCount: computed.eligibleRecipeCount,
          statsJson: JSON.parse(JSON.stringify({ facets: computed.facets, nutrition: computed.nutrition })) as Prisma.InputJsonValue,
          generatedAt,
          updatedByAdminId: adminId
        }
      });
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "HOME_TOPIC_RECIPE_STATS_REBUILT",
          objectType: "HOME_TOPIC_RECIPE_STATS",
          objectId: 1,
          payload: { snapshotId, totalPublicRecipes: computed.eligibleRecipeCount }
        }
      });
      const result = { snapshot: resultSnapshot };
      await completeAdminIdempotentOperation(tx, operationId, operationType, adminId, requestHash, result);
      return result;
    });
  }

  private async computeSnapshot(db: Prisma.TransactionClient) {
    const counts = {
      allIngredients: new Map<string, number>(),
      primaryIngredients: new Map<string, number>(),
      cuisines: new Map<string, number>(),
      dishStyles: new Map<string, number>(),
      dishRoles: new Map<string, number>(),
      proteins: new Map<string, number>(),
      difficulties: new Map<string, number>(),
      durations: new Map<string, number>()
    };
    const confirmed = {
      ingredients: 0,
      primaryIngredients: 0,
      cuisines: 0,
      dishStyles: 0,
      dishRoles: 0,
      proteins: 0,
      difficulties: 0,
      durations: 0
    };
    const nutritionSource = await db.nutrientSourceBatch.findFirst({
      orderBy: [{ importedAt: "desc" }, { id: "desc" }],
      select: { sourceVersion: true }
    });
    const nutrition = {
      hasNutritionAnalysis: 0,
      statusCounts: { COMPLETE: 0, ESTIMATED: 0, INSUFFICIENT: 0, NONE: 0 },
      fieldCoverage: { calories: 0, protein: 0, fat: 0, carbohydrate: 0 }
    };
    let eligibleRecipeCount = 0;
    let cursorId = 0;

    for (;;) {
      const recipes = await db.recipe.findMany({
        where: { ...publicInspirationRecipeWhere("ACTIVE"), id: { gt: cursorId } },
        orderBy: { id: "asc" },
        take: pageSize,
        select: {
          id: true,
          currentVersion: {
            select: {
              ingredientsJson: true,
              difficulty: true,
              duration: true,
              versionTags: {
                where: { status: "CONFIRMED" },
                select: { tagCode: true, tagValue: true }
              },
              nutritionSnapshots: {
                where: { sourceVersion: nutritionSource?.sourceVersion ?? "" },
                take: 1,
                select: { status: true, perServingJson: true }
              }
            }
          }
        }
      });
      if (!recipes.length) break;
      eligibleRecipeCount += recipes.length;
      cursorId = recipes[recipes.length - 1]!.id;

      const recipeIngredientRows = recipes.map(recipe => ingredientRows(recipe.currentVersion.ingredientsJson));
      const ingredientIds = [...new Set(recipeIngredientRows.flatMap(rows => rows.map(item => item.ingredientId)))];
      const coreIngredientIds = new Set<number>();
      if (ingredientIds.length) {
        const coreIngredients = await db.ingredient.findMany({
          where: {
            id: { in: ingredientIds },
            ownerId: null,
            status: "ACTIVE",
            categoryId: { in: coreIngredientCategoryIds }
          },
          select: { id: true }
        });
        for (const ingredient of coreIngredients) coreIngredientIds.add(ingredient.id);
      }

      for (const [index, recipe] of recipes.entries()) {
        const rows = recipeIngredientRows[index] ?? [];
        const coreRows = rows.filter(item => coreIngredientIds.has(item.ingredientId));
        const ingredients = [...new Set(coreRows.map(item => item.name))];
        if (ingredients.length) confirmed.ingredients += 1;
        for (const name of ingredients) addCount(counts.allIngredients, name);

        const primaryTags = recipe.currentVersion.versionTags.filter(item => item.tagCode === "PRIMARY_INGREDIENT");
        const primaryNames = new Set<string>();
        for (const tag of primaryTags) {
          const id = Number(tag.tagValue);
          if (!coreIngredientIds.has(id)) continue;
          const linkedIngredient = coreRows.find(item => item.ingredientId === id);
          if (linkedIngredient) primaryNames.add(linkedIngredient.name);
        }
        if (primaryNames.size) confirmed.primaryIngredients += 1;
        for (const name of primaryNames) addCount(counts.primaryIngredients, name);

        const recipeFacets = new Map<keyof typeof counts, Set<string>>();
        for (const tag of recipe.currentVersion.versionTags) {
          const target = tagFacetMap[tag.tagCode];
          if (!target) continue;
          const values = recipeFacets.get(target) ?? new Set<string>();
          values.add(tag.tagValue);
          recipeFacets.set(target, values);
        }
        for (const [facet, values] of recipeFacets) {
          for (const value of values) addCount(counts[facet], value);
        }
        if (recipeFacets.has("cuisines")) confirmed.cuisines += 1;
        if (recipeFacets.has("dishStyles")) confirmed.dishStyles += 1;
        if (recipeFacets.has("dishRoles")) confirmed.dishRoles += 1;
        if (recipeFacets.has("proteins")) confirmed.proteins += 1;
        if (recipe.currentVersion.difficulty) {
          confirmed.difficulties += 1;
          addCount(counts.difficulties, recipe.currentVersion.difficulty);
        }
        if (recipe.currentVersion.duration) {
          confirmed.durations += 1;
          addCount(counts.durations, recipe.currentVersion.duration);
        }

        const nutritionRow = recipe.currentVersion.nutritionSnapshots[0];
        const status = nutritionRow?.status ?? "NONE";
        nutrition.statusCounts[status] += 1;
        if (status !== "NONE") nutrition.hasNutritionAnalysis += 1;
        if (nutritionRow?.perServingJson && typeof nutritionRow.perServingJson === "object" && !Array.isArray(nutritionRow.perServingJson)) {
          const values = nutritionRow.perServingJson as Record<string, unknown>;
          for (const key of ["calories", "protein", "fat", "carbohydrate"] as const) {
            if (typeof values[key] === "number" && Number.isFinite(values[key])) nutrition.fieldCoverage[key] += 1;
          }
        }
      }
      if (recipes.length < pageSize) break;
    }

    return {
      eligibleRecipeCount,
      facets: {
        allIngredients: buildDimension(counts.allIngredients, confirmed.ingredients, eligibleRecipeCount, eligibleRecipeCount - confirmed.ingredients),
        primaryIngredients: buildDimension(counts.primaryIngredients, confirmed.primaryIngredients, eligibleRecipeCount),
        cuisines: buildDimension(counts.cuisines, confirmed.cuisines, eligibleRecipeCount),
        dishStyles: buildDimension(counts.dishStyles, confirmed.dishStyles, eligibleRecipeCount),
        dishRoles: buildDimension(counts.dishRoles, confirmed.dishRoles, eligibleRecipeCount),
        proteins: buildDimension(counts.proteins, confirmed.proteins, eligibleRecipeCount),
        difficulties: buildDimension(counts.difficulties, confirmed.difficulties, eligibleRecipeCount),
        durations: buildDimension(counts.durations, confirmed.durations, eligibleRecipeCount)
      },
      nutrition
    };
  }
}
