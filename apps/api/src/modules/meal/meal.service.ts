import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type MealSlot } from "@prisma/client";
import { recipeDurationText } from "../../common/display-text";
import { PrismaService } from "../../common/prisma.service";
import { inspirationRecipeWhere } from "../recipe/recipe-inspiration-owner";
import { rateLimitService } from "../../common/rate-limit.service";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { removeStorageLedger, sizeOfJson, upsertStorageLedger } from "../../common/storage-ledger";
import type {
  CheckRandomMenuGapResponse,
  DiningMemorySharePreview,
  DiningMemoryShareSnapshot,
  DiningEventParticipantSummary,
  DiningEventListResponse,
  DiningEventListRole,
  DiningEventListStage,
  DiningEventListStageFilter,
  DiningEventListSummary,
  DiningEventStageCounts,
  DiningEventShareLinkResponse,
  DiningEventSummary,
  DiningEventWishItemSummary,
  MealPlanCookAssistant,
  MealPlanCookAssistantSummary,
  MealPlanCookAssistantTask,
  MealPlanCookAssistantTimelineStep,
  MealPlanDishPurchaseState,
  MealPlanSummary,
  OperationId,
  PageResult,
  RandomGapIngredient,
  RandomGapInventoryDecision,
  RandomGapItem,
  RandomGapSummary,
  RandomMenuItem,
  RandomMenuQuotaResponse,
  RandomMenuResponse,
  RandomMenuWarning,
  RandomRecipeSourceType,
  RandomReplaceConstraint,
  RandomSlotPlan,
  ReplaceRandomMenuCurrentItem,
  ReplaceRandomMenuSlotResponse,
  RecipeAssistantSnapshot,
  RecipeDuration,
  RecipeProteinType,
  RecipeSlotType,
  RecipeContentSnapshot,
  SharePreviewResponse,
  SharePreviewViewerResponse,
  UUID
} from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";
import { buildRecipeAssistantSnapshot, fromJson, toJson, versionAssistantToSnapshot, versionToContent } from "../recipe/recipe-content";
import { UploadService } from "../upload/upload.service";
import { MedalService } from "../user/medal.service";

const diningEventArgs = Prisma.validator<Prisma.DiningEventDefaultArgs>()({
  include: {
    user: { select: { uid: true, nickname: true, avatarUrl: true } },
    mealPlanItem: {
      select: {
        planDate: true,
        mealSlot: true,
        shoppingList: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      }
    },
    shareInvites: {
      where: {
        status: {
          in: ["ACTIVE", "OPENED"]
        }
      },
      select: {
        id: true
      }
    },
    participants: {
      include: {
        user: { select: { uid: true, nickname: true, avatarUrl: true } },
        bringRecipe: true
      }
    },
    wishItems: {
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        recipe: {
          select: {
            coverImageUrl: true
          }
        },
        supports: {
          select: {
            userId: true
          }
        }
      }
    },
    menuItems: {
      include: {
        recipeVersion: {
          include: {
            currentRecipes: {
              select: { id: true, coverImageUrl: true, ownerId: true }
            }
          }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
    }
  }
});

type DiningEventRow = Prisma.DiningEventGetPayload<typeof diningEventArgs> & { note: string | null };

const diningEventListArgs = Prisma.validator<Prisma.DiningEventDefaultArgs>()({
  include: {
    user: { select: { uid: true, nickname: true } },
    mealPlanItem: {
      select: {
        id: true,
        title: true,
        planDate: true,
        mealSlot: true
      }
    },
    participants: {
      select: {
        userId: true,
        status: true,
        bringRecipeId: true
      }
    },
    menuItems: {
      select: {
        title: true
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
    }
  }
});

type DiningEventListRow = Prisma.DiningEventGetPayload<typeof diningEventListArgs>;

type DiningEventMemoryShareRow = Prisma.DiningEventMemoryShareGetPayload<{}>;
type DiningEventShareInviteRow = Prisma.DiningEventShareInviteGetPayload<{
  include: {
    diningEvent: {
      include: {
        user: { select: { nickname: true; avatarUrl: true } };
        mealPlanItem: { select: { planDate: true; mealSlot: true } };
        menuItems: {
          include: {
            recipeVersion: {
              select: {
                name: true,
                currentRecipes: {
                  select: { id: true; ownerId: true };
                };
              };
            };
          };
        };
        participants: {
          include: {
            user: { select: { nickname: true; avatarUrl: true } };
          };
        };
      };
    };
  };
}>;

type MealDb = Prisma.TransactionClient | PrismaService;
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};
type ImageUploadFile = {
  buffer?: Buffer;
  size?: number;
};

const mealPlanArgs = Prisma.validator<Prisma.MealPlanItemDefaultArgs>()({
  include: {
    cookAssistant: true,
    diningEvent: true,
    shoppingList: {
      select: {
        id: true,
        name: true,
        status: true
      }
    },
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
  assistant: RecipeAssistantSnapshot | null;
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
  sourceType: RandomRecipeSourceType;
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

type RandomRecipePick = {
  candidate: RandomRecipeCandidate;
  recommendationReason: string;
};

type RandomInventoryFacts = {
  fridgeIngredientIds: Set<UUID>;
  fridgeIngredientNames: Map<UUID, string>;
};

type RandomTagSnapshot = {
  mealMoments: MealSlot[];
  slotTypes: RecipeSlotType[];
  flavorTags: string[];
  mainProteinType: RecipeProteinType | null;
  primaryIngredientIds: UUID[];
};

const mealAssistantRealtimeFillMissingCountThreshold = 2;
const mealAssistantRealtimeFillMissingRatioThreshold = 0.4;
const randomMenuQuotaWindowDays = 7;
const defaultRandomMenuWeeklyLimit = 21;
const randomMenuEmptyResultLimit = 10;
const randomMenuEmptyResultWindowMs = 60_000;

function randomMenuWeeklyLimit() {
  const configured = Number(process.env.RANDOM_MENU_WEEKLY_LIMIT);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return defaultRandomMenuWeeklyLimit;
}

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

function buildDiningEventSharePath(shareToken: string) {
  return `/pages_share/preview/index?token=${encodeURIComponent(shareToken)}`;
}

function formatShareCountdown(targetAt: Date, now = new Date()) {
  const diff = targetAt.getTime() - now.getTime();
  if (diff <= 0) return null;
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  return `${Math.max(1, minutes)}分钟`;
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

function assertFutureDiningEventTime(value: Date) {
  if (value.getTime() < Date.now()) {
    throw new BadRequestException("饭局时间不能早于当前时间");
  }
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

function normalizeWishSupportAction(value: string) {
  if (value !== "SUPPORT" && value !== "UNSUPPORT") {
    throw new BadRequestException("我想吃操作参数错误");
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

export function confirmedRandomTagValues(
  tags: Array<{ source: string; status: string; tagValue: string; sortOrder: number | null; id: number }>,
  multi: boolean
) {
  const confirmed = tags
    .filter(item => item.status === "CONFIRMED")
    .sort((left, right) => {
      const sortDiff = (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER);
      if (sortDiff !== 0) return sortDiff;
      return left.id - right.id;
    });
  if (!confirmed.length) return [] as string[];
  const values = Array.from(new Set(confirmed.map(item => item.tagValue)));
  if (!multi) {
    return values.length === 1 ? values : [];
  }
  return values;
}

export function shouldConsumeRandomMenuQuota(items: Array<unknown>) {
  return items.length > 0;
}

export function randomMenuEmptyLimitOptions(userId: UUID) {
  return {
    key: `random-menu:empty:${userId}`,
    limit: randomMenuEmptyResultLimit,
    windowMs: randomMenuEmptyResultWindowMs
  };
}

function mapDishRolesToLegacySlotTypes(
  roles: string[],
  mealMoments: MealSlot[],
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
  if (mainProteinType !== null) return ["BREAKFAST_PROTEIN"];
  return ["BREAKFAST_SIDE"];
}

function mealSlotLabel(mealSlot: MealSlot) {
  return mealSlot === "BREAKFAST"
    ? "早餐"
    : mealSlot === "LUNCH"
      ? "午餐"
      : mealSlot === "AFTERNOON_TEA"
        ? "下午茶"
        : mealSlot === "DINNER"
          ? "晚餐"
          : "夜宵";
}

function buildMenuTitle(titles: string[]) {
  if (!titles.length) return "本餐菜单";
  if (titles.length === 1) return titles[0];
  return `${titles[0]}等${titles.length}道菜`;
}

function buildEmptyMenuSnapshot(mealSlot: MealSlot): RecipeContentSnapshot {
  return {
    name: `${mealSlotLabel(mealSlot)}待补充`,
    story: null,
    baseServings: 1,
    difficulty: null,
    duration: null,
    estimatedCalories: null,
    tips: null,
    ingredients: [],
    steps: []
  };
}

function buildMealPlanTitle(mealSlot: MealSlot) {
  return `${mealSlotLabel(mealSlot)}饮食计划`;
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

function parseAssistantDurationText(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;
  let totalMinutes = 0;
  const matches = text.matchAll(/(\d+)\s*(小时|分钟)/g);
  for (const match of matches) {
    const amount = Number(match[1] ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totalMinutes += match[2] === "小时" ? amount * 60 : amount;
  }
  if (totalMinutes === 0 && text.includes("半小时")) {
    totalMinutes = 30;
  }
  return totalMinutes > 0 ? totalMinutes : null;
}

function summarizeAssistantTaskDetail(steps: RecipeAssistantSnapshot["steps"]) {
  return steps
    .map(item => item.detail?.trim() || item.title?.trim() || "")
    .filter(Boolean)
    .join("；");
}

function summarizeAssistantTaskTitle(menuTitle: string, phase: "PREP" | "COOK" | "SERVE", steps: RecipeAssistantSnapshot["steps"]) {
  if (steps.length === 1) {
    const stepTitle = steps[0]?.title?.trim();
    return stepTitle ? `${menuTitle}：${stepTitle}` : menuTitle;
  }
  if (phase === "PREP") return `${menuTitle}：备菜处理`;
  if (phase === "SERVE") return `${menuTitle}：出锅收尾`;
  return `${menuTitle}：主烹调`;
}

function buildDishAssistantTask(
  menuTitle: string,
  phase: "PREP" | "COOK" | "SERVE",
  steps: RecipeAssistantSnapshot["steps"]
): MealPlanCookAssistantTask | null {
  if (!steps.length) return null;
  return {
    title: summarizeAssistantTaskTitle(menuTitle, phase, steps),
    detail: summarizeAssistantTaskDetail(steps) || `按${menuTitle}的当前步骤继续处理。`,
    dishTitles: [menuTitle]
  };
}

function buildDishCookText(menu: ResolvedMenuVersion) {
  if (menu.assistant?.steps.length) {
    return menu.assistant.steps
      .map(item => `${item.title?.trim() || ""} ${item.detail?.trim() || ""}`.trim())
      .filter(Boolean)
      .join(" ");
  }
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
    .map(item => parseAssistantDurationText(item.menu.assistant?.summary.totalDurationText) ?? recipeDurationMinutes(item.menu.content.duration))
    .filter((item): item is NonNullable<ReturnType<typeof recipeDurationMinutes>> => item != null);
  const missingAssistantCount = menuItems.filter(item => !item.menu.assistant?.steps.length).length;
  const unresolvedInfoCount = menuItems.filter(
    item => !item.menu.assistant?.steps.length && (!item.menu.content.steps.length || item.menu.content.duration == null)
  ).length;
  const pendingCount = menuItems.filter(item => item.purchaseState === "PENDING").length;
  const prepAssistantTasks = menuItems
    .map(item =>
      buildDishAssistantTask(
        item.menu.title,
        "PREP",
        item.menu.assistant?.steps.filter(step => step.phase === "PREP") ?? []
      )
    )
    .filter((item): item is MealPlanCookAssistantTask => Boolean(item));
  const serveAssistantTasks = menuItems
    .map(item =>
      buildDishAssistantTask(
        item.menu.title,
        "SERVE",
        item.menu.assistant?.steps.filter(step => step.phase === "SERVE") ?? []
      )
    )
    .filter((item): item is MealPlanCookAssistantTask => Boolean(item));

  if (dishTitles.length) {
    prepTasks.push({
      title: "统一备菜",
      detail: `先把${dishTitles.join("、")}涉及的主要食材洗净、切配，调料、小碗和装盘器具提前摆好。`,
      dishTitles
    });
  }

  if (prepAssistantTasks.length) {
    prepTasks.push(...prepAssistantTasks);
  }

  const marinadeTitles = menuItems
    .filter(item => !item.menu.assistant?.steps.length && containsCookKeyword(buildDishCookText(item.menu), /(腌|腌制|入味)/))
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
      if (item.menu.assistant?.steps.length) return false;
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
  const pushCookStage = (
    stageItems: PlanMenuItemInput[],
    fallbackTitle: string,
    fallbackDetail: (titles: string[]) => string,
    parallelKey: string | null
  ) => {
    if (!stageItems.length) return;
    stageItems.forEach(item => {
      const assistantTask = buildDishAssistantTask(
        item.menu.title,
        "COOK",
        item.menu.assistant?.steps.filter(step => step.phase === "COOK") ?? []
      );
      if (assistantTask) {
        cookTimeline.push({
          order: order++,
          title: assistantTask.title,
          detail: assistantTask.detail,
          dishTitles: assistantTask.dishTitles,
          parallelKey
        });
      }
    });
    const fallbackItems = stageItems.filter(item => !item.menu.assistant?.steps.some(step => step.phase === "COOK"));
    if (!fallbackItems.length) return;
    const titles = fallbackItems.map(item => item.menu.title);
    cookTimeline.push({
      order: order++,
      title: fallbackTitle,
      detail: fallbackDetail(titles),
      dishTitles: titles,
      parallelKey
    });
  };

  pushCookStage(
    grouped.EARLY,
    "先开长耗时菜",
    titles => `优先处理${titles.join("、")}，让它们先进入炖、煮、蒸或焖的阶段，后面可以并行做其他菜。`,
    "LONG_COOK"
  );
  pushCookStage(
    grouped.MID,
    grouped.EARLY.length ? "利用空档处理中段主菜" : "先处理中段主菜",
    titles => `按${titles.join("、")}的顺序完成主烹调，尽量把占灶时间长的步骤集中完成。`,
    grouped.EARLY.length ? "LONG_COOK" : null
  );
  pushCookStage(
    grouped.LATE,
    "最后做快手菜和临出锅菜",
    titles => `把${titles.join("、")}放到后段处理，尽量让蔬菜和快炒菜接近上桌时再完成。`,
    null
  );

  if (serveAssistantTasks.length) {
    serveTasks.push(...serveAssistantTasks);
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
  if (missingAssistantCount > 0) {
    notes.push(`当前有${missingAssistantCount}道菜还没有单菜做饭建议，本次先按原步骤做了保守编排。`);
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

function diningEventCoverRecordKey(eventId: UUID) {
  return `dining-event-cover:${eventId}`;
}

function isMealPlanMenuLocked(plan: Pick<MealPlanRow, "menuLockedAt">) {
  return Boolean(plan.menuLockedAt);
}

function isDiningEventTimeUp(event: Pick<DiningEventRow, "status" | "completedAt" | "scheduledAt">, now = new Date()) {
  if (event.status === "CANCELLED") return false;
  if (event.status === "COMPLETED" || event.completedAt) return true;
  return event.scheduledAt <= now;
}

@Injectable()
export class MealService {
  private readonly logger = new Logger(MealService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService,
    @Inject(UploadService) private readonly uploadService: UploadService,
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

  async listDiningEvents(
    userId: UUID,
    page: number,
    pageSize: number,
    role: DiningEventListRole = "ALL",
    stage: DiningEventListStageFilter = "TODO",
    planDate?: string,
    mealSlot?: string,
    request?: RequestLike
  ): Promise<DiningEventListResponse> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const now = new Date();
    const normalizedRole = role ?? "ALL";
    const normalizedStage = stage ?? "TODO";
    const extraWhere = this.buildDiningEventListExtraWhere(planDate, mealSlot);
    const stageWhere = this.buildDiningEventListWhere(userId, normalizedRole, normalizedStage, now, extraWhere);
    const roleWhere = this.buildDiningEventRoleWhere(userId, normalizedRole);
    const orderDirection = normalizedStage === "DONE" ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;

    const [items, total, todoCount, activeCount, doneCount] = await this.prisma.$transaction([
      this.prisma.diningEvent.findMany({
        where: stageWhere,
        include: diningEventListArgs.include,
        orderBy: [{ scheduledAt: orderDirection }, { id: orderDirection }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.diningEvent.count({ where: stageWhere }),
      this.prisma.diningEvent.count({
        where: this.buildDiningEventStageWhere(roleWhere, userId, normalizedRole, "TODO", now, extraWhere)
      }),
      this.prisma.diningEvent.count({
        where: this.buildDiningEventStageWhere(roleWhere, userId, normalizedRole, "ACTIVE", now, extraWhere)
      }),
      this.prisma.diningEvent.count({
        where: this.buildDiningEventStageWhere(roleWhere, userId, normalizedRole, "DONE", now, extraWhere)
      })
    ]);

    return {
      items: items.map(item => this.toDiningEventListSummary(item, userId, request)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total,
      stageCounts: {
        todoCount,
        activeCount,
        doneCount
      }
    };
  }

  async generateRandomMenu(
    userId: UUID,
    operationId: OperationId,
    mealSlot: string,
    peopleCount: number,
    fridgePreferred: boolean,
    slotPlan?: RandomSlotPlan | null,
    currentItems: ReplaceRandomMenuCurrentItem[] = [],
    rejectedRecipeVersionIds: UUID[] = []
  ): Promise<RandomMenuResponse> {
    return this.prisma.$transaction(async tx => {
      const normalizedMealSlot = normalizeCoreMealSlot(mealSlot);
      const normalizedPeopleCount = this.normalizePeopleCount(peopleCount);
      const normalizedSlotPlan = this.normalizeRandomSlotPlan(normalizedMealSlot, normalizedPeopleCount, slotPlan ?? null);
      const normalizedCurrentItems = currentItems.map(item => ({
        slotId: item.slotId,
        slotType: normalizeRecipeSlotType(item.slotType),
        sourceType: item.sourceType,
        recipeId: item.recipeId,
        recipeVersionId: item.recipeVersionId
      }));
      const requestHash = JSON.stringify({
        mealSlot: normalizedMealSlot,
        peopleCount: normalizedPeopleCount,
        fridgePreferred,
        slotPlan: normalizedSlotPlan,
        currentItems: normalizedCurrentItems,
        rejectedRecipeVersionIds
      });
      const repeated = await getIdempotentResult<RandomMenuResponse>(
        tx,
        operationId,
        "random-menu:generate",
        userId,
        null,
        requestHash
      );
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "random-menu:generate", userId, null, requestHash);

      const [candidates, inventoryFacts, recentRecipeVersionIds] = await Promise.all([
        this.loadRandomRecipeCandidates(userId, tx),
        this.loadRandomInventoryFacts(userId, tx),
        this.loadRecentRandomRecipeVersionIds(userId, tx)
      ]);

      const seeds = this.buildRandomSlotSeeds(normalizedMealSlot, normalizedSlotPlan);
      const sourcePlans = this.buildRandomSourcePlans(seeds);
      const selected = new Set<UUID>(
        [
          ...normalizedCurrentItems.map(item => item.recipeVersionId),
          ...rejectedRecipeVersionIds
        ].filter((item): item is UUID => Number.isInteger(item) && item > 0)
      );
      const items: RandomMenuItem[] = [];
      const missingSlotTypes: RecipeSlotType[] = [];

      for (const seed of seeds) {
        const picked = this.pickRandomRecipeCandidate({
          mealSlot: normalizedMealSlot,
          slotType: seed.slotType,
          candidates,
          excludedVersionIds: selected,
          currentItems: [
            ...normalizedCurrentItems,
            ...items.map(item => ({
              slotId: item.slotId,
              slotType: item.slotType,
              recipeId: item.recipeId,
              recipeVersionId: item.recipeVersionId
            }))
          ],
          inventoryFacts,
          fridgePreferred,
          recentRecipeVersionIds,
          sourcePriority: this.resolveRandomSourcePriority(sourcePlans, seed.slotType),
          replaceConstraints: []
        });
        if (!picked) {
          missingSlotTypes.push(seed.slotType);
          continue;
        }
        const candidate = picked.candidate;
        selected.add(candidate.recipeVersionId);
        this.consumeRandomSourcePlan(sourcePlans, seed.slotType, candidate.sourceType);
        items.push(this.toRandomMenuItem(seed, candidate, inventoryFacts, picked.recommendationReason));
      }
      const quota = shouldConsumeRandomMenuQuota(items)
        ? await this.consumeRandomMenuQuota(tx, userId)
        : await this.assertRandomEmptyResultAllowed(tx, userId);

      const result = {
        mealSlot: normalizedMealSlot,
        peopleCount: normalizedPeopleCount,
        fridgePreferred,
        slotPlan: normalizedSlotPlan,
        items,
        warnings: this.buildRandomMenuWarnings(seeds.length, items.length, missingSlotTypes),
        quota,
        generatedAt: toIsoDate(new Date())
      };
      await completeIdempotentOperation(tx, operationId, "random-menu:generate", userId, null, requestHash, result);
      return result;
    });
  }

  async getRandomMenuQuota(userId: UUID, db: MealDb = this.prisma): Promise<RandomMenuQuotaResponse> {
    const limitCount = randomMenuWeeklyLimit();
    const now = new Date();
    const usage = await db.randomMenuUsage.findUnique({
      where: { userId }
    });
    if (!usage || usage.windowEndsAt <= now) {
      const windowStartedAt = now;
      const windowEndsAt = this.addRandomMenuQuotaWindow(windowStartedAt);
      return {
        limitCount,
        usedCount: 0,
        remainingCount: limitCount,
        windowStartedAt: toIsoDate(windowStartedAt),
        windowEndsAt: toIsoDate(windowEndsAt)
      };
    }
    return this.toRandomMenuQuota(usage, limitCount);
  }

  private async assertRandomEmptyResultAllowed(db: MealDb, userId: UUID): Promise<RandomMenuQuotaResponse> {
    this.logger.warn(`random menu returned no confirmed candidates for user ${userId}`);
    rateLimitService.assertAllowed(randomMenuEmptyLimitOptions(userId));
    return this.getRandomMenuQuota(userId, db);
  }

  private async consumeRandomMenuQuota(db: MealDb, userId: UUID): Promise<RandomMenuQuotaResponse> {
    const limitCount = randomMenuWeeklyLimit();
    const now = new Date();
    const quotaLockKey = BigInt(userId) * 100000n + 2901n;
    await db.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(${quotaLockKey})`;
    await db.$queryRaw`SELECT "id" FROM "random_menu_usages" WHERE "user_id" = ${userId} FOR UPDATE`;
    const current = await db.randomMenuUsage.findUnique({
        where: { userId }
    });
    if (!current || current.windowEndsAt <= now) {
      const created = await db.randomMenuUsage.upsert({
          where: { userId },
          create: {
            userId,
            windowStartedAt: now,
            windowEndsAt: this.addRandomMenuQuotaWindow(now),
            usedCount: 1
          },
          update: {
            windowStartedAt: now,
            windowEndsAt: this.addRandomMenuQuotaWindow(now),
            usedCount: 1,
            version: { increment: 1 }
          }
      });
      return this.toRandomMenuQuota(created, limitCount);
    }
    if (current.usedCount >= limitCount) {
      throw new HttpException("本周随机次数已用完", HttpStatus.TOO_MANY_REQUESTS);
    }
    const updated = await db.randomMenuUsage.update({
        where: { userId },
        data: {
          usedCount: { increment: 1 },
          version: { increment: 1 }
        }
    });
    return this.toRandomMenuQuota(updated, limitCount);
  }

  private addRandomMenuQuotaWindow(startedAt: Date) {
    return new Date(startedAt.getTime() + randomMenuQuotaWindowDays * 24 * 60 * 60 * 1000);
  }

  private toRandomMenuQuota(
    usage: { windowStartedAt: Date; windowEndsAt: Date; usedCount: number },
    limitCount: number
  ): RandomMenuQuotaResponse {
    const usedCount = Math.min(limitCount, Math.max(0, usage.usedCount));
    return {
      limitCount,
      usedCount,
      remainingCount: Math.max(0, limitCount - usedCount),
      windowStartedAt: toIsoDate(usage.windowStartedAt),
      windowEndsAt: toIsoDate(usage.windowEndsAt)
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
      sourceType: item.sourceType,
      recipeId: item.recipeId,
      recipeVersionId: item.recipeVersionId
    }));
    const currentTarget = normalizedCurrentItems.find(item => item.slotId === targetSlotId);
    if (!currentTarget) {
      throw new BadRequestException("目标菜位不存在");
    }
    excludedVersionIds.add(currentTarget.recipeVersionId);

    const [candidates, inventoryFacts, recentRecipeVersionIds] = await Promise.all([
      this.loadRandomRecipeCandidates(userId),
      this.loadRandomInventoryFacts(userId),
      this.loadRecentRandomRecipeVersionIds(userId)
    ]);

    const picked = this.pickRandomRecipeCandidate({
      mealSlot: normalizedMealSlot,
      slotType: normalizedTargetSlotType,
      candidates,
      excludedVersionIds,
      currentItems: normalizedCurrentItems.filter(item => item.slotId !== targetSlotId),
      inventoryFacts,
      fridgePreferred,
      recentRecipeVersionIds,
      sourcePriority: this.resolveReplaceSourcePriority(currentTarget.sourceType),
      replaceConstraints
    });

    if (!picked) {
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
      slot: this.toRandomMenuItem(slotSeed, picked.candidate, inventoryFacts, picked.recommendationReason),
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
          status: "ACTIVE",
          OR: [
            { ownerId: userId },
            inspirationRecipeWhere("ACTIVE")
          ]
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
      canCreatePlan: gapItems.length > 0
    };
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
    title?: string | null,
    note?: string | null
  ) {
    return this.prisma.$transaction(async tx => {
      const slot = normalizeMealSlot(mealSlot);
      const hasTitleInput = title !== undefined;
      const normalizedTitle = hasTitleInput ? normalizeOptionalText(title) : undefined;
      const hasNoteInput = note !== undefined;
      const normalizedNote = hasNoteInput ? normalizeOptionalText(note) : undefined;
      const normalizedPlanDate = parseDateOnly(planDate);
      const normalizedItems = await this.resolvePlanMenuItems(tx, userId, menuItems);
      const requestHash = JSON.stringify({
        planDate,
        mealSlot: slot,
        expectedVersion: expectedVersion ?? null,
        hasTitleInput,
        title: normalizedTitle ?? null,
        hasNoteInput,
        menuItems: normalizedItems.map(item => ({
          slotType: item.slotType,
          sortOrder: item.sortOrder,
          recipeId: item.menu.recipeId,
          recipeVersionId: item.menu.recipeVersionId,
          purchaseState: item.purchaseState
        })),
        note: normalizedNote ?? null
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
      if (existing?.menuLockedAt) {
        throw new ConflictException("菜单已固定，不能再调整");
      }

      const resolvedExpectedVersion = expectedVersion ?? null;

      if (existing && resolvedExpectedVersion == null) {
        throw new ConflictException("计划已存在，请刷新后携带 expectedVersion 重试");
      }
      if (existing && normalizedItems.length === 0) {
        throw new BadRequestException("当前菜单至少保留一道菜");
      }

      const menuSnapshot = normalizedItems.length
        ? buildMenuSnapshot(normalizedItems.map(item => item.menu))
        : buildEmptyMenuSnapshot(slot);
      const draftTitle = normalizedTitle === undefined ? existing?.title?.trim() || buildMealPlanTitle(slot) : normalizedTitle || buildMealPlanTitle(slot);
      const resolvedNote = normalizedNote === undefined ? existing?.note ?? null : normalizedNote;
      await this.assertStorageWritable(tx, userId, sizeOfJson({ planDate, mealSlot: slot, title: draftTitle, menu: menuSnapshot, note: resolvedNote }));

      const resolvedTitle = draftTitle;

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
                title: resolvedTitle,
                menuSnapshot: toJson(menuSnapshot),
                note: resolvedNote,
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
              title: resolvedTitle,
              menuSnapshot: toJson(menuSnapshot),
              note: resolvedNote
            }
          });

      await this.replaceMealPlanDishes(tx, planItem.id, normalizedItems);
      let item = await this.getMealPlanOrThrow(tx, planItem.id);
      await this.syncMealPlanDiningEvent(tx, item, normalizedItems, menuSnapshot);
      item = await this.getMealPlanOrThrow(tx, planItem.id);
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
        if (existing?.menuLockedAt) {
          throw new ConflictException("菜单已固定，不能再调整");
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
          content: this.getEffectiveRecipeContent(recipe),
          assistant: null
        } satisfies ResolvedMenuVersion;

        const existingMenus = existing?.dishes.length
          ? await this.resolveMenuVersions(tx, existing.dishes.map(item => item.recipeVersionId))
          : [];
        const menus = [...existingMenus, nextMenu];
        const menuSnapshot = buildMenuSnapshot(menus);
        await this.assertStorageWritable(
          tx,
          userId,
          sizeOfJson({
            planDate,
            mealSlot: normalizedSlot,
            title: existing?.title?.trim() || buildMealPlanTitle(normalizedSlot),
            menu: menuSnapshot,
            note: existing?.note ?? null
          })
        );

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
                title: buildMealPlanTitle(normalizedSlot),
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

        let item = await this.getMealPlanOrThrow(tx, planItem.id);
        const syncedMenuItems = menus.map((menu, index) => ({
          slotType: index === menus.length - 1 ? normalizedSlotType : existing?.dishes[index]?.slotType ?? null,
          sortOrder: index,
          purchaseState: index === menus.length - 1 ? normalizedPurchaseState : existing?.dishes[index]?.purchaseState ?? "READY",
          menu
        })) satisfies PlanMenuItemInput[];
        await this.syncMealPlanDiningEvent(tx, item, syncedMenuItems, menuSnapshot);
        item = await this.getMealPlanOrThrow(tx, planItem.id);
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

  async confirmMealPlanMenu(
    userId: UUID,
    planItemId: UUID,
    operationId: OperationId,
    expectedVersion: number
  ): Promise<MealPlanSummary> {
    const requestHash = JSON.stringify({ planItemId, expectedVersion });
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<MealPlanSummary>(tx, operationId, "meal-plan:confirm-menu", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "meal-plan:confirm-menu", userId, null, requestHash);

      const plan = await this.getOwnedMealPlanOrThrow(tx, userId, planItemId);
      if (plan.status === "COMPLETED") {
        throw new ConflictException("已完成餐次不能再确认菜单");
      }
      if (!plan.dishes.length) {
        throw new ConflictException("请先添加菜单后再确认");
      }
      if (plan.version !== expectedVersion) {
        throw new ConflictException("计划已被更新，请刷新后重试");
      }

      const shouldLockMenu = !plan.menuLockedAt;
      if (!plan.menuLockedAt) {
        await tx.mealPlanItem.update({
          where: { id: plan.id },
          data: {
            menuLockedAt: new Date(),
            version: { increment: 1 }
          }
        });
      }

      const shouldConfirmEvent = Boolean(
        plan.diningEvent && plan.diningEvent.status !== "COMPLETED" && plan.diningEvent.status !== "CANCELLED"
      );
      if (shouldConfirmEvent && plan.diningEvent) {
        await tx.diningEvent.update({
          where: { id: plan.diningEvent.id },
          data: {
            status: "CONFIRMED",
            version: { increment: 1 }
          }
        });
      }

      const nextPlan = await this.getMealPlanOrThrow(tx, plan.id);
      if (shouldLockMenu) {
        await upsertStorageLedger(tx, userId, "MEAL", nextPlan.id, sizeOfJson(nextPlan));
      }
      if (shouldConfirmEvent && nextPlan.diningEvent) {
        await upsertStorageLedger(tx, userId, "MEAL", nextPlan.diningEvent.id, sizeOfJson(nextPlan.diningEvent));
      }
      const result = this.toMealPlanSummary(nextPlan);
      await completeIdempotentOperation(tx, operationId, "meal-plan:confirm-menu", userId, null, requestHash, result);
      return result;
    });
  }

  async updateMealPlanTitle(
    userId: UUID,
    planItemId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    title?: string | null
  ): Promise<MealPlanSummary> {
    const requestHash = JSON.stringify({
      planItemId,
      expectedVersion,
      title: normalizeOptionalText(title) ?? null
    });

    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<MealPlanSummary>(tx, operationId, "meal-plan:title", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "meal-plan:title", userId, null, requestHash);

      const plan = await this.getOwnedMealPlanOrThrow(tx, userId, planItemId);
      if (plan.status === "COMPLETED") {
        throw new ConflictException("已完成餐次不能修改标题");
      }
      if (plan.version !== expectedVersion) {
        throw new ConflictException("计划已被更新，请刷新后重试");
      }

      const nextTitle = normalizeOptionalText(title) || buildMealPlanTitle(plan.mealSlot);
      const nextPlanValue = {
        title: nextTitle,
        menuSnapshot: plan.menuSnapshot,
        note: plan.note,
        status: plan.status,
        completedAt: plan.completedAt,
        version: plan.version + 1
      };
      await this.assertStorageWritable(tx, userId, Math.max(0, sizeOfJson(nextPlanValue) - sizeOfJson(plan)));

      await tx.mealPlanItem.update({
        where: { id: plan.id },
        data: {
          title: nextTitle,
          version: { increment: 1 }
        }
      });

      if (plan.diningEvent) {
        const nextEvent = await tx.diningEvent.update({
          where: { id: plan.diningEvent.id },
          data: {
            title: nextTitle,
            version: { increment: 1 }
          }
        });
        await upsertStorageLedger(tx, userId, "MEAL", nextEvent.id, sizeOfJson(nextEvent));
      }

      const resultPlan = await this.getMealPlanOrThrow(tx, plan.id);
      await upsertStorageLedger(tx, userId, "MEAL", resultPlan.id, sizeOfJson(resultPlan));
      const result = this.toMealPlanSummary(resultPlan);
      await completeIdempotentOperation(tx, operationId, "meal-plan:title", userId, null, requestHash, result);
      return result;
    });
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
      if (plan.status === "COMPLETED") {
        throw new ConflictException("已完成餐次不能再生成做饭建议");
      }
      if (!plan.dishes.length) {
        throw new ConflictException("请先添加菜单后再生成做饭建议");
      }
      if (plan.cookAssistant && plan.cookAssistant.menuDigest === buildMealPlanMenuDigest(plan)) {
        const result = this.toMealPlanCookAssistant(plan);
        await completeIdempotentOperation(tx, operationId, "meal-plan:cook-assistant", userId, null, requestHash, result);
        return result;
      }

      const tier = await this.entitlementService.getTier(tx, userId);
      if (tier === "FREE") {
        throw new ForbiddenException("开通会员后可生成做饭建议");
      }

      const shouldLockMenu = !plan.menuLockedAt;
      if (!plan.menuLockedAt) {
        await tx.mealPlanItem.update({
          where: { id: plan.id },
          data: {
            menuLockedAt: new Date(),
            version: { increment: 1 }
          }
        });
      }
      const shouldConfirmEvent = Boolean(
        plan.diningEvent &&
          plan.diningEvent.status !== "COMPLETED" &&
          plan.diningEvent.status !== "CANCELLED" &&
          plan.diningEvent.status !== "CONFIRMED"
      );
      if (shouldConfirmEvent && plan.diningEvent) {
        await tx.diningEvent.update({
          where: { id: plan.diningEvent.id },
          data: {
            status: "CONFIRMED",
            version: { increment: 1 }
          }
        });
      }

      const lockedPlan = await this.getMealPlanOrThrow(tx, plan.id);
      if (shouldLockMenu) {
        await upsertStorageLedger(tx, userId, "MEAL", lockedPlan.id, sizeOfJson(lockedPlan));
      }
      if (shouldConfirmEvent && lockedPlan.diningEvent) {
        await upsertStorageLedger(tx, userId, "MEAL", lockedPlan.diningEvent.id, sizeOfJson(lockedPlan.diningEvent));
      }
      if (lockedPlan.cookAssistant && lockedPlan.cookAssistant.menuDigest === buildMealPlanMenuDigest(lockedPlan)) {
        const result = this.toMealPlanCookAssistant(lockedPlan);
        await completeIdempotentOperation(tx, operationId, "meal-plan:cook-assistant", userId, null, requestHash, result);
        return result;
      }

      const currentValue = {
        ...lockedPlan,
        cookAssistant: lockedPlan.cookAssistant
      };
      const menuItems = await this.resolveStoredPlanMenuItems(tx, lockedPlan);
      const fillResult = await this.fillMissingRecipeAssistantsForMealPlan(tx, userId, menuItems);
      const snapshot = buildCookAssistantSnapshot(lockedPlan, fillResult.menuItems);
      if (fillResult.autoGeneratedCount > 0) {
        snapshot.summary.notes.unshift(`已为${fillResult.autoGeneratedCount}道缺少建议的菜实时补齐单菜做饭建议。`);
      } else if (fillResult.blockedByTier && fillResult.missingCount > 0) {
        snapshot.summary.notes.unshift(
          `当前有${fillResult.missingCount}道菜缺少单菜做饭建议；开通会员后可在生成本餐建议时自动补齐，当前先按原步骤保守编排。`
        );
      }
      const nextValue = {
        ...lockedPlan,
        cookAssistant: {
          menuDigest: buildMealPlanMenuDigest(lockedPlan),
          generatedAt: new Date(),
          snapshot
        }
      };
      await this.assertStorageWritable(tx, userId, Math.max(0, sizeOfJson(nextValue) - sizeOfJson(currentValue)));

      await tx.mealPlanCookAssistant.upsert({
        where: { planItemId: lockedPlan.id },
        update: {
          menuDigest: buildMealPlanMenuDigest(lockedPlan),
          snapshot: toJson(snapshot),
          generatedAt: new Date()
        },
        create: {
          planItemId: lockedPlan.id,
          menuDigest: buildMealPlanMenuDigest(lockedPlan),
          snapshot: toJson(snapshot),
          generatedAt: new Date()
        }
      });

      const nextPlan = await this.getMealPlanOrThrow(tx, lockedPlan.id);
      await upsertStorageLedger(tx, userId, "MEAL", nextPlan.id, sizeOfJson(nextPlan));
      const result = this.toMealPlanCookAssistant(nextPlan);
      await completeIdempotentOperation(tx, operationId, "meal-plan:cook-assistant", userId, null, requestHash, result);
      return result;
    });
  }

  private async fillMissingRecipeAssistantsForMealPlan(
    tx: Prisma.TransactionClient,
    userId: UUID,
    menuItems: PlanMenuItemInput[]
  ): Promise<{
    menuItems: PlanMenuItemInput[];
    missingCount: number;
    autoGeneratedCount: number;
    blockedByTier: boolean;
  }> {
    const missingItems = menuItems.filter(item => !item.menu.assistant?.steps.length);
    const missingCount = missingItems.length;
    if (!missingCount) {
      return {
        menuItems,
        missingCount: 0,
        autoGeneratedCount: 0,
        blockedByTier: false
      };
    }

    const missingRatio = menuItems.length > 0 ? missingCount / menuItems.length : 0;
    const shouldFill =
      missingCount >= mealAssistantRealtimeFillMissingCountThreshold ||
      missingRatio > mealAssistantRealtimeFillMissingRatioThreshold;
    if (!shouldFill) {
      return {
        menuItems,
        missingCount,
        autoGeneratedCount: 0,
        blockedByTier: false
      };
    }

    const tier = await this.entitlementService.getTier(tx, userId);
    if (tier === "FREE") {
      return {
        menuItems,
        missingCount,
        autoGeneratedCount: 0,
        blockedByTier: true
      };
    }

    const versionIds = Array.from(new Set(missingItems.map(item => item.menu.recipeVersionId)));
    const generatedByVersionId = new Map<UUID, RecipeAssistantSnapshot>();
    for (const recipeVersionId of versionIds) {
      const menu = missingItems.find(item => item.menu.recipeVersionId === recipeVersionId)?.menu;
      if (!menu) continue;
      const generated = await this.upsertRecipeAssistantSnapshot(tx, recipeVersionId, menu.content);
      generatedByVersionId.set(recipeVersionId, generated);
    }

    return {
      menuItems: menuItems.map(item => ({
        ...item,
        menu: {
          ...item.menu,
          assistant: generatedByVersionId.get(item.menu.recipeVersionId) ?? item.menu.assistant
        }
      })),
      missingCount,
      autoGeneratedCount: generatedByVersionId.size,
      blockedByTier: false
    };
  }

  private async upsertRecipeAssistantSnapshot(
    tx: Prisma.TransactionClient,
    recipeVersionId: UUID,
    content: RecipeContentSnapshot
  ): Promise<RecipeAssistantSnapshot> {
    const existing = await tx.recipeCookAssistant.findUnique({
      where: { recipeVersionId },
      select: {
        generatedAt: true,
        snapshotJson: true
      }
    });
    if (existing) {
      const snapshot = versionAssistantToSnapshot(existing);
      if (snapshot) return snapshot;
    }

    const nextSnapshot = buildRecipeAssistantSnapshot(content);
    const generatedAt = new Date();
    const saved = await tx.recipeCookAssistant.upsert({
      where: { recipeVersionId },
      update: {
        status: "READY",
        snapshotJson: toJson(nextSnapshot),
        generatedAt,
        lastAttemptAt: generatedAt,
        attemptCount: { increment: 1 },
        lastError: null
      },
      create: {
        recipeVersionId,
        status: "READY",
        snapshotJson: toJson(nextSnapshot),
        generatedAt,
        lastAttemptAt: generatedAt,
        attemptCount: 1,
        lastError: null
      },
      select: {
        generatedAt: true,
        snapshotJson: true
      }
    });

    const result = versionAssistantToSnapshot(saved);
    if (!result) {
      throw new ConflictException("单菜做饭建议生成失败，请稍后重试");
    }
    return result;
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

  async createDiningEvent(
    userId: UUID,
    planItemId: UUID,
    operationId: OperationId,
    scheduledAt: string,
    location?: string | null,
    request?: RequestLike
  ) {
    return this.prisma.$transaction(async tx => {
      const plan = await tx.mealPlanItem.findUnique({
        where: { id: planItemId },
        include: mealPlanInclude
      });
      if (!plan || plan.userId !== userId) throw new NotFoundException("计划不存在");
      if (plan.status === "COMPLETED") throw new ConflictException("已完成餐次不能再发起饭局");
      if (plan.diningEvent) throw new ConflictException("该餐次已发起饭局");

      const normalizedLocation = normalizeOptionalText(location);
      const eventRequestHash = `${planItemId}:${scheduledAt}:${normalizedLocation ?? ""}`;
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:create", userId, null, eventRequestHash);
      if (repeated) return repeated;

      await startIdempotentOperation(tx, operationId, "dining-event:create", userId, null, eventRequestHash);
      await this.assertStorageWritable(tx, userId, sizeOfJson({ scheduledAt, location: normalizedLocation, title: plan.title, menu: plan.menuSnapshot }));
      const resolvedScheduledAt = parseDateTime(scheduledAt, "饭局时间格式错误");
      assertFutureDiningEventTime(resolvedScheduledAt);
      const event = await tx.diningEvent.create({
        data: {
          userId,
          mealPlanItemId: plan.id,
          title: plan.title,
          scheduledAt: resolvedScheduledAt,
          location: normalizedLocation,
          status: plan.menuLockedAt ? "CONFIRMED" : "PLANNED",
          menuSnapshot: toJson(plan.menuSnapshot),
          shareTokenHash: null,
          shareTokenExpiresAt: null,
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
      const result = await this.getDiningEvent(userId, event.id, null, tx, request);
      await completeIdempotentOperation(tx, operationId, "dining-event:create", userId, null, eventRequestHash, result);
      return result;
    });
  }

  async createDirectDiningEvent(
    request: RequestLike,
    userId: UUID,
    operationId: OperationId,
    planDate: string,
    mealSlot: string,
    scheduledAt: string,
    location?: string | null
  ) {
    return this.prisma.$transaction(async tx => {
      const slot = normalizeMealSlot(mealSlot);
      const normalizedPlanDate = parseDateOnly(planDate);
      const normalizedLocation = normalizeOptionalText(location);
      const requestHash = `${planDate}:${slot}:${scheduledAt}:${normalizedLocation ?? ""}`;
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:create-direct", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:create-direct", userId, null, requestHash);

      let plan = await tx.mealPlanItem.findUnique({
        where: {
          userId_planDate_mealSlot: {
            userId,
            planDate: normalizedPlanDate,
            mealSlot: slot
          }
        },
        include: mealPlanInclude
      });

      if (plan) {
        await tx.$queryRaw`SELECT "id" FROM "meal_plan_items" WHERE "id" = ${plan.id} FOR UPDATE`;
        plan = await this.getMealPlanOrThrow(tx, plan.id);
      }

      if (plan?.status === "COMPLETED") {
        throw new ConflictException("已完成餐次不能再发起饭局");
      }
      if (plan?.diningEvent) {
        throw new ConflictException("该餐次已发起饭局");
      }

      if (!plan) {
        const emptyMenu = buildEmptyMenuSnapshot(slot);
        await this.assertStorageWritable(
          tx,
          userId,
          sizeOfJson({ planDate, mealSlot: slot, title: buildMealPlanTitle(slot), menu: emptyMenu, note: null })
        );
        plan = await tx.mealPlanItem.create({
          data: {
            userId,
            planDate: normalizedPlanDate,
            mealSlot: slot,
            title: buildMealPlanTitle(slot),
            menuSnapshot: toJson(emptyMenu),
            note: null
          },
          include: mealPlanInclude
        });
        await upsertStorageLedger(tx, userId, "MEAL", plan.id, sizeOfJson(plan));
      }

      await this.assertStorageWritable(tx, userId, sizeOfJson({ scheduledAt, location: normalizedLocation, title: plan.title, menu: plan.menuSnapshot }));
      const resolvedScheduledAt = parseDateTime(scheduledAt, "饭局时间格式错误");
      assertFutureDiningEventTime(resolvedScheduledAt);
      const event = await tx.diningEvent.create({
        data: {
          userId,
          mealPlanItemId: plan.id,
          title: plan.title,
          scheduledAt: resolvedScheduledAt,
          location: normalizedLocation,
          menuSnapshot: toJson(plan.menuSnapshot),
          shareTokenHash: null,
          shareTokenExpiresAt: null,
          ...(plan.dishes.length
            ? {
                menuItems: {
                  create: plan.dishes.map(item => ({
                    recipeVersionId: item.recipeVersionId,
                    title: item.recipeVersion.name,
                    sortOrder: item.sortOrder
                  }))
                }
              }
            : {})
        }
      });

      await upsertStorageLedger(tx, userId, "MEAL", event.id, sizeOfJson(event));
      const result = await this.getDiningEvent(userId, event.id, null, tx, request);
      await completeIdempotentOperation(tx, operationId, "dining-event:create-direct", userId, null, requestHash, result);
      return result;
    });
  }

  async updateDiningEventCover(
    request: RequestLike,
    userId: UUID,
    eventId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    file: ImageUploadFile
  ) {
    let previousStorageKey: string | null = null;
    let uploadedStorageKey: string | null = null;

    try {
      const result = await this.prisma.$transaction(async tx => {
        const requestHash = hashText(`${eventId}:${expectedVersion}:${Math.max(0, file.size ?? 0)}`);
        const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:cover", userId, null, requestHash);
        if (repeated) return repeated;
        await startIdempotentOperation(tx, operationId, "dining-event:cover", userId, null, requestHash);
        await tx.$queryRaw`SELECT "id" FROM "dining_events" WHERE "id" = ${eventId} FOR UPDATE`;

        const current = await tx.diningEvent.findUnique({
          where: { id: eventId },
          select: {
            id: true,
            userId: true,
            version: true,
            coverStorageKey: true
          }
        });
        if (!current || current.userId !== userId) {
          throw new NotFoundException("饭局不存在");
        }
        if (current.version !== expectedVersion) {
          throw new ConflictException("饭局已被更新，请刷新后重试");
        }

        previousStorageKey = current.coverStorageKey ?? null;
        await this.assertStorageWritable(tx, userId, Math.max(0, file.size ?? 0));
        const stored = await this.uploadService.storeDiningEventCover(file, eventId);
        uploadedStorageKey = stored.storageKey;

        await tx.diningEvent.update({
          where: { id: eventId },
          data: {
            coverStorageKey: stored.storageKey,
            coverContentType: stored.contentType,
            version: { increment: 1 }
          }
        });
        await upsertStorageLedger(tx, userId, "MEAL", diningEventCoverRecordKey(eventId), stored.sizeBytes);
        const next = await this.getDiningEvent(userId, eventId, undefined, tx, request);
        await completeIdempotentOperation(tx, operationId, "dining-event:cover", userId, null, requestHash, next);
        return next;
      });

      const staleStorageKeys = previousStorageKey && previousStorageKey !== uploadedStorageKey ? [previousStorageKey] : [];
      if (staleStorageKeys.length) {
        await this.uploadService.removeStorageFiles(staleStorageKeys);
      }
      return result;
    } catch (error) {
      if (uploadedStorageKey) {
        await this.uploadService.removeStorageFiles([uploadedStorageKey]);
      }
      throw error;
    }
  }

  async updateDiningEventSchedule(
    request: RequestLike,
    userId: UUID,
    eventId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    scheduledAt: string,
    location?: string | null
  ): Promise<DiningEventSummary> {
    const normalizedLocation = normalizeOptionalText(location);
    const requestHash = JSON.stringify({ eventId, expectedVersion, scheduledAt, location: normalizedLocation ?? null });
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:schedule", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:schedule", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { id: eventId }
      });
      if (!event || event.userId !== userId) throw new NotFoundException("饭局不存在");
      if (event.status === "CANCELLED" || event.status === "COMPLETED") {
        throw new ConflictException("当前饭局不能再改时间");
      }
      if (event.version !== expectedVersion) {
        throw new ConflictException("饭局已被更新，请刷新后重试");
      }

      const resolvedScheduledAt = parseDateTime(scheduledAt, "饭局时间格式错误");
      assertFutureDiningEventTime(resolvedScheduledAt);
      await tx.diningEvent.update({
        where: { id: eventId },
        data: {
          scheduledAt: resolvedScheduledAt,
          location: normalizedLocation === undefined ? event.location : normalizedLocation,
          version: { increment: 1 }
        }
      });

      const result = await this.getDiningEvent(userId, eventId, undefined, tx, request);
      await completeIdempotentOperation(tx, operationId, "dining-event:schedule", userId, null, requestHash, result);
      return result;
    });
  }

  async updateDiningEventNote(
    request: RequestLike,
    userId: UUID,
    eventId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    note: string | null
  ): Promise<DiningEventSummary> {
    const normalizedNote = normalizeOptionalText(note);
    const requestHash = JSON.stringify({ eventId, expectedVersion, note: normalizedNote ?? null });
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:note", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:note", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { id: eventId }
      });
      if (!event || event.userId !== userId) throw new NotFoundException("饭局不存在");
      if (event.status === "CANCELLED" || event.status === "COMPLETED") {
        throw new ConflictException("当前饭局不能再改备注");
      }
      if (event.version !== expectedVersion) {
        throw new ConflictException("饭局已被更新，请刷新后重试");
      }

      await tx.diningEvent.update({
        where: { id: eventId },
        // Prisma client in the current worktree omits `note` from DiningEventUpdateInput,
        // but the schema and runtime row both include it.
        data: {
          note: normalizedNote,
          version: { increment: 1 }
        } as unknown as Prisma.DiningEventUncheckedUpdateInput
      });

      const result = await this.getDiningEvent(userId, eventId, undefined, tx, request);
      await completeIdempotentOperation(tx, operationId, "dining-event:note", userId, null, requestHash, result);
      return result;
    });
  }

  async createDiningEventShareLink(userId: UUID, eventId: UUID, operationId: OperationId): Promise<DiningEventShareLinkResponse> {
    const requestHash = String(eventId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventShareLinkResponse>(tx, operationId, "dining-event:share-link", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:share-link", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { id: eventId }
      });
      if (!event || event.userId !== userId) throw new NotFoundException("饭局不存在");
      if (event.status === "CANCELLED" || event.status === "COMPLETED") {
        throw new ConflictException("当前饭局不能继续分享邀请");
      }

      const shareToken = createShareToken();
      const now = new Date();
      await tx.diningEventShareInvite.updateMany({
        where: {
          diningEventId: eventId,
          status: { in: ["ACTIVE", "OPENED"] }
        },
        data: {
          status: "REVOKED",
          revokedAt: now
        }
      });
      await tx.diningEventShareInvite.create({
        data: {
          diningEventId: eventId,
          inviterUserId: userId,
          shareTokenHash: hashText(shareToken)
        }
      });

      const result = {
        shareTokenPath: buildDiningEventSharePath(shareToken),
        expiresAt: null
      };
      await completeIdempotentOperation(tx, operationId, "dining-event:share-link", userId, null, requestHash, result);
      return result;
    });
  }

  async disableDiningEventShareLink(
    userId: UUID,
    eventId: UUID,
    operationId: OperationId,
    request?: RequestLike
  ): Promise<DiningEventSummary> {
    const requestHash = String(eventId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:share-link:disable", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:share-link:disable", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { id: eventId }
      });
      if (!event || event.userId !== userId) throw new NotFoundException("饭局不存在");
      if (event.status === "CANCELLED" || event.status === "COMPLETED") {
        throw new ConflictException("当前饭局不能继续调整好友邀请");
      }

      const now = new Date();
      await tx.diningEventShareInvite.updateMany({
        where: {
          diningEventId: eventId,
          status: { in: ["ACTIVE", "OPENED"] }
        },
        data: {
          status: "REVOKED",
          revokedAt: now
        }
      });

      const result = await this.getDiningEvent(userId, eventId, undefined, tx, request);
      await completeIdempotentOperation(tx, operationId, "dining-event:share-link:disable", userId, null, requestHash, result);
      return result;
    });
  }

  async revokeDiningEventParticipantInvite(
    userId: UUID,
    eventId: UUID,
    participantId: UUID,
    operationId: OperationId,
    request?: RequestLike
  ): Promise<DiningEventSummary> {
    const requestHash = `${eventId}:${participantId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:participant:revoke", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:participant:revoke", userId, null, requestHash);

      const participant = await tx.diningEventParticipant.findFirst({
        where: {
          id: participantId,
          diningEventId: eventId
        },
        include: {
          diningEvent: true
        }
      });
      if (!participant || participant.diningEvent.userId !== userId) throw new NotFoundException("邀请记录不存在");
      if (participant.diningEvent.status === "CANCELLED" || participant.diningEvent.status === "COMPLETED") {
        throw new ConflictException("当前饭局不能继续调整邀请");
      }
      if (participant.status !== "INVITED") {
        throw new ConflictException("当前邀请不能撤回");
      }

      const updated = await tx.diningEventParticipant.update({
        where: { id: participant.id },
        data: {
          status: "REMOVED",
          respondedAt: new Date()
        }
      });
      await upsertStorageLedger(tx, participant.diningEvent.userId, "MEAL_GUEST", participant.id, sizeOfJson(updated));
      const result = await this.getDiningEvent(userId, eventId, undefined, tx, request);
      await completeIdempotentOperation(tx, operationId, "dining-event:participant:revoke", userId, null, requestHash, result);
      return result;
    });
  }

  async reinviteDiningEventParticipant(
    userId: UUID,
    eventId: UUID,
    participantId: UUID,
    operationId: OperationId,
    request?: RequestLike
  ): Promise<DiningEventSummary> {
    const requestHash = `${eventId}:${participantId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:participant:reinvite", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:participant:reinvite", userId, null, requestHash);

      const participant = await tx.diningEventParticipant.findFirst({
        where: {
          id: participantId,
          diningEventId: eventId
        },
        include: {
          diningEvent: true
        }
      });
      if (!participant || participant.diningEvent.userId !== userId) throw new NotFoundException("邀请记录不存在");
      if (participant.diningEvent.status === "CANCELLED" || participant.diningEvent.status === "COMPLETED") {
        throw new ConflictException("当前饭局不能继续调整邀请");
      }
      if (!participant.userId || participant.sourceType !== "DINING_GROUP") {
        throw new ConflictException("当前邀请不能再次发送");
      }
      if (participant.status !== "DECLINED" && participant.status !== "REMOVED") {
        throw new ConflictException("当前邀请不能再次发送");
      }

      const updated = await tx.diningEventParticipant.update({
        where: { id: participant.id },
        data: {
          status: "INVITED",
          invitedByUserId: userId,
          respondedAt: null,
          bringRecipeId: null,
          bringVersionId: null
        }
      });
      await upsertStorageLedger(tx, participant.diningEvent.userId, "MEAL_GUEST", participant.id, sizeOfJson(updated));
      const result = await this.getDiningEvent(userId, eventId, undefined, tx, request);
      await completeIdempotentOperation(tx, operationId, "dining-event:participant:reinvite", userId, null, requestHash, result);
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

  async chooseDiningEventWishRecipe(userId: UUID, eventId: UUID, recipeId: UUID, operationId: OperationId) {
    const requestHash = `${eventId}:${recipeId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:wish", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:wish", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { id: eventId }
      });
      if (!event) throw new NotFoundException("饭局不存在");
      if (event.userId === userId) {
        throw new ForbiddenException("主家不用把菜放进我想吃池");
      }
      if (event.status === "CANCELLED" || event.status === "COMPLETED" || event.status === "CONFIRMED") {
        throw new ConflictException("当前饭局状态不能继续提议想吃的菜");
      }

      const participant = await tx.diningEventParticipant.findFirst({
        where: {
          diningEventId: eventId,
          userId
        }
      });
      if (!participant || participant.status === "DECLINED" || participant.status === "REMOVED") {
        throw new ForbiddenException("无权参与这顿饭的我想吃池");
      }

      const recipe = await this.requireOwnedRecipe(tx, userId, recipeId);
      const recipeVersion = await this.resolveRecipeVersion(tx, recipe);
      const existingSupport = await tx.diningEventWishSupport.findFirst({
        where: {
          userId,
          wishItem: {
            diningEventId: eventId,
            recipeVersionId: recipeVersion.id
          }
        }
      });
      if (existingSupport) {
        const result = await this.getDiningEvent(userId, eventId, undefined, tx);
        await completeIdempotentOperation(tx, operationId, "dining-event:wish", userId, null, requestHash, result);
        return result;
      }

      const currentCount = await tx.diningEventWishSupport.count({
        where: {
          userId,
          wishItem: {
            diningEventId: eventId
          }
        }
      });
      if (currentCount >= 3) {
        throw new BadRequestException("我想吃最多先留 3 道菜");
      }

      let wishItem = await tx.diningEventWishItem.findUnique({
        where: {
          diningEventId_recipeVersionId: {
            diningEventId: eventId,
            recipeVersionId: recipeVersion.id
          }
        }
      });

      if (!wishItem) {
        wishItem = await tx.diningEventWishItem.create({
          data: {
            diningEventId: eventId,
            recipeId: recipe.id,
            recipeVersionId: recipeVersion.id,
            suggestedByUserId: userId,
            title: recipe.title
          }
        });
      }

      await tx.diningEventWishSupport.create({
        data: {
          wishItemId: wishItem.id,
          userId
        }
      });

      if (participant.status === "INVITED") {
        await tx.diningEventParticipant.update({
          where: { id: participant.id },
          data: {
            status: "ACCEPTED",
            respondedAt: new Date()
          }
        });
      }

      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:wish", userId, null, requestHash, result);
      return result;
    });
  }

  async updateDiningEventWishSupport(
    userId: UUID,
    eventId: UUID,
    wishItemId: UUID,
    operationId: OperationId,
    action: string
  ) {
    const normalizedAction = normalizeWishSupportAction(action);
    const requestHash = JSON.stringify({ eventId, wishItemId, action: normalizedAction });
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:wish-support", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:wish-support", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { id: eventId }
      });
      if (!event) throw new NotFoundException("饭局不存在");
      if (event.userId === userId) {
        throw new ForbiddenException("主家不用附议我想吃池");
      }
      if (event.status === "CANCELLED" || event.status === "COMPLETED" || event.status === "CONFIRMED") {
        throw new ConflictException("当前饭局状态不能继续调整我想吃池");
      }

      const participant = await tx.diningEventParticipant.findFirst({
        where: {
          diningEventId: eventId,
          userId
        }
      });
      if (!participant || participant.status === "DECLINED" || participant.status === "REMOVED") {
        throw new ForbiddenException("无权参与这顿饭的我想吃池");
      }

      const wishItem = await tx.diningEventWishItem.findUnique({
        where: { id: wishItemId }
      });
      if (!wishItem || wishItem.diningEventId !== eventId) {
        throw new NotFoundException("这道我想吃不存在");
      }

      const support = await tx.diningEventWishSupport.findUnique({
        where: {
          wishItemId_userId: {
            wishItemId,
            userId
          }
        }
      });

      if (normalizedAction === "SUPPORT") {
        if (!support) {
          const currentCount = await tx.diningEventWishSupport.count({
            where: {
              userId,
              wishItem: {
                diningEventId: eventId
              }
            }
          });
          if (currentCount >= 3) {
            throw new BadRequestException("我想吃最多先留 3 道菜");
          }
          await tx.diningEventWishSupport.create({
            data: {
              wishItemId,
              userId
            }
          });
        }
        if (participant.status === "INVITED") {
          await tx.diningEventParticipant.update({
            where: { id: participant.id },
            data: {
              status: "ACCEPTED",
              respondedAt: new Date()
            }
          });
        }
      } else if (support) {
        await tx.diningEventWishSupport.delete({
          where: {
            wishItemId_userId: {
              wishItemId,
              userId
            }
          }
        });
        const remainingCount = await tx.diningEventWishSupport.count({
          where: { wishItemId }
        });
        if (remainingCount === 0) {
          await tx.diningEventWishItem.delete({
            where: { id: wishItemId }
          });
        }
      }

      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:wish-support", userId, null, requestHash, result);
      return result;
    });
  }

  async addDiningEventWishToMenu(userId: UUID, eventId: UUID, wishItemId: UUID, operationId: OperationId) {
    const requestHash = `${eventId}:${wishItemId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:wish-menu", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:wish-menu", userId, null, requestHash);

      const event = await tx.diningEvent.findUnique({
        where: { id: eventId }
      });
      if (!event || event.userId !== userId) throw new NotFoundException("饭局不存在");
      if (event.status === "CANCELLED" || event.status === "COMPLETED" || event.status === "CONFIRMED") {
        throw new ConflictException("当前饭局状态不能继续加菜单");
      }
      if (!event.mealPlanItemId) {
        throw new ConflictException("当前饭局还没有绑定可编辑餐次");
      }

      const wishItem = await tx.diningEventWishItem.findUnique({
        where: { id: wishItemId }
      });
      if (!wishItem || wishItem.diningEventId !== eventId) {
        throw new NotFoundException("这道我想吃不存在");
      }

      const plan = await this.getMealPlanOrThrow(tx, event.mealPlanItemId);
      if (plan.userId !== userId) throw new NotFoundException("计划不存在");
      if (plan.status === "COMPLETED") {
        throw new ConflictException("已完成餐次不能修改");
      }
      if (plan.menuLockedAt) {
        throw new ConflictException("菜单已固定，不能再从我想吃池加入");
      }

      const currentMenus = await this.resolveStoredPlanMenuItems(tx, plan);
      if (currentMenus.some(item => item.menu.recipeVersionId === wishItem.recipeVersionId)) {
        const result = await this.getDiningEvent(userId, eventId, undefined, tx);
        await completeIdempotentOperation(tx, operationId, "dining-event:wish-menu", userId, null, requestHash, result);
        return result;
      }

      const [wishMenu] = await this.resolveMenuVersions(tx, [wishItem.recipeVersionId]);
      if (!wishMenu) {
        throw new BadRequestException("这道我想吃暂时不能加入菜单");
      }

      const nextMenus = [
        ...currentMenus,
        {
          slotType: null,
          sortOrder: currentMenus.length,
          purchaseState: "READY" as const,
          menu: {
            ...wishMenu,
            recipeId: null
          }
        }
      ];
      const menuSnapshot = buildMenuSnapshot(nextMenus.map(item => item.menu));

      await tx.mealPlanItem.update({
        where: { id: plan.id },
        data: {
          menuSnapshot: toJson(menuSnapshot),
          version: { increment: 1 }
        }
      });
      await this.replaceMealPlanDishes(tx, plan.id, nextMenus);
      const nextPlan = await this.getMealPlanOrThrow(tx, plan.id);
      await this.syncMealPlanDiningEvent(tx, nextPlan, nextMenus, menuSnapshot);

      const result = await this.getDiningEvent(userId, eventId, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "dining-event:wish-menu", userId, null, requestHash, result);
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

  async completeDiningEvent(userId: UUID, eventId: UUID, operationId: OperationId) {
    const requestHash = String(eventId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DiningEventSummary>(tx, operationId, "dining-event:complete", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "dining-event:complete", userId, null, requestHash);

      const current = await this.loadDiningEventRow(tx, eventId);
      if (!current || current.userId !== userId) throw new NotFoundException("饭局不存在");
      if (current.status === "COMPLETED") {
        const result = this.toDiningEventSummary(current, userId, null);
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
          shareTokenExpiresAt: new Date(),
          version: { increment: 1 }
        }
      });
      await tx.diningEventShareInvite.updateMany({
        where: {
          diningEventId: current.id,
          status: { in: ["ACTIVE", "OPENED"] }
        },
        data: {
          status: "EXPIRED",
          expiredAt: new Date()
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

        const result = this.toDiningEventSummary(event, userId, null);
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
          if (!isDiningEventTimeUp(event)) {
            throw new ConflictException("只有已到开饭时间的饭局才能生成饭搭子卡");
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
    db: MealDb = this.prisma,
    request?: RequestLike
  ): Promise<DiningEventSummary> {
    const event = await this.loadDiningEventRow(db, eventId);
    if (!event) throw new NotFoundException("饭局不存在");
    const isParticipant = event.participants.some(item => item.userId === userId);
    if (event.userId !== userId && !isParticipant) throw new ForbiddenException("无权查看该饭局");
    return this.toDiningEventSummary(event, userId, shareTokenPath, request);
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
    const invite = await this.loadDiningEventShareInvite(this.prisma, shareTokenHash);
    if (!invite) {
      throw new NotFoundException("分享已失效");
    }
    const now = new Date();
    await this.ensureDiningEventShareInviteActive(this.prisma, invite, now);
    let inviteStatus = invite.status;
    if (invite.status === "ACTIVE") {
      await this.prisma.diningEventShareInvite.update({
        where: { id: invite.id },
        data: {
          status: "OPENED",
          openedAt: invite.openedAt ?? now
        }
      });
      inviteStatus = "OPENED";
    } else if (!invite.openedAt) {
      await this.prisma.diningEventShareInvite.update({
        where: { id: invite.id },
        data: {
          openedAt: now
        }
      });
    }
    const event = invite.diningEvent;
    const organizerName = event.user?.nickname?.trim() || null;
    return {
      organizerText: organizerName ? `${organizerName} 邀请你来吃饭` : "",
      title: event.title,
      eventId: event.id,
      planItemId: event.mealPlanItemId,
      planDate: event.mealPlanItem?.planDate?.toISOString().slice(0, 10) ?? null,
      mealSlot: event.mealPlanItem?.mealSlot ?? null,
      scheduledAt: toIsoDate(event.scheduledAt),
      coverImageUrl:
        event.coverStorageKey && event.coverContentType
          ? this.uploadService.buildDiningEventCoverUrl({}, event.coverStorageKey, event.updatedAt)
          : null,
      organizerName,
      organizerAvatarUrl: event.user?.avatarUrl ?? null,
      inviteStatus: inviteStatus === "ACCEPTED" ? "ACCEPTED" : inviteStatus === "OPENED" ? "OPENED" : "ACTIVE",
      participants: event.participants.slice(0, 5).map(item => ({
        displayName: item.guestName?.trim() || item.user?.nickname?.trim() || null,
        avatarUrl: item.user?.avatarUrl ?? null
      })),
      menuPreview: event.menuItems.slice(0, 4).map(item => {
        const ownerRecipe = item.recipeVersion.currentRecipes.find(recipe => recipe.ownerId === event.userId) ?? null;
        const firstRecipe = item.recipeVersion.currentRecipes[0] ?? null;
        return {
          title: item.title?.trim() || item.recipeVersion.name,
          recipeId: ownerRecipe?.id ?? firstRecipe?.id ?? null,
          recipeKind: ownerRecipe ? "my" : "inspiration"
        };
      }),
      countdownText: formatShareCountdown(event.scheduledAt, now),
      locationHint: event.location ? "地点加入后查看" : null
    };
  }

  async getSharePreviewViewer(userId: UUID, shareToken: string): Promise<SharePreviewViewerResponse> {
    const shareTokenHash = hashText(shareToken);
    const invite = await this.loadDiningEventShareInvite(this.prisma, shareTokenHash);
    if (!invite) {
      throw new NotFoundException("分享已失效");
    }
    await this.ensureDiningEventShareInviteActive(this.prisma, invite, new Date());
    return this.buildSharePreviewViewer(invite, userId);
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

      const invite = await this.loadDiningEventShareInvite(tx, shareTokenHash);
      if (!invite) {
        throw new NotFoundException("分享已失效");
      }
      const now = new Date();
      await this.ensureDiningEventShareInviteActive(tx, invite, now);
      if (invite.acceptedByUserId && invite.acceptedByUserId !== userId) {
        throw new ForbiddenException("这条分享邀请已经被其他账号使用");
      }
      const event = invite.diningEvent;
      if (event.userId === userId) {
        const result = await this.getDiningEvent(userId, event.id, undefined, tx);
        await completeIdempotentOperation(tx, operationId, "share:accept", userId, null, requestHash, result);
        return result;
      }
      await tx.diningEventShareInvite.update({
        where: { id: invite.id },
        data: {
          status: invite.acceptedByUserId === userId ? invite.status : "OPENED",
          openedAt: invite.openedAt ?? now,
          validatedAt: invite.validatedAt ?? now
        }
      });

      const existing = await tx.diningEventParticipant.findFirst({
        where: { diningEventId: event.id, userId }
      });
      if (existing) {
        await tx.diningEventParticipant.update({
          where: { id: existing.id },
          data: {
            invitedByUserId: invite.inviterUserId,
            guestName: normalizedGuestName,
            status: "ACCEPTED",
            respondedAt: now,
            sourceType: "SHARE"
          }
        });
        await tx.diningEventShareInvite.update({
          where: { id: invite.id },
          data: {
            status: "ACCEPTED",
            acceptedByUserId: userId,
            acceptedAt: invite.acceptedAt ?? now
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
          invitedByUserId: invite.inviterUserId,
          guestName: normalizedGuestName,
          sourceType: "SHARE",
          status: "ACCEPTED",
          respondedAt: now
        }
      });
      await tx.diningEventShareInvite.update({
        where: { id: invite.id },
        data: {
          status: "ACCEPTED",
          acceptedByUserId: userId,
          acceptedAt: invite.acceptedAt ?? now
        }
      });
      await upsertStorageLedger(tx, event.userId, "MEAL_GUEST", participant.id, sizeOfJson(participant));
      const result = await this.getDiningEvent(userId, event.id, undefined, tx);
      await completeIdempotentOperation(tx, operationId, "share:accept", userId, null, requestHash, result);
      return result;
    });
  }

  private async loadDiningEventShareInvite(db: MealDb, shareTokenHash: string): Promise<DiningEventShareInviteRow | null> {
    return db.diningEventShareInvite.findUnique({
      where: { shareTokenHash },
      include: {
        diningEvent: {
          include: {
            user: { select: { nickname: true, avatarUrl: true } },
            mealPlanItem: { select: { planDate: true, mealSlot: true } },
            menuItems: {
              include: {
                recipeVersion: {
                  include: {
                    currentRecipes: {
                      select: { id: true, ownerId: true }
                    }
                  }
                }
              }
            },
            participants: {
              where: {
                status: "ACCEPTED"
              },
              include: {
                user: { select: { nickname: true, avatarUrl: true } }
              },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }]
            }
          }
        }
      }
    });
  }

  private buildSharePreviewViewer(invite: DiningEventShareInviteRow, userId: UUID): SharePreviewViewerResponse {
    const event = invite.diningEvent;
    if (event.userId === userId) {
      return {
        action: "VIEW",
        statusHint: "这是你发起的饭局。"
      };
    }

    const acceptedParticipant = event.participants.find(item => item.userId === userId);
    if (acceptedParticipant) {
      return {
        action: "VIEW",
        statusHint: "你已经加入这场饭局了。"
      };
    }

    if (invite.acceptedByUserId && invite.acceptedByUserId !== userId) {
      return {
        action: "BLOCKED",
        statusHint: "这条分享邀请已经被其他账号使用"
      };
    }

    return {
      action: "ACCEPT",
      statusHint: null
    };
  }

  private async ensureDiningEventShareInviteActive(db: MealDb, invite: DiningEventShareInviteRow, now: Date) {
    const event = invite.diningEvent;
    const expired =
      invite.status === "REVOKED" ||
      invite.status === "EXPIRED" ||
      event.status === "COMPLETED" ||
      event.status === "CANCELLED" ||
      (event.shareTokenExpiresAt && event.shareTokenExpiresAt <= now);
    if (!expired) return;
    if (invite.status === "ACTIVE" || invite.status === "OPENED") {
      await db.diningEventShareInvite.update({
        where: { id: invite.id },
        data: {
          status: "EXPIRED",
          expiredAt: invite.expiredAt ?? now
        }
      });
    }
    throw new NotFoundException("分享已失效");
  }

  private async loadDiningEventRow(db: MealDb, eventId: UUID) {
    return db.diningEvent.findUnique({
      where: { id: eventId },
      ...diningEventArgs
    });
  }

  private toMealPlanSummary(item: MealPlanRow): MealPlanSummary {
    return {
      id: item.id,
      planDate: item.planDate.toISOString().slice(0, 10),
      mealSlot: item.mealSlot,
      title: item.title?.trim() || buildMealPlanTitle(item.mealSlot),
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
      menuLocked: isMealPlanMenuLocked(item),
      status: item.status,
      version: item.version,
      completedAt: item.completedAt ? toIsoDate(item.completedAt) : null,
      hasDiningEvent: Boolean(item.diningEvent),
      diningEventId: item.diningEvent?.id ?? null,
      shoppingListId: item.shoppingList?.id ?? null,
      shoppingListName: item.shoppingList?.name ?? null,
      shoppingListStatus: item.shoppingList?.status ?? null,
      createdAt: toIsoDate(item.createdAt)
    };
  }

  private buildDiningEventRoleWhere(userId: UUID, role: DiningEventListRole): Prisma.DiningEventWhereInput {
    if (role === "ORGANIZER") {
      return { userId };
    }
    if (role === "PARTICIPANT") {
      return {
        participants: {
          some: {
            userId
          }
        }
      };
    }
    return {
      OR: [
        { userId },
        {
          participants: {
            some: {
              userId
            }
          }
        }
      ]
    };
  }

  private buildDiningEventTodoWhere(userId: UUID, role: DiningEventListRole, now: Date): Prisma.DiningEventWhereInput {
    const organizerTodo: Prisma.DiningEventWhereInput = {
      userId,
      status: "PLANNED",
      scheduledAt: { gt: now }
    };
    const participantTodo: Prisma.DiningEventWhereInput = {
      scheduledAt: { gt: now },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      participants: {
        some: {
          userId,
          status: "INVITED"
        }
      }
    };
    if (role === "ORGANIZER") return organizerTodo;
    if (role === "PARTICIPANT") return participantTodo;
    return {
      OR: [organizerTodo, participantTodo]
    };
  }

  private buildDiningEventDoneWhere(now: Date): Prisma.DiningEventWhereInput {
    return {
      OR: [
        { status: { in: ["CANCELLED", "COMPLETED"] } },
        { scheduledAt: { lte: now } }
      ]
    };
  }

  private buildDiningEventListExtraWhere(planDate?: string, mealSlot?: string): Prisma.DiningEventWhereInput {
    const normalizedPlanDate = planDate ? parseDateOnly(planDate) : null;
    const normalizedMealSlot = mealSlot ? normalizeMealSlot(mealSlot) : null;
    if (!normalizedPlanDate && !normalizedMealSlot) return {};
    return {
      mealPlanItem: {
        ...(normalizedPlanDate ? { planDate: normalizedPlanDate } : {}),
        ...(normalizedMealSlot ? { mealSlot: normalizedMealSlot } : {})
      }
    };
  }

  private buildDiningEventStageWhere(
    roleWhere: Prisma.DiningEventWhereInput,
    userId: UUID,
    role: DiningEventListRole,
    stage: DiningEventListStageFilter,
    now: Date,
    extraWhere: Prisma.DiningEventWhereInput = {}
  ): Prisma.DiningEventWhereInput {
    const doneWhere = this.buildDiningEventDoneWhere(now);
    const todoWhere = this.buildDiningEventTodoWhere(userId, role, now);
    const clauses = [roleWhere, extraWhere].filter(item => Object.keys(item).length > 0);
    if (stage === "ALL") {
      return clauses.length === 1 ? clauses[0] : { AND: clauses };
    }
    if (stage === "DONE") {
      return {
        AND: [...clauses, doneWhere]
      };
    }
    if (stage === "TODO") {
      return {
        AND: [...clauses, todoWhere]
      };
    }
    return {
      AND: [...clauses, { NOT: doneWhere }, { NOT: todoWhere }]
    };
  }

  private buildDiningEventListWhere(
    userId: UUID,
    role: DiningEventListRole,
    stage: DiningEventListStageFilter,
    now: Date,
    extraWhere: Prisma.DiningEventWhereInput = {}
  ): Prisma.DiningEventWhereInput {
    return this.buildDiningEventStageWhere(this.buildDiningEventRoleWhere(userId, role), userId, role, stage, now, extraWhere);
  }

  private resolveDiningEventListStage(
    event: Pick<DiningEventListRow, "status" | "scheduledAt">,
    role: Exclude<DiningEventListRole, "ALL">,
    participantStatus: DiningEventListSummary["participantStatus"]
  ): DiningEventListStage {
    if (event.status === "CANCELLED" || event.status === "COMPLETED") return "DONE";
    if (event.scheduledAt.getTime() <= Date.now()) return "DONE";
    if (role === "PARTICIPANT" && participantStatus === "INVITED") return "TODO";
    if (role === "ORGANIZER" && event.status === "PLANNED") return "TODO";
    return "ACTIVE";
  }

  private toDiningEventListSummary(event: DiningEventListRow, viewerUserId: UUID, request?: RequestLike): DiningEventListSummary {
    const role: Exclude<DiningEventListRole, "ALL"> = event.userId === viewerUserId ? "ORGANIZER" : "PARTICIPANT";
    const participantStatus = event.participants.find(item => item.userId === viewerUserId)?.status ?? null;
    const menuPreview = event.menuItems.slice(0, 6).map(item => item.title);
    return {
      id: event.id,
      planItemId: event.mealPlanItem?.id ?? null,
      planDate: event.mealPlanItem?.planDate.toISOString().slice(0, 10) ?? null,
      mealSlot: event.mealPlanItem?.mealSlot ?? null,
      title: event.title?.trim() || event.mealPlanItem?.title?.trim() || "这顿饭",
      coverImageUrl:
        event.coverStorageKey && event.coverContentType
          ? this.uploadService.buildDiningEventCoverUrl(request ?? {}, event.coverStorageKey, event.updatedAt)
          : null,
      scheduledAt: toIsoDate(event.scheduledAt),
      status: event.status,
      role,
      stage: this.resolveDiningEventListStage(event, role, participantStatus),
      participantStatus,
      organizerUid: event.user?.uid ?? null,
      organizerName: event.user?.nickname ?? null,
      menuPreview,
      menuCount: event.menuItems.length,
      participantCount: event.participants.length,
      acceptedCount: event.participants.filter(item => item.status === "ACCEPTED").length,
      bringCount: event.participants.filter(item => Boolean(item.bringRecipeId)).length
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

  private toDiningEventSummary(
    event: DiningEventRow,
    viewerUserId: UUID,
    shareTokenPath?: string | null,
    request?: RequestLike
  ): DiningEventSummary {
    const menu = fromJson<RecipeContentSnapshot>(event.menuSnapshot);
    const currentMenuVersionIds = new Set(event.menuItems.map(item => item.recipeVersionId));
    return {
      id: event.id,
      title: event.title,
      scheduledAt: toIsoDate(event.scheduledAt),
      location: event.location,
      note: event.note,
      coverImageUrl:
        event.coverStorageKey && event.coverContentType
          ? this.uploadService.buildDiningEventCoverUrl(request ?? {}, event.coverStorageKey, event.updatedAt)
          : null,
      status: event.status,
      organizerUid: event.user?.uid ?? null,
      organizerName: event.user?.nickname ?? null,
      organizerAvatarUrl: event.user?.avatarUrl ?? null,
      planItemId: event.mealPlanItemId,
      diningGroupId: event.diningGroupId,
      shoppingListId: event.mealPlanItem?.shoppingList?.id ?? null,
      shoppingListName: event.mealPlanItem?.shoppingList?.name ?? null,
      shoppingListStatus: event.mealPlanItem?.shoppingList?.status ?? null,
      menu,
      menuItems: event.menuItems.map(item => ({
        id: item.id,
        recipeId: item.recipeVersion.currentRecipes.find(recipe => recipe.ownerId === event.userId)?.id ?? null,
        recipeVersionId: item.recipeVersionId,
        title: item.title,
        version: item.version
      })),
      wishItems: event.wishItems
        .map(item => ({
          id: item.id,
          title: item.title,
          recipeId: item.recipeId,
          recipeVersionId: item.recipeVersionId,
          coverImageUrl: item.recipe?.coverImageUrl ?? null,
          supportCount: item.supports.length,
          supportedByMe: item.supports.some(support => support.userId === viewerUserId),
          suggestedByMe: item.suggestedByUserId === viewerUserId,
          inCurrentMenu: currentMenuVersionIds.has(item.recipeVersionId)
        }) satisfies DiningEventWishItemSummary)
        .sort((left, right) => {
          if (right.supportCount !== left.supportCount) return right.supportCount - left.supportCount;
          return right.id - left.id;
        }),
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
      hasActiveShareLink: event.shareInvites.length > 0,
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
      coverUrl: item.recipeVersion.currentRecipes[0]?.coverImageUrl ?? null
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
        cookAssistant: true,
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
        content: versionToContent(version),
        assistant: versionAssistantToSnapshot(version.cookAssistant)
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
      const recipe = await tx.recipe.findFirst({
        where: {
          id: item.recipeId,
          status: "ACTIVE",
          OR: [
            { ownerId: userId },
            inspirationRecipeWhere("ACTIVE")
          ]
        },
        include: {
          currentVersion: true
        }
      });
      if (!recipe) {
        throw new NotFoundException("菜谱不存在");
      }
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
          content: this.getEffectiveRecipeContent(recipe),
          assistant: null
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
      soupCount: peopleCount >= 3 ? 1 : 0,
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

  private buildRandomSourcePlans(seeds: RandomRecipeSlotSeed[]) {
    const plans = new Map<RecipeSlotType, Record<RandomRecipeSourceType, number>>();
    const slotTypes = Array.from(new Set(seeds.map(seed => seed.slotType)));
    for (const slotType of slotTypes) {
      const count = seeds.filter(seed => seed.slotType === slotType).length;
      plans.set(slotType, this.allocateRandomSourceCounts(slotType, count));
    }
    return plans;
  }

  private allocateRandomSourceCounts(slotType: RecipeSlotType, count: number): Record<RandomRecipeSourceType, number> {
    const myRatio = this.randomMyRecipeRatio(slotType);
    const raw = {
      MY: count * myRatio,
      INSPIRATION: count * (1 - myRatio)
    };
    const result: Record<RandomRecipeSourceType, number> = {
      MY: Math.floor(raw.MY),
      INSPIRATION: Math.floor(raw.INSPIRATION)
    };
    let remaining = count - result.MY - result.INSPIRATION;
    const order: RandomRecipeSourceType[] = ["MY", "INSPIRATION"];
    order.sort((left, right) => {
      const diff = raw[right] - Math.floor(raw[right]) - (raw[left] - Math.floor(raw[left]));
      if (diff !== 0) return diff;
      return left === "MY" ? -1 : 1;
    });
    for (const sourceType of order) {
      if (remaining <= 0) break;
      result[sourceType] += 1;
      remaining -= 1;
    }
    return result;
  }

  private randomMyRecipeRatio(slotType: RecipeSlotType) {
    if (slotType === "MEAT" || slotType === "BREAKFAST_PROTEIN") return 0.7;
    if (slotType === "STAPLE" || slotType === "BREAKFAST_STAPLE") return 0.6;
    return 0.5;
  }

  private resolveRandomSourcePriority(
    plans: Map<RecipeSlotType, Record<RandomRecipeSourceType, number>>,
    slotType: RecipeSlotType
  ): RandomRecipeSourceType[] {
    const plan = plans.get(slotType);
    if (!plan) return ["MY", "INSPIRATION"];
    return plan.MY > 0 ? ["MY", "INSPIRATION"] : ["INSPIRATION", "MY"];
  }

  private consumeRandomSourcePlan(
    plans: Map<RecipeSlotType, Record<RandomRecipeSourceType, number>>,
    slotType: RecipeSlotType,
    sourceType: RandomRecipeSourceType
  ) {
    const plan = plans.get(slotType);
    if (!plan) return;
    if (plan[sourceType] > 0) {
      plan[sourceType] -= 1;
      return;
    }
    const other = sourceType === "MY" ? "INSPIRATION" : "MY";
    if (plan[other] > 0) plan[other] -= 1;
  }

  private resolveReplaceSourcePriority(sourceType: RandomRecipeSourceType): RandomRecipeSourceType[] {
    return sourceType === "MY" ? ["MY", "INSPIRATION"] : ["INSPIRATION", "MY"];
  }

  private async loadRandomRecipeCandidates(userId: UUID, db: MealDb = this.prisma): Promise<RandomRecipeCandidate[]> {
    const [recipes, profile] = await Promise.all([
      db.recipe.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { ownerId: userId },
            inspirationRecipeWhere("ACTIVE")
          ]
        },
        include: {
          currentVersion: {
            include: {
              versionTags: {
                where: {
                  status: "CONFIRMED"
                }
              }
            }
          }
        }
      }),
      db.userTasteProfile.findUnique({
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
        const tags = this.resolveRandomTagSnapshot(recipe.currentVersion.versionTags);
        if (!tags) return null;
        return {
          recipeId: recipe.id,
          recipeVersionId: recipe.currentVersionId,
          sourceType: recipe.ownerId === userId ? "MY" : "INSPIRATION",
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

  private async loadRandomInventoryFacts(userId: UUID, db: MealDb = this.prisma): Promise<RandomInventoryFacts> {
    const fridgeItems = await db.fridgeItem.findMany({
      where: {
        userId,
        available: true
      },
      select: {
        ingredientId: true,
        name: true
      }
    });
    const fridgeIngredientNames = new Map<UUID, string>();
    for (const item of fridgeItems) {
      if (typeof item.ingredientId === "number" && item.ingredientId > 0 && item.name.trim()) {
        fridgeIngredientNames.set(item.ingredientId, item.name.trim());
      }
    }
    return {
      fridgeIngredientIds: new Set(
        fridgeItems
          .map(item => item.ingredientId)
          .filter((item): item is UUID => typeof item === "number" && item > 0)
      ),
      fridgeIngredientNames
    };
  }

  private async loadRecentRandomRecipeVersionIds(userId: UUID, db: MealDb = this.prisma): Promise<Set<UUID>> {
    const today = new Date();
    const todayOnly = parseDateOnly(today.toISOString().slice(0, 10));
    const since = new Date(todayOnly);
    since.setUTCDate(since.getUTCDate() - 13);
    const rows = await db.mealPlanDish.findMany({
      where: {
        planItem: {
          userId,
          planDate: {
            gte: since,
            lte: todayOnly
          },
          OR: [
            { status: "COMPLETED" },
            { menuLockedAt: { not: null } }
          ]
        }
      },
      select: {
        recipeVersionId: true
      }
    });
    return new Set(rows.map(item => item.recipeVersionId));
  }

  private pickRandomRecipeCandidate(params: {
    mealSlot: MealSlot;
    slotType: RecipeSlotType;
    candidates: RandomRecipeCandidate[];
    excludedVersionIds: Set<UUID>;
    currentItems: Array<{ slotId: string; slotType: RecipeSlotType; recipeId: UUID; recipeVersionId: UUID }>;
    inventoryFacts: RandomInventoryFacts;
    fridgePreferred: boolean;
    recentRecipeVersionIds: Set<UUID>;
    sourcePriority: RandomRecipeSourceType[];
    replaceConstraints: RandomReplaceConstraint[];
  }): RandomRecipePick | null {
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

    for (const sourceType of params.sourcePriority) {
      const scoped = filtered.filter(candidate => candidate.sourceType === sourceType);
      if (scoped.length) {
        return this.pickBestRandomCandidate(scoped, params.slotType, existingProteinTypes, params.inventoryFacts, useFridgeFirst, params.recentRecipeVersionIds);
      }
    }

    return this.pickBestRandomCandidate(filtered, params.slotType, existingProteinTypes, params.inventoryFacts, useFridgeFirst, params.recentRecipeVersionIds);
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

  private pickBestRandomCandidate(
    candidates: RandomRecipeCandidate[],
    slotType: RecipeSlotType,
    existingProteinTypes: Set<RecipeProteinType>,
    inventoryFacts: RandomInventoryFacts,
    useFridgeFirst: boolean,
    recentRecipeVersionIds: Set<UUID>
  ): RandomRecipePick | null {
    const scored = candidates
      .map(candidate => ({
        candidate,
        ...this.scoreRandomCandidate(candidate, slotType, existingProteinTypes, inventoryFacts, useFridgeFirst, recentRecipeVersionIds),
        tieBreaker: Math.random()
      }))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return right.tieBreaker - left.tieBreaker;
      });
    const scoped = scored.slice(0, Math.min(scored.length, 5));
    const lowestScore = scoped.at(-1)?.score ?? 0;
    const totalWeight = scoped.reduce((sum, item) => sum + Math.max(1, item.score - lowestScore + 1), 0);
    let cursor = Math.random() * totalWeight;
    for (const item of scoped) {
      cursor -= Math.max(1, item.score - lowestScore + 1);
      if (cursor <= 0) {
        return {
          candidate: item.candidate,
          recommendationReason: item.recommendationReason
        };
      }
    }
    const fallback = scoped[0];
    return fallback
      ? {
          candidate: fallback.candidate,
          recommendationReason: fallback.recommendationReason
        }
      : null;
  }

  private scoreRandomCandidate(
    candidate: RandomRecipeCandidate,
    slotType: RecipeSlotType,
    existingProteinTypes: Set<RecipeProteinType>,
    inventoryFacts: RandomInventoryFacts,
    useFridgeFirst: boolean,
    recentRecipeVersionIds: Set<UUID>
  ) {
    let score = Math.random();
    const fridgeFit = this.computeRandomFridgeFit(candidate.content, inventoryFacts);
    score += fridgeFit === "HIGH" ? 40 : fridgeFit === "MEDIUM" ? 24 : fridgeFit === "LOW" ? 8 : 0;
    if (useFridgeFirst) {
      score += fridgeFit === "HIGH" ? 20 : fridgeFit === "MEDIUM" ? 12 : fridgeFit === "LOW" ? 4 : 0;
    }
    const notRecentlyEaten = !recentRecipeVersionIds.has(candidate.recipeVersionId);
    score += notRecentlyEaten ? 12 : -18;
    const proteinComplementary =
      slotType === "MEAT" &&
      Boolean(candidate.mainProteinType) &&
      candidate.mainProteinType !== "NONE" &&
      !existingProteinTypes.has(candidate.mainProteinType as RecipeProteinType);
    if (slotType === "MEAT" && candidate.mainProteinType && candidate.mainProteinType !== "NONE") {
      score += proteinComplementary ? 8 : -8;
    }
    const quick = candidate.content.duration === "WITHIN_15";
    if (quick) score += 2;
    return {
      score,
      recommendationReason: this.resolveRandomRecommendationReason({
        fridgeFit,
        notRecentlyEaten,
        proteinComplementary,
        quick
      })
    };
  }

  private resolveRandomRecommendationReason(input: {
    fridgeFit: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    notRecentlyEaten: boolean;
    proteinComplementary: boolean;
    quick: boolean;
  }) {
    if (input.fridgeFit === "HIGH" || input.fridgeFit === "MEDIUM") return "冰箱里有";
    if (input.notRecentlyEaten) return "最近没吃";
    if (input.proteinComplementary) return "搭配互补";
    if (input.quick) return "做起来快";
    return "推荐尝试";
  }

  private toRandomMenuItem(
    seed: RandomRecipeSlotSeed,
    candidate: RandomRecipeCandidate,
    inventoryFacts: RandomInventoryFacts,
    recommendationReason: string
  ): RandomMenuItem {
    return {
      slotId: seed.slotId,
      slotType: seed.slotType,
      slotIndex: seed.slotIndex,
      sourceType: candidate.sourceType,
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
      fridgeFit: this.computeRandomFridgeFit(candidate.content, inventoryFacts),
      matchedIngredients: this.resolveRandomMatchedIngredients(candidate.content, inventoryFacts),
      recommendationReason
    };
  }

  private resolveRandomMatchedIngredients(content: RecipeContentSnapshot, inventoryFacts: RandomInventoryFacts): string[] {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const ingredient of content.ingredients) {
      const ingredientId = ingredient.ingredientId ?? null;
      if (typeof ingredientId !== "number" || !inventoryFacts.fridgeIngredientIds.has(ingredientId)) continue;
      const name = (inventoryFacts.fridgeIngredientNames.get(ingredientId) ?? ingredient.ingredientName).trim();
      const key = normalizeNameKey(name);
      if (!name || seen.has(key)) continue;
      names.push(name);
      seen.add(key);
    }
    return names;
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
      status: string;
      sortOrder: number | null;
    }>
  ): RandomTagSnapshot | null {
    if (!tags.length) return null;
    const byCode = new Map<string, Array<{ id: number; tagValue: string; source: string; status: string; sortOrder: number | null }>>();
    for (const tag of tags) {
      const bucket = byCode.get(tag.tagCode) ?? [];
      bucket.push(tag);
      byCode.set(tag.tagCode, bucket);
    }

    const mealMoments = confirmedRandomTagValues(byCode.get("MEAL_TYPE") ?? [], true).filter(
      (item): item is MealSlot =>
        item === "BREAKFAST" ||
        item === "LUNCH" ||
        item === "AFTERNOON_TEA" ||
        item === "DINNER" ||
        item === "LATE_NIGHT"
    );
    const dishRoles = confirmedRandomTagValues(byCode.get("DISH_ROLE") ?? [], true);
    const mainProteinTypeValue = confirmedRandomTagValues(byCode.get("MAIN_PROTEIN_TYPE") ?? [], false)[0] ?? null;
    const mainProteinType =
      mainProteinTypeValue &&
      ["PORK", "CHICKEN", "BEEF", "LAMB", "DUCK", "FISH", "NONE"].includes(mainProteinTypeValue)
        ? (mainProteinTypeValue as RecipeProteinType)
        : null;
    const flavorTags = confirmedRandomTagValues(byCode.get("FLAVOR_PROFILE") ?? [], true);
    const spiceLevel = confirmedRandomTagValues(byCode.get("SPICE_LEVEL") ?? [], false)[0] ?? null;
    if (spiceLevel === "NONE" && !flavorTags.includes("NOT_SPICY")) flavorTags.push("NOT_SPICY");
    if (spiceLevel === "MILD" && !flavorTags.includes("MILD")) flavorTags.push("MILD");

    const primaryIngredientIds = confirmedRandomTagValues(byCode.get("PRIMARY_INGREDIENT") ?? [], true)
      .map(item => Number(item))
      .filter((item): item is UUID => Number.isInteger(item) && item > 0);

    if (!mealMoments.length || !dishRoles.length) return null;

    return {
      mealMoments,
      slotTypes: mapDishRolesToLegacySlotTypes(dishRoles, mealMoments, mainProteinType),
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

  private async syncMealPlanDiningEvent(
    tx: Prisma.TransactionClient,
    plan: MealPlanRow,
    menuItems: PlanMenuItemInput[],
    menuSnapshot: RecipeContentSnapshot
  ) {
    if (!plan.diningEvent) return;
    if (plan.diningEvent.status === "COMPLETED" || plan.diningEvent.status === "CANCELLED") return;

    await tx.diningEvent.update({
      where: { id: plan.diningEvent.id },
      data: {
        title: plan.title,
        menuSnapshot: toJson(menuSnapshot),
        version: { increment: 1 }
      }
    });
    await tx.diningEventMenuItem.deleteMany({
      where: { diningEventId: plan.diningEvent.id }
    });
    await tx.diningEventMenuItem.createMany({
      data: menuItems.map((item, index) => ({
        diningEventId: plan.diningEvent?.id as UUID,
        recipeVersionId: item.menu.recipeVersionId,
        title: item.menu.title,
        sortOrder: index
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
