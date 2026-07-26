import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, RecipeStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { removeStorageLedger, sizeOfJson, upsertStorageLedger } from "../../common/storage-ledger";
import type {
  DeleteRecipeDraftResponse,
  DeleteRecipeResponse,
  IngredientCategorySummary,
  IngredientSummary,
  InspirationCategorySummary,
  InspirationRecipeDetail,
  InspirationRecipeSummary,
  MyRecipeDetail,
  MyRecipeSummary,
  PageResult,
  PublishRecipeDraftResponse,
  RecipeCategorySummary,
  RecipeContentSnapshot,
  RecipeDraftContentInput,
  RecipeDraftDetail,
  RecipeDraftSummary,
  RecipeIngredientInput,
  RecipeReportSummary,
  RecipeSceneSummary,
  ReorderItem,
  UUID,
  UnitSummary
} from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";
import {
  buildDraftSearchText,
  buildRecipeSearchText,
  buildSearchKey,
  contentSizeBytes,
  draftSizeBytes,
  formatRecipeAmount,
  fromJson,
  normalizeRecipeDraftContent,
  toJson,
  versionToContent
} from "./recipe-content";

type RecipeDb = Prisma.TransactionClient | PrismaService;

type RecipeRow = Prisma.RecipeGetPayload<{
  include: {
    owner: { select: { uid: true } };
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

type RecipeCategoryRow = Prisma.RecipeCategoryGetPayload<Record<string, never>>;
type RecipeSceneRow = Prisma.RecipeSceneGetPayload<Record<string, never>>;
type IngredientCategoryRow = Prisma.IngredientCategoryGetPayload<Record<string, never>>;
type UnitRow = Prisma.UnitGetPayload<Record<string, never>>;
type IngredientRow = Prisma.IngredientGetPayload<{
  include: {
    defaultUnit: true;
  };
}>;

const activeRecipeStatuses: RecipeStatus[] = ["ACTIVE", "RECYCLED", "BLOCKED"];

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

function recipeRecordKey(recipeId: UUID) {
  return `recipe:${recipeId}`;
}

function draftRecordKey(draftId: UUID) {
  return `draft:${draftId}`;
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

function toIngredientCategorySummary(category: IngredientCategoryRow): IngredientCategorySummary {
  return {
    id: category.id,
    name: category.name,
    iconKey: category.iconKey
  };
}

function toInspirationCategorySummary(category: { id: string; name: string; iconKey: string | null }): InspirationCategorySummary {
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

function toIngredientSummary(ingredient: IngredientRow): IngredientSummary {
  return {
    id: ingredient.id,
    name: ingredient.name,
    source: ingredient.ownerId ? "PERSONAL" : "SYSTEM",
    categoryId: ingredient.categoryId,
    defaultUnit: toUnitSummary(ingredient.defaultUnit)
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
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService
  ) {}

  async listRecipeCategories(userId: UUID) {
    const items = await this.prisma.recipeCategory.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    return items.map(toRecipeCategorySummary);
  }

  async createRecipeCategory(userId: UUID, operationId: UUID, name: string) {
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

  async updateRecipeCategory(userId: UUID, categoryId: UUID, operationId: UUID, expectedVersion: number, name: string) {
    const normalizedName = name.trim();
    const searchKey = buildSearchKey(normalizedName);
    const requestHash = `${categoryId}:${expectedVersion}:${searchKey}`;
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipe_categories" WHERE "id" = ${categoryId}::uuid FOR UPDATE`;
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

  async reorderRecipeCategories(userId: UUID, operationId: UUID, items: ReorderItem[]) {
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

  async createRecipeScene(userId: UUID, operationId: UUID, name: string) {
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

  async updateRecipeScene(userId: UUID, sceneId: UUID, operationId: UUID, expectedVersion: number, name: string) {
    const normalizedName = name.trim();
    const searchKey = buildSearchKey(normalizedName);
    const requestHash = `${sceneId}:${expectedVersion}:${searchKey}`;
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipe_scenes" WHERE "id" = ${sceneId}::uuid FOR UPDATE`;
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

  async reorderRecipeScenes(userId: UUID, operationId: UUID, items: ReorderItem[]) {
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
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    return items.map(toIngredientCategorySummary);
  }

  async listIngredients(
    userId: UUID,
    page: number,
    pageSize: number,
    keyword?: string,
    categoryId?: string,
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
        orderBy: [{ ownerId: "asc" }, { createdAt: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.ingredient.count({ where })
    ]);

    return {
      items: items.map(toIngredientSummary),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createIngredient(userId: UUID, operationId: UUID, name: string, categoryId: UUID, defaultUnitId: UUID) {
    const normalizedName = name.trim();
    const searchKey = buildSearchKey(normalizedName);
    const requestHash = `${searchKey}:${categoryId}:${defaultUnitId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<IngredientSummary>(tx, operationId, "ingredient:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "ingredient:create", userId, null, requestHash);
      await this.requireIngredientCategory(tx, categoryId);
      const unit = await this.requireAccessibleUnit(tx, userId, defaultUnitId);
      await this.assertIngredientNameAvailable(tx, userId, searchKey);
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
      const result = toIngredientSummary(ingredient);
      await completeIdempotentOperation(tx, operationId, "ingredient:create", userId, null, requestHash, result);
      return result;
    });
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
        orderBy: [{ ownerId: "asc" }, { createdAt: "desc" }],
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

  async createUnit(userId: UUID, operationId: UUID, name: string, type: UnitSummary["type"]) {
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

  async createRecipeDraft(userId: UUID, operationId: UUID, recipeId: UUID | null, content: RecipeDraftContentInput): Promise<RecipeDraftDetail> {
    const normalized = normalizeRecipeDraftContent(content);
    const requestHash = JSON.stringify({ recipeId, content: normalized });
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<RecipeDraftDetail>(tx, operationId, "recipe-draft:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "recipe-draft:create", userId, null, requestHash);
      await this.assertDraftReferences(tx, userId, normalized);

      if (recipeId) {
        const existing = await tx.recipeDraft.findUnique({
          where: { recipeId },
          include: {
            category: true,
            scenes: { include: { scene: true } }
          }
        });
        if (existing) {
          const result = this.toDraftDetail(existing);
          await completeIdempotentOperation(tx, operationId, "recipe-draft:create", userId, null, requestHash, result);
          return result;
        }
      }

      const recipe = recipeId ? await this.requireOwnedPublishedRecipe(tx, userId, recipeId) : null;
      const usedBytes = recipe ? await this.calculateEditDraftBytes(tx, recipe, normalized) : draftSizeBytes(normalized);
      await this.assertDraftCreateAllowed(tx, userId, recipe ? 0 : 1, usedBytes);

      const draft = await tx.recipeDraft.create({
        data: {
          userId,
          recipeId,
          categoryId: normalized.categoryId,
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

      if (normalized.sceneIds.length > 0) {
        await tx.recipeDraftScene.createMany({
          data: normalized.sceneIds.map(sceneId => ({
            draftId: draft.id,
            sceneId
          }))
        });
      }
      await upsertStorageLedger(tx, userId, "RECIPE", draftRecordKey(draft.id), usedBytes);
      const fullDraft = await this.loadDraft(tx, userId, draft.id);
      const result = this.toDraftDetail(fullDraft);
      await completeIdempotentOperation(tx, operationId, "recipe-draft:create", userId, null, requestHash, result);
      return result;
    });
  }

  async getRecipeDraft(userId: UUID, draftId: UUID) {
    const draft = await this.loadDraft(this.prisma, userId, draftId);
    return this.toDraftDetail(draft);
  }

  async updateRecipeDraft(
    userId: UUID,
    draftId: UUID,
    operationId: UUID,
    expectedVersion: number,
    content: RecipeDraftContentInput
  ): Promise<RecipeDraftDetail> {
    const normalized = normalizeRecipeDraftContent(content);
    const requestHash = JSON.stringify({ draftId, expectedVersion, content: normalized });
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipe_drafts" WHERE "id" = ${draftId}::uuid FOR UPDATE`;
      const draft = await this.loadDraft(tx, userId, draftId);
      const repeated = await getIdempotentResult<RecipeDraftDetail>(tx, operationId, "recipe-draft:update", userId, null, requestHash);
      if (repeated) return repeated;
      if (draft.version !== expectedVersion) throw new ConflictException("草稿已被更新，请刷新后重试");
      await startIdempotentOperation(tx, operationId, "recipe-draft:update", userId, null, requestHash);
      await this.assertDraftReferences(tx, userId, normalized);

      const recipe = draft.recipeId ? await this.requireOwnedPublishedRecipe(tx, userId, draft.recipeId) : null;
      const nextBytes = recipe ? await this.calculateEditDraftBytes(tx, recipe, normalized) : draftSizeBytes(normalized);
      const deltaBytes = nextBytes - draft.contentSizeBytes;
      await this.assertStorageDelta(tx, userId, deltaBytes);

      await tx.recipeDraftScene.deleteMany({ where: { draftId } });
      if (normalized.sceneIds.length > 0) {
        await tx.recipeDraftScene.createMany({
          data: normalized.sceneIds.map(sceneId => ({
            draftId,
            sceneId
          }))
        });
      }

      await tx.recipeDraft.update({
        where: { id: draftId },
        data: {
          categoryId: normalized.categoryId,
          title: normalized.name || null,
          searchText: buildDraftSearchText(normalized),
          contentJson: toJson(normalized),
          contentSizeBytes: nextBytes,
          version: { increment: 1 }
        }
      });
      await upsertStorageLedger(tx, userId, "RECIPE", draftRecordKey(draftId), nextBytes);
      const next = await this.loadDraft(tx, userId, draftId);
      const result = this.toDraftDetail(next);
      await completeIdempotentOperation(tx, operationId, "recipe-draft:update", userId, null, requestHash, result);
      return result;
    });
  }

  async deleteRecipeDraft(userId: UUID, draftId: UUID, operationId: UUID, expectedVersion: number): Promise<DeleteRecipeDraftResponse> {
    const requestHash = `${draftId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipe_drafts" WHERE "id" = ${draftId}::uuid FOR UPDATE`;
      const draft = await this.loadDraft(tx, userId, draftId);
      const repeated = await getIdempotentResult<DeleteRecipeDraftResponse>(tx, operationId, "recipe-draft:delete", userId, null, requestHash);
      if (repeated) return repeated;
      if (draft.version !== expectedVersion) throw new ConflictException("草稿已被更新，请刷新后重试");
      await startIdempotentOperation(tx, operationId, "recipe-draft:delete", userId, null, requestHash);
      await tx.recipeDraft.delete({ where: { id: draftId } });
      await removeStorageLedger(tx, userId, "RECIPE", draftRecordKey(draftId));
      const result = {
        draftId,
        deletedAt: toIsoDate(new Date())
      } satisfies DeleteRecipeDraftResponse;
      await completeIdempotentOperation(tx, operationId, "recipe-draft:delete", userId, null, requestHash, result);
      return result;
    });
  }

  async publishRecipeDraft(userId: UUID, draftId: UUID, operationId: UUID, expectedVersion: number): Promise<PublishRecipeDraftResponse> {
    const requestHash = `${draftId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipe_drafts" WHERE "id" = ${draftId}::uuid FOR UPDATE`;
      const draft = await this.loadDraft(tx, userId, draftId);
      const repeated = await getIdempotentResult<PublishRecipeDraftResponse>(tx, operationId, "recipe-draft:publish", userId, null, requestHash);
      if (repeated) return repeated;
      if (draft.version !== expectedVersion) throw new ConflictException("草稿已被更新，请刷新后重试");
      await startIdempotentOperation(tx, operationId, "recipe-draft:publish", userId, null, requestHash);

      const content = fromJson<RecipeDraftContentInput>(draft.contentJson);
      this.assertPublishContent(content);
      const category = await this.requireOwnedCategory(tx, userId, content.categoryId as UUID);
      const recipeContent = await this.buildPublishedContent(tx, userId, content);
      const nextRecipeBytes = contentSizeBytes(recipeContent);
      const currentDraftBytes = draft.contentSizeBytes;

      let recipe: RecipeRow;
      if (draft.recipeId) {
        const currentRecipe = await this.requireOwnedPublishedRecipe(tx, userId, draft.recipeId);
        const currentRecipeBytes = this.getRecipeBytes(currentRecipe);
        await this.assertStorageDelta(tx, userId, nextRecipeBytes - currentRecipeBytes - currentDraftBytes);
        const version = await tx.recipeContentVersion.create({
          data: this.buildVersionCreateInput(userId, recipeContent)
        });
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
            coverImageUrl: null,
            version: { increment: 1 }
          }
        });
        await upsertStorageLedger(tx, userId, "RECIPE", recipeRecordKey(currentRecipe.id), nextRecipeBytes);
        recipe = await this.loadOwnedRecipe(tx, userId, currentRecipe.id);
      } else {
        await this.assertStorageDelta(tx, userId, nextRecipeBytes - currentDraftBytes);
        const version = await tx.recipeContentVersion.create({
          data: this.buildVersionCreateInput(userId, recipeContent)
        });
        const sortOrder = await this.nextRecipeSortOrder(tx, userId, category.id);
        const created = await tx.recipe.create({
          data: {
            ownerId: userId,
            categoryId: category.id,
            currentVersionId: version.id,
            title: recipeContent.name,
            searchText: buildRecipeSearchText(recipeContent),
            coverImageUrl: null,
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

      await tx.recipeDraft.delete({ where: { id: draftId } });
      await removeStorageLedger(tx, userId, "RECIPE", draftRecordKey(draftId));
      const result = {
        recipe: this.toMyRecipeDetail(recipe)
      } satisfies PublishRecipeDraftResponse;
      await completeIdempotentOperation(tx, operationId, "recipe-draft:publish", userId, null, requestHash, result);
      return result;
    });
  }

  async listMyRecipes(userId: UUID, page: number, pageSize: number, keyword?: string, categoryId?: string): Promise<PageResult<MyRecipeSummary>> {
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
          owner: { select: { uid: true } },
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
    return this.toMyRecipeDetail(recipe);
  }

  async reorderRecipes(userId: UUID, categoryId: UUID, operationId: UUID, items: ReorderItem[]) {
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
          owner: { select: { uid: true } },
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

  async deleteRecipe(userId: UUID, recipeId: UUID, operationId: UUID, expectedVersion: number): Promise<DeleteRecipeResponse> {
    const requestHash = `${recipeId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${recipeId}::uuid FOR UPDATE`;
      const recipe = await this.requireOwnedPublishedRecipe(tx, userId, recipeId);
      const repeated = await getIdempotentResult<DeleteRecipeResponse>(tx, operationId, "recipe:delete", userId, null, requestHash);
      if (repeated) return repeated;
      if (recipe.version !== expectedVersion) throw new ConflictException("菜谱已被更新，请刷新后重试");
      await startIdempotentOperation(tx, operationId, "recipe:delete", userId, null, requestHash);

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
    categoryId?: string,
    sort?: InspirationRecipeSummary["updatedAt"] extends string ? "RECOMMENDED" | "LATEST" : never,
    difficulty?: RecipeContentSnapshot["difficulty"],
    maxDurationMinutes?: number
  ): Promise<PageResult<InspirationRecipeSummary>> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.RecipeWhereInput = {
      ownerId: null,
      status: "ACTIVE",
      ...(categoryId ? { inspirationCategoryId: categoryId } : {}),
      ...(keyword ? { searchText: { contains: buildSearchKey(keyword) } } : {}),
      ...(difficulty || maxDurationMinutes
        ? {
            currentVersion: {
              ...(difficulty ? { difficulty } : {}),
              ...(maxDurationMinutes ? { durationMinutes: { lte: maxDurationMinutes } } : {})
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
          owner: { select: { uid: true } },
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
        status: "ACTIVE"
      },
      include: {
        owner: { select: { uid: true } },
        category: true,
        inspirationCategory: true,
        currentVersion: true,
        sceneLinks: { include: { scene: true } }
      }
    });
    if (!recipe || !recipe.inspirationCategory) throw new NotFoundException("灵感菜谱不存在");
    return this.toInspirationRecipeDetail(recipe);
  }

  async reportRecipe(userId: UUID, recipeId: UUID, operationId: UUID, reason: string): Promise<RecipeReportSummary> {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new BadRequestException("举报原因不能为空");
    const requestHash = `${recipeId}:${normalizedReason}`;
    return this.prisma.$transaction(async tx => {
      const recipe = await tx.recipe.findFirst({
        where: {
          id: recipeId,
          OR: [{ ownerId: null, status: "ACTIVE" }, { ownerId: userId, status: { in: activeRecipeStatuses } }]
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
        owner: { select: { uid: true } },
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

  private toDraftDetail(draft: DraftRow): RecipeDraftDetail {
    return {
      id: draft.id,
      recipeId: draft.recipeId,
      version: draft.version,
      content: fromJson<RecipeDraftContentInput>(draft.contentJson),
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
      durationMinutes: content.durationMinutes,
      category: toRecipeCategorySummary(recipe.category as RecipeCategoryRow),
      version: recipe.version,
      updatedAt: toIsoDate(recipe.updatedAt)
    };
  }

  private toMyRecipeDetail(recipe: RecipeRow): MyRecipeDetail {
    return {
      id: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      category: toRecipeCategorySummary(recipe.category as RecipeCategoryRow),
      scenes: recipe.sceneLinks.map(link => toRecipeSceneSummary(link.scene)),
      contentVersionId: recipe.currentVersionId,
      content: versionToContent(recipe.currentVersion),
      status: recipe.status,
      version: recipe.version,
      createdAt: toIsoDate(recipe.createdAt),
      updatedAt: toIsoDate(recipe.updatedAt)
    };
  }

  private toInspirationRecipeSummary(recipe: RecipeRow): InspirationRecipeSummary {
    const content = versionToContent(recipe.currentVersion);
    return {
      id: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      difficulty: content.difficulty,
      durationMinutes: content.durationMinutes,
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
      curatedByName: null,
      updatedAt: toIsoDate(recipe.updatedAt)
    };
  }

  private async assertDraftReferences(tx: RecipeDb, userId: UUID, content: RecipeDraftContentInput) {
    if (content.categoryId) await this.requireOwnedCategory(tx, userId, content.categoryId);
    if (content.sceneIds.length > 0) {
      const scenes = await tx.recipeScene.findMany({
        where: {
          id: { in: content.sceneIds },
          userId
        },
        select: { id: true }
      });
      if (scenes.length !== content.sceneIds.length) throw new NotFoundException("场景不存在");
    }
    await this.ensureIngredientInputsAccessible(tx, userId, content.ingredients);
  }

  private assertPublishContent(content: RecipeDraftContentInput) {
    if (!content.name.trim()) throw new BadRequestException("菜谱名称不能为空");
    if (!content.categoryId) throw new BadRequestException("请选择个人分类");
    if (!content.baseServings || content.baseServings < 1 || content.baseServings > 20) {
      throw new BadRequestException("基准人数必须为 1 到 20");
    }
    if (content.ingredients.length === 0) throw new BadRequestException("至少需要一个食材");
    if (!content.steps.some(item => item.text.trim())) throw new BadRequestException("至少需要一个制作步骤");
    for (const item of content.ingredients) {
      if (item.amount.kind === "EXACT") {
        if (!item.amount.quantity.trim() || Number(item.amount.quantity) <= 0) {
          throw new BadRequestException("精确用量必须大于 0");
        }
      }
    }
  }

  private async ensureIngredientInputsAccessible(tx: RecipeDb, userId: UUID, ingredients: RecipeIngredientInput[]) {
    if (ingredients.length === 0) return;
    const ingredientIds = Array.from(new Set(ingredients.map(item => item.ingredientId)));
    const unitIds = Array.from(
      new Set(
        ingredients.flatMap(item => (item.amount.kind === "EXACT" ? [item.amount.unitId] : []))
      )
    );
    const [ingredientRows, unitRows] = await Promise.all([
      tx.ingredient.findMany({
        where: {
          id: { in: ingredientIds },
          OR: [{ ownerId: null }, { ownerId: userId }]
        },
        include: {
          defaultUnit: true
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
    if (ingredientRows.length !== ingredientIds.length) throw new NotFoundException("食材不存在");
    if (unitRows.length !== unitIds.length) throw new NotFoundException("单位不存在");
  }

  private async buildPublishedContent(tx: RecipeDb, userId: UUID, content: RecipeDraftContentInput): Promise<RecipeContentSnapshot> {
    const ingredientIds = Array.from(new Set(content.ingredients.map(item => item.ingredientId)));
    const unitIds = Array.from(new Set(content.ingredients.flatMap(item => (item.amount.kind === "EXACT" ? [item.amount.unitId] : []))));
    const [ingredientRows, unitRows] = await Promise.all([
      tx.ingredient.findMany({
        where: {
          id: { in: ingredientIds },
          OR: [{ ownerId: null }, { ownerId: userId }]
        },
        include: {
          defaultUnit: true
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
      durationMinutes: content.durationMinutes ?? null,
      tips: content.tips?.trim() || null,
      ingredients: content.ingredients.map(item => {
        const ingredient = ingredientMap.get(item.ingredientId);
        if (!ingredient) throw new NotFoundException("食材不存在");
        if (item.amount.kind === "FUZZY") {
          return {
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            source: ingredient.ownerId ? "PERSONAL" : "SYSTEM",
            categoryId: ingredient.categoryId,
            amount: {
              kind: "FUZZY",
              text: item.amount.text
            }
          };
        }
        const unit = unitMap.get(item.amount.unitId);
        if (!unit) throw new NotFoundException("单位不存在");
        return {
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          source: ingredient.ownerId ? "PERSONAL" : "SYSTEM",
          categoryId: ingredient.categoryId,
          amount: {
            kind: "EXACT",
            quantity: item.amount.quantity.trim(),
            unitId: unit.id,
            unitName: unit.name,
            unitType: unit.type
          }
        };
      }),
      steps: content.steps.filter(item => item.text.trim()).map(item => ({ text: item.text.trim() }))
    };
  }

  private buildVersionCreateInput(userId: UUID, content: RecipeContentSnapshot): Prisma.RecipeContentVersionUncheckedCreateInput {
    return {
      createdByUserId: userId,
      name: content.name,
      story: content.story,
      baseServings: content.baseServings,
      difficulty: content.difficulty ?? undefined,
      durationMinutes: content.durationMinutes,
      tips: content.tips,
      ingredientsJson: toJson(content.ingredients),
      stepsJson: toJson(content.steps),
      imagesJson: toJson([]),
      searchText: buildRecipeSearchText(content),
      contentSizeBytes: contentSizeBytes(content)
    };
  }

  private getRecipeBytes(recipe: RecipeRow) {
    return recipe.currentVersion.contentSizeBytes;
  }

  private async calculateEditDraftBytes(tx: RecipeDb, recipe: RecipeRow, content: RecipeDraftContentInput) {
    const currentBytes = this.getRecipeBytes(recipe);
    const nextBytes = draftSizeBytes(content);
    return Math.max(0, nextBytes - currentBytes);
  }

  private async assertDraftCreateAllowed(tx: RecipeDb, userId: UUID, extraRecipeCount: number, expectedBytes: number) {
    await this.assertRecipeQuota(tx, userId, extraRecipeCount);
    await this.assertStorageDelta(tx, userId, expectedBytes);
  }

  private async assertRecipeQuota(tx: RecipeDb, userId: UUID, extraRecipeCount: number) {
    if (extraRecipeCount <= 0) return;
    const entitlements = await this.entitlementService.resolveForUser(tx, userId);
    const [recipeCount, draftCount] = await Promise.all([
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
      })
    ]);
    if (recipeCount + draftCount + extraRecipeCount > entitlements.recipeLimit) {
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

  private async assertIngredientNameAvailable(tx: RecipeDb, userId: UUID, searchKey: string) {
    const existing = await tx.ingredient.findFirst({
      where: {
        ownerId: userId,
        searchKey
      }
    });
    if (existing) throw new ConflictException("食材名称已存在");
  }

  private assertReorderScope<T extends { id: string; version: number }>(all: T[], items: ReorderItem[], label: string) {
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
    ids: string[],
    ownerField: "userId" | "ownerId",
    ownerId: string,
    extraWhere: Record<string, string> = {}
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
    if (source === "SYSTEM") return { ownerId: null };
    if (source === "PERSONAL") return { ownerId: userId };
    return { OR: [{ ownerId: null }, { ownerId: userId }] };
  }

  private buildUnitOwnerWhere(userId: UUID, source?: string): Prisma.UnitWhereInput {
    if (source === "SYSTEM") return { ownerId: null };
    if (source === "PERSONAL") return { ownerId: userId };
    return { OR: [{ ownerId: null }, { ownerId: userId }] };
  }
}
