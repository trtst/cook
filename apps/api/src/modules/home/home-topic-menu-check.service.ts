import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type RecipeVersionTagCode } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import type { HomeTopicMenuCheckResponse, HomeTopicRecipeStatsDimension, HomeTopicWeekday } from "../../contracts/types";

const weekdays: HomeTopicWeekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const coreIngredientCategoryIds = [5001, 5002, 5003, 5004];
const facetCodes: Partial<Record<RecipeVersionTagCode, "cuisines" | "dishStyles" | "dishRoles" | "proteins">> = {
  CUISINE: "cuisines",
  DISH_STYLE: "dishStyles",
  DISH_ROLE: "dishRoles",
  MAIN_PROTEIN_TYPE: "proteins"
};
type FacetKey = "allIngredients" | "primaryIngredients" | "cuisines" | "dishStyles" | "dishRoles" | "proteins" | "difficulties" | "durations";
type IngredientRow = { ingredientId?: unknown; ingredientName?: unknown; name?: unknown };
type RecipeItem = {
  recipeId: number;
  weekday: HomeTopicWeekday;
  sourceVersion: {
    ingredientsJson: Prisma.JsonValue;
    difficulty: string | null;
    duration: string | null;
    versionTags: Array<{ tagCode: RecipeVersionTagCode; tagValue: string }>;
  };
};
type RecipeFacts = { recipeId: number; weekday: HomeTopicWeekday; facets: Record<FacetKey, Set<string>>; primaryIngredientIds: Set<number> };

function ingredientRows(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return [];
  return value.flatMap(rawItem => {
    if (typeof rawItem !== "object" || rawItem === null || Array.isArray(rawItem)) return [];
    const item = rawItem as IngredientRow;
    const ingredientId = Number(item.ingredientId);
    const name = typeof item.ingredientName === "string" ? item.ingredientName : typeof item.name === "string" ? item.name : "";
    return Number.isInteger(ingredientId) && ingredientId > 0 && name.trim() ? [{ ingredientId, name: name.trim() }] : [];
  });
}

function createFacets(): Record<FacetKey, Set<string>> {
  return {
    allIngredients: new Set(), primaryIngredients: new Set(), cuisines: new Set(), dishStyles: new Set(),
    dishRoles: new Set(), proteins: new Set(), difficulties: new Set(), durations: new Set()
  };
}

function buildDimension(rows: RecipeFacts[], key: FacetKey): HomeTopicRecipeStatsDimension {
  const values = new Map<string, number>();
  let confirmedCount = 0;
  for (const row of rows) {
    const current = row.facets[key];
    if (current.size) confirmedCount += 1;
    for (const value of current) values.set(value, (values.get(value) ?? 0) + 1);
  }
  const total = rows.length;
  return {
    confirmedCount,
    missingCount: total - confirmedCount,
    coverageRate: total ? confirmedCount / total : 0,
    values: [...values.entries()]
      .map(([value, count]) => ({ value, count, shareOfTotal: total ? count / total : 0, shareOfConfirmed: confirmedCount ? count / confirmedCount : 0 }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value, "zh-CN"))
  };
}

function buildFacets(rows: RecipeFacts[]) {
  return {
    allIngredients: buildDimension(rows, "allIngredients"),
    primaryIngredients: buildDimension(rows, "primaryIngredients"),
    cuisines: buildDimension(rows, "cuisines"),
    dishStyles: buildDimension(rows, "dishStyles"),
    dishRoles: buildDimension(rows, "dishRoles"),
    proteins: buildDimension(rows, "proteins"),
    difficulties: buildDimension(rows, "difficulties"),
    durations: buildDimension(rows, "durations")
  };
}

@Injectable()
export class HomeTopicMenuCheckService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMenuCheck(topicId: number): Promise<HomeTopicMenuCheckResponse> {
    const cached = await this.prisma.homeTopicMenuCheckSnapshot.findUnique({ where: { topicId } });
    const current = await this.prisma.homeTopic.findUnique({ where: { id: topicId }, select: { id: true, version: true } });
    if (!current) throw new NotFoundException("周刊不存在");
    if (cached?.topicVersion === current.version) {
      return { ...(cached.resultJson as unknown as HomeTopicMenuCheckResponse), generatedAt: cached.generatedAt.toISOString(), topicVersion: cached.topicVersion, stale: false };
    }

    const generatedAt = new Date();
    const computed = await this.prisma.$transaction(async tx => {
      const topic = await tx.homeTopic.findUnique({
        where: { id: topicId },
        select: {
          version: true,
          items: {
            orderBy: [{ weekday: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
            select: {
              recipeId: true,
              weekday: true,
              sourceVersion: {
                select: {
                  ingredientsJson: true,
                  difficulty: true,
                  duration: true,
                  versionTags: { where: { status: "CONFIRMED" }, select: { tagCode: true, tagValue: true } }
                }
              }
            }
          }
        }
      });
      if (!topic) throw new NotFoundException("周刊不存在");
      const items = topic.items as RecipeItem[];
      const ingredientIds = [...new Set(items.flatMap(item => ingredientRows(item.sourceVersion.ingredientsJson).map(row => row.ingredientId)))];
      const coreIngredients = ingredientIds.length ? await tx.ingredient.findMany({
        where: { id: { in: ingredientIds }, ownerId: null, status: "ACTIVE", categoryId: { in: coreIngredientCategoryIds } },
        select: { id: true, name: true }
      }) : [];
      const coreIds = new Set(coreIngredients.map(item => item.id));
      const coreNames = new Map(coreIngredients.map(item => [item.id, item.name]));
      const facts = items.map(item => {
        const facets = createFacets();
        const primaryIngredientIds = new Set<number>();
        for (const row of ingredientRows(item.sourceVersion.ingredientsJson)) {
          if (coreIds.has(row.ingredientId)) facets.allIngredients.add(row.name);
        }
        for (const tag of item.sourceVersion.versionTags) {
          const facet = facetCodes[tag.tagCode];
          if (facet) facets[facet].add(tag.tagValue);
          if (tag.tagCode === "PRIMARY_INGREDIENT") {
            const id = Number(tag.tagValue);
            const name = coreNames.get(id);
            if (name) {
              facets.primaryIngredients.add(name);
              primaryIngredientIds.add(id);
            }
          }
        }
        if (item.sourceVersion.difficulty) facets.difficulties.add(item.sourceVersion.difficulty);
        if (item.sourceVersion.duration) facets.durations.add(item.sourceVersion.duration);
        return { recipeId: item.recipeId, weekday: item.weekday, facets, primaryIngredientIds };
      });
      const unique = new Map<number, RecipeFacts>();
      for (const row of facts) if (!unique.has(row.recipeId)) unique.set(row.recipeId, row);
      const uniqueFacts = [...unique.values()];
      const duplicates = [...facts.reduce((counts, row) => counts.set(row.recipeId, (counts.get(row.recipeId) ?? 0) + 1), new Map<number, number>())]
        .filter(([, count]) => count > 1).map(([recipeId]) => recipeId).sort((left, right) => left - right);
      const days = weekdays.map(weekday => {
        const dayFacts = facts.filter(item => item.weekday === weekday);
        const dayUnique = [...new Map(dayFacts.map(item => [item.recipeId, item])).values()];
        return { weekday, recipeCount: dayFacts.length, uniqueRecipeCount: dayUnique.length, facets: buildFacets(dayUnique) };
      });
      const warnings: HomeTopicMenuCheckResponse["warnings"] = [];
      for (let index = 1; index < weekdays.length; index += 1) {
        const priorDay = weekdays[index - 1]!;
        const currentDay = weekdays[index]!;
        const priorPrimary = new Set<number>();
        for (const row of facts.filter(item => item.weekday === priorDay)) {
          for (const id of row.primaryIngredientIds) priorPrimary.add(id);
        }
        const currentPrimary = new Set<number>();
        for (const row of facts.filter(item => item.weekday === currentDay)) {
          for (const id of row.primaryIngredientIds) currentPrimary.add(id);
        }
        for (const ingredientId of priorPrimary) {
          if (currentPrimary.has(ingredientId)) warnings.push({
            code: "CONSECUTIVE_PRIMARY_INGREDIENT",
            ingredientId,
            ingredientName: coreNames.get(ingredientId) ?? "",
            fromWeekday: priorDay,
            toWeekday: currentDay
          });
        }
      }
      const result: HomeTopicMenuCheckResponse = {
        topicId,
        topicVersion: topic.version,
        generatedAt: generatedAt.toISOString(),
        stale: false,
        totalRecipeCount: facts.length,
        uniqueRecipeCount: uniqueFacts.length,
        duplicateRecipeIds: duplicates,
        days,
        weekly: { recipeCount: facts.length, uniqueRecipeCount: uniqueFacts.length, facets: buildFacets(uniqueFacts) },
        warnings
      };
      await tx.homeTopicMenuCheckSnapshot.upsert({
        where: { topicId },
        create: { topicId, topicVersion: topic.version, generatedAt, resultJson: result as unknown as Prisma.InputJsonValue },
        update: { topicVersion: topic.version, generatedAt, resultJson: result as unknown as Prisma.InputJsonValue }
      });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    const latestVersion = await this.prisma.homeTopic.findUnique({ where: { id: topicId }, select: { version: true } });
    if (!latestVersion) throw new NotFoundException("周刊不存在");
    if (latestVersion.version !== computed.topicVersion) return { ...computed, stale: true };
    return computed;
  }
}
