import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, RecipeStatus, type Recipe } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { completeIdempotentOperation, getIdempotentResult, startIdempotentOperation } from "../../common/idempotency";
import { removeStorageLedger, sizeOfJson, upsertStorageLedger } from "../../common/storage-ledger";
import type {
  DeleteRecipeResponse,
  ImportRecipeResult,
  PageResult,
  RecipeContentInput,
  RecipeContentPayload,
  RecipeDetail,
  RecipeListResult,
  RecipeReportSummary,
  RecipeSummary,
  UUID
} from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";
import {
  buildRecipeSearchText,
  fromJson,
  imageOnlyBytes,
  mergeRecipeContent,
  normalizeRecipeContent,
  RecipeOverrideData,
  structureSizeBytes,
  toJson,
  versionToContent
} from "./recipe-content";

const activeRecipeStatuses: RecipeStatus[] = ["ACTIVE", "RECYCLED", "BLOCKED"];

type RecipeRow = Prisma.RecipeGetPayload<{
  include: {
    owner: { select: { uid: true } };
    baseVersion: true;
    independentVersion: true;
  };
}>;

type RecipeDb = Prisma.TransactionClient;

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

function toRecipeSummary(recipe: RecipeRow): RecipeSummary {
  return {
    id: recipe.id,
    ownerType: recipe.ownerId ? "USER" : "SYSTEM",
    title: recipe.title,
    coverImageUrl: recipe.coverImageUrl,
    sourceRecipeId: recipe.sourceRecipeId,
    isCustomized: recipe.isCustomized,
    status: recipe.status,
    updatedAt: toIsoDate(recipe.updatedAt)
  };
}

@Injectable()
export class RecipeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService
  ) {}

  async list(userId: UUID, page: number, pageSize: number, keyword?: string, scope?: string): Promise<RecipeListResult> {
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedScope = (scope ?? "mine").trim();
    const where = this.buildListWhere(userId, keyword, normalizedScope);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        include: {
          owner: { select: { uid: true } },
          baseVersion: true,
          independentVersion: true
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipe.count({ where })
    ]);

    return {
      items: items.map(toRecipeSummary),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async getDetail(userId: UUID, recipeId: UUID): Promise<RecipeDetail> {
    const recipe = await this.loadReadableRecipe(this.prisma, userId, recipeId);
    return this.toRecipeDetail(userId, recipe);
  }

  async create(userId: UUID, operationId: UUID, content: RecipeContentInput): Promise<RecipeDetail> {
    const normalized: RecipeContentPayload = { ...normalizeRecipeContent(content), images: [] };
    const requestHash = JSON.stringify(normalized);
    return this.prisma.$transaction(async tx => {
      const repeated = await getIdempotentResult<RecipeDetail>(tx, operationId, "recipe:create", userId, null, requestHash);
      if (repeated) return repeated;
      await startIdempotentOperation(tx, operationId, "recipe:create", userId, null, requestHash);
      const expectedBytes = structureSizeBytes(normalized) + imageOnlyBytes(normalized);
      await this.assertRecipeCreateAllowed(tx, userId, expectedBytes);

      const version = await tx.recipeContentVersion.create({
        data: {
          createdByUserId: userId,
          name: normalized.name,
          ingredientsJson: toJson(normalized.ingredients),
          stepsJson: toJson(normalized.steps),
          servings: normalized.servings,
          durationMinutes: normalized.durationMinutes,
          imagesJson: toJson(normalized.images),
          searchText: buildRecipeSearchText(normalized),
          contentSizeBytes: structureSizeBytes(normalized)
        }
      });

      const recipe = await tx.recipe.create({
        data: {
          ownerId: userId,
          sourceKind: "USER",
          baseVersionId: version.id,
          title: normalized.name,
          searchText: buildRecipeSearchText(normalized),
          coverImageUrl: normalized.images[0]?.url ?? null
        },
        include: {
          owner: { select: { uid: true } },
          baseVersion: true,
          independentVersion: true
        }
      });

      await this.syncRecipeLedger(tx, recipe);
      const result = await this.toRecipeDetail(userId, recipe);
      await completeIdempotentOperation(tx, operationId, "recipe:create", userId, null, requestHash, result);
      return result;
    });
  }

  async importRecipe(userId: UUID, recipeId: UUID, operationId: UUID): Promise<ImportRecipeResult> {
    return this.prisma.$transaction(async tx => {
      const source = await this.loadReadableRecipe(tx, userId, recipeId);
      if (source.ownerId === userId) {
        throw new BadRequestException("自己的菜谱不需要重复导入");
      }

      const importBaseVersion = await this.resolveImportBaseVersion(tx, source);
      const requestHash = `${recipeId}:${importBaseVersion.id}`;
      const repeated = await getIdempotentResult<ImportRecipeResult>(tx, operationId, "recipe:import", userId, null, requestHash);
      if (repeated) return repeated;

      await startIdempotentOperation(tx, operationId, "recipe:import", userId, null, requestHash);
      await this.assertRecipeCreateAllowed(tx, userId, importBaseVersion.contentSizeBytes);

      const existing = await tx.recipe.findFirst({
        where: {
          ownerId: userId,
          sourceRecipeId: source.id,
          baseVersionId: importBaseVersion.id,
          independentVersionId: null,
          overrideJson: { equals: Prisma.AnyNull },
          hiddenBaseImages: { equals: [] },
          isCustomized: false,
          status: "ACTIVE"
        },
        include: {
          owner: { select: { uid: true } },
          baseVersion: true,
          independentVersion: true
        }
      });

      if (existing) {
        const result = {
          recipe: await this.toRecipeDetail(userId, existing),
          reusedExisting: true
        } satisfies ImportRecipeResult;
        await completeIdempotentOperation(tx, operationId, "recipe:import", userId, null, requestHash, result);
        return result;
      }

      const recipe = await tx.recipe.create({
        data: {
          ownerId: userId,
          sourceKind: source.ownerId ? "USER" : "SYSTEM",
          sourceRecipeId: source.id,
          baseVersionId: importBaseVersion.id,
          title: importBaseVersion.name,
          searchText: importBaseVersion.searchText,
          coverImageUrl: versionToContent(importBaseVersion).images[0]?.url ?? null
        },
        include: {
          owner: { select: { uid: true } },
          baseVersion: true,
          independentVersion: true
        }
      });

      await this.syncRecipeLedger(tx, recipe);
      const result = {
        recipe: await this.toRecipeDetail(userId, recipe),
        reusedExisting: false
      } satisfies ImportRecipeResult;
      await completeIdempotentOperation(tx, operationId, "recipe:import", userId, null, requestHash, result);
      return result;
    });
  }

  async update(
    userId: UUID,
    recipeId: UUID,
    operationId: UUID,
    expectedVersion: number,
    content: RecipeContentInput
  ): Promise<RecipeDetail> {
    const normalized = normalizeRecipeContent(content);

    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${recipeId}::uuid FOR UPDATE`;
      const current = await this.requireOwnedRecipe(tx, userId, recipeId);
      const requestHash = `${recipeId}:${expectedVersion}:${JSON.stringify(normalized)}`;
      const repeated = await getIdempotentResult<RecipeDetail>(tx, operationId, "recipe:update", userId, null, requestHash);
      if (repeated) return repeated;
      if (current.version !== expectedVersion) {
        throw new ConflictException("菜谱已被更新，请刷新后重试");
      }

      await startIdempotentOperation(tx, operationId, "recipe:update", userId, null, requestHash);
      await this.assertRecipeWritable(tx, userId);

      const effectiveBefore = this.getEffectiveContent(current);
      const nextContent = { ...normalized, images: effectiveBefore.images } satisfies RecipeContentPayload;
      const nextRecipe = await this.applyRecipeUpdate(tx, current, nextContent);
      await this.syncRecipeLedger(tx, nextRecipe);
      const result = await this.toRecipeDetail(userId, nextRecipe);
      await completeIdempotentOperation(tx, operationId, "recipe:update", userId, null, requestHash, result);
      return result;
    });
  }

  async deleteRecipe(
    userId: UUID,
    recipeId: UUID,
    operationId: UUID,
    expectedVersion: number
  ): Promise<DeleteRecipeResponse> {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${recipeId}::uuid FOR UPDATE`;
      const recipe = await this.requireOwnedRecipe(tx, userId, recipeId);
      const requestHash = `${recipeId}:${expectedVersion}`;
      const repeated = await getIdempotentResult<DeleteRecipeResponse>(tx, operationId, "recipe:delete", userId, null, requestHash);
      if (repeated) return repeated;
      if (recipe.version !== expectedVersion) {
        throw new ConflictException("菜谱已被更新，请刷新后重试");
      }

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
          blockedReason: null,
          blockedAt: null,
          recycledUntil,
          deletedAt: now,
          version: { increment: 1 }
        }
      });

      if (status === "DELETED") {
        await removeStorageLedger(tx, userId, "RECIPE", recipeId);
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

  async reportRecipe(userId: UUID, recipeId: UUID, operationId: UUID, reason: string): Promise<RecipeReportSummary> {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new BadRequestException("举报原因不能为空");

    return this.prisma.$transaction(async tx => {
      const recipe = await this.loadReadableRecipe(tx, userId, recipeId);
      if (recipe.ownerId === userId) throw new BadRequestException("不能举报自己的菜谱");

      const requestHash = `${recipeId}:${normalizedReason}`;
      const repeated = await getIdempotentResult<RecipeReportSummary>(tx, operationId, "recipe:report", userId, null, requestHash);
      if (repeated) return repeated;

      await startIdempotentOperation(tx, operationId, "recipe:report", userId, null, requestHash);

      const existing = await tx.recipeReport.findFirst({
        where: {
          recipeId,
          reporterId: userId,
          status: "OPEN"
        }
      });
      if (existing) {
        throw new ConflictException("已存在待处理举报");
      }

      const report = await tx.recipeReport.create({
        data: {
          recipeId,
          reporterId: userId,
          reason: normalizedReason
        }
      });
      await tx.recipe.update({
        where: { id: recipeId },
        data: { reportCount: { increment: 1 } }
      });

      const result = {
        id: report.id,
        recipeId: report.recipeId,
        reporterUid: recipe.owner?.uid ?? 0,
        reason: report.reason,
        status: report.status,
        createdAt: toIsoDate(report.createdAt)
      } satisfies RecipeReportSummary;
      await completeIdempotentOperation(tx, operationId, "recipe:report", userId, null, requestHash, result);
      return result;
    });
  }

  private buildListWhere(userId: UUID, keyword: string | undefined, scope: string): Prisma.RecipeWhereInput {
    const keywordWhere = keyword?.trim()
      ? {
          searchText: {
            contains: keyword.trim(),
            mode: "insensitive" as const
          }
        }
      : {};

    const readableStatuses: RecipeStatus[] = ["ACTIVE"];

    if (scope === "mine") {
      return {
        ownerId: userId,
        status: { in: activeRecipeStatuses },
        ...keywordWhere
      };
    }

    if (scope === "system") {
      return {
        ownerId: null,
        status: { in: readableStatuses },
        ...keywordWhere
      };
    }

    return {
      OR: [
        {
          ownerId: userId,
          status: { in: activeRecipeStatuses }
        },
        {
          ownerId: null,
          status: { in: readableStatuses }
        }
      ],
      ...keywordWhere
    };
  }

  private async loadReadableRecipe(db: RecipeDb, userId: UUID, recipeId: UUID) {
    const recipe = await db.recipe.findUnique({
      where: { id: recipeId },
      include: {
        owner: { select: { uid: true } },
        baseVersion: true,
        independentVersion: true
      }
    });

    if (!recipe) throw new NotFoundException("菜谱不存在");
    const isOwner = recipe.ownerId === userId;
    if (!isOwner && recipe.status !== "ACTIVE") throw new NotFoundException("菜谱不存在");
    if (recipe.status === "BLOCKED" && !isOwner) throw new NotFoundException("菜谱不存在");
    if (recipe.status === "DELETED") throw new NotFoundException("菜谱不存在");
    return recipe;
  }

  private async requireOwnedRecipe(db: RecipeDb, userId: UUID, recipeId: UUID) {
    const recipe = await db.recipe.findUnique({
      where: { id: recipeId },
      include: {
        owner: { select: { uid: true } },
        baseVersion: true,
        independentVersion: true
      }
    });

    if (!recipe || recipe.ownerId !== userId || recipe.status === "DELETED") {
      throw new NotFoundException("菜谱不存在");
    }
    return recipe;
  }

  private getEffectiveContent(recipe: RecipeRow) {
    if (recipe.independentVersion) return versionToContent(recipe.independentVersion);
    const base = versionToContent(recipe.baseVersion);
    return mergeRecipeContent(base, fromJson<RecipeOverrideData | null>(recipe.overrideJson), recipe.hiddenBaseImages);
  }

  private async toRecipeDetail(userId: UUID, recipe: RecipeRow): Promise<RecipeDetail> {
    const content = this.getEffectiveContent(recipe);
    return {
      ...toRecipeSummary(recipe),
      ownerUid: recipe.owner?.uid ?? null,
      content,
      hiddenBaseImages: recipe.hiddenBaseImages,
      canEdit: recipe.ownerId === userId,
      canImport: Boolean(recipe.status === "ACTIVE" && recipe.ownerId !== userId),
      version: recipe.version,
      createdAt: toIsoDate(recipe.createdAt)
    };
  }

  private async resolveImportBaseVersion(tx: RecipeDb, source: RecipeRow) {
    if (source.independentVersion) return source.independentVersion;
    if (!source.overrideJson && source.hiddenBaseImages.length === 0) return source.baseVersion;

    const content = this.getEffectiveContent(source);
    return tx.recipeContentVersion.create({
      data: {
        createdByUserId: source.ownerId,
        name: content.name,
        ingredientsJson: toJson(content.ingredients),
        stepsJson: toJson(content.steps),
        servings: content.servings,
        durationMinutes: content.durationMinutes,
        imagesJson: toJson(content.images),
        searchText: buildRecipeSearchText(content),
        contentSizeBytes: structureSizeBytes(content)
      }
    });
  }

  private async assertRecipeCreateAllowed(tx: RecipeDb, userId: UUID, expectedBytes: number) {
    const entitlements = await this.entitlementService.resolveForUser(tx, userId);
    const recipeCount = await tx.recipe.count({
      where: {
        ownerId: userId,
        status: { in: ["ACTIVE", "RECYCLED"] }
      }
    });
    if (recipeCount >= entitlements.recipeLimit) {
      throw new ForbiddenException("当前菜谱数量已达上限");
    }
    await this.assertStorageWritable(tx, userId, expectedBytes);
  }

  private async assertRecipeWritable(tx: RecipeDb, userId: UUID) {
    await this.assertStorageWritable(tx, userId, 0);
  }

  private async assertStorageWritable(tx: RecipeDb, userId: UUID, expectedDeltaBytes: number) {
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

  private async applyRecipeUpdate(
    tx: RecipeDb,
    recipe: RecipeRow,
    nextContent: RecipeContentPayload
  ): Promise<RecipeRow> {
    if (!recipe.sourceRecipeId) {
      const version = await tx.recipeContentVersion.create({
        data: {
          createdByUserId: recipe.ownerId,
          name: nextContent.name,
          ingredientsJson: toJson(nextContent.ingredients),
          stepsJson: toJson(nextContent.steps),
          servings: nextContent.servings,
          durationMinutes: nextContent.durationMinutes,
          imagesJson: toJson(nextContent.images),
          searchText: buildRecipeSearchText(nextContent),
          contentSizeBytes: structureSizeBytes(nextContent)
        }
      });

      return tx.recipe.update({
        where: { id: recipe.id },
        data: {
          baseVersionId: version.id,
          title: nextContent.name,
          searchText: buildRecipeSearchText(nextContent),
          coverImageUrl: nextContent.images[0]?.url ?? null,
          version: { increment: 1 }
        },
        include: {
          owner: { select: { uid: true } },
          baseVersion: true,
          independentVersion: true
        }
      });
    }

    if (recipe.independentVersion) {
      const version = await tx.recipeContentVersion.create({
        data: {
          createdByUserId: recipe.ownerId,
          name: nextContent.name,
          ingredientsJson: toJson(nextContent.ingredients),
          stepsJson: toJson(nextContent.steps),
          servings: nextContent.servings,
          durationMinutes: nextContent.durationMinutes,
          imagesJson: toJson(nextContent.images),
          searchText: buildRecipeSearchText(nextContent),
          contentSizeBytes: structureSizeBytes(nextContent)
        }
      });

      return tx.recipe.update({
        where: { id: recipe.id },
        data: {
          independentVersionId: version.id,
          overrideJson: Prisma.JsonNull,
          hiddenBaseImages: [],
          isCustomized: true,
          title: nextContent.name,
          searchText: buildRecipeSearchText(nextContent),
          coverImageUrl: nextContent.images[0]?.url ?? null,
          version: { increment: 1 }
        },
        include: {
          owner: { select: { uid: true } },
          baseVersion: true,
          independentVersion: true
        }
      });
    }

    const overrideData: RecipeOverrideData = {};
    if (nextContent.name !== recipe.baseVersion.name) overrideData.name = nextContent.name;
    if (JSON.stringify(nextContent.ingredients) !== JSON.stringify(fromJson(recipe.baseVersion.ingredientsJson))) {
      overrideData.ingredients = nextContent.ingredients;
    }
    if (JSON.stringify(nextContent.steps) !== JSON.stringify(fromJson(recipe.baseVersion.stepsJson))) {
      overrideData.steps = nextContent.steps;
    }
    if (nextContent.servings !== recipe.baseVersion.servings) overrideData.servings = nextContent.servings;
    if (nextContent.durationMinutes !== recipe.baseVersion.durationMinutes) {
      overrideData.durationMinutes = nextContent.durationMinutes;
    }

    return tx.recipe.update({
      where: { id: recipe.id },
      data: {
        overrideJson: Object.keys(overrideData).length ? toJson(overrideData) : Prisma.JsonNull,
        hiddenBaseImages: recipe.hiddenBaseImages,
        isCustomized: Object.keys(overrideData).length > 0 || recipe.hiddenBaseImages.length > 0,
        title: nextContent.name,
        searchText: buildRecipeSearchText(nextContent),
        coverImageUrl: nextContent.images[0]?.url ?? null,
        version: { increment: 1 }
      },
      include: {
        owner: { select: { uid: true } },
        baseVersion: true,
        independentVersion: true
      }
    });
  }

  private async syncRecipeLedger(tx: RecipeDb, recipe: RecipeRow) {
    if (!recipe.ownerId) return;
    if (recipe.status === "DELETED") {
      await removeStorageLedger(tx, recipe.ownerId, "RECIPE", recipe.id);
      return;
    }

    let usedBytes = 0;
    if (recipe.independentVersion) {
      const content = versionToContent(recipe.independentVersion);
      usedBytes = recipe.independentVersion.contentSizeBytes + imageOnlyBytes(content);
    } else {
      usedBytes = recipe.baseVersion.contentSizeBytes;
      if (!recipe.sourceRecipeId) {
        usedBytes += imageOnlyBytes(versionToContent(recipe.baseVersion));
      }
      if (recipe.overrideJson) usedBytes += sizeOfJson(recipe.overrideJson);
      if (recipe.hiddenBaseImages.length) usedBytes += sizeOfJson(recipe.hiddenBaseImages);
    }

    await upsertStorageLedger(tx, recipe.ownerId, "RECIPE", recipe.id, usedBytes);
  }
}
