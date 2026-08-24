import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type HomeEntryStatus, type HomeFeatureBoardCard, type HomeFeatureBoardPlacement, type HomeFeatureBoardTargetType, type MealSlot, Prisma } from "@prisma/client";
import { recipeDifficultyText, recipeDurationText } from "../../common/display-text";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";
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
  OperationId,
  RecipeDifficulty,
  RecipeDuration,
  SetHomeEntryStatusRequest,
  UUID,
  UpdateHomeEntriesRequest
} from "../../contracts/types";
import { PantryService } from "../pantry/pantry.service";
import { versionToContent } from "../recipe/recipe-content";
import { HomeImageService } from "./home-image.service";

type BoardDb = Prisma.TransactionClient | PrismaService;
type HomeCardInput = Pick<HomeFeatureBoardCard, "placement" | "title" | "subtitle" | "targetType" | "targetValue" | "artImageUrl" | "badgeText">;
type FridgeRecipeRow = Prisma.RecipeGetPayload<{
  include: {
    currentVersion: true;
  };
}>;
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

const featurePlacements: HomeFeatureBoardPlacement[] = ["MAIN", "SIDE_TOP", "SIDE_BOTTOM"];
const quickPlacements: HomeFeatureBoardPlacement[] = ["QUICK_1", "QUICK_2", "QUICK_3", "QUICK_4"];
const allPlacements: HomeFeatureBoardPlacement[] = [...featurePlacements, ...quickPlacements];
const primaryWindowMs = 24 * 60 * 60 * 1000;
const fallbackWindowMs = 36 * 60 * 60 * 1000;
const pastShareWindowMs = 24 * 60 * 60 * 1000;
const maxHomeFridgeRecipeCount = 3;
const maxHomeFridgeMissingCount = 2;
const arrangementStatusPriority: Record<HomeRecentArrangementStatus, number> = {
  TIME_UP_SHARE: 5,
  READY_TO_COOK: 4,
  PENDING_SHOPPING: 3,
  PENDING_CONFIRM: 2,
  EMPTY_MENU: 1
};
const placementIds: Record<HomeFeatureBoardPlacement, string> = {
  MAIN: "feature-main",
  SIDE_TOP: "feature-side-top",
  SIDE_BOTTOM: "feature-side-bottom",
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
const imagePathPattern = /^\/api\/public-assets\/home-entries\/(MAIN|SIDE_TOP|SIDE_BOTTOM|QUICK_1|QUICK_2|QUICK_3|QUICK_4)$/i;
const defaultCards: Record<HomeFeatureBoardPlacement, Omit<HomeCardInput, "placement">> = {
  MAIN: {
    title: "一起吃饭",
    subtitle: "挑挑自己想吃的",
    targetType: "PAGE",
    targetValue: "/pages_meal/plan/index",
    artImageUrl: null,
    badgeText: null
  },
  SIDE_TOP: {
    title: "本周灵感",
    subtitle: "这周吃点不一样",
    targetType: "PAGE",
    targetValue: "/pages_home/topic/index",
    artImageUrl: null,
    badgeText: "周"
  },
  SIDE_BOTTOM: {
    title: "餐桌话题",
    subtitle: "看看最近吃什么",
    targetType: "PAGE",
    targetValue: "/pages_home/table-topic/index",
    artImageUrl: null,
    badgeText: "题"
  },
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

function cleanText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text ? text : null;
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function fridgeFitRank(value: HomeFridgeRecipeItem["fridgeFit"]) {
  if (value === "HIGH") return 3;
  if (value === "MEDIUM") return 2;
  return 1;
}

function isInternalImagePath(value: string | null | undefined) {
  return Boolean(value && imagePathPattern.test(value));
}

function getPlacementLabel(placement: HomeFeatureBoardPlacement) {
  if (placement === "MAIN") return "主卡";
  if (placement === "SIDE_TOP") return "右上卡";
  if (placement === "SIDE_BOTTOM") return "右下卡";
  if (placement === "QUICK_1") return "快捷入口 1";
  if (placement === "QUICK_2") return "快捷入口 2";
  if (placement === "QUICK_3") return "快捷入口 3";
  return "快捷入口 4";
}

function isQuickPlacement(placement: HomeFeatureBoardPlacement) {
  return quickPlacements.includes(placement);
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
      items: [
        ...featurePlacements.map(placement => this.toPublicItem(request, this.requireMappedCard(items, placement))),
        ...quickPlacements
          .map(placement => this.requireMappedCard(items, placement))
          .filter(item => item.status === "LISTED")
          .map(item => this.toPublicItem(request, item))
      ]
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
      this.pickRecentArrangement(candidates, "PAST_SHARE", nowMs) ||
      this.pickRecentArrangement(candidates, "FALLBACK", nowMs);

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

  async getFridgeRecipes(userId: UUID): Promise<HomeFridgeRecipesResponse> {
    const [recipes, fridgeItems] = await Promise.all([
      this.prisma.recipe.findMany({
        where: {
          status: "ACTIVE",
          OR: [{ ownerId: userId }, { ownerId: null, inspirationCategoryId: { not: null } }]
        },
        include: {
          currentVersion: true
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
      }),
      this.prisma.fridgeItem.findMany({
        where: {
          userId,
          available: true
        },
        select: {
          ingredientId: true
        }
      })
    ]);

    const fridgeIngredientIds = new Set(
      fridgeItems
        .map(item => item.ingredientId)
        .filter((item): item is UUID => typeof item === "number" && item > 0)
    );
    const inspirationVersionIds = recipes
      .filter(item => item.ownerId === null && item.inspirationCategoryId !== null)
      .map(item => item.currentVersionId);
    const ownedRecipeMap = await this.loadOwnedOriginRecipeMap(userId, inspirationVersionIds);
    const items = recipes
      .map(item => this.toHomeFridgeRecipe(item, fridgeIngredientIds, ownedRecipeMap))
      .filter((item): item is HomeFridgeRecipeItem => Boolean(item))
      .sort((left, right) => {
        const fitDiff = fridgeFitRank(right.fridgeFit) - fridgeFitRank(left.fridgeFit);
        if (fitDiff !== 0) return fitDiff;
        if (left.kind !== right.kind) return left.kind === "MY" ? -1 : 1;
        if (left.missingIngredientCount !== right.missingIngredientCount) {
          return left.missingIngredientCount - right.missingIngredientCount;
        }
        if (left.matchedIngredientCount !== right.matchedIngredientCount) {
          return right.matchedIngredientCount - left.matchedIngredientCount;
        }
        return right.recipeId - left.recipeId;
      })
      .slice(0, maxHomeFridgeRecipeCount);

    return { items };
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
    if (!isQuickPlacement(placement)) {
      throw new BadRequestException("只有首页四宫格入口支持上架和下架");
    }

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
              artImageUrl: this.homeImageService.buildImagePath(placement),
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

      const backupPath =
        current.artImageUrl === this.homeImageService.buildImagePath(placement)
          ? await this.homeImageService.stageClearImage(placement)
          : null;

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
    if (item.artImageUrl !== this.homeImageService.buildImagePath(placement)) {
      throw new NotFoundException("首页快捷入口图片不存在");
    }
    return this.homeImageService.getImageAsset(placement);
  }

  private async getAdminEntries(db: BoardDb): Promise<AdminHomeEntriesResponse> {
    const items = await this.listCards(db);
    return {
      items: allPlacements.map(placement => this.toAdminItem(this.requireMappedCard(items, placement))),
      pageTargets
    };
  }

  private async listCards(db: BoardDb = this.prisma) {
    await this.ensureCards(db);
    const items = await db.homeFeatureBoardCard.findMany({
      where: { placement: { in: allPlacements } }
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
      where: { placement: { in: allPlacements } }
    });
  }

  private async ensureCards(db: BoardDb) {
    await db.homeFeatureBoardCard.createMany({
      data: allPlacements.map(placement => ({
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
    if (items.length > allPlacements.length) {
      throw new BadRequestException("首页快捷入口最多提交 7 个坑位");
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
    fridgeIngredientIds: Set<UUID>,
    ownedRecipeMap: Map<UUID, UUID>
  ): HomeFridgeRecipeItem | null {
    const content = versionToContent(recipe.currentVersion);
    const ingredientIds = Array.from(
      new Set(
        content.ingredients
          .map(item => item.ingredientId ?? null)
          .filter((item): item is UUID => typeof item === "number" && item > 0)
      )
    );
    const totalIngredientCount = ingredientIds.length;
    if (!totalIngredientCount) return null;
    const matchedIngredientCount = ingredientIds.filter(item => fridgeIngredientIds.has(item)).length;
    const missingIngredientCount = totalIngredientCount - matchedIngredientCount;
    if (missingIngredientCount > maxHomeFridgeMissingCount) return null;
    const kind = recipe.ownerId === null ? "INSPIRATION" : "MY";

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
      matchedIngredientCount,
      missingIngredientCount,
      totalIngredientCount,
      fridgeFit:
        matchedIngredientCount === totalIngredientCount
          ? "HIGH"
          : matchedIngredientCount > 0
            ? "MEDIUM"
            : "LOW"
    };
  }
}
