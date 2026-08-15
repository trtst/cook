import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type MealSlot } from "@prisma/client";
import { recipeDurationText } from "../../common/display-text";
import { PrismaService } from "../../common/prisma.service";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { removeStorageLedger, sizeOfJson, upsertStorageLedger } from "../../common/storage-ledger";
import type {
  CheckRandomMenuGapResponse,
  DiningMemorySharePreview,
  DiningMemoryShareSnapshot,
  DiningEventParticipantSummary,
  DiningEventSummary,
  DiningGroupActivitySummary,
  MealPlanCookAssistant,
  MealPlanCookAssistantSummary,
  MealPlanCookAssistantTask,
  MealPlanCookAssistantTimelineStep,
  MealPlanDishPurchaseState,
  MealPlanSummary,
  MealPollDetail,
  MealPollSummary,
  OperationId,
  PageResult,
  RandomGapIngredient,
  RandomGapInventoryDecision,
  RandomGapItem,
  RandomGapSummary,
  RandomMenuItem,
  RandomMenuResponse,
  RandomMenuWarning,
  RandomReplaceConstraint,
  RandomSlotPlan,
  ReplaceRandomMenuCurrentItem,
  ReplaceRandomMenuSlotResponse,
  RecipeDuration,
  RecipeProteinType,
  RecipeSlotType,
  RecipeContentSnapshot,
  SharePreviewResponse,
  UUID
} from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";
import { fromJson, toJson, versionToContent } from "../recipe/recipe-content";
import { MedalService } from "../user/medal.service";

type DiningEventRow = Prisma.DiningEventGetPayload<{
  include: {
    user: { select: { uid: true; nickname: true; avatarUrl: true } };
    mealPlanItem: { select: { planDate: true; mealSlot: true } };
    participants: {
      include: {
        user: { select: { uid: true; nickname: true; avatarUrl: true } };
        bringRecipe: true;
      };
    };
    menuItems: {
      include: {
        cookUser: { select: { uid: true; nickname: true } };
        recipeVersion: {
          include: {
            currentRecipes: {
              select: { id: true; coverImageUrl: true };
              take: 1;
            };
          };
        };
      };
    };
  };
}>;

type MealPollSummaryRow = Prisma.MealPollGetPayload<{
  include: {
    _count: { select: { candidates: true; responses: true } };
  };
}>;

type MealPollDetailRow = Prisma.MealPollGetPayload<{
  include: {
    createdBy: { select: { uid: true; nickname: true } };
    candidates: {
      include: {
        suggestedBy: { select: { uid: true } };
        recipeVersion: {
          include: {
            currentRecipes: {
              select: { id: true; coverImageUrl: true };
              take: 1;
            };
          };
        };
        _count: { select: { responseItems: true } };
      };
    };
    responses: {
      include: {
        user: { select: { uid: true } };
        items: {
          include: {
            candidate: { select: { id: true; sourceType: true } };
          };
        };
      };
    };
    _count: { select: { candidates: true; responses: true } };
  };
}>;

type ActivityRow = Prisma.DiningGroupActivityGetPayload<{
  include: {
    actor: { select: { uid: true; nickname: true } };
  };
}>;

type DiningEventMemoryShareRow = Prisma.DiningEventMemoryShareGetPayload<{}>;

type MealDb = Prisma.TransactionClient | PrismaService;

const mealPlanArgs = Prisma.validator<Prisma.MealPlanItemDefaultArgs>()({
  include: {
    cookAssistant: true,
    diningEvent: true,
    dishes: {
      select: {
        id: true,
        planItemId: true,
        recipeId: true,
        recipeVersionId: true,
        sortOrder: true,
        slotType: true,
        purchaseState: true,
        createdAt: true,
        updatedAt: true,
        recipeVersion: {
          select: {
            name: true,
            baseServings: true,
            duration: true
          }
        }
      },
      orderBy: [{ sortOrder: Prisma.SortOrder.asc }, { id: Prisma.SortOrder.asc }]
    }
  }
});

const mealPlanInclude = mealPlanArgs.include;

type MealPlanRow = Prisma.MealPlanItemGetPayload<typeof mealPlanArgs>;

type ResolvedMenuVersion = {
  recipeId: UUID | null;
  recipeVersionId: UUID;
  coverUrl: string | null;
  title: string;
  content: RecipeContentSnapshot;
};

type PlanMenuItemInput = {
  slotType: RecipeSlotType | null;
  sortOrder: number;
  purchaseState: MealPlanDishPurchaseState;
  menu: ResolvedMenuVersion;
};

type MealPlanCookAssistantSnapshot = {
  summary: MealPlanCookAssistantSummary;
  prepTasks: MealPlanCookAssistantTask[];
  cookTimeline: MealPlanCookAssistantTimelineStep[];
  serveTasks: MealPlanCookAssistantTask[];
};

type DiningMemoryShareMenuItemSnapshot = {
  title: string;
  coverUrl: string | null;
  cookName: string | null;
};

type DiningMemoryShareParticipantSnapshot = {
  displayName: string;
  avatarUrl: string | null;
  role: "ORGANIZER" | "PARTICIPANT" | "GUEST";
};

type RandomRecipeRow = Prisma.RecipeGetPayload<{
  include: {
    currentVersion: {
      include: {
        versionTags: true;
      };
    };
  };
}>;

type RandomRecipeCandidate = {
  recipeId: UUID;
  recipeVersionId: UUID;
  title: string;
  coverUrl: string | null;
  content: RecipeContentSnapshot;
  mealMoments: MealSlot[];
  slotTypes: RecipeSlotType[];
  flavorTags: string[];
  mainProteinType: RecipeProteinType | null;
  primaryIngredientIds: UUID[];
};

type RandomRecipeSlotSeed = {
  slotId: string;
  slotType: RecipeSlotType;
  slotIndex: number;
};

type RandomInventoryFacts = {
  fridgeIngredientIds: Set<UUID>;
};

type RandomTagSnapshot = {
  mealMoments: MealSlot[];
  slotTypes: RecipeSlotType[];
  flavorTags: string[];
  mainProteinType: RecipeProteinType | null;
  primaryIngredientIds: UUID[];
};

const activeMemberStatuses = ["ACTIVE", "RESTRICTED"] as const;
const groupManagerRoles = ["OWNER", "ADMIN"] as const;
const recipeVersionTagSourcePriority = ["USER", "OPS", "AI", "AUTO"] as const;

function toIsoDate(value: Date) {
  return value.toISOString();
}

function hashText(value: string | number) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function createShareToken() {
  return randomBytes(24).toString("base64url");
}

function buildMemorySharePath(shareToken: string) {
  return `/pages_share/memory/index?token=${encodeURIComponent(shareToken)}`;
}

function parseDateOnly(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException("计划日期格式错误");
  return parsed;
}

function parseDateTime(value: string, message = "时间格式错误") {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(message);
  return parsed;
}

function normalizeMealSlot(value: string): MealSlot {
  if (
    value !== "BREAKFAST" &&
    value !== "LUNCH" &&
    value !== "AFTERNOON_TEA" &&
    value !== "DINNER" &&
    value !== "LATE_NIGHT"
  ) {
    throw new BadRequestException("餐次参数错误");
  }
  return value;
}

function normalizeCoreMealSlot(value: string): "BREAKFAST" | "LUNCH" | "DINNER" {
  if (value !== "BREAKFAST" && value !== "LUNCH" && value !== "DINNER") {
    throw new BadRequestException("随机餐次参数错误");
  }
  return value;
}

function normalizeEventStatus(value: string) {
  if (value !== "ACCEPTED" && value !== "DECLINED") {
    throw new BadRequestException("参与状态参数错误");
  }
  return value;
}

function normalizeCookAction(value: string) {
  if (value !== "CLAIM" && value !== "RELEASE") {
    throw new BadRequestException("掌勺操作参数错误");
  }
  return value;
}

function normalizeRecipeSlotType(value: string): RecipeSlotType {
  if (
    value !== "MEAT" &&
    value !== "VEGETABLE" &&
    value !== "SOUP" &&
    value !== "STAPLE" &&
    value !== "BREAKFAST_STAPLE" &&
    value !== "BREAKFAST_PROTEIN" &&
    value !== "BREAKFAST_SIDE"
  ) {
    throw new BadRequestException("菜位类型参数错误");
  }
  return value;
}

function normalizeNullableRecipeSlotType(value: string | null): RecipeSlotType | null {
  if (value == null) return null;
  return normalizeRecipeSlotType(value);
}

function normalizePurchaseState(value: string): MealPlanDishPurchaseState {
  if (value !== "READY" && value !== "PENDING") {
    throw new BadRequestException("采购状态参数错误");
  }
  return value;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toPositiveInt(value: number | string | undefined, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeNameKey(value: string) {
  return value.trim().toLowerCase();
}

function tagSourceRank(source: string) {
  const index = recipeVersionTagSourcePriority.indexOf(source as (typeof recipeVersionTagSourcePriority)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function pickPreferredTagValues(
  tags: Array<{ source: string; tagValue: string; sortOrder: number | null; id: number }>,
  multi: boolean
) {
  if (!tags.length) return [] as string[];
  const ranked = [...tags].sort((left, right) => {
    const sourceDiff = tagSourceRank(left.source) - tagSourceRank(right.source);
    if (sourceDiff !== 0) return sourceDiff;
    const sortDiff = (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER);
    if (sortDiff !== 0) return sortDiff;
    return left.id - right.id;
  });
  const preferredSource = ranked[0]?.source;
  const scoped = ranked.filter(item => item.source === preferredSource);
  if (!multi) {
    return scoped[0] ? [scoped[0].tagValue] : [];
  }
  return Array.from(new Set(scoped.map(item => item.tagValue)));
}

function mapDishRolesToLegacySlotTypes(
  roles: string[],
  mealMoments: MealSlot[],
  content: RecipeContentSnapshot,
  mainProteinType: RecipeProteinType | null
): RecipeSlotType[] {
  const dishRoles = new Set(roles);
  const onlyBreakfast = mealMoments.length > 0 && mealMoments.every(item => item === "BREAKFAST");
  if (!onlyBreakfast) {
    const slotTypes: RecipeSlotType[] = [];
    if (dishRoles.has("MAIN")) slotTypes.push("MEAT");
    if (dishRoles.has("VEGETABLE")) slotTypes.push("VEGETABLE");
    if (dishRoles.has("SOUP")) slotTypes.push("SOUP");
    if (dishRoles.has("STAPLE")) slotTypes.push("STAPLE");
    return slotTypes;
  }

  if (dishRoles.has("STAPLE")) return ["BREAKFAST_STAPLE"];
  if (mainProteinType && mainProteinType !== "NONE") return ["BREAKFAST_PROTEIN"];
  const text = `${content.name} ${content.ingredients.map(item => item.ingredientName).join(" ")}`;
  if (/(鸡蛋|牛奶|酸奶|豆浆|燕麦)/.test(text)) return ["BREAKFAST_PROTEIN"];
  return ["BREAKFAST_SIDE"];
}

function buildMealPollTitle(planDate: string, mealSlot: MealSlot) {
  const label =
    mealSlot === "BREAKFAST"
      ? "早餐"
      : mealSlot === "LUNCH"
        ? "午餐"
        : mealSlot === "AFTERNOON_TEA"
          ? "下午茶"
          : mealSlot === "DINNER"
            ? "晚餐"
            : "夜宵";
  return `${planDate} ${label}吃什么`;
}

function buildMenuTitle(titles: string[]) {
  if (!titles.length) return "本餐菜单";
  if (titles.length === 1) return titles[0];
  return `${titles[0]}等${titles.length}道菜`;
}

function buildFallbackScheduledAt(planDate: string, mealSlot: MealSlot) {
  const time =
    mealSlot === "BREAKFAST"
      ? "08:00:00"
      : mealSlot === "LUNCH"
        ? "12:00:00"
        : mealSlot === "AFTERNOON_TEA"
          ? "15:30:00"
          : mealSlot === "DINNER"
            ? "18:30:00"
            : "21:30:00";
  return new Date(`${planDate}T${time}+08:00`);
}

function buildMenuSnapshot(menuItems: ResolvedMenuVersion[]): RecipeContentSnapshot {
  const first = menuItems[0];
  if (!first) throw new BadRequestException("最终菜单不能为空");
  if (menuItems.length === 1) return first.content;

  const estimatedCalories = menuItems.reduce((sum, item) => sum + (item.content.estimatedCalories ?? 0), 0);
  return {
    name: buildMenuTitle(menuItems.map(item => item.content.name)),
    story: null,
    baseServings: first.content.baseServings,
    difficulty: first.content.difficulty,
    duration: first.content.duration,
    estimatedCalories: estimatedCalories > 0 ? estimatedCalories : null,
    tips: null,
    ingredients: menuItems.flatMap(item => item.content.ingredients),
    steps: []
  };
}

function cookAssistantRecordKey(planItemId: UUID) {
  return `meal-plan-cook-assistant:${planItemId}`;
}

function buildMealPlanMenuDigest(plan: MealPlanRow) {
  const value = plan.dishes
    .map(item => [item.recipeVersionId, item.slotType ?? "", item.purchaseState, item.sortOrder].join(":"))
    .join("|");
  return hashText(value);
}

function recipeDurationMinutes(value: RecipeDuration | null) {
  if (value === "WITHIN_15") return 15;
  if (value === "BETWEEN_15_30") return 30;
  if (value === "BETWEEN_30_60") return 50;
  if (value === "OVER_60") return 75;
  return null;
}

function formatDurationText(minutes: number | null) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `约${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `约${hours}小时${remaining}分钟` : `约${hours}小时`;
}

function formatClockText(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(value);
}

function containsCookKeyword(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function buildDishCookText(menu: ResolvedMenuVersion) {
  return menu.content.steps
    .map(item => item.text?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

function resolveCookStage(menu: ResolvedMenuVersion, slotType: RecipeSlotType | null) {
  const text = `${menu.title} ${buildDishCookText(menu)}`;
  const minutes = recipeDurationMinutes(menu.content.duration);
  if (slotType === "SOUP" || containsCookKeyword(text, /(炖|焖|煮|卤|蒸|烤|熬)/) || (minutes != null && minutes >= 45)) {
    return "EARLY" as const;
  }
  if (
    slotType === "VEGETABLE" ||
    containsCookKeyword(text, /(凉拌|快炒|小炒|焯|装盘|生拌|快手)/) ||
    (minutes != null && minutes <= 15)
  ) {
    return "LATE" as const;
  }
  return "MID" as const;
}

function buildCookAssistantSnapshot(plan: MealPlanRow, menuItems: PlanMenuItemInput[]): MealPlanCookAssistantSnapshot {
  const dishTitles = menuItems.map(item => item.menu.title);
  const prepTasks: MealPlanCookAssistantTask[] = [];
  const cookTimeline: MealPlanCookAssistantTimelineStep[] = [];
  const serveTasks: MealPlanCookAssistantTask[] = [];
  const notes: string[] = [];
  const totalDurations = menuItems
    .map(item => recipeDurationMinutes(item.menu.content.duration))
    .filter((item): item is NonNullable<ReturnType<typeof recipeDurationMinutes>> => item != null);
  const unresolvedInfoCount = menuItems.filter(item => !item.menu.content.steps.length || item.menu.content.duration == null).length;
  const pendingCount = menuItems.filter(item => item.purchaseState === "PENDING").length;

  if (dishTitles.length) {
    prepTasks.push({
      title: "统一备菜",
      detail: `先把${dishTitles.join("、")}涉及的主要食材洗净、切配，调料、小碗和装盘器具提前摆好。`,
      dishTitles
    });
  }

  const marinadeTitles = menuItems
    .filter(item => containsCookKeyword(buildDishCookText(item.menu), /(腌|腌制|入味)/))
    .map(item => item.menu.title);
  if (marinadeTitles.length) {
    prepTasks.push({
      title: "提前腌制",
      detail: `把${marinadeTitles.join("、")}需要提前入味的步骤先做掉，后续开火时会顺很多。`,
      dishTitles: marinadeTitles
    });
  }

  const soakTitles = menuItems
    .filter(item => {
      const ingredientText = item.menu.content.ingredients.map(ingredient => ingredient.ingredientName).join(" ");
      const text = `${ingredientText} ${buildDishCookText(item.menu)}`;
      return containsCookKeyword(text, /(泡发|浸泡|木耳|银耳|香菇|腐竹|粉丝|海带)/);
    })
    .map(item => item.menu.title);
  if (soakTitles.length) {
    prepTasks.push({
      title: "提前泡发或浸泡",
      detail: `如果${soakTitles.join("、")}用到干货或需要浸泡的原料，先把这一步做掉，避免开火后卡住。`,
      dishTitles: soakTitles
    });
  }

  const grouped = {
    EARLY: menuItems.filter(item => resolveCookStage(item.menu, item.slotType) === "EARLY"),
    MID: menuItems.filter(item => resolveCookStage(item.menu, item.slotType) === "MID"),
    LATE: menuItems.filter(item => resolveCookStage(item.menu, item.slotType) === "LATE")
  };

  let order = 1;
  if (grouped.EARLY.length) {
    cookTimeline.push({
      order: order++,
      title: "先开长耗时菜",
      detail: `优先处理${grouped.EARLY.map(item => item.menu.title).join("、")}，让它们先进入炖、煮、蒸或焖的阶段，后面可以并行做其他菜。`,
      dishTitles: grouped.EARLY.map(item => item.menu.title),
      parallelKey: "LONG_COOK"
    });
  }
  if (grouped.MID.length) {
    cookTimeline.push({
      order: order++,
      title: grouped.EARLY.length ? "利用空档处理中段主菜" : "先处理中段主菜",
      detail: `按${grouped.MID.map(item => item.menu.title).join("、")}的顺序完成主烹调，尽量把占灶时间长的步骤集中完成。`,
      dishTitles: grouped.MID.map(item => item.menu.title),
      parallelKey: grouped.EARLY.length ? "LONG_COOK" : null
    });
  }
  if (grouped.LATE.length) {
    cookTimeline.push({
      order: order++,
      title: "最后做快手菜和临出锅菜",
      detail: `把${grouped.LATE.map(item => item.menu.title).join("、")}放到后段处理，尽量让蔬菜和快炒菜接近上桌时再完成。`,
      dishTitles: grouped.LATE.map(item => item.menu.title),
      parallelKey: null
    });
  }

  serveTasks.push({
    title: "出锅前统一收尾",
    detail: "上桌前把咸淡、汤汁、熟度和装盘顺序再过一遍，避免最后一刻手忙脚乱。",
    dishTitles
  });
  serveTasks.push({
    title: "按先热后快的顺序上桌",
    detail: "先端汤或炖菜，再上主菜和快炒菜，快手菜尽量最后离火，口感会更稳。",
    dishTitles
  });

  if (pendingCount > 0) {
    notes.push(`当前还有${pendingCount}道菜标记为待采购，开始前先确认缺的食材已经补齐。`);
  }
  if (unresolvedInfoCount > 0) {
    notes.push(`有${unresolvedInfoCount}道菜的步骤或时长信息不完整，本次流程按已有字段做了保守估算。`);
  }
  if (menuItems.length >= 4) {
    notes.push("这顿菜比较多，建议先清出一块专用备菜区，再按长耗时菜 -> 主菜 -> 快手菜推进。");
  }

  const longestDuration = totalDurations.length ? Math.max(...totalDurations) : null;
  const estimatedMinutes =
    longestDuration == null ? null : longestDuration + Math.max(0, menuItems.length - 1) * 12 + prepTasks.length * 6;
  const planDate = plan.planDate.toISOString().slice(0, 10);
  const suggestedStartTime =
    estimatedMinutes == null ? null : formatClockText(new Date(buildFallbackScheduledAt(planDate, plan.mealSlot).getTime() - estimatedMinutes * 60 * 1000));

  return {
    summary: {
      dishCount: menuItems.length,
      prepTaskCount: prepTasks.length,
      timelineStepCount: cookTimeline.length,
      totalDurationText: formatDurationText(estimatedMinutes),
      suggestedStartTime,
      notes
    },
    prepTasks,
    cookTimeline,
    serveTasks
  };
}

function isActiveMemberStatus(status: string) {
  return activeMemberStatuses.includes(status as (typeof activeMemberStatuses)[number]);
}

@Injectable()
export class MealService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService,
    @Inject(MedalService) private readonly medalService: MedalService
  ) {}

  async listMealPlans(userId: UUID, page: number, pageSize: number, from?: string, to?: string): Promise<PageResult<MealPlanSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.MealPlanItemWhereInput = {
      userId,
      ...(from || to
        ? {
            planDate: {
              ...(from ? { gte: parseDateOnly(from) } : {}),
              ...(to ? { lte: parseDateOnly(to) } : {})
            }
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.mealPlanItem.findMany({
        where,
        include: mealPlanInclude,
        orderBy: [{ planDate: "asc" }, { mealSlot: "asc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.mealPlanItem.count({ where })
    ]);

    return {
      items: items.map(item => this.toMealPlanSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async listMealPolls(
    userId: UUID,
    diningGroupId: UUID,
    status?: string,
    planDate?: string,
    mealSlot?: string,
    limit?: number
  ): Promise<MealPollSummary[]> {
    await this.requireActiveMembership(this.prisma, userId, diningGroupId);
    const normalizedLimit = Math.min(toPositiveInt(limit, 20), 20);
    const where: Prisma.MealPollWhereInput = {
      diningGroupId,
      ...(status ? { status: status as "OPEN" | "CLOSED" | "CONFIRMED" | "COMPLETED" } : {}),
      ...(planDate ? { planDate: parseDateOnly(planDate) } : {}),
      ...(mealSlot ? { mealSlot: normalizeMealSlot(mealSlot) } : {})
    };
    const polls = await this.prisma.mealPoll.findMany({
      where,
      include: {
        _count: {
          select: {
            candidates: true,
            responses: true
          }
        }
      },
      orderBy: [{ planDate: "desc" }, { createdAt: "desc" }],
      take: normalizedLimit
    });
    return polls.map(item => this.toMealPollSummary(item));
  }

  async generateRandomMenu(
    userId: UUID,
    mealSlot: string,
    peopleCount: number,
    fridgePreferred: boolean,
    slotPlan?: RandomSlotPlan | null
  ): Promise<RandomMenuResponse> {
    const normalizedMealSlot = normalizeCoreMealSlot(mealSlot);
    const normalizedPeopleCount = this.normalizePeopleCount(peopleCount);
    const normalizedSlotPlan = this.normalizeRandomSlotPlan(normalizedMealSlot, normalizedPeopleCount, slotPlan ?? null);
    const [candidates, inventoryFacts] = await Promise.all([
      this.loadRandomRecipeCandidates(userId),
      this.loadRandomInventoryFacts(userId)
    ]);

    const seeds = this.buildRandomSlotSeeds(normalizedMealSlot, normalizedSlotPlan);
    const selected = new Set<UUID>();
    const items: RandomMenuItem[] = [];
    const missingSlotTypes: RecipeSlotType[] = [];

    for (const seed of seeds) {
      const candidate = this.pickRandomRecipeCandidate({
        mealSlot: normalizedMealSlot,
        slotType: seed.slotType,
        candidates,
        excludedVersionIds: selected,
        currentItems: items.map(item => ({
          slotId: item.slotId,
          slotType: item.slotType,
          recipeId: item.recipeId,
          recipeVersionId: item.recipeVersionId
        })),
        inventoryFacts,
        fridgePreferred,
        replaceConstraints: []
      });
      if (!candidate) {
        missingSlotTypes.push(seed.slotType);
        continue;
      }
      selected.add(candidate.recipeVersionId);
      items.push(this.toRandomMenuItem(seed, candidate, inventoryFacts));
    }

    return {
      mealSlot: normalizedMealSlot,
      peopleCount: normalizedPeopleCount,
      fridgePreferred,
      slotPlan: normalizedSlotPlan,
      items,
      warnings: this.buildRandomMenuWarnings(seeds.length, items.length, missingSlotTypes),
      generatedAt: toIsoDate(new Date())
    };
  }

  async replaceRandomMenuSlot(
    userId: UUID,
    mealSlot: string,
    peopleCount: number,
    fridgePreferred: boolean,
    slotPlan: RandomSlotPlan,
    currentItems: ReplaceRandomMenuCurrentItem[],
    targetSlotId: string,
    targetSlotType: string,
    replaceConstraints: RandomReplaceConstraint[],
    rejectedRecipeVersionIds: UUID[],
    requestSeq: number
  ): Promise<ReplaceRandomMenuSlotResponse> {
    const normalizedMealSlot = normalizeCoreMealSlot(mealSlot);
    const normalizedPeopleCount = this.normalizePeopleCount(peopleCount);
    const normalizedSlotPlan = this.normalizeRandomSlotPlan(normalizedMealSlot, normalizedPeopleCount, slotPlan);
    const normalizedTargetSlotType = normalizeRecipeSlotType(targetSlotType);
    const slotSeed = this.buildRandomSlotSeeds(normalizedMealSlot, normalizedSlotPlan).find(
      item => item.slotId === targetSlotId && item.slotType === normalizedTargetSlotType
    );
    if (!slotSeed) {
      throw new BadRequestException("目标菜位不存在");
    }
    const excludedVersionIds = new Set(
      rejectedRecipeVersionIds
        .filter((item): item is UUID => Number.isInteger(item) && item > 0)
    );
    const normalizedCurrentItems = currentItems.map(item => ({
      slotId: item.slotId,
      slotType: normalizeRecipeSlotType(item.slotType),
      recipeId: item.recipeId,
      recipeVersionId: item.recipeVersionId
    }));
    const currentTarget = normalizedCurrentItems.find(item => item.slotId === targetSlotId);
    if (!currentTarget) {
      throw new BadRequestException("目标菜位不存在");
    }
    excludedVersionIds.add(currentTarget.recipeVersionId);

    const [candidates, inventoryFacts] = await Promise.all([
      this.loadRandomRecipeCandidates(userId),
      this.loadRandomInventoryFacts(userId)
    ]);

    const candidate = this.pickRandomRecipeCandidate({
      mealSlot: normalizedMealSlot,
      slotType: normalizedTargetSlotType,
      candidates,
      excludedVersionIds,
      currentItems: normalizedCurrentItems.filter(item => item.slotId !== targetSlotId),
      inventoryFacts,
      fridgePreferred,
      replaceConstraints
    });

    if (!candidate) {
      return {
        requestSeq,
        slot: null,
        warning: {
          code: "INSUFFICIENT_CANDIDATES",
          message: "当前条件下能换的菜不多，请放宽限制后重试",
          slotTypes: [normalizedTargetSlotType]
        }
      };
    }

    return {
      requestSeq,
      slot: this.toRandomMenuItem(slotSeed, candidate, inventoryFacts),
      warning: null
    };
  }

  async previewRandomMenuGap(
    userId: UUID,
    mealSlot: string,
    peopleCount: number,
    items: Array<{
      slotId: string;
      slotType: string;
      recipeId: UUID;
      recipeVersionId: UUID;
    }>,
    inventoryDecisions: RandomGapInventoryDecision[]
  ): Promise<CheckRandomMenuGapResponse> {
    normalizeCoreMealSlot(mealSlot);
    this.normalizePeopleCount(peopleCount);
    if (!items.length) {
      throw new BadRequestException("当前菜单不能为空");
    }

    const [recipes, inventoryFacts] = await Promise.all([
      this.prisma.recipe.findMany({
        where: {
          id: { in: items.map(item => item.recipeId) },
          ownerId: userId,
          status: "ACTIVE"
        },
        include: {
          currentVersion: true
        }
      }),
      this.loadRandomInventoryFacts(userId)
    ]);
    const recipeMap = new Map(recipes.map(item => [item.id, item]));
    const decisionMap = new Map<string, "HAS" | "MISSING">(
      inventoryDecisions.map(item => [this.buildGapDecisionKey(item.slotId, item.ingredientId ?? null, item.ingredientName), item.decision])
    );

    const gapItems: RandomGapItem[] = items.map(item => {
      const recipe = recipeMap.get(item.recipeId);
      if (!recipe || recipe.currentVersionId !== item.recipeVersionId) {
        throw new NotFoundException("菜谱不存在");
      }
      const slotType = normalizeRecipeSlotType(item.slotType);
      const content = this.getEffectiveRecipeContent(recipe);
      const totalIngredientCount = content.ingredients.length;
      const gapIngredients = content.ingredients
        .map(ingredient => this.buildRandomGapIngredient(item.slotId, ingredient, inventoryFacts, decisionMap))
        .filter((ingredient): ingredient is RandomGapIngredient => ingredient !== null);
      const unknownCount = gapIngredients.filter(ingredient => ingredient.inventoryStatus === "UNKNOWN").length;
      const missingCount = gapIngredients.filter(ingredient => ingredient.inventoryStatus === "MISSING").length;
      const partialCount = gapIngredients.filter(ingredient => ingredient.inventoryStatus === "PARTIAL").length;
      const status =
        unknownCount > 0
          ? "UNKNOWN"
          : gapIngredients.length === 0
            ? "OK"
            : gapIngredients.length < totalIngredientCount
              ? "PARTIAL"
              : missingCount > 0 && partialCount === 0
              ? "MISSING"
              : "PARTIAL";

      return {
        slotId: item.slotId,
        slotType,
        recipeId: recipe.id,
        recipeVersionId: recipe.currentVersionId,
        recipeName: recipe.title,
        status,
        missingIngredients: gapIngredients,
        actions: {
          canKeep: true,
          canReplace: true,
          canRemove: true,
          canAddToShopping: gapIngredients.some(ingredient => ingredient.inventoryStatus !== "UNKNOWN")
        },
        unresolvedUnknownCount: unknownCount
      };
    });

    const summary: RandomGapSummary = {
      okCount: gapItems.filter(item => item.status === "OK").length,
      partialCount: gapItems.filter(item => item.status === "PARTIAL").length,
      missingCount: gapItems.filter(item => item.status === "MISSING").length,
      unknownCount: gapItems.filter(item => item.status === "UNKNOWN").length
    };

    return {
      items: gapItems,
      summary,
      canCreatePlan: gapItems.every(item => item.missingIngredients.length === 0)
    };
  }

  async createMealPoll(
    userId: UUID,
    operationId: OperationId,
    diningGroupId: UUID,
    planDate: string,
    mealSlot: string,
    deadlineAt: string,
    choiceLimit: number,
    note: string | null,
    candidateRecipeVersionIds: UUID[]
  ): Promise<MealPollDetail> {
    const normalizedSlot = normalizeMealSlot(mealSlot);
    const normalizedPlanDate = parseDateOnly(planDate);
    const normalizedDeadline = parseDateTime(deadlineAt, "征集截止时间格式错误");
    const normalizedNote = normalizeOptionalText(note);
    const uniqueVersionIds = Array.from(new Set(candidateRecipeVersionIds));
    const requestHash = JSON.stringify({
      diningGroupId,
      planDate,
      mealSlot: normalizedSlot,
      deadlineAt: normalizedDeadline.toISOString(),
      choiceLimit,
      note: normalizedNote,
      candidateRecipeVersionIds: uniqueVersionIds
    });

    try {
      return await this.prisma.$transaction(async tx => {
        const membership = await this.requireManagerMembership(tx, userId, diningGroupId);
        if (normalizedDeadline <= new Date()) throw new BadRequestException("征集截止时间必须晚于当前时间");

        const repeated = await getIdempotentResult<MealPollDetail>(tx, operationId, "meal-poll:create", userId, diningGroupId, requestHash);
        if (repeated) return repeated;
        await startIdempotentOperation(tx, operationId, "meal-poll:create", userId, diningGroupId, requestHash);

        const existing = await tx.mealPoll.findUnique({
          where: {
            diningGroupId_planDate_mealSlot: {
              diningGroupId,
              planDate: normalizedPlanDate,
              mealSlot: normalizedSlot
            }
          }
        });
        if (existing) {
          throw new ConflictException("该饭搭子当前餐次已存在征集");
        }

        const candidateVersions = await this.resolveMenuVersions(tx, uniqueVersionIds);
        const poll = await tx.mealPoll.create({
          data: {
            diningGroupId,
            createdByUserId: membership.userId,
            planDate: normalizedPlanDate,
            mealSlot: normalizedSlot,
            deadlineAt: normalizedDeadline,
            choiceLimit,
            note: normalizedNote,
            candidates: {
              create: candidateVersions.map(item => ({
                recipeVersionId: item.recipeVersionId,
                title: item.title,
                sourceType: "RECIPE",
                status: "ACTIVE"
              }))
            }
          },
          select: { id: true }
        });

        await this.writeActivity(tx, {
          diningGroupId,
          kind: "POLL_OPENED",
          state: "PENDING",
          actorUserId: userId,
          title: buildMealPollTitle(planDate, normalizedSlot),
          detail: normalizedNote,
          pollId: poll.id,
          dedupeKey: `poll-opened:${poll.id}`
        });

        const result = await this.getMealPoll(userId, poll.id, tx);
        await completeIdempotentOperation(tx, operationId, "meal-poll:create", userId, diningGroupId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("该饭搭子当前餐次已存在征集");
      }
      throw error;
    }
  }

  async getMealPoll(userId: UUID, pollId: UUID, db: MealDb = this.prisma): Promise<MealPollDetail> {
    const poll = await db.mealPoll.findUnique({
      where: { id: pollId },
      include: {
        createdBy: { select: { uid: true, nickname: true } },
        candidates: {
          include: {
            suggestedBy: { select: { uid: true } },
            recipeVersion: {
              include: {
                currentRecipes: {
                  select: { id: true, coverImageUrl: true },
                  take: 1
                }
              }
            },
            _count: {
              select: { responseItems: true }
            }
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
        },
        responses: {
          include: {
            user: { select: { uid: true } },
            items: {
              include: {
                candidate: { select: { id: true, sourceType: true } }
              }
            }
          },
          orderBy: { respondedAt: "desc" }
        },
        _count: {
          select: {
            candidates: true,
            responses: true
          }
        }
      }
    });
    if (!poll) throw new NotFoundException("征集不存在");
    await this.requireActiveMembership(db, userId, poll.diningGroupId);
    return this.toMealPollDetail(poll);
  }

  async voteMealPoll(
    userId: UUID,
    pollId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    selectedCandidateIds: UUID[],
    suggestionTitle: string | null,
    note: string | null
  ): Promise<MealPollDetail> {
    const uniqueCandidateIds = Array.from(new Set(selectedCandidateIds));
    const normalizedSuggestion = normalizeOptionalText(suggestionTitle);
    const normalizedNote = normalizeOptionalText(note);
    const requestHash = JSON.stringify({
      pollId,
      expectedVersion,
      selectedCandidateIds: uniqueCandidateIds,
      suggestionTitle: normalizedSuggestion,
      note: normalizedNote
    });

    return this.prisma.$transaction(async tx => {
      const poll = await tx.mealPoll.findUnique({
        where: { id: pollId }
      });
      if (!poll) throw new NotFoundException("征集不存在");

      const membership = await this.requireActiveMembership(tx, userId, poll.diningGroupId);
      if (poll.status !== "OPEN") throw new ConflictException("当前征集已关闭");
      if (poll.deadlineAt <= new Date()) throw new ConflictException("当前征集已截止");
      if (poll.version !== expectedVersion) throw new ConflictException("征集已被更新，请刷新后重试");
      if (uniqueCandidateIds.length > poll.choiceLimit) throw new BadRequestException("超过当前征集允许选择的菜数");
      if (!uniqueCandidateIds.length && !normalizedSuggestion) {
        throw new BadRequestException("至少选择一道菜或补充一道建议菜");
      }

      const repeated = await getIdempotentResult<MealPollDetail>(tx, operationId, "meal-poll:vote", userId, poll.diningGroupId, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "meal-poll:vote", userId, poll.diningGroupId, requestHash);

      const candidates = await tx.mealPollCandidate.findMany({
        where: {
          pollId,
          id: { in: uniqueCandidateIds },
          status: "ACTIVE"
        }
      });
      if (candidates.length !== uniqueCandidateIds.length) {
        throw new BadRequestException("存在无效候选菜");
      }

      const locked = await tx.mealPoll.updateMany({
        where: {
          id: poll.id,
          version: expectedVersion,
          status: "OPEN"
        },
        data: {
          version: { increment: 1 }
        }
      });
      if (locked.count !== 1) throw new ConflictException("征集已被更新，请刷新后重试");

      const existing = await tx.mealPollResponse.findUnique({
        where: {
          pollId_userId: {
            pollId,
            userId
          }
        },
        include: {
          items: {
            include: {
              candidate: true
            }
          }
        }
      });

      if (existing) {
        const removableSuggestionIds = existing.items
          .filter(item => item.candidate.sourceType === "SUGGESTION" && item.candidate.suggestedByUserId === userId)
          .map(item => item.candidateId);
        await tx.mealPollResponseItem.deleteMany({
          where: { responseId: existing.id }
        });
        if (removableSuggestionIds.length) {
          await tx.mealPollCandidate.deleteMany({
            where: {
              id: { in: removableSuggestionIds },
              pollId,
              sourceType: "SUGGESTION",
              suggestedByUserId: userId
            }
          });
        }
      }

      const response = existing
        ? await tx.mealPollResponse.update({
            where: { id: existing.id },
            data: {
              note: normalizedNote,
              respondedAt: new Date()
            }
          })
        : await tx.mealPollResponse.create({
            data: {
              pollId,
              userId,
              note: normalizedNote,
              respondedAt: new Date()
            }
          });

      let suggestionCandidateId: UUID | null = null;
      if (normalizedSuggestion) {
        const suggestionCandidate = await tx.mealPollCandidate.create({
          data: {
            pollId,
            recipeVersionId: null,
            title: normalizedSuggestion,
            sourceType: "SUGGESTION",
            status: "PENDING",
            suggestedByUserId: userId
          }
        });
        suggestionCandidateId = suggestionCandidate.id;
      }

      await tx.mealPollResponseItem.createMany({
        data: [...uniqueCandidateIds, ...(suggestionCandidateId ? [suggestionCandidateId] : [])].map(candidateId => ({
          responseId: response.id,
          candidateId
        }))
      });

      await this.writeActivity(tx, {
        diningGroupId: poll.diningGroupId,
        kind: "POLL_VOTED",
        state: "DONE",
        actorUserId: membership.userId,
        title: `${membership.userId === poll.createdByUserId ? "主理人" : "成员"}选择了${uniqueCandidateIds.length}道菜`,
        detail: normalizedNote,
        pollId: poll.id,
        dedupeKey: `poll-voted:${poll.id}:${membership.userId}`
      });

      if (normalizedSuggestion) {
        await this.writeActivity(tx, {
          diningGroupId: poll.diningGroupId,
          kind: "POLL_SUGGESTED",
          state: "DONE",
          actorUserId: membership.userId,
          title: "补充了一道建议菜",
          detail: normalizedSuggestion,
          pollId: poll.id,
          dedupeKey: `poll-suggested:${poll.id}:${membership.userId}`
        });
      }

      if (normalizedNote) {
        await this.writeActivity(tx, {
          diningGroupId: poll.diningGroupId,
          kind: "POLL_NOTED",
          state: "DONE",
          actorUserId: membership.userId,
          title: "留下了这次点菜备注",
          detail: normalizedNote,
          pollId: poll.id,
          dedupeKey: `poll-noted:${poll.id}:${membership.userId}`
        });
      }

      const result = await this.getMealPoll(userId, poll.id, tx);
      await completeIdempotentOperation(tx, operationId, "meal-poll:vote", userId, poll.diningGroupId, requestHash, result);
      return result;
    });
  }

  async confirmMealPoll(
    userId: UUID,
    pollId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    finalRecipeVersionIds: UUID[],
    scheduledAt: string | null,
    location: string | null
  ): Promise<MealPollDetail> {
    const uniqueVersionIds = Array.from(new Set(finalRecipeVersionIds));
    const normalizedLocation = normalizeOptionalText(location);
    const requestHash = JSON.stringify({
      pollId,
      expectedVersion,
      finalRecipeVersionIds: uniqueVersionIds,
      scheduledAt,
      location: normalizedLocation
    });

    return this.prisma.$transaction(async tx => {
      const poll = await tx.mealPoll.findUnique({
        where: { id: pollId }
      });
      if (!poll) throw new NotFoundException("征集不存在");

      await this.requireManagerMembership(tx, userId, poll.diningGroupId);
      if (poll.status !== "OPEN") throw new ConflictException("当前征集不可确认");
      if (poll.version !== expectedVersion) throw new ConflictException("征集已被更新，请刷新后重试");

      const repeated = await getIdempotentResult<MealPollDetail>(tx, operationId, "meal-poll:confirm", userId, poll.diningGroupId, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "meal-poll:confirm", userId, poll.diningGroupId, requestHash);

      const closing = await tx.mealPoll.updateMany({
        where: {
          id: poll.id,
          version: expectedVersion,
          status: "OPEN"
        },
        data: {
          status: "CLOSED",
          version: { increment: 1 }
        }
      });
      if (closing.count !== 1) throw new ConflictException("征集已被更新，请刷新后重试");

      const finalMenus = await this.resolveConfirmedPollMenus(tx, poll.id, uniqueVersionIds);
      const menuSnapshot = buildMenuSnapshot(finalMenus);
      const plan = await this.upsertPollMealPlan(tx, poll, finalMenus, menuSnapshot);
      const event = await this.upsertPollDiningEvent(tx, poll, plan, finalMenus, menuSnapshot, scheduledAt, normalizedLocation);
      await this.syncPollParticipants(tx, poll, event.id);

      await tx.mealPoll.update({
        where: { id: poll.id },
        data: {
          status: "CONFIRMED",
          confirmedPlanItemId: plan.id,
          confirmedDiningEventId: event.id
        }
      });

      await this.writeActivity(tx, {
        diningGroupId: poll.diningGroupId,
        kind: "POLL_OPENED",
        state: "DONE",
        actorUserId: poll.createdByUserId,
        title: buildMealPollTitle(plan.planDate.toISOString().slice(0, 10), plan.mealSlot),
        detail: poll.note,
        pollId: poll.id,
        planItemId: plan.id,
        diningEventId: event.id,
        dedupeKey: `poll-opened:${poll.id}`
      });

      await this.writeActivity(tx, {
        diningGroupId: poll.diningGroupId,
        kind: "MENU_CONFIRMED",
        state: "DONE",
        actorUserId: userId,
        title: "确认了这顿饭的最终菜单",
        detail: buildMenuTitle(finalMenus.map(item => item.title)),
        pollId: poll.id,
        planItemId: plan.id,
        diningEventId: event.id,
        dedupeKey: `menu-confirmed:${poll.id}`
      });

      const result = await this.getMealPoll(userId, poll.id, tx);
      await completeIdempotentOperation(tx, operationId, "meal-poll:confirm", userId, poll.diningGroupId, requestHash, result);
      return result;
    });
  }

  async createMealPlan(
    userId: UUID,
    operationId: OperationId,
    planDate: string,
    mealSlot: string,
    menuItems: Array<{
      slotType: string | null;
      sortOrder: number;
      recipeId: UUID;
      recipeVersionId: UUID;
      purchaseState: string;
    }>,
    expectedVersion?: number | null,
    note?: string | null
  ) {
    return this.prisma.$transaction(async tx => {
      const slot = normalizeMealSlot(mealSlot);
      const normalizedNote = normalizeOptionalText(note);
      const normalizedPlanDate = parseDateOnly(planDate);
      const normalizedItems = await this.resolvePlanMenuItems(tx, userId, menuItems);
      const requestHash = JSON.stringify({
        planDate,
        mealSlot: slot,
        expectedVersion: expectedVersion ?? null,
        menuItems: normalizedItems.map(item => ({
          slotType: item.slotType,
          sortOrder: item.sortOrder,
          recipeId: item.menu.recipeId,
          recipeVersionId: item.menu.recipeVersionId,
          purchaseState: item.purchaseState
        })),
        note: normalizedNote
      });
      const repeated = await getIdempotentResult<MealPlanSummary>(tx, operationId, "meal-plan:create", userId, null, requestHash);
      if (repeated) return repeated;

      await startIdempotentOperation(tx, operationId, "meal-plan:create", userId, null, requestHash);

      const existing = await tx.mealPlanItem.findUnique({
        where: {
          userId_planDate_mealSlot: {
            userId,
            planDate: normalizedPlanDate,
            mealSlot: slot
          }
        },
        include: mealPlanInclude
      });

      if (existing?.status === "COMPLETED") {
        throw new ConflictException("已完成餐次不能修改");
      }

      const menuSnapshot = buildMenuSnapshot(normalizedItems.map(item => item.menu));
      await this.assertStorageWritable(tx, userId, sizeOfJson({ planDate, mealSlot: slot, menu: menuSnapshot, note: normalizedNote }));

      const resolvedExpectedVersion = expectedVersion ?? null;

      if (existing && resolvedExpectedVersion == null) {
        throw new ConflictException("计划已存在，请刷新后携带 expectedVersion 重试");
      }

      const planItem = existing
        ? await (async () => {
            if (existing.version !== resolvedExpectedVersion) {
              throw new ConflictException("计划已被更新，请刷新后重试");
            }
            const updated = await tx.mealPlanItem.updateMany({
              where: {
                id: existing.id,
                version: resolvedExpectedVersion
              },
              data: {
                menuSnapshot: toJson(menuSnapshot),
                note: normalizedNote,
                version: { increment: 1 }
              }
            });
            if (updated.count !== 1) {
              throw new ConflictException("计划已被更新，请刷新后重试");
            }
            return { id: existing.id };
          })()
        : await tx.mealPlanItem.create({
            data: {
              userId,
              planDate: normalizedPlanDate,
              mealSlot: slot,
              menuSnapshot: toJson(menuSnapshot),
              note: normalizedNote
            }
          });

      await this.replaceMealPlanDishes(tx, planItem.id, normalizedItems);
      const item = await this.getMealPlanOrThrow(tx, planItem.id);
      await upsertStorageLedger(tx, userId, "MEAL", item.id, sizeOfJson(item));
      const result = this.toMealPlanSummary(item);
      await completeIdempotentOperation(tx, operationId, "meal-plan:create", userId, null, requestHash, result);
      return result;
    });
  }

  async addMealPlanItem(
    userId: UUID,
    operationId: OperationId,
    planDate: string,
    mealSlot: string,
    recipeId: UUID,
    recipeVersionId: UUID,
    slotType: string | null,
    purchaseState: string
  ): Promise<MealPlanSummary> {
    const normalizedSlot = normalizeMealSlot(mealSlot);
    const normalizedPlanDate = parseDateOnly(planDate);
    const normalizedSlotType = normalizeNullableRecipeSlotType(slotType);
    const normalizedPurchaseState = normalizePurchaseState(purchaseState);
    const requestHash = JSON.stringify({
      planDate,
      mealSlot: normalizedSlot,
      recipeId,
      recipeVersionId,
      slotType: normalizedSlotType,
      purchaseState: normalizedPurchaseState
    });

    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getIdempotentResult<MealPlanSummary>(tx, operationId, "meal-plan:item:add", userId, null, requestHash);
        if (repeated) return repeated;
        await startIdempotentOperation(tx, operationId, "meal-plan:item:add", userId, null, requestHash);

        const recipe = await this.requireOwnedRecipe(tx, userId, recipeId);
        if (recipe.currentVersionId !== recipeVersionId) {
          throw new ConflictException("菜谱版本已变化，请重新选择");
        }

        let existing = await tx.mealPlanItem.findUnique({
          where: {
            userId_planDate_mealSlot: {
              userId,
              planDate: normalizedPlanDate,
              mealSlot: normalizedSlot
            }
          },
          include: mealPlanInclude
        });

        if (existing) {
          await tx.$queryRaw`SELECT "id" FROM "meal_plan_items" WHERE "id" = ${existing.id} FOR UPDATE`;
          existing = await this.getMealPlanOrThrow(tx, existing.id);
        }

        if (existing?.status === "COMPLETED") {
          throw new ConflictException("已完成餐次不能修改");
        }

        if (existing?.dishes.some(item => item.recipeId === recipe.id)) {
          const result = this.toMealPlanSummary(existing);
          await completeIdempotentOperation(tx, operationId, "meal-plan:item:add", userId, null, requestHash, result);
          return result;
        }

        const nextMenu = {
          recipeId: recipe.id,
          recipeVersionId: recipe.currentVersionId,
          coverUrl: recipe.coverImageUrl ?? null,
          title: recipe.title,
          content: this.getEffectiveRecipeContent(recipe)
        } satisfies ResolvedMenuVersion;

        const existingMenus = existing?.dishes.length
          ? await this.resolveMenuVersions(tx, existing.dishes.map(item => item.recipeVersionId))
          : [];
        const menus = [...existingMenus, nextMenu];
        const menuSnapshot = buildMenuSnapshot(menus);
        await this.assertStorageWritable(tx, userId, sizeOfJson({ planDate, mealSlot: normalizedSlot, menu: menuSnapshot, note: existing?.note ?? null }));

        const planItem = existing
          ? await tx.mealPlanItem.update({
              where: { id: existing.id },
              data: {
                menuSnapshot: toJson(menuSnapshot),
                version: { increment: 1 }
              }
            })
          : await tx.mealPlanItem.create({
              data: {
                userId,
                planDate: normalizedPlanDate,
                mealSlot: normalizedSlot,
                menuSnapshot: toJson(menuSnapshot),
                note: null
              }
            });

        await tx.mealPlanDish.create({
          data: {
            planItemId: planItem.id,
            recipeId: recipe.id,
            recipeVersionId: recipe.currentVersionId,
            slotType: normalizedSlotType,
            purchaseState: normalizedPurchaseState,
            sortOrder: existing?.dishes.length ?? 0
          }
        });

        const item = await this.getMealPlanOrThrow(tx, planItem.id);
        await upsertStorageLedger(tx, userId, "MEAL", item.id, sizeOfJson(item));
        const result = this.toMealPlanSummary(item);
        await completeIdempotentOperation(tx, operationId, "meal-plan:item:add", userId, null, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("餐次已被更新，请刷新后重试");
      }
      throw error;
    }
  }

  async getMealPlanCookAssistant(userId: UUID, planItemId: UUID): Promise<MealPlanCookAssistant> {
    const plan = await this.getOwnedMealPlanOrThrow(this.prisma, userId, planItemId);
    return this.toMealPlanCookAssistant(plan);
  }

  async generateMealPlanCookAssistant(userId: UUID, planItemId: UUID, operationId: OperationId): Promise<MealPlanCookAssistant> {
    const requestHash = String(planItemId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<MealPlanCookAssistant>(
        tx,
        operationId,
        "meal-plan:cook-assistant",
        userId,
        null,
        requestHash
      );
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "meal-plan:cook-assistant", userId, null, requestHash);

      const plan = await this.getOwnedMealPlanOrThrow(tx, userId, planItemId);
      const currentValue = {
        ...plan,
        cookAssistant: plan.cookAssistant
      };
      const menuItems = await this.resolveStoredPlanMenuItems(tx, plan);
      const snapshot = buildCookAssistantSnapshot(plan, menuItems);
      const nextValue = {
        ...plan,
        cookAssistant: {
          menuDigest: buildMealPlanMenuDigest(plan),
          generatedAt: new Date(),
          snapshot
        }
      };
      await this.assertStorageWritable(tx, userId, Math.max(0, sizeOfJson(nextValue) - sizeOfJson(currentValue)));

      await tx.mealPlanCookAssistant.upsert({
        where: { planItemId: plan.id },
        update: {
          menuDigest: buildMealPlanMenuDigest(plan),
          snapshot: toJson(snapshot),
          generatedAt: new Date()
        },
        create: {
          planItemId: plan.id,
          menuDigest: buildMealPlanMenuDigest(plan),
          snapshot: toJson(snapshot),
          generatedAt: new Date()
        }
      });

      const nextPlan = await this.getMealPlanOrThrow(tx, plan.id);
      await upsertStorageLedger(tx, userId, "MEAL", nextPlan.id, sizeOfJson(nextPlan));
      const result = this.toMealPlanCookAssistant(nextPlan);
      await completeIdempotentOperation(tx, operationId, "meal-plan:cook-assistant", userId, null, requestHash, result);
      return result;
    });
  }

  async completeMealPlan(userId: UUID, planItemId: UUID, operationId: OperationId) {
    const requestHash = String(planItemId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<MealPlanSummary>(tx, operationId, "meal-plan:complete", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "meal-plan:complete", userId, null, requestHash);

      const current = await tx.mealPlanItem.findUnique({
        where: { id: planItemId },
        include: mealPlanInclude
      });
      if (!current || current.userId !== userId) throw new NotFoundException("计划不存在");

      const item =
        current.status === "COMPLETED"
          ? current
          : await tx.mealPlanItem.update({
              where: { id: current.id },
              data: {
                status: "COMPLETED",
                completedAt: new Date(),
                version: { increment: 1 }
              },
              include: mealPlanInclude
            });

      if (current.status !== "COMPLETED" && item.completedAt) {
        await this.medalService.awardMealCompletion(tx, userId, item.diningEvent, item.completedAt);
      }

      const result = this.toMealPlanSummary(item);
      await completeIdempotentOperation(tx, operationId, "meal-plan:complete", userId, null, requestHash, result);
      return result;
    });
  }

  async createDiningEvent(userId: UUID, planItemId: UUID, operationId: OperationId, scheduledAt: string, location?: string | null) {
    return this.prisma.$transaction(async tx => {
      const plan = await tx.mealPlanItem.findUnique({
        where: { id: planItemId },
        include: mealPlanInclude
      });
      if (!plan || plan.userId !== userId) throw new NotFoundException("计划不存在");
      if (plan.status === "COMPLETED") throw new ConflictException("已完成餐次不能再发起饭局");
      if (plan.diningEvent) throw new ConflictException("该餐次已发起饭局");

      const shareToken = createShareToken();
      const sharePath = `/pages_share/preview/index?token=${encodeURIComponent(shareToken)}`;
      const normalizedLocation = normalizeOptionalText(location);
      const eventRequestHash = `${planItemId}:${scheduledAt}:${normalizedLocation ?? ""}`;
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:create", userId, null, eventRequestHash);
      if (repeated) return repeated;

      await startIdempotentOperation(tx, operationId, "dining-event:create", userId, null, eventRequestHash);
      await this.assertStorageWritable(tx, userId, sizeOfJson({ scheduledAt, location: normalizedLocation, menu: plan.menuSnapshot }));

      const menu = fromJson<RecipeContentSnapshot>(plan.menuSnapshot);
      const event = await tx.diningEvent.create({
        data: {
          userId,
          mealPlanItemId: plan.id,
          title: menu.name,
          scheduledAt: parseDateTime(scheduledAt, "饭局时间格式错误"),
          location: normalizedLocation,
          menuSnapshot: toJson(plan.menuSnapshot),
          shareTokenHash: hashText(shareToken),
          shareTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          menuItems: {
            create: plan.dishes.map(item => ({
              recipeVersionId: item.recipeVersionId,
              title: item.recipeVersion.name,
              sortOrder: item.sortOrder
            }))
          }
        }
      });

      await upsertStorageLedger(tx, userId, "MEAL", event.id, sizeOfJson(event));
      const result = await this.getDiningEvent(userId, event.id, sharePath, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:create", userId, null, eventRequestHash, result);
      return result;
    });
  }

  async listDiningGroupActivities(userId: UUID, diningGroupId: UUID, limit?: number): Promise<DiningGroupActivitySummary[]> {
    await this.requireActiveMembership(this.prisma, userId, diningGroupId);
    const normalizedLimit = Math.min(Math.max(toPositiveInt(limit, 5), 3), 5);
    const activities = await this.prisma.diningGroupActivity.findMany({
      where: { diningGroupId },
      include: {
        actor: { select: { uid: true, nickname: true } }
      },
      orderBy: { createdAt: "desc" },
      take: normalizedLimit
    });
    return activities.map(item => this.toActivitySummary(item));
  }

  async inviteDiningGroup(userId: UUID, eventId: UUID, diningGroupId: UUID, operationId: OperationId) {
    const requestHash = `${eventId}:${diningGroupId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:invite-group", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:invite-group", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { id: eventId }
      });
      if (!event || event.userId !== userId) throw new NotFoundException("饭局不存在");

      const membership = await tx.diningGroupMember.findUnique({
        where: {
          diningGroupId_userId: {
            diningGroupId,
            userId
          }
        },
        include: { diningGroup: true }
      });
      if (!membership || membership.role !== "OWNER" || membership.status !== "ACTIVE") {
        throw new ForbiddenException("无权从该饭搭子邀请成员");
      }

      const entitlements = await this.entitlementService.resolveForUser(tx, userId);
      const activeCount = await tx.diningGroupMember.count({
        where: {
          diningGroupId,
          status: { in: ["ACTIVE", "RESTRICTED"] }
        }
      });
      if (entitlements.state === "OVER_MEMBER_LIMIT" || activeCount > entitlements.memberLimit) {
        throw new ForbiddenException("当前饭搭子处于超额受限状态");
      }

      const members = await tx.diningGroupMember.findMany({
        where: {
          diningGroupId,
          userId: { not: userId },
          status: { in: ["ACTIVE", "RESTRICTED"] }
        }
      });
      const existing = await tx.diningEventParticipant.findMany({
        where: {
          diningEventId: eventId,
          userId: { in: members.map(item => item.userId) }
        },
        select: { userId: true }
      });
      const existingUserIds = new Set(existing.map(item => item.userId).filter(Boolean));
      for (const member of members) {
        if (existingUserIds.has(member.userId)) continue;
        const participant = await tx.diningEventParticipant.create({
          data: {
            diningEventId: eventId,
            userId: member.userId,
            sourceType: "DINING_GROUP",
            status: "INVITED"
          }
        });
        await upsertStorageLedger(tx, userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      }

      if (event.diningGroupId) {
        await this.writeActivity(tx, {
          diningGroupId: event.diningGroupId,
          kind: "INVITE_PENDING",
          state: "PENDING",
          actorUserId: userId,
          title: "邀请了饭搭子成员一起参加这顿饭",
          detail: null,
          diningEventId: eventId,
          dedupeKey: `invite-pending:${eventId}`
        });
      }

      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:invite-group", userId, null, requestHash, result);
      return result;
    });
  }

  async respondToDiningEvent(userId: UUID, eventId: UUID, operationId: OperationId, status: string) {
    const normalizedStatus = normalizeEventStatus(status);
    const requestHash = `${eventId}:${normalizedStatus}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:respond", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:respond", userId, null, requestHash);

      const participant = await tx.diningEventParticipant.findFirst({
        where: { diningEventId: eventId, userId },
        include: {
          diningEvent: true
        }
      });
      if (!participant) throw new NotFoundException("饭局不存在");

      await tx.diningEventParticipant.update({
        where: { id: participant.id },
        data: {
          status: normalizedStatus,
          respondedAt: new Date()
        }
      });
      await upsertStorageLedger(tx, participant.diningEvent.userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:respond", userId, null, requestHash, result);
      return result;
    });
  }

  async chooseBringRecipe(userId: UUID, eventId: UUID, recipeId: UUID, operationId: OperationId) {
    const requestHash = `${eventId}:${recipeId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:bring", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:bring", userId, null, requestHash);

      const participant = await tx.diningEventParticipant.findFirst({
        where: {
          diningEventId: eventId,
          userId
        },
        include: {
          diningEvent: true
        }
      });
      if (!participant) throw new NotFoundException("饭局不存在");

      const recipe = await this.requireOwnedRecipe(tx, userId, recipeId);
      const recipeVersion = await this.resolveRecipeVersion(tx, recipe);

      await tx.diningEventParticipant.update({
        where: { id: participant.id },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
          bringRecipeId: recipe.id,
          bringVersionId: recipeVersion.id
        }
      });

      if (participant.diningEvent.diningGroupId) {
        await this.writeActivity(tx, {
          diningGroupId: participant.diningEvent.diningGroupId,
          kind: "BRING_UPDATED",
          state: "DONE",
          actorUserId: userId,
          title: "更新了我带菜",
          detail: recipe.title,
          diningEventId: eventId,
          dedupeKey: `bring-updated:${eventId}:${userId}`
        });
      }

      await upsertStorageLedger(tx, participant.diningEvent.userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:bring", userId, null, requestHash, result);
      return result;
    });
  }

  async claimCook(
    userId: UUID,
    eventId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    menuItemId: UUID,
    action: string
  ): Promise<DiningEventSummary> {
    const normalizedAction = normalizeCookAction(action);
    const requestHash = JSON.stringify({ eventId, expectedVersion, menuItemId, action: normalizedAction });
    return this.prisma.$transaction(async tx => {
      const event = await tx.diningEvent.findUnique({
        where: { id: eventId }
      });
      if (!event) throw new NotFoundException("饭局不存在");
      if (event.status === "CANCELLED" || event.status === "COMPLETED") {
        throw new ConflictException("当前饭局状态不允许认领掌勺");
      }

      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:cook", userId, event.diningGroupId, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:cook", userId, event.diningGroupId, requestHash);

      const participant = await tx.diningEventParticipant.findFirst({
        where: {
          diningEventId: eventId,
          userId
        }
      });
      if (event.userId !== userId && (!participant || participant.status === "DECLINED" || participant.status === "REMOVED")) {
        throw new ForbiddenException("无权认领这顿饭的掌勺");
      }

      const menuItem = await tx.diningEventMenuItem.findUnique({
        where: { id: menuItemId }
      });
      if (!menuItem || menuItem.diningEventId !== eventId) throw new NotFoundException("菜单项不存在");
      if (menuItem.version !== expectedVersion) throw new ConflictException("菜单项已被更新，请刷新后重试");

      if (normalizedAction === "CLAIM") {
        const claimed = await tx.diningEventMenuItem.updateMany({
          where: {
            id: menuItemId,
            diningEventId: eventId,
            version: expectedVersion,
            cookUserId: null
          },
          data: {
            cookUserId: userId,
            version: { increment: 1 }
          }
        });
        if (claimed.count !== 1) throw new ConflictException("这道菜已被其他成员认领");
      } else {
        if (menuItem.cookUserId !== userId) {
          throw new ForbiddenException("只能释放自己认领的菜");
        }
        const released = await tx.diningEventMenuItem.updateMany({
          where: {
            id: menuItemId,
            diningEventId: eventId,
            version: expectedVersion,
            cookUserId: userId
          },
          data: {
            cookUserId: null,
            version: { increment: 1 }
          }
        });
        if (released.count !== 1) throw new ConflictException("菜单项已被更新，请刷新后重试");
      }

      if (event.diningGroupId) {
        await this.writeActivity(tx, {
          diningGroupId: event.diningGroupId,
          kind: "COOK_CLAIMED",
          state: "DONE",
          actorUserId: userId,
          title: normalizedAction === "CLAIM" ? "认领了一道菜的掌勺" : "释放了一道菜的掌勺",
          detail: menuItem.title,
          diningEventId: eventId,
          dedupeKey: `cook-claimed:${eventId}:${menuItemId}:${userId}`
        });
      }

      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:cook", userId, event.diningGroupId, requestHash, result);
      return result;
    });
  }

  async completeDiningEvent(userId: UUID, eventId: UUID, operationId: OperationId) {
    const requestHash = String(eventId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:complete", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:complete", userId, null, requestHash);

      const current = await this.loadDiningEventRow(tx, eventId);
      if (!current || current.userId !== userId) throw new NotFoundException("饭局不存在");
      if (current.status === "COMPLETED") {
        const result = this.toDiningEventSummary(current, null);
        await completeIdempotentOperation(tx, operationId, "dining-event:complete", userId, null, requestHash, result);
        return result;
      }
      if (current.status === "CANCELLED") {
        throw new ConflictException("已取消饭局不能完成");
      }

      const acceptedUserIds = current.participants
        .filter(item => item.status === "ACCEPTED" && item.userId !== null)
        .map(item => item.userId as UUID);

      if (!acceptedUserIds.length) {
        throw new BadRequestException("至少有一位接受参与人后才能完成饭局");
      }

      await tx.diningEvent.update({
        where: { id: current.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          version: { increment: 1 }
        }
      });

      const event = await this.loadDiningEventRow(tx, current.id);
      if (!event) throw new NotFoundException("饭局不存在");

      if (event.completedAt) {
        await this.medalService.awardDiningEventCompletion(tx, userId, acceptedUserIds, event.completedAt);
      }

      if (event.diningGroupId) {
        await this.writeActivity(tx, {
          diningGroupId: event.diningGroupId,
          kind: "MEAL_COMPLETED",
          state: "DONE",
          actorUserId: userId,
          title: "完成了这顿饭",
          detail: event.title,
          diningEventId: event.id,
          dedupeKey: `meal-completed:${event.id}`
        });
      }

      const result = this.toDiningEventSummary(event, null);
      await completeIdempotentOperation(tx, operationId, "dining-event:complete", userId, null, requestHash, result);
      return result;
    });
  }

  async createDiningMemoryShare(
    userId: UUID,
    eventId: UUID,
    operationId: OperationId,
    showParticipants: boolean,
    caption?: string | null
  ): Promise<DiningMemoryShareSnapshot> {
    const normalizedCaption = normalizeOptionalText(caption);
    const requestHash = `${eventId}:${showParticipants ? "1" : "0"}:${normalizedCaption ?? ""}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async tx => {
          const repeated = await getIdempotentResult<DiningMemoryShareSnapshot>(tx, operationId, "dining-memory-share:create", userId, null, requestHash);
          if (repeated) return repeated;
          await startIdempotentOperation(tx, operationId, "dining-memory-share:create", userId, null, requestHash);

          const event = await this.loadDiningEventRow(tx, eventId);
          if (!event || event.userId !== userId) throw new NotFoundException("饭局不存在");
          if (event.status !== "COMPLETED" || !event.completedAt) {
            throw new ConflictException("只有已完成的饭局才能生成饭搭子卡");
          }

          const latest = await tx.diningEventMemoryShare.findFirst({
            where: { diningEventId: eventId },
            orderBy: { snapshotVersion: "desc" },
            select: { snapshotVersion: true }
          });
          const snapshotVersion = (latest?.snapshotVersion ?? 0) + 1;
          const shareToken = createShareToken();
          const sharePath = buildMemorySharePath(shareToken);
          const menuItemsSnapshot = this.buildDiningMemoryMenuSnapshot(event);
          if (!menuItemsSnapshot.length) {
            throw new ConflictException("只有已确认最终菜单的饭局才能生成饭搭子卡");
          }
          const participantsSnapshot = showParticipants ? this.buildDiningMemoryParticipantSnapshot(event) : [];

          const snapshotPayload = {
            title: event.title,
            planDate: event.mealPlanItem?.planDate.toISOString().slice(0, 10) ?? null,
            mealSlot: event.mealPlanItem?.mealSlot ?? null,
            menuItems: menuItemsSnapshot,
            participants: participantsSnapshot,
            caption: normalizedCaption,
            sharedAt: new Date().toISOString(),
            snapshotVersion
          };
          await this.assertStorageWritable(tx, userId, sizeOfJson(snapshotPayload));

          const snapshot = await tx.diningEventMemoryShare.create({
            data: {
              diningEventId: event.id,
              diningGroupId: event.diningGroupId,
              createdByUserId: userId,
              snapshotVersion,
              title: event.title,
              planDate: event.mealPlanItem?.planDate ?? null,
              mealSlot: event.mealPlanItem?.mealSlot ?? null,
              menuItemsSnapshot: toJson(menuItemsSnapshot),
              participantsSnapshot: toJson(participantsSnapshot),
              caption: normalizedCaption,
              showParticipants,
              shareTokenHash: hashText(shareToken)
            }
          });

          await upsertStorageLedger(tx, userId, "TECHNICAL_SNAPSHOT", snapshot.id, sizeOfJson(snapshotPayload));

          if (event.diningGroupId) {
            await this.writeActivity(tx, {
              diningGroupId: event.diningGroupId,
              kind: "MEMORY_CREATED",
              state: "DONE",
              actorUserId: userId,
              title: "生成了一张饭搭子卡",
              detail: sharePath,
              diningEventId: event.id,
              dedupeKey: `memory-created:${snapshot.id}`
            });
          }

          const result = this.toDiningMemoryShareSnapshot(snapshot, sharePath);
          await completeIdempotentOperation(tx, operationId, "dining-memory-share:create", userId, null, requestHash, result);
          return result;
        });
      } catch (error) {
        if (isUniqueConstraintError(error) && attempt < 2) {
          continue;
        }
        if (isUniqueConstraintError(error)) {
          throw new ConflictException("饭搭子卡已被更新，请重试");
        }
        throw error;
      }
    }

    throw new ConflictException("饭搭子卡已被更新，请重试");
  }

  async getDiningEvent(
    userId: UUID,
    eventId: UUID,
    shareTokenPath?: string | null,
    db: MealDb = this.prisma
  ): Promise<DiningEventSummary> {
    const event = await this.loadDiningEventRow(db, eventId);
    if (!event) throw new NotFoundException("饭局不存在");
    const isParticipant = event.participants.some(item => item.userId === userId);
    if (event.userId !== userId && !isParticipant) throw new ForbiddenException("无权查看该饭局");
    return this.toDiningEventSummary(event, shareTokenPath);
  }

  async getDiningMemorySharePreview(shareToken: string): Promise<DiningMemorySharePreview> {
    const shareTokenHash = hashText(shareToken);
    const snapshot = await this.prisma.diningEventMemoryShare.findUnique({
      where: { shareTokenHash }
    });
    if (!snapshot) throw new NotFoundException("饭搭子卡分享已失效");
    return this.toDiningMemorySharePreview(snapshot);
  }

  async getSharePreview(shareToken: string): Promise<SharePreviewResponse> {
    const shareTokenHash = hashText(shareToken);
    const event = await this.prisma.diningEvent.findUnique({
      where: { shareTokenHash },
      include: {
        user: { select: { uid: true } }
      }
    });
    if (!event || !event.shareTokenExpiresAt || event.shareTokenExpiresAt <= new Date()) {
      throw new NotFoundException("分享已失效");
    }

    const menu = fromJson<RecipeContentSnapshot>(event.menuSnapshot);
    return {
      title: event.title,
      scheduledAt: toIsoDate(event.scheduledAt),
      location: event.location,
      menu: {
        name: menu.name,
        ingredients: menu.ingredients
      },
      organizerUid: event.user.uid
    };
  }

  async acceptShareInvite(userId: UUID, shareToken: string, operationId: OperationId, guestName: string) {
    const normalizedGuestName = guestName.trim();
    if (!normalizedGuestName) throw new BadRequestException("展示名称不能为空");
    const shareTokenHash = hashText(shareToken);
    const requestHash = `${shareTokenHash}:${normalizedGuestName}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "share:accept", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "share:accept", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { shareTokenHash }
      });
      if (!event || !event.shareTokenExpiresAt || event.shareTokenExpiresAt <= new Date()) {
        throw new NotFoundException("分享已失效");
      }

      const existing = await tx.diningEventParticipant.findFirst({
        where: { diningEventId: event.id, userId }
      });
      if (existing) {
        await tx.diningEventParticipant.update({
          where: { id: existing.id },
          data: {
            guestName: normalizedGuestName,
            status: "ACCEPTED",
            respondedAt: new Date(),
            sourceType: "SHARE"
          }
        });
        const result = await this.getDiningEvent(userId, event.id, undefined, tx);
        await completeIdempotentOperation(tx, operationId, "share:accept", userId, null, requestHash, result);
        return result;
      }

      const participant = await tx.diningEventParticipant.create({
        data: {
          diningEventId: event.id,
          userId,
          guestName: normalizedGuestName,
          sourceType: "SHARE",
          status: "ACCEPTED",
          respondedAt: new Date()
        }
      });
      await upsertStorageLedger(tx, event.userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      const result = await this.getDiningEvent(userId, event.id, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "share:accept", userId, null, requestHash, result);
      return result;
    });
  }

  private async loadDiningEventRow(db: MealDb, eventId: UUID) {
    return db.diningEvent.findUnique({
      where: { id: eventId },
      include: {
        user: { select: { uid: true, nickname: true, avatarUrl: true } },
        mealPlanItem: { select: { planDate: true, mealSlot: true } },
        participants: {
          include: {
            user: { select: { uid: true, nickname: true, avatarUrl: true } },
            bringRecipe: true
          }
        },
        menuItems: {
          include: {
            cookUser: { select: { uid: true, nickname: true } },
            recipeVersion: {
              include: {
                currentRecipes: {
                  select: { id: true, coverImageUrl: true },
                  take: 1
                }
              }
            }
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
        }
      }
    });
  }

  private toMealPlanSummary(item: MealPlanRow): MealPlanSummary {
    const menu = fromJson<RecipeContentSnapshot>(item.menuSnapshot);
    return {
      id: item.id,
      planDate: item.planDate.toISOString().slice(0, 10),
      mealSlot: item.mealSlot,
      title: menu.name,
      menuItems: item.dishes.map(dish => ({
        recipeId: dish.recipeId,
        recipeVersionId: dish.recipeVersionId,
        title: dish.recipeVersion.name,
        servings: dish.recipeVersion.baseServings ?? null,
        duration: (dish.recipeVersion.duration ?? null) as RecipeDuration | null,
        durationText: recipeDurationText((dish.recipeVersion.duration ?? null) as RecipeDuration | null),
        slotType: dish.slotType,
        purchaseState: dish.purchaseState,
        sortOrder: dish.sortOrder
      })),
      status: item.status,
      version: item.version,
      completedAt: item.completedAt ? toIsoDate(item.completedAt) : null,
      hasDiningEvent: Boolean(item.diningEvent),
      diningEventId: item.diningEvent?.id ?? null,
      createdAt: toIsoDate(item.createdAt)
    };
  }

  private toMealPlanCookAssistant(item: MealPlanRow): MealPlanCookAssistant {
    const snapshot = item.cookAssistant ? fromJson<MealPlanCookAssistantSnapshot>(item.cookAssistant.snapshot) : null;
    return {
      planItemId: item.id,
      hasSnapshot: Boolean(snapshot),
      isStale: Boolean(item.cookAssistant && item.cookAssistant.menuDigest !== buildMealPlanMenuDigest(item)),
      generatedAt: item.cookAssistant ? toIsoDate(item.cookAssistant.generatedAt) : null,
      summary: snapshot?.summary ?? {
        dishCount: item.dishes.length,
        prepTaskCount: 0,
        timelineStepCount: 0,
        totalDurationText: null,
        suggestedStartTime: null,
        notes: []
      },
      prepTasks: snapshot?.prepTasks ?? [],
      cookTimeline: snapshot?.cookTimeline ?? [],
      serveTasks: snapshot?.serveTasks ?? []
    };
  }

  private toMealPollSummary(poll: MealPollSummaryRow): MealPollSummary {
    return {
      id: poll.id,
      diningGroupId: poll.diningGroupId,
      title: buildMealPollTitle(poll.planDate.toISOString().slice(0, 10), poll.mealSlot),
      planDate: poll.planDate.toISOString().slice(0, 10),
      mealSlot: poll.mealSlot,
      status: poll.status,
      deadlineAt: toIsoDate(poll.deadlineAt),
      choiceLimit: poll.choiceLimit,
      note: poll.note,
      candidateCount: poll._count.candidates,
      responseCount: poll._count.responses,
      confirmedPlanItemId: poll.confirmedPlanItemId ?? null,
      confirmedDiningEventId: poll.confirmedDiningEventId ?? null,
      version: poll.version,
      createdAt: toIsoDate(poll.createdAt)
    };
  }

  private toMealPollDetail(poll: MealPollDetailRow): MealPollDetail {
    return {
      ...this.toMealPollSummary(poll),
      candidates: poll.candidates.map(item => ({
        id: item.id,
        recipeId: item.recipeVersion?.currentRecipes[0]?.id ?? null,
        recipeVersionId: item.recipeVersionId,
        title: item.title,
        coverUrl: item.recipeVersion?.currentRecipes[0]?.coverImageUrl ?? null,
        status: item.status,
        sourceType: item.sourceType,
        suggestedByUid: item.suggestedBy?.uid ?? null,
        voteCount: item._count.responseItems
      })),
      responses: poll.responses.map(item => {
        const suggestionItem = item.items.find(responseItem => responseItem.candidate.sourceType === "SUGGESTION");
        return {
          id: item.id,
          userUid: item.user.uid,
          selectedCandidateIds: item.items
            .filter(responseItem => responseItem.candidate.sourceType !== "SUGGESTION")
            .map(responseItem => responseItem.candidateId),
          suggestionCandidateId: suggestionItem?.candidateId ?? null,
          note: item.note,
          respondedAt: toIsoDate(item.respondedAt)
        };
      })
    };
  }

  private toActivitySummary(activity: ActivityRow): DiningGroupActivitySummary {
    return {
      id: activity.id,
      diningGroupId: activity.diningGroupId,
      kind: activity.kind,
      state: activity.state,
      actorUid: activity.actor?.uid ?? null,
      actorName: activity.actor?.nickname ?? null,
      title: activity.title,
      detail: activity.detail,
      pollId: activity.pollId,
      planItemId: activity.planItemId,
      diningEventId: activity.diningEventId,
      createdAt: toIsoDate(activity.createdAt)
    };
  }

  private toDiningEventSummary(event: DiningEventRow, shareTokenPath?: string | null): DiningEventSummary {
    const menu = fromJson<RecipeContentSnapshot>(event.menuSnapshot);
    return {
      id: event.id,
      title: event.title,
      scheduledAt: toIsoDate(event.scheduledAt),
      location: event.location,
      status: event.status,
      organizerUid: event.user?.uid ?? null,
      organizerName: event.user?.nickname ?? null,
      organizerAvatarUrl: event.user?.avatarUrl ?? null,
      planItemId: event.mealPlanItemId,
      diningGroupId: event.diningGroupId,
      menu,
      menuItems: event.menuItems.map(item => ({
        id: item.id,
        recipeId: item.recipeVersion.currentRecipes[0]?.id ?? null,
        recipeVersionId: item.recipeVersionId,
        title: item.title,
        cookUserUid: item.cookUser?.uid ?? null,
        cookName: item.cookUser?.nickname ?? null,
        version: item.version
      })),
      participants: event.participants.map(item => ({
        id: item.id,
        userUid: item.user?.uid ?? null,
        displayName: item.user?.nickname?.trim() || item.guestName || null,
        avatarUrl: item.user?.avatarUrl ?? null,
        guestName: item.guestName,
        sourceType: item.sourceType,
        status: item.status,
        bringRecipeId: item.bringRecipeId,
        bringRecipeTitle: item.bringRecipe?.title ?? null
      }) satisfies DiningEventParticipantSummary),
      shareTokenPath: shareTokenPath ?? null,
      completedAt: event.completedAt ? toIsoDate(event.completedAt) : null,
      version: event.version,
      createdAt: toIsoDate(event.createdAt)
    };
  }

  private toDiningMemoryShareSnapshot(snapshot: DiningEventMemoryShareRow, sharePath: string): DiningMemoryShareSnapshot {
    return {
      id: snapshot.id,
      diningEventId: snapshot.diningEventId,
      sharePath,
      ...this.toDiningMemorySharePreview(snapshot)
    };
  }

  private toDiningMemorySharePreview(snapshot: DiningEventMemoryShareRow): DiningMemorySharePreview {
    return {
      title: snapshot.title,
      planDate: snapshot.planDate ? snapshot.planDate.toISOString().slice(0, 10) : null,
      mealSlot: snapshot.mealSlot,
      menuItems: fromJson<DiningMemoryShareMenuItemSnapshot[]>(snapshot.menuItemsSnapshot),
      participants: fromJson<DiningMemoryShareParticipantSnapshot[]>(snapshot.participantsSnapshot),
      caption: snapshot.caption,
      sharedAt: toIsoDate(snapshot.createdAt),
      snapshotVersion: snapshot.snapshotVersion
    };
  }

  private buildDiningMemoryMenuSnapshot(event: DiningEventRow): DiningMemoryShareMenuItemSnapshot[] {
    return event.menuItems.map(item => ({
      title: item.title,
      coverUrl: item.recipeVersion.currentRecipes[0]?.coverImageUrl ?? null,
      cookName: item.cookUser ? this.resolveMemoryDisplayName(item.cookUser.nickname, "掌勺人") : null
    }));
  }

  private buildDiningMemoryParticipantSnapshot(event: DiningEventRow): DiningMemoryShareParticipantSnapshot[] {
    const participants: DiningMemoryShareParticipantSnapshot[] = [
      {
        displayName: this.resolveMemoryDisplayName(event.user.nickname, "主理人"),
        avatarUrl: event.user.avatarUrl ?? null,
        role: "ORGANIZER"
      }
    ];

    for (const item of event.participants) {
      if (item.status !== "ACCEPTED") continue;
      if (item.user) {
        participants.push({
          displayName: this.resolveMemoryDisplayName(item.user.nickname, "饭搭子"),
          avatarUrl: item.user.avatarUrl ?? null,
          role: "PARTICIPANT"
        });
        continue;
      }

      if (item.guestName) {
        participants.push({
          displayName: item.guestName,
          avatarUrl: null,
          role: "GUEST"
        });
      }
    }

    return participants;
  }

  private resolveMemoryDisplayName(nickname: string | null, fallback: string) {
    if (nickname?.trim()) return nickname.trim();
    return fallback;
  }

  private getEffectiveRecipeContent(recipe: Prisma.RecipeGetPayload<{
    include: { currentVersion: true };
  }>) {
    return versionToContent(recipe.currentVersion);
  }

  private async resolveRecipeVersion(
    _tx: Prisma.TransactionClient,
    recipe: Prisma.RecipeGetPayload<{
      include: { currentVersion: true };
    }>
  ) {
    return recipe.currentVersion;
  }

  private async resolveMenuVersions(tx: Prisma.TransactionClient, recipeVersionIds: UUID[]): Promise<ResolvedMenuVersion[]> {
    const versions = await tx.recipeContentVersion.findMany({
      where: { id: { in: recipeVersionIds } },
      include: {
        currentRecipes: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            coverImageUrl: true
          },
          take: 1
        }
      }
    });

    const versionMap = new Map(versions.map(item => [item.id, item]));
    return recipeVersionIds.map(recipeVersionId => {
      const version = versionMap.get(recipeVersionId);
      if (!version) throw new BadRequestException("存在无效菜谱版本");
      return {
        recipeId: version.currentRecipes[0]?.id ?? null,
        recipeVersionId: version.id,
        coverUrl: version.currentRecipes[0]?.coverImageUrl ?? null,
        title: version.name,
        content: versionToContent(version)
      };
    });
  }

  private async resolvePlanMenuItems(
    tx: Prisma.TransactionClient,
    userId: UUID,
    menuItems: Array<{
      slotType: string | null;
      sortOrder: number;
      recipeId: UUID;
      recipeVersionId: UUID;
      purchaseState: string;
    }>
  ): Promise<PlanMenuItemInput[]> {
    const resolved: PlanMenuItemInput[] = [];
    for (const item of menuItems) {
      const recipe = await this.requireOwnedRecipe(tx, userId, item.recipeId);
      if (recipe.currentVersionId !== item.recipeVersionId) {
        throw new ConflictException("菜谱版本已变化，请重新选择");
      }
      resolved.push({
        slotType: normalizeNullableRecipeSlotType(item.slotType),
        sortOrder: item.sortOrder,
        purchaseState: normalizePurchaseState(item.purchaseState),
        menu: {
          recipeId: recipe.id,
          recipeVersionId: recipe.currentVersionId,
          coverUrl: recipe.coverImageUrl ?? null,
          title: recipe.title,
          content: this.getEffectiveRecipeContent(recipe)
        }
      });
    }
    return resolved.sort((left, right) => left.sortOrder - right.sortOrder);
  }

  private async resolveStoredPlanMenuItems(tx: Prisma.TransactionClient, plan: MealPlanRow): Promise<PlanMenuItemInput[]> {
    const menus = await this.resolveMenuVersions(
      tx,
      plan.dishes.map(item => item.recipeVersionId)
    );
    return plan.dishes
      .map((dish, index) => {
        const menu = menus[index];
        if (!menu) return null;
        return {
          slotType: normalizeNullableRecipeSlotType(dish.slotType),
          sortOrder: dish.sortOrder,
          purchaseState: normalizePurchaseState(dish.purchaseState),
          menu: {
            ...menu,
            recipeId: dish.recipeId ?? menu.recipeId
          }
        } satisfies PlanMenuItemInput;
      })
      .filter((item): item is PlanMenuItemInput => Boolean(item));
  }

  private normalizePeopleCount(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 12) {
      throw new BadRequestException("人数参数错误");
    }
    return value;
  }

  private normalizeRandomSlotPlan(mealSlot: MealSlot, peopleCount: number, slotPlan?: RandomSlotPlan | null): RandomSlotPlan {
    const fallback = this.buildDefaultRandomSlotPlan(mealSlot, peopleCount);
    const normalized = {
      meatCount: slotPlan?.meatCount ?? fallback.meatCount,
      vegetableCount: slotPlan?.vegetableCount ?? fallback.vegetableCount,
      soupCount: slotPlan?.soupCount ?? fallback.soupCount,
      stapleCount: slotPlan?.stapleCount ?? fallback.stapleCount,
      breakfastStapleCount: slotPlan?.breakfastStapleCount ?? fallback.breakfastStapleCount,
      breakfastProteinCount: slotPlan?.breakfastProteinCount ?? fallback.breakfastProteinCount,
      breakfastSideCount: slotPlan?.breakfastSideCount ?? fallback.breakfastSideCount
    };
    const counts = Object.values(normalized);
    if (counts.some(value => !Number.isInteger(value) || value < 0)) {
      throw new BadRequestException("菜位数量参数错误");
    }
    const total = counts.reduce((sum, value) => sum + value, 0);
    if (total < 1 || total > 12) {
      throw new BadRequestException("菜位数量参数错误");
    }
    if (mealSlot === "BREAKFAST") {
      if (normalized.meatCount > 0 || normalized.vegetableCount > 0 || normalized.soupCount > 0 || normalized.stapleCount > 0) {
        throw new BadRequestException("早餐菜位参数错误");
      }
    } else if (normalized.breakfastStapleCount > 0 || normalized.breakfastProteinCount > 0 || normalized.breakfastSideCount > 0) {
      throw new BadRequestException("午晚餐菜位参数错误");
    }
    return normalized;
  }

  private buildDefaultRandomSlotPlan(mealSlot: MealSlot, peopleCount: number): RandomSlotPlan {
    if (mealSlot === "BREAKFAST") {
      return {
        meatCount: 0,
        vegetableCount: 0,
        soupCount: 0,
        stapleCount: 0,
        breakfastStapleCount: 1,
        breakfastProteinCount: 1,
        breakfastSideCount: 1
      };
    }

    const dishCount = peopleCount + 1;
    return {
      meatCount: Math.ceil(dishCount / 2),
      vegetableCount: Math.floor(dishCount / 2),
      soupCount: 1,
      stapleCount: 1,
      breakfastStapleCount: 0,
      breakfastProteinCount: 0,
      breakfastSideCount: 0
    };
  }

  private buildRandomSlotSeeds(mealSlot: MealSlot, slotPlan: RandomSlotPlan): RandomRecipeSlotSeed[] {
    const slots: RandomRecipeSlotSeed[] = [];
    const append = (slotType: RecipeSlotType, count: number) => {
      for (let index = 0; index < count; index += 1) {
        slots.push({
          slotId: `${slotType}-${index + 1}`,
          slotType,
          slotIndex: slots.length
        });
      }
    };

    if (mealSlot === "BREAKFAST") {
      append("BREAKFAST_STAPLE", slotPlan.breakfastStapleCount);
      append("BREAKFAST_PROTEIN", slotPlan.breakfastProteinCount);
      append("BREAKFAST_SIDE", slotPlan.breakfastSideCount);
      return slots;
    }

    append("MEAT", slotPlan.meatCount);
    append("VEGETABLE", slotPlan.vegetableCount);
    append("SOUP", slotPlan.soupCount);
    append("STAPLE", slotPlan.stapleCount);
    return slots;
  }

  private async loadRandomRecipeCandidates(userId: UUID): Promise<RandomRecipeCandidate[]> {
    const [recipes, profile] = await Promise.all([
      this.prisma.recipe.findMany({
        where: {
          ownerId: userId,
          status: "ACTIVE"
        },
        include: {
          currentVersion: {
            include: {
              versionTags: true
            }
          }
        }
      }),
      this.prisma.userTasteProfile.findUnique({
        where: { userId }
      })
    ]);
    const blockedNames = new Set(
      [
        ...(profile?.allergies ?? []),
        ...(profile?.strictDislikes ?? []),
        ...(profile?.dislikedIngredients ?? [])
      ]
        .map(normalizeNameKey)
        .filter(Boolean)
    );

    return recipes
      .filter(recipe => this.isRandomRecipeAllowedByTaste(recipe, blockedNames))
      .map(recipe => {
        const content = this.getEffectiveRecipeContent(recipe);
        const tags = this.resolveRandomTagSnapshot(recipe.currentVersion.versionTags, content);
        if (!tags) return null;
        return {
          recipeId: recipe.id,
          recipeVersionId: recipe.currentVersionId,
          title: recipe.title,
          coverUrl: recipe.coverImageUrl ?? null,
          content,
          mealMoments: tags.mealMoments,
          slotTypes: tags.slotTypes,
          flavorTags: tags.flavorTags,
          mainProteinType: tags.mainProteinType,
          primaryIngredientIds: tags.primaryIngredientIds
        };
      })
      .filter((item): item is RandomRecipeCandidate => Boolean(item));
  }

  private isRandomRecipeAllowedByTaste(recipe: RandomRecipeRow, blockedNames: Set<string>) {
    if (!blockedNames.size) return true;
    const content = this.getEffectiveRecipeContent(recipe);
    return !content.ingredients.some(ingredient => blockedNames.has(normalizeNameKey(ingredient.ingredientName)));
  }

  private async loadRandomInventoryFacts(userId: UUID): Promise<RandomInventoryFacts> {
    const fridgeItems = await this.prisma.fridgeItem.findMany({
      where: {
        userId,
        available: true
      },
      select: {
        ingredientId: true
      }
    });
    return {
      fridgeIngredientIds: new Set(
        fridgeItems
          .map(item => item.ingredientId)
          .filter((item): item is UUID => typeof item === "number" && item > 0)
      )
    };
  }

  private pickRandomRecipeCandidate(params: {
    mealSlot: MealSlot;
    slotType: RecipeSlotType;
    candidates: RandomRecipeCandidate[];
    excludedVersionIds: Set<UUID>;
    currentItems: Array<{ slotId: string; slotType: RecipeSlotType; recipeId: UUID; recipeVersionId: UUID }>;
    inventoryFacts: RandomInventoryFacts;
    fridgePreferred: boolean;
    replaceConstraints: RandomReplaceConstraint[];
  }): RandomRecipeCandidate | null {
    const candidateMap = new Map(params.candidates.map(item => [item.recipeVersionId, item]));
    const avoidNames = new Set(
      params.replaceConstraints
        .filter(item => item.kind === "AVOID_INGREDIENT")
        .map(item => normalizeNameKey(item.ingredientName ?? ""))
        .filter(Boolean)
    );
    const avoidIds = new Set(
      params.replaceConstraints
        .filter(item => item.kind === "AVOID_INGREDIENT" && typeof item.ingredientId === "number" && item.ingredientId > 0)
        .map(item => item.ingredientId as UUID)
    );
    const flavorValue = params.replaceConstraints.find(item => item.kind === "FLAVOR")?.value ?? null;
    const durationValue = params.replaceConstraints.find(item => item.kind === "DURATION")?.value ?? null;
    const useFridgeFirst =
      params.fridgePreferred || params.replaceConstraints.some(item => item.kind === "INGREDIENT" && item.value === "USE_FRIDGE_FIRST");
    const existingProteinTypes = new Set(
      params.currentItems
        .filter(item => item.slotType === "MEAT")
        .map(item => candidateMap.get(item.recipeVersionId)?.mainProteinType ?? null)
        .filter((item): item is RecipeProteinType => Boolean(item) && item !== "NONE")
    );

    const filtered = params.candidates.filter(candidate => {
      if (params.excludedVersionIds.has(candidate.recipeVersionId)) return false;
      if (params.currentItems.some(item => item.recipeVersionId === candidate.recipeVersionId)) return false;
      if (!this.randomCandidateSupportsMealSlot(candidate, params.mealSlot)) return false;
      if (!this.randomCandidateSupportsSlotType(candidate, params.slotType)) return false;
      if (flavorValue && !candidate.flavorTags.includes(flavorValue)) return false;
      if (durationValue && candidate.content.duration !== durationValue) return false;
      if (
        candidate.content.ingredients.some(ingredient =>
          avoidIds.has((ingredient.ingredientId ?? 0) as UUID) || avoidNames.has(normalizeNameKey(ingredient.ingredientName))
        )
      ) {
        return false;
      }
      return true;
    });

    if (!filtered.length) return null;

    return filtered
      .map(candidate => ({
        candidate,
        score: this.scoreRandomCandidate(candidate, params.slotType, existingProteinTypes, params.inventoryFacts, useFridgeFirst),
        tieBreaker: Math.random()
      }))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return right.tieBreaker - left.tieBreaker;
      })[0]?.candidate ?? null;
  }

  private randomCandidateSupportsMealSlot(candidate: RandomRecipeCandidate, mealSlot: MealSlot) {
    if (candidate.mealMoments.includes(mealSlot)) return true;
    return candidate.mealMoments.length === 0 && mealSlot !== "BREAKFAST";
  }

  private randomCandidateSupportsSlotType(candidate: RandomRecipeCandidate, slotType: RecipeSlotType) {
    if (candidate.slotTypes.includes(slotType)) return true;
    if (candidate.slotTypes.length > 0) return false;
    if (slotType === "MEAT") return candidate.mainProteinType !== null && candidate.mainProteinType !== "NONE";
    if (slotType === "VEGETABLE") return candidate.mainProteinType === null || candidate.mainProteinType === "NONE";
    return false;
  }

  private scoreRandomCandidate(
    candidate: RandomRecipeCandidate,
    slotType: RecipeSlotType,
    existingProteinTypes: Set<RecipeProteinType>,
    inventoryFacts: RandomInventoryFacts,
    useFridgeFirst: boolean
  ) {
    let score = Math.random();
    const fridgeFit = this.computeRandomFridgeFit(candidate.content, inventoryFacts);
    if (useFridgeFirst) {
      score += fridgeFit === "HIGH" ? 4 : fridgeFit === "MEDIUM" ? 2 : fridgeFit === "LOW" ? 1 : 0;
    }
    if (slotType === "MEAT" && candidate.mainProteinType && candidate.mainProteinType !== "NONE") {
      score += existingProteinTypes.has(candidate.mainProteinType) ? -2 : 2;
    }
    if (candidate.content.duration === "WITHIN_15") score += 0.5;
    return score;
  }

  private toRandomMenuItem(seed: RandomRecipeSlotSeed, candidate: RandomRecipeCandidate, inventoryFacts: RandomInventoryFacts): RandomMenuItem {
    return {
      slotId: seed.slotId,
      slotType: seed.slotType,
      slotIndex: seed.slotIndex,
      recipeId: candidate.recipeId,
      recipeVersionId: candidate.recipeVersionId,
      title: candidate.title,
      coverUrl: candidate.coverUrl,
      servings: candidate.content.baseServings ?? null,
      duration: candidate.content.duration as RecipeDuration | null,
      durationText: recipeDurationText((candidate.content.duration ?? null) as RecipeDuration | null),
      estimatedCalories: candidate.content.estimatedCalories ?? null,
      flavorTags: candidate.flavorTags,
      mainProteinType: candidate.mainProteinType,
      fridgeFit: this.computeRandomFridgeFit(candidate.content, inventoryFacts)
    };
  }

  private computeRandomFridgeFit(content: RecipeContentSnapshot, inventoryFacts: RandomInventoryFacts): "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" {
    const ingredientIds = content.ingredients
      .map(ingredient => ingredient.ingredientId ?? null)
      .filter((item): item is UUID => typeof item === "number" && item > 0);
    if (!ingredientIds.length) return "UNKNOWN";
    const matched = ingredientIds.filter(item => inventoryFacts.fridgeIngredientIds.has(item)).length;
    if (matched === 0) return "LOW";
    if (matched === ingredientIds.length) return "HIGH";
    if (matched > 0) return "MEDIUM";
    return "LOW";
  }

  private buildRandomMenuWarnings(expectedCount: number, actualCount: number, missingSlotTypes: RecipeSlotType[]): RandomMenuWarning[] {
    if (actualCount >= expectedCount || missingSlotTypes.length === 0) return [];
    const uniqueSlotTypes = Array.from(new Set(missingSlotTypes));
    return [
      {
        code: "INSUFFICIENT_CANDIDATES",
        message: "当前条件下能选的菜不多，已按现有菜谱尽量推荐",
        slotTypes: uniqueSlotTypes
      },
      {
        code: "PARTIAL_MENU",
        message: "本次只生成了部分菜单，你可以放宽限制后再试",
        slotTypes: uniqueSlotTypes
      }
    ];
  }

  private buildGapDecisionKey(slotId: string, ingredientId: UUID | null, ingredientName: string) {
    return `${slotId}:${ingredientId ?? 0}:${normalizeNameKey(ingredientName)}`;
  }

  private buildRandomGapIngredient(
    slotId: string,
    ingredient: RecipeContentSnapshot["ingredients"][number],
    inventoryFacts: RandomInventoryFacts,
    decisionMap: Map<string, "HAS" | "MISSING">
  ): RandomGapIngredient | null {
    const ingredientId = ((ingredient.ingredientId ?? null) as UUID | null) ?? null;
    const decisionKey = this.buildGapDecisionKey(slotId, ingredientId, ingredient.ingredientName);
    const manualDecision = decisionMap.get(decisionKey);
    const hasInventory =
      ingredientId !== null && inventoryFacts.fridgeIngredientIds.has(ingredientId);

    if (manualDecision === "HAS" || hasInventory) {
      return null;
    }

    const inventoryStatus =
      manualDecision === "MISSING"
        ? "MISSING"
        : ingredientId === null
          ? "UNKNOWN"
          : "MISSING";

    return {
      decisionKey,
      ingredientId,
      ingredientName: ingredient.ingredientName,
      quantityText: ingredient.amount ? this.formatGapAmount(ingredient.amount) : null,
      inventoryStatus,
      purchasable: true
    };
  }

  private formatGapAmount(amount: RecipeContentSnapshot["ingredients"][number]["amount"]) {
    if (amount.kind === "FUZZY") return amount.text;
    return `${amount.quantity}${amount.unitName}`;
  }

  private resolveRandomTagSnapshot(
    tags: Array<{
      id: number;
      tagCode: string;
      tagValue: string;
      source: string;
      sortOrder: number | null;
    }>,
    content: RecipeContentSnapshot
  ): RandomTagSnapshot | null {
    if (!tags.length) return null;
    const byCode = new Map<string, Array<{ id: number; tagValue: string; source: string; sortOrder: number | null }>>();
    for (const tag of tags) {
      const bucket = byCode.get(tag.tagCode) ?? [];
      bucket.push(tag);
      byCode.set(tag.tagCode, bucket);
    }

    const mealMoments = pickPreferredTagValues(byCode.get("MEAL_TYPE") ?? [], true).filter(
      (item): item is MealSlot =>
        item === "BREAKFAST" ||
        item === "LUNCH" ||
        item === "AFTERNOON_TEA" ||
        item === "DINNER" ||
        item === "LATE_NIGHT"
    );
    const dishRoles = pickPreferredTagValues(byCode.get("DISH_ROLE") ?? [], true);
    const mainProteinTypeValue = pickPreferredTagValues(byCode.get("MAIN_PROTEIN_TYPE") ?? [], false)[0] ?? null;
    const mainProteinType =
      mainProteinTypeValue &&
      ["PORK", "CHICKEN", "BEEF", "LAMB", "DUCK", "FISH", "NONE"].includes(mainProteinTypeValue)
        ? (mainProteinTypeValue as RecipeProteinType)
        : null;
    const flavorTags = pickPreferredTagValues(byCode.get("FLAVOR_PROFILE") ?? [], true);
    const spiceLevel = pickPreferredTagValues(byCode.get("SPICE_LEVEL") ?? [], false)[0] ?? null;
    if (spiceLevel === "NONE" && !flavorTags.includes("NOT_SPICY")) flavorTags.push("NOT_SPICY");
    if (spiceLevel === "MILD" && !flavorTags.includes("MILD")) flavorTags.push("MILD");

    const primaryIngredientIds = pickPreferredTagValues(byCode.get("PRIMARY_INGREDIENT") ?? [], true)
      .map(item => Number(item))
      .filter((item): item is UUID => Number.isInteger(item) && item > 0);

    if (!mealMoments.length || !dishRoles.length) return null;

    return {
      mealMoments,
      slotTypes: mapDishRolesToLegacySlotTypes(dishRoles, mealMoments, content, mainProteinType),
      flavorTags,
      mainProteinType,
      primaryIngredientIds
    };
  }

  private async resolveConfirmedPollMenus(
    tx: Prisma.TransactionClient,
    pollId: UUID,
    recipeVersionIds: UUID[]
  ): Promise<ResolvedMenuVersion[]> {
    if (!recipeVersionIds.length) {
      throw new BadRequestException("最终菜单不能为空");
    }

    const candidates = await tx.mealPollCandidate.findMany({
      where: {
        pollId,
        sourceType: "RECIPE",
        status: "ACTIVE",
        recipeVersionId: {
          in: recipeVersionIds
        }
      },
      select: {
        recipeVersionId: true
      }
    });
    const allowedVersionIds = new Set(
      candidates
        .map(item => item.recipeVersionId)
        .filter((item): item is UUID => typeof item === "number" && item > 0)
    );
    if (allowedVersionIds.size !== recipeVersionIds.length) {
      throw new BadRequestException("最终菜单只能从当前征集的正式候选菜中确认");
    }

    return this.resolveMenuVersions(tx, recipeVersionIds);
  }

  private async requireOwnedRecipe(tx: Prisma.TransactionClient, userId: UUID, recipeId: UUID) {
    const recipe = await tx.recipe.findUnique({
      where: { id: recipeId },
      include: {
        currentVersion: true
      }
    });
    if (!recipe || recipe.ownerId !== userId || recipe.status !== "ACTIVE") {
      throw new NotFoundException("菜谱不存在");
    }
    return recipe;
  }

  private async replaceMealPlanDishes(
    tx: Prisma.TransactionClient,
    planItemId: UUID,
    menuItems: Array<PlanMenuItemInput | ResolvedMenuVersion>
  ) {
    const normalizedItems = menuItems.map((item, index) =>
      "menu" in item
        ? item
        : {
            slotType: null,
            sortOrder: index,
            purchaseState: "READY" as const,
            menu: item
          }
    );
    await tx.mealPlanDish.deleteMany({
      where: { planItemId }
    });
    await tx.mealPlanDish.createMany({
      data: normalizedItems.map(item => ({
        planItemId,
        recipeId: item.menu.recipeId,
        recipeVersionId: item.menu.recipeVersionId,
        slotType: item.slotType,
        purchaseState: item.purchaseState,
        sortOrder: item.sortOrder
      }))
    });
  }

  private async getMealPlanOrThrow(tx: Prisma.TransactionClient, planItemId: UUID) {
    const plan = await tx.mealPlanItem.findUnique({
      where: { id: planItemId },
      include: mealPlanInclude
    });
    if (!plan) throw new NotFoundException("计划不存在");
    return plan;
  }

  private async getOwnedMealPlanOrThrow(db: MealDb, userId: UUID, planItemId: UUID) {
    const plan = await db.mealPlanItem.findUnique({
      where: { id: planItemId },
      include: mealPlanInclude
    });
    if (!plan || plan.userId !== userId) throw new NotFoundException("计划不存在");
    return plan;
  }

  private async requireActiveMembership(db: MealDb, userId: UUID, diningGroupId: UUID) {
    const member = await db.diningGroupMember.findUnique({
      where: {
        diningGroupId_userId: {
          diningGroupId,
          userId
        }
      }
    });
    if (!member || !isActiveMemberStatus(member.status)) {
      throw new NotFoundException("饭搭子不存在");
    }

    const diningGroup = await db.diningGroup.findUnique({
      where: { id: diningGroupId },
      select: { status: true }
    });
    if (!diningGroup || diningGroup.status !== "ACTIVE") {
      throw new NotFoundException("饭搭子不存在");
    }

    return member;
  }

  private async requireManagerMembership(db: MealDb, userId: UUID, diningGroupId: UUID) {
    const member = await this.requireActiveMembership(db, userId, diningGroupId);
    if (!groupManagerRoles.includes(member.role as (typeof groupManagerRoles)[number])) {
      throw new ForbiddenException("无权操作该饭搭子");
    }
    return member;
  }

  private async writeActivity(
    tx: Prisma.TransactionClient,
    params: {
      diningGroupId: UUID;
      kind:
        | "POLL_OPENED"
        | "POLL_VOTED"
        | "POLL_SUGGESTED"
        | "POLL_NOTED"
        | "MENU_CONFIRMED"
        | "COOK_CLAIMED"
        | "BRING_UPDATED"
        | "MEAL_COMPLETED"
        | "MEMORY_CREATED"
        | "MEMBER_JOINED"
        | "INVITE_PENDING";
      state: "PENDING" | "DONE" | "EXPIRED";
      actorUserId: UUID | null;
      title: string;
      detail?: string | null;
      pollId?: UUID | null;
      planItemId?: UUID | null;
      diningEventId?: UUID | null;
      dedupeKey: string;
    }
  ) {
    const payload = {
      kind: params.kind,
      state: params.state,
      actorUserId: params.actorUserId,
      title: params.title,
      detail: normalizeOptionalText(params.detail ?? null),
      pollId: params.pollId ?? null,
      planItemId: params.planItemId ?? null,
      diningEventId: params.diningEventId ?? null
    };
    return tx.diningGroupActivity.upsert({
      where: {
        diningGroupId_dedupeKey: {
          diningGroupId: params.diningGroupId,
          dedupeKey: params.dedupeKey
        }
      },
      create: {
        diningGroupId: params.diningGroupId,
        kind: params.kind,
        state: params.state,
        actorUserId: params.actorUserId,
        title: params.title,
        detail: payload.detail,
        pollId: payload.pollId,
        planItemId: payload.planItemId,
        diningEventId: payload.diningEventId,
        dedupeKey: params.dedupeKey
      },
      update: {
        kind: params.kind,
        state: params.state,
        actorUserId: params.actorUserId,
        title: params.title,
        detail: payload.detail,
        pollId: payload.pollId,
        planItemId: payload.planItemId,
        diningEventId: payload.diningEventId,
        createdAt: new Date()
      }
    });
  }

  private async upsertPollMealPlan(
    tx: Prisma.TransactionClient,
    poll: Prisma.MealPollGetPayload<{}>,
    menus: ResolvedMenuVersion[],
    menuSnapshot: RecipeContentSnapshot
  ) {
    await this.assertStorageWritable(tx, poll.createdByUserId, sizeOfJson(menuSnapshot));
    const existing = await tx.mealPlanItem.findUnique({
      where: {
        userId_planDate_mealSlot: {
          userId: poll.createdByUserId,
          planDate: poll.planDate,
          mealSlot: poll.mealSlot
        }
      },
      include: mealPlanInclude
    });
    if (existing?.status === "COMPLETED") throw new ConflictException("已完成餐次不能再被征集确认覆盖");

    const planItem = existing
      ? await tx.mealPlanItem.update({
          where: { id: existing.id },
          data: {
            menuSnapshot: toJson(menuSnapshot),
            note: poll.note,
            version: { increment: 1 }
          }
        })
      : await tx.mealPlanItem.create({
          data: {
            userId: poll.createdByUserId,
            planDate: poll.planDate,
            mealSlot: poll.mealSlot,
            menuSnapshot: toJson(menuSnapshot),
            note: poll.note
          }
        });

    await this.replaceMealPlanDishes(tx, planItem.id, menus);
    const plan = await this.getMealPlanOrThrow(tx, planItem.id);
    await upsertStorageLedger(tx, poll.createdByUserId, "MEAL", plan.id, sizeOfJson(plan));
    return plan;
  }

  private async upsertPollDiningEvent(
    tx: Prisma.TransactionClient,
    poll: Prisma.MealPollGetPayload<{}>,
    plan: MealPlanRow,
    menus: ResolvedMenuVersion[],
    menuSnapshot: RecipeContentSnapshot,
    scheduledAt: string | null,
    location: string | null
  ) {
    const resolvedScheduledAt = scheduledAt ? parseDateTime(scheduledAt, "开饭时间格式错误") : plan.diningEvent?.scheduledAt ?? buildFallbackScheduledAt(plan.planDate.toISOString().slice(0, 10), plan.mealSlot);
    const shareToken = createShareToken();

    if (plan.diningEvent?.status === "COMPLETED" || plan.diningEvent?.status === "CANCELLED") {
      throw new ConflictException("当前饭局状态不允许被征集确认覆盖");
    }

    const event = plan.diningEvent
      ? await tx.diningEvent.update({
          where: { id: plan.diningEvent.id },
          data: {
            diningGroupId: poll.diningGroupId,
            title: menuSnapshot.name,
            scheduledAt: resolvedScheduledAt,
            location,
            status: "CONFIRMED",
            menuSnapshot: toJson(menuSnapshot),
            shareTokenHash: plan.diningEvent.shareTokenHash ?? hashText(shareToken),
            shareTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            version: { increment: 1 }
          }
        })
      : await tx.diningEvent.create({
          data: {
            userId: poll.createdByUserId,
            mealPlanItemId: plan.id,
            diningGroupId: poll.diningGroupId,
            title: menuSnapshot.name,
            scheduledAt: resolvedScheduledAt,
            location,
            status: "CONFIRMED",
            menuSnapshot: toJson(menuSnapshot),
            shareTokenHash: hashText(shareToken),
            shareTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        });

    await tx.diningEventMenuItem.deleteMany({
      where: { diningEventId: event.id }
    });
    await tx.diningEventMenuItem.createMany({
      data: menus.map((item, index) => ({
        diningEventId: event.id,
        recipeVersionId: item.recipeVersionId,
        title: item.title,
        sortOrder: index
      }))
    });

    await upsertStorageLedger(tx, poll.createdByUserId, "MEAL", event.id, sizeOfJson(event));
    return event;
  }

  private async syncPollParticipants(tx: Prisma.TransactionClient, poll: Prisma.MealPollGetPayload<{}>, eventId: UUID) {
    const members = await tx.diningGroupMember.findMany({
      where: {
        diningGroupId: poll.diningGroupId,
        status: { in: ["ACTIVE", "RESTRICTED"] },
        userId: { not: poll.createdByUserId }
      },
      select: { userId: true }
    });
    const respondedUsers = await tx.mealPollResponse.findMany({
      where: { pollId: poll.id },
      select: { userId: true }
    });
    const respondedUserIds = new Set(respondedUsers.map(item => item.userId));
    const existing = await tx.diningEventParticipant.findMany({
      where: {
        diningEventId: eventId,
        userId: { in: members.map(item => item.userId) }
      }
    });
    const existingMap = new Map(existing.filter(item => item.userId !== null).map(item => [item.userId as UUID, item]));

    for (const member of members) {
      const current = existingMap.get(member.userId);
      const nextAccepted = respondedUserIds.has(member.userId);
      if (!current) {
        const created = await tx.diningEventParticipant.create({
          data: {
            diningEventId: eventId,
            userId: member.userId,
            sourceType: "DINING_GROUP",
            status: nextAccepted ? "ACCEPTED" : "INVITED",
            respondedAt: nextAccepted ? new Date() : null
          }
        });
        await upsertStorageLedger(tx, poll.createdByUserId, "MEAL_GUEST", created.id, sizeOfJson(created));
        continue;
      }

      if (nextAccepted && current.status === "INVITED") {
        await tx.diningEventParticipant.update({
          where: { id: current.id },
          data: {
            status: "ACCEPTED",
            respondedAt: current.respondedAt ?? new Date()
          }
        });
      }
    }
  }

  private async assertStorageWritable(tx: Prisma.TransactionClient, userId: UUID, expectedDeltaBytes: number) {
    const entitlements = await this.entitlementService.resolveForUser(tx, userId);
    const current = await tx.storageLedger.aggregate({
      where: { userId },
      _sum: { usedBytes: true }
    });
    const usedBytes = current._sum.usedBytes ?? 0;
    if (usedBytes > entitlements.storageLimitBytes || usedBytes + expectedDeltaBytes > entitlements.storageLimitBytes) {
      throw new ForbiddenException("当前个人空间不足");
    }
  }
}
