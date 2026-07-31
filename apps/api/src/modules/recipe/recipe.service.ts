import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, RecipeStatus, type UploadAsset } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { removeStorageLedger, upsertStorageLedger } from "../../common/storage-ledger";
import type {
  CollectionListResponse,
  CollectionSceneSummary,
  CollectedRecipeDetail,
  CollectedRecipeSummary,
  DeleteRecipeDraftResponse,
  DeleteRecipeResponse,
  IngredientCategorySummary,
  IngredientFeedbackResult,
  IngredientRecommendationSummary,
  IngredientSummary,
  InspirationCategorySummary,
  InspirationRecipeDetail,
  InspirationRecipeSummary,
  MyRecipeDetail,
  MyRecipeSummary,
  PageResult,
  PublishRecipeDraftResponse,
  RecipeRecommendationSummary,
  RecipeCategorySummary,
  RecipeContentSnapshot,
  RecipeDraftContentInput,
  RecipeDraftDetail,
  RecipeDraftSummary,
  RecipeDraftStepInput,
  RecipeIngredientInput,
  RecipeReportSummary,
  RecipeSceneSummary,
  ReorderItem,
  SaveCollectionRecipeResponse,
  SaveRecipeDraftResponse,
  OperationId,
  UUID,
  UnitSummary
} from "../../contracts/types";
import { IngredientImageService } from "../admin/ingredient-image.service";
import { EntitlementService } from "../entitlement/entitlement.service";
import { UploadService } from "../upload/upload.service";
import {
  buildDraftSearchText,
  buildRecipeSearchText,
  buildSearchKey,
  cleanDraftContent,
  contentSizeBytes,
  draftSizeBytes,
  formatRecipeAmount,
  fromJson,
  toJson,
  versionToContent
} from "./recipe-content";
import { replaceDraftIngredient, replaceRecipeIngredient } from "./ingredient-reference";

type RecipeDb = Prisma.TransactionClient | PrismaService;

type RecipeRow = Prisma.RecipeGetPayload<{
  include: {
    owner: { select: { uid: true; nickname: true } };
    category: true;
    inspirationCategory: true;
    currentVersion: true;
    sceneLinks: {
      include: {
        scene: true;
      };
    };
  };
}>;

type DraftRow = Prisma.RecipeDraftGetPayload<{
  include: {
    category: true;
    scenes: {
      include: {
        scene: true;
      };
    };
  };
}>;

type CollectionRow = Prisma.RecipeCollectionGetPayload<{
  include: {
    sourceRecipe: {
      include: {
        inspirationCategory: true;
      };
    };
    sourceVersion: true;
    sceneLinks: {
      include: {
        scene: true;
      };
    };
  };
}>;

type RecipeCategoryRow = Prisma.RecipeCategoryGetPayload<Record<string, never>>;
type RecipeSceneRow = Prisma.RecipeSceneGetPayload<Record<string, never>>;
type IngredientCategoryRow = Prisma.IngredientCategoryGetPayload<Record<string, never>>;
type UnitRow = Prisma.UnitGetPayload<Record<string, never>>;
type IngredientRow = Prisma.IngredientGetPayload<{
  include: {
    defaultUnit: true;
  };
}>;
type IngredientRecommendationRow = Prisma.IngredientRecommendationGetPayload<{
  include: {
    ingredient: {
      include: {
        defaultUnit: true;
      };
    };
    targetIngredient: {
      include: {
        defaultUnit: true;
      };
    };
  };
}>;
type IngredientFeedbackRow = Prisma.IngredientFeedbackGetPayload<Record<string, never>>;

type RecipeRecommendationRow = Prisma.RecipeRecommendationGetPayload<{
  include: {
    suggestedCategory: true;
    adoptedRecipe: {
      select: {
        id: true;
      };
    };
  };
}>;

type EditRefs = {
  ingredientRefs: IngredientSummary[];
  unitRefs: UnitSummary[];
  ingredientMap: Map<UUID, IngredientSummary>;
};

type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

type VersionImageState = {
  coverUploadId: UUID | null;
  stepUploads: Array<{ slotKey: string; uploadId: UUID | null }>;
};

const activeRecipeStatuses: RecipeStatus[] = ["ACTIVE", "RECYCLED", "BLOCKED"];
const recipeImageUrlPattern = /\/api\/public-assets\/recipe-images\/([^/?#]+)/i;

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

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function recipeRecordKey(recipeId: UUID) {
  return `recipe:${recipeId}`;
}

function draftRecordKey(draftId: UUID) {
  return `draft:${draftId}`;
}

function collectionRecordKey(collectionId: UUID) {
  return `collection:${collectionId}`;
}

function extractRecipeImagePublicId(imageUrl: string | null | undefined) {
  if (!imageUrl) return null;
  const match = imageUrl.match(recipeImageUrlPattern);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function toRecipeCategorySummary(category: RecipeCategoryRow): RecipeCategorySummary {
  return {
    id: category.id,
    name: category.name,
    version: category.version
  };
}

function toRecipeSceneSummary(scene: RecipeSceneRow): RecipeSceneSummary {
  return {
    id: scene.id,
    name: scene.name,
    version: scene.version
  };
}

function toCollectionSceneSummary(scene: RecipeSceneRow, recipeCount: number, updatedAt: Date | null): CollectionSceneSummary {
  return {
    id: scene.id,
    name: scene.name,
    version: scene.version,
    recipeCount,
    updatedAt: updatedAt ? toIsoDate(updatedAt) : null
  };
}

function resolveCuratedByName(nickname: string | null | undefined) {
  const name = nickname?.trim();
  return name || "一位炊友";
}

function normalizeRecipeImageUrl(imageUrl: string | null | undefined) {
  const value = imageUrl?.trim();
  return value || null;
}

function toRecipeRecommendationSummary(record: RecipeRecommendationRow): RecipeRecommendationSummary {
  return {
    id: record.id,
    recipeId: record.recipeId,
    sourceVersionId: record.sourceVersionId,
    recipeTitle: record.recipeTitle,
    curatedByName: record.curatedByName,
    suggestedCategory: {
      id: record.suggestedCategory.id,
      name: record.suggestedCategory.name,
      iconKey: record.suggestedCategory.iconKey
    },
    status: record.status,
    reviewNote: record.reviewNote,
    adoptedRecipeId: record.adoptedRecipe?.id ?? null,
    version: record.version,
    createdAt: toIsoDate(record.createdAt),
    updatedAt: toIsoDate(record.updatedAt),
    reviewedAt: record.reviewedAt ? toIsoDate(record.reviewedAt) : null,
    withdrawnAt: record.withdrawnAt ? toIsoDate(record.withdrawnAt) : null
  };
}

function toSaveRecipeDraftResponse(draft: Pick<DraftRow, "id" | "recipeId" | "version" | "updatedAt">): SaveRecipeDraftResponse {
  return {
    id: draft.id,
    recipeId: draft.recipeId,
    version: draft.version,
    updatedAt: toIsoDate(draft.updatedAt)
  };
}

function toIngredientCategorySummary(category: IngredientCategoryRow): IngredientCategorySummary {
  return {
    id: category.id,
    name: category.name
  };
}

function toInspirationCategorySummary(category: { id: UUID; name: string; iconKey: string | null }): InspirationCategorySummary {
  return {
    id: category.id,
    name: category.name,
    iconKey: category.iconKey
  };
}

function toUnitSummary(unit: UnitRow): UnitSummary {
  return {
    id: unit.id,
    name: unit.name,
    type: unit.type,
    source: unit.ownerId ? "PERSONAL" : "SYSTEM"
  };
}

function toIngredientSummary(
  ingredient: IngredientRow,
  imageUrl: string | null,
  recommendationStatus: IngredientSummary["recommendationStatus"] = null
): IngredientSummary {
  return {
    id: ingredient.id,
    name: ingredient.name,
    source: ingredient.ownerId ? "PERSONAL" : "SYSTEM",
    categoryId: ingredient.categoryId,
    defaultUnit: toUnitSummary(ingredient.defaultUnit),
    imageUrl,
    recommendationStatus,
    version: ingredient.version
  };
}

function toIngredientRecommendationSummary(
  record: IngredientRecommendationRow,
  resolveImageUrl: (ingredient: IngredientRow) => string | null
): IngredientRecommendationSummary {
  const resolvedIngredient =
    record.status === "MERGED"
      ? record.targetIngredient
      : record.status === "ADOPTED"
        ? (record.targetIngredient ?? record.ingredient)
        : record.ingredient;
  const categoryId = resolvedIngredient?.categoryId ?? record.categoryId;
  const defaultUnit = resolvedIngredient ? toUnitSummary(resolvedIngredient.defaultUnit) : toUnitSummary(record.ingredient.defaultUnit);
  const adoptedIngredient =
    record.status === "ADOPTED"
      ? toIngredientSummary(
          (record.targetIngredient ?? record.ingredient) as IngredientRow,
          resolveImageUrl((record.targetIngredient ?? record.ingredient) as IngredientRow)
        )
      : null;
  const mergedIngredient =
    record.status === "MERGED" && record.targetIngredient
      ? toIngredientSummary(record.targetIngredient as IngredientRow, resolveImageUrl(record.targetIngredient as IngredientRow))
      : null;

  return {
    id: record.id,
    ingredientId: record.ingredientId,
    ingredientVersion: record.ingredient.version,
    ingredientName: resolvedIngredient?.name ?? record.ingredientName,
    status: record.status,
    category: {
      id: categoryId,
      name: record.categoryName
    },
    defaultUnit,
    reviewNote: record.reviewNote,
    reviewAdvice: record.reviewAdvice,
    adoptedIngredient,
    mergedIngredient,
    createdAt: toIsoDate(record.createdAt),
    updatedAt: toIsoDate(record.updatedAt),
    reviewedAt: record.reviewedAt ? toIsoDate(record.reviewedAt) : null
  };
}

function toIngredientFeedbackResult(record: IngredientFeedbackRow): IngredientFeedbackResult {
  return {
    id: record.id,
    ingredientId: record.ingredientId,
    status: "PENDING",
    createdAt: toIsoDate(record.createdAt)
  };
}

function toDraftSummary(draft: DraftRow): RecipeDraftSummary {
  return {
    id: draft.id,
    recipeId: draft.recipeId,
    title: draft.title,
    category: draft.category ? toRecipeCategorySummary(draft.category) : null,
    version: draft.version,
    updatedAt: toIsoDate(draft.updatedAt)
  };
}

@Injectable()
export class RecipeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService,
    @Inject(IngredientImageService) private readonly ingredientImageService: IngredientImageService,
    @Inject(UploadService) private readonly uploadService: UploadService
  ) {}

  async listRecipeCategories(userId: UUID) {
    const items = await this.prisma.recipeCategory.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    return items.map(toRecipeCategorySummary);
  }

  async createRecipeCategory(userId: UUID, operationId: OperationId, name: string) {
    const normalizedName = name.trim();
    const searchKey = buildSearchKey(normalizedName);
    const requestHash = searchKey;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<RecipeCategorySummary>(tx, operationId, "recipe-category:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "recipe-category:create", userId, null, requestHash);
      await this.assertCategoryLimit(tx, userId, "CATEGORY");
      await this.assertCategoryNameAvailable(tx, userId, searchKey, null);

      const last = await tx.recipeCategory.findFirst({
        where: { userId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true }
      });
      const category = await tx.recipeCategory.create({
        data: {
          userId,
          name: normalizedName,
          searchKey,
          sortOrder: (last?.sortOrder ?? -1) + 1
        }
      });
      const result = toRecipeCategorySummary(category);
      await completeIdempotentOperation(tx, operationId, "recipe-category:create", userId, null, requestHash, result);
      return result;
    });
  }

  async updateRecipeCategory(userId: UUID, categoryId: UUID, operationId: OperationId, expectedVersion: number, name: string) {
    const normalizedName = name.trim();
    const searchKey = buildSearchKey(normalizedName);
    const requestHash = `${categoryId}:${expectedVersion}:${searchKey}`;
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipe_categories" WHERE "id" = ${categoryId} FOR UPDATE`;
      const category = await this.requireOwnedCategory(tx, userId, categoryId);
      const repeated = await getIdempotentResult<RecipeCategorySummary>(tx, operationId, "recipe-category:update", userId, null, requestHash);
      if (repeated) return repeated;
      if (category.version !== expectedVersion) throw new ConflictException("分类已被更新，请刷新后重试");
      await startIdempotentOperation(tx, operationId, "recipe-category:update", userId, null, requestHash);
      await this.assertCategoryNameAvailable(tx, userId, searchKey, categoryId);
      const next = await tx.recipeCategory.update({
        where: { id: categoryId },
        data: {
          name: normalizedName,
          searchKey,
          version: { increment: 1 }
        }
      });
      const result = toRecipeCategorySummary(next);
      await completeIdempotentOperation(tx, operationId, "recipe-category:update", userId, null, requestHash, result);
      return result;
    });
  }

  async reorderRecipeCategories(userId: UUID, operationId: OperationId, items: ReorderItem[]) {
    const requestHash = JSON.stringify(items);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<RecipeCategorySummary[]>(tx, operationId, "recipe-category:reorder", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "recipe-category:reorder", userId, null, requestHash);
      const all = await tx.recipeCategory.findMany({
        where: { userId },
        orderBy: { sortOrder: "asc" }
      });
      this.assertReorderScope(all, items, "分类");
      await this.writeSortOrder(tx, "recipeCategory", items.map(item => item.id), "userId", userId);
      const result = await this.listRecipeCategories(userId);
      await completeIdempotentOperation(tx, operationId, "recipe-category:reorder", userId, null, requestHash, result);
      return result;
    });
  }

  async listRecipeScenes(userId: UUID) {
    const items = await this.prisma.recipeScene.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    return items.map(toRecipeSceneSummary);
  }

  async createRecipeScene(userId: UUID, operationId: OperationId, name: string) {
    const normalizedName = name.trim();
    const searchKey = buildSearchKey(normalizedName);
    const requestHash = searchKey;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<RecipeSceneSummary>(tx, operationId, "recipe-scene:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "recipe-scene:create", userId, null, requestHash);
      await this.assertCategoryLimit(tx, userId, "SCENE");
      await this.assertSceneNameAvailable(tx, userId, searchKey, null);
      const last = await tx.recipeScene.findFirst({
        where: { userId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true }
      });
      const scene = await tx.recipeScene.create({
        data: {
          userId,
          name: normalizedName,
          searchKey,
          sortOrder: (last?.sortOrder ?? -1) + 1
        }
      });
      const result = toRecipeSceneSummary(scene);
      await completeIdempotentOperation(tx, operationId, "recipe-scene:create", userId, null, requestHash, result);
      return result;
    });
  }

  async updateRecipeScene(userId: UUID, sceneId: UUID, operationId: OperationId, expectedVersion: number, name: string) {
    const normalizedName = name.trim();
    const searchKey = buildSearchKey(normalizedName);
    const requestHash = `${sceneId}:${expectedVersion}:${searchKey}`;
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipe_scenes" WHERE "id" = ${sceneId} FOR UPDATE`;
      const scene = await this.requireOwnedScene(tx, userId, sceneId);
      const repeated = await getIdempotentResult<RecipeSceneSummary>(tx, operationId, "recipe-scene:update", userId, null, requestHash);
      if (repeated) return repeated;
      if (scene.version !== expectedVersion) throw new ConflictException("场景已被更新，请刷新后重试");
      await startIdempotentOperation(tx, operationId, "recipe-scene:update", userId, null, requestHash);
      await this.assertSceneNameAvailable(tx, userId, searchKey, sceneId);
      const next = await tx.recipeScene.update({
        where: { id: sceneId },
        data: {
          name: normalizedName,
          searchKey,
          version: { increment: 1 }
        }
      });
      const result = toRecipeSceneSummary(next);
      await completeIdempotentOperation(tx, operationId, "recipe-scene:update", userId, null, requestHash, result);
      return result;
    });
  }

  async reorderRecipeScenes(userId: UUID, operationId: OperationId, items: ReorderItem[]) {
    const requestHash = JSON.stringify(items);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<RecipeSceneSummary[]>(tx, operationId, "recipe-scene:reorder", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "recipe-scene:reorder", userId, null, requestHash);
      const all = await tx.recipeScene.findMany({
        where: { userId },
        orderBy: { sortOrder: "asc" }
      });
      this.assertReorderScope(all, items, "场景");
      await this.writeSortOrder(tx, "recipeScene", items.map(item => item.id), "userId", userId);
      const result = await this.listRecipeScenes(userId);
      await completeIdempotentOperation(tx, operationId, "recipe-scene:reorder", userId, null, requestHash, result);
      return result;
    });
  }

  async listIngredientCategories() {
    const items = await this.prisma.ingredientCategory.findMany({
      where: {
        isSelectable: true
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    return items.map(toIngredientCategorySummary);
  }

  async listIngredients(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    userId: UUID,
    page: number,
    pageSize: number,
    keyword?: string,
    categoryId?: UUID,
    source?: string
  ): Promise<PageResult<IngredientSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.IngredientWhereInput = {
      ...(categoryId ? { categoryId } : {}),
      ...(keyword ? { searchKey: { contains: buildSearchKey(keyword) } } : {}),
      ...this.buildIngredientOwnerWhere(userId, source)
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingredient.findMany({
        where,
        include: {
          defaultUnit: true
        },
        orderBy: this.buildIngredientOrderBy(categoryId),
        skip,
        take: normalizedPageSize
      }),
      this.prisma.ingredient.count({ where })
    ]);
    const recommendationMap = await this.loadIngredientRecommendationStatusMap(
      this.prisma,
      items.filter(item => item.ownerId).map(item => item.id)
    );

    return {
      items: items.map(item =>
        toIngredientSummary(
          item,
          this.buildIngredientImageUrl(request, item),
          recommendationMap.get(item.id) ?? null
        )
      ),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createIngredient(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    userId: UUID,
    operationId: OperationId,
    name: string,
    categoryId: UUID,
    defaultUnitId: UUID
  ) {
    const normalizedName = name.trim();
    const searchKey = buildSearchKey(normalizedName);
    const requestHash = `${searchKey}:${categoryId}:${defaultUnitId}`;
    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getIdempotentResult<IngredientSummary>(tx, operationId, "ingredient:create", userId, null, requestHash);
        if (repeated) return repeated;
        await startIdempotentOperation(tx, operationId, "ingredient:create", userId, null, requestHash);
        await this.requireSelectableIngredientCategory(tx, categoryId);
        const unit = await this.requireAccessibleUnit(tx, userId, defaultUnitId);
        await this.assertIngredientNameAvailable(tx, userId, searchKey, null);
        const ingredient = await tx.ingredient.create({
          data: {
            ownerId: userId,
            categoryId,
            defaultUnitId: unit.id,
            name: normalizedName,
            searchKey
          },
          include: {
            defaultUnit: true
          }
        });
        const result = toIngredientSummary(ingredient, this.buildIngredientImageUrl(request, ingredient));
        await completeIdempotentOperation(tx, operationId, "ingredient:create", userId, null, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("食材名称已存在，请刷新后重试");
      }
      throw error;
    }
  }

  async updateIngredient(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    userId: UUID,
    ingredientId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    name: string,
    categoryId: UUID,
    defaultUnitId: UUID
  ) {
    const normalizedName = name.trim();
    const searchKey = buildSearchKey(normalizedName);
    const requestHash = `${ingredientId}:${expectedVersion}:${searchKey}:${categoryId}:${defaultUnitId}`;
    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "ingredients" WHERE "id" = ${ingredientId} FOR UPDATE`;
        const ingredient = await this.requireOwnedEditableIngredient(tx, userId, ingredientId);
        const repeated = await getIdempotentResult<IngredientSummary>(tx, operationId, "ingredient:update", userId, null, requestHash);
        if (repeated) return repeated;
        if (ingredient.version !== expectedVersion) throw new ConflictException("食材已被更新，请刷新后重试");
        await startIdempotentOperation(tx, operationId, "ingredient:update", userId, null, requestHash);
        await this.requireSelectableIngredientCategory(tx, categoryId);
        const unit = await this.requireAccessibleUnit(tx, userId, defaultUnitId);
        await this.assertIngredientNameAvailable(tx, userId, searchKey, ingredientId);
        const updated = await tx.ingredient.update({
          where: { id: ingredientId },
          data: {
            name: normalizedName,
            searchKey,
            categoryId,
            defaultUnitId: unit.id,
            version: { increment: 1 }
          },
          include: {
            defaultUnit: true
          }
        });
        const recommendationMap = await this.loadIngredientRecommendationStatusMap(tx, [updated.id]);
        const result = toIngredientSummary(
          updated,
          this.buildIngredientImageUrl(request, updated),
          recommendationMap.get(updated.id) ?? null
        );
        await completeIdempotentOperation(tx, operationId, "ingredient:update", userId, null, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("食材名称已存在，请刷新后重试");
      }
      throw error;
    }
  }

  async recommendIngredient(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    userId: UUID,
    ingredientId: UUID,
    operationId: OperationId
  ): Promise<IngredientRecommendationSummary> {
    const requestHash = String(ingredientId);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "ingredients" WHERE "id" = ${ingredientId} FOR UPDATE`;
      const ingredient = await this.requireOwnedIngredient(tx, userId, ingredientId);
      const repeated = await getIdempotentResult<IngredientRecommendationSummary>(
        tx,
        operationId,
        "ingredient:recommend",
        userId,
        null,
        requestHash
      );
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "ingredient:recommend", userId, null, requestHash);
      await this.assertIngredientRecommendationAvailable(tx, ingredientId);

      const target = await tx.ingredient.findFirst({
        where: {
          ownerId: null,
          status: "ACTIVE",
          searchKey: ingredient.searchKey
        },
        include: {
          defaultUnit: true
        }
      });

      let recommendation: IngredientRecommendationRow;
      if (target) {
        recommendation = await this.mergeIngredientIntoSystem(
          tx,
          userId,
          ingredient,
          target,
          "系统库已有同名食材，已自动归并"
        );
      } else {
        const category = await this.requireIngredientCategory(tx, ingredient.categoryId);
        const unit = await this.requireAccessibleUnit(tx, userId, ingredient.defaultUnitId);
        recommendation = await tx.ingredientRecommendation.create({
          data: {
            ingredientId: ingredient.id,
            userId,
            status: "PENDING",
            ingredientName: ingredient.name,
            categoryId: ingredient.categoryId,
            categoryName: category.name,
            defaultUnitId: ingredient.defaultUnitId,
            defaultUnitName: unit.name
          },
          include: {
            ingredient: {
              include: {
                defaultUnit: true
              }
            },
            targetIngredient: {
              include: {
                defaultUnit: true
              }
            }
          }
        });
      }

      const result = toIngredientRecommendationSummary(recommendation, item => this.buildIngredientImageUrl(request, item));
      await completeIdempotentOperation(tx, operationId, "ingredient:recommend", userId, null, requestHash, result);
      return result;
    });
  }

  async createIngredientFeedback(
    userId: UUID,
    ingredientId: UUID,
    body: {
      operationId: OperationId;
      name: string;
      categoryId: UUID;
      note?: string;
    }
  ): Promise<IngredientFeedbackResult> {
    const normalizedName = body.name.trim();
    const normalizedNote = body.note?.trim() || null;
    const requestHash = JSON.stringify({
      ingredientId,
      name: normalizedName,
      categoryId: body.categoryId,
      note: normalizedNote
    });
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "ingredients" WHERE "id" = ${ingredientId} FOR UPDATE`;
      const ingredient = await tx.ingredient.findFirst({
        where: {
          id: ingredientId,
          ownerId: null,
          status: "ACTIVE",
          category: {
            is: {
              isSelectable: true
            }
          }
        }
      });
      if (!ingredient) throw new NotFoundException("系统食材不存在");
      const repeated = await getIdempotentResult<IngredientFeedbackResult>(
        tx,
        body.operationId,
        "ingredient:feedback",
        userId,
        null,
        requestHash
      );
      if (repeated) return repeated;
      await startIdempotentOperation(tx, body.operationId, "ingredient:feedback", userId, null, requestHash);

      if (!normalizedName) throw new BadRequestException("食材名称不能为空");
      const category = await this.requireSelectableIngredientCategory(tx, body.categoryId);
      const changedName = normalizedName !== ingredient.name;
      const changedCategory = body.categoryId !== ingredient.categoryId;
      if (!changedName && !changedCategory && !normalizedNote) {
        throw new BadRequestException("请至少修改名字、分类，或补充备注");
      }
      await this.assertIngredientFeedbackAvailable(tx, userId, ingredientId);

      const feedback = await tx.ingredientFeedback.create({
        data: {
          ingredientId: ingredient.id,
          userId,
          status: "PENDING",
          ingredientVersion: ingredient.version,
          ingredientName: ingredient.name,
          categoryId: ingredient.categoryId,
          categoryName: (await this.requireIngredientCategory(tx, ingredient.categoryId)).name,
          suggestedName: normalizedName,
          suggestedCategoryId: category.id,
          suggestedCategoryName: category.name,
          note: normalizedNote
        }
      });
      const result = toIngredientFeedbackResult(feedback);
      await completeIdempotentOperation(tx, body.operationId, "ingredient:feedback", userId, null, requestHash, result);
      return result;
    });
  }

  async listIngredientRecommendations(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    userId: UUID,
    page: number,
    pageSize: number
  ): Promise<PageResult<IngredientRecommendationSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.IngredientRecommendationWhereInput = {
      userId
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingredientRecommendation.findMany({
        where,
        include: {
          ingredient: {
            include: {
              defaultUnit: true
            }
          },
          targetIngredient: {
            include: {
              defaultUnit: true
            }
          }
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.ingredientRecommendation.count({ where })
    ]);

    return {
      items: items.map(item => toIngredientRecommendationSummary(item, ingredient => this.buildIngredientImageUrl(request, ingredient))),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async listUnits(userId: UUID, page: number, pageSize: number, keyword?: string, type?: string, source?: string): Promise<PageResult<UnitSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.UnitWhereInput = {
      ...(type ? { type: type as UnitRow["type"] } : {}),
      ...(keyword ? { searchKey: { contains: buildSearchKey(keyword) } } : {}),
      ...this.buildUnitOwnerWhere(userId, source)
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        where,
        orderBy: [{ ownerId: "asc" }, { type: "asc" }, { systemSortOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.unit.count({ where })
    ]);

    return {
      items: items.map(toUnitSummary),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createUnit(userId: UUID, operationId: OperationId, name: string, type: UnitSummary["type"]) {
    const normalizedName = name.trim();
    const searchKey = buildSearchKey(normalizedName);
    const requestHash = `${type}:${searchKey}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<UnitSummary>(tx, operationId, "unit:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "unit:create", userId, null, requestHash);
      await this.assertUnitNameAvailable(tx, userId, searchKey);
      const unit = await tx.unit.create({
        data: {
          ownerId: userId,
          type,
          name: normalizedName,
          searchKey
        }
      });
      const result = toUnitSummary(unit);
      await completeIdempotentOperation(tx, operationId, "unit:create", userId, null, requestHash, result);
      return result;
    });
  }

  async listRecipeDrafts(userId: UUID, page: number, pageSize: number, keyword?: string): Promise<PageResult<RecipeDraftSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.RecipeDraftWhereInput = {
      userId,
      ...(keyword ? { searchText: { contains: buildSearchKey(keyword) } } : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipeDraft.findMany({
        where,
        include: {
          category: true,
          scenes: {
            include: {
              scene: true
            }
          }
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipeDraft.count({ where })
    ]);

    return {
      items: items.map(toDraftSummary),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createRecipeDraft(userId: UUID, operationId: OperationId, recipeId: UUID | null, content: RecipeDraftContentInput): Promise<SaveRecipeDraftResponse> {
    const normalized = cleanDraftContent(content);
    this.assertDraftTitle(normalized);
    const requestHash = JSON.stringify({ recipeId, content: normalized });
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<SaveRecipeDraftResponse>(tx, operationId, "recipe-draft:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "recipe-draft:create", userId, null, requestHash);

      if (recipeId) {
        const existing = await tx.recipeDraft.findUnique({
          where: { recipeId },
          include: {
            category: true,
            scenes: { include: { scene: true } }
          }
        });
        if (existing) {
          const result = toSaveRecipeDraftResponse(existing);
          await completeIdempotentOperation(tx, operationId, "recipe-draft:create", userId, null, requestHash, result);
          return result;
        }
      }

      const draftRelations = await this.resolveDraftRelations(tx, userId, normalized);
      const recipe = recipeId ? await this.requireOwnedPublishedRecipe(tx, userId, recipeId) : null;
      if (recipe) {
        await this.assertRecipeRecommendationMutable(tx, recipe.id);
      }
      const uploadIds = this.collectDraftUploadIds(normalized);
      const usedBytes = recipe
        ? await this.calculateEditDraftBytes(tx, recipe, normalized)
        : draftSizeBytes(normalized) + (await this.getUploadBytes(tx, uploadIds));
      await this.assertDraftCreateAllowed(tx, userId, recipe ? 0 : 1, usedBytes);

      const draft = await tx.recipeDraft.create({
        data: {
          userId,
          recipeId,
          categoryId: draftRelations.categoryId,
          title: normalized.name || null,
          searchText: buildDraftSearchText(normalized),
          contentJson: toJson(normalized),
          contentSizeBytes: usedBytes
        },
        include: {
          category: true,
          scenes: { include: { scene: true } }
        }
      });

      if (draftRelations.sceneIds.length > 0) {
        await tx.recipeDraftScene.createMany({
          data: draftRelations.sceneIds.map(sceneId => ({
            draftId: draft.id,
            sceneId
          }))
        });
      }
      await upsertStorageLedger(tx, userId, "RECIPE", draftRecordKey(draft.id), usedBytes);
      const result = toSaveRecipeDraftResponse(draft);
      await completeIdempotentOperation(tx, operationId, "recipe-draft:create", userId, null, requestHash, result);
      return result;
    });
  }

  async getRecipeDraft(userId: UUID, draftId: UUID) {
    const draft = await this.loadDraft(this.prisma, userId, draftId);
    return this.toDraftDetail(this.prisma, userId, draft);
  }

  async updateRecipeDraft(
    userId: UUID,
    draftId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    content: RecipeDraftContentInput
  ): Promise<SaveRecipeDraftResponse> {
    const normalized = cleanDraftContent(content);
    this.assertDraftTitle(normalized);
    const requestHash = JSON.stringify({ draftId, expectedVersion, content: normalized });
    const { result, staleStorageKeys } = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipe_drafts" WHERE "id" = ${draftId} FOR UPDATE`;
      const draft = await this.loadDraft(tx, userId, draftId);
      const repeated = await getIdempotentResult<SaveRecipeDraftResponse>(tx, operationId, "recipe-draft:update", userId, null, requestHash);
      if (repeated) {
        return {
          result: repeated,
          staleStorageKeys: [] as string[]
        };
      }
      if (draft.version !== expectedVersion) throw new ConflictException("草稿已被更新，请刷新后重试");
      await startIdempotentOperation(tx, operationId, "recipe-draft:update", userId, null, requestHash);

      const draftRelations = await this.resolveDraftRelations(tx, userId, normalized);
      const keepUploadIds = this.collectDraftUploadIds(normalized);
      await this.uploadService.assertDraftUploadOwnership(tx, userId, draftId, Array.from(keepUploadIds));
      const recipe = draft.recipeId ? await this.requireOwnedPublishedRecipe(tx, userId, draft.recipeId) : null;
      const nextBytes = recipe
        ? await this.calculateEditDraftBytes(tx, recipe, normalized)
        : draftSizeBytes(normalized) + (await this.getUploadBytes(tx, keepUploadIds));
      const deltaBytes = nextBytes - draft.contentSizeBytes;
      await this.assertStorageDelta(tx, userId, deltaBytes);

      await tx.recipeDraftScene.deleteMany({ where: { draftId } });
      if (draftRelations.sceneIds.length > 0) {
        await tx.recipeDraftScene.createMany({
          data: draftRelations.sceneIds.map(sceneId => ({
            draftId,
            sceneId
          }))
        });
      }

      const next = await tx.recipeDraft.update({
        where: { id: draftId },
        data: {
          categoryId: draftRelations.categoryId,
          title: normalized.name || null,
          searchText: buildDraftSearchText(normalized),
          contentJson: toJson(normalized),
          contentSizeBytes: nextBytes,
          version: { increment: 1 }
        },
        include: {
          category: true,
          scenes: { include: { scene: true } }
        }
      });
      const staleStorageKeys = await this.uploadService.removeUnusedDraftUploads(tx, draftId, keepUploadIds);
      await upsertStorageLedger(tx, userId, "RECIPE", draftRecordKey(draftId), nextBytes);
      const result = toSaveRecipeDraftResponse(next);
      await completeIdempotentOperation(tx, operationId, "recipe-draft:update", userId, null, requestHash, result);
      return {
        result,
        staleStorageKeys
      };
    });
    await this.uploadService.removeStorageFiles(staleStorageKeys ?? []);
    return result;
  }

  async deleteRecipeDraft(userId: UUID, draftId: UUID, operationId: OperationId, expectedVersion: number): Promise<DeleteRecipeDraftResponse> {
    const requestHash = `${draftId}:${expectedVersion}`;
    const { result, deletedStorageKeys } = await this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DeleteRecipeDraftResponse>(tx, operationId, "recipe-draft:delete", userId, null, requestHash);
      if (repeated) {
        return {
          result: repeated,
          deletedStorageKeys: [] as string[]
        };
      }
      await startIdempotentOperation(tx, operationId, "recipe-draft:delete", userId, null, requestHash);
      await tx.$queryRaw`SELECT "id" FROM "recipe_drafts" WHERE "id" = ${draftId} FOR UPDATE`;
      const draft = await this.loadDraft(tx, userId, draftId);
      if (draft.version !== expectedVersion) throw new ConflictException("草稿已被更新，请刷新后重试");
      const deletedStorageKeys = await this.uploadService.deleteDraftUploads(tx, draftId);
      await tx.recipeDraft.delete({ where: { id: draftId } });
      await removeStorageLedger(tx, userId, "RECIPE", draftRecordKey(draftId));
      const result = {
        draftId,
        deletedAt: toIsoDate(new Date())
      } satisfies DeleteRecipeDraftResponse;
      await completeIdempotentOperation(tx, operationId, "recipe-draft:delete", userId, null, requestHash, result);
      return {
        result,
        deletedStorageKeys
      };
    });
    await this.uploadService.removeStorageFiles(deletedStorageKeys ?? []);
    return result;
  }

  async publishRecipeDraft(userId: UUID, draftId: UUID, operationId: OperationId, expectedVersion: number): Promise<PublishRecipeDraftResponse> {
    const requestHash = `${draftId}:${expectedVersion}`;
    const { result, deletedStorageKeys } = await this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<PublishRecipeDraftResponse>(tx, operationId, "recipe-draft:publish", userId, null, requestHash);
      if (repeated) {
        return {
          result: repeated,
          deletedStorageKeys: [] as string[]
        };
      }
      await startIdempotentOperation(tx, operationId, "recipe-draft:publish", userId, null, requestHash);
      await tx.$queryRaw`SELECT "id" FROM "recipe_drafts" WHERE "id" = ${draftId} FOR UPDATE`;
      const draft = await this.loadDraft(tx, userId, draftId);
      if (draft.version !== expectedVersion) throw new ConflictException("草稿已被更新，请刷新后重试");

      const content = fromJson<RecipeDraftContentInput>(draft.contentJson);
      this.assertPublishContent(content);
      const uploadIds = this.collectDraftUploadIds(content);
      await this.uploadService.assertDraftUploadOwnership(tx, userId, draftId, Array.from(uploadIds));
      const category = await this.requireOwnedCategory(tx, userId, content.categoryId as UUID);
      const recipeContent = await this.buildPublishedContent(tx, userId, content);
      const nextRecipeBytes = contentSizeBytes(recipeContent) + (await this.getUploadBytes(tx, uploadIds));
      const currentDraftBytes = draft.contentSizeBytes;
      const versionImages = this.buildVersionImageState(content);

      let recipe: RecipeRow;
      if (draft.recipeId) {
        const currentRecipe = await this.requireOwnedPublishedRecipe(tx, userId, draft.recipeId);
        await this.assertRecipeRecommendationMutable(tx, currentRecipe.id);
        const currentRecipeBytes = await this.getRecipeBytes(tx, currentRecipe);
        await this.assertStorageDelta(tx, userId, nextRecipeBytes - currentRecipeBytes - currentDraftBytes);
        const version = await tx.recipeContentVersion.create({
          data: this.buildVersionCreateInput(userId, recipeContent, versionImages)
        });
        await this.uploadService.bindDraftUploads(tx, draftId, version.id, Array.from(uploadIds));
        await tx.recipeSceneLink.deleteMany({ where: { recipeId: currentRecipe.id } });
        if (content.sceneIds.length > 0) {
          await tx.recipeSceneLink.createMany({
            data: content.sceneIds.map(sceneId => ({
              recipeId: currentRecipe.id,
              sceneId
            }))
          });
        }
        await tx.recipe.update({
          where: { id: currentRecipe.id },
          data: {
            categoryId: category.id,
            currentVersionId: version.id,
            title: recipeContent.name,
            searchText: buildRecipeSearchText(recipeContent),
            coverImageUrl: content.coverImageUrl ?? null,
            version: { increment: 1 }
          }
        });
        await upsertStorageLedger(tx, userId, "RECIPE", recipeRecordKey(currentRecipe.id), nextRecipeBytes);
        recipe = await this.loadOwnedRecipe(tx, userId, currentRecipe.id);
      } else {
        await this.assertStorageDelta(tx, userId, nextRecipeBytes - currentDraftBytes);
        const version = await tx.recipeContentVersion.create({
          data: this.buildVersionCreateInput(userId, recipeContent, versionImages)
        });
        const origin = this.readOriginContent(content);
        await this.uploadService.bindDraftUploads(tx, draftId, version.id, Array.from(uploadIds));
        const sortOrder = await this.nextRecipeSortOrder(tx, userId, category.id);
        const created = await tx.recipe.create({
          data: {
            ownerId: userId,
            categoryId: category.id,
            currentVersionId: version.id,
            originVersionId: origin.originVersionId,
            originCoverImageUrl: origin.originCoverImageUrl,
            title: recipeContent.name,
            searchText: buildRecipeSearchText(recipeContent),
            coverImageUrl: content.coverImageUrl ?? null,
            sortOrder
          }
        });
        if (content.sceneIds.length > 0) {
          await tx.recipeSceneLink.createMany({
            data: content.sceneIds.map(sceneId => ({
              recipeId: created.id,
              sceneId
            }))
          });
        }
        await upsertStorageLedger(tx, userId, "RECIPE", recipeRecordKey(created.id), nextRecipeBytes);
        recipe = await this.loadOwnedRecipe(tx, userId, created.id);
      }

      const deletedStorageKeys = await this.uploadService.deleteDraftUploads(tx, draftId);
      await tx.recipeDraft.delete({ where: { id: draftId } });
      await removeStorageLedger(tx, userId, "RECIPE", draftRecordKey(draftId));
      const result = {
        recipe: await this.toMyRecipeDetail(tx, userId, recipe)
      } satisfies PublishRecipeDraftResponse;
      await completeIdempotentOperation(tx, operationId, "recipe-draft:publish", userId, null, requestHash, result);
      return {
        result,
        deletedStorageKeys
      };
    });
    await this.uploadService.removeStorageFiles(deletedStorageKeys ?? []);
    return result;
  }

  async listMyRecipes(userId: UUID, page: number, pageSize: number, keyword?: string, categoryId?: UUID): Promise<PageResult<MyRecipeSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.RecipeWhereInput = {
      ownerId: userId,
      status: "ACTIVE",
      ...(categoryId ? { categoryId } : {}),
      ...(keyword ? { searchText: { contains: buildSearchKey(keyword) } } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        include: {
          owner: { select: { uid: true, nickname: true } },
          category: true,
          inspirationCategory: true,
          currentVersion: true,
          sceneLinks: {
            include: {
              scene: true
            }
          }
        },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipe.count({ where })
    ]);

    return {
      items: items.map(item => this.toMyRecipeSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async getMyRecipe(userId: UUID, recipeId: UUID) {
    const recipe = await this.loadOwnedRecipe(this.prisma, userId, recipeId);
    return this.toMyRecipeDetail(this.prisma, userId, recipe);
  }

  async createMyRecipeFromInspiration(
    userId: UUID,
    operationId: OperationId,
    sourceRecipeId: UUID,
    sourceVersionId: UUID,
    categoryId: UUID,
    sceneIds: UUID[]
  ): Promise<PublishRecipeDraftResponse> {
    const normalizedSceneIds = Array.from(new Set(sceneIds)).sort();
    const requestHash = JSON.stringify({ sourceRecipeId, sourceVersionId, categoryId, sceneIds: normalizedSceneIds });
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<PublishRecipeDraftResponse>(
        tx,
        operationId,
        "recipe:create-from-inspiration",
        userId,
        null,
        requestHash
      );
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "recipe:create-from-inspiration", userId, null, requestHash);

      const category = await this.requireOwnedCategory(tx, userId, categoryId);
      if (normalizedSceneIds.length > 0) {
        const scenes = await tx.recipeScene.findMany({
          where: {
            userId,
            id: { in: normalizedSceneIds }
          },
          select: { id: true }
        });
        if (scenes.length !== normalizedSceneIds.length) {
          throw new NotFoundException("场景不存在");
        }
      }

      await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${sourceRecipeId} FOR UPDATE`;
      const sourceRecipe = await tx.recipe.findFirst({
        where: {
          id: sourceRecipeId,
          ownerId: null,
          status: "ACTIVE"
        },
        include: {
          owner: { select: { uid: true, nickname: true } },
          category: true,
          inspirationCategory: true,
          currentVersion: true,
          sceneLinks: {
            include: {
              scene: true
            }
          }
        }
      });
      if (!sourceRecipe || !sourceRecipe.inspirationCategory) {
        throw new NotFoundException("灵感菜谱不存在");
      }
      if (sourceRecipe.currentVersionId !== sourceVersionId) {
        throw new ConflictException("灵感版本已更新，请刷新后重试");
      }

      const existing = await tx.recipe.findFirst({
        where: {
          ownerId: userId,
          originVersionId: sourceVersionId,
          status: { in: activeRecipeStatuses }
        },
        include: {
          owner: { select: { uid: true, nickname: true } },
          category: true,
          inspirationCategory: true,
          currentVersion: true,
          sceneLinks: {
            include: {
              scene: true
            }
          }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
      });
      if (existing) {
        const result = {
          recipe: await this.toMyRecipeDetail(tx, userId, existing)
        } satisfies PublishRecipeDraftResponse;
        await completeIdempotentOperation(tx, operationId, "recipe:create-from-inspiration", userId, null, requestHash, result);
        return result;
      }

      const recipeBytes = await this.getRecipeBytes(tx, sourceRecipe);
      await this.assertRecipeQuota(tx, userId, 1);
      await this.assertStorageDelta(tx, userId, recipeBytes);
      const sortOrder = await this.nextRecipeSortOrder(tx, userId, category.id);
      const created = await tx.recipe.create({
        data: {
          ownerId: userId,
          categoryId: category.id,
          currentVersionId: sourceRecipe.currentVersionId,
          originVersionId: sourceVersionId,
          originCoverImageUrl: normalizeRecipeImageUrl(sourceRecipe.coverImageUrl),
          title: sourceRecipe.title,
          searchText: sourceRecipe.searchText,
          coverImageUrl: normalizeRecipeImageUrl(sourceRecipe.coverImageUrl),
          sortOrder
        }
      });
      if (normalizedSceneIds.length > 0) {
        await tx.recipeSceneLink.createMany({
          data: normalizedSceneIds.map(sceneId => ({
            recipeId: created.id,
            sceneId
          }))
        });
      }
      await upsertStorageLedger(tx, userId, "RECIPE", recipeRecordKey(created.id), recipeBytes);
      const recipe = await this.loadOwnedRecipe(tx, userId, created.id);
      const result = {
        recipe: await this.toMyRecipeDetail(tx, userId, recipe)
      } satisfies PublishRecipeDraftResponse;
      await completeIdempotentOperation(tx, operationId, "recipe:create-from-inspiration", userId, null, requestHash, result);
      return result;
    });
  }

  async recommendRecipe(userId: UUID, recipeId: UUID, operationId: OperationId, inspirationCategoryId: UUID): Promise<RecipeRecommendationSummary> {
    const requestHash = `${recipeId}:${inspirationCategoryId}`;
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${recipeId} FOR UPDATE`;
      const recipe = await this.requireOwnedPublishedRecipe(tx, userId, recipeId);
      const repeated = await getIdempotentResult<RecipeRecommendationSummary>(tx, operationId, "recipe:recommend", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "recipe:recommend", userId, null, requestHash);
      await this.assertRecipeRecommendationCreateAllowed(tx, recipe);
      const suggestedCategory = await this.requireInspirationCategory(tx, inspirationCategoryId);
      const recommendation = await tx.recipeRecommendation.create({
        data: {
          recipeId: recipe.id,
          userId,
          sourceVersionId: recipe.currentVersionId,
          suggestedCategoryId: suggestedCategory.id,
          recipeTitle: recipe.title,
          curatedByName: resolveCuratedByName(recipe.owner?.nickname),
          suggestedCategoryName: suggestedCategory.name
        },
        include: {
          suggestedCategory: true,
          adoptedRecipe: {
            select: {
              id: true
            }
          }
        }
      });
      const result = toRecipeRecommendationSummary(recommendation);
      await completeIdempotentOperation(tx, operationId, "recipe:recommend", userId, null, requestHash, result);
      return result;
    });
  }

  async withdrawRecipeRecommendation(
    userId: UUID,
    recommendationId: UUID,
    operationId: OperationId,
    expectedVersion: number
  ): Promise<RecipeRecommendationSummary> {
    const requestHash = `${recommendationId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipe_recommendations" WHERE "id" = ${recommendationId} FOR UPDATE`;
      const recommendation = await this.requireOwnedPendingRecipeRecommendation(tx, userId, recommendationId);
      const repeated = await getIdempotentResult<RecipeRecommendationSummary>(tx, operationId, "recipe-recommendation:withdraw", userId, null, requestHash);
      if (repeated) return repeated;
      if (recommendation.version !== expectedVersion) {
        throw new ConflictException("推荐记录已更新，请刷新后重试");
      }
      await startIdempotentOperation(tx, operationId, "recipe-recommendation:withdraw", userId, null, requestHash);
      const withdrawn = await tx.recipeRecommendation.update({
        where: { id: recommendationId },
        data: {
          status: "WITHDRAWN",
          withdrawnAt: new Date(),
          version: { increment: 1 }
        },
        include: {
          suggestedCategory: true,
          adoptedRecipe: {
            select: {
              id: true
            }
          }
        }
      });
      const result = toRecipeRecommendationSummary(withdrawn);
      await completeIdempotentOperation(tx, operationId, "recipe-recommendation:withdraw", userId, null, requestHash, result);
      return result;
    });
  }

  async reorderRecipes(userId: UUID, categoryId: UUID, operationId: OperationId, items: ReorderItem[]) {
    const requestHash = JSON.stringify({ categoryId, items });
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<MyRecipeSummary[]>(tx, operationId, "recipe:reorder", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "recipe:reorder", userId, null, requestHash);
      await this.requireOwnedCategory(tx, userId, categoryId);
      const all = await tx.recipe.findMany({
        where: {
          ownerId: userId,
          categoryId,
          status: "ACTIVE"
        },
        include: {
          owner: { select: { uid: true, nickname: true } },
          category: true,
          inspirationCategory: true,
          currentVersion: true,
          sceneLinks: { include: { scene: true } }
        },
        orderBy: { sortOrder: "asc" }
      });
      this.assertReorderScope(all, items, "菜谱");
      await this.writeSortOrder(tx, "recipe", items.map(item => item.id), "ownerId", userId, { categoryId });
      const resultPage = await this.listMyRecipes(userId, 1, Math.max(items.length, 1), undefined, categoryId);
      await completeIdempotentOperation(tx, operationId, "recipe:reorder", userId, null, requestHash, resultPage.items);
      return resultPage.items;
    });
  }

  async deleteRecipe(userId: UUID, recipeId: UUID, operationId: OperationId, expectedVersion: number): Promise<DeleteRecipeResponse> {
    const requestHash = `${recipeId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<DeleteRecipeResponse>(tx, operationId, "recipe:delete", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "recipe:delete", userId, null, requestHash);
      await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${recipeId} FOR UPDATE`;
      const recipe = await this.requireOwnedPublishedRecipe(tx, userId, recipeId);
      await this.assertRecipeRecommendationMutable(tx, recipeId);
      if (recipe.version !== expectedVersion) throw new ConflictException("菜谱已被更新，请刷新后重试");

      const entitlements = await this.entitlementService.resolveForUser(tx, userId);
      const now = new Date();
      const recycledUntil =
        entitlements.recycleDays > 0 ? new Date(now.getTime() + entitlements.recycleDays * 24 * 60 * 60 * 1000) : null;
      const status: RecipeStatus = recycledUntil ? "RECYCLED" : "DELETED";
      await tx.recipe.update({
        where: { id: recipeId },
        data: {
          status,
          deletedAt: now,
          recycledUntil,
          version: { increment: 1 }
        }
      });
      if (status === "DELETED") {
        await removeStorageLedger(tx, userId, "RECIPE", recipeRecordKey(recipeId));
      }
      const result = {
        recipeId,
        status,
        deletedAt: toIsoDate(now),
        recycledUntil: recycledUntil ? toIsoDate(recycledUntil) : null
      } satisfies DeleteRecipeResponse;
      await completeIdempotentOperation(tx, operationId, "recipe:delete", userId, null, requestHash, result);
      return result;
    });
  }

  async listCollections(userId: UUID): Promise<CollectionListResponse> {
    const [scenes, collections] = await this.prisma.$transaction([
      this.prisma.recipeScene.findMany({
        where: { userId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }),
      this.prisma.recipeCollection.findMany({
        where: { userId },
        select: {
          updatedAt: true,
          sceneLinks: {
            select: {
              sceneId: true
            }
          }
        }
      })
    ]);

    const stats = new Map<UUID, { recipeCount: number; updatedAt: Date | null }>();
    for (const scene of scenes) {
      stats.set(scene.id, { recipeCount: 0, updatedAt: null });
    }
    for (const collection of collections) {
      for (const link of collection.sceneLinks) {
        const current = stats.get(link.sceneId);
        if (!current) continue;
        current.recipeCount += 1;
        current.updatedAt =
          !current.updatedAt || collection.updatedAt > current.updatedAt ? collection.updatedAt : current.updatedAt;
      }
    }

    return {
      items: scenes.map(scene => {
        const current = stats.get(scene.id) ?? { recipeCount: 0, updatedAt: null };
        return toCollectionSceneSummary(scene, current.recipeCount, current.updatedAt);
      }),
      totalCount: collections.length
    };
  }

  async listCollectionRecipes(
    userId: UUID,
    page: number,
    pageSize: number,
    keyword?: string,
    sceneId?: UUID
  ): Promise<PageResult<CollectedRecipeSummary>> {
    if (sceneId) {
      await this.requireOwnedScene(this.prisma, userId, sceneId);
    }
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.RecipeCollectionWhereInput = {
      userId,
      ...(keyword ? { sourceVersion: { searchText: { contains: buildSearchKey(keyword) } } } : {}),
      ...(sceneId ? { sceneLinks: { some: { sceneId } } } : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipeCollection.findMany({
        where,
        include: {
          sourceRecipe: {
            include: {
              inspirationCategory: true
            }
          },
          sourceVersion: true,
          sceneLinks: {
            include: {
              scene: true
            }
          }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipeCollection.count({ where })
    ]);

    return {
      items: items.map(item => this.toCollectedRecipeSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async getCollectionRecipe(userId: UUID, collectionRecipeId: UUID): Promise<CollectedRecipeDetail> {
    const collection = await this.loadCollection(this.prisma, userId, collectionRecipeId);
    return this.toCollectedRecipeDetail(collection);
  }

  async collectRecipe(
    userId: UUID,
    operationId: OperationId,
    sourceRecipeId: UUID,
    sourceVersionId: UUID,
    sceneIds: UUID[]
  ): Promise<SaveCollectionRecipeResponse> {
    const normalizedSceneIds = Array.from(new Set(sceneIds)).sort();
    if (!normalizedSceneIds.length) {
      throw new BadRequestException("至少选择一个合集");
    }
    const requestHash = JSON.stringify({ sourceRecipeId, sourceVersionId, sceneIds: normalizedSceneIds });

    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<SaveCollectionRecipeResponse>(
        tx,
        operationId,
        "collection-recipe:create",
        userId,
        null,
        requestHash
      );
      if (repeated) return repeated;

      if (normalizedSceneIds.length > 0) {
        const scenes = await tx.recipeScene.findMany({
          where: {
            userId,
            id: { in: normalizedSceneIds }
          },
          select: { id: true }
        });
        if (scenes.length !== normalizedSceneIds.length) {
          throw new NotFoundException("场景不存在");
        }
      }

      await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${sourceRecipeId} FOR UPDATE`;
      const sourceRecipe = await tx.recipe.findFirst({
        where: {
          id: sourceRecipeId,
          ownerId: null,
          status: "ACTIVE"
        },
        include: {
          inspirationCategory: true,
          currentVersion: true
        }
      });
      if (!sourceRecipe || !sourceRecipe.inspirationCategory) {
        throw new NotFoundException("灵感菜谱不存在");
      }
      if (sourceRecipe.currentVersionId !== sourceVersionId) {
        throw new ConflictException("灵感版本已更新，请刷新后重试");
      }

      let existing = await tx.recipeCollection.findFirst({
        where: {
          userId,
          sourceRecipeId,
          sourceVersionId
        },
        include: {
          sourceRecipe: {
            include: {
              inspirationCategory: true
            }
          },
          sourceVersion: true,
          sceneLinks: {
            include: {
              scene: true
            }
          }
        }
      });
      const holderBeforeCreate = existing
        ? true
        : Boolean(
            await tx.recipeCollection.findFirst({
              where: {
                userId,
                sourceRecipeId
              },
              select: { id: true }
            })
          );
      let createdNow = false;

      await startIdempotentOperation(tx, operationId, "collection-recipe:create", userId, null, requestHash);

      if (!existing) {
        await this.assertRecipeQuota(tx, userId, 1);
        await this.assertStorageDelta(tx, userId, sourceRecipe.currentVersion.contentSizeBytes);

        try {
          existing = await tx.recipeCollection.create({
            data: {
              userId,
              sourceRecipeId,
              sourceVersionId
            },
            include: {
              sourceRecipe: {
                include: {
                  inspirationCategory: true
                }
              },
              sourceVersion: true,
              sceneLinks: {
                include: {
                  scene: true
                }
              }
            }
          });
          createdNow = true;
          await upsertStorageLedger(tx, userId, "RECIPE", collectionRecordKey(existing.id), sourceRecipe.currentVersion.contentSizeBytes);
          if (!holderBeforeCreate) {
            await this.bumpRecipeCollectCount(tx, sourceRecipeId, 1);
          }
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
            throw error;
          }
          existing = await tx.recipeCollection.findFirst({
            where: {
              userId,
              sourceRecipeId,
              sourceVersionId
            },
            include: {
              sourceRecipe: {
                include: {
                  inspirationCategory: true
                }
              },
              sourceVersion: true,
              sceneLinks: {
                include: {
                  scene: true
                }
              }
            }
          });
        }
      }

      if (!existing) {
        throw new ConflictException("收藏已存在，请刷新后重试");
      }

      const currentSceneIds = new Set(existing.sceneLinks.map(link => link.sceneId));
      const missingSceneIds = normalizedSceneIds.filter(sceneId => !currentSceneIds.has(sceneId));
      if (!createdNow && missingSceneIds.length === 0) {
        throw new ConflictException("该灵感版本已收藏");
      }

      if (missingSceneIds.length > 0) {
        await tx.recipeCollectionScene.createMany({
          data: missingSceneIds.map(sceneId => ({
            collectionId: existing!.id,
            sceneId
          })),
          skipDuplicates: true
        });
      }
      if (!createdNow && missingSceneIds.length > 0) {
        await tx.recipeCollection.update({
          where: { id: existing.id },
          data: {
            version: { increment: 1 }
          }
        });
      }

      const next = await this.loadCollection(tx, userId, existing.id);
      const result = {
        recipe: this.toCollectedRecipeDetail(next)
      } satisfies SaveCollectionRecipeResponse;
      await completeIdempotentOperation(tx, operationId, "collection-recipe:create", userId, null, requestHash, result);
      return result;
    });
  }

  async listInspirationCategories() {
    const items = await this.prisma.inspirationCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    return items.map(toInspirationCategorySummary);
  }

  async listInspirationRecipes(
    page: number,
    pageSize: number,
    keyword?: string,
    categoryId?: UUID,
    sort?: InspirationRecipeSummary["updatedAt"] extends string ? "RECOMMENDED" | "LATEST" : never,
    difficulty?: RecipeContentSnapshot["difficulty"],
    duration?: RecipeContentSnapshot["duration"]
  ): Promise<PageResult<InspirationRecipeSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.RecipeWhereInput = {
      ownerId: null,
      inspirationCategoryId: { not: null },
      status: "ACTIVE",
      ...(categoryId ? { inspirationCategoryId: categoryId } : {}),
      ...(keyword ? { searchText: { contains: buildSearchKey(keyword) } } : {}),
      ...(difficulty || duration
        ? {
            currentVersion: {
              ...(difficulty ? { difficulty } : {}),
              ...(duration ? { duration } : {})
            }
          }
        : {})
    };
    const orderBy =
      sort === "LATEST"
        ? [{ updatedAt: "desc" as const }, { id: "desc" as const }]
        : [{ collectCount: "desc" as const }, { likeCount: "desc" as const }, { updatedAt: "desc" as const }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        include: {
          owner: { select: { uid: true, nickname: true } },
          category: true,
          inspirationCategory: true,
          currentVersion: true,
          sceneLinks: { include: { scene: true } }
        },
        orderBy,
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipe.count({ where })
    ]);

    return {
      items: items.map(item => this.toInspirationRecipeSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async getInspirationRecipe(recipeId: UUID) {
    const recipe = await this.prisma.recipe.findFirst({
      where: {
        id: recipeId,
        ownerId: null,
        inspirationCategoryId: { not: null },
        status: "ACTIVE"
      },
      include: {
        owner: { select: { uid: true, nickname: true } },
        category: true,
        inspirationCategory: true,
        currentVersion: true,
        sceneLinks: { include: { scene: true } }
      }
    });
    if (!recipe || !recipe.inspirationCategory) throw new NotFoundException("灵感菜谱不存在");
    return this.toInspirationRecipeDetail(recipe);
  }

  async reportRecipe(userId: UUID, recipeId: UUID, operationId: OperationId, reason: string): Promise<RecipeReportSummary> {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new BadRequestException("举报原因不能为空");
    const requestHash = `${recipeId}:${normalizedReason}`;
    return this.prisma.$transaction(async tx => {
      const recipe = await tx.recipe.findFirst({
        where: {
          id: recipeId,
          OR: [
            { ownerId: null, inspirationCategoryId: { not: null }, status: "ACTIVE" },
            { ownerId: userId, status: { in: activeRecipeStatuses } }
          ]
        }
      });
      if (!recipe) throw new NotFoundException("菜谱不存在");
      const repeated = await getIdempotentResult<RecipeReportSummary>(tx, operationId, "recipe:report", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "recipe:report", userId, null, requestHash);
      const report = await tx.recipeReport.create({
        data: {
          recipeId,
          reporterId: userId,
          reason: normalizedReason
        },
        include: {
          reporter: { select: { uid: true } }
        }
      });
      await tx.recipe.update({
        where: { id: recipeId },
        data: {
          reportCount: { increment: 1 }
        }
      });
      const result = {
        id: report.id,
        recipeId: report.recipeId,
        reporterUid: report.reporter.uid,
        reason: report.reason,
        status: report.status,
        createdAt: toIsoDate(report.createdAt)
      } satisfies RecipeReportSummary;
      await completeIdempotentOperation(tx, operationId, "recipe:report", userId, null, requestHash, result);
      return result;
    });
  }

  private async requireOwnedCategory(tx: RecipeDb, userId: UUID, categoryId: UUID) {
    const category = await tx.recipeCategory.findFirst({
      where: {
        id: categoryId,
        userId
      }
    });
    if (!category) throw new NotFoundException("分类不存在");
    return category;
  }

  private async requireOwnedScene(tx: RecipeDb, userId: UUID, sceneId: UUID) {
    const scene = await tx.recipeScene.findFirst({
      where: {
        id: sceneId,
        userId
      }
    });
    if (!scene) throw new NotFoundException("场景不存在");
    return scene;
  }

  private async requireIngredientCategory(tx: RecipeDb, categoryId: UUID) {
    const category = await tx.ingredientCategory.findUnique({
      where: { id: categoryId }
    });
    if (!category) throw new NotFoundException("食材分类不存在");
    return category;
  }

  private async requireSelectableIngredientCategory(tx: RecipeDb, categoryId: UUID) {
    const category = await this.requireIngredientCategory(tx, categoryId);
    if (!category.isSelectable) throw new BadRequestException("该分类暂不开放选择");
    return category;
  }

  private async requireInspirationCategory(tx: RecipeDb, categoryId: UUID) {
    const category = await tx.inspirationCategory.findUnique({
      where: { id: categoryId }
    });
    if (!category) throw new NotFoundException("系统菜谱分类不存在");
    return category;
  }

  private async requireAccessibleUnit(tx: RecipeDb, userId: UUID, unitId: UUID) {
    const unit = await tx.unit.findFirst({
      where: {
        id: unitId,
        OR: [{ ownerId: null }, { ownerId: userId }]
      }
    });
    if (!unit) throw new NotFoundException("单位不存在");
    return unit;
  }

  private async requireOwnedIngredient(tx: RecipeDb, userId: UUID, ingredientId: UUID) {
    const ingredient = await tx.ingredient.findFirst({
      where: {
        id: ingredientId,
        ownerId: userId,
        status: "ACTIVE"
      },
      include: {
        defaultUnit: true
      }
    });
    if (!ingredient) throw new NotFoundException("个人食材不存在");
    return ingredient;
  }

  private async requireOwnedEditableIngredient(tx: RecipeDb, userId: UUID, ingredientId: UUID) {
    const ingredient = await this.requireOwnedIngredient(tx, userId, ingredientId);
    const pending = await tx.ingredientRecommendation.findFirst({
      where: {
        ingredientId,
        status: "PENDING"
      },
      select: { id: true }
    });
    if (pending) throw new ConflictException("该食材正在审核中，暂不支持编辑");
    return ingredient;
  }

  private async requireOwnedPublishedRecipe(tx: RecipeDb, userId: UUID, recipeId: UUID) {
    const recipe = await this.loadOwnedRecipe(tx, userId, recipeId);
    if (recipe.status !== "ACTIVE") throw new BadRequestException("当前菜谱状态不允许操作");
    return recipe;
  }

  private async loadOwnedRecipe(tx: RecipeDb, userId: UUID, recipeId: UUID) {
    const recipe = await tx.recipe.findFirst({
      where: {
        id: recipeId,
        ownerId: userId,
        status: { in: activeRecipeStatuses }
      },
      include: {
        owner: { select: { uid: true, nickname: true } },
        category: true,
        inspirationCategory: true,
        currentVersion: true,
        sceneLinks: {
          include: {
            scene: true
          }
        }
      }
    });
    if (!recipe || !recipe.category) throw new NotFoundException("菜谱不存在");
    return recipe;
  }

  private async loadLatestRecipeRecommendation(tx: RecipeDb, recipeId: UUID): Promise<RecipeRecommendationSummary | null> {
    const recommendation = await tx.recipeRecommendation.findFirst({
      where: { recipeId },
      include: {
        suggestedCategory: true,
        adoptedRecipe: {
          select: {
            id: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
    return recommendation ? toRecipeRecommendationSummary(recommendation) : null;
  }

  private async requireOwnedPendingRecipeRecommendation(tx: RecipeDb, userId: UUID, recommendationId: UUID) {
    const recommendation = await tx.recipeRecommendation.findFirst({
      where: {
        id: recommendationId,
        userId,
        status: "PENDING"
      },
      include: {
        suggestedCategory: true,
        adoptedRecipe: {
          select: {
            id: true
          }
        }
      }
    });
    if (!recommendation) throw new NotFoundException("待撤回推荐不存在");
    return recommendation;
  }

  private async assertRecipeRecommendationCreateAllowed(tx: RecipeDb, recipe: RecipeRow) {
    if ((await this.isUnchangedOriginRecipe(tx, recipe)) || (await this.isLegacyUnchangedInspirationRecipe(tx, recipe))) {
      throw new ConflictException("未改动的灵感菜谱不能重复推荐");
    }
    const [pending, adopted] = await Promise.all([
      tx.recipeRecommendation.findFirst({
        where: {
          recipeId: recipe.id,
          status: "PENDING"
        },
        select: { id: true }
      }),
      tx.recipeRecommendation.findFirst({
        where: {
          recipeId: recipe.id,
          sourceVersionId: recipe.currentVersionId,
          status: "ADOPTED"
        },
        select: { id: true }
      })
    ]);
    if (pending) throw new ConflictException("当前菜谱已在审核中");
    if (adopted) throw new ConflictException("当前版本已收录到系统菜谱");
  }

  private async assertRecipeRecommendationMutable(tx: RecipeDb, recipeId: UUID) {
    const pending = await tx.recipeRecommendation.findFirst({
      where: {
        recipeId,
        status: "PENDING"
      },
      select: { id: true }
    });
    if (pending) {
      throw new ConflictException("当前菜谱正在审核中，暂不支持编辑或删除");
    }
  }

  private async loadDraft(tx: RecipeDb, userId: UUID, draftId: UUID) {
    const draft = await tx.recipeDraft.findFirst({
      where: {
        id: draftId,
        userId
      },
      include: {
        category: true,
        scenes: {
          include: {
            scene: true
          }
        }
      }
    });
    if (!draft) throw new NotFoundException("草稿不存在");
    return draft;
  }

  private async loadCollection(tx: RecipeDb, userId: UUID, collectionId: UUID) {
    const collection = await tx.recipeCollection.findFirst({
      where: {
        id: collectionId,
        userId
      },
      include: {
        sourceRecipe: {
          include: {
            inspirationCategory: true
          }
        },
        sourceVersion: true,
        sceneLinks: {
          include: {
            scene: true
          }
        }
      }
    });
    if (!collection || !collection.sourceRecipe.inspirationCategory) {
      throw new NotFoundException("收藏菜谱不存在");
    }
    return collection;
  }

  private async toDraftDetail(tx: RecipeDb, userId: UUID, draft: DraftRow): Promise<RecipeDraftDetail> {
    const content = fromJson<RecipeDraftContentInput>(draft.contentJson);
    const refs = await this.loadRecipeEditRefs(tx, userId, content.ingredients);
    return {
      id: draft.id,
      recipeId: draft.recipeId,
      version: draft.version,
      content: this.normalizeDraftEditContent(content, refs.ingredientMap),
      ingredientRefs: refs.ingredientRefs,
      unitRefs: refs.unitRefs,
      category: draft.category ? toRecipeCategorySummary(draft.category) : null,
      scenes: draft.scenes.map(link => toRecipeSceneSummary(link.scene)),
      createdAt: toIsoDate(draft.createdAt),
      updatedAt: toIsoDate(draft.updatedAt)
    };
  }

  private toMyRecipeSummary(recipe: RecipeRow): MyRecipeSummary {
    const content = versionToContent(recipe.currentVersion);
    return {
      id: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      difficulty: content.difficulty,
      duration: content.duration,
      category: toRecipeCategorySummary(recipe.category as RecipeCategoryRow),
      version: recipe.version,
      updatedAt: toIsoDate(recipe.updatedAt)
    };
  }

  private async toMyRecipeDetail(tx: RecipeDb, userId: UUID, recipe: RecipeRow): Promise<MyRecipeDetail> {
    const content = versionToContent(recipe.currentVersion);
    const [refs, recommendation] = await Promise.all([
      this.loadRecipeEditRefs(tx, userId, content.ingredients),
      this.loadLatestRecipeRecommendation(tx, recipe.id)
    ]);
    return {
      id: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      category: toRecipeCategorySummary(recipe.category as RecipeCategoryRow),
      scenes: recipe.sceneLinks.map(link => toRecipeSceneSummary(link.scene)),
      contentVersionId: recipe.currentVersionId,
      content: this.normalizeRecipeEditContent(content, refs.ingredientMap),
      ingredientRefs: refs.ingredientRefs,
      unitRefs: refs.unitRefs,
      recommendation,
      status: recipe.status,
      version: recipe.version,
      createdAt: toIsoDate(recipe.createdAt),
      updatedAt: toIsoDate(recipe.updatedAt)
    };
  }

  private async loadRecipeEditRefs(
    tx: RecipeDb,
    userId: UUID,
    ingredients: RecipeDraftContentInput["ingredients"] | Array<{ ingredientId: UUID; amount: { kind: "EXACT" | "FUZZY"; unitId?: UUID | null } }>
  ): Promise<EditRefs> {
    const ingredientIds = Array.from(
      new Set(
        ingredients
          .map(item => ("ingredientId" in item ? item.ingredientId : null))
          .filter((item): item is UUID => Boolean(item))
      )
    );
    const unitIds = Array.from(
      new Set(
        ingredients.flatMap(item => {
          if ("amount" in item) {
            return item.amount.kind === "EXACT" && item.amount.unitId ? [item.amount.unitId] : [];
          }
          return item.unitId ? [item.unitId] : [];
        })
      )
    );
    const [ingredientRows, unitRows] = await Promise.all([
      ingredientIds.length === 0
        ? []
        : tx.ingredient.findMany({
            where: {
              id: { in: ingredientIds },
              OR: [{ ownerId: null }, { ownerId: userId }]
            },
            include: {
              defaultUnit: true,
              mergedTo: {
                include: {
                  defaultUnit: true
                }
              }
            }
          }),
      unitIds.length === 0
        ? []
        : tx.unit.findMany({
            where: {
              id: { in: unitIds },
              OR: [{ ownerId: null }, { ownerId: userId }]
            }
          })
    ]);

    const ingredientRowMap = new Map(ingredientRows.map(item => [item.id, item]));
    const ingredientMap = new Map<UUID, IngredientSummary>();
    const ingredientRefMap = new Map<UUID, IngredientSummary>();
    for (const ingredientId of ingredientIds) {
      const item = ingredientRowMap.get(ingredientId);
      if (!item) continue;
      const resolved = item.status === "MERGED" && item.mergedTo ? item.mergedTo : item;
      const summary = {
        id: resolved.id,
        name: resolved.name,
        source: resolved.ownerId ? "PERSONAL" : "SYSTEM",
        categoryId: resolved.categoryId,
        defaultUnit: toUnitSummary(resolved.defaultUnit),
        imageUrl: null,
        recommendationStatus: null,
        version: resolved.version
      } satisfies IngredientSummary;
      ingredientMap.set(item.id, summary);
      ingredientRefMap.set(summary.id, summary);
    }

    return {
      ingredientRefs: Array.from(ingredientRefMap.values()),
      ingredientMap,
      unitRefs: unitRows.map(toUnitSummary)
    };
  }

  private normalizeDraftEditContent(content: RecipeDraftContentInput, ingredientMap: Map<UUID, IngredientSummary>): RecipeDraftContentInput {
    const ingredients = content.ingredients.map(item => {
      if (!item.ingredientId) return item;
      const resolved = ingredientMap.get(item.ingredientId);
      if (!resolved || resolved.id === item.ingredientId) return item;
      return {
        ...item,
        ingredientId: resolved.id,
        name: resolved.name,
        categoryId: resolved.categoryId,
        defaultUnitId: resolved.defaultUnit.id,
        source: resolved.source
      };
    });
    return {
      ...content,
      ingredients
    };
  }

  private normalizeRecipeEditContent(content: RecipeContentSnapshot, ingredientMap: Map<UUID, IngredientSummary>): RecipeContentSnapshot {
    const ingredients = content.ingredients.map(item => {
      const resolved = ingredientMap.get(item.ingredientId);
      if (!resolved) return item;
      return {
        ...item,
        ingredientId: resolved.id,
        ingredientName: resolved.name,
        source: resolved.source,
        categoryId: resolved.categoryId
      };
    });
    return {
      ...content,
      ingredients
    };
  }

  private toCollectedRecipeSummary(collection: CollectionRow): CollectedRecipeSummary {
    const content = versionToContent(collection.sourceVersion);
    return {
      id: collection.id,
      sourceRecipeId: collection.sourceRecipeId,
      title: collection.sourceVersion.name,
      coverImageUrl: collection.sourceRecipe.coverImageUrl,
      difficulty: content.difficulty,
      duration: content.duration,
      category: toInspirationCategorySummary(
        collection.sourceRecipe.inspirationCategory as NonNullable<CollectionRow["sourceRecipe"]["inspirationCategory"]>
      ),
      scenes: collection.sceneLinks.map(link => toRecipeSceneSummary(link.scene)),
      contentVersionId: collection.sourceVersionId,
      collectedAt: toIsoDate(collection.createdAt),
      updatedAt: toIsoDate(collection.updatedAt)
    };
  }

  private toCollectedRecipeDetail(collection: CollectionRow): CollectedRecipeDetail {
    return {
      id: collection.id,
      sourceRecipeId: collection.sourceRecipeId,
      title: collection.sourceVersion.name,
      coverImageUrl: collection.sourceRecipe.coverImageUrl,
      category: toInspirationCategorySummary(
        collection.sourceRecipe.inspirationCategory as NonNullable<CollectionRow["sourceRecipe"]["inspirationCategory"]>
      ),
      scenes: collection.sceneLinks.map(link => toRecipeSceneSummary(link.scene)),
      contentVersionId: collection.sourceVersionId,
      content: versionToContent(collection.sourceVersion),
      collectedAt: toIsoDate(collection.createdAt),
      updatedAt: toIsoDate(collection.updatedAt)
    };
  }

  private toInspirationRecipeSummary(recipe: RecipeRow): InspirationRecipeSummary {
    const content = versionToContent(recipe.currentVersion);
    return {
      id: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      difficulty: content.difficulty,
      duration: content.duration,
      category: toInspirationCategorySummary(recipe.inspirationCategory as NonNullable<RecipeRow["inspirationCategory"]>),
      likeCount: recipe.likeCount,
      collectCount: recipe.collectCount,
      updatedAt: toIsoDate(recipe.updatedAt)
    };
  }

  private toInspirationRecipeDetail(recipe: RecipeRow): InspirationRecipeDetail {
    return {
      id: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      category: toInspirationCategorySummary(recipe.inspirationCategory as NonNullable<RecipeRow["inspirationCategory"]>),
      contentVersionId: recipe.currentVersionId,
      content: versionToContent(recipe.currentVersion),
      likeCount: recipe.likeCount,
      collectCount: recipe.collectCount,
      curatedByName: recipe.curatedByName,
      updatedAt: toIsoDate(recipe.updatedAt)
    };
  }

  private assertDraftTitle(content: RecipeDraftContentInput) {
    if (!content.name.trim()) throw new BadRequestException("菜谱名称不能为空");
  }

  private async resolveDraftRelations(tx: RecipeDb, userId: UUID, content: RecipeDraftContentInput) {
    const category =
      content.categoryId === null
        ? null
        : await tx.recipeCategory.findFirst({
            where: {
              id: content.categoryId,
              userId
            },
            select: { id: true }
          });

    if (content.sceneIds.length === 0) {
      return {
        categoryId: category?.id ?? null,
        sceneIds: [] as UUID[]
      };
    }

    const sceneRows = await tx.recipeScene.findMany({
      where: {
        id: { in: content.sceneIds },
        userId
      },
      select: { id: true }
    });
    const sceneSet = new Set(sceneRows.map(item => item.id));
    return {
      categoryId: category?.id ?? null,
      sceneIds: content.sceneIds.filter(sceneId => sceneSet.has(sceneId))
    };
  }

  private assertPublishContent(content: RecipeDraftContentInput) {
    if (!content.name.trim()) throw new BadRequestException("菜谱名称不能为空");
    if (!content.categoryId) throw new BadRequestException("请选择个人分类");
    if (!content.baseServings || content.baseServings < 1 || content.baseServings > 20) {
      throw new BadRequestException("基准人数必须为 1 到 20");
    }
    if (!content.difficulty) throw new BadRequestException("请选择难度");
    if (!content.duration) throw new BadRequestException("请选择时长");
    if (content.ingredients.length === 0) throw new BadRequestException("至少需要一个食材");
    if (!content.steps.some(item => item.text.trim() || item.uploadId || item.imageUrl)) {
      throw new BadRequestException("至少需要一个制作步骤");
    }
    for (let index = 0; index < content.ingredients.length; index += 1) {
      const item = content.ingredients[index];
      if (!item.name.trim()) throw new BadRequestException(`请填写第 ${index + 1} 个食材名称`);
      if (!item.ingredientId) throw new BadRequestException(`请重新选择第 ${index + 1} 个食材`);
      if (item.fuzzyText) continue;
      if (!item.unitId) throw new BadRequestException(`请选择第 ${index + 1} 个食材的单位`);
      if (!item.quantity.trim() || Number(item.quantity) <= 0) {
        throw new BadRequestException(`请填写第 ${index + 1} 个食材的大于 0 的数量`);
      }
    }
  }

  private async buildPublishedContent(tx: RecipeDb, userId: UUID, content: RecipeDraftContentInput): Promise<RecipeContentSnapshot> {
    const ingredientIds = Array.from(new Set(content.ingredients.map(item => item.ingredientId).filter((item): item is UUID => Boolean(item))));
    const unitIds = Array.from(
      new Set(content.ingredients.flatMap(item => (item.unitId ? [item.unitId] : [])))
    );
    const [ingredientRows, unitRows] = await Promise.all([
      tx.ingredient.findMany({
        where: {
          id: { in: ingredientIds },
          OR: [{ ownerId: null }, { ownerId: userId }]
        },
        include: {
          defaultUnit: true,
          mergedTo: {
            include: {
              defaultUnit: true
            }
          }
        }
      }),
      unitIds.length === 0
        ? []
        : tx.unit.findMany({
            where: {
              id: { in: unitIds },
              OR: [{ ownerId: null }, { ownerId: userId }]
            }
          })
    ]);
    const ingredientMap = new Map(ingredientRows.map(item => [item.id, item]));
    const unitMap = new Map(unitRows.map(item => [item.id, item]));

    return {
      name: content.name.trim(),
      story: content.story?.trim() || null,
      baseServings: content.baseServings as number,
      difficulty: content.difficulty,
      duration: content.duration ?? null,
      tips: content.tips?.trim() || null,
      ingredients: content.ingredients.map(item => {
        if (!item.ingredientId) throw new BadRequestException("请重新选择食材");
        const sourceIngredient = ingredientMap.get(item.ingredientId);
        if (!sourceIngredient) throw new NotFoundException("食材不存在");
        const ingredient = sourceIngredient.status === "MERGED" && sourceIngredient.mergedTo ? sourceIngredient.mergedTo : sourceIngredient;
        if (item.fuzzyText) {
          return {
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            source: ingredient.ownerId ? "PERSONAL" : "SYSTEM",
            categoryId: ingredient.categoryId,
            amount: {
              kind: "FUZZY",
              text: item.fuzzyText
            }
          };
        }
        if (!item.unitId) throw new BadRequestException("精确用量必须选择单位");
        const unit = unitMap.get(item.unitId);
        if (!unit) throw new NotFoundException("单位不存在");
        return {
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          source: ingredient.ownerId ? "PERSONAL" : "SYSTEM",
          categoryId: ingredient.categoryId,
          amount: {
            kind: "EXACT",
            quantity: item.quantity.trim(),
            unitId: unit.id,
            unitName: unit.name,
            unitType: unit.type
          }
        };
      }),
      steps: content.steps
        .filter(item => item.text.trim() || item.uploadId || item.imageUrl)
        .map(item => ({
          text: item.text.trim(),
          imageUrl: item.imageUrl ?? null
        }))
    };
  }

  private buildVersionCreateInput(
    userId: UUID,
    content: RecipeContentSnapshot,
    images: VersionImageState
  ): Prisma.RecipeContentVersionUncheckedCreateInput {
    return {
      createdByUserId: userId,
      name: content.name,
      story: content.story,
      baseServings: content.baseServings,
      difficulty: content.difficulty ?? undefined,
      duration: content.duration ?? undefined,
      tips: content.tips,
      ingredientsJson: toJson(content.ingredients),
      stepsJson: toJson(content.steps),
      imagesJson: toJson(images),
      searchText: buildRecipeSearchText(content),
      contentSizeBytes: contentSizeBytes(content)
    };
  }

  private collectDraftUploadIds(content: RecipeDraftContentInput) {
    const ids = new Set<UUID>();
    if (content.coverUploadId) {
      ids.add(content.coverUploadId);
    }
    for (const step of content.steps) {
      if (step.uploadId) {
        ids.add(step.uploadId);
      }
    }
    return ids;
  }

  private buildVersionImageState(content: RecipeDraftContentInput): VersionImageState {
    return {
      coverUploadId: content.coverUploadId ?? null,
      stepUploads: content.steps.map(item => ({
        slotKey: item.slotKey,
        uploadId: item.uploadId ?? null
      }))
    };
  }

  private async getUploadBytes(tx: RecipeDb, uploadIds: Iterable<UUID>) {
    const ids = Array.from(new Set(uploadIds));
    if (!ids.length) return 0;
    const result = await tx.uploadAsset.aggregate({
      where: {
        id: { in: ids },
        status: { not: "DELETED" }
      },
      _sum: {
        sizeBytes: true
      }
    });
    return result._sum.sizeBytes ?? 0;
  }

  private async getRecipeBytes(tx: RecipeDb, recipe: RecipeRow) {
    const content = versionToContent(recipe.currentVersion);
    const publicIds = this.collectRecipeImagePublicIds(recipe.coverImageUrl, content);
    if (!publicIds.length) {
      return recipe.currentVersion.contentSizeBytes;
    }
    const result = await tx.uploadAsset.aggregate({
      where: {
        publicId: { in: publicIds },
        status: { not: "DELETED" }
      },
      _sum: {
        sizeBytes: true
      }
    });
    return recipe.currentVersion.contentSizeBytes + (result._sum.sizeBytes ?? 0);
  }

  private async calculateEditDraftBytes(tx: RecipeDb, recipe: RecipeRow, content: RecipeDraftContentInput) {
    const currentBytes = await this.getRecipeBytes(tx, recipe);
    const nextBytes = draftSizeBytes(content) + (await this.getUploadBytes(tx, this.collectDraftUploadIds(content)));
    return Math.max(0, nextBytes - currentBytes);
  }

  private collectRecipeImagePublicIds(coverImageUrl: string | null, content: RecipeContentSnapshot) {
    const publicIds = new Set<string>();
    const coverPublicId = extractRecipeImagePublicId(coverImageUrl);
    if (coverPublicId) {
      publicIds.add(coverPublicId);
    }
    for (const step of content.steps) {
      const publicId = extractRecipeImagePublicId(step.imageUrl);
      if (publicId) {
        publicIds.add(publicId);
      }
    }
    return Array.from(publicIds);
  }

  private readOriginContent(content: RecipeDraftContentInput) {
    const originVersionId = content.originVersionId ?? null;
    const originCoverImageUrl = normalizeRecipeImageUrl(content.originCoverImageUrl);
    if (!originVersionId && !originCoverImageUrl) {
      return {
        originVersionId: null,
        originCoverImageUrl: null
      };
    }
    if (!originVersionId) {
      throw new BadRequestException("来源菜谱版本参数错误");
    }
    return {
      originVersionId,
      originCoverImageUrl
    };
  }

  private async isUnchangedOriginRecipe(tx: RecipeDb, recipe: RecipeRow) {
    const currentContent = versionToContent(recipe.currentVersion);
    const currentCoverImageUrl = normalizeRecipeImageUrl(recipe.coverImageUrl);

    if (!recipe.originVersionId) return false;
    const originVersion = await tx.recipeContentVersion.findUnique({
      where: { id: recipe.originVersionId }
    });
    if (!originVersion) return false;
    return this.matchesRecipeSnapshot(
      currentContent,
      currentCoverImageUrl,
      versionToContent(originVersion),
      normalizeRecipeImageUrl(recipe.originCoverImageUrl)
    );
  }

  private async isLegacyUnchangedInspirationRecipe(tx: RecipeDb, recipe: RecipeRow) {
    if (recipe.originVersionId) return false;

    const candidates = await tx.recipe.findMany({
      where: {
        ownerId: null,
        inspirationCategoryId: { not: null },
        status: "ACTIVE",
        searchText: recipe.searchText,
        coverImageUrl: normalizeRecipeImageUrl(recipe.coverImageUrl)
      },
      include: {
        currentVersion: true
      },
      take: 5
    });

    if (!candidates.length) return false;
    const currentContent = versionToContent(recipe.currentVersion);
    const currentCoverImageUrl = normalizeRecipeImageUrl(recipe.coverImageUrl);
    return candidates.some(candidate =>
      this.matchesRecipeSnapshot(
        currentContent,
        currentCoverImageUrl,
        versionToContent(candidate.currentVersion),
        normalizeRecipeImageUrl(candidate.coverImageUrl)
      )
    );
  }

  private matchesRecipeSnapshot(
    leftContent: RecipeContentSnapshot,
    leftCoverImageUrl: string | null,
    rightContent: RecipeContentSnapshot,
    rightCoverImageUrl: string | null
  ) {
    return JSON.stringify(leftContent) === JSON.stringify(rightContent) && leftCoverImageUrl === rightCoverImageUrl;
  }

  private async assertDraftCreateAllowed(tx: RecipeDb, userId: UUID, extraRecipeCount: number, expectedBytes: number) {
    await this.assertRecipeQuota(tx, userId, extraRecipeCount);
    await this.assertStorageDelta(tx, userId, expectedBytes);
  }

  private async assertRecipeQuota(tx: RecipeDb, userId: UUID, extraRecipeCount: number) {
    if (extraRecipeCount <= 0) return;
    const entitlements = await this.entitlementService.resolveForUser(tx, userId);
    const [recipeCount, draftCount, collectionCount] = await Promise.all([
      tx.recipe.count({
        where: {
          ownerId: userId,
          status: { in: activeRecipeStatuses }
        }
      }),
      tx.recipeDraft.count({
        where: {
          userId,
          recipeId: null
        }
      }),
      tx.recipeCollection.count({
        where: {
          userId
        }
      })
    ]);
    if (recipeCount + draftCount + collectionCount + extraRecipeCount > entitlements.recipeLimit) {
      throw new ForbiddenException("菜谱数量已达上限");
    }
  }

  private async assertStorageDelta(tx: RecipeDb, userId: UUID, deltaBytes: number) {
    if (deltaBytes <= 0) return;
    const entitlements = await this.entitlementService.resolveForUser(tx, userId);
    const current = await tx.storageLedger.aggregate({
      where: { userId },
      _sum: { usedBytes: true }
    });
    const usedBytes = current._sum.usedBytes ?? 0;
    if (usedBytes + deltaBytes > entitlements.storageLimitBytes) {
      throw new ForbiddenException("存储空间不足");
    }
  }

  private async assertCategoryLimit(tx: RecipeDb, userId: UUID, type: "CATEGORY" | "SCENE") {
    const count =
      type === "CATEGORY"
        ? await tx.recipeCategory.count({ where: { userId } })
        : await tx.recipeScene.count({ where: { userId } });
    if (count >= 50) {
      throw new ForbiddenException(type === "CATEGORY" ? "个人分类数量已达上限" : "个人场景数量已达上限");
    }
  }

  private async assertCategoryNameAvailable(tx: RecipeDb, userId: UUID, searchKey: string, categoryId: UUID | null) {
    const existing = await tx.recipeCategory.findFirst({
      where: {
        userId,
        searchKey,
        ...(categoryId ? { NOT: { id: categoryId } } : {})
      }
    });
    if (existing) throw new ConflictException("分类名称已存在");
  }

  private async assertSceneNameAvailable(tx: RecipeDb, userId: UUID, searchKey: string, sceneId: UUID | null) {
    const existing = await tx.recipeScene.findFirst({
      where: {
        userId,
        searchKey,
        ...(sceneId ? { NOT: { id: sceneId } } : {})
      }
    });
    if (existing) throw new ConflictException("场景名称已存在");
  }

  private async assertUnitNameAvailable(tx: RecipeDb, userId: UUID, searchKey: string) {
    const existing = await tx.unit.findFirst({
      where: {
        ownerId: userId,
        searchKey
      }
    });
    if (existing) throw new ConflictException("单位名称已存在");
  }

  private async assertIngredientNameAvailable(tx: RecipeDb, userId: UUID, searchKey: string, ingredientId: UUID | null) {
    const system = await tx.ingredient.findFirst({
      where: {
        ownerId: null,
        status: {
          in: ["ACTIVE", "DISABLED"]
        },
        searchKey
      }
    });
    if (system && system.id !== ingredientId) {
      throw new ConflictException("系统食材已存在，请直接选择");
    }

    const existing = await tx.ingredient.findFirst({
      where: {
        ownerId: userId,
        status: "ACTIVE",
        searchKey,
        ...(ingredientId ? { NOT: { id: ingredientId } } : {})
      }
    });
    if (existing) throw new ConflictException("食材名称已存在");
  }

  private async assertIngredientRecommendationAvailable(tx: RecipeDb, ingredientId: UUID) {
    const pending = await tx.ingredientRecommendation.findFirst({
      where: {
        ingredientId,
        status: "PENDING"
      },
      select: { id: true }
    });
    if (pending) throw new ConflictException("该食材已在审核中");
  }

  private async assertIngredientFeedbackAvailable(tx: RecipeDb, userId: UUID, ingredientId: UUID) {
    const pending = await tx.ingredientFeedback.findFirst({
      where: {
        userId,
        ingredientId,
        status: "PENDING"
      },
      select: { id: true }
    });
    if (pending) throw new ConflictException("你已提交过这份食材的纠错，请等待审核");
  }

  private async loadIngredientRecommendationStatusMap(
    tx: RecipeDb,
    ingredientIds: UUID[]
  ): Promise<Map<UUID, IngredientSummary["recommendationStatus"]>> {
    if (!ingredientIds.length) return new Map();
    const rows = await tx.ingredientRecommendation.findMany({
      where: {
        ingredientId: { in: ingredientIds }
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        ingredientId: true,
        status: true
      }
    });
    const statusMap = new Map<UUID, IngredientSummary["recommendationStatus"]>();
    rows.forEach(row => {
      if (statusMap.has(row.ingredientId)) return;
      statusMap.set(
        row.ingredientId,
        row.status === "PENDING" || row.status === "REJECTED" ? row.status : null
      );
    });
    return statusMap;
  }

  private async mergeIngredientIntoSystem(
    tx: Prisma.TransactionClient,
    userId: UUID,
    source: IngredientRow,
    target: IngredientRow,
    reviewNote: string
  ) {
    await this.syncDraftIngredientReferences(tx, userId, source.id, target.id);
    await this.syncRecipeIngredientReferences(tx, userId, source.id, {
      id: target.id,
      name: target.name,
      categoryId: target.categoryId
    });
    await tx.ingredient.update({
      where: { id: source.id },
      data: {
        status: "MERGED",
        mergedToId: target.id,
        version: { increment: 1 }
      }
    });
    const category = await this.requireIngredientCategory(tx, target.categoryId);
    const recommendation = await tx.ingredientRecommendation.create({
      data: {
        ingredientId: source.id,
        userId,
        status: "MERGED",
        ingredientName: target.name,
        categoryId: target.categoryId,
        categoryName: category.name,
        defaultUnitId: target.defaultUnitId,
        defaultUnitName: target.defaultUnit.name,
        reviewNote,
        targetIngredientId: target.id,
        reviewedAt: new Date()
      },
      include: {
        ingredient: {
          include: {
            defaultUnit: true
          }
        },
        targetIngredient: {
          include: {
            defaultUnit: true
          }
        }
      }
    });
    return recommendation;
  }

  private async syncDraftIngredientReferences(tx: Prisma.TransactionClient, userId: UUID, fromId: UUID, toId: UUID) {
    const drafts = await tx.recipeDraft.findMany({
      where: { userId },
      select: {
        id: true,
        contentJson: true
      }
    });
    for (const draft of drafts) {
      const current = fromJson<RecipeDraftContentInput>(draft.contentJson);
      const next = replaceDraftIngredient(current, fromId, toId);
      if (!next.changed) continue;
      await tx.recipeDraft.update({
        where: { id: draft.id },
        data: {
          contentJson: toJson(next.content),
          contentSizeBytes: draftSizeBytes(next.content),
          version: { increment: 1 }
        }
      });
    }
  }

  private async syncRecipeIngredientReferences(
    tx: Prisma.TransactionClient,
    userId: UUID,
    fromId: UUID,
    target: { id: UUID; name: string; categoryId: UUID }
  ) {
    const versions = await tx.recipeContentVersion.findMany({
      where: {
        createdByUserId: userId
      },
      select: {
        id: true,
        name: true,
        story: true,
        baseServings: true,
        difficulty: true,
        tips: true,
        ingredientsJson: true,
        stepsJson: true,
        duration: true
      }
    });
    for (const version of versions) {
      const current = versionToContent(version);
      const next = replaceRecipeIngredient(current, fromId, target);
      if (!next.changed) continue;
      await tx.recipeContentVersion.update({
        where: { id: version.id },
        data: {
          ingredientsJson: toJson(next.content.ingredients),
          searchText: buildRecipeSearchText(next.content),
          contentSizeBytes: contentSizeBytes(next.content)
        }
      });
    }
  }

  private async bumpRecipeCollectCount(tx: RecipeDb, sourceRecipeId: UUID, delta: number) {
    if (delta === 0) return;
    await tx.recipe.update({
      where: { id: sourceRecipeId },
      data: {
        collectCount: {
          increment: delta
        }
      }
    });
  }

  private assertReorderScope<T extends { id: UUID; version: number }>(all: T[], items: ReorderItem[], label: string) {
    if (all.length !== items.length) throw new ConflictException(`${label}排序集合不完整`);
    const currentMap = new Map(all.map(item => [item.id, item.version]));
    for (const item of items) {
      const currentVersion = currentMap.get(item.id);
      if (!currentVersion) throw new ConflictException(`${label}排序集合包含无权对象`);
      if (currentVersion !== item.expectedVersion) throw new ConflictException(`${label}已被更新，请刷新后重试`);
    }
  }

  private async writeSortOrder(
    tx: Prisma.TransactionClient,
    model: "recipeCategory" | "recipeScene" | "recipe",
    ids: UUID[],
    ownerField: "userId" | "ownerId",
    ownerId: UUID,
    extraWhere: Record<string, string | number> = {}
  ) {
    for (let index = 0; index < ids.length; index += 1) {
      await (tx[model] as unknown as { update: (args: Prisma.RecipeCategoryUpdateArgs) => Promise<unknown> }).update({
        where: { id: ids[index] },
        data: { sortOrder: -(index + 1) * 1000 }
      } as Prisma.RecipeCategoryUpdateArgs);
    }
    for (let index = 0; index < ids.length; index += 1) {
      await (tx[model] as unknown as { updateMany: (args: Prisma.RecipeCategoryUpdateManyArgs) => Promise<unknown> }).updateMany({
        where: {
          id: ids[index],
          [ownerField]: ownerId,
          ...extraWhere
        },
        data: {
          sortOrder: index,
          version: { increment: 1 }
        }
      } as Prisma.RecipeCategoryUpdateManyArgs);
    }
  }

  private async nextRecipeSortOrder(tx: RecipeDb, userId: UUID, categoryId: UUID) {
    const last = await tx.recipe.findFirst({
      where: {
        ownerId: userId,
        categoryId,
        status: "ACTIVE"
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true }
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private buildIngredientOwnerWhere(userId: UUID, source?: string): Prisma.IngredientWhereInput {
    if (source === "SYSTEM") return { ownerId: null, status: "ACTIVE", category: { is: { isSelectable: true } } };
    if (source === "PERSONAL") return { ownerId: userId, status: "ACTIVE" };
    return {
      OR: [
        { ownerId: null, status: "ACTIVE", category: { is: { isSelectable: true } } },
        { ownerId: userId, status: "ACTIVE" }
      ]
    };
  }

  private buildIngredientOrderBy(categoryId?: UUID): Prisma.IngredientOrderByWithRelationInput[] {
    if (categoryId) {
      return [{ ownerId: "asc" }, { systemSortOrder: "asc" }, { createdAt: "desc" }];
    }
    return [{ ownerId: "asc" }, { displaySortOrder: "asc" }, { createdAt: "desc" }];
  }

  private buildUnitOwnerWhere(userId: UUID, source?: string): Prisma.UnitWhereInput {
    if (source === "SYSTEM") return { ownerId: null };
    if (source === "PERSONAL") return { ownerId: userId };
    return { OR: [{ ownerId: null }, { ownerId: userId }] };
  }

  private buildIngredientImageUrl(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    ingredient: { ownerId: UUID | null; id: UUID; imageUpdatedAt?: Date | null }
  ) {
    if (ingredient.ownerId) return null;
    return this.ingredientImageService.buildImageUrl(request, ingredient.id, ingredient.imageUpdatedAt ?? null);
  }
}
