import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type RecipeVersionTagCode } from "@prisma/client";
import {
  completeAdminIdempotentOperation,
  getAdminIdempotentResult,
  startAdminIdempotentOperation
} from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import type {
  HomeTopicRecipeStatsFacet,
  HomeTopicRecipeStatsResponse,
  HomeTopicRecipeStatsSnapshot,
  RebuildHomeTopicRecipeStatsResponse
} from "../../contracts/types";
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

function buildFacetRows(values: Map<string, number>): HomeTopicRecipeStatsFacet[] {
  return [...values.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value, "zh-CN"));
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
}): HomeTopicRecipeStatsSnapshot {
  const saved = row.statsJson as unknown as Omit<HomeTopicRecipeStatsSnapshot, "snapshotId" | "generatedAt" | "eligibleRecipeCount">;
  return {
    snapshotId: row.snapshotId,
    generatedAt: row.generatedAt.toISOString(),
    eligibleRecipeCount: row.eligibleRecipeCount,
    coverage: saved.coverage,
    facets: saved.facets
  };
}

@Injectable()
export class HomeTopicStatsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSnapshot(): Promise<HomeTopicRecipeStatsResponse> {
    const row = await this.prisma.homeTopicRecipeStatsSnapshot.findUnique({ where: { scope } });
    return { snapshot: row ? toSnapshot(row) : null };
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
      eligibleRecipeCount: computed.eligibleRecipeCount,
      coverage: computed.coverage,
      facets: computed.facets
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
          statsJson: JSON.parse(JSON.stringify({ coverage: computed.coverage, facets: computed.facets })) as Prisma.InputJsonValue,
          generatedAt,
          updatedByAdminId: adminId
        },
        update: {
          snapshotId,
          eligibleRecipeCount: computed.eligibleRecipeCount,
          statsJson: JSON.parse(JSON.stringify({ coverage: computed.coverage, facets: computed.facets })) as Prisma.InputJsonValue,
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
          payload: { snapshotId, eligibleRecipeCount: computed.eligibleRecipeCount }
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
    const coverage = {
      ingredients: 0,
      primaryIngredients: 0,
      cuisines: 0,
      dishStyles: 0,
      dishRoles: 0,
      proteins: 0,
      difficulties: 0,
      durations: 0
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
        if (ingredients.length) coverage.ingredients += 1;
        for (const name of ingredients) addCount(counts.allIngredients, name);

        const primaryTags = recipe.currentVersion.versionTags.filter(item => item.tagCode === "PRIMARY_INGREDIENT");
        const primaryNames = new Set<string>();
        for (const tag of primaryTags) {
          const id = Number(tag.tagValue);
          if (!coreIngredientIds.has(id)) continue;
          const linkedIngredient = coreRows.find(item => item.ingredientId === id);
          if (linkedIngredient) primaryNames.add(linkedIngredient.name);
        }
        if (primaryNames.size) coverage.primaryIngredients += 1;
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
        if (recipeFacets.has("cuisines")) coverage.cuisines += 1;
        if (recipeFacets.has("dishStyles")) coverage.dishStyles += 1;
        if (recipeFacets.has("dishRoles")) coverage.dishRoles += 1;
        if (recipeFacets.has("proteins")) coverage.proteins += 1;
        if (recipe.currentVersion.difficulty) {
          coverage.difficulties += 1;
          addCount(counts.difficulties, recipe.currentVersion.difficulty);
        }
        if (recipe.currentVersion.duration) {
          coverage.durations += 1;
          addCount(counts.durations, recipe.currentVersion.duration);
        }
      }
      if (recipes.length < pageSize) break;
    }

    return {
      eligibleRecipeCount,
      coverage,
      facets: {
        allIngredients: buildFacetRows(counts.allIngredients),
        primaryIngredients: buildFacetRows(counts.primaryIngredients),
        cuisines: buildFacetRows(counts.cuisines),
        dishStyles: buildFacetRows(counts.dishStyles),
        dishRoles: buildFacetRows(counts.dishRoles),
        proteins: buildFacetRows(counts.proteins),
        difficulties: buildFacetRows(counts.difficulties),
        durations: buildFacetRows(counts.durations)
      }
    };
  }
}
