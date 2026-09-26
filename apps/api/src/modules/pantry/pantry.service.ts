import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma, type ShoppingSourceType } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { policy } from "../../config/policy";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { removeStorageLedger, sizeOfJson, upsertStorageLedger } from "../../common/storage-ledger";
import type {
  CookingTraceResponse,
  ShoppingListCollaborator,
  ShoppingListInviteActionResponse,
  ShoppingListInviteFilter,
  ShoppingListInvitePageResponse,
  ShoppingListInviteStatus,
  ShoppingListInviteSummary,
  ShoppingListDetail,
  ShoppingListDetailItem,
  ShoppingListItemPatchResponse,
  ShoppingListPageResponse,
  ShoppingListStatusCount,
  ShoppingListSummary,
  ShoppingListSummaryResponse,
  ShareShoppingListLinkResponse,
  ShoppingSharePreview,
  ShoppingItemSourceSummary,
  OperationId,
  PageResult,
  RecipeContentSnapshot,
  ShoppingGapResponse,
  ShoppingGapPreviewItem,
  ShoppingGapWindow,
  FridgeTraceIngredientSummary,
  FridgeTraceSummary,
  FridgeTraceSummaryResponse,
  UUID
} from "../../contracts/types";
import {
  buildShoppingDemandFactKey,
  buildShoppingDemandLines,
  parseShoppingSourceId,
  type ShoppingDemandSource
} from "./pantry.shopping-demand";
import { EntitlementService } from "../entitlement/entitlement.service";
import { formatRecipeAmount, fromJson, versionToContent } from "../recipe/recipe-content";
import { isPublicInspirationRecipe } from "../recipe/public-content-user-pool";
import { IngredientImageService } from "../admin/ingredient-image.service";
import { WechatSubscribeService } from "../wechat/wechat-subscribe.service";
import { fridgeTraceLabel, fridgeTraceWindowDays, type FridgeTraceKind } from "./pantry.fridge-trace";

function toIsoDate(value: Date) {
  return value.toISOString();
}

function toPositiveInt(value: number | string | undefined, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function toListItemStatus(value: "OPEN" | "BOUGHT" | "DELETED"): "OPEN" | "CHECKED" | "REMOVED" {
  if (value === "BOUGHT") return "CHECKED";
  if (value === "DELETED") return "REMOVED";
  return "OPEN";
}

function normalizeShoppingListInviteFilter(value: string | undefined): ShoppingListInviteFilter {
  if (!value) return "PENDING";
  if (value === "ALL" || value === "PENDING" || value === "RESOLVED") return value;
  throw new BadRequestException("邀请筛选参数错误");
}

function addDays(base: Date, days: number) {
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function normalizeNameKey(value: string) {
  return value.trim().toLowerCase();
}

const gapWindowMeta: Record<ShoppingGapWindow, { title: string; description: string }> = {
  NEXT_48_HOURS: {
    title: "未来 48 小时",
    description: "先把最近这两顿到几顿要做的食材补齐，避免临做前缺料。"
  },
  NEXT_7_DAYS: {
    title: "3 到 7 天",
    description: "这周后半段会用到的食材先记着，需要时再一起补买。"
  },
  LATER: {
    title: "7 天后",
    description: "更后面的安排先收起，不打扰最近做饭。"
  }
};

function resolveGapWindow(scheduledAt: Date, now: Date): ShoppingGapWindow | null {
  const diffMs = scheduledAt.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  if (diffMs <= 48 * 60 * 60 * 1000) return "NEXT_48_HOURS";
  if (diffMs <= 7 * 24 * 60 * 60 * 1000) return "NEXT_7_DAYS";
  return "LATER";
}

type GapEvent = {
  id: UUID;
  title: string;
  scheduledAt: Date;
  updatedAt: Date;
  menuItems: Array<{
    title: string;
    recipeId?: UUID | null;
    recipeVersionId: UUID;
    baseServings?: number;
    recipeVersion: {
      ingredientsJson: Prisma.JsonValue;
      baseServings?: number;
    };
  }>;
};

type EventGapSummaryItem = ShoppingGapPreviewItem & {
  sourceKey: string;
  ingredientId: UUID | null;
  amountJson: Prisma.InputJsonValue | null;
  sourceRecipeId: UUID | null;
  sourceRecipeVersionId: UUID | null;
  sourceRecipeTitle: string | null;
  sourceBaseServings: number | null;
  sourceIngredientSort: number | null;
  sourceBatchKey?: string | null;
  sourceFacts?: ShoppingDemandSource[];
};

type RecipeShoppingSource = {
  recipeId: UUID;
  sourceVersionId: UUID;
  title: string;
  baseServings: number;
  ingredients: RecipeContentSnapshot["ingredients"];
};

type PlanShoppingGapSyncResult = {
  listId: UUID | null;
  createdCount: number;
  pendingCount: number;
};

type ShoppingListProgressRow = {
  ingredientId: UUID | null;
  name: string;
  status: "OPEN" | "BOUGHT" | "DELETED";
};

type PendingShoppingGroupCountRow = {
  pendingCount: number;
};

type ShoppingSourceMeta = {
  planMap: Map<UUID, { title: string; planDate: string }>;
  eventMap: Map<UUID, { title: string; planItemId: UUID | null; planDate: string | null }>;
  recipeMap: Map<UUID, "my" | "inspiration">;
};

type EntitlementReader = Pick<Prisma.TransactionClient, "entitlementGrant" | "diningGroupMember" | "diningGroup">;

const recipeSourceType = "RECIPE" as ShoppingSourceType;
const planSourceType = "PLAN" as ShoppingSourceType;

const shoppingDetailItemSelect = {
  id: true,
  ingredientId: true,
  name: true,
  quantityText: true,
  note: true,
  status: true,
  checkedAt: true,
  updatedAt: true,
  sourceType: true,
  sourceKey: true,
  sourceRecipeId: true,
  sourceRecipeVersionId: true,
  sourceRecipeTitle: true,
  sourceBaseServings: true,
  sourceBatchKey: true,
  amountJson: true,
  ingredient: {
    select: {
      ownerId: true,
      id: true,
      imageUpdatedAt: true,
      category: {
        select: {
          name: true
        }
      }
    }
  }
} satisfies Prisma.ShoppingItemSelect;

type ShoppingDetailItemRow = Prisma.ShoppingItemGetPayload<{ select: typeof shoppingDetailItemSelect }>;

@Injectable()
export class PantryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService,
    @Inject(IngredientImageService) private readonly ingredientImageService: IngredientImageService,
    @Inject(WechatSubscribeService) private readonly wechatSubscribeService: WechatSubscribeService
  ) {}

  async listFridgeTraces(userId: UUID, page: number, pageSize: number): Promise<PageResult<FridgeTraceIngredientSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = Math.min(toPositiveInt(pageSize, 20), 100);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const summaries = this.fridgeTraceSummariesSql(userId);
    const rows = await this.prisma.$queryRaw<Array<{
      id: number | null;
      ingredientId: number | null;
      name: string | null;
      categoryName: string | null;
      kind: FridgeTraceKind | null;
      label: string | null;
      recordedAt: Date | null;
      windowDays: 7 | 15 | null;
      presence: "PRESENT" | "EMPTY" | "UNCONFIRMED" | null;
      archived: boolean | null;
      recentlyPurchased: boolean | null;
      total: number;
    }>>(Prisma.sql`
      WITH summaries AS (${summaries}), page AS (
        SELECT * FROM summaries
        ORDER BY "recordedAt" DESC, id DESC
        LIMIT ${normalizedPageSize} OFFSET ${skip}
      ), total AS (SELECT COUNT(*) AS total FROM summaries)
      SELECT page.*, total.total FROM total LEFT JOIN page ON TRUE
    `);
    const firstRow = rows[0];
    const items: FridgeTraceIngredientSummary[] = rows.filter(row => row.id !== null).map(row => ({
      id: row.id!,
      ingredientId: row.ingredientId,
      name: row.name!,
      categoryName: row.categoryName,
      kind: row.kind!,
      label: row.label!,
      recordedAt: toIsoDate(row.recordedAt!),
      windowDays: row.windowDays!,
      presence: row.presence!,
      archived: row.archived!,
      recentlyPurchased: row.recentlyPurchased!
    }));
    const total = Number(firstRow?.total ?? 0);
    return {
      items,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async getFridgeTraceSummary(userId: UUID): Promise<FridgeTraceSummaryResponse> {
    const rows = await this.prisma.$queryRaw<Array<{ totalCount: number; latestTime: Date | null }>>(Prisma.sql`
      WITH summaries AS (${this.fridgeTraceSummariesSql(userId)})
      SELECT COUNT(*)::INTEGER AS "totalCount", MAX("recordedAt") AS "latestTime" FROM summaries
    `);
    return { totalCount: Number(rows[0]?.totalCount ?? 0), latestTime: rows[0]?.latestTime?.toISOString() ?? null };
  }

  private fridgeTraceSummariesSql(userId: UUID) {
    return Prisma.sql`
      WITH source AS (
        SELECT trace.id, trace.ingredient_id AS "ingredientId", trace.name,
          COALESCE(trace.category_name, category.name) AS "categoryName",
          COALESCE(trace.category_code, category.code) AS "categoryCode",
          trace.kind, trace.created_at AS "recordedAt",
          CASE WHEN trace.ingredient_id IS NULL
            THEN 'name:' || LOWER(BTRIM(trace.name))
            ELSE 'ingredient:' || trace.ingredient_id::text
          END AS "identityKey"
        FROM fridge_traces trace
        LEFT JOIN ingredients ingredient ON ingredient.id = trace.ingredient_id
        LEFT JOIN ingredient_categories category ON category.id = ingredient.category_id
        WHERE trace.user_id = ${userId}
      ), latest_state AS (
        SELECT DISTINCT ON ("identityKey") * FROM source
        WHERE kind <> 'USED'
        ORDER BY "identityKey", "recordedAt" DESC, id DESC
      ), latest_purchase AS (
        SELECT DISTINCT ON ("identityKey") "identityKey", "recordedAt"
        FROM source WHERE kind = 'PURCHASED'
        ORDER BY "identityKey", "recordedAt" DESC, id DESC
      ), calculated AS (
        SELECT state.id, state."ingredientId", state.name, state."categoryName", state.kind,
          state."recordedAt",
          CASE WHEN state."categoryName" IN ('蔬菜', '水果', '鲜肉', '鲜鱼', '豆制品', '鲜奶')
            OR state."categoryCode" IN ('PRODUCE', 'VEGETABLES', 'FRUIT', 'FRESH_MEAT', 'FRESH_FISH', 'TOFU', 'FRESH_MILK')
            THEN 7 ELSE 15 END AS "windowDays",
          CASE WHEN CURRENT_TIMESTAMP - state."recordedAt" >=
            (CASE WHEN state."categoryName" IN ('蔬菜', '水果', '鲜肉', '鲜鱼', '豆制品', '鲜奶')
              OR state."categoryCode" IN ('PRODUCE', 'VEGETABLES', 'FRUIT', 'FRESH_MEAT', 'FRESH_FISH', 'TOFU', 'FRESH_MILK')
              THEN INTERVAL '7 days' ELSE INTERVAL '15 days' END)
            THEN 'UNCONFIRMED'
            WHEN state.kind = 'MANUAL_EMPTY' THEN 'EMPTY' ELSE 'PRESENT' END AS presence,
          CURRENT_TIMESTAMP - state."recordedAt" >= INTERVAL '30 days' AS archived,
          COALESCE(CURRENT_TIMESTAMP - purchase."recordedAt" < INTERVAL '3 days', FALSE) AS "recentlyPurchased"
        FROM latest_state state
        LEFT JOIN latest_purchase purchase USING ("identityKey")
      )
      SELECT calculated.id, calculated."ingredientId", calculated.name, calculated."categoryName",
        calculated.kind,
        CASE WHEN calculated.presence = 'UNCONFIRMED' THEN '没有近期记录'
          WHEN calculated.presence = 'EMPTY' THEN '已标记没有'
          WHEN calculated."recentlyPurchased" THEN '最近买过' ELSE '可能还有' END AS label,
        calculated."recordedAt", calculated."windowDays", calculated.presence,
        calculated.archived, calculated."recentlyPurchased"
      FROM calculated
    `;
  }

  async markFridgeTracePresent(
    userId: UUID,
    operationId: OperationId,
    ingredientId: UUID | null,
    name: string,
    categoryName: string | null
  ): Promise<FridgeTraceSummary> {
    const normalizedName = name.trim();
    if (!normalizedName) throw new BadRequestException("食材名称不能为空");
    const requestHash = JSON.stringify({ ingredientId, name: normalizedName, categoryName: categoryName?.trim() || null });
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<FridgeTraceSummary>(tx, operationId, "fridge-trace:present", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "fridge-trace:present", userId, null, requestHash);
      const categories = await this.loadFridgeCategoryMap(tx, userId, [ingredientId]);
      const category = ingredientId === null ? undefined : categories.get(ingredientId);
      const safeIngredientId = category ? ingredientId : null;
      const created = await tx.fridgeTrace.create({
        data: {
          userId,
          ingredientId: safeIngredientId,
          kind: "MANUAL_PRESENT",
          name: normalizedName,
          categoryName: category?.name ?? null,
          categoryCode: category?.code ?? null
        }
      });
      await this.compactFridgeTraceHistory(tx, userId, [{ ingredientId: safeIngredientId, name: normalizedName }]);
      const result = this.toFridgeTraceSummary(created);
      await completeIdempotentOperation(tx, operationId, "fridge-trace:present", userId, null, requestHash, result);
      return result;
    });
  }

  async markFridgeTracesPresent(
    userId: UUID,
    operationId: OperationId,
    items: Array<{ ingredientId: UUID | null; name: string; categoryName: string | null }>
  ): Promise<FridgeTraceSummary[]> {
    const uniqueItems = new Map<string, { ingredientId: UUID | null; name: string; categoryName: string | null }>();
    for (const item of items) {
      const name = item.name.trim();
      if (!name) throw new BadRequestException("食材名称不能为空");
      const normalized = { ingredientId: item.ingredientId, name, categoryName: item.categoryName?.trim() || null };
      const key = item.ingredientId === null ? `name:${normalizeNameKey(name)}` : `ingredient:${item.ingredientId}`;
      if (!uniqueItems.has(key)) uniqueItems.set(key, normalized);
    }
    const normalizedItems = [...uniqueItems.values()];
    if (!normalizedItems.length || normalizedItems.length > 100) {
      throw new BadRequestException("一次需要确认 1 到 100 项食材");
    }
    const requestHash = JSON.stringify(normalizedItems);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<FridgeTraceSummary[]>(tx, operationId, "fridge-trace:present:batch", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "fridge-trace:present:batch", userId, null, requestHash);
      const categories = await this.loadFridgeCategoryMap(tx, userId, normalizedItems.map(item => item.ingredientId));
      const result: FridgeTraceSummary[] = [];
      for (const item of normalizedItems) {
        const category = item.ingredientId === null ? undefined : categories.get(item.ingredientId);
        const safeIngredientId = category ? item.ingredientId : null;
        const created = await tx.fridgeTrace.create({
          data: {
            userId,
            ingredientId: safeIngredientId,
            kind: "MANUAL_PRESENT",
            name: item.name,
            categoryName: category?.name ?? null,
            categoryCode: category?.code ?? null
          }
        });
        result.push(this.toFridgeTraceSummary(created));
      }
      await this.compactFridgeTraceHistory(tx, userId, normalizedItems.map(item => ({
        ...item,
        ingredientId: item.ingredientId !== null && categories.has(item.ingredientId) ? item.ingredientId : null
      })));
      await completeIdempotentOperation(tx, operationId, "fridge-trace:present:batch", userId, null, requestHash, result);
      return result;
    });
  }

  async markFridgeTraceEmpty(
    userId: UUID,
    operationId: OperationId,
    ingredientId: UUID | null,
    name: string,
    categoryName: string | null = null
  ): Promise<FridgeTraceSummary> {
    const normalizedName = name.trim();
    if (!normalizedName) throw new BadRequestException("食材名称不能为空");
    const requestHash = JSON.stringify({ ingredientId, name: normalizedName, categoryName: categoryName?.trim() || null });
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<FridgeTraceSummary>(tx, operationId, "fridge-trace:empty", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "fridge-trace:empty", userId, null, requestHash);
      const categories = await this.loadFridgeCategoryMap(tx, userId, [ingredientId]);
      const category = ingredientId === null ? undefined : categories.get(ingredientId);
      const safeIngredientId = category ? ingredientId : null;
      const created = await tx.fridgeTrace.create({
        data: {
          userId,
          ingredientId: safeIngredientId,
          kind: "MANUAL_EMPTY",
          name: normalizedName,
          categoryName: category?.name ?? null,
          categoryCode: category?.code ?? null
        }
      });
      await this.compactFridgeTraceHistory(tx, userId, [{ ingredientId: safeIngredientId, name: normalizedName }]);
      const result = this.toFridgeTraceSummary(created);
      await completeIdempotentOperation(tx, operationId, "fridge-trace:empty", userId, null, requestHash, result);
      return result;
    });
  }

  private async loadFridgeCategoryMap(tx: Prisma.TransactionClient, userId: UUID, ingredientIds: Array<UUID | null>) {
    const ids = [...new Set(ingredientIds.filter((id): id is UUID => id !== null))];
    if (!ids.length) return new Map<UUID, { name: string; code: string }>();
    const ingredients = await tx.ingredient.findMany({
      where: { id: { in: ids }, status: "ACTIVE", OR: [{ ownerId: null }, { ownerId: userId }] },
      select: { id: true, category: { select: { name: true, code: true } } }
    });
    return new Map(ingredients.map(ingredient => [ingredient.id, ingredient.category]));
  }

  private async compactFridgeTraceHistory(
    tx: Prisma.TransactionClient,
    userId: UUID,
    items: Array<{ ingredientId: UUID | null; name: string }>
  ) {
    const ingredientIds = [...new Set(items.flatMap(item => item.ingredientId === null ? [] : [item.ingredientId]))];
    const names = [...new Set(items.filter(item => item.ingredientId === null).map(item => item.name.trim()))];
    const identities: Prisma.FridgeTraceWhereInput[] = [
      ...(ingredientIds.length ? [{ ingredientId: { in: ingredientIds } }] : []),
      ...(names.length ? [{ ingredientId: null, name: { in: names, mode: "insensitive" as const } }] : [])
    ];
    if (!identities.length) return;

    const traces = await tx.fridgeTrace.findMany({
      where: { userId, OR: identities },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, ingredientId: true, name: true, kind: true }
    });
    const grouped = new Map<string, typeof traces>();
    for (const trace of traces) {
      const key = trace.ingredientId === null ? `name:${normalizeNameKey(trace.name)}` : `ingredient:${trace.ingredientId}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(trace);
      grouped.set(key, bucket);
    }

    const removeIds: number[] = [];
    for (const bucket of grouped.values()) {
      const keepIds = new Set([
        bucket.find(trace => trace.kind !== "USED")?.id,
        bucket.find(trace => trace.kind === "PURCHASED")?.id,
        bucket.find(trace => trace.kind === "USED")?.id
      ].filter((id): id is number => id !== undefined));
      for (const trace of bucket) {
        if (!keepIds.has(trace.id)) removeIds.push(trace.id);
      }
    }
    if (removeIds.length) {
      await tx.fridgeTrace.deleteMany({ where: { userId, id: { in: removeIds } } });
    }
  }

  private toFridgeTraceSummary(trace: {
    id: UUID;
    ingredientId: UUID | null;
    name: string;
    categoryName: string | null;
    categoryCode?: string | null;
    kind: FridgeTraceKind;
    createdAt: Date;
  }): FridgeTraceSummary {
    return {
      id: trace.id,
      ingredientId: trace.ingredientId,
      name: trace.name,
      categoryName: trace.categoryName,
      kind: trace.kind,
      label: fridgeTraceLabel(trace.kind),
      recordedAt: toIsoDate(trace.createdAt),
      windowDays: fridgeTraceWindowDays(trace.categoryName, trace.categoryCode ?? null) as 7 | 15
    };
  }

  private async recordPurchaseTrace(tx: Prisma.TransactionClient, userId: UUID, itemId: UUID, createdAt = new Date()) {
    const item = await tx.shoppingItem.findFirst({
      where: { id: itemId, userId },
      select: {
        id: true,
        ingredientId: true,
        name: true,
        ingredient: { select: { ownerId: true, status: true, category: { select: { name: true, code: true } } } }
      }
    });
    if (!item) throw new NotFoundException("购物项不存在");
    await tx.fridgeTrace.deleteMany({ where: { sourceShoppingItemId: item.id, kind: "PURCHASED" } });
    const ingredientIsVisible = item.ingredient && item.ingredient.status === "ACTIVE"
      && (item.ingredient.ownerId === null || item.ingredient.ownerId === userId);
    const ingredientId = ingredientIsVisible ? item.ingredientId : null;
    const created = await tx.fridgeTrace.create({
      data: {
        userId,
        ingredientId,
        sourceShoppingItemId: item.id,
        kind: "PURCHASED",
        name: item.name,
        categoryName: ingredientIsVisible ? item.ingredient?.category.name ?? null : null,
        categoryCode: ingredientIsVisible ? item.ingredient?.category.code ?? null : null,
        createdAt
      }
    });
    await this.compactFridgeTraceHistory(tx, userId, [{ ingredientId, name: item.name }]);
    return created;
  }

  async completeMealCookingTrace(
    userId: UUID,
    planItemId: UUID,
    operationId: OperationId,
    markWholeTable = false
  ): Promise<CookingTraceResponse> {
    const requestHash = JSON.stringify({ planItemId, markWholeTable });
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<CookingTraceResponse>(tx, operationId, "meal:cooking-trace", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "meal:cooking-trace", userId, null, requestHash);
      await tx.$queryRaw`SELECT "id" FROM "meal_plan_items" WHERE "id" = ${planItemId} FOR UPDATE`;
      const plan = await tx.mealPlanItem.findUnique({
        where: { id: planItemId },
        select: {
          id: true,
          userId: true,
          status: true,
          diningEvent: {
            select: {
              participants: { where: { status: "ACCEPTED" }, select: { userId: true } },
              menuItems: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { recipeVersionId: true, cookUserId: true } }
            }
          },
          dishes: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: { recipeVersionId: true, recipeVersion: { select: { id: true, name: true, ingredientsJson: true } } }
          }
        }
      });
      if (!plan) throw new NotFoundException("计划不存在");
      if (plan.status === "CANCELLED") throw new ConflictException("已取消计划不能记录做饭食材");
      const isParticipant = Boolean(plan.diningEvent?.participants.some(item => item.userId === userId));
      if (plan.userId !== userId && !isParticipant) throw new NotFoundException("计划不存在");

      const eventMenu = plan.diningEvent?.menuItems ?? [];
      const assignedVersionIds = eventMenu.filter(item => item.cookUserId === userId).map(item => item.recipeVersionId);
      const selectedVersionIds = eventMenu.length
        ? assignedVersionIds.length
          ? assignedVersionIds
          : markWholeTable
            ? eventMenu.map(item => item.recipeVersionId)
            : (() => { throw new ConflictException("当前没有你负责的菜，请确认是否标记整桌完成"); })()
        : plan.dishes.map(item => item.recipeVersionId);
      const selected = new Set(selectedVersionIds);
      const selectedDishes = plan.dishes.filter(item => selected.has(item.recipeVersionId));
      const missingVersionIds = selectedVersionIds.filter(versionId => !selectedDishes.some(item => item.recipeVersionId === versionId));
      const missingVersions = missingVersionIds.length
        ? await tx.recipeContentVersion.findMany({
            where: { id: { in: Array.from(new Set(missingVersionIds)) } },
            select: { id: true, name: true, ingredientsJson: true }
          })
        : [];
      const versions = [...selectedDishes.map(item => item.recipeVersion), ...missingVersions];
      const seen = new Set<string>();
      const facts: Array<{
        userId: UUID;
        planId: UUID;
        ingredientId: UUID | null;
        name: string;
        categoryCode: string | null;
        kind: "USED";
      }> = [];
      for (const version of versions) {
        const ingredients = fromJson<RecipeContentSnapshot["ingredients"]>(version.ingredientsJson);
        for (const ingredient of ingredients) {
          const key = ingredient.ingredientId === null ? `name:${normalizeNameKey(ingredient.ingredientName)}` : `ingredient:${ingredient.ingredientId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          facts.push({
            userId,
            planId: planItemId,
            ingredientId: ingredient.ingredientId,
            name: ingredient.ingredientName.trim(),
            categoryCode: ingredient.categoryCode ?? null,
            kind: "USED"
          });
        }
      }
      const createdAt = new Date();
      if (facts.length) {
        const categories = await this.loadFridgeCategoryMap(tx, userId, facts.map(fact => fact.ingredientId));
        for (const fact of facts) {
          const category = fact.ingredientId === null ? undefined : categories.get(fact.ingredientId);
          if (!category) fact.ingredientId = null;
          else fact.categoryCode = category.code;
        }
        await tx.fridgeTrace.createMany({
          data: facts.map(fact => ({
            userId: fact.userId,
            sourceMealPlanItemId: fact.planId,
            ingredientId: fact.ingredientId,
            kind: fact.kind,
            name: fact.name,
            categoryCode: fact.categoryCode,
            createdAt
          }))
        });
        await this.compactFridgeTraceHistory(tx, userId, facts.map(fact => ({ ingredientId: fact.ingredientId, name: fact.name })));
      }
      const result: CookingTraceResponse = {
        planItemId,
        recordedAt: createdAt.toISOString(),
        usedCount: facts.length,
        message: facts.length ? "已记录用过，余量未知" : "本顿没有可记录的食材"
      };
      await completeIdempotentOperation(tx, operationId, "meal:cooking-trace", userId, null, requestHash, result);
      return result;
    });
  }

  async getShoppingListSummary(userId: UUID): Promise<ShoppingListSummaryResponse> {
    const [memberships, pendingRows] = await this.prisma.$transaction([
      this.prisma.shoppingListMember.findMany({
        where: { userId },
        select: {
          list: {
            select: {
              status: true
            }
          }
        }
      }),
      this.prisma.$queryRaw<PendingShoppingGroupCountRow[]>(Prisma.sql`
        select count(*)::int as "pendingCount"
        from (
          select
            coalesce(item.ingredient_id::text, 'none') || ':' || lower(trim(item.name)) as group_key,
            bool_and(item.status = 'BOUGHT') as is_done
          from shopping_items item
          inner join shopping_lists list on list.id = item.list_id
          inner join shopping_list_members member on member.list_id = list.id
          where member.user_id = ${userId}
            and list.status = 'ACTIVE'
            and item.status <> 'DELETED'
          group by 1
        ) grouped
        where grouped.is_done = false
      `)
    ]);
    const statuses: ShoppingListStatusCount[] = [
      { status: "ACTIVE", count: 0 },
      { status: "COMPLETED", count: 0 },
      { status: "VOIDED", count: 0 }
    ];
    for (const membership of memberships) {
      const current = statuses.find(item => item.status === membership.list.status);
      if (current) current.count += 1;
    }
    const defaultStatus = statuses.find(item => item.status === "ACTIVE" && item.count > 0)?.status
      ?? statuses.find(item => item.count > 0)?.status
      ?? "ACTIVE";
    const pendingItemCount = Math.max(Number(pendingRows[0]?.pendingCount ?? 0), 0);
    return {
      statuses,
      defaultStatus,
      activeListCount: statuses.find(item => item.status === "ACTIVE")?.count ?? 0,
      pendingItemCount
    };
  }

  async listShoppingLists(userId: UUID, status?: string): Promise<ShoppingListPageResponse> {
    const normalizedStatus = this.normalizeShoppingListStatus(status);
    const lists = await this.prisma.shoppingList.findMany({
      where: {
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
        members: {
          some: {
            userId
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        name: true,
        status: true,
        ownerUserId: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        voidedAt: true,
        owner: {
          select: {
            uid: true,
            nickname: true
          }
        },
        members: {
          where: {
            userId
          },
          select: {
            role: true
          }
        },
        _count: {
          select: {
            members: true,
            invites: {
              where: {
                status: "PENDING"
              }
            }
          }
        },
        shareTokens: {
          where: {
            disabledAt: null
          },
          select: {
            id: true
          }
        },
        items: {
          where: {
            status: {
              not: "DELETED"
            }
          },
          select: {
            ingredientId: true,
            name: true,
            status: true
          }
        }
      }
    });
    return {
      items: await Promise.all(lists.map(list => this.toShoppingListSummary(this.prisma, list)))
    };
  }

  async listShoppingListInvites(userId: UUID, filter?: string): Promise<ShoppingListInvitePageResponse> {
    const inviteFilter = normalizeShoppingListInviteFilter(filter);
    const retainDays = await this.resolveShoppingListInviteMessageDays(this.prisma, userId);
    const cutoffAt = addDays(new Date(), -retainDays);
    const where = this.buildShoppingListInviteWhere(userId, inviteFilter, cutoffAt, filter === undefined);
    const invites = await this.prisma.shoppingListInvite.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        acceptedAt: true,
        declinedAt: true,
        list: {
          select: {
            id: true,
            name: true,
            status: true,
            ownerUserId: true,
            owner: {
              select: {
                uid: true,
                nickname: true
              }
            },
            _count: {
              select: {
                members: true,
                items: {
                  where: {
                    status: {
                      not: "DELETED"
                    }
                  }
                }
              }
            },
            members: {
              where: {
                userId
              },
              select: {
                role: true
              }
            }
          }
        }
      }
    });
    const items = await Promise.all(invites.map(invite => this.toShoppingListInviteSummary(this.prisma, invite)));
    return {
      items: items.sort((left, right) => {
        const leftTime = new Date(left.handledAt ?? left.invitedAt).getTime();
        const rightTime = new Date(right.handledAt ?? right.invitedAt).getTime();
        if (leftTime === rightTime) return Number(right.id) - Number(left.id);
        return rightTime - leftTime;
      })
    };
  }

  async createShoppingList(userId: UUID, operationId: OperationId, name: string | null): Promise<ShoppingListDetail> {
    const normalizedName = this.normalizeShoppingListName(name);
    const requestHash = normalizedName;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:create", userId, null, requestHash);
      const list = await this.createShoppingListInTx(tx, userId, userId, normalizedName);
      const result = await this.loadShoppingListDetailFromTx(tx, userId, list.id);
      await completeIdempotentOperation(tx, operationId, "shopping-list:create", userId, null, requestHash, result);
      return result;
    });
  }

  async getShoppingListDetail(userId: UUID, listId: UUID): Promise<ShoppingListDetail> {
    return this.prisma.$transaction(tx => this.loadShoppingListDetailFromTx(tx, userId, listId));
  }

  async renameShoppingList(userId: UUID, listId: UUID, operationId: OperationId, version: number, name: string): Promise<ShoppingListDetail> {
    const normalizedName = this.normalizeShoppingListName(name);
    const requestHash = `${listId}:${version}:${normalizedName}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:rename", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:rename", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          name: normalizedName,
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:rename", userId, null, requestHash, result);
      return result;
    });
  }

  async createShoppingListItem(
    userId: UUID,
    listId: UUID,
    operationId: OperationId,
    name: string,
    ingredientId: UUID | null,
    quantityText: string | null,
    note: string | null
  ): Promise<ShoppingListDetail> {
    const normalized = this.normalizePantryFields(name, quantityText, note);
    const requestHash = `${listId}:${JSON.stringify({ ...normalized, ingredientId })}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:item:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:create", userId, null, requestHash);
      const access = await this.assertShoppingListWritable(tx, userId, listId);
      await this.assertStorageWritable(tx, access.ownerUserId, sizeOfJson(normalized));
      const created = await tx.shoppingItem.create({
        data: {
          userId: access.ownerUserId,
          listId,
          name: normalized.name,
          quantityText: normalized.quantityText,
          note: normalized.note,
          sourceType: "MANUAL",
          ingredientId
        }
      });
      await upsertStorageLedger(tx, access.ownerUserId, "SHOPPING", created.id, sizeOfJson(created));
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:create", userId, null, requestHash, result);
      return result;
    });
  }

  async addRecipeToShoppingList(
    userId: UUID,
    listId: UUID,
    operationId: OperationId,
    recipeId: UUID,
    sourceVersionId: UUID,
    planItemId: UUID | null = null
  ): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${recipeId}:${sourceVersionId}:${planItemId ?? 0}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:item:recipe", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:recipe", userId, null, requestHash);
      const access = await this.assertShoppingListWritable(tx, userId, listId);
      const source = await this.loadRecipeShoppingSource(tx, userId, recipeId, sourceVersionId);
      if (planItemId) {
        await this.assertPlanShoppingSource(tx, userId, planItemId, recipeId, sourceVersionId);
      }
      const itemSourceType = planItemId ? planSourceType : recipeSourceType;
      const itemSourceKey = planItemId ? String(planItemId) : null;
      const batchKey = String(operationId);
      const sizeBytes = source.ingredients.reduce(
        (total, ingredient, index) =>
          total +
          sizeOfJson({
            userId: access.ownerUserId,
            listId,
            name: ingredient.ingredientName,
            quantityText: formatRecipeAmount(ingredient.amount),
            note: source.title,
            sourceType: itemSourceType,
            sourceKey: itemSourceKey ?? `${source.recipeId}:${source.sourceVersionId}:${batchKey}:${index + 1}`,
            sourceRecipeId: source.recipeId,
            sourceRecipeVersionId: source.sourceVersionId,
            sourceRecipeTitle: source.title,
            sourceBaseServings: source.baseServings,
            sourceBatchKey: batchKey,
            sourceIngredientSort: index + 1,
            ingredientId: ingredient.ingredientId,
            amountJson: ingredient.amount
          }),
        0
      );
      await this.assertStorageWritable(tx, access.ownerUserId, sizeBytes);
      for (const [index, ingredient] of source.ingredients.entries()) {
        const created = await tx.shoppingItem.create({
          data: {
            userId: access.ownerUserId,
            listId,
            name: ingredient.ingredientName,
            quantityText: formatRecipeAmount(ingredient.amount),
            note: source.title,
            sourceType: itemSourceType,
            sourceKey: itemSourceKey ?? `${source.recipeId}:${source.sourceVersionId}:${batchKey}:${index + 1}`,
            sourceRecipeId: source.recipeId,
            sourceRecipeVersionId: source.sourceVersionId,
            sourceRecipeTitle: source.title,
            sourceBaseServings: source.baseServings,
            sourceBatchKey: batchKey,
            sourceIngredientSort: index + 1,
            ingredientId: ingredient.ingredientId,
            amountJson: ingredient.amount
          }
        });
        await upsertStorageLedger(tx, access.ownerUserId, "SHOPPING", created.id, sizeOfJson(created));
      }
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      if (planItemId) {
        await this.bindMealPlanShoppingList(tx, userId, planItemId, listId);
      }
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:recipe", userId, null, requestHash, result);
      return result;
    });
  }

  async addPlanToShoppingList(userId: UUID, listId: UUID, operationId: OperationId, planItemId: UUID): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${planItemId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:item:plan", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:plan", userId, null, requestHash);
      await this.syncPlanShoppingGapInTransaction(tx, userId, planItemId, operationId, listId);
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:plan", userId, null, requestHash, result);
      return result;
    });
  }

  async syncPlanShoppingGapInTransaction(
    tx: Prisma.TransactionClient,
    userId: UUID,
    planItemId: UUID,
    operationId: OperationId,
    requestedListId: UUID | null = null
  ): Promise<PlanShoppingGapSyncResult> {
    const plan = await tx.mealPlanItem.findFirst({
      where: {
        id: planItemId,
        userId
      },
      select: {
        shoppingListId: true
      }
    });
    if (!plan) throw new NotFoundException("计划不存在");

    const lines = await this.loadPlanGapSummary(tx, userId, planItemId);
    let listId = requestedListId ?? plan.shoppingListId;

    if (!lines.length) {
      if (requestedListId) {
        await this.assertShoppingListOwner(tx, userId, requestedListId);
        await this.bindMealPlanShoppingList(tx, userId, planItemId, requestedListId);
        listId = requestedListId;
      }
      return { listId, createdCount: 0, pendingCount: 0 };
    }

    if (!listId) {
      const active = await tx.shoppingList.findFirst({
        where: {
          ownerUserId: userId,
          status: "ACTIVE"
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { id: true }
      });
      listId = active?.id ?? (await this.createShoppingListInTx(tx, userId, userId, this.buildDefaultShoppingListName())).id;
    }

    const access = await this.assertShoppingListOwner(tx, userId, listId);
    if (access.status !== "ACTIVE") throw new ConflictException("当前采购清单不可继续加入需求");
    const batchKey = String(operationId);
    const demandItems = lines.flatMap(line => this.buildShoppingDemandWriteItems(line, batchKey));
    const sourceKeys = demandItems.map(line => line.sourceKey);
    const existing = await tx.shoppingItem.findMany({
      where: {
        userId,
        listId,
        sourceType: planSourceType,
        sourceKey: { in: sourceKeys }
      },
      select: {
        sourceKey: true,
        sourceType: true,
        status: true,
        removedByUserId: true
      }
    });
    const existingKeys = new Set(existing.map(item => item.sourceKey).filter((key): key is string => key !== null));
    const writes = demandItems.filter(line => !existingKeys.has(line.sourceKey));
    const sizeBytes = writes.reduce((total, line) => {
      return total + sizeOfJson({
        userId,
        listId,
        name: line.name,
        quantityText: line.quantityText,
        note: line.note,
        sourceType: planSourceType,
        sourceKey: line.sourceKey,
        sourceRecipeId: line.sourceRecipeId,
        sourceRecipeVersionId: line.sourceRecipeVersionId,
        sourceRecipeTitle: line.sourceRecipeTitle,
        sourceBaseServings: line.sourceBaseServings,
        sourceBatchKey: batchKey,
        sourceIngredientSort: line.sourceIngredientSort,
        ingredientId: line.ingredientId,
        amountJson: line.amountJson
      });
    }, 0);
    await this.assertStorageWritable(tx, userId, sizeBytes);

    for (const line of writes) {
      const created = await tx.shoppingItem.create({
        data: {
          userId,
          listId,
          name: line.name,
          quantityText: line.quantityText,
          note: line.note,
          sourceType: planSourceType,
          sourceKey: line.sourceKey,
          sourceRecipeId: line.sourceRecipeId,
          sourceRecipeVersionId: line.sourceRecipeVersionId,
          sourceRecipeTitle: line.sourceRecipeTitle,
          sourceBaseServings: line.sourceBaseServings,
          sourceBatchKey: batchKey,
          sourceIngredientSort: line.sourceIngredientSort,
          ingredientId: line.ingredientId,
          amountJson: line.amountJson ?? Prisma.DbNull
        }
      });
      await upsertStorageLedger(tx, userId, "SHOPPING", created.id, sizeOfJson(created));
    }

    if (writes.length) {
      await tx.shoppingList.update({
        where: { id: listId },
        data: { version: { increment: 1 } }
      });
    }
    await this.bindMealPlanShoppingList(tx, userId, planItemId, listId);
    return { listId, createdCount: writes.length, pendingCount: 0 };
  }

  async updateShoppingListItemCheck(
    userId: UUID,
    listId: UUID,
    itemId: UUID,
    operationId: OperationId,
    version: number,
    checked: boolean
  ): Promise<ShoppingListItemPatchResponse> {
    const requestHash = `${listId}:${itemId}:${version}:${checked}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListItemPatchResponse>(tx, operationId, "shopping-list:item:check", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:check", userId, null, requestHash);
      const access = await this.assertShoppingListWritable(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      const item = await tx.shoppingItem.findFirst({
        where: {
          id: itemId,
          listId
        }
      });
      if (!item) {
        throw new NotFoundException("购物项不存在");
      }
      if (item.status === "DELETED") {
        throw new BadRequestException("当前购物项已移除");
      }
      const now = new Date();
      await tx.shoppingItem.update({
        where: { id: itemId },
        data: checked
          ? {
              status: "BOUGHT",
              checkedAt: now,
              checkedByUserId: userId
            }
          : {
              status: "OPEN",
              checkedAt: null,
              checkedByUserId: null
          }
      });
      if (checked) {
        await this.recordPurchaseTrace(tx, item.userId, itemId, now);
      } else {
        await tx.fridgeTrace.deleteMany({
          where: { sourceShoppingItemId: itemId, kind: "PURCHASED" }
        });
      }
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListItemPatchFromTx(tx, userId, listId, itemId, null);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:check", userId, null, requestHash, result);
      return result;
    });
  }

  async updateShoppingListItemChecks(
    userId: UUID,
    listId: UUID,
    operationId: OperationId,
    version: number,
    changes: Array<{ itemId: number; checked: boolean }>
  ): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}:${JSON.stringify(changes)}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:items:check", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:items:check", userId, null, requestHash);
      const access = await this.assertShoppingListWritable(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);

      const itemIds = changes.map(change => change.itemId);
      const items = await tx.shoppingItem.findMany({
        where: { listId, id: { in: itemIds }, status: { not: "DELETED" } },
        select: { id: true, userId: true, status: true, checkedAt: true }
      });
      if (items.length !== itemIds.length) {
        throw new NotFoundException("购物项不存在或已移除");
      }

      const currentById = new Map(items.map(item => [item.id, item]));
      const now = new Date();
      let changed = false;
      for (const change of changes) {
        const item = currentById.get(change.itemId);
        if (!item) throw new NotFoundException("购物项不存在或已移除");
        const wasChecked = item.status === "BOUGHT" || Boolean(item.checkedAt);
        if (wasChecked === change.checked) continue;

        await tx.shoppingItem.update({
          where: { id: item.id },
          data: change.checked
            ? { status: "BOUGHT", checkedAt: now, checkedByUserId: userId }
            : { status: "OPEN", checkedAt: null, checkedByUserId: null }
        });
        if (change.checked) {
          await this.recordPurchaseTrace(tx, item.userId, item.id, now);
        } else {
          await tx.fridgeTrace.deleteMany({
            where: { sourceShoppingItemId: item.id, kind: "PURCHASED" }
          });
        }
        changed = true;
      }

      if (changed) {
        const versionUpdate = await tx.shoppingList.updateMany({
          where: { id: listId, version },
          data: { version: { increment: 1 } }
        });
        if (versionUpdate.count !== 1) {
          throw new ConflictException("清单内容已变化，请刷新后重试");
        }
      }
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:items:check", userId, null, requestHash, result);
      return result;
    });
  }

  async removeShoppingListItem(
    userId: UUID,
    listId: UUID,
    itemId: UUID,
    operationId: OperationId,
    version: number
  ): Promise<ShoppingListItemPatchResponse> {
    const requestHash = `${listId}:${itemId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListItemPatchResponse>(tx, operationId, "shopping-list:item:remove", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:remove", userId, null, requestHash);
      const access = await this.assertShoppingListWritable(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      const item = await tx.shoppingItem.findFirst({
        where: {
          id: itemId,
          listId
        }
      });
      if (!item) {
        throw new NotFoundException("购物项不存在");
      }
      await tx.shoppingItem.update({
        where: { id: itemId },
        data: {
          status: "DELETED",
          removedAt: new Date(),
          removedByUserId: userId
        }
      });
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListItemPatchFromTx(tx, userId, listId, null, itemId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:remove", userId, null, requestHash, result);
      return result;
    });
  }

  async voidShoppingList(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:void", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:void", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能作废");
      }
      await this.closeShoppingShareInTx(tx, listId);
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          completedAt: null,
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:void", userId, null, requestHash, result);
      return result;
    });
  }

  async checkAllShoppingListItems(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:check-all", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:check-all", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能标记完成");
      }
      const now = new Date();
      const items = await tx.shoppingItem.findMany({
        where: {
          listId,
          status: { not: "DELETED" }
        },
        select: { id: true }
      });
      await tx.shoppingItem.updateMany({
        where: {
          listId,
          status: {
            not: "DELETED"
          }
        },
        data: {
          status: "BOUGHT",
          checkedAt: now,
          checkedByUserId: userId
        }
      });
      for (const item of items) {
        await this.recordPurchaseTrace(tx, userId, item.id, now);
      }
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:check-all", userId, null, requestHash, result);
      return result;
    });
  }

  async restoreShoppingList(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:restore", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:restore", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "VOIDED") {
        throw new BadRequestException("当前清单不能恢复");
      }
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          status: "ACTIVE",
          voidedAt: null,
          completedAt: null,
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:restore", userId, null, requestHash, result);
      return result;
    });
  }

  async copyShoppingList(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:copy", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:copy", userId, null, requestHash);
      const access = await this.assertShoppingListReadable(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      const sourceItems = await tx.shoppingItem.findMany({
        where: {
          listId,
          status: {
            not: "DELETED"
          }
        },
        orderBy: [{ id: "asc" }]
      });
      const targetList = await this.createShoppingListInTx(tx, userId, userId, `${access.name} - 再次采购`);
      const sizeBytes = sourceItems.reduce((total, item) => total + sizeOfJson(item), 0);
      await this.assertStorageWritable(tx, userId, sizeBytes);
      for (const item of sourceItems) {
        const sourceFields = item.sourceType === "RECIPE" || item.sourceType === "PLAN"
          ? {
              sourceRecipeId: item.sourceRecipeId,
              sourceRecipeVersionId: item.sourceRecipeVersionId,
              sourceRecipeTitle: item.sourceRecipeTitle,
              sourceBaseServings: item.sourceBaseServings,
              sourceBatchKey: item.sourceBatchKey,
              sourceIngredientSort: item.sourceIngredientSort,
              ingredientId: item.ingredientId,
              amountJson: item.amountJson as Prisma.InputJsonValue
            }
          : item.sourceType === "MANUAL"
            ? {
                sourceRecipeId: null,
                sourceRecipeVersionId: null,
                sourceRecipeTitle: null,
                sourceBaseServings: null,
                sourceBatchKey: null,
                sourceIngredientSort: null,
                ingredientId: item.ingredientId,
                amountJson: Prisma.DbNull
              }
          : {
              sourceRecipeId: null,
              sourceRecipeVersionId: null,
              sourceRecipeTitle: null,
              sourceBaseServings: null,
              sourceBatchKey: null,
              sourceIngredientSort: null,
              ingredientId: null,
              amountJson: Prisma.DbNull
            };
        const created = await tx.shoppingItem.create({
          data: {
            userId,
            listId: targetList.id,
            name: item.name,
            quantityText: item.quantityText,
            note: item.note,
            sourceType: item.sourceType,
            sourceKey: item.sourceKey,
            ...sourceFields,
            status: "OPEN",
            checkedAt: null,
            checkedByUserId: null,
            removedAt: null,
            removedByUserId: null
          }
        });
        await upsertStorageLedger(tx, userId, "SHOPPING", created.id, sizeOfJson(created));
      }
      const result = await this.loadShoppingListDetailFromTx(tx, userId, targetList.id);
      await completeIdempotentOperation(tx, operationId, "shopping-list:copy", userId, null, requestHash, result);
      return result;
    });
  }

  async deleteShoppingList(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListPageResponse> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListPageResponse>(tx, operationId, "shopping-list:delete", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:delete", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "COMPLETED" && access.status !== "VOIDED") {
        throw new BadRequestException("当前清单状态不支持删除");
      }

      const itemIds = (
        await tx.shoppingItem.findMany({
          where: { listId },
          select: { id: true }
        })
      ).map(item => item.id);

      if (itemIds.length) {
        await tx.storageLedger.deleteMany({
          where: {
            userId: access.ownerUserId,
            module: "SHOPPING",
            recordKey: {
              in: itemIds.map(itemId => String(itemId))
            }
          }
        });
        await tx.shoppingItem.deleteMany({
          where: { listId }
        });
      }

      await tx.shoppingList.delete({
        where: { id: listId }
      });

      const result = await this.loadShoppingListPageFromTx(tx, userId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:delete", userId, null, requestHash, result);
      return result;
    });
  }

  async createShoppingListShareLink(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShareShoppingListLinkResponse> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShareShoppingListLinkResponse>(tx, operationId, "shopping-list:share-link", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:share-link", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能继续共享");
      }
      await tx.shoppingShareToken.updateMany({
        where: {
          listId,
          disabledAt: null
        },
        data: {
          disabledAt: new Date()
        }
      });
      const shareToken = randomBytes(24).toString("hex");
      await tx.shoppingShareToken.create({
        data: {
          listId,
          token: shareToken,
          createdByUserId: userId
        }
      });
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = {
        shareToken,
        shareUrl: `/pages_pantry/list/index?shareToken=${shareToken}`
      };
      await completeIdempotentOperation(tx, operationId, "shopping-list:share-link", userId, null, requestHash, result);
      return result;
    });
  }

  async closeShoppingListShare(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:share-close", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:share-close", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能关闭共享");
      }
      await this.closeShoppingShareInTx(tx, listId);
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:share-close", userId, null, requestHash, result);
      return result;
    });
  }

  async disableShoppingListShareLink(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:share-disable", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:share-disable", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      await tx.shoppingShareToken.updateMany({
        where: {
          listId,
          disabledAt: null
        },
        data: {
          disabledAt: new Date()
        }
      });
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:share-disable", userId, null, requestHash, result);
      return result;
    });
  }

  async removeShoppingListMember(
    userId: UUID,
    listId: UUID,
    memberUserId: UUID,
    operationId: OperationId,
    version: number
  ): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${memberUserId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:member:remove", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:member:remove", userId, null, requestHash);
      const access = await this.assertShoppingListOwner(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.status !== "ACTIVE") {
        throw new BadRequestException("当前清单不能调整协作者");
      }
      if (memberUserId === access.ownerUserId || memberUserId === userId) {
        throw new BadRequestException("当前成员不能通过这里移除");
      }
      const member = await tx.shoppingListMember.findUnique({
        where: {
          listId_userId: {
            listId,
            userId: memberUserId
          }
        },
        select: {
          role: true
        }
      });
      if (!member) {
        throw new NotFoundException("协作者不存在");
      }
      if (member.role !== "COLLABORATOR") {
        throw new BadRequestException("当前成员不能通过这里移除");
      }
      await tx.shoppingListMember.delete({
        where: {
          listId_userId: {
            listId,
            userId: memberUserId
          }
        }
      });
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:member:remove", userId, null, requestHash, result);
      return result;
    });
  }

  async acceptShoppingListInvite(userId: UUID, inviteId: UUID, operationId: OperationId): Promise<ShoppingListDetail> {
    const requestHash = String(inviteId);
    const invite = await this.prisma.shoppingListInvite.findUnique({
      where: { id: inviteId },
      select: {
        id: true,
        listId: true,
        targetUserId: true
      }
    });
    if (!invite || invite.targetUserId !== userId) {
      throw new NotFoundException("邀请不存在");
    }
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:invite:accept", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:invite:accept", userId, null, requestHash);
      await tx.$queryRaw`SELECT "id" FROM "shopping_list_invites" WHERE "id" = ${inviteId} FOR UPDATE`;
      const currentInvite = await tx.shoppingListInvite.findUnique({
        where: { id: inviteId },
        include: {
          list: {
            select: {
              id: true,
              ownerUserId: true,
              status: true
            }
          }
        }
      });
      if (!currentInvite || currentInvite.targetUserId !== userId) {
        throw new NotFoundException("邀请不存在");
      }
      const existing = await tx.shoppingListMember.findUnique({
        where: {
          listId_userId: {
            listId: currentInvite.listId,
            userId
          }
        }
      });
      if (existing) {
        if (currentInvite.status !== "ACCEPTED") {
          await tx.shoppingListInvite.update({
            where: { id: inviteId },
            data: {
              status: "ACCEPTED",
              acceptedByUserId: userId,
              acceptedAt: new Date(),
              declinedAt: null,
              revokedAt: null
            }
          });
        }
        const result = await this.loadShoppingListDetailFromTx(tx, userId, currentInvite.listId);
        await completeIdempotentOperation(tx, operationId, "shopping-list:invite:accept", userId, null, requestHash, result);
        return result;
      }
      if (currentInvite.status === "ACCEPTED") {
        const result = await this.loadShoppingListDetailFromTx(tx, userId, currentInvite.listId);
        await completeIdempotentOperation(tx, operationId, "shopping-list:invite:accept", userId, null, requestHash, result);
        return result;
      }
      if (currentInvite.status !== "PENDING") {
        throw new BadRequestException("邀请已失效");
      }
      if (currentInvite.list.status !== "ACTIVE") {
        throw new BadRequestException("当前清单暂不支持继续加入");
      }
      await this.assertShoppingListMemberCapacity(tx, currentInvite.listId, currentInvite.list.ownerUserId, [userId]);
      await tx.shoppingListMember.create({
        data: {
          listId: currentInvite.listId,
          userId,
          role: "COLLABORATOR",
          addedByUserId: currentInvite.createdByUserId
        }
      });
      await tx.shoppingListInvite.update({
        where: { id: inviteId },
        data: {
          status: "ACCEPTED",
          acceptedByUserId: userId,
          acceptedAt: new Date(),
          declinedAt: null,
          revokedAt: null
        }
      });
      await tx.shoppingList.update({
        where: { id: currentInvite.listId },
        data: {
          version: { increment: 1 }
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, currentInvite.listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:invite:accept", userId, null, requestHash, result);
      return result;
    });
  }

  async declineShoppingListInvite(userId: UUID, inviteId: UUID, operationId: OperationId): Promise<ShoppingListInviteActionResponse> {
    const requestHash = String(inviteId);
    const invite = await this.prisma.shoppingListInvite.findUnique({
      where: { id: inviteId },
      select: {
        id: true,
        listId: true,
        targetUserId: true
      }
    });
    if (!invite || invite.targetUserId !== userId) {
      throw new NotFoundException("邀请不存在");
    }
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListInviteActionResponse>(tx, operationId, "shopping-list:invite:decline", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:invite:decline", userId, null, requestHash);
      const currentInvite = await tx.shoppingListInvite.findUnique({
        where: { id: inviteId }
      });
      if (!currentInvite || currentInvite.targetUserId !== userId) {
        throw new NotFoundException("邀请不存在");
      }
      if (currentInvite.status === "DECLINED") {
        const result = {
          inviteId: currentInvite.id,
          status: currentInvite.status,
          updatedAt: toIsoDate(currentInvite.updatedAt)
        } satisfies ShoppingListInviteActionResponse;
        await completeIdempotentOperation(tx, operationId, "shopping-list:invite:decline", userId, null, requestHash, result);
        return result;
      }
      if (currentInvite.status !== "PENDING") {
        throw new BadRequestException("邀请已失效");
      }
      const nextInvite = await tx.shoppingListInvite.update({
        where: { id: inviteId },
        data: {
          status: "DECLINED",
          declinedAt: new Date()
        }
      });
      const result = {
        inviteId: nextInvite.id,
        status: nextInvite.status,
        updatedAt: toIsoDate(nextInvite.updatedAt)
      } satisfies ShoppingListInviteActionResponse;
      await completeIdempotentOperation(tx, operationId, "shopping-list:invite:decline", userId, null, requestHash, result);
      return result;
    });
  }

  async leaveShoppingList(userId: UUID, listId: UUID, operationId: OperationId, version: number): Promise<ShoppingListPageResponse> {
    const requestHash = `${listId}:${version}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListPageResponse>(tx, operationId, "shopping-list:leave", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:leave", userId, null, requestHash);
      const access = await this.assertShoppingListReadable(tx, userId, listId);
      this.assertShoppingListVersion(access.version, version);
      if (access.role !== "COLLABORATOR") {
        throw new BadRequestException("创建者不能退出自己创建的清单");
      }
      await tx.shoppingListMember.delete({
        where: {
          listId_userId: {
            listId,
            userId
          }
        }
      });
      await tx.shoppingList.update({
        where: { id: listId },
        data: {
          version: { increment: 1 }
        }
      });
      const items = await this.loadShoppingListPageFromTx(tx, userId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:leave", userId, null, requestHash, items);
      return items;
    });
  }

  async getShoppingSharePreview(userId: UUID, shareToken: string): Promise<ShoppingSharePreview> {
    return this.prisma.$transaction(async tx => {
      const token = await tx.shoppingShareToken.findFirst({
        where: {
          token: shareToken,
          disabledAt: null
        },
        select: {
          list: {
            select: {
              id: true,
              name: true,
              status: true,
              owner: {
                select: {
                  id: true,
                  uid: true,
                  nickname: true
                }
              },
              _count: {
                select: {
                  members: true,
                  items: true
                }
              },
              members: {
                where: {
                  userId
                },
                select: {
                  role: true
                }
              }
            }
          }
        }
      });
      if (!token) {
        throw new NotFoundException("分享链接不存在");
      }
      const memberLimit = await this.resolveShoppingListMemberLimit(tx, token.list.owner.id);
      const joined = token.list.members.length > 0;
      const canJoin = joined || (token.list.status === "ACTIVE" && token.list._count.members < memberLimit);
      return {
        listId: token.list.id,
        name: token.list.name,
        ownerUid: token.list.owner.uid,
        ownerNickname: token.list.owner.nickname,
        memberCount: token.list._count.members,
        memberLimit,
        joined,
        canJoin,
        itemCount: token.list._count.items,
        status: token.list.status
      };
    });
  }

  async joinShoppingShare(userId: UUID, shareToken: string, operationId: OperationId): Promise<ShoppingListDetail> {
    const requestHash = shareToken;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:share-join", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:share-join", userId, null, requestHash);
      const token = await tx.shoppingShareToken.findFirst({
        where: {
          token: shareToken,
          disabledAt: null
        },
        select: {
          listId: true
        }
      });
      if (!token) {
        throw new NotFoundException("分享链接不存在");
      }
      const list = await tx.shoppingList.findUnique({
        where: { id: token.listId },
        select: {
          id: true,
          ownerUserId: true,
          status: true
        }
      });
      if (!list) {
        throw new NotFoundException("分享链接不存在");
      }
      if (list.status !== "ACTIVE") {
        throw new BadRequestException("当前清单暂不支持继续加入");
      }
      const existing = await tx.shoppingListMember.findUnique({
        where: {
          listId_userId: {
            listId: token.listId,
            userId
          }
        },
        select: { role: true }
      });
      if (!existing) {
        await this.assertShoppingListMemberCapacity(tx, token.listId, list.ownerUserId, [userId]);
        await tx.shoppingListMember.create({
          data: {
            listId: token.listId,
            userId,
            role: "COLLABORATOR",
            addedByUserId: userId
          }
        });
        await tx.shoppingList.update({
          where: { id: token.listId },
          data: {
            version: { increment: 1 }
          }
        });
      }
      await tx.shoppingListInvite.updateMany({
        where: {
          listId: token.listId,
          targetUserId: userId,
          status: "PENDING"
        },
        data: {
          status: "ACCEPTED",
          acceptedByUserId: userId,
          acceptedAt: new Date(),
          declinedAt: null,
          revokedAt: null
        }
      });
      const result = await this.loadShoppingListDetailFromTx(tx, userId, token.listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:share-join", userId, null, requestHash, result);
      return result;
    });
  }

  async previewGap(userId: UUID): Promise<ShoppingGapResponse> {
    const events = await this.prisma.diningEvent.findMany({
        where: {
          userId,
          status: {
            in: ["PLANNED", "CONFIRMED"]
          }
        },
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          updatedAt: true,
          menuItems: {
            select: {
              title: true,
              recipeVersionId: true,
              recipeVersion: {
                select: {
                  ingredientsJson: true
                }
              }
            },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
          }
        }
      });

    return this.buildGapPreview(events, new Date());
  }

  async previewEventGap(userId: UUID, eventId: UUID): Promise<ShoppingGapPreviewItem[]> {
    const lines = await this.loadEventGapSummary(this.prisma, userId, eventId, true);
    const event = await this.prisma.diningEvent.findUnique({
      where: { id: eventId },
      select: { ingredientsReadyAt: true }
    });
    const preparations = await this.prisma.diningEventPreparation.findMany({
      where: { diningEventId: eventId },
      select: { sourceKey: true }
    });
    const sourceKeys = lines.flatMap(line =>
      line.sourceFacts?.length
        ? line.sourceFacts.map(source => buildShoppingDemandFactKey(line.sourceKey, source))
        : [line.sourceKey]
    );
    const boughtKeys = new Set(
      (
        await this.prisma.shoppingItem.findMany({
          where: {
            userId,
            sourceType: "EVENT",
            sourceKey: { in: sourceKeys },
            status: "BOUGHT"
          },
          select: { sourceKey: true }
        })
      ).map(item => item.sourceKey).filter((key): key is string => key !== null)
    );
    const preparedKeys = new Set(preparations.map(item => item.sourceKey));

    return lines.map(item => {
      const itemSourceKeys = item.sourceFacts?.length
        ? item.sourceFacts.map(source => buildShoppingDemandFactKey(item.sourceKey, source))
        : [item.sourceKey];
      const preparationStatus = event?.ingredientsReadyAt
        ? "READY"
        : preparedKeys.has(item.sourceKey)
          ? "HOME"
          : itemSourceKeys.length && itemSourceKeys.every(key => boughtKeys.has(key))
            ? "BOUGHT"
            : "OPEN";
      return { ...this.toShoppingGapPreviewItem(item), preparationStatus };
    });
  }

  async previewPlanGap(userId: UUID, planItemId: UUID): Promise<ShoppingGapPreviewItem[]> {
    return (await this.loadPlanGapSummary(this.prisma, userId, planItemId)).map(item => this.toShoppingGapPreviewItem(item));
  }

  private async loadEventGapSummary(
    db: Pick<Prisma.TransactionClient, "diningEvent">,
    userId: UUID,
    eventId: UUID,
    allowAcceptedParticipant = false
  ): Promise<EventGapSummaryItem[]> {
    const event = await db.diningEvent.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          updatedAt: true,
          menuItems: {
            select: {
              title: true,
              recipeVersionId: true,
              recipeVersion: {
                select: {
                  baseServings: true,
                  ingredientsJson: true
                }
              }
            },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
          },
          participants: allowAcceptedParticipant
            ? { where: { userId, status: "ACCEPTED" }, select: { id: true } }
            : undefined,
          userId: true
        }
      });
    if (!event || (event.userId !== userId && (!allowAcceptedParticipant || !event.participants.length))) {
      throw new NotFoundException("饭局不存在");
    }
    return this.buildLegacyGapSummary([event], "EVENT", "EVENT", String(event.id));
  }

  private async loadPlanGapSummary(
    db: Prisma.TransactionClient,
    userId: UUID,
    planItemId: UUID
  ): Promise<EventGapSummaryItem[]> {
    const plan = await db.mealPlanItem.findUnique({
        where: { id: planItemId },
        select: {
          id: true,
          title: true,
          planDate: true,
          updatedAt: true,
          userId: true,
          dishes: {
            select: {
              recipeId: true,
              recipeVersionId: true
            },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
          }
        }
      });
    if (!plan || plan.userId !== userId) throw new NotFoundException("计划不存在");

    const menuItems = await Promise.all(
      plan.dishes
        .filter((dish): dish is typeof dish & { recipeId: UUID } => dish.recipeId !== null)
        .map(async dish => {
          const source = await this.loadRecipeShoppingSource(db, userId, dish.recipeId, dish.recipeVersionId, true);
          return {
            title: source.title,
            recipeId: source.recipeId,
            recipeVersionId: source.sourceVersionId,
            recipeVersion: {
              baseServings: source.baseServings,
              ingredientsJson: source.ingredients as unknown as Prisma.JsonValue
            }
          };
        })
    );

    return this.buildLegacyGapSummary(
      [{
        id: plan.id,
        title: plan.title,
        scheduledAt: plan.planDate,
        updatedAt: plan.updatedAt,
        menuItems
      }],
      "EVENT",
      "PLAN",
      String(plan.id)
    );
  }

  async addEventGapToShoppingList(userId: UUID, listId: UUID, operationId: OperationId, eventId: UUID): Promise<ShoppingListDetail> {
    const requestHash = `${listId}:${eventId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:item:event-gap", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:event-gap", userId, null, requestHash);
      const access = await this.assertShoppingListWritable(tx, userId, listId);
      const preview = await this.loadEventGapSummary(tx, userId, eventId);
      if (!preview.length) {
        throw new BadRequestException("当前饭局没有可写入采购清单的食材");
      }

      const batchKey = String(operationId);
      const writes: EventGapSummaryItem[] = [];
      for (const item of preview) {
        for (const fact of this.buildShoppingDemandWriteItems(item, batchKey)) {
          const existing = await tx.shoppingItem.findFirst({
            where: {
              listId,
              sourceType: "EVENT",
              sourceKey: fact.sourceKey
            }
          });
          if (!existing) writes.push(fact);
        }
      }

      const sizeBytes = writes.reduce(
        (total, item) =>
          total +
          sizeOfJson({
            userId: access.ownerUserId,
            listId,
            name: item.name,
            quantityText: item.quantityText,
            note: item.note,
            sourceType: "EVENT",
            sourceKey: item.sourceKey,
            sourceRecipeId: item.sourceRecipeId,
            sourceRecipeVersionId: item.sourceRecipeVersionId,
            sourceRecipeTitle: item.sourceRecipeTitle,
            sourceBaseServings: item.sourceBaseServings,
            sourceBatchKey: item.sourceBatchKey,
            sourceIngredientSort: item.sourceIngredientSort,
            ingredientId: item.ingredientId,
            amountJson: item.amountJson
          }),
        0
      );
      await this.assertStorageWritable(tx, access.ownerUserId, sizeBytes);

      let mutated = false;
      for (const item of writes) {
        const created = await tx.shoppingItem.create({
          data: {
            userId: access.ownerUserId,
            listId,
            name: item.name,
            quantityText: item.quantityText,
            note: item.note,
            sourceType: "EVENT",
            sourceKey: item.sourceKey,
            sourceRecipeId: item.sourceRecipeId,
            sourceRecipeVersionId: item.sourceRecipeVersionId,
            sourceRecipeTitle: item.sourceRecipeTitle,
            sourceBaseServings: item.sourceBaseServings,
            sourceBatchKey: item.sourceBatchKey,
            sourceIngredientSort: item.sourceIngredientSort,
            ingredientId: item.ingredientId,
            amountJson: item.amountJson ?? Prisma.DbNull
          }
        });
        mutated = true;
        await upsertStorageLedger(tx, access.ownerUserId, "SHOPPING", created.id, sizeOfJson(created));
      }

      if (mutated) {
        await tx.shoppingList.update({
          where: { id: listId },
          data: {
            version: { increment: 1 }
          }
        });
      }
      await this.bindDiningEventShoppingList(tx, userId, eventId, listId);

      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:event-gap", userId, null, requestHash, result);
      return result;
    });
  }

  async addGapItemsToShoppingList(
    userId: UUID,
    listId: UUID,
    operationId: OperationId,
    window: ShoppingGapWindow,
    gapKeys: string[]
  ): Promise<ShoppingListDetail> {
    const uniqueGapKeys = Array.from(new Set(gapKeys.map(item => item.trim()).filter(Boolean)));
    if (!uniqueGapKeys.length) {
      throw new BadRequestException("请选择要加入清单的缺口");
    }
    const requestHash = `${listId}:${window}:${uniqueGapKeys.join(",")}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<ShoppingListDetail>(tx, operationId, "shopping-list:item:gap", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "shopping-list:item:gap", userId, null, requestHash);
      const access = await this.assertShoppingListWritable(tx, userId, listId);
      const events = await tx.diningEvent.findMany({
          where: {
            userId,
            status: {
              in: ["PLANNED", "CONFIRMED"]
            }
          },
          orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            title: true,
            scheduledAt: true,
            updatedAt: true,
            menuItems: {
              select: {
                title: true,
                recipeVersionId: true,
                recipeVersion: {
                  select: {
                    ingredientsJson: true
                  }
                }
              },
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
            }
          }
        });
      const selectedGroups = this.buildLegacyGapSummary(
        events.filter(event => resolveGapWindow(event.scheduledAt, new Date()) === window),
        "ALL",
        "EVENT"
      ).filter(item => uniqueGapKeys.includes(item.sourceKey ?? ""));
      if (!selectedGroups.length) {
        throw new BadRequestException("选中的需求已失效，请刷新后重试");
      }

      const batchKey = String(operationId);
      const writes: EventGapSummaryItem[] = [];
      for (const item of selectedGroups) {
        for (const fact of this.buildShoppingDemandWriteItems(item, batchKey)) {
          const existing = await tx.shoppingItem.findFirst({
            where: {
              listId,
              sourceType: "EVENT",
              sourceKey: fact.sourceKey
            }
          });
          if (!existing) writes.push(fact);
        }
      }

      const sizeBytes = writes.reduce(
        (total, item) =>
          total +
          sizeOfJson({
            userId: access.ownerUserId,
            listId,
            name: item.name,
            quantityText: item.quantityText,
            note: item.note,
            sourceType: "EVENT",
            sourceKey: item.sourceKey,
            sourceRecipeId: item.sourceRecipeId,
            sourceRecipeVersionId: item.sourceRecipeVersionId,
            sourceRecipeTitle: item.sourceRecipeTitle,
            sourceBaseServings: item.sourceBaseServings,
            sourceBatchKey: item.sourceBatchKey,
            sourceIngredientSort: item.sourceIngredientSort,
            ingredientId: item.ingredientId,
            amountJson: item.amountJson
          }),
        0
      );
      await this.assertStorageWritable(tx, access.ownerUserId, sizeBytes);

      let mutated = false;
      for (const item of writes) {
        const created = await tx.shoppingItem.create({
          data: {
            userId: access.ownerUserId,
            listId,
            name: item.name,
            quantityText: item.quantityText,
            note: item.note,
            sourceType: "EVENT",
            sourceKey: item.sourceKey,
            sourceRecipeId: item.sourceRecipeId,
            sourceRecipeVersionId: item.sourceRecipeVersionId,
            sourceRecipeTitle: item.sourceRecipeTitle,
            sourceBaseServings: item.sourceBaseServings,
            sourceBatchKey: item.sourceBatchKey,
            sourceIngredientSort: item.sourceIngredientSort,
            ingredientId: item.ingredientId,
            amountJson: item.amountJson ?? Prisma.DbNull
          }
        });
        mutated = true;
        await upsertStorageLedger(tx, access.ownerUserId, "SHOPPING", created.id, sizeOfJson(created));
      }

      if (mutated) {
        await tx.shoppingList.update({
          where: { id: listId },
          data: {
            version: { increment: 1 }
          }
        });
      }

      const result = await this.loadShoppingListDetailFromTx(tx, userId, listId);
      await completeIdempotentOperation(tx, operationId, "shopping-list:item:gap", userId, null, requestHash, result);
      return result;
    });
  }

  private normalizeShoppingListStatus(value?: string) {
    if (!value) return null;
    if (value !== "ACTIVE" && value !== "COMPLETED" && value !== "VOIDED") {
      throw new BadRequestException("购物清单状态参数错误");
    }
    return value;
  }

  private normalizeShoppingListName(value: string | null | undefined) {
    const normalized = value?.trim() ?? "";
    if (!normalized) return this.buildDefaultShoppingListName();
    if (normalized.length > 20) {
      throw new BadRequestException("清单名称过长");
    }
    return normalized;
  }

  private buildDefaultShoppingListName(date = new Date()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 · 采购清单`;
  }

  private assertShoppingListVersion(currentVersion: number, expectedVersion: number) {
    if (currentVersion !== expectedVersion) {
      throw new ConflictException("清单已被他人更新，请刷新后重试");
    }
  }

  private async createShoppingListInTx(
    tx: Prisma.TransactionClient,
    ownerUserId: UUID,
    addedByUserId: UUID,
    name: string
  ) {
    const list = await tx.shoppingList.create({
      data: {
        ownerUserId,
        name,
        members: {
          create: {
            userId: ownerUserId,
            role: "OWNER",
            addedByUserId
          }
        }
      }
    });
    return list;
  }

  private async assertShoppingListReadable(tx: Prisma.TransactionClient, userId: UUID, listId: UUID) {
    const list = await tx.shoppingList.findFirst({
      where: {
        id: listId,
        members: {
          some: {
            userId
          }
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        version: true,
        ownerUserId: true,
        members: {
          where: {
            userId
          },
          select: {
            role: true
          }
        }
      }
    });
    if (!list || !list.members.length) {
      throw new NotFoundException("购物清单不存在");
    }
    return {
      id: list.id,
      name: list.name,
      status: list.status,
      version: list.version,
      ownerUserId: list.ownerUserId,
      role: list.members[0].role
    };
  }

  private async assertShoppingListOwner(tx: Prisma.TransactionClient, userId: UUID, listId: UUID) {
    const access = await this.assertShoppingListReadable(tx, userId, listId);
    if (access.role !== "OWNER") {
      throw new ForbiddenException("只有创建者可以执行该操作");
    }
    return access;
  }

  private async assertShoppingListWritable(tx: Prisma.TransactionClient, userId: UUID, listId: UUID) {
    const access = await this.assertShoppingListReadable(tx, userId, listId);
    if (access.status !== "ACTIVE") {
      throw new BadRequestException("当前清单不是采购中状态");
    }
    return access;
  }

  private async loadShoppingListItemPatchFromTx(
    tx: Prisma.TransactionClient,
    userId: UUID,
    listId: UUID,
    changedItemId: UUID | null,
    removedItemId: UUID | null
  ): Promise<ShoppingListItemPatchResponse> {
    const access = await this.assertShoppingListReadable(tx, userId, listId);
    const items = changedItemId === null
      ? [] as ShoppingDetailItemRow[]
      : await tx.shoppingItem.findMany({
          where: { listId, status: { not: "DELETED" } },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: shoppingDetailItemSelect
        });
    if (changedItemId !== null && !items.some(item => item.id === changedItemId)) {
      throw new NotFoundException("购物项不存在");
    }
    const sourceMeta = changedItemId === null
      ? null
      : await this.loadShoppingSourceMeta(tx, items);
    const itemMap = changedItemId === null
      ? null
      : this.buildShoppingListDetailItemMap(items, sourceMeta!);
    const progress = this.buildShoppingListProgress(items);
    return {
      listId,
      version: access.version,
      progressDoneCount: progress.progressDoneCount,
      progressTotalCount: progress.progressTotalCount,
      item: changedItemId === null ? null : itemMap?.get(changedItemId) ?? null,
      removedItemId
    };
  }

  private async loadShoppingListPageFromTx(
    tx: Prisma.TransactionClient,
    userId: UUID,
    status?: "ACTIVE" | "COMPLETED" | "VOIDED" | null
  ): Promise<ShoppingListPageResponse> {
    const lists = await tx.shoppingList.findMany({
      where: {
        ...(status ? { status } : {}),
        members: {
          some: {
            userId
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        name: true,
        status: true,
        ownerUserId: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        voidedAt: true,
        owner: {
          select: {
            uid: true,
            nickname: true
          }
        },
        members: {
          where: {
            userId
          },
          select: {
            role: true
          }
        },
        _count: {
          select: {
            members: true,
            invites: {
              where: {
                status: "PENDING"
              }
            }
          }
        },
        shareTokens: {
          where: {
            disabledAt: null
          },
          select: {
            id: true
          }
        },
        items: {
          where: {
            status: {
              not: "DELETED"
            }
          },
          select: {
            ingredientId: true,
            name: true,
            status: true,
          }
        }
      }
    });
    return {
      items: await Promise.all(lists.map(list => this.toShoppingListSummary(tx, list)))
    };
  }

  private async loadShoppingListDetailFromTx(tx: Prisma.TransactionClient, userId: UUID, listId: UUID): Promise<ShoppingListDetail> {
    const list = await tx.shoppingList.findFirst({
      where: {
        id: listId,
        members: {
          some: {
            userId
          }
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        ownerUserId: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        voidedAt: true,
        owner: {
          select: {
            uid: true,
            nickname: true
          }
        },
        members: {
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }, { id: "asc" }],
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                uid: true,
                nickname: true,
                avatarUrl: true
              }
            }
          }
        },
        _count: {
          select: {
            members: true,
            invites: {
              where: {
                status: "PENDING"
              }
            }
          }
        },
        shareTokens: {
          where: {
            disabledAt: null
          },
          select: {
            id: true
          }
        },
        items: {
          where: {
            status: {
              not: "DELETED"
            }
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: shoppingDetailItemSelect
        }
      }
    });
    if (!list || !list.members.length) {
      throw new NotFoundException("购物清单不存在");
    }
    const currentMember = list.members.find(member => member.userId === userId);
    if (!currentMember) {
      throw new NotFoundException("购物清单不存在");
    }
    const sourceMeta = await this.loadShoppingSourceMeta(tx, list.items);
    const detailItemMap = this.buildShoppingListDetailItemMap(list.items, sourceMeta);
    return {
      ...(await this.toShoppingListSummary(tx, {
        ...list,
        members: [{ role: currentMember.role }]
      })),
      collaborators: list.members.map(member => this.toShoppingListCollaborator(member)),
      items: list.items.map(item => detailItemMap.get(item.id)!)
    };
  }

  private async assertPlanShoppingSource(
    tx: Prisma.TransactionClient,
    userId: UUID,
    planItemId: UUID,
    recipeId: UUID,
    sourceVersionId: UUID
  ) {
    const plan = await tx.mealPlanItem.findFirst({
      where: {
        id: planItemId,
        userId
      },
      select: {
        id: true,
        dishes: {
          where: {
            recipeId,
            recipeVersionId: sourceVersionId
          },
          select: {
            id: true
          },
          take: 1
        }
      }
    });
    if (!plan) {
      throw new NotFoundException("计划不存在");
    }
    if (!plan.dishes.length) {
      throw new BadRequestException("计划里的菜谱已变更，请刷新后重试");
    }
  }

  private async bindMealPlanShoppingList(
    tx: Prisma.TransactionClient,
    userId: UUID,
    planItemId: UUID,
    listId: UUID
  ) {
    await tx.$queryRaw`SELECT "id" FROM "meal_plan_items" WHERE "id" = ${planItemId} AND "user_id" = ${userId} FOR UPDATE`;
    const plan = await tx.mealPlanItem.findFirst({
      where: {
        id: planItemId,
        userId
      },
      select: {
        id: true,
        shoppingListId: true
      }
    });
    if (!plan) {
      throw new NotFoundException("计划不存在");
    }

    const targetList = await tx.shoppingList.findUnique({
      where: { id: listId },
      select: { status: true }
    });
    if (!targetList || targetList.status !== "ACTIVE") {
      throw new ConflictException("当前采购清单不可继续加入需求");
    }

    if (plan.shoppingListId && plan.shoppingListId !== listId) {
      const previousList = await tx.shoppingList.findUnique({
        where: { id: plan.shoppingListId },
        select: { status: true }
      });
      if (previousList?.status === "ACTIVE") {
        throw new ConflictException("当前餐次已绑定其他采购清单");
      }
    }
    if (plan.shoppingListId === listId) {
      return;
    }
    await tx.mealPlanItem.update({
      where: {
        id: plan.id
      },
      data: {
        shoppingListId: listId
      }
    });
  }

  private async bindDiningEventShoppingList(
    tx: Prisma.TransactionClient,
    userId: UUID,
    eventId: UUID,
    listId: UUID
  ) {
    const event = await tx.diningEvent.findFirst({
      where: {
        id: eventId,
        userId
      },
      select: {
        mealPlanItemId: true
      }
    });
    if (!event) {
      throw new NotFoundException("饭局不存在");
    }
    if (!event.mealPlanItemId) {
      return;
    }
    await this.bindMealPlanShoppingList(tx, userId, event.mealPlanItemId, listId);
  }

  private async loadShoppingSourceMeta(
    tx: Prisma.TransactionClient,
    items: Array<Pick<ShoppingDetailItemRow, "sourceType" | "sourceKey" | "sourceRecipeId">>
  ): Promise<ShoppingSourceMeta> {
    const planIds = new Set<UUID>();
    const eventIds = new Set<UUID>();
    const recipeIds = new Set<UUID>();
    for (const item of items) {
      if (item.sourceRecipeId) {
        recipeIds.add(item.sourceRecipeId);
      }
      if (item.sourceType === "PLAN" && item.sourceKey) {
        const planItemId = parseShoppingSourceId(item.sourceKey);
        if (planItemId !== null) planIds.add(planItemId);
        continue;
      }
      if (item.sourceType === "EVENT" && item.sourceKey) {
        const eventId = parseShoppingSourceId(item.sourceKey);
        if (eventId !== null) eventIds.add(eventId);
      }
    }

    const [plans, events, recipes] = await Promise.all([
      planIds.size
        ? tx.mealPlanItem.findMany({
            where: {
              id: {
                in: [...planIds]
              }
            },
            select: {
              id: true,
              title: true,
              planDate: true
            }
          })
        : Promise.resolve([]),
      eventIds.size
        ? tx.diningEvent.findMany({
            where: {
              id: {
                in: [...eventIds]
              }
            },
            select: {
              id: true,
              title: true,
              mealPlanItemId: true,
              mealPlanItem: {
                select: {
                  planDate: true
                }
              }
            }
          })
        : Promise.resolve([]),
      recipeIds.size
        ? tx.recipe.findMany({
            where: {
              id: {
                in: [...recipeIds]
              }
            },
            select: {
              id: true,
              isInspiration: true
            }
          })
        : Promise.resolve([])
    ]);

    return {
      planMap: new Map(
        plans.map(item => [
          item.id,
          {
            title: item.title,
            planDate: item.planDate.toISOString().slice(0, 10)
          }
        ])
      ),
      eventMap: new Map(
        events.map(item => [
          item.id,
          {
            title: item.title,
            planItemId: item.mealPlanItemId,
            planDate: item.mealPlanItem?.planDate ? item.mealPlanItem.planDate.toISOString().slice(0, 10) : null
          }
        ])
      ),
      recipeMap: new Map(
        recipes.map(item => [
          item.id,
          item.isInspiration ? "inspiration" as const : "my" as const
        ])
      )
    };
  }

  private async toShoppingListSummary(tx: EntitlementReader, list: {
    id: UUID;
    name: string;
    status: "ACTIVE" | "COMPLETED" | "VOIDED";
    ownerUserId: UUID;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
    voidedAt: Date | null;
    owner: { uid: number; nickname: string | null };
    members: Array<{ role: "OWNER" | "COLLABORATOR" }>;
    _count: { members: number; invites: number };
    shareTokens: Array<{ id: UUID }>;
    items: ShoppingListProgressRow[];
  }): Promise<ShoppingListSummary> {
    const { progressDoneCount, progressTotalCount } = this.buildShoppingListProgress(list.items);
    const memberLimit = await this.resolveShoppingListMemberLimit(tx, list.ownerUserId);
    return {
      id: list.id,
      name: list.name,
      status: list.status,
      role: list.members[0]?.role ?? "COLLABORATOR",
      ownerUid: list.owner.uid,
      ownerNickname: list.owner.nickname,
      memberCount: list._count.members,
      memberLimit,
      pendingInviteCount: list._count.invites,
      progressDoneCount,
      progressTotalCount,
      hasActiveShareLink: list.shareTokens.length > 0,
      version: list.version,
      createdAt: toIsoDate(list.createdAt),
      updatedAt: toIsoDate(list.updatedAt),
      completedAt: list.completedAt ? toIsoDate(list.completedAt) : null,
      voidedAt: list.voidedAt ? toIsoDate(list.voidedAt) : null
    };
  }

  private buildShoppingListProgress(items: ShoppingListProgressRow[]) {
    const bucket = new Map<string, ShoppingListProgressRow[]>();
    for (const item of items) {
      if (item.status === "DELETED") continue;
      const key = this.buildShoppingItemGroupKey(item);
      const current = bucket.get(key) ?? [];
      current.push(item);
      bucket.set(key, current);
    }
    let progressDoneCount = 0;
    for (const groupItems of bucket.values()) {
      if (groupItems.every(item => item.status === "BOUGHT")) {
        progressDoneCount += 1;
      }
    }
    return {
      progressDoneCount,
      progressTotalCount: bucket.size
    };
  }

  private async toShoppingListInviteSummary(tx: EntitlementReader, invite: {
    id: UUID;
    status: ShoppingListInviteStatus;
    createdAt: Date;
    acceptedAt: Date | null;
    declinedAt: Date | null;
    list: {
      id: UUID;
      name: string;
      status: "ACTIVE" | "COMPLETED" | "VOIDED";
      ownerUserId: UUID;
      owner: { uid: number; nickname: string | null };
      _count: {
        members: number;
        items: number;
      };
      members: Array<{ role: "OWNER" | "COLLABORATOR" }>;
    };
  }): Promise<ShoppingListInviteSummary> {
    const memberLimit = await this.resolveShoppingListMemberLimit(tx, invite.list.ownerUserId);
    return {
      id: invite.id,
      listId: invite.list.id,
      name: invite.list.name,
      ownerUid: invite.list.owner.uid,
      ownerNickname: invite.list.owner.nickname,
      memberCount: invite.list._count.members,
      memberLimit,
      itemCount: invite.list._count.items,
      status: invite.list.status,
      inviteStatus: invite.status,
      canJoin: invite.list.status === "ACTIVE" && invite.list.members.length === 0 && invite.list._count.members < memberLimit,
      invitedAt: toIsoDate(invite.createdAt),
      handledAt: invite.acceptedAt ? toIsoDate(invite.acceptedAt) : invite.declinedAt ? toIsoDate(invite.declinedAt) : null
    };
  }

  private buildShoppingListInviteWhere(
    userId: UUID,
    filter: ShoppingListInviteFilter,
    cutoffAt: Date,
    preservePendingHome: boolean
  ): Prisma.ShoppingListInviteWhereInput {
    if (filter === "PENDING") {
      const pendingWhere: Prisma.ShoppingListInviteWhereInput = {
        targetUserId: userId,
        status: "PENDING",
        list: {
          status: "ACTIVE"
        }
      };
      if (!preservePendingHome) {
        pendingWhere.createdAt = {
          gte: cutoffAt
        };
      }
      return {
        ...pendingWhere
      };
    }

    if (filter === "RESOLVED") {
      return {
        targetUserId: userId,
        OR: [
          {
            status: "ACCEPTED",
            acceptedAt: {
              gte: cutoffAt
            }
          },
          {
            status: "DECLINED",
            declinedAt: {
              gte: cutoffAt
            }
          }
        ]
      };
    }

    return {
      targetUserId: userId,
      OR: [
        {
          status: "PENDING",
          createdAt: {
            gte: cutoffAt
          },
          list: {
            status: "ACTIVE"
          }
        },
        {
          status: "ACCEPTED",
          acceptedAt: {
            gte: cutoffAt
          }
        },
        {
          status: "DECLINED",
          declinedAt: {
            gte: cutoffAt
          }
        }
      ]
    };
  }

  private toShoppingItemSourceSummary(item: {
    sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
    note: string | null;
    sourceKey: string | null;
    sourceRecipeId: UUID | null;
    sourceRecipeVersionId: UUID | null;
    sourceRecipeTitle: string | null;
    sourceBaseServings: number | null;
    sourceBatchKey: string | null;
  }, sourceMeta: ShoppingSourceMeta): ShoppingItemSourceSummary {
    const planItemId = item.sourceType === "PLAN" ? parseShoppingSourceId(item.sourceKey) : null;
    const diningEventId = item.sourceType === "EVENT" ? parseShoppingSourceId(item.sourceKey) : null;
    const planMeta = planItemId ? sourceMeta.planMap.get(planItemId) ?? null : null;
    const eventMeta = diningEventId ? sourceMeta.eventMap.get(diningEventId) ?? null : null;
    const recipeKind = item.sourceRecipeId ? sourceMeta.recipeMap.get(item.sourceRecipeId) ?? null : null;
    let title = item.sourceRecipeTitle ?? item.note ?? null;
    let planDate: string | null = null;
    if (item.sourceType === "PLAN") {
      title = planMeta?.title ?? title;
      planDate = planMeta?.planDate ?? null;
    } else if (item.sourceType === "EVENT") {
      title = eventMeta?.title ?? title;
      planDate = eventMeta?.planDate ?? null;
    }
    return {
      sourceType: item.sourceType,
      title,
      recipeId: item.sourceRecipeId,
      recipeKind,
      sourceVersionId: item.sourceRecipeVersionId,
      planItemId: item.sourceType === "EVENT" ? eventMeta?.planItemId ?? null : planItemId,
      planDate,
      diningEventId,
      sourceBatchKey: item.sourceBatchKey,
      addCount: item.sourceType === "RECIPE" && item.sourceBatchKey ? 1 : null,
      servings: item.sourceBaseServings
    };
  }

  private normalizePantryFields(name: string, quantityText?: string | null, note?: string | null) {
    const normalizedName = name.trim();
    if (!normalizedName) throw new BadRequestException("名称不能为空");
    return {
      name: normalizedName,
      quantityText: quantityText?.trim() || null,
      note: note?.trim() || null
    };
  }

  private buildShoppingItemGroupKey(item: { ingredientId: UUID | null; name: string }) {
    return `${item.ingredientId ?? "none"}:${normalizeNameKey(item.name)}`;
  }

  private async assertStorageWritable(tx: Prisma.TransactionClient, userId: UUID, expectedDeltaBytes: number) {
    const entitlements = await this.entitlementService.resolveForUser(tx, userId);
    const current = await tx.storageLedger.aggregate({
      where: { userId },
      _sum: { usedBytes: true }
    });
    const usedBytes = current._sum.usedBytes ?? 0;
    if (usedBytes > entitlements.storageLimitBytes) {
      throw new ForbiddenException("当前个人空间已超额，只允许清理和查看");
    }
    if (usedBytes + expectedDeltaBytes > entitlements.storageLimitBytes) {
      throw new ForbiddenException("当前个人空间不足");
    }
  }

  private buildShoppingListDetailItemMap(items: ShoppingDetailItemRow[], sourceMeta: ShoppingSourceMeta) {
    const result = new Map<UUID, ShoppingListDetailItem>();
    for (const item of items) {
      result.set(item.id, this.toShoppingListDetailItem(item, sourceMeta));
    }
    return result;
  }

  private toShoppingListDetailItem(item: ShoppingDetailItemRow, sourceMeta: ShoppingSourceMeta): ShoppingListDetailItem {
    return {
      id: item.id,
      ingredientId: item.ingredientId,
      name: item.name,
      categoryName: item.ingredient?.category.name ?? null,
      imageUrl: item.ingredient ? this.ingredientImageService.buildImageUrl({}, item.ingredient.id, item.ingredient.imageUpdatedAt) : null,
      quantityText: item.quantityText,
      note: item.note,
      status: toListItemStatus(item.status),
      checkedAt: item.checkedAt ? toIsoDate(item.checkedAt) : null,
      updatedAt: toIsoDate(item.updatedAt),
      sources: [this.toShoppingItemSourceSummary(item, sourceMeta)]
    };
  }

  private toShoppingListCollaborator(member: {
    userId: UUID;
    role: "OWNER" | "COLLABORATOR";
    joinedAt: Date;
    user: {
      uid: number;
      nickname: string | null;
      avatarUrl: string | null;
    };
  }): ShoppingListCollaborator {
    return {
      userId: member.userId,
      role: member.role,
      joinedAt: toIsoDate(member.joinedAt),
      user: {
        uid: member.user.uid,
        nickname: member.user.nickname,
        avatarUrl: member.user.avatarUrl
      }
    };
  }

  private async resolveShoppingListMemberLimit(tx: EntitlementReader, ownerUserId: UUID) {
    const tier = await this.entitlementService.getTier(tx, ownerUserId);
    return policy.shoppingListMemberLimit[tier];
  }

  private async resolveShoppingListInviteMessageDays(tx: EntitlementReader, userId: UUID) {
    const tier = await this.entitlementService.getTier(tx, userId);
    return policy.shoppingListInviteMessageDays[tier];
  }

  private async assertShoppingListMemberCapacity(
    tx: Prisma.TransactionClient,
    listId: UUID,
    ownerUserId: UUID,
    targetUserIds: UUID[]
  ) {
    if (!targetUserIds.length) return;
    const memberLimit = await this.resolveShoppingListMemberLimit(tx, ownerUserId);
    const members = await tx.shoppingListMember.findMany({
      where: { listId },
      select: {
        userId: true
      }
    });
    const memberIds = new Set(members.map(item => item.userId));
    const nextNewCount = targetUserIds.filter(userId => !memberIds.has(userId)).length;
    if (memberIds.size + nextNewCount > memberLimit) {
      throw new ConflictException("协作者已满");
    }
  }

  private async assertShoppingListInviteCapacity(
    tx: EntitlementReader,
    ownerUserId: UUID,
    memberCount: number,
    nextInviteCount: number
  ) {
    if (!nextInviteCount) return;
    const memberLimit = await this.resolveShoppingListMemberLimit(tx, ownerUserId);
    if (memberCount >= memberLimit) {
      throw new ConflictException("协作者已满");
    }
  }

  private async closeShoppingShareInTx(tx: Prisma.TransactionClient, listId: UUID) {
    const now = new Date();
    await tx.shoppingShareToken.updateMany({
      where: {
        listId,
        disabledAt: null
      },
      data: {
        disabledAt: now
      }
    });
    await tx.shoppingListInvite.updateMany({
      where: {
        listId,
        status: "PENDING"
      },
      data: {
        status: "REVOKED",
        revokedAt: now
      }
    });
  }

  private async currentShoppingIngredients(
    tx: Prisma.TransactionClient,
    ingredients: RecipeContentSnapshot["ingredients"]
  ): Promise<RecipeContentSnapshot["ingredients"]> {
    const ingredientIds = Array.from(new Set(ingredients.map(item => item.ingredientId)));
    const rows = ingredientIds.length === 0
      ? []
      : await tx.ingredient.findMany({
          where: { id: { in: ingredientIds } },
          include: { mergedTo: true }
        });
    const rowMap = new Map(rows.map(item => [item.id, item]));
    return ingredients.map(item => {
      const row = rowMap.get(item.ingredientId);
      if (!row) throw new BadRequestException(`菜谱食材“${item.ingredientName}”已不存在，暂不能加入采购清单`);
      if (row.status === "ACTIVE") return item;
      if (row.status !== "MERGED") {
        throw new BadRequestException(`菜谱食材“${item.ingredientName}”当前不可用，暂不能加入采购清单`);
      }
      const target = row.mergedTo;
      if (!target || target.ownerId !== null || target.status !== "ACTIVE") {
        throw new ConflictException(`菜谱食材“${item.ingredientName}”的归并目标无效`);
      }
      return {
        ...item,
        ingredientId: target.id,
        ingredientName: target.name,
        source: "SYSTEM",
        categoryId: target.categoryId
      };
    });
  }

  private async loadRecipeShoppingSource(
    tx: Prisma.TransactionClient,
    userId: UUID,
    recipeId: UUID,
    sourceVersionId: UUID,
    allowHistoricalVersion = false
  ): Promise<RecipeShoppingSource> {
    const recipe = await tx.recipe.findUnique({
      where: { id: recipeId },
      select: {
        id: true,
        ownerId: true,
        isInspiration: true,
        status: true,
        currentVersionId: true,
        inspirationCategoryId: true
      }
    });
    if (!recipe) {
      throw new NotFoundException("菜谱不存在");
    }

    if (allowHistoricalVersion) {
      const version = await tx.recipeContentVersion.findUnique({
        where: { id: sourceVersionId },
        select: {
          id: true,
          name: true,
          story: true,
          baseServings: true,
          difficulty: true,
          duration: true,
          estimatedCalories: true,
          tips: true,
          ingredientsJson: true,
          stepsJson: true
        }
      });
      if (!version) {
        throw new NotFoundException("菜谱版本不存在");
      }
      const content = versionToContent(version);
      return {
        recipeId,
        sourceVersionId,
        title: content.name,
        baseServings: content.baseServings,
        ingredients: await this.currentShoppingIngredients(tx, content.ingredients)
      };
    }

    if (recipe.status !== "ACTIVE") {
      throw new NotFoundException("菜谱不存在");
    }

    const isOwnedCurrent = recipe.ownerId === userId && recipe.currentVersionId === sourceVersionId;
    const isPublicCurrent = isPublicInspirationRecipe(recipe) && recipe.currentVersionId === sourceVersionId;
    const hasCollection = isOwnedCurrent || isPublicCurrent
      ? true
      : Boolean(
          await tx.recipeCollection.findFirst({
            where: {
              userId,
              sourceRecipeId: recipeId,
              sourceVersionId
            },
            select: { id: true }
          })
        );

    if (!isOwnedCurrent && !isPublicCurrent && !hasCollection) {
      throw new NotFoundException("菜谱不存在");
    }

    const version = await tx.recipeContentVersion.findUnique({
      where: { id: sourceVersionId },
      select: {
        id: true,
        name: true,
        story: true,
        baseServings: true,
        difficulty: true,
        duration: true,
        estimatedCalories: true,
        tips: true,
        ingredientsJson: true,
        stepsJson: true
      }
    });
    if (!version) {
      throw new NotFoundException("菜谱版本不存在");
    }

    const content = versionToContent(version);
    return {
      recipeId,
      sourceVersionId,
      title: content.name,
      baseServings: content.baseServings,
      ingredients: await this.currentShoppingIngredients(tx, content.ingredients)
    };
  }

  private buildGapPreview(events: GapEvent[], now: Date): ShoppingGapResponse {
    const activeEvents = events.filter(event => resolveGapWindow(event.scheduledAt, now) !== null);
    const totalEventIds = new Set(activeEvents.map(event => String(event.id)));
    const sections = (["NEXT_48_HOURS", "NEXT_7_DAYS", "LATER"] as ShoppingGapWindow[]).map(window => {
      const sectionEvents = activeEvents.filter(event => resolveGapWindow(event.scheduledAt, now) === window);
      const items = buildShoppingDemandLines(this.buildDemandSources(sectionEvents)).map(line => ({
        key: line.sourceKey,
        ingredientId: line.ingredientId,
        name: line.ingredientName,
        quantityText: line.quantityText,
        sourceCount: line.sourceCount,
        eventCount: line.events.length,
        events: line.events
          .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime() || left.sourceId - right.sourceId)
          .map(event => ({
            eventId: event.sourceId,
            title: event.title,
            scheduledAt: toIsoDate(event.scheduledAt),
            recipeTitles: event.recipeTitles
          }))
      }));
      return {
        window,
        title: gapWindowMeta[window].title,
        description: gapWindowMeta[window].description,
        itemCount: items.length,
        eventCount: new Set(items.flatMap(item => item.events.map(event => String(event.eventId)))).size,
        items
      };
    });
    const laterSection = sections.find(section => section.window === "LATER");
    return {
      sections,
      totalItemCount: sections.reduce((sum, section) => sum + section.itemCount, 0),
      totalEventCount: totalEventIds.size,
      hasLater: Boolean(laterSection?.itemCount),
      laterItemCount: laterSection?.itemCount ?? 0
    };
  }

  private buildLegacyGapSummary(
    events: GapEvent[],
    mode: "ALL" | "EVENT",
    sourceType: "PLAN" | "EVENT" = "EVENT",
    scopeKey?: string
  ): EventGapSummaryItem[] {
    const lines = buildShoppingDemandLines(
      this.buildDemandSources(events),
      mode === "EVENT" ? scopeKey ?? String(events[0]?.id ?? "unknown") : undefined
    );
    return lines.map((line, index) => ({
      id: -(index + 1),
      name: line.ingredientName,
      quantityText: line.quantityText,
      note: mode === "EVENT" ? line.sourceTitle || "来自菜单" : "来自待处理饭局菜单",
      sourceCount: line.sourceCount,
      sourceTitles: line.sourceTitles,
      sourceType,
      sourceKey: line.sourceKey,
      status: "OPEN" as const,
      preparationStatus: "OPEN" as const,
      updatedAt: toIsoDate(line.updatedAt),
      ingredientId: line.ingredientId,
      amountJson: line.amount as Prisma.InputJsonValue,
      sourceRecipeId: line.recipeId,
      sourceRecipeVersionId: line.sourceVersionId,
      sourceRecipeTitle: line.recipeTitle,
      sourceBaseServings: line.baseServings,
      sourceIngredientSort: line.ingredientSort,
      sourceFacts: line.sourceFacts
    }));
  }

  private buildShoppingDemandWriteItems(item: EventGapSummaryItem, batchKey: string): EventGapSummaryItem[] {
    if (!item.sourceFacts?.length) {
      return [{
        ...item,
        ...(item.sourceType === "EVENT"
          ? {
              sourceRecipeId: null,
              sourceRecipeVersionId: null,
              sourceRecipeTitle: null,
              sourceBaseServings: null,
              sourceBatchKey: null,
              sourceIngredientSort: null
            }
          : { sourceBatchKey: batchKey })
      }];
    }

    return item.sourceFacts.map(source => ({
      ...item,
      sourceKey: buildShoppingDemandFactKey(item.sourceKey, source),
      name: source.ingredientName,
      quantityText: formatRecipeAmount(source.amount),
      note: source.recipeTitle || item.note,
      sourceRecipeId: item.sourceType === "EVENT" ? null : source.recipeId,
      sourceRecipeVersionId: item.sourceType === "EVENT" ? null : source.sourceVersionId,
      sourceRecipeTitle: item.sourceType === "EVENT" ? null : source.recipeTitle || null,
      sourceBaseServings: item.sourceType === "EVENT" ? null : source.baseServings,
      sourceBatchKey: item.sourceType === "EVENT" ? null : batchKey,
      sourceIngredientSort: item.sourceType === "EVENT" ? null : source.ingredientSort,
      ingredientId: source.ingredientId,
      amountJson: source.amount as Prisma.InputJsonValue
    }));
  }

  private buildDemandSources(events: GapEvent[]): ShoppingDemandSource[] {
    return events.flatMap(event => event.menuItems.flatMap(menuItem => {
      const ingredients = fromJson<RecipeContentSnapshot["ingredients"]>(menuItem.recipeVersion.ingredientsJson);
      return ingredients.map((item, index) => ({
        sourceId: event.id,
        sourceTitle: event.title,
        scheduledAt: event.scheduledAt,
        updatedAt: event.updatedAt,
        recipeTitle: menuItem.title.trim(),
        recipeId: menuItem.recipeId ?? null,
        sourceVersionId: menuItem.recipeVersionId,
        baseServings: menuItem.baseServings ?? menuItem.recipeVersion.baseServings ?? 0,
        ingredientSort: index + 1,
        ingredientId: item.ingredientId,
        ingredientName: item.ingredientName,
        amount: item.amount
      }));
    }));
  }

  private toShoppingGapPreviewItem(item: EventGapSummaryItem): ShoppingGapPreviewItem {
    return {
      ...item,
      ingredientId: item.ingredientId
    };
  }
}
