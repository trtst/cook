import { createHash, randomInt } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type HomeEntryStatus, type HomeFeatureBoardCard, type HomeFeatureBoardPlacement, type HomeFeatureBoardTargetType, type MealSlot, Prisma } from "@prisma/client";
import { recipeDifficultyText, recipeDurationText } from "../../common/display-text";
import {
  completeAdminIdempotentOperation,
  completeIdempotentOperation,
  getAdminIdempotentResult,
  getIdempotentResult,
  startAdminIdempotentOperation,
  startIdempotentOperation
} from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import type {
  AdminHomeEntriesResponse,
  AdminHomeEntryItem,
  HomeEntriesResponse,
  HomeFridgeRecipeItem,
  HomeFridgeRecipesResponse,
  HomeEntryItem,
  HomeNextMealState,
  HomeNextMealStatus,
  HomeEntryPageTarget,
  HomeRecentArrangement,
  HomeRecentArrangementStatus,
  HomeWeekDayStatus,
  HomeWeekOverview,
  HomeWeekOverviewDay,
  HomeWeekOverviewStatus,
  OperationId,
  RecipeDifficulty,
  RecipeDuration,
  SetHomeEntryStatusRequest,
  UUID,
  UpdateHomeEntriesRequest
} from "../../contracts/types";
import { PantryService } from "../pantry/pantry.service";
import { publicInspirationRecipeWhere } from "../recipe/public-content-user-pool";
import { HomeImageService } from "./home-image.service";
import { canonicalRecipeIngredientIds } from "./recipe-ingredient-canonical";
import { fridgePresenceState, fridgeTraceWindowDays } from "../pantry/pantry.fridge-trace";

type BoardDb = Prisma.TransactionClient | PrismaService;
type HomeCardInput = Pick<HomeFeatureBoardCard, "placement" | "title" | "subtitle" | "targetType" | "targetValue" | "artImageUrl" | "badgeText">;
type FridgeRecipeRow = Prisma.RecipeGetPayload<{
  select: {
    id: true;
    ownerId: true;
    title: true;
    coverImageUrl: true;
    isInspiration: true;
    inspirationCategoryId: true;
    currentVersionId: true;
    currentVersion: {
      select: {
        difficulty: true;
        duration: true;
      };
    };
  };
}>;
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

const quickPlacements: HomeFeatureBoardPlacement[] = ["QUICK_1", "QUICK_2", "QUICK_3", "QUICK_4"];
const primaryWindowMs = 24 * 60 * 60 * 1000;
const fallbackWindowMs = 36 * 60 * 60 * 1000;
const pastShareWindowMs = 24 * 60 * 60 * 1000;
const homeFridgeRecipePageSize = 3;
const homeWeekDayCount = 7;
const homeFridgeRecipePoolTarget = 9;
const homeFridgeRecipePoolCacheMs = 30 * 60 * 1000;
const homeFridgeActiveIngredientCategories = new Set([5001, 5002, 5003, 5004]);
const weekDayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const arrangementStatusPriority: Record<HomeRecentArrangementStatus, number> = {
  TIME_UP_SHARE: 5,
  READY_TO_COOK: 4,
  PENDING_SHOPPING: 3,
  PENDING_CONFIRM: 2,
  EMPTY_MENU: 1
};
const placementIds: Record<HomeFeatureBoardPlacement, string> = {
  QUICK_1: "quick-1",
  QUICK_2: "quick-2",
  QUICK_3: "quick-3",
  QUICK_4: "quick-4"
};
const pageTargets: HomeEntryPageTarget[] = [
  { label: "下一餐计划", value: "/pages_meal/plan/index" },
  { label: "随机吃什么", value: "/pages_meal/random/index" },
  { label: "采购缺口", value: "/pages_pantry/gap/index" },
  { label: "食材与采购", value: "/pages_pantry/index/index" },
  { label: "本周灵感", value: "/pages_home/topic/index" },
  { label: "餐桌话题", value: "/pages_home/table-topic/index" },
  { label: "菜谱", value: "/pages/recipe/index" },
  { label: "我的菜谱管理", value: "/pages_recipe/list/index" }
];
const pageTargetSet = new Set(pageTargets.map(item => item.value));

type CachedFridgeRecipe = {
  recipeId: number;
  title: string;
  recipeVersionId: number;
  matchedIngredientIds: number[];
  totalIngredientCount: number;
};

function jsonNumberArray(value: Prisma.JsonValue): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(Number).filter(item => Number.isInteger(item) && item > 0);
}

function readCachedFridgeRecipes(value: Prisma.JsonValue): CachedFridgeRecipe[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Prisma.JsonObject => typeof item === "object" && item !== null && !Array.isArray(item))
    .flatMap(item => {
      const recipeVersionId = Number(item.recipeVersionId);
      const matchedIngredientIds = jsonNumberArray(item.matchedIngredientIds as Prisma.JsonValue);
      const recipeId = Number(item.recipeId);
      const totalIngredientCount = Number(item.totalIngredientCount);
      if (!Number.isInteger(recipeVersionId) || !Number.isInteger(recipeId) || !matchedIngredientIds.length || typeof item.title !== "string") return [];
      if (!Number.isInteger(totalIngredientCount) || totalIngredientCount < matchedIngredientIds.length) return [];
      return [{ recipeVersionId, recipeId, title: item.title, matchedIngredientIds, totalIngredientCount }];
    });
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!];
  }
  return shuffled;
}

function normalizeFridgeRecipeName(name: string) {
  return name.trim().replace(/\s+/g, "").toLocaleLowerCase();
}

function ingredientSetsOverlapBySubset(left: number[], right: number[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const leftIsSubset = left.every(id => rightSet.has(id));
  const rightIsSubset = right.every(id => leftSet.has(id));
  return leftIsSubset || rightIsSubset;
}

function indexIngredientSet(index: Map<number, number[][]>, ingredientIds: number[]) {
  for (const ingredientId of ingredientIds) {
    const sets = index.get(ingredientId) ?? [];
    sets.push(ingredientIds);
    index.set(ingredientId, sets);
  }
}

function hasDuplicateIngredientSet(index: Map<number, number[][]>, ingredientIds: number[]) {
  const relatedSets = new Set<number[]>();
  for (const ingredientId of ingredientIds) {
    for (const existing of index.get(ingredientId) ?? []) relatedSets.add(existing);
  }
  return Array.from(relatedSets).some(existing => ingredientSetsOverlapBySubset(existing, ingredientIds));
}

function fridgeRecipeBatchSize(activeIngredientCount: number) {
  if (activeIngredientCount < 15) return 1500;
  if (activeIngredientCount < 35) return 1000;
  return 500;
}
const imagePathPattern = /^(?:https?:\/\/[^/]+)?\/(?:static\/)?uploads\/home-entries\/(QUICK_1|QUICK_2|QUICK_3|QUICK_4)$/i;
const defaultCards: Record<HomeFeatureBoardPlacement, Omit<HomeCardInput, "placement">> = {
  QUICK_1: {
    title: "翻菜谱",
    subtitle: "先挑想做的",
    targetType: "PAGE",
    targetValue: "/pages/recipe/index",
    artImageUrl: null,
    badgeText: "谱"
  },
  QUICK_2: {
    title: "看食材",
    subtitle: "先看家里有啥",
    targetType: "PAGE",
    targetValue: "/pages_pantry/index/index",
    artImageUrl: null,
    badgeText: "材"
  },
  QUICK_3: {
    title: "随机",
    subtitle: "不纠结",
    targetType: "PAGE",
    targetValue: "/pages_meal/random/index",
    artImageUrl: null,
    badgeText: "随"
  },
  QUICK_4: {
    title: "缺什么",
    subtitle: "买菜前看",
    targetType: "PAGE",
    targetValue: "/pages_pantry/gap/index",
    artImageUrl: null,
    badgeText: "缺"
  }
};
type RecentArrangementBucket = "PRIMARY" | "PAST_SHARE" | "FALLBACK";
type RecentArrangementCandidate = HomeRecentArrangement & {
  bucket: RecentArrangementBucket;
  scheduledMs: number;
};
type WeekPlanRow = {
  id: UUID;
  planDate: Date;
  mealSlot: MealSlot;
  menuLockedAt: Date | null;
  status: "PLANNED" | "COMPLETED" | "CANCELLED";
  completedAt: Date | null;
  updatedAt: Date;
  diningEvent: {
    id: UUID;
    status: "PLANNED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
    completedAt: Date | null;
  } | null;
  dishes: Array<{ id: UUID }>;
};

function cleanText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text ? text : null;
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function maxDate(left: Date | null, right: Date | null) {
  if (!left) return right;
  if (!right) return left;
  return left.getTime() >= right.getTime() ? left : right;
}

function isInternalImagePath(value: string | null | undefined) {
  return Boolean(value && imagePathPattern.test(value));
}

function getPlacementLabel(placement: HomeFeatureBoardPlacement) {
  if (placement === "QUICK_1") return "快捷入口 1";
  if (placement === "QUICK_2") return "快捷入口 2";
  if (placement === "QUICK_3") return "快捷入口 3";
  return "快捷入口 4";
}

function mealSlotDefaultTime(slot: MealSlot) {
  if (slot === "BREAKFAST") return "08:00";
  if (slot === "LUNCH") return "12:00";
  if (slot === "AFTERNOON_TEA") return "15:30";
  if (slot === "DINNER") return "18:30";
  return "22:00";
}

function resolvePlanScheduledAt(planDate: Date, mealSlot: MealSlot) {
  const [hoursText, minutesText] = mealSlotDefaultTime(mealSlot).split(":");
  const next = new Date(planDate);
  next.setHours(Number(hoursText), Number(minutesText), 0, 0);
  return next;
}

function buildRecentArrangementTarget(
  item: Pick<HomeRecentArrangement, "eventId" | "planDate" | "planItemId">,
  focus?: "menu" | "shopping" | "assistant"
) {
  const query = [`planItemId=${encodeURIComponent(String(item.planItemId))}`, `planDate=${encodeURIComponent(item.planDate)}`];
  if (item.eventId) {
    query.push(`eventId=${encodeURIComponent(String(item.eventId))}`);
  }
  if (focus) {
    query.push(`focus=${encodeURIComponent(focus)}`);
  }
  return `/pages_meal/detail/index?${query.join("&")}`;
}

function resolveCandidateBucket(scheduledMs: number, status: HomeRecentArrangementStatus, nowMs: number): RecentArrangementBucket | null {
  const diff = scheduledMs - nowMs;
  if (diff >= 0 && diff <= primaryWindowMs) return "PRIMARY";
  if (status === "TIME_UP_SHARE" && diff < 0 && nowMs - scheduledMs <= pastShareWindowMs) return "PAST_SHARE";
  if (diff > primaryWindowMs && diff <= fallbackWindowMs) return "FALLBACK";
  return null;
}

function compareCandidates(left: RecentArrangementCandidate, right: RecentArrangementCandidate, nowMs: number) {
  const statusDiff = arrangementStatusPriority[right.status] - arrangementStatusPriority[left.status];
  if (statusDiff !== 0) return statusDiff;
  return Math.abs(left.scheduledMs - nowMs) - Math.abs(right.scheduledMs - nowMs);
}

function assertHomeTarget(item: { placement: HomeFeatureBoardPlacement; targetType: HomeFeatureBoardTargetType; targetValue: string }) {
  if (item.targetType === "PAGE") {
    if (!pageTargetSet.has(item.targetValue)) {
      throw new BadRequestException(`${getPlacementLabel(item.placement)}的站内页面地址不在允许列表`);
    }
    return;
  }

  if (!/^https:\/\//iu.test(item.targetValue)) {
    throw new BadRequestException(`${getPlacementLabel(item.placement)}的外链地址必须以 https:// 开头`);
  }
}

@Injectable()
export class HomeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(HomeImageService) private readonly homeImageService: HomeImageService,
    @Inject(PantryService) private readonly pantryService: PantryService
  ) {}

  async getHomeEntries(request: RequestLike): Promise<HomeEntriesResponse> {
    const items = await this.listCards();
    return {
      items: quickPlacements
        .map(placement => this.requireMappedCard(items, placement))
        .filter(item => item.status === "LISTED")
        .map(item => this.toPublicItem(request, item))
    };
  }

  async getAdminHomeEntries(): Promise<AdminHomeEntriesResponse> {
    return this.getAdminEntries(this.prisma);
  }

  async getRecentArrangement(userId: UUID): Promise<HomeRecentArrangement | null> {
    const now = new Date();
    const nowMs = now.getTime();
    const futureEnd = new Date(nowMs + fallbackWindowMs);
    const pastShareStart = new Date(nowMs - pastShareWindowMs);
    const planDateStart = new Date(now);
    planDateStart.setDate(planDateStart.getDate() - 1);
    planDateStart.setHours(0, 0, 0, 0);
    const planDateEnd = new Date(futureEnd);
    planDateEnd.setHours(23, 59, 59, 999);

    const [events, plans] = await Promise.all([
      this.prisma.diningEvent.findMany({
        where: {
          userId,
          status: {
            in: ["PLANNED", "CONFIRMED", "COMPLETED"]
          },
          scheduledAt: {
            gte: pastShareStart,
            lte: futureEnd
          },
          mealPlanItemId: {
            not: null
          }
        },
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          status: true,
          completedAt: true,
          mealPlanItemId: true,
          menuItems: {
            select: {
              id: true
            }
          },
          participants: {
            select: {
              status: true
            }
          },
          mealPlanItem: {
            select: {
              id: true,
              planDate: true,
              mealSlot: true
            }
          }
        }
      }),
      this.prisma.mealPlanItem.findMany({
        where: {
          userId,
          diningEvent: null,
          status: "PLANNED",
          planDate: {
            gte: planDateStart,
            lte: planDateEnd
          }
        },
        orderBy: [{ planDate: "asc" }, { mealSlot: "asc" }, { id: "asc" }],
        select: {
          id: true,
          planDate: true,
          mealSlot: true,
          title: true,
          menuLockedAt: true,
          dishes: {
            select: {
              id: true
            }
          }
        }
      })
    ]);

    const eventGapEntries = await Promise.all(
      events.map(async item => ({
        eventId: item.id,
        gapCount: await this.resolveEventGapCount(userId, item.id)
      }))
    );
    const planGapEntries = await Promise.all(
      plans.map(async item => ({
        planItemId: item.id,
        gapCount: item.dishes.length > 0 ? await this.resolvePlanGapCount(userId, item.id) : null
      }))
    );
    const gapCountMap = new Map(eventGapEntries.map(item => [item.eventId, item.gapCount]));
    const planGapCountMap = new Map(planGapEntries.map(item => [item.planItemId, item.gapCount]));
    const candidates: RecentArrangementCandidate[] = [];

    for (const event of events) {
      if (!event.mealPlanItem) continue;
      const scheduledMs = event.scheduledAt.getTime();
      const menuCount = event.menuItems.length;
      const gapCount = gapCountMap.get(event.id) ?? null;
      const status = this.resolveEventArrangementStatus(event.status, event.completedAt, scheduledMs, menuCount, gapCount, nowMs);
      if (!status) continue;
      const bucket = resolveCandidateBucket(scheduledMs, status, nowMs);
      if (!bucket) continue;
      candidates.push({
        sourceType: "EVENT",
        planItemId: event.mealPlanItem.id,
        planDate: event.mealPlanItem.planDate.toISOString().slice(0, 10),
        eventId: event.id,
        title: event.title,
        scheduledAt: event.scheduledAt.toISOString(),
        participantCount: 1 + event.participants.filter(item => item.status !== "REMOVED").length,
        menuCount,
        gapCount,
        status,
        bucket,
        scheduledMs
      });
    }

    for (const plan of plans) {
      const scheduledAt = resolvePlanScheduledAt(plan.planDate, plan.mealSlot);
      const scheduledMs = scheduledAt.getTime();
      const menuCount = plan.dishes.length;
      const gapCount = planGapCountMap.get(plan.id) ?? null;
      const status = this.resolvePlanArrangementStatus(plan.menuLockedAt, menuCount, gapCount, scheduledMs, nowMs);
      if (!status) continue;
      const bucket = resolveCandidateBucket(scheduledMs, status, nowMs);
      if (!bucket) continue;
      candidates.push({
        sourceType: "PLAN",
        planItemId: plan.id,
        planDate: plan.planDate.toISOString().slice(0, 10),
        eventId: null,
        title: plan.title,
        scheduledAt: scheduledAt.toISOString(),
        participantCount: 1,
        menuCount,
        gapCount,
        status,
        bucket,
        scheduledMs
      });
    }

    const selected =
      this.pickRecentArrangement(candidates, "PRIMARY", nowMs) ||
      this.pickRecentArrangement(candidates, "FALLBACK", nowMs) ||
      this.pickRecentArrangement(candidates, "PAST_SHARE", nowMs);

    return selected
      ? {
          sourceType: selected.sourceType,
          planItemId: selected.planItemId,
          planDate: selected.planDate,
          eventId: selected.eventId,
          title: selected.title,
          scheduledAt: selected.scheduledAt,
          participantCount: selected.participantCount,
          menuCount: selected.menuCount,
          gapCount: selected.gapCount,
          status: selected.status
        }
      : null;
  }

  async getNextMealState(userId: UUID): Promise<HomeNextMealState> {
    const arrangement = await this.getRecentArrangement(userId);
    return {
      status: this.resolveNextMealStatus(arrangement),
      arrangement
    };
  }

  async getWeekOverview(userId: UUID): Promise<HomeWeekOverview> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(today);
    end.setDate(end.getDate() + homeWeekDayCount - 1);
    end.setHours(23, 59, 59, 999);

    const [nextMealState, fridgeSummary, shoppingSummary, plans, latestShoppingList] = await Promise.all([
      this.getNextMealState(userId),
      this.pantryService.getFridgeTraceSummary(userId),
      this.pantryService.getShoppingListSummary(userId),
      this.prisma.mealPlanItem.findMany({
        where: {
          userId,
          planDate: {
            gte: today,
            lte: end
          }
        },
        orderBy: [{ planDate: "asc" }, { mealSlot: "asc" }, { id: "asc" }],
        select: {
          id: true,
          planDate: true,
          mealSlot: true,
          menuLockedAt: true,
          status: true,
          completedAt: true,
          updatedAt: true,
          diningEvent: {
            select: {
              id: true,
              status: true,
              completedAt: true
            }
          },
          dishes: {
            select: {
              id: true
            }
          }
        }
      }),
      this.prisma.shoppingList.findFirst({
        where: {
          ownerUserId: userId,
          status: "ACTIVE",
          mealPlans: {
            some: {
              userId,
              status: "PLANNED",
              planDate: {
                gte: today,
                lte: end
              }
            }
          }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          updatedAt: true
        }
      })
    ]);

    const arrangement = nextMealState.arrangement;
    const dayMap = new Map<string, HomeWeekDayStatus>();
    let plannedDayCount = 0;
    for (let index = 0; index < homeWeekDayCount; index += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      dayMap.set(date.toISOString().slice(0, 10), "EMPTY");
    }

    for (const plan of plans as WeekPlanRow[]) {
      const dateKey = plan.planDate.toISOString().slice(0, 10);
      const current = dayMap.get(dateKey) ?? "EMPTY";
      const scheduledMs = resolvePlanScheduledAt(plan.planDate, plan.mealSlot).getTime();
      const dayStatus = await this.resolveWeekPlanDayStatus(userId, plan, scheduledMs, now.getTime());
      if (current === "EMPTY" && dayStatus !== "EMPTY") {
        plannedDayCount += 1;
      }
      dayMap.set(dateKey, this.pickHigherDayStatus(current, dayStatus));
    }

    const days: HomeWeekOverviewDay[] = Array.from({ length: homeWeekDayCount }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      return {
        date: dateKey,
        label: index === 0 ? "今天" : index === 1 ? "明天" : weekDayNames[date.getDay()],
        status: dayMap.get(dateKey) ?? "EMPTY"
      };
    });

    const status = this.resolveWeekOverviewStatus(nextMealState);
    const latestPlanAt = plans.reduce<Date | null>(
      (current, item) => (item.status === "PLANNED" ? maxDate(current, item.updatedAt) : current),
      null
    );
    const notificationTime = maxDate(latestPlanAt, latestShoppingList?.updatedAt ?? null)?.toISOString() ?? "";
    return {
      status,
      title: this.resolveWeekOverviewTitle(status, plannedDayCount),
      summary: this.buildWeekOverviewSummary(status),
      actionText: this.resolveWeekOverviewActionText(status),
      targetType: "PAGE",
      targetValue: this.resolveWeekOverviewTarget(status, arrangement, shoppingSummary.activeListCount),
      notificationTime,
      plannedDayCount,
      totalDayCount: homeWeekDayCount,
      activeListCount: shoppingSummary.activeListCount,
      traceCount: fridgeSummary.recentCount,
      arrangement,
      days
    };
  }

  async getFridgeRecipes(userId: UUID): Promise<HomeFridgeRecipesResponse> {
    return this.loadFridgeRecipes(userId, null);
  }

  async nextFridgeRecipes(userId: UUID, operationId: OperationId): Promise<HomeFridgeRecipesResponse> {
    return this.loadFridgeRecipes(userId, operationId);
  }

  private async loadFridgeRecipes(userId: UUID, operationId: OperationId | null): Promise<HomeFridgeRecipesResponse> {
    const now = new Date();
    return this.prisma.$transaction(async tx => {
      // GET 只读取当前批次，只有带幂等键的 POST 才推进“换一换”游标。
      const operationType = "home-fridge-recipes:next";
      const requestHash = "advance-current-recommendations";
      if (operationId) {
        const repeated = await getIdempotentResult<HomeFridgeRecipesResponse>(
          tx,
          operationId,
          operationType,
          userId,
          null,
          requestHash
        );
        if (repeated) return repeated;
        await startIdempotentOperation(tx, operationId, operationType, userId, null, requestHash);
      }
      await tx.homeFridgeRecommendationCache.upsert({
        where: { userId },
        create: {
          userId,
          activeIngredientIds: [],
          activeExpiresAt: now,
          candidatePoolExpiresAt: now,
        },
        update: {}
      });
      await tx.$queryRaw`SELECT "user_id" FROM "home_fridge_recommendation_caches" WHERE "user_id" = ${userId} FOR UPDATE`;
      const cache = await tx.homeFridgeRecommendationCache.findUniqueOrThrow({ where: { userId } });
      let activeIds = jsonNumberArray(cache.activeIngredientIds);
      let candidatePool = readCachedFridgeRecipes(cache.candidatePool);
      let currentCandidates = readCachedFridgeRecipes(cache.currentCandidates);
      let cursorRecipeVersionId = cache.cursorRecipeVersionId;
      let hasMore = cache.hasMore;
      let seenNames = Array.isArray(cache.seenRecipeNames)
        ? cache.seenRecipeNames.map(String)
        : [];
      let seenIngredientSets = Array.isArray(cache.seenIngredientSets)
        ? cache.seenIngredientSets.flatMap(value => Array.isArray(value) ? [jsonNumberArray(value)] : [])
        : [];
      let activeExpiresAt = cache.activeExpiresAt;
      let candidatePoolExpiresAt = cache.candidatePoolExpiresAt;

      if (activeExpiresAt <= now) {
        const active = await this.loadActiveFridgeIngredients(tx, userId, now);
        activeIds = active.ingredientIds;
        activeExpiresAt = active.expiresAt;
        candidatePool = [];
        currentCandidates = [];
        cursorRecipeVersionId = 0;
        hasMore = activeIds.length > 0;
        seenNames = [];
        seenIngredientSets = [];
        candidatePoolExpiresAt = new Date(now.getTime() + homeFridgeRecipePoolCacheMs);
      } else if (candidatePoolExpiresAt <= now) {
        candidatePool = [];
        currentCandidates = [];
        cursorRecipeVersionId = 0;
        hasMore = activeIds.length > 0;
        seenNames = [];
        seenIngredientSets = [];
        candidatePoolExpiresAt = new Date(now.getTime() + homeFridgeRecipePoolCacheMs);
      }

      if (!activeIds.length) {
        const result = { items: [], hasNext: false };
        await tx.homeFridgeRecommendationCache.update({
          where: { userId },
          data: {
            activeIngredientIds: [],
            activeExpiresAt,
            candidatePoolExpiresAt,
            candidatePool: [],
            currentCandidates: [],
            cursorRecipeVersionId: 0,
            seenRecipeNames: [],
            seenIngredientSets: [],
            hasMore: false
          }
        });
        if (operationId) {
          await completeIdempotentOperation(tx, operationId, operationType, userId, null, requestHash, result);
        }
        return result;
      }

      if (!operationId && currentCandidates.length) {
        return {
          items: await this.loadCurrentFridgeRecipeItems(tx, userId, currentCandidates),
          hasNext: candidatePool.length >= homeFridgeRecipePageSize || hasMore
        };
      }
      if (!operationId && !hasMore) return { items: [], hasNext: false };

      const seenNameSet = new Set(seenNames);
      const seenIngredientIndex = new Map<number, number[][]>();
      for (const ingredientIds of seenIngredientSets) indexIngredientSet(seenIngredientIndex, ingredientIds);
      const items: HomeFridgeRecipeItem[] = [];
      const displayedCandidates: CachedFridgeRecipe[] = [];
      while (items.length < homeFridgeRecipePageSize) {
        while (candidatePool.length < homeFridgeRecipePoolTarget && hasMore) {
          const batch = await this.loadFridgeRecipeBatch(
            tx,
            userId,
            activeIds,
            cursorRecipeVersionId,
            fridgeRecipeBatchSize(activeIds.length)
          );
          cursorRecipeVersionId = batch.cursorRecipeVersionId;
          hasMore = batch.hasMore;
          for (const candidate of shuffleItems(batch.items)) {
            const normalizedName = normalizeFridgeRecipeName(candidate.title);
            if (seenNameSet.has(normalizedName)) continue;
            if (hasDuplicateIngredientSet(seenIngredientIndex, candidate.matchedIngredientIds)) continue;
            seenNames.push(normalizedName);
            seenNameSet.add(normalizedName);
            seenIngredientSets.push(candidate.matchedIngredientIds);
            indexIngredientSet(seenIngredientIndex, candidate.matchedIngredientIds);
            candidatePool.push(candidate);
          }
        }
        if (!candidatePool.length) break;
        const nextCandidates = candidatePool.splice(0, homeFridgeRecipePageSize - items.length);
        displayedCandidates.push(...nextCandidates);
        items.push(...await this.loadCurrentFridgeRecipeItems(tx, userId, nextCandidates));
      }
      if (items.length < homeFridgeRecipePageSize && !hasMore) {
        candidatePool = [];
        displayedCandidates.length = 0;
        items.length = 0;
      }
      currentCandidates = displayedCandidates;
      await tx.homeFridgeRecommendationCache.update({
        where: { userId },
        data: {
          activeIngredientIds: activeIds,
          activeExpiresAt,
          candidatePoolExpiresAt,
          candidatePool: candidatePool as unknown as Prisma.InputJsonValue,
          currentCandidates: currentCandidates as unknown as Prisma.InputJsonValue,
          cursorRecipeVersionId,
          seenRecipeNames: seenNames as unknown as Prisma.InputJsonValue,
          seenIngredientSets: seenIngredientSets as unknown as Prisma.InputJsonValue,
          hasMore
        }
      });

      const result = {
        items,
        hasNext: candidatePool.length >= homeFridgeRecipePageSize || hasMore
      };
      if (operationId) {
        await completeIdempotentOperation(tx, operationId, operationType, userId, null, requestHash, result);
      }
      return result;
    });
  }

  private async loadActiveFridgeIngredients(tx: Prisma.TransactionClient, userId: UUID, now: Date) {
    // 首页只使用近期仍确认“有”的指定食材，过期时间取最早一项以便及时重建缓存。
    const traces = await tx.fridgeTrace.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000) },
        ingredient: { is: { categoryId: { in: Array.from(homeFridgeActiveIngredientCategories) } } }
      },
      select: {
        id: true,
        ingredientId: true,
        kind: true,
        createdAt: true,
        categoryName: true,
        categoryCode: true,
        ingredient: {
          select: {
            categoryId: true,
            category: { select: { name: true, code: true } }
          }
        }
      }
    });
    const grouped = new Map<number, typeof traces>();
    for (const trace of traces) {
      if (trace.ingredientId === null) continue;
      const items = grouped.get(trace.ingredientId) ?? [];
      items.push(trace);
      grouped.set(trace.ingredientId, items);
    }

    const ingredientIds: number[] = [];
    let expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    for (const [ingredientId, facts] of grouped) {
      const categoryId = facts[0]?.ingredient?.categoryId;
      if (!categoryId || !homeFridgeActiveIngredientCategories.has(categoryId)) continue;
      const state = fridgePresenceState(facts.map(item => ({
        id: item.id,
        kind: item.kind,
        createdAt: item.createdAt,
        categoryName: item.categoryName ?? item.ingredient?.category.name ?? null,
        categoryCode: item.categoryCode ?? item.ingredient?.category.code ?? null
      })), now);
      if (state?.status !== "PRESENT") continue;
      const latest = facts.reduce((current, item) => item.createdAt > current.createdAt || (item.createdAt.getTime() === current.createdAt.getTime() && item.id > current.id) ? item : current);
      const categoryName = latest.categoryName ?? latest.ingredient?.category.name ?? null;
      const categoryCode = latest.categoryCode ?? latest.ingredient?.category.code ?? null;
      const ingredientExpiresAt = new Date(latest.createdAt.getTime() + fridgeTraceWindowDays(categoryName, categoryCode) * 24 * 60 * 60 * 1000);
      ingredientIds.push(ingredientId);
      if (ingredientExpiresAt < expiresAt || ingredientIds.length === 1) expiresAt = ingredientExpiresAt;
    }
    return { ingredientIds: ingredientIds.sort((left, right) => left - right), expiresAt };
  }

  private async loadFridgeRecipeBatch(
    tx: Prisma.TransactionClient,
    userId: UUID,
    activeIngredientIds: number[],
    cursorRecipeVersionId: number,
    batchSize: number
  ) {
    const versionRows = await tx.$queryRaw<Array<{ recipeVersionId: number }>>(Prisma.sql`
      SELECT DISTINCT recipe.current_version_id AS "recipeVersionId"
      FROM recipe_version_ingredients link
      JOIN recipes recipe ON recipe.current_version_id = link.recipe_version_id
      JOIN ingredients ingredient ON ingredient.id = link.ingredient_id
      WHERE (CASE WHEN ingredient.status = 'MERGED' THEN ingredient.merged_to_id ELSE link.ingredient_id END)
          IN (${Prisma.join(activeIngredientIds)})
        AND recipe.current_version_id > ${cursorRecipeVersionId}
        AND recipe.status = 'ACTIVE'
        AND (recipe.owner_id = ${userId} OR (recipe.is_inspiration = TRUE AND recipe.inspiration_category_id IS NOT NULL))
      ORDER BY recipe.current_version_id ASC
      LIMIT ${batchSize}
    `);
    if (!versionRows.length) return { items: [] as CachedFridgeRecipe[], cursorRecipeVersionId, hasMore: false };
    const versionIds = versionRows.map(item => item.recipeVersionId);
    const nextCursor = Math.max(...versionIds);
    const recipes = await tx.recipe.findMany({
      where: {
        currentVersionId: { in: versionIds },
        status: "ACTIVE",
        OR: [{ ownerId: userId }, publicInspirationRecipeWhere("ACTIVE")]
      },
      select: {
        id: true,
        ownerId: true,
        title: true,
        coverImageUrl: true,
        isInspiration: true,
        inspirationCategoryId: true,
        currentVersionId: true,
        currentVersion: { select: { difficulty: true, duration: true } }
      },
      orderBy: [{ currentVersionId: "asc" }, { id: "asc" }]
    });
    const links = await tx.recipeVersionIngredient.findMany({
      where: { recipeVersionId: { in: versionIds } },
      select: { recipeVersionId: true, ingredientId: true }
    });
    const mergedIngredients = links.length
      ? await tx.ingredient.findMany({
        where: { id: { in: Array.from(new Set(links.map(link => link.ingredientId))) }, status: "MERGED", mergedToId: { not: null } },
        select: { id: true, mergedToId: true }
      })
      : [];
    const mergedTargets = new Map(mergedIngredients.flatMap(item =>
      item.mergedToId === null ? [] : [[item.id, item.mergedToId] as const]
    ));
    const ingredientIdsByVersion = new Map<number, Set<number>>();
    for (const link of links) {
      const ids = ingredientIdsByVersion.get(link.recipeVersionId) ?? new Set<number>();
      ids.add(mergedTargets.get(link.ingredientId) ?? link.ingredientId);
      ingredientIdsByVersion.set(link.recipeVersionId, ids);
    }
    const inspirationVersionIds = recipes.filter(item => item.isInspiration && item.inspirationCategoryId !== null).map(item => item.currentVersionId);
    const ownedRecipeMap = await this.loadOwnedOriginRecipeMap(userId, inspirationVersionIds);
    const items = recipes.flatMap(recipe => {
      // 历史版本可能仍引用已归并食材，查询时统一到目标 ID 后再计算命中和去重。
      const ingredientIds = canonicalRecipeIngredientIds(
        ingredientIdsByVersion.get(recipe.currentVersionId) ?? [],
        mergedTargets
      );
      const matchedIngredientIds = ingredientIds.filter(id => activeIngredientIds.includes(id));
      if (!matchedIngredientIds.length) return [];
      const item = this.toHomeFridgeRecipe(recipe, { matchedCount: matchedIngredientIds.length, totalCount: ingredientIds.length }, ownedRecipeMap);
      if (!item || (item.kind === "INSPIRATION" && item.ownedRecipeId !== null)) return [];
      return [{
        recipeId: recipe.id,
        title: recipe.title,
        recipeVersionId: recipe.currentVersionId,
        matchedIngredientIds,
        totalIngredientCount: ingredientIds.length
      }];
    });
    return { items, cursorRecipeVersionId: nextCursor, hasMore: versionRows.length === batchSize };
  }

  private async loadCurrentFridgeRecipeItems(
    tx: Prisma.TransactionClient,
    userId: UUID,
    candidates: CachedFridgeRecipe[]
  ) {
    if (!candidates.length) return [];
    const candidatesById = new Map(candidates.map(item => [item.recipeId, item]));
    const currentRecipes = await tx.recipe.findMany({
      where: {
        id: { in: Array.from(candidatesById.keys()) },
        status: "ACTIVE",
        OR: [{ ownerId: userId }, publicInspirationRecipeWhere("ACTIVE")]
      },
      select: {
        id: true,
        ownerId: true,
        title: true,
        coverImageUrl: true,
        isInspiration: true,
        inspirationCategoryId: true,
        currentVersionId: true,
        currentVersion: { select: { difficulty: true, duration: true } }
      }
    });
    const inspirationVersionIds = currentRecipes
      .filter(item => item.isInspiration && item.inspirationCategoryId !== null)
      .map(item => item.currentVersionId);
    const ownedRecipeMap = await this.loadOwnedOriginRecipeMap(userId, inspirationVersionIds);
    const recipeById = new Map(currentRecipes.map(item => [item.id, item]));
    return candidates.flatMap(candidate => {
      const recipe = recipeById.get(candidate.recipeId);
      if (!recipe || recipe.currentVersionId !== candidate.recipeVersionId) return [];
      if (recipe.isInspiration && ownedRecipeMap.has(recipe.currentVersionId)) return [];
      const item = this.toHomeFridgeRecipe(recipe, {
        matchedCount: candidate.matchedIngredientIds.length,
        totalCount: candidate.totalIngredientCount
      }, ownedRecipeMap);
      return item ? [item] : [];
    });
  }

  async updateAdminHomeEntries(
    adminId: UUID,
    operationId: OperationId,
    body: UpdateHomeEntriesRequest
  ): Promise<AdminHomeEntriesResponse> {
    const items = this.updateItems(body.items);
    const requestHash = hashText(JSON.stringify(items));

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeEntriesResponse>(
        tx,
        operationId,
        "admin-home-entries:update",
        adminId,
        requestHash
      );
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-home-entries:update", adminId, requestHash);

      const currentItems = await this.listCards(tx);
      const currentMap = new Map(currentItems.map(item => [item.placement, item]));

      for (const item of items) {
        const current = currentMap.get(item.placement);
        if (!current) {
          throw new ConflictException("首页快捷入口初始化失败，请刷新后重试");
        }
        if (current.version !== item.expectedVersion) {
          throw new ConflictException(`${getPlacementLabel(item.placement)}已被更新，请刷新后重试`);
        }
      }

      await Promise.all(
        items.map(item =>
          tx.homeFeatureBoardCard.update({
            where: { placement: item.placement },
            data: {
              title: item.title,
              subtitle: item.subtitle,
              targetType: item.targetType,
              targetValue: item.targetValue,
              artImageUrl: item.artImageUrl,
              badgeText: item.badgeText,
              version: { increment: 1 }
            }
          })
        )
      );

      const result = await this.getAdminEntries(tx);
      await completeAdminIdempotentOperation(tx, operationId, "admin-home-entries:update", adminId, requestHash, result);
      return result;
    });
  }

  async setAdminHomeEntryStatus(
    adminId: UUID,
    operationId: OperationId,
    placement: HomeFeatureBoardPlacement,
    body: SetHomeEntryStatusRequest
  ): Promise<AdminHomeEntryItem> {
    const requestHash = hashText(JSON.stringify({ placement, status: body.status, expectedVersion: body.expectedVersion }));
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeEntryItem>(
        tx,
        operationId,
        "admin-home-entries:status",
        adminId,
        requestHash
      );
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-home-entries:status", adminId, requestHash);

      const current = await this.requireCard(tx, placement);
      if (current.version !== body.expectedVersion) {
        throw new ConflictException(`${getPlacementLabel(placement)}已被更新，请刷新后重试`);
      }

      const updated =
        current.status === body.status
          ? current
          : await tx.homeFeatureBoardCard.update({
              where: { placement },
              data: {
                status: body.status,
                version: { increment: 1 }
              }
            });

      const result = this.toAdminItem(updated);
      await completeAdminIdempotentOperation(tx, operationId, "admin-home-entries:status", adminId, requestHash, result);
      return result;
    });
  }

  async uploadAdminHomeEntryImage(
    request: RequestLike,
    adminId: UUID,
    operationId: OperationId,
    placement: HomeFeatureBoardPlacement,
    expectedVersion: number,
    file: { buffer?: Buffer; size?: number } | undefined
  ): Promise<AdminHomeEntryItem> {
    const staged = await this.homeImageService.stageImageUpload(placement, file);
    const requestHash = createHash("sha256")
      .update("upload:")
      .update(placement)
      .update(":")
      .update(String(expectedVersion))
      .update(":")
      .update(staged.kind)
      .update(":")
      .update(file?.buffer ?? Buffer.alloc(0))
      .digest("hex");

    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminHomeEntryItem>(
          tx,
          operationId,
          "admin-home-entries:image:upload",
          adminId,
          requestHash
        );
        if (repeated) return repeated;

        await startAdminIdempotentOperation(tx, operationId, "admin-home-entries:image:upload", adminId, requestHash);

        const current = await this.requireCard(tx, placement);
        if (current.version !== expectedVersion) {
          throw new ConflictException(`${getPlacementLabel(placement)}已被更新，请刷新后重试`);
        }

        const backupPath = await this.homeImageService.replaceStagedImage(placement, staged.tempPath, staged.kind);
        try {
          const updated = await tx.homeFeatureBoardCard.update({
            where: { placement },
            data: {
              artImageUrl: this.homeImageService.buildImagePath(request, placement),
              version: { increment: 1 }
            }
          });
          await this.homeImageService.finalizeReplacedImage(backupPath);
          const result = this.toAdminItem(updated);
          await completeAdminIdempotentOperation(tx, operationId, "admin-home-entries:image:upload", adminId, requestHash, result);
          return result;
        } catch (error) {
          await this.homeImageService.rollbackReplacedImage(placement, backupPath);
          throw error;
        }
      });
    } finally {
      await this.homeImageService.discardStagedImage(staged.tempPath);
    }
  }

  async clearAdminHomeEntryImage(
    adminId: UUID,
    operationId: OperationId,
    placement: HomeFeatureBoardPlacement,
    expectedVersion: number
  ): Promise<AdminHomeEntryItem> {
    const requestHash = `clear:${placement}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminHomeEntryItem>(
        tx,
        operationId,
        "admin-home-entries:image:clear",
        adminId,
        requestHash
      );
      if (repeated) return repeated;

      await startAdminIdempotentOperation(tx, operationId, "admin-home-entries:image:clear", adminId, requestHash);

      const current = await this.requireCard(tx, placement);
      if (current.version !== expectedVersion) {
        throw new ConflictException(`${getPlacementLabel(placement)}已被更新，请刷新后重试`);
      }

      const backupPath = current.artImageUrl && imagePathPattern.test(current.artImageUrl) ? await this.homeImageService.stageClearImage(placement) : null;

      try {
        const updated = await tx.homeFeatureBoardCard.update({
          where: { placement },
          data: {
            artImageUrl: null,
            version: { increment: 1 }
          }
        });
        await this.homeImageService.finalizeClearedImage(backupPath);
        const result = this.toAdminItem(updated);
        await completeAdminIdempotentOperation(tx, operationId, "admin-home-entries:image:clear", adminId, requestHash, result);
        return result;
      } catch (error) {
        await this.homeImageService.rollbackClearedImage(placement, backupPath);
        throw error;
      }
    });
  }

  async getHomeEntryImageAsset(placement: HomeFeatureBoardPlacement) {
    const item = await this.requireCard(this.prisma, placement);
    if (!item.artImageUrl || !imagePathPattern.test(item.artImageUrl)) {
      throw new NotFoundException("首页快捷入口图片不存在");
    }
    return this.homeImageService.getImageAsset(placement);
  }

  private async getAdminEntries(db: BoardDb): Promise<AdminHomeEntriesResponse> {
    const items = await this.listCards(db);
    return {
      items: quickPlacements.map(placement => this.toAdminItem(this.requireMappedCard(items, placement))),
      pageTargets
    };
  }

  private async listCards(db: BoardDb = this.prisma) {
    await this.ensureCards(db);
    const items = await db.homeFeatureBoardCard.findMany({
      where: { placement: { in: quickPlacements } }
    });
    const legacyItems = items.filter(item => item.targetType === "PAGE" && !pageTargetSet.has(item.targetValue));
    if (!legacyItems.length) {
      return items;
    }

    await Promise.all(
      legacyItems.map(item =>
        db.homeFeatureBoardCard.update({
          where: { placement: item.placement },
          data: {
            ...defaultCards[item.placement],
            version: { increment: 1 }
          }
        })
      )
    );

    return db.homeFeatureBoardCard.findMany({
      where: { placement: { in: quickPlacements } }
    });
  }

  private async ensureCards(db: BoardDb) {
    await db.homeFeatureBoardCard.createMany({
      data: quickPlacements.map(placement => ({
        placement,
        status: "LISTED" as HomeEntryStatus,
        ...defaultCards[placement]
      })),
      skipDuplicates: true
    });
  }

  private updateItems(items: UpdateHomeEntriesRequest["items"]): Array<HomeCardInput & { expectedVersion: number }> {
    if (!items.length) {
      throw new BadRequestException("首页快捷入口至少提交 1 个坑位");
    }
    if (items.length > quickPlacements.length) {
      throw new BadRequestException("首页快捷入口最多提交 4 个坑位");
    }

    const uniquePlacements = new Set<HomeFeatureBoardPlacement>();
    return items.map(item => {
      const entry: HomeCardInput & { expectedVersion: number } = {
        placement: item.placement,
        title: item.title.trim(),
        subtitle: cleanText(item.subtitle),
        targetType: item.targetType,
        targetValue: item.targetValue.trim(),
        artImageUrl: cleanText(item.imageUrl),
        badgeText: cleanText(item.badgeText),
        expectedVersion: item.expectedVersion
      };
      if (uniquePlacements.has(entry.placement)) {
        throw new BadRequestException("首页快捷入口存在重复坑位");
      }
      uniquePlacements.add(entry.placement);
      assertHomeTarget(entry);
      return entry;
    });
  }

  private async requireCard(db: BoardDb, placement: HomeFeatureBoardPlacement) {
    await this.ensureCards(db);
    const item = await db.homeFeatureBoardCard.findUnique({
      where: { placement }
    });
    if (!item) {
      throw new ConflictException("首页快捷入口初始化失败，请刷新后重试");
    }
    return item;
  }

  private requireMappedCard(items: HomeFeatureBoardCard[], placement: HomeFeatureBoardPlacement) {
    const item = items.find(entry => entry.placement === placement);
    if (!item) {
      throw new ConflictException("首页快捷入口初始化失败，请刷新后重试");
    }
    return item;
  }

  private toPublicItem(request: RequestLike, item: HomeFeatureBoardCard): HomeEntryItem {
    return {
      id: placementIds[item.placement],
      placement: item.placement,
      title: item.title,
      subtitle: item.subtitle,
      targetType: item.targetType,
      targetValue: item.targetValue,
      imageUrl: this.resolveImageUrl(request, item),
      badgeText: item.badgeText
    };
  }

  private toAdminItem(item: HomeFeatureBoardCard): AdminHomeEntryItem {
    return {
      id: placementIds[item.placement],
      placement: item.placement,
      title: item.title,
      subtitle: item.subtitle,
      status: item.status,
      targetType: item.targetType,
      targetValue: item.targetValue,
      imageUrl: item.artImageUrl,
      badgeText: item.badgeText,
      version: item.version
    };
  }

  private resolveImageUrl(request: RequestLike, item: HomeFeatureBoardCard) {
    if (!item.artImageUrl) return null;
    if (isInternalImagePath(item.artImageUrl)) {
      const path = `${item.artImageUrl}?v=${encodeURIComponent(item.updatedAt.toISOString())}`;
      return this.toAbsoluteUrl(request, path);
    }
    if (item.artImageUrl.startsWith("/")) {
      return this.toAbsoluteUrl(request, item.artImageUrl);
    }
    return item.artImageUrl;
  }

  private toAbsoluteUrl(request: RequestLike, path: string) {
    const host = request.get?.("host");
    if (!host) return path;
    const proto = request.get?.("x-forwarded-proto") || request.protocol || "https";
    return `${proto}://${host}${path}`;
  }

  private pickRecentArrangement(candidates: RecentArrangementCandidate[], bucket: RecentArrangementBucket, nowMs: number) {
    const scoped = candidates.filter(item => item.bucket === bucket);
    if (!scoped.length) return null;
    const events = scoped.filter(item => item.sourceType === "EVENT").sort((left, right) => compareCandidates(left, right, nowMs));
    if (events.length) return events[0];
    const plans = scoped.filter(item => item.sourceType === "PLAN").sort((left, right) => compareCandidates(left, right, nowMs));
    return plans[0] ?? null;
  }

  private resolveEventArrangementStatus(
    eventStatus: "PLANNED" | "CONFIRMED" | "CANCELLED" | "COMPLETED",
    completedAt: Date | null,
    scheduledMs: number,
    menuCount: number,
    gapCount: number | null,
    nowMs: number
  ): HomeRecentArrangementStatus | null {
    if (eventStatus === "CANCELLED") return null;
    if (eventStatus === "COMPLETED" || completedAt || scheduledMs <= nowMs) return "TIME_UP_SHARE";
    if (!menuCount) return "EMPTY_MENU";
    if ((gapCount ?? 0) > 0) return "PENDING_SHOPPING";
    if (eventStatus === "CONFIRMED") return "READY_TO_COOK";
    return "PENDING_CONFIRM";
  }

  private resolvePlanArrangementStatus(
    menuLockedAt: Date | null,
    menuCount: number,
    gapCount: number | null,
    scheduledMs: number,
    nowMs: number
  ): HomeRecentArrangementStatus | null {
    if (scheduledMs <= nowMs) return null;
    if (!menuCount) return "EMPTY_MENU";
    if (menuLockedAt && (gapCount ?? 0) > 0) return "PENDING_SHOPPING";
    if (menuLockedAt) return "READY_TO_COOK";
    return "PENDING_CONFIRM";
  }

  private resolveNextMealStatus(arrangement: HomeRecentArrangement | null): HomeNextMealStatus {
    if (!arrangement) return "NO_ARRANGEMENT";
    if (arrangement.status === "TIME_UP_SHARE") return "COMPLETED";
    if (arrangement.status === "PENDING_SHOPPING") return "NEED_SHOPPING";
    if (arrangement.status === "READY_TO_COOK") return "READY_TO_COOK";
    return "NEED_GAP_CHECK";
  }

  private resolveWeekOverviewStatus(nextMealState: HomeNextMealState): HomeWeekOverviewStatus {
    if (nextMealState.arrangement) {
      if (nextMealState.status === "NO_ARRANGEMENT") return "NO_ARRANGEMENT";
      if (nextMealState.status === "COMPLETED") return "COMPLETED";
      if (nextMealState.status === "READY_TO_COOK") return "READY_TO_COOK";
      if (nextMealState.status === "NEED_SHOPPING") return "PENDING_SHOPPING";
      return nextMealState.arrangement.menuCount > 0 ? "PENDING_CONFIRM" : "EMPTY_MENU";
    }
    return "NO_ARRANGEMENT";
  }

  private resolveWeekOverviewTitle(status: HomeWeekOverviewStatus, plannedDayCount: number) {
    if (status === "EMPTY_MENU") return `这周先排了 ${Math.max(plannedDayCount, 1)} 顿`;
    if (status === "PENDING_CONFIRM") return `这周已安排 ${Math.max(plannedDayCount, 1)} 顿`;
    if (status === "PENDING_SHOPPING") return "这周安排差一点";
    if (status === "READY_TO_COOK") return "下一顿已经定好";
    if (status === "COMPLETED") return "这周基本排好了";
    return "这周还没安排";
  }

  private buildWeekOverviewSummary(status: HomeWeekOverviewStatus) {
    if (status === "EMPTY_MENU") return "继续往后排";
    if (status === "PENDING_CONFIRM") return "还有几天空着";
    if (status === "PENDING_SHOPPING") return "还差几样食材";
    if (status === "READY_TO_COOK") return "可以提前准备";
    if (status === "COMPLETED") return "这周基本排好";
    return "先安排几顿";
  }

  private resolveWeekOverviewActionText(status: HomeWeekOverviewStatus) {
    if (status === "EMPTY_MENU") return "继续安排";
    if (status === "PENDING_CONFIRM") return "查看本周";
    if (status === "PENDING_SHOPPING") return "去补食材";
    if (status === "READY_TO_COOK") return "查看安排";
    if (status === "COMPLETED") return "查看本周";
    return "开始安排";
  }

  private resolveWeekOverviewTarget(
    status: HomeWeekOverviewStatus,
    arrangement: HomeRecentArrangement | null,
    activeListCount: number
  ) {
    if (arrangement) {
      if (status === "EMPTY_MENU") return buildRecentArrangementTarget(arrangement, "menu");
      if (status === "PENDING_CONFIRM") return buildRecentArrangementTarget(arrangement, "shopping");
      if (status === "PENDING_SHOPPING") return activeListCount > 0 ? "/pages_pantry/list/index" : "/pages_pantry/gap/index";
      if (status === "READY_TO_COOK") return buildRecentArrangementTarget(arrangement, "assistant");
      if (status === "COMPLETED") return "/pages_meal/plan/index";
    }
    return "/pages_meal/plan/index";
  }

  private async resolveWeekPlanDayStatus(userId: UUID, plan: WeekPlanRow, scheduledMs: number, nowMs: number): Promise<HomeWeekDayStatus> {
    if (plan.status === "COMPLETED" || plan.completedAt || plan.diningEvent?.status === "COMPLETED" || plan.diningEvent?.completedAt) {
      return "COMPLETED";
    }
    if (!plan.dishes.length) return "PLANNED";
    const gapCount = await this.resolvePlanGapCount(userId, plan.id);
    const arrangementStatus = this.resolvePlanArrangementStatus(plan.menuLockedAt, plan.dishes.length, gapCount, scheduledMs, nowMs);
    if (arrangementStatus === "PENDING_SHOPPING") return "PENDING_SHOPPING";
    if (arrangementStatus === "READY_TO_COOK") return "READY_TO_COOK";
    if (arrangementStatus === "PENDING_CONFIRM") return "PENDING_CONFIRM";
    return "PLANNED";
  }

  private pickHigherDayStatus(current: HomeWeekDayStatus, next: HomeWeekDayStatus): HomeWeekDayStatus {
    const priority: Record<HomeWeekDayStatus, number> = {
      EMPTY: 0,
      COMPLETED: 1,
      PLANNED: 2,
      PENDING_CONFIRM: 3,
      READY_TO_COOK: 4,
      PENDING_SHOPPING: 5
    };
    return priority[next] > priority[current] ? next : current;
  }

  private formatWeekOverviewTime(arrangement: HomeRecentArrangement) {
    if (!arrangement.scheduledAt) return arrangement.planDate;
    const date = new Date(arrangement.scheduledAt);
    const now = new Date();
    const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const baseDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diff = Math.round((targetDay - baseDay) / 86400000);
    const timeText = `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
    if (diff === 0) return `今天 ${timeText}`;
    if (diff === 1) return `明天 ${timeText}`;
    if (diff === -1) return `昨天 ${timeText}`;
    return `${date.getMonth() + 1}月${date.getDate()}日 ${timeText}`;
  }

  private async resolveEventGapCount(userId: UUID, eventId: UUID) {
    try {
      const items = await this.pantryService.previewEventGap(userId, eventId);
      return items.length;
    } catch (error) {
      return null;
    }
  }

  private async resolvePlanGapCount(userId: UUID, planItemId: UUID) {
    try {
      const items = await this.pantryService.previewPlanGap(userId, planItemId);
      return items.length;
    } catch (error) {
      return null;
    }
  }

  private async loadOwnedOriginRecipeMap(userId: UUID, sourceVersionIds: UUID[]) {
    const uniqueIds = Array.from(new Set(sourceVersionIds));
    if (!uniqueIds.length) return new Map<UUID, UUID>();
    const items = await this.prisma.recipe.findMany({
      where: {
        ownerId: userId,
        status: "ACTIVE",
        originVersionId: { in: uniqueIds }
      },
      select: {
        id: true,
        originVersionId: true
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
    });
    const result = new Map<UUID, UUID>();
    for (const item of items) {
      if (!item.originVersionId || result.has(item.originVersionId)) continue;
      result.set(item.originVersionId, item.id);
    }
    return result;
  }

  private toHomeFridgeRecipe(
    recipe: FridgeRecipeRow,
    primaryScore: { matchedCount: number; totalCount: number } | null,
    ownedRecipeMap: Map<UUID, UUID>
  ): HomeFridgeRecipeItem | null {
    if (!primaryScore || primaryScore.matchedCount === 0 || primaryScore.totalCount === 0) return null;
    const kind = recipe.isInspiration ? "INSPIRATION" : "MY";

    return {
      recipeId: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl ?? null,
      kind,
      ownedRecipeId: kind === "INSPIRATION" ? ownedRecipeMap.get(recipe.currentVersionId) ?? null : null,
      difficulty: (recipe.currentVersion.difficulty ?? null) as RecipeDifficulty | null,
      duration: (recipe.currentVersion.duration ?? null) as RecipeDuration | null,
      difficultyText: recipeDifficultyText((recipe.currentVersion.difficulty ?? null) as RecipeDifficulty | null),
      durationText: recipeDurationText((recipe.currentVersion.duration ?? null) as RecipeDuration | null),
      matchedIngredientCount: primaryScore.matchedCount,
      missingIngredientCount: primaryScore.totalCount - primaryScore.matchedCount,
      totalIngredientCount: primaryScore.totalCount,
      fridgeFit:
        primaryScore.matchedCount === primaryScore.totalCount
          ? "HIGH"
          : primaryScore.matchedCount > 0
            ? "MEDIUM"
            : "LOW"
    };
  }
}
