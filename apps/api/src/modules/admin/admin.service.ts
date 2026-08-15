import { createHash, randomInt } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { Prisma, type DiningGroupStatus, type RecipeStatus } from "@prisma/client";
import { recipeDifficultyText, recipeDurationText } from "../../common/display-text";
import type {
  AdminRecipeContentInput,
  AdminDashboardSummary,
    AdminInspirationCategoryPayloadRequest,
    AdminInspirationCategorySummary,
    AdminPendingUnitRecommendationSummary,
    AdminPendingRecipeSummary,
    AdminRecipeDetail,
    AdminDeleteUnitResult,
  AdminIngredientCategoryPayloadRequest,
  AdminIngredientRejectReasonCode,
  AdminIngredientCategorySummary,
  AdminPendingIngredientFeedbackSummary,
  AdminIngredientPayloadRequest,
  AdminPendingIngredientSummary,
  AdminReviewIngredientFeedbackRequest,
  AdminReviewIngredientFeedbackResult,
    AdminReviewPendingIngredientRequest,
    AdminReviewPendingIngredientResult,
    AdminReviewPendingUnitRecommendationRequest,
    AdminReviewPendingUnitRecommendationResult,
    AdminReviewPendingRecipeRequest,
    AdminReviewPendingRecipeResult,
  AdminIngredientSummary,
  SetAdminIngredientStatusRequest,
  AdminUnitPayloadRequest,
  AdminUnitSummary,
  AdminResetUserPasswordResponse,
  AdminDiningGroupSummary,
  AdminRecipeSummary,
  AdminUserRecipeDomainOverview,
  CollectionListResponse,
  CollectionSceneSummary,
  CollectedRecipeSummary,
  CreateAdminRecipeRequest,
  CreateRecipeImportJobRequest,
  CreateAdminUserRequest,
  AdminLoginRequest,
  AdminUserEntitlementResponse,
  IngredientProteinType,
  InspirationCategorySummary,
  MyRecipeSummary,
  PageResult,
  OperationId,
  RecipeCategorySummary,
  RecipeContentSnapshot,
  RecipeDraftSummary,
  RecipeImportIssue,
  RecipeImportImageSummary,
  RecipeImportJobDetail,
  RecipeImportJobSummary,
  RecipeImportItemDetail,
  RecipeImportItemSummary,
  RecipeImportParsedBody,
  RecipeImportRawBody,
  RecipeImportRecipeBody,
  RecipeIngredientInput,
  RecipeSceneSummary,
  RecipeReportSummary,
  ReorderItem,
  ResetAdminUserPasswordRequest,
  RelationshipState,
  SetAdminUserStatusRequest,
  StorageUsageSummary,
  UnitSummary,
  UpdateAdminUnitRequest,
  UpdateAdminInspirationCategoryRequest,
  UpdateAdminIngredientCategoryRequest,
  UpdateAdminIngredientRequest,
  UpdateRecipeImportItemRequest,
  UpdateAdminRecipeRequest,
  UpdateAdminUserRequest,
  UserProfile,
  UUID,
  PublishRecipeImportItemRequest
} from "../../contracts/types";
import { PrismaService } from "../../common/prisma.service";
import {
  completeAdminIdempotentOperation,
  getAdminIdempotentResult,
  startAdminIdempotentOperation
} from "../../common/idempotency";
import { AdminTokenService } from "../../common/security/admin-token.service";
import { hashPassword, verifyPassword } from "../../common/security/password";
import { EntitlementService } from "../entitlement/entitlement.service";
import { buildRecipeSearchText, buildSearchKey, contentSizeBytes, draftCoverImageUrl, fromJson, toJson, versionToContent } from "../recipe/recipe-content";
import { inferIngredientTagFacts } from "../recipe/ingredient-tag-facts";
import { replaceAutoRecipeVersionTags } from "../recipe/recipe-version-tags";
import { MedalService } from "../user/medal.service";
import { AdminRecipeImageService } from "./admin-recipe-image.service";
import { IngredientImageService } from "./ingredient-image.service";
import {
  buildIngredientRefs,
  buildUnitRefs,
  parseMarkdownSource,
  readImageBuffer,
  readImageDataUrl,
  readMarkdownSources,
  readSourceImages,
  rebuildItemState,
  writeImportImages
} from "./recipe-import-markdown";

function toIsoDate(value: Date) {
  return value.toISOString();
}

function hasIngredientTagFactGap(item: {
  name: string;
  category: { code: string };
  proteinType: IngredientProteinType | null;
  isStaple: boolean;
  isSpicyIngredient: boolean;
}) {
  const inferred = inferIngredientTagFacts({
    name: item.name,
    categoryCode: item.category.code
  });
  return (
    (Boolean(inferred.proteinType) && !item.proteinType) ||
    (inferred.isStaple && !item.isStaple) ||
    (inferred.isSpicyIngredient && !item.isSpicyIngredient)
  );
}

const ingredientRejectChoiceMap: Record<AdminIngredientRejectReasonCode, { reason: string; advice: string }> = {
  NAME_NOT_CLEAR: {
    reason: "名称不明确",
    advice: "请改成明确、通用的食材名称后再提交。"
  },
  NAME_HAS_BRAND: {
    reason: "名称含品牌或规格",
    advice: "请去掉品牌、口味、包装规格等描述，保留通用食材名后再提交。"
  },
  CATEGORY_NOT_FIT: {
    reason: "分类不合适",
    advice: "请调整到更合适的系统分类后再提交。"
  },
  UNIT_NOT_FIT: {
    reason: "默认单位不合适",
    advice: "请改成更常用的默认单位后再提交。"
  },
  OUT_OF_SCOPE: {
    reason: "不属于系统食材范围",
    advice: "请确认提交的是可复用的食材本体，而不是菜名、套餐、品牌商品或临时描述。"
  },
  OTHER: {
    reason: "其他",
    advice: "请根据审核意见修改后重新提交。"
  }
};

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

function normalizeImageUrl(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeIngredientAliases(name: string, aliases: string[] | undefined) {
  const trimmedName = name.trim();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of aliases ?? []) {
    const value = item.trim();
    if (!value || value === trimmedName || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function toUserProfile(user: {
  id: UUID;
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): UserProfile {
  return {
    id: user.id,
    uid: user.uid,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    status: user.status,
    createdAt: toIsoDate(user.createdAt),
    updatedAt: toIsoDate(user.updatedAt)
  };
}

type AdminUserRecipeRow = Prisma.RecipeGetPayload<{
  include: {
    category: true;
    currentVersion: true;
  };
}>;

type AdminRecipeRow = Prisma.RecipeGetPayload<{
  include: {
    owner: { select: { uid: true } };
    category: true;
    inspirationCategory: true;
    currentVersion: true;
  };
}>;

type AdminDraftRow = Prisma.RecipeDraftGetPayload<{
  include: {
    category: true;
  };
}>;

type AdminSceneRow = Prisma.RecipeSceneGetPayload<Record<string, never>>;

type AdminCollectionRow = Prisma.RecipeCollectionGetPayload<{
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

type AdminInspirationCategoryRow = Prisma.InspirationCategoryGetPayload<Record<string, never>>;
type AdminIngredientCategoryRow = Prisma.IngredientCategoryGetPayload<Record<string, never>>;
type AdminIngredientRow = Prisma.IngredientGetPayload<{
  include: {
    category: true;
    defaultUnit: true;
  };
}>;
type AdminIngredientWithImageRow = AdminIngredientRow & { imageUpdatedAt: Date | null };
type AdminPendingIngredientRow = Prisma.IngredientRecommendationGetPayload<{
  include: {
    ingredient: {
      include: {
        owner: {
          select: {
            id: true;
            uid: true;
            nickname: true;
          };
        };
        defaultUnit: true;
      };
    };
  };
}>;
type AdminPendingIngredientFeedbackRow = Prisma.IngredientFeedbackGetPayload<{
  include: {
    ingredient: {
      include: {
        category: true;
        owner: {
          select: {
            id: true;
            uid: true;
            nickname: true;
          };
        };
      };
    };
  };
}>;
type AdminPendingUnitRecommendationRow = Prisma.UnitRecommendationGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        uid: true;
        nickname: true;
      };
    };
    targetUnit: true;
  };
}>;
type AdminPendingRecipeRow = Prisma.RecipeRecommendationGetPayload<{
  include: {
    recipe: {
      include: {
        owner: {
          select: {
            id: true;
            uid: true;
            nickname: true;
          };
        };
        category: true;
      };
    };
    sourceVersion: true;
    suggestedCategory: true;
  };
}>;
type RecipeImportJobRow = Prisma.RecipeImportJobGetPayload<Record<string, never>>;
type RecipeImportItemRow = Prisma.RecipeImportItemGetPayload<Record<string, never>>;

function toRecipeCategorySummary(category: { id: UUID; name: string; version: number }): RecipeCategorySummary {
  return {
    id: category.id,
    name: category.name,
    version: category.version
  };
}

function toRecipeSceneSummary(scene: { id: UUID; name: string; version: number }): RecipeSceneSummary {
  return {
    id: scene.id,
    name: scene.name,
    version: scene.version
  };
}

function toInspirationCategorySummary(category: { id: UUID; name: string; iconKey: string | null }): InspirationCategorySummary {
  return {
    id: category.id,
    name: category.name,
    iconKey: category.iconKey
  };
}

function toCollectionSceneSummary(scene: AdminSceneRow, recipeCount: number, updatedAt: Date | null): CollectionSceneSummary {
  return {
    id: scene.id,
    name: scene.name,
    version: scene.version,
    recipeCount,
    updatedAt: updatedAt ? toIsoDate(updatedAt) : null
  };
}

function isAdminEditableInspiration(recipe: Pick<AdminRecipeRow, "ownerId" | "inspirationCategoryId" | "status">) {
  return recipe.ownerId === null && !!recipe.inspirationCategoryId && recipe.status !== "DELETED";
}

function toUnitSummary(unit: { id: UUID; name: string; type: UnitSummary["type"]; ownerId: UUID | null }): UnitSummary {
  return {
    id: unit.id,
    name: unit.name,
    type: unit.type,
    source: unit.ownerId ? "PERSONAL" : "SYSTEM"
  };
}

function toAdminIngredientCategorySummary(category: AdminIngredientCategoryRow, ingredientCount: number): AdminIngredientCategorySummary {
  return {
    id: category.id,
    code: category.code,
    name: category.name,
    isSelectable: category.isSelectable,
    version: category.version,
    ingredientCount,
    updatedAt: toIsoDate(category.updatedAt)
  };
}

function toAdminInspirationCategorySummary(
  category: AdminInspirationCategoryRow,
  recipeCount: number
): AdminInspirationCategorySummary {
  return {
    id: category.id,
    name: category.name,
    iconKey: category.iconKey,
    version: category.version,
    recipeCount,
    updatedAt: toIsoDate(category.updatedAt)
  };
}

function toAdminIngredientSummary(ingredient: AdminIngredientRow): AdminIngredientSummary {
  return {
    id: ingredient.id,
    name: ingredient.name,
    version: ingredient.version,
    status: ingredient.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    categoryId: ingredient.categoryId,
    categoryName: ingredient.category.name,
    defaultUnit: toUnitSummary(ingredient.defaultUnit),
    proteinType: ingredient.proteinType as IngredientProteinType | null,
    isStaple: ingredient.isStaple,
    isSpicyIngredient: ingredient.isSpicyIngredient,
    aliases: ingredient.aliases,
    imageUrl: null,
    updatedAt: toIsoDate(ingredient.updatedAt)
  };
}

function toAdminUnitSummary(unit: { id: UUID; name: string; type: UnitSummary["type"]; version: number; updatedAt: Date }): AdminUnitSummary {
  return {
    id: unit.id,
    name: unit.name,
    type: unit.type,
    source: "SYSTEM",
    version: unit.version,
    updatedAt: toIsoDate(unit.updatedAt)
  };
}

function resolveIngredientReviewNote(body: AdminReviewPendingIngredientRequest) {
  const note = body.reason?.trim() || null;
  if (body.action !== "REJECT") {
    return {
      reviewNote: note,
      reviewAdvice: null,
      reviewReasonCode: null as AdminIngredientRejectReasonCode | null,
      auditReason: note
    };
  }

  if (!body.rejectReasonCode) {
    throw new BadRequestException("请选择拒绝原因");
  }
  const choice = ingredientRejectChoiceMap[body.rejectReasonCode];
  if (!choice) {
    throw new BadRequestException("拒绝原因参数错误");
  }
  if (body.rejectReasonCode === "OTHER") {
    if (!note) {
      throw new BadRequestException("请填写详细拒绝原因");
    }
    return {
      reviewNote: note,
      reviewAdvice: choice.advice,
      reviewReasonCode: body.rejectReasonCode,
      auditReason: note
    };
  }

  return {
    reviewNote: choice.reason,
    reviewAdvice: choice.advice,
    reviewReasonCode: body.rejectReasonCode,
    auditReason: choice.reason
  };
}

function toAdminPendingIngredientSummary(row: AdminPendingIngredientRow): AdminPendingIngredientSummary {
  return {
    id: row.ingredient.id,
    name: row.ingredient.name,
    version: row.ingredient.version,
    categoryId: row.ingredient.categoryId,
    categoryName: row.categoryName,
    defaultUnitId: row.ingredient.defaultUnitId,
    defaultUnitName: row.defaultUnitName,
    status: "PENDING",
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    user: {
      id: row.ingredient.owner?.id ?? row.userId,
      uid: row.ingredient.owner?.uid ?? 0,
      nickname: row.ingredient.owner?.nickname ?? null
    }
  };
}

function toAdminPendingIngredientFeedbackSummary(row: AdminPendingIngredientFeedbackRow): AdminPendingIngredientFeedbackSummary {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    ingredientVersion: row.ingredient.version,
    ingredientName: row.ingredient.name,
    categoryId: row.ingredient.categoryId,
    categoryName: row.ingredient.category.name,
    suggestedName: row.suggestedName,
    suggestedCategoryId: row.suggestedCategoryId,
    suggestedCategoryName: row.suggestedCategoryName,
    note: row.note,
    status: "PENDING",
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    user: {
      id: row.ingredient.owner?.id ?? row.userId,
      uid: row.ingredient.owner?.uid ?? 0,
      nickname: row.ingredient.owner?.nickname ?? null
    }
  };
}

function toAdminPendingUnitRecommendationSummary(row: AdminPendingUnitRecommendationRow): AdminPendingUnitRecommendationSummary {
  return {
    id: row.id,
    name: row.unitName,
    type: row.unitType,
    version: row.version,
    status: "PENDING",
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    user: {
      id: row.user.id,
      uid: row.user.uid,
      nickname: row.user.nickname
    }
  };
}

function toAdminPendingRecipeSummary(row: AdminPendingRecipeRow): AdminPendingRecipeSummary {
  return {
    id: row.id,
    recipeId: row.recipeId,
    recipeTitle: row.recipeTitle,
    contentVersionId: row.sourceVersionId,
    version: row.version,
    status: "PENDING",
    suggestedCategory: toInspirationCategorySummary(row.suggestedCategory),
    personalCategory: row.recipe.category ? toRecipeCategorySummary(row.recipe.category) : null,
    user: {
      id: row.recipe.owner?.id ?? row.userId,
      uid: row.recipe.owner?.uid ?? 0,
      nickname: row.recipe.owner?.nickname ?? null
    },
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt)
  };
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AdminTokenService)
    private readonly adminTokenService: AdminTokenService,
    @Inject(EntitlementService)
    private readonly entitlementService: EntitlementService,
    @Inject(AdminRecipeImageService)
    private readonly adminRecipeImageService: AdminRecipeImageService,
    @Inject(IngredientImageService)
    private readonly ingredientImageService: IngredientImageService,
    @Inject(MedalService)
    private readonly medalService: MedalService
  ) {}

  async login(body: AdminLoginRequest) {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { username: body.username }
    });

    if (!admin || admin.status !== "ACTIVE" || !verifyPassword(body.password, admin.passwordHash)) {
      throw new UnauthorizedException("用户名或密码错误");
    }

    const token = this.adminTokenService.createToken(admin.id, admin.roles);

    return {
      token: token.token,
      expiresAt: token.expiresAt,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        roles: admin.roles
      }
    };
  }

  async getDashboardSummary(adminId: UUID): Promise<AdminDashboardSummary> {
    await this.requireSuperAdmin(adminId);
    const [
      userTotal,
      userActiveCount,
      userDisabledCount,
      diningGroupTotal,
      diningGroupActiveCount,
      diningGroupMemberCount,
      recipeTotal,
      recipeActiveCount,
      recipeBlockedCount,
      recipeRecycledCount,
      recipeOpenReportCount,
      ingredientCategoryCount,
      ingredientItemCount,
      unitCount
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: "ACTIVE" } }),
      this.prisma.user.count({ where: { status: "DISABLED" } }),
      this.prisma.diningGroup.count(),
      this.prisma.diningGroup.count({ where: { status: "ACTIVE" } }),
      this.prisma.diningGroupMember.count({
        where: { status: { in: ["ACTIVE", "RESTRICTED"] } }
      }),
      this.prisma.recipe.count(),
      this.prisma.recipe.count({ where: { status: "ACTIVE" } }),
      this.prisma.recipe.count({ where: { status: "BLOCKED" } }),
      this.prisma.recipe.count({ where: { status: "RECYCLED" } }),
      this.prisma.recipeReport.count({ where: { status: "OPEN" } }),
      this.prisma.ingredientCategory.count(),
      this.prisma.ingredient.count({ where: { ownerId: null, status: "ACTIVE" } }),
      this.prisma.unit.count({ where: { ownerId: null } })
    ]);

    return {
      user: {
        total: userTotal,
        activeCount: userActiveCount,
        disabledCount: userDisabledCount
      },
      diningGroup: {
        total: diningGroupTotal,
        activeCount: diningGroupActiveCount,
        memberCount: diningGroupMemberCount
      },
      recipe: {
        total: recipeTotal,
        activeCount: recipeActiveCount,
        blockedCount: recipeBlockedCount,
        recycledCount: recipeRecycledCount,
        openReportCount: recipeOpenReportCount
      },
      ingredient: {
        categoryCount: ingredientCategoryCount,
        itemCount: ingredientItemCount,
        unitCount
      }
    };
  }

  async listUsers(page: number, pageSize: number, keyword: string | undefined, adminId: UUID): Promise<PageResult<UserProfile>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedKeyword = keyword?.trim();
    const uidKeyword =
      normalizedKeyword && /^\d{1,8}$/.test(normalizedKeyword) ? Number(normalizedKeyword) : null;
    const where = normalizedKeyword
      ? {
          OR: [
            ...(uidKeyword ? [{ uid: uidKeyword }] : []),
            { nickname: { contains: normalizedKeyword, mode: "insensitive" as const } },
            { phone: { contains: normalizedKeyword, mode: "insensitive" as const } }
          ]
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: normalizedPageSize
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      items: items.map(user => toUserProfile(user)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createUser(body: CreateAdminUserRequest, adminId: UUID): Promise<UserProfile> {
    await this.requireSuperAdmin(adminId);
    const phone = body.phone.trim();
    const nickname = this.readNickname(body.nickname);
    const status = body.status ?? "ACTIVE";
    const requestHash = `${phone}:${nickname ?? ""}:${status}:${this.hashSecret(body.password)}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<UserProfile>(tx, body.operationId, "admin-user:create", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-user:create", adminId, requestHash);

      const created = await this.createUserRecord(tx, {
        phone,
        nickname,
        password: body.password,
        status
      });
      const result = toUserProfile(created);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "USER_CREATED",
          objectType: "USER",
          objectId: created.id,
          payload: { phone, status }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-user:create", adminId, requestHash, result);
      return result;
    });
  }

  async updateUser(userId: UUID, body: UpdateAdminUserRequest, adminId: UUID): Promise<UserProfile> {
    await this.requireSuperAdmin(adminId);
    const patch = this.buildUserPatch(body);
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException("至少提供一个可修改字段");
    }
    const requestHash = `${userId}:${patch.phone ?? ""}:${patch.nickname ?? ""}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<UserProfile>(tx, body.operationId, "admin-user:update", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-user:update", adminId, requestHash);

      const current = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          uid: true,
          nickname: true,
          avatarUrl: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });
      if (!current) throw new NotFoundException("用户不存在");

      const updated =
        current.nickname === (patch.nickname === undefined ? current.nickname : patch.nickname) &&
        current.phone === (patch.phone === undefined ? current.phone : patch.phone)
          ? current
          : await this.updateUserRecord(tx, userId, patch);

      const result = toUserProfile(updated);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "USER_UPDATED",
          objectType: "USER",
          objectId: userId,
          payload: patch
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-user:update", adminId, requestHash, result);
      return result;
    });
  }

  async setUserStatus(userId: UUID, body: SetAdminUserStatusRequest, adminId: UUID): Promise<UserProfile> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${userId}:${body.status}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<UserProfile>(
        tx,
        body.operationId,
        "admin-user:set-status",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-user:set-status", adminId, requestHash);

      const current = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          uid: true,
          nickname: true,
          avatarUrl: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });
      if (!current) throw new NotFoundException("用户不存在");

      const updated =
        current.status === body.status
          ? current
          : await tx.user.update({
              where: { id: userId },
              data: {
                status: body.status,
                sessionVersion: { increment: 1 }
              },
              select: {
                id: true,
                uid: true,
                nickname: true,
                avatarUrl: true,
                phone: true,
                status: true,
                createdAt: true,
                updatedAt: true
              }
            });

      const result = toUserProfile(updated);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "USER_STATUS_CHANGED",
          objectType: "USER",
          objectId: userId,
          payload: { status: body.status }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-user:set-status", adminId, requestHash, result);
      return result;
    });
  }

  async resetUserPassword(
    userId: UUID,
    body: ResetAdminUserPasswordRequest,
    adminId: UUID
  ): Promise<AdminResetUserPasswordResponse> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${userId}:${this.hashSecret(body.newPassword)}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminResetUserPasswordResponse>(
        tx,
        body.operationId,
        "admin-user:reset-password",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-user:reset-password", adminId, requestHash);

      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      if (!current) throw new NotFoundException("用户不存在");

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: hashPassword(body.newPassword),
          sessionVersion: { increment: 1 }
        },
        select: {
          id: true,
          updatedAt: true
        }
      });

      const result = {
        userId: updated.id,
        resetAt: toIsoDate(updated.updatedAt)
      } satisfies AdminResetUserPasswordResponse;
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "USER_PASSWORD_RESET",
          objectType: "USER",
          objectId: userId,
          payload: {}
        }
      });
      await completeAdminIdempotentOperation(
        tx,
        body.operationId,
        "admin-user:reset-password",
        adminId,
        requestHash,
        result
      );
      return result;
    });
  }

  async listDiningGroups(
    page: number,
    pageSize: number,
    keyword?: string,
    status?: string,
    adminId?: UUID
  ): Promise<PageResult<AdminDiningGroupSummary>> {
    if (!adminId) throw new ForbiddenException("无权执行该操作");
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedStatus = status?.trim();

    if (normalizedStatus && !["ACTIVE", "ARCHIVED"].includes(normalizedStatus)) {
      throw new BadRequestException("饭搭子状态参数错误");
    }

    const where: Prisma.DiningGroupWhereInput = {
      ...(keyword ? { name: { contains: keyword, mode: "insensitive" as const } } : {}),
      ...(normalizedStatus ? { status: normalizedStatus as DiningGroupStatus } : {})
    };

    const items = await this.prisma.diningGroup.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: normalizedPageSize,
      include: {
        _count: {
          select: {
            members: {
              where: {
                status: {
                  in: ["ACTIVE", "RESTRICTED"]
                }
              }
            }
          }
        }
      }
    });
    const total = await this.prisma.diningGroup.count({ where });

    return {
      items: items.map(diningGroup => {
        return {
          id: diningGroup.id,
          name: diningGroup.name,
          ownerId: diningGroup.ownerId,
          status: diningGroup.status,
          version: diningGroup.version,
          memberCount: diningGroup._count.members,
          createdAt: toIsoDate(diningGroup.createdAt),
          updatedAt: toIsoDate(diningGroup.updatedAt)
        };
      }),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async getUserEntitlements(userId: UUID, adminId: UUID): Promise<AdminUserEntitlementResponse> {
    return this.prisma.$transaction(async tx => {
      const admin = await tx.adminAccount.findUnique({
        where: { id: adminId },
        select: { status: true, roles: true }
      });
      if (!admin || admin.status !== "ACTIVE" || !admin.roles.includes("SUPER_ADMIN")) {
        throw new ForbiddenException("无权查看用户权益");
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          uid: true,
          nickname: true,
          status: true
        }
      });
      if (!user) throw new NotFoundException("用户不存在");

      const [resolved, memberships, storageRows] = await Promise.all([
        this.entitlementService.resolveForUser(tx, userId),
        tx.diningGroupMember.findMany({
          where: {
            userId,
            status: { in: ["ACTIVE", "RESTRICTED"] },
            diningGroup: { status: "ACTIVE" }
          },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
          include: {
            diningGroup: {
              include: {
                owner: { select: { uid: true } }
              }
            }
          }
        }),
        tx.storageLedger.findMany({
          where: { userId },
          select: {
            module: true,
            usedBytes: true
          }
        })
      ]);

      const diningGroups = await Promise.all(
        memberships.map(async membership => {
          const memberCount = await tx.diningGroupMember.count({
            where: {
              diningGroupId: membership.diningGroupId,
              status: { in: ["ACTIVE", "RESTRICTED"] }
            }
          });
          const ownerPolicy = await this.entitlementService.resolveForUser(tx, membership.diningGroup.ownerId);
          const state: RelationshipState = memberCount > ownerPolicy.memberLimit ? "OVER_MEMBER_LIMIT" : "NORMAL";

          return {
            id: membership.diningGroup.id,
            name: membership.diningGroup.name,
            description: membership.diningGroup.description,
            coverImageUrl: null,
            ownerUid: membership.diningGroup.owner.uid,
            isOwned: membership.diningGroup.ownerId === userId,
            canManageCover: false,
            myRole: membership.role,
            myStatus: membership.status,
            myStatusReason: membership.statusReason,
            createdDays: Math.max(1, Math.ceil((Date.now() - membership.diningGroup.createdAt.getTime()) / (24 * 60 * 60 * 1000))),
            memberCount,
            memberLimit: ownerPolicy.memberLimit,
            pollCount: 0,
            diningEventCount: 0,
            hasAttention: false,
            latestActivityTitle: null,
            latestActivityAt: null,
            state,
            version: membership.diningGroup.version,
            createdAt: toIsoDate(membership.diningGroup.createdAt),
            updatedAt: toIsoDate(membership.diningGroup.updatedAt)
          };
        })
      );

      const byModuleMap = new Map<string, number>();
      for (const row of storageRows) {
        byModuleMap.set(row.module, (byModuleMap.get(row.module) ?? 0) + row.usedBytes);
      }
      const usedBytes = Array.from(byModuleMap.values()).reduce((total, value) => total + value, 0);
      const storage: StorageUsageSummary = {
        state: usedBytes > resolved.storageLimitBytes ? "OVER_STORAGE_READONLY" : "NORMAL",
        usedBytes,
        limitBytes: resolved.storageLimitBytes,
        remainingBytes: Math.max(0, resolved.storageLimitBytes - usedBytes),
        byModule: Array.from(byModuleMap.entries()).map(([module, moduleUsedBytes]) => ({
          module: module as AdminUserEntitlementResponse["storage"]["byModule"][number]["module"],
          usedBytes: moduleUsedBytes
        })),
        calculatedAt: toIsoDate(new Date())
      };

      return {
        user: {
          id: user.id,
          uid: user.uid,
          nickname: user.nickname,
          status: user.status
        },
        membership: {
          tier: resolved.tier,
          validUntil: resolved.validUntil
        },
        display: {
          canUseProfileBackground: false,
          canUseHomeBackground: false
        },
        diningGroupUsage: {
          ownedCount: resolved.ownedDiningGroupCount,
          joinedCount: resolved.joinedDiningGroupCount,
          joinLimit: resolved.joinLimit,
          state: resolved.state
        },
        diningGroups,
        storage,
        recipePolicy: {
          recipeLimit: resolved.recipeLimit,
          recycleDays: resolved.recycleDays,
          variantLimitPerRoot: resolved.variantLimitPerRoot
        },
        invitePolicy: {
          inviteLimit: resolved.inviteLimit,
          memberLimit: resolved.memberLimit
        },
        imagePolicy: resolved.imagePolicy
      };
    });
  }

  async getUserRecipeDomain(userId: UUID, adminId: UUID): Promise<AdminUserRecipeDomainOverview> {
    await this.requireSuperAdmin(adminId);
    return this.prisma.$transaction(async tx => {
      const user = await this.requireUser(tx, userId);
      const [publishedCount, draftCount, collectionCount, sceneCount, latestRecipe, latestDraft, latestCollection] = await Promise.all([
        tx.recipe.count({
          where: {
            ownerId: userId,
            status: "ACTIVE"
          }
        }),
        tx.recipeDraft.count({
          where: {
            userId
          }
        }),
        tx.recipeCollection.count({
          where: {
            userId
          }
        }),
        tx.recipeScene.count({
          where: {
            userId
          }
        }),
        tx.recipe.findFirst({
          where: {
            ownerId: userId,
            status: "ACTIVE"
          },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true }
        }),
        tx.recipeDraft.findFirst({
          where: {
            userId
          },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true }
        }),
        tx.recipeCollection.findFirst({
          where: {
            userId
          },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true }
        })
      ]);

      return {
        user: {
          id: user.id,
          uid: user.uid,
          nickname: user.nickname
        },
        publishedCount,
        draftCount,
        collectionCount,
        sceneCount,
        latestPublishedAt: latestRecipe ? toIsoDate(latestRecipe.updatedAt) : null,
        latestDraftAt: latestDraft ? toIsoDate(latestDraft.updatedAt) : null,
        latestCollectionAt: latestCollection ? toIsoDate(latestCollection.updatedAt) : null
      };
    });
  }

  async listUserRecipes(
    userId: UUID,
    adminId: UUID,
    page: number,
    pageSize: number,
    keyword?: string
  ): Promise<PageResult<MyRecipeSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    await this.requireUserExists(userId);

    const where: Prisma.RecipeWhereInput = {
      ownerId: userId,
      status: "ACTIVE",
      ...(keyword
        ? {
            searchText: {
              contains: keyword,
              mode: "insensitive"
            }
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        include: {
          category: true,
          currentVersion: true
        },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipe.count({ where })
    ]);

    return {
      items: items.map(item => this.toUserRecipeSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async listUserRecipeDrafts(
    userId: UUID,
    adminId: UUID,
    page: number,
    pageSize: number,
    keyword?: string
  ): Promise<PageResult<RecipeDraftSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    await this.requireUserExists(userId);

    const where: Prisma.RecipeDraftWhereInput = {
      userId,
      ...(keyword
        ? {
            searchText: {
              contains: keyword,
              mode: "insensitive"
            }
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipeDraft.findMany({
        where,
        include: {
          category: true
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipeDraft.count({ where })
    ]);

    return {
      items: items.map(item => this.toUserDraftSummary(item)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async listUserCollections(userId: UUID, adminId: UUID): Promise<CollectionListResponse> {
    await this.requireSuperAdmin(adminId);
    return this.prisma.$transaction(async tx => {
      await this.requireUser(tx, userId);
      const [scenes, collections] = await Promise.all([
        tx.recipeScene.findMany({
          where: { userId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }),
        tx.recipeCollection.findMany({
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
    });
  }

  async listUserCollectionRecipes(
    userId: UUID,
    sceneId: UUID,
    adminId: UUID,
    page: number,
    pageSize: number
  ): Promise<PageResult<CollectedRecipeSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;

    return this.prisma.$transaction(async tx => {
      await this.requireUser(tx, userId);
      const scene = await tx.recipeScene.findFirst({
        where: {
          id: sceneId,
          userId
        },
        select: { id: true }
      });
      if (!scene) throw new NotFoundException("合集不存在");

      const where: Prisma.RecipeCollectionWhereInput = {
        userId,
        sceneLinks: {
          some: {
            sceneId
          }
        }
      };
      const [items, total] = await Promise.all([
        tx.recipeCollection.findMany({
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
        tx.recipeCollection.count({ where })
      ]);

      return {
        items: items.map(item => this.toCollectedRecipeSummary(item)),
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total,
        hasNext: skip + items.length < total
      };
    });
  }

  async listIngredientCategories(keyword: string | undefined, adminId: UUID): Promise<AdminIngredientCategorySummary[]> {
    await this.requireSuperAdmin(adminId);
    const normalizedKeyword = keyword?.trim();
    const where: Prisma.IngredientCategoryWhereInput = normalizedKeyword
      ? {
          name: {
            contains: normalizedKeyword,
            mode: "insensitive"
          }
        }
      : {};
    const categories = await this.prisma.ingredientCategory.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    if (!categories.length) return [];

    const counts = await this.prisma.ingredient.groupBy({
      by: ["categoryId"],
      where: {
        ownerId: null,
        status: {
          in: ["ACTIVE", "DISABLED"]
        },
        categoryId: {
          in: categories.map(item => item.id)
        }
      },
      _count: {
        _all: true
      }
    });
    const countMap = new Map(counts.map(item => [item.categoryId, item._count._all]));
    return categories.map(category => toAdminIngredientCategorySummary(category, countMap.get(category.id) ?? 0));
  }

  async listSystemUnits(adminId: UUID): Promise<AdminUnitSummary[]> {
    await this.requireSuperAdmin(adminId);
    const items = await this.prisma.unit.findMany({
      where: { ownerId: null },
      orderBy: [{ type: "asc" }, { systemSortOrder: "asc" }, { name: "asc" }]
    });
    return items.map(toAdminUnitSummary);
  }

  async listPendingUnitRecommendations(
    page: number,
    pageSize: number,
    keyword: string | undefined,
    adminId: UUID
  ): Promise<PageResult<AdminPendingUnitRecommendationSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedKeyword = keyword?.trim();
    const uidKeyword = normalizedKeyword && /^\d+$/.test(normalizedKeyword) ? Number(normalizedKeyword) : null;
    const where: Prisma.UnitRecommendationWhereInput = {
      status: "PENDING",
      ...(normalizedKeyword
        ? {
            OR: [
              { unitName: { contains: normalizedKeyword, mode: "insensitive" } },
              { user: { is: { nickname: { contains: normalizedKeyword, mode: "insensitive" } } } },
              ...(uidKeyword === null ? [] : [{ user: { is: { uid: uidKeyword } } }])
            ]
          }
        : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.unitRecommendation.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              uid: true,
              nickname: true
            }
          },
          targetUnit: true
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.unitRecommendation.count({ where })
    ]);
    return {
      items: items.map(toAdminPendingUnitRecommendationSummary),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createSystemUnit(body: AdminUnitPayloadRequest, adminId: UUID): Promise<AdminUnitSummary> {
    await this.requireSuperAdmin(adminId);
    const name = body.name.trim();
    const searchKey = buildSearchKey(name);
    const requestHash = `${body.type}:${searchKey}`;
    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminUnitSummary>(
          tx,
          body.operationId,
          "admin-unit:create",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-unit:create", adminId, requestHash);
        await this.assertSystemUnitNameAvailable(tx, searchKey, null);
        const systemSortOrder = await this.nextSystemUnitSortOrder(tx, body.type);
        const unit = await tx.unit.create({
          data: {
            ownerId: null,
            type: body.type,
            name,
            searchKey,
            systemSortOrder
          }
        });
        const result = toAdminUnitSummary(unit);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "UNIT_CREATED",
            objectType: "UNIT",
            objectId: unit.id,
            payload: {
              name,
              type: body.type,
              source: "SYSTEM"
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-unit:create", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统单位名称已存在，请刷新后重试");
      }
      throw error;
    }
  }

  async updateSystemUnit(unitId: UUID, body: UpdateAdminUnitRequest, adminId: UUID): Promise<AdminUnitSummary> {
    await this.requireSuperAdmin(adminId);
    const name = body.name.trim();
    const searchKey = buildSearchKey(name);
    const requestHash = `${unitId}:${body.expectedVersion}:${body.type}:${searchKey}`;
    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminUnitSummary>(
          tx,
          body.operationId,
          "admin-unit:update",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-unit:update", adminId, requestHash);
        const unit = await this.requireSystemUnit(tx, unitId);
        if (unit.version !== body.expectedVersion) throw new ConflictException("单位已被更新，请刷新后重试");
        await this.assertSystemUnitNameAvailable(tx, searchKey, unitId);
        const systemSortOrder =
          unit.type === body.type ? unit.systemSortOrder : await this.nextSystemUnitSortOrder(tx, body.type);
        const updated = await tx.unit.update({
          where: { id: unitId },
          data: {
            name,
            type: body.type,
            searchKey,
            systemSortOrder,
            version: { increment: 1 }
          }
        });
        const result = toAdminUnitSummary(updated);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "UNIT_UPDATED",
            objectType: "UNIT",
            objectId: unitId,
            payload: {
              name,
              type: body.type,
              source: "SYSTEM"
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-unit:update", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统单位名称已存在，请刷新后重试");
      }
      throw error;
    }
  }

  async deleteSystemUnit(unitId: UUID, operationId: OperationId, expectedVersion: number, adminId: UUID): Promise<AdminDeleteUnitResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${unitId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeleteUnitResult>(
        tx,
        operationId,
        "admin-unit:delete",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-unit:delete", adminId, requestHash);
      const unit = await this.requireSystemUnit(tx, unitId);
      if (unit.version !== expectedVersion) throw new ConflictException("单位已被更新，请刷新后重试");

      const ingredientCount = await tx.ingredient.count({
        where: {
          defaultUnitId: unitId,
          status: {
            in: ["ACTIVE", "DISABLED"]
          }
        }
      });
      if (ingredientCount > 0) throw new ConflictException("该单位已被食材使用，不能删除");
      if (await this.hasDraftUnitReference(tx, unitId)) {
        throw new ConflictException("该单位仍被菜谱草稿使用，不能删除");
      }
      if (await this.hasRecipeVersionUnitReference(tx, unitId)) {
        throw new ConflictException("该单位仍被已发布菜谱使用，不能删除");
      }

      await tx.unit.delete({
        where: { id: unitId }
      });
      const result = {
        unitId,
        deletedAt: toIsoDate(new Date())
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "UNIT_DELETED",
          objectType: "UNIT",
          objectId: unitId,
          payload: {
            name: unit.name,
            type: unit.type,
            source: "SYSTEM"
          }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-unit:delete", adminId, requestHash, result);
      return result;
    });
  }

  async reorderSystemUnits(type: UnitSummary["type"], operationId: OperationId, items: ReorderItem[], adminId: UUID): Promise<AdminUnitSummary[]> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify({ type, items });
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminUnitSummary[]>(
        tx,
        operationId,
        "admin-unit:reorder",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-unit:reorder", adminId, requestHash);

      const all = await tx.unit.findMany({
        where: {
          ownerId: null,
          type
        },
        orderBy: [{ systemSortOrder: "asc" }, { createdAt: "asc" }]
      });
      this.assertReorderScope(all, items, "系统单位");
      await this.writeSystemUnitSortOrder(tx, type, items.map(item => item.id));

      const updated = await tx.unit.findMany({
        where: {
          ownerId: null
        },
        orderBy: [{ type: "asc" }, { systemSortOrder: "asc" }, { name: "asc" }]
      });
      const result = updated.map(toAdminUnitSummary);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "UNIT_REORDERED",
          objectType: "UNIT_TYPE",
          objectId: null,
          payload: {
            type,
            ids: items.map(item => item.id),
            source: "SYSTEM"
          }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-unit:reorder", adminId, requestHash, result);
      return result;
    });
  }

  async createIngredientCategory(body: AdminIngredientCategoryPayloadRequest, adminId: UUID): Promise<AdminIngredientCategorySummary> {
    await this.requireSuperAdmin(adminId);
    void body;
    throw new ConflictException("系统食材分类已固定，当前不支持新增分类");
  }

  async updateIngredientCategory(
    categoryId: UUID,
    body: UpdateAdminIngredientCategoryRequest,
    adminId: UUID
  ): Promise<AdminIngredientCategorySummary> {
    await this.requireSuperAdmin(adminId);
    const name = body.name.trim();
    const requestHash = `${categoryId}:${body.expectedVersion}:${name}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminIngredientCategorySummary>(
        tx,
        body.operationId,
        "admin-ingredient-category:update",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-category:update", adminId, requestHash);

      const category = await this.requireIngredientCategory(tx, categoryId);
      if (category.version !== body.expectedVersion) throw new ConflictException("食材分类已被更新，请刷新后重试");
      await this.assertIngredientCategoryNameAvailable(tx, name, categoryId);

      const updated = await tx.ingredientCategory.update({
        where: { id: categoryId },
        data: {
          name,
          version: { increment: 1 }
        }
      });
      const ingredientCount = await tx.ingredient.count({
        where: {
          ownerId: null,
          status: {
            in: ["ACTIVE", "DISABLED"]
          },
          categoryId
        }
      });
      const result = toAdminIngredientCategorySummary(updated, ingredientCount);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INGREDIENT_CATEGORY_UPDATED",
          objectType: "INGREDIENT_CATEGORY",
          objectId: categoryId,
          payload: { name }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-category:update", adminId, requestHash, result);
      return result;
    });
  }

  async reorderIngredientCategories(
    operationId: OperationId,
    items: ReorderItem[],
    adminId: UUID
  ): Promise<AdminIngredientCategorySummary[]> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify(items);
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminIngredientCategorySummary[]>(
        tx,
        operationId,
        "admin-ingredient-category:reorder",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-ingredient-category:reorder", adminId, requestHash);

      const all = await tx.ingredientCategory.findMany({
        orderBy: { sortOrder: "asc" }
      });
      this.assertReorderScope(all, items, "食材分类");
      await this.writeIngredientCategorySortOrder(tx, items.map(item => item.id));

      const [updated, counts] = await Promise.all([
        tx.ingredientCategory.findMany({
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }),
        tx.ingredient.groupBy({
          by: ["categoryId"],
          where: { ownerId: null, status: "ACTIVE" },
          _count: { _all: true }
        })
      ]);
      const countMap = new Map(counts.map(item => [item.categoryId, item._count._all]));
      const result = updated.map(category => toAdminIngredientCategorySummary(category, countMap.get(category.id) ?? 0));
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INGREDIENT_CATEGORY_REORDERED",
          objectType: "INGREDIENT_CATEGORY",
          objectId: updated[0]?.id ?? null,
          payload: { ids: items.map(item => item.id) }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient-category:reorder", adminId, requestHash, result);
      return result;
    });
  }

  async listIngredients(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    page: number,
    pageSize: number,
    categoryId: UUID | undefined,
    keyword: string | undefined,
    status: string | undefined,
    factStatus: string | undefined,
    adminId: UUID
  ): Promise<PageResult<AdminIngredientSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedKeyword = keyword?.trim();
    const normalizedStatus = status === "DISABLED" || status === "ALL" ? status : "ACTIVE";
    const normalizedFactStatus = factStatus === "MISSING" ? "MISSING" : "ALL";
    const where: Prisma.IngredientWhereInput = {
      ownerId: null,
      status:
        normalizedStatus === "ALL"
          ? {
              in: ["ACTIVE", "DISABLED"]
            }
          : normalizedStatus,
      ...(categoryId ? { categoryId } : {}),
      ...(normalizedKeyword
        ? {
            searchKey: {
              contains: buildSearchKey(normalizedKeyword)
            }
          }
        : {})
    };
    const orderBy = categoryId
      ? ([{ systemSortOrder: "asc" }, { createdAt: "asc" }] satisfies Prisma.IngredientOrderByWithRelationInput[])
      : ([{ displaySortOrder: "asc" }, { createdAt: "asc" }] satisfies Prisma.IngredientOrderByWithRelationInput[]);
    if (normalizedFactStatus === "MISSING") {
      const rows = await this.prisma.ingredient.findMany({
        where,
        include: {
          category: true,
          defaultUnit: true
        },
        orderBy
      });
      const filtered = rows.filter(item => hasIngredientTagFactGap(item));
      const items = filtered.slice(skip, skip + normalizedPageSize);
      return {
        items: items.map(item => ({
          ...toAdminIngredientSummary(item),
          imageUrl: this.ingredientImageService.buildImageUrl(request, item.id, (item as AdminIngredientWithImageRow).imageUpdatedAt)
        })),
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total: filtered.length,
        hasNext: skip + items.length < filtered.length
      };
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingredient.findMany({
        where,
        include: {
          category: true,
          defaultUnit: true
        },
        orderBy,
        skip,
        take: normalizedPageSize
      }),
      this.prisma.ingredient.count({ where })
    ]);
    return {
      items: items.map(item => ({
        ...toAdminIngredientSummary(item),
        imageUrl: this.ingredientImageService.buildImageUrl(request, item.id, (item as AdminIngredientWithImageRow).imageUpdatedAt)
      })),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createIngredient(body: AdminIngredientPayloadRequest, adminId: UUID): Promise<AdminIngredientSummary> {
    await this.requireSuperAdmin(adminId);
    const name = body.name.trim();
    const searchKey = buildSearchKey(name);
    const aliases = normalizeIngredientAliases(name, body.aliases);
    const requestHash = JSON.stringify({
      searchKey,
      categoryId: body.categoryId,
      defaultUnitId: body.defaultUnitId,
      proteinType: body.proteinType ?? null,
      isStaple: body.isStaple,
      isSpicyIngredient: body.isSpicyIngredient,
      aliases
    });
    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminIngredientSummary>(
          tx,
          body.operationId,
          "admin-ingredient:create",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:create", adminId, requestHash);

        await this.requireSelectableIngredientCategory(tx, body.categoryId);
        const unit = await this.requireSystemUnit(tx, body.defaultUnitId);
        await this.assertSystemIngredientNameAvailable(tx, searchKey, null);
        const systemSortOrder = await this.nextSystemIngredientSortOrder(tx, body.categoryId);
        const displaySortOrder = await this.nextSystemIngredientDisplaySortOrder(tx);
        const ingredient = await tx.ingredient.create({
          data: {
            ownerId: null,
            status: "ACTIVE",
            categoryId: body.categoryId,
            defaultUnitId: unit.id,
            name,
            searchKey,
            proteinType: body.proteinType ?? null,
            isStaple: body.isStaple,
            isSpicyIngredient: body.isSpicyIngredient,
            aliases,
            systemSortOrder,
            displaySortOrder
          },
          include: {
            category: true,
            defaultUnit: true
          }
        });
        const result = toAdminIngredientSummary(ingredient);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_CREATED",
            objectType: "INGREDIENT",
            objectId: ingredient.id,
            payload: {
              categoryId: body.categoryId,
              name,
              proteinType: body.proteinType ?? null,
              isStaple: body.isStaple,
              isSpicyIngredient: body.isSpicyIngredient,
              aliases
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:create", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统食材名称或排序已冲突，请刷新后重试");
      }
      throw error;
    }
  }

  async updateIngredient(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    ingredientId: UUID,
    body: UpdateAdminIngredientRequest,
    adminId: UUID
  ): Promise<AdminIngredientSummary> {
    await this.requireSuperAdmin(adminId);
    const name = body.name.trim();
    const searchKey = buildSearchKey(name);
    const aliases = normalizeIngredientAliases(name, body.aliases);
    const requestHash = JSON.stringify({
      ingredientId,
      expectedVersion: body.expectedVersion,
      searchKey,
      categoryId: body.categoryId,
      defaultUnitId: body.defaultUnitId,
      proteinType: body.proteinType ?? null,
      isStaple: body.isStaple,
      isSpicyIngredient: body.isSpicyIngredient,
      aliases
    });
    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminIngredientSummary>(
          tx,
          body.operationId,
          "admin-ingredient:update",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:update", adminId, requestHash);

        const ingredient = await this.requireSystemIngredient(tx, ingredientId, true);
        if (ingredient.version !== body.expectedVersion) throw new ConflictException("食材已被更新，请刷新后重试");
        await this.requireSelectableIngredientCategory(tx, body.categoryId);
        const unit = await this.requireSystemUnit(tx, body.defaultUnitId);
        await this.assertSystemIngredientNameAvailable(tx, searchKey, ingredientId);
        const systemSortOrder =
          ingredient.categoryId === body.categoryId
            ? ingredient.systemSortOrder
            : await this.nextSystemIngredientSortOrder(tx, body.categoryId);

        const updated = await tx.ingredient.update({
          where: { id: ingredientId },
          data: {
            name,
            searchKey,
            categoryId: body.categoryId,
            defaultUnitId: unit.id,
            proteinType: body.proteinType ?? null,
            isStaple: body.isStaple,
            isSpicyIngredient: body.isSpicyIngredient,
            aliases,
            systemSortOrder,
            version: { increment: 1 }
          },
          include: {
            category: true,
            defaultUnit: true
          }
        });
        const result = {
          ...toAdminIngredientSummary(updated),
          imageUrl: this.ingredientImageService.buildImageUrl(
            request,
            updated.id,
            (updated as AdminIngredientWithImageRow).imageUpdatedAt
          )
        };
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_UPDATED",
            objectType: "INGREDIENT",
            objectId: ingredientId,
            payload: {
              categoryId: body.categoryId,
              name,
              proteinType: body.proteinType ?? null,
              isStaple: body.isStaple,
              isSpicyIngredient: body.isSpicyIngredient,
              aliases
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:update", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统食材名称或排序已冲突，请刷新后重试");
      }
      throw error;
    }
  }

  async setIngredientStatus(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    ingredientId: UUID,
    body: SetAdminIngredientStatusRequest,
    adminId: UUID
  ): Promise<AdminIngredientSummary> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${ingredientId}:${body.expectedVersion}:${body.status}`;

    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminIngredientSummary>(
          tx,
          body.operationId,
          "admin-ingredient:set-status",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:set-status", adminId, requestHash);

        const ingredient = await this.requireSystemIngredient(tx, ingredientId, true);
        if (ingredient.version !== body.expectedVersion) throw new ConflictException("食材已被更新，请刷新后重试");

        const updated =
          ingredient.status === body.status
            ? ingredient
            : await tx.ingredient.update({
                where: { id: ingredientId },
                data: {
                  status: body.status,
                  systemSortOrder:
                    body.status === "ACTIVE" ? await this.nextSystemIngredientSortOrder(tx, ingredient.categoryId) : ingredient.systemSortOrder,
                  displaySortOrder:
                    body.status === "ACTIVE" ? await this.nextSystemIngredientDisplaySortOrder(tx) : ingredient.displaySortOrder,
                  version: { increment: 1 }
                },
                include: {
                  category: true,
                  defaultUnit: true
                }
              });

        const result = {
          ...toAdminIngredientSummary(updated as AdminIngredientRow),
          imageUrl: this.ingredientImageService.buildImageUrl(
            request,
            updated.id,
            (updated as AdminIngredientWithImageRow).imageUpdatedAt
          )
        };
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_STATUS_CHANGED",
            objectType: "INGREDIENT",
            objectId: ingredientId,
            payload: {
              status: body.status
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:set-status", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统食材排序已更新，请刷新后重试");
      }
      throw error;
    }
  }

  async uploadIngredientImage(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    ingredientId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    file: { buffer?: Buffer; size?: number } | undefined,
    adminId: UUID
  ): Promise<AdminIngredientSummary> {
    await this.requireSuperAdmin(adminId);
    const fileHash = file?.buffer ? createHash("sha256").update(file.buffer).digest("hex") : "missing";
    const requestHash = `${ingredientId}:${expectedVersion}:${fileHash}`;
    const stagedImagePath = await this.ingredientImageService.stageImageUpload(ingredientId, file);
    let backupImagePath: string | null = null;
    let replaced = false;

    try {
      const result = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminIngredientSummary>(
          tx,
          operationId,
          "admin-ingredient:upload-image",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, operationId, "admin-ingredient:upload-image", adminId, requestHash);

        const ingredient = await this.requireSystemIngredient(tx, ingredientId, true);
        if (ingredient.version !== expectedVersion) throw new ConflictException("食材已被更新，请刷新后重试");

        backupImagePath = await this.ingredientImageService.replaceStagedImage(ingredientId, stagedImagePath);
        replaced = true;

        const updated = await tx.ingredient.update({
          where: { id: ingredientId },
          data: {
            imageUpdatedAt: new Date(),
            version: { increment: 1 }
          } as Prisma.IngredientUpdateInput,
          include: {
            category: true,
            defaultUnit: true
          }
        });
        const result = {
          ...toAdminIngredientSummary(updated as AdminIngredientRow),
          imageUrl: this.ingredientImageService.buildImageUrl(
            request,
            updated.id,
            (updated as AdminIngredientWithImageRow).imageUpdatedAt
          )
        };
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_IMAGE_UPDATED",
            objectType: "INGREDIENT",
            objectId: ingredientId,
            payload: {
              fileHash
            }
          }
        });
        await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient:upload-image", adminId, requestHash, result);
        return result;
      });

      if (replaced) {
        await this.ingredientImageService.finalizeReplacedImage(backupImagePath);
      } else {
        await this.ingredientImageService.discardStagedImage(stagedImagePath);
      }

      return result;
    } catch (error) {
      if (replaced) {
        await this.ingredientImageService.rollbackReplacedImage(ingredientId, backupImagePath);
      } else {
        await this.ingredientImageService.discardStagedImage(stagedImagePath);
      }
      throw error;
    }
  }

  async clearIngredientImage(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    ingredientId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    adminId: UUID
  ): Promise<AdminIngredientSummary> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${ingredientId}:${expectedVersion}:clear`;
    let backupImagePath: string | null = null;
    let cleared = false;

    try {
      const result = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminIngredientSummary>(
          tx,
          operationId,
          "admin-ingredient:clear-image",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, operationId, "admin-ingredient:clear-image", adminId, requestHash);

        const ingredient = await this.requireSystemIngredient(tx, ingredientId, true);
        if (ingredient.version !== expectedVersion) throw new ConflictException("食材已被更新，请刷新后重试");

        backupImagePath = await this.ingredientImageService.stageClearImage(ingredientId);
        cleared = true;

        const updated = await tx.ingredient.update({
          where: { id: ingredientId },
          data: {
            imageUpdatedAt: null,
            version: { increment: 1 }
          } as Prisma.IngredientUpdateInput,
          include: {
            category: true,
            defaultUnit: true
          }
        });
        const result = {
          ...toAdminIngredientSummary(updated as AdminIngredientRow),
          imageUrl: null
        };
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_IMAGE_CLEARED",
            objectType: "INGREDIENT",
            objectId: ingredientId,
            payload: {}
          }
        });
        await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient:clear-image", adminId, requestHash, result);
        return result;
      });

      if (cleared) {
        await this.ingredientImageService.finalizeClearedImage(backupImagePath);
      }

      return result;
    } catch (error) {
      if (cleared) {
        await this.ingredientImageService.rollbackClearedImage(ingredientId, backupImagePath);
      }
      throw error;
    }
  }

  async reorderIngredients(
    categoryId: UUID | undefined,
    operationId: OperationId,
    items: ReorderItem[],
    adminId: UUID
  ): Promise<AdminIngredientSummary[]> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify({ categoryId, items });
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminIngredientSummary[]>(
        tx,
        operationId,
        "admin-ingredient:reorder",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-ingredient:reorder", adminId, requestHash);
      if (categoryId) {
        await this.requireIngredientCategory(tx, categoryId);
      }

      const all = await tx.ingredient.findMany({
        where: {
          ownerId: null,
          status: "ACTIVE",
          ...(categoryId ? { categoryId } : {})
        },
        include: {
          category: true,
          defaultUnit: true
        },
        orderBy: categoryId ? [{ systemSortOrder: "asc" }, { createdAt: "asc" }] : [{ displaySortOrder: "asc" }, { createdAt: "asc" }]
      });
      this.assertReorderScope(all, items, "系统食材");
      if (categoryId) {
        await this.writeSystemIngredientSortOrder(tx, items.map(item => item.id), categoryId);
      } else {
        await this.writeSystemIngredientDisplaySortOrder(tx, items.map(item => item.id));
      }

      const updated = await tx.ingredient.findMany({
        where: {
          ownerId: null,
          status: "ACTIVE",
          ...(categoryId ? { categoryId } : {})
        },
        include: {
          category: true,
          defaultUnit: true
        },
        orderBy: categoryId ? [{ systemSortOrder: "asc" }, { createdAt: "asc" }] : [{ displaySortOrder: "asc" }, { createdAt: "asc" }]
      });
      const result = updated.map(toAdminIngredientSummary);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INGREDIENT_REORDERED",
          objectType: categoryId ? "INGREDIENT_CATEGORY" : "INGREDIENT",
          objectId: categoryId ?? null,
          payload: {
            scope: categoryId ? "CATEGORY" : "ALL",
            categoryId: categoryId ?? null,
            ids: items.map(item => item.id)
          }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient:reorder", adminId, requestHash, result);
      return result;
    });
  }

  async listPendingIngredients(page: number, pageSize: number, keyword: string | undefined, adminId: UUID): Promise<PageResult<AdminPendingIngredientSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedKeyword = keyword?.trim();
    const uidKeyword = normalizedKeyword && /^\d+$/.test(normalizedKeyword) ? Number(normalizedKeyword) : null;
    const where: Prisma.IngredientRecommendationWhereInput = {
      status: "PENDING",
      ingredient: {
        is: {
          ownerId: {
            not: null
          },
          status: "ACTIVE"
        }
      },
      ...(normalizedKeyword
        ? {
            OR: [
              { ingredientName: { contains: normalizedKeyword, mode: "insensitive" } },
              { categoryName: { contains: normalizedKeyword, mode: "insensitive" } },
              { user: { is: { nickname: { contains: normalizedKeyword, mode: "insensitive" } } } },
              ...(uidKeyword === null ? [] : [{ ingredient: { is: { owner: { is: { uid: uidKeyword } } } } }])
            ]
          }
        : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingredientRecommendation.findMany({
        where,
        include: {
          ingredient: {
            include: {
              owner: {
                select: {
                  id: true,
                  uid: true,
                  nickname: true
                }
              },
              defaultUnit: true
            }
          }
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.ingredientRecommendation.count({ where })
    ]);

    return {
      items: items.map(toAdminPendingIngredientSummary),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async listPendingIngredientFeedbacks(
    page: number,
    pageSize: number,
    keyword: string | undefined,
    adminId: UUID
  ): Promise<PageResult<AdminPendingIngredientFeedbackSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedKeyword = keyword?.trim();
    const uidKeyword = normalizedKeyword && /^\d+$/.test(normalizedKeyword) ? Number(normalizedKeyword) : null;
    const where: Prisma.IngredientFeedbackWhereInput = {
      status: "PENDING",
      ingredient: {
        is: {
          ownerId: null,
          status: {
            in: ["ACTIVE", "DISABLED"]
          }
        }
      },
      ...(normalizedKeyword
        ? {
            OR: [
              { ingredientName: { contains: normalizedKeyword, mode: "insensitive" } },
              { suggestedName: { contains: normalizedKeyword, mode: "insensitive" } },
              { categoryName: { contains: normalizedKeyword, mode: "insensitive" } },
              { suggestedCategoryName: { contains: normalizedKeyword, mode: "insensitive" } },
              { note: { contains: normalizedKeyword, mode: "insensitive" } },
              { user: { is: { nickname: { contains: normalizedKeyword, mode: "insensitive" } } } },
              ...(uidKeyword === null ? [] : [{ user: { is: { uid: uidKeyword } } }])
            ]
          }
        : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingredientFeedback.findMany({
        where,
        include: {
          ingredient: {
            include: {
              category: true,
              owner: {
                select: {
                  id: true,
                  uid: true,
                  nickname: true
                }
              }
            }
          }
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.ingredientFeedback.count({ where })
    ]);
    return {
      items: items.map(toAdminPendingIngredientFeedbackSummary),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async listPendingRecipes(page: number, pageSize: number, keyword: string | undefined, adminId: UUID): Promise<PageResult<AdminPendingRecipeSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedKeyword = keyword?.trim();
    const uidKeyword = normalizedKeyword && /^\d+$/.test(normalizedKeyword) ? Number(normalizedKeyword) : null;
    const where: Prisma.RecipeRecommendationWhereInput = {
      status: "PENDING",
      recipe: {
        is: {
          ownerId: {
            not: null
          },
          status: "ACTIVE"
        }
      },
      ...(normalizedKeyword
        ? {
            OR: [
              { recipeTitle: { contains: normalizedKeyword, mode: "insensitive" } },
              { suggestedCategoryName: { contains: normalizedKeyword, mode: "insensitive" } },
              { recipe: { is: { category: { is: { name: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
              { user: { is: { nickname: { contains: normalizedKeyword, mode: "insensitive" } } } },
              ...(uidKeyword === null ? [] : [{ recipe: { is: { owner: { is: { uid: uidKeyword } } } } }])
            ]
          }
        : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipeRecommendation.findMany({
        where,
        include: {
          recipe: {
            include: {
              owner: {
                select: {
                  id: true,
                  uid: true,
                  nickname: true
                }
              },
              category: true
            }
          },
          sourceVersion: true,
          suggestedCategory: true
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipeRecommendation.count({ where })
    ]);

    return {
      items: items.map(toAdminPendingRecipeSummary),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async reviewPendingIngredient(
    _request: { protocol?: string; get?: (name: string) => string | undefined },
    ingredientId: UUID,
    body: AdminReviewPendingIngredientRequest,
    adminId: UUID
  ): Promise<AdminReviewPendingIngredientResult> {
    await this.requireSuperAdmin(adminId);
    const reviewContent = resolveIngredientReviewNote(body);
    const requestHash = JSON.stringify({
      ingredientId,
      ...body,
      reason: reviewContent.reviewNote,
      reviewAdvice: reviewContent.reviewAdvice,
      reviewReasonCode: reviewContent.reviewReasonCode
    });
    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "ingredients" WHERE "id" = ${ingredientId} FOR UPDATE`;
        const recommendation = await this.requirePendingIngredientRecommendation(tx, ingredientId);
        const repeated = await getAdminIdempotentResult<AdminReviewPendingIngredientResult>(
          tx,
          body.operationId,
          "admin-pending-ingredient:review",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        if (recommendation.ingredient.version !== body.expectedVersion) {
          throw new ConflictException("食材已被更新，请刷新后重试");
        }
        await startAdminIdempotentOperation(tx, body.operationId, "admin-pending-ingredient:review", adminId, requestHash);

        const now = new Date();
        if (body.action === "REJECT") {
          await tx.ingredientRecommendation.update({
            where: { id: recommendation.id },
            data: {
              status: "REJECTED",
              reviewNote: reviewContent.reviewNote,
              reviewReasonCode: reviewContent.reviewReasonCode,
              reviewAdvice: reviewContent.reviewAdvice,
              reviewedAt: now
            }
          });
          await tx.auditEvent.create({
            data: {
              actorType: "ADMIN",
              actorAdminId: adminId,
              action: "INGREDIENT_RECOMMENDATION_REVIEWED",
              objectType: "INGREDIENT",
              objectId: ingredientId,
              payload: {
                action: body.action,
                targetIngredientId: null,
                rejectReasonCode: reviewContent.reviewReasonCode,
                reason: reviewContent.auditReason,
                advice: reviewContent.reviewAdvice
              }
            },
          });
          const result = {
            id: ingredientId,
            status: "REJECTED",
            reviewedAt: toIsoDate(now),
            targetIngredientId: null
          } satisfies AdminReviewPendingIngredientResult;
          await completeAdminIdempotentOperation(tx, body.operationId, "admin-pending-ingredient:review", adminId, requestHash, result);
          return result;
        }

        const name = body.name?.trim() || "";
        if (!name) throw new BadRequestException("食材名称不能为空");
        if (!body.categoryId) throw new BadRequestException("请选择分类");
        if (!body.defaultUnitId) throw new BadRequestException("请选择默认单位");
        const searchKey = buildSearchKey(name);
        const category = await this.requireSelectableIngredientCategory(tx, body.categoryId);
        const unit = await this.requireSystemUnit(tx, body.defaultUnitId);

        let targetIngredientId: UUID | null = null;

        if (body.action === "APPROVE_MERGE") {
          if (!body.targetIngredientId) throw new BadRequestException("请选择归并目标");
          const mergeTarget = await this.requireSystemIngredient(tx, body.targetIngredientId);
          await this.assertSystemIngredientNameAvailable(tx, searchKey, mergeTarget.id);
          const nextSortOrder =
            mergeTarget.categoryId === body.categoryId
              ? mergeTarget.systemSortOrder
              : await this.nextSystemIngredientSortOrder(tx, body.categoryId);
          const updatedTarget = await tx.ingredient.update({
            where: { id: mergeTarget.id },
            data: {
              name,
              searchKey,
              categoryId: body.categoryId,
              defaultUnitId: unit.id,
              systemSortOrder: nextSortOrder,
              version: { increment: 1 }
            },
            include: {
              category: true,
              defaultUnit: true
            }
          });
          await tx.ingredient.update({
            where: { id: ingredientId },
            data: {
              status: "MERGED",
              mergedToId: updatedTarget.id,
              version: { increment: 1 }
            }
          });
          await tx.ingredientRecommendation.update({
            where: { id: recommendation.id },
            data: {
              status: "MERGED",
              ingredientName: updatedTarget.name,
              categoryId: updatedTarget.categoryId,
              categoryName: category.name,
              defaultUnitId: updatedTarget.defaultUnitId,
              defaultUnitName: updatedTarget.defaultUnit.name,
              reviewNote: reviewContent.reviewNote,
              reviewReasonCode: null,
              reviewAdvice: null,
              targetIngredientId: updatedTarget.id,
              reviewedAt: now
            }
          });
          targetIngredientId = updatedTarget.id;
        } else {
          const duplicate = await tx.ingredient.findFirst({
            where: {
              ownerId: null,
              status: {
                in: ["ACTIVE", "DISABLED"]
              },
              searchKey,
            },
            include: {
              category: true,
              defaultUnit: true
            }
          });

          if (duplicate) {
            const nextSortOrder =
              duplicate.categoryId === body.categoryId
                ? duplicate.systemSortOrder
                : await this.nextSystemIngredientSortOrder(tx, body.categoryId);
            const displaySortOrder =
              duplicate.status === "ACTIVE" ? duplicate.displaySortOrder : await this.nextSystemIngredientDisplaySortOrder(tx);
            const updatedTarget = await tx.ingredient.update({
              where: { id: duplicate.id },
              data: {
                status: "ACTIVE",
                name,
                searchKey,
                categoryId: body.categoryId,
                defaultUnitId: unit.id,
                systemSortOrder: nextSortOrder,
                displaySortOrder,
                version: { increment: 1 }
              },
              include: {
                category: true,
                defaultUnit: true
              }
            });
            await tx.ingredient.update({
              where: { id: ingredientId },
              data: {
                status: "MERGED",
                mergedToId: updatedTarget.id,
                version: { increment: 1 }
              }
            });
            await tx.ingredientRecommendation.update({
              where: { id: recommendation.id },
            data: {
              status: "MERGED",
              ingredientName: updatedTarget.name,
              categoryId: updatedTarget.categoryId,
              categoryName: category.name,
              defaultUnitId: updatedTarget.defaultUnitId,
              defaultUnitName: updatedTarget.defaultUnit.name,
              reviewNote: reviewContent.reviewNote,
              reviewReasonCode: null,
              reviewAdvice: null,
              targetIngredientId: updatedTarget.id,
              reviewedAt: now
            }
          });
            targetIngredientId = updatedTarget.id;
          } else {
            const current = recommendation.ingredient;
            const nextSortOrder =
              current.categoryId === body.categoryId && current.ownerId === null
                ? current.systemSortOrder
                : await this.nextSystemIngredientSortOrder(tx, body.categoryId);
            const displaySortOrder =
              current.ownerId === null && current.status === "ACTIVE"
                ? current.displaySortOrder
                : await this.nextSystemIngredientDisplaySortOrder(tx);
            const updatedIngredient = await tx.ingredient.update({
              where: { id: ingredientId },
              data: {
                ownerId: null,
                status: "ACTIVE",
                mergedToId: null,
                name,
                searchKey,
                categoryId: body.categoryId,
                defaultUnitId: unit.id,
                systemSortOrder: nextSortOrder,
                displaySortOrder,
                version: { increment: 1 }
              },
              include: {
                category: true,
                defaultUnit: true
              }
            });
            await tx.ingredientRecommendation.update({
              where: { id: recommendation.id },
            data: {
              status: "ADOPTED",
              ingredientName: updatedIngredient.name,
              categoryId: updatedIngredient.categoryId,
              categoryName: category.name,
              defaultUnitId: updatedIngredient.defaultUnitId,
              defaultUnitName: updatedIngredient.defaultUnit.name,
              reviewNote: reviewContent.reviewNote,
              reviewReasonCode: null,
              reviewAdvice: null,
              targetIngredientId: updatedIngredient.id,
              reviewedAt: now
            }
          });
            targetIngredientId = updatedIngredient.id;
          }
        }

        const result = {
          id: ingredientId,
          status: "APPROVED",
          reviewedAt: toIsoDate(now),
          targetIngredientId
        } satisfies AdminReviewPendingIngredientResult;
        await this.medalService.awardRecommendationContribution(tx, recommendation.userId, now);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_RECOMMENDATION_REVIEWED",
            objectType: "INGREDIENT",
            objectId: ingredientId,
            payload: {
              action: body.action,
              targetIngredientId,
              reason: reviewContent.auditReason
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-pending-ingredient:review", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统食材名称或排序已冲突，请刷新后重试");
      }
      throw error;
    }
  }

  async reviewPendingUnitRecommendation(
    recommendationId: UUID,
    body: AdminReviewPendingUnitRecommendationRequest,
    adminId: UUID
  ): Promise<AdminReviewPendingUnitRecommendationResult> {
    await this.requireSuperAdmin(adminId);
    const reviewNote = body.reason?.trim() || null;
    const requestHash = JSON.stringify({
      recommendationId,
      action: body.action,
      expectedVersion: body.expectedVersion,
      name: body.name?.trim() || null,
      type: body.type ?? null,
      reviewNote
    });
    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "unit_recommendations" WHERE "id" = ${recommendationId} FOR UPDATE`;
        const recommendation = await this.requirePendingUnitRecommendation(tx, recommendationId);
        const repeated = await getAdminIdempotentResult<AdminReviewPendingUnitRecommendationResult>(
          tx,
          body.operationId,
          "admin-pending-unit:review",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        if (recommendation.version !== body.expectedVersion) {
          throw new ConflictException("单位建议已更新，请刷新后重试");
        }
        await startAdminIdempotentOperation(tx, body.operationId, "admin-pending-unit:review", adminId, requestHash);

        const now = new Date();
        if (body.action === "REJECT") {
          await tx.unitRecommendation.update({
            where: { id: recommendation.id },
            data: {
              status: "REJECTED",
              reviewNote: reviewNote || "审核未通过",
              reviewAdvice: "请尽量改成更准确、常用的单位后再提交。",
              reviewedAt: now,
              version: { increment: 1 }
            }
          });
          await tx.auditEvent.create({
            data: {
              actorType: "ADMIN",
              actorAdminId: adminId,
              action: "UNIT_RECOMMENDATION_REVIEWED",
              objectType: "UNIT_RECOMMENDATION",
              objectId: recommendation.id,
              payload: {
                action: body.action,
                reason: reviewNote
              }
            }
          });
          const result = {
            id: recommendation.id,
            status: "REJECTED",
            reviewedAt: toIsoDate(now),
            targetUnitId: null
          } satisfies AdminReviewPendingUnitRecommendationResult;
          await completeAdminIdempotentOperation(tx, body.operationId, "admin-pending-unit:review", adminId, requestHash, result);
          return result;
        }

        const name = body.name?.trim() || recommendation.unitName;
        if (!name) throw new BadRequestException("单位名称不能为空");
        const type = body.type ?? recommendation.unitType;
        const searchKey = buildSearchKey(name);
        let targetUnitId: UUID | null = null;
        const duplicate = await tx.unit.findFirst({
          where: {
            ownerId: null,
            searchKey
          }
        });
        if (duplicate) {
          targetUnitId = duplicate.id;
          await tx.unitRecommendation.update({
            where: { id: recommendation.id },
            data: {
              unitName: duplicate.name,
              unitType: duplicate.type,
              status: "MERGED",
              reviewNote,
              reviewAdvice: null,
              targetUnitId: duplicate.id,
              reviewedAt: now,
              version: { increment: 1 }
            }
          });
        } else {
          const created = await tx.unit.create({
            data: {
              ownerId: null,
              name,
              type,
              searchKey,
              systemSortOrder: await this.nextSystemUnitSortOrder(tx, type)
            }
          });
          targetUnitId = created.id;
          await tx.unitRecommendation.update({
            where: { id: recommendation.id },
            data: {
              unitName: created.name,
              unitType: created.type,
              status: "ADOPTED",
              reviewNote,
              reviewAdvice: null,
              targetUnitId: created.id,
              reviewedAt: now,
              version: { increment: 1 }
            }
          });
        }

        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "UNIT_RECOMMENDATION_REVIEWED",
            objectType: "UNIT_RECOMMENDATION",
            objectId: recommendation.id,
            payload: {
              action: body.action,
              targetUnitId,
              name,
              type,
              reviewNote
            }
          }
        });
        const result = {
          id: recommendation.id,
          status: "APPROVED",
          reviewedAt: toIsoDate(now),
          targetUnitId
        } satisfies AdminReviewPendingUnitRecommendationResult;
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-pending-unit:review", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统单位名称已存在，请刷新后重试");
      }
      throw error;
    }
  }

  async reviewIngredientFeedback(
    feedbackId: UUID,
    body: AdminReviewIngredientFeedbackRequest,
    adminId: UUID
  ): Promise<AdminReviewIngredientFeedbackResult> {
    await this.requireSuperAdmin(adminId);
    const name = body.name?.trim() || "";
    const reviewNote = body.reason?.trim() || null;
    const requestHash = JSON.stringify({
      feedbackId,
      action: body.action,
      expectedVersion: body.expectedVersion,
      name,
      categoryId: body.categoryId ?? null,
      reason: reviewNote
    });
    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "ingredient_feedbacks" WHERE "id" = ${feedbackId} FOR UPDATE`;
        const feedback = await this.requirePendingIngredientFeedback(tx, feedbackId);
        await tx.$queryRaw`SELECT "id" FROM "ingredients" WHERE "id" = ${feedback.ingredientId} FOR UPDATE`;
        const ingredient = await this.requireSystemIngredient(tx, feedback.ingredientId, true);
        const repeated = await getAdminIdempotentResult<AdminReviewIngredientFeedbackResult>(
          tx,
          body.operationId,
          "admin-ingredient-feedback:review",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        if (ingredient.version !== body.expectedVersion) {
          throw new ConflictException("食材已被更新，请刷新后重试");
        }
        await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-feedback:review", adminId, requestHash);

        const now = new Date();
        if (body.action === "REJECT") {
          await tx.ingredientFeedback.update({
            where: { id: feedback.id },
            data: {
              status: "REJECTED",
              reviewNote,
              reviewedAt: now
            }
          });
          await tx.auditEvent.create({
            data: {
              actorType: "ADMIN",
              actorAdminId: adminId,
              action: "INGREDIENT_FEEDBACK_REVIEWED",
              objectType: "INGREDIENT",
              objectId: ingredient.id,
              payload: {
                feedbackId,
                action: body.action,
                reason: reviewNote
              }
            }
          });
          const result = {
            id: feedback.id,
            ingredientId: ingredient.id,
            status: "REJECTED",
            reviewedAt: toIsoDate(now)
          } satisfies AdminReviewIngredientFeedbackResult;
          await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-feedback:review", adminId, requestHash, result);
          return result;
        }

        if (!name) throw new BadRequestException("食材名称不能为空");
        if (!body.categoryId) throw new BadRequestException("请选择分类");
        const searchKey = buildSearchKey(name);
        const category = await this.requireSelectableIngredientCategory(tx, body.categoryId);
        await this.assertSystemIngredientNameAvailable(tx, searchKey, ingredient.id);
        const nextSortOrder =
          ingredient.categoryId === category.id
            ? ingredient.systemSortOrder
            : await this.nextSystemIngredientSortOrder(tx, category.id);
        await tx.ingredient.update({
          where: { id: ingredient.id },
          data: {
            name,
            searchKey,
            categoryId: category.id,
            systemSortOrder: nextSortOrder,
            version: { increment: 1 }
          }
        });
        await tx.ingredientFeedback.update({
          where: { id: feedback.id },
          data: {
            status: "ADOPTED",
            reviewNote,
            reviewedAt: now
          }
        });
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INGREDIENT_FEEDBACK_REVIEWED",
            objectType: "INGREDIENT",
            objectId: ingredient.id,
            payload: {
              feedbackId,
              action: body.action,
              name,
              categoryId: category.id,
              reason: reviewNote
            }
          }
        });
        const result = {
          id: feedback.id,
          ingredientId: ingredient.id,
          status: "APPROVED",
          reviewedAt: toIsoDate(now)
        } satisfies AdminReviewIngredientFeedbackResult;
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-feedback:review", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统食材名称已存在，请刷新后重试");
      }
      throw error;
    }
  }

  async reviewPendingRecipe(
    recommendationId: UUID,
    body: AdminReviewPendingRecipeRequest,
    adminId: UUID
  ): Promise<AdminReviewPendingRecipeResult> {
    await this.requireSuperAdmin(adminId);
    const reviewNote = body.reason?.trim() || null;
    const requestHash = JSON.stringify({
      recommendationId,
      action: body.action,
      expectedVersion: body.expectedVersion,
      inspirationCategoryId: body.inspirationCategoryId ?? null,
      reviewNote
    });
    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "recipe_recommendations" WHERE "id" = ${recommendationId} FOR UPDATE`;
        const recommendation = await this.requirePendingRecipeRecommendation(tx, recommendationId);
        const repeated = await getAdminIdempotentResult<AdminReviewPendingRecipeResult>(
          tx,
          body.operationId,
          "admin-pending-recipe:review",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        if (recommendation.version !== body.expectedVersion) {
          throw new ConflictException("推荐记录已更新，请刷新后重试");
        }
        await startAdminIdempotentOperation(tx, body.operationId, "admin-pending-recipe:review", adminId, requestHash);

        const now = new Date();
        if (body.action === "REJECT") {
          await tx.recipeRecommendation.update({
            where: { id: recommendation.id },
            data: {
              status: "REJECTED",
              reviewNote,
              reviewedAt: now,
              version: { increment: 1 }
            }
          });
          await tx.auditEvent.create({
            data: {
              actorType: "ADMIN",
              actorAdminId: adminId,
              action: "RECIPE_RECOMMENDATION_REVIEWED",
              objectType: "RECIPE_RECOMMENDATION",
              objectId: recommendation.id,
              payload: {
                action: body.action,
                recipeId: recommendation.recipeId,
                sourceVersionId: recommendation.sourceVersionId,
                reason: reviewNote
              }
            }
          });
          const result = {
            id: recommendation.id,
            status: "REJECTED",
            reviewedAt: toIsoDate(now),
            targetRecipeId: null
          } satisfies AdminReviewPendingRecipeResult;
          await completeAdminIdempotentOperation(tx, body.operationId, "admin-pending-recipe:review", adminId, requestHash, result);
          return result;
        }

        if (!body.inspirationCategoryId) throw new BadRequestException("请选择系统菜谱分类");
        const inspirationCategory = await this.requireInspirationCategory(tx, body.inspirationCategoryId);
        const sourceContent = versionToContent(recommendation.sourceVersion);
        this.assertAdminRecipeContent(sourceContent);

        const nextVersion = await tx.recipeContentVersion.create({
          data: this.buildAdminRecipeVersionCreateInput(sourceContent, recommendation.recipe.coverImageUrl)
        });
        await replaceAutoRecipeVersionTags(tx, nextVersion.id, sourceContent);

        const created = await tx.recipe.create({
          data: {
            ownerId: null,
            categoryId: null,
            inspirationCategoryId: inspirationCategory.id,
            currentVersionId: nextVersion.id,
            title: sourceContent.name,
            searchText: buildRecipeSearchText(sourceContent),
            coverImageUrl: recommendation.recipe.coverImageUrl,
            curatedByName: recommendation.curatedByName
          }
        });

        await tx.recipeRecommendation.update({
          where: { id: recommendation.id },
          data: {
            status: "ADOPTED",
            suggestedCategoryId: inspirationCategory.id,
            suggestedCategoryName: inspirationCategory.name,
            reviewNote,
            adoptedRecipeId: created.id,
            reviewedAt: now,
            version: { increment: 1 }
          }
        });

        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "RECIPE_RECOMMENDATION_REVIEWED",
            objectType: "RECIPE_RECOMMENDATION",
            objectId: recommendation.id,
            payload: {
              action: body.action,
              recipeId: recommendation.recipeId,
              sourceVersionId: recommendation.sourceVersionId,
              inspirationCategoryId: inspirationCategory.id,
              targetRecipeId: created.id,
              reviewNote
            }
          }
        });

        const result = {
          id: recommendation.id,
          status: "APPROVED",
          reviewedAt: toIsoDate(now),
          targetRecipeId: created.id
        } satisfies AdminReviewPendingRecipeResult;
        await this.medalService.awardRecommendationContribution(tx, recommendation.userId, now);
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-pending-recipe:review", adminId, requestHash, result);
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("当前推荐已被处理或该版本已收录，请刷新后重试");
      }
      throw error;
    }
  }

  async createRecipeImportJob(
    file: { originalname?: string; buffer?: Buffer; size?: number },
    adminId: UUID,
    body: CreateRecipeImportJobRequest
  ): Promise<RecipeImportJobSummary> {
    await this.requireSuperAdmin(adminId);
    if (!file.buffer || !file.originalname || !file.size) {
      throw new BadRequestException("请上传 markdown 或 zip 文件");
    }
    const sourceName = file.originalname;

    const sources = readMarkdownSources(sourceName, file.buffer);
    if (sources.length === 0) {
      throw new BadRequestException("压缩包内未找到 markdown 文件");
    }
    const fileHash = createHash("sha256").update(file.buffer).digest("hex");
    const requestHash = `${body.sourceType}:${body.inspirationCategoryId ?? 0}:${sourceName}:${file.size}:${fileHash}`;
    let jobId: UUID | null = null;
    let startedRecordId: UUID | null = null;

    const repeated = await this.prisma.$transaction(async tx => {
      const result = await getAdminIdempotentResult<RecipeImportJobSummary>(tx, body.operationId, "admin-recipe-import:create", adminId, requestHash);
      if (result) {
        return result;
      }

      const existing = await tx.idempotencyRecord.findFirst({
        where: {
          operationId: body.operationId,
          operationType: "admin-recipe-import:create",
          adminId
        },
        orderBy: { createdAt: "asc" }
      });
      if (existing?.status === "PROCESSING") {
        throw new ConflictException("导入任务创建中，请稍后刷新");
      }
      if (existing?.status === "FAILED") {
        await tx.idempotencyRecord.deleteMany({
          where: {
            operationId: body.operationId,
            operationType: "admin-recipe-import:create",
            adminId,
            status: "FAILED"
          }
        });
      }

      const started = await startAdminIdempotentOperation(tx, body.operationId, "admin-recipe-import:create", adminId, requestHash);
      startedRecordId = started.id;
      const job = await tx.recipeImportJob.create({
        data: {
          sourceType: body.sourceType,
          sourceName,
          status: "RUNNING",
          createdByAdminId: adminId
        }
      });
      jobId = job.id;
      return null;
    });
    if (repeated) {
      return repeated;
    }
    if (!jobId) {
      throw new ConflictException("导入任务创建失败，请重试");
    }

    try {
      const [ingredientRows, unitRows] = await Promise.all([
        this.prisma.ingredient.findMany({
          where: {
            ownerId: null,
            status: "ACTIVE",
            category: {
              is: {
                isSelectable: true
              }
            }
          },
          select: {
            id: true,
            name: true,
            categoryId: true
          }
        }),
        this.prisma.unit.findMany({
          where: { ownerId: null },
          select: {
            id: true,
            name: true
          }
        })
      ]);
      const refs = {
        ingredientByName: buildIngredientRefs(ingredientRows),
        unitByName: buildUnitRefs(unitRows)
      };

      for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index];
        try {
          const parsed = parseMarkdownSource(source, body.inspirationCategoryId, refs);
          const assetState = await writeImportImages(jobId, index + 1, parsed.imageFiles);
          await this.prisma.recipeImportItem.create({
            data: {
              jobId,
              sourcePath: source.sourcePath,
              title: parsed.recipeBody.title.trim() || parsed.parsedBody.titleLine || null,
              status: parsed.errorItems.length > 0 ? "NEEDS_FIX" : "READY",
              rawBodyJson: toJson({
                ...parsed.rawBody,
                assetFolder: assetState.assetFolder,
                images: assetState.images
              }),
              parsedBodyJson: toJson(parsed.parsedBody),
              recipeBodyJson: toJson(parsed.recipeBody),
              errorJson: toJson(parsed.errorItems),
              warnJson: toJson(parsed.warnItems)
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "解析 markdown 失败";
          await this.prisma.recipeImportItem.create({
            data: {
              jobId,
              sourcePath: source.sourcePath,
              title: null,
              status: "FAILED",
              rawBodyJson: toJson({
                sourcePath: source.sourcePath,
                markdown: source.markdown,
                assetFolder: `job-${jobId}/item-${index + 1}`,
                images: []
              }),
              parsedBodyJson: toJson({
                titleLine: null,
                story: null,
                baseServingsText: null,
                difficultyText: null,
                durationText: null,
                caloriesText: null,
                ingredientLines: [],
                stepLines: [],
                tipLines: []
              }),
              recipeBodyJson: toJson({
                inspirationCategoryId: body.inspirationCategoryId,
                title: "",
                story: null,
                baseServings: null,
                difficulty: null,
                duration: null,
                estimatedCalories: null,
                tips: null,
                coverImageKey: null,
                ingredients: [],
                steps: []
              }),
              errorJson: toJson([{ field: null, message }]),
              warnJson: toJson([])
            }
          });
        }
      }

      let result: RecipeImportJobSummary | null = null;
      await this.prisma.$transaction(async tx => {
        await this.writeRecipeImportJobStats(tx, jobId as UUID);
        const nextJob = await tx.recipeImportJob.findUnique({
          where: { id: jobId as UUID }
        });
        if (!nextJob) {
          throw new NotFoundException("导入任务不存在");
        }
        result = this.toRecipeImportJobSummary(nextJob);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "RECIPE_IMPORT_JOB_CREATED",
            objectType: "RECIPE_IMPORT_JOB",
            objectId: jobId,
            payload: {
              sourceName: nextJob.sourceName,
              sourceType: nextJob.sourceType,
              totalCount: sources.length
            }
          }
        });
        await completeAdminIdempotentOperation(
          tx,
          body.operationId,
          "admin-recipe-import:create",
          adminId,
          requestHash,
          result as RecipeImportJobSummary
        );
      });
      if (!result) {
        throw new NotFoundException("导入任务不存在");
      }
      return result;
    } catch (error) {
      await this.prisma.$transaction(async tx => {
        if (jobId) {
          await tx.recipeImportJob.update({
            where: { id: jobId },
            data: {
              status: "FAILED"
            }
          });
        }
        if (startedRecordId) {
          await tx.idempotencyRecord.deleteMany({
            where: {
              id: startedRecordId,
              status: "PROCESSING"
            }
          });
        }
      });
      throw error;
    }
  }

  async listRecipeImportJobs(
    page: number,
    pageSize: number,
    status: string | undefined,
    adminId: UUID
  ): Promise<PageResult<RecipeImportJobSummary>> {
    await this.requireSuperAdmin(adminId);
    const nextPage = toPositiveInt(page, 1);
    const nextPageSize = toPositiveInt(pageSize, 20);
    const skip = (nextPage - 1) * nextPageSize;
    const statusText = status?.trim();
    if (statusText && !["PENDING", "RUNNING", "READY", "FAILED", "COMPLETED"].includes(statusText)) {
      throw new BadRequestException("导入任务状态参数错误");
    }

    const where: Prisma.RecipeImportJobWhereInput = statusText ? { status: statusText as RecipeImportJobRow["status"] } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipeImportJob.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: nextPageSize
      }),
      this.prisma.recipeImportJob.count({ where })
    ]);

    return {
      items: items.map(item => this.toRecipeImportJobSummary(item)),
      page: nextPage,
      pageSize: nextPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async getRecipeImportJobDetail(
    jobId: UUID,
    page: number,
    pageSize: number,
    status: string | undefined,
    adminId: UUID
  ): Promise<RecipeImportJobDetail> {
    await this.requireSuperAdmin(adminId);
    const nextPage = toPositiveInt(page, 1);
    const nextPageSize = toPositiveInt(pageSize, 20);
    const skip = (nextPage - 1) * nextPageSize;
    const statusText = status?.trim();
    if (statusText && !["PENDING_PARSE", "NEEDS_FIX", "READY", "PUBLISHING", "PUBLISHED", "FAILED"].includes(statusText)) {
      throw new BadRequestException("导入条目状态参数错误");
    }

    const job = await this.prisma.recipeImportJob.findUnique({
      where: { id: jobId }
    });
    if (!job) {
      throw new NotFoundException("导入任务不存在");
    }

    const itemWhere: Prisma.RecipeImportItemWhereInput = {
      jobId,
      ...(statusText ? { status: statusText as RecipeImportItemRow["status"] } : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipeImportItem.findMany({
        where: itemWhere,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: nextPageSize
      }),
      this.prisma.recipeImportItem.count({ where: itemWhere })
    ]);

    return {
      ...this.toRecipeImportJobSummary(job),
      items: {
        items: items.map(item => this.toRecipeImportItemSummary(item)),
        page: nextPage,
        pageSize: nextPageSize,
        total,
        hasNext: skip + items.length < total
      }
    };
  }

  async getRecipeImportItemDetail(itemId: UUID, adminId: UUID): Promise<RecipeImportItemDetail> {
    await this.requireSuperAdmin(adminId);
    const item = await this.prisma.recipeImportItem.findUnique({
      where: { id: itemId }
    });
    if (!item) {
      throw new NotFoundException("导入条目不存在");
    }
    return this.buildRecipeImportItemDetail(item);
  }

  async updateRecipeImportItem(
    itemId: UUID,
    adminId: UUID,
    body: UpdateRecipeImportItemRequest
  ): Promise<RecipeImportItemDetail> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify({
      itemId,
      expectedVersion: body.expectedVersion,
      recipeBody: body.recipeBody
    });

    const nextItemId = await this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<RecipeImportItemSummary>(tx, body.operationId, "admin-recipe-import:update", adminId, requestHash);
      if (repeated) {
        return repeated.id;
      }
      await startAdminIdempotentOperation(tx, body.operationId, "admin-recipe-import:update", adminId, requestHash);

      const currentItem = await tx.recipeImportItem.findUnique({
        where: { id: itemId }
      });
      if (!currentItem) {
        throw new NotFoundException("导入条目不存在");
      }
      if (currentItem.version !== body.expectedVersion) {
        throw new ConflictException("导入条目已被更新，请刷新后重试");
      }

      const rawBody = fromJson<RecipeImportRawBody>(currentItem.rawBodyJson);
      const nextRecipeBody = await this.prepareRecipeImportBody(tx, body.recipeBody);
      const nextState = await this.buildRecipeImportItemState(tx, nextRecipeBody, rawBody.images);
      const updateResult = await tx.recipeImportItem.updateMany({
        where: { id: itemId, version: body.expectedVersion },
        data: {
          title: nextRecipeBody.title.trim() || null,
          status: nextState.errorItems.length > 0 ? "NEEDS_FIX" : "READY",
          recipeBodyJson: toJson(nextRecipeBody),
          errorJson: toJson(nextState.errorItems),
          warnJson: toJson(nextState.warnItems),
          version: { increment: 1 }
        }
      });
      if (updateResult.count !== 1) {
        throw new ConflictException("导入条目已被更新，请刷新后重试");
      }
      const updated = await tx.recipeImportItem.findUnique({
        where: { id: itemId }
      });
      if (!updated) {
        throw new NotFoundException("导入条目不存在");
      }
      await this.writeRecipeImportJobStats(tx, updated.jobId);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_IMPORT_ITEM_UPDATED",
          objectType: "RECIPE_IMPORT_ITEM",
          objectId: updated.id,
          payload: {
            jobId: updated.jobId,
            status: updated.status
          }
        }
      });
      await completeAdminIdempotentOperation(
        tx,
        body.operationId,
        "admin-recipe-import:update",
        adminId,
        requestHash,
        this.toRecipeImportItemSummary(updated)
      );
      return updated.id;
    });

    const nextItem = await this.prisma.recipeImportItem.findUnique({
      where: { id: nextItemId }
    });
    if (!nextItem) {
      throw new NotFoundException("导入条目不存在");
    }
    return this.buildRecipeImportItemDetail(nextItem);
  }

  async publishRecipeImportItem(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    itemId: UUID,
    adminId: UUID,
    body: PublishRecipeImportItemRequest
  ): Promise<RecipeImportItemDetail> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${itemId}:${body.expectedVersion}`;
    const publishedStorageKeys: string[] = [];
    const tempImageKeys: string[] = [];

    try {
      const nextItemId = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<RecipeImportItemSummary>(tx, body.operationId, "admin-recipe-import:publish", adminId, requestHash);
        if (repeated) {
          return repeated.id;
        }
        await startAdminIdempotentOperation(tx, body.operationId, "admin-recipe-import:publish", adminId, requestHash);

        const currentItem = await tx.recipeImportItem.findUnique({
          where: { id: itemId }
        });
        if (!currentItem) {
          throw new NotFoundException("导入条目不存在");
        }
        if (currentItem.version !== body.expectedVersion) {
          throw new ConflictException("导入条目已被更新，请刷新后重试");
        }
        if (currentItem.status === "PUBLISHED" && currentItem.recipeId) {
          throw new ConflictException("该导入条目已发布");
        }

        const rawBody = fromJson<RecipeImportRawBody>(currentItem.rawBodyJson);
        const recipeBody = fromJson<RecipeImportRecipeBody>(currentItem.recipeBodyJson);
        const nextState = await this.buildRecipeImportItemState(tx, recipeBody, rawBody.images);
        if (nextState.errorItems.length > 0) {
          throw new BadRequestException("导入条目还有未补全字段，请先保存修正");
        }
        if (!recipeBody.inspirationCategoryId) {
          throw new BadRequestException("请选择系统菜谱分类");
        }

        const imageMap = new Map(rawBody.images.map(image => [image.key, image]));
        let coverImageUrl: string | null = null;
        if (recipeBody.coverImageTempKey) {
          const published = await this.adminRecipeImageService.publishTempImage(request, "COVER", recipeBody.coverImageTempKey);
          tempImageKeys.push(recipeBody.coverImageTempKey);
          publishedStorageKeys.push(published.storageKey);
          coverImageUrl = published.imageUrl;
        } else if (recipeBody.coverImageKey) {
          const image = imageMap.get(recipeBody.coverImageKey);
          if (!image) {
            throw new BadRequestException("封面图片不存在");
          }
          const buffer = await readImageBuffer(rawBody.assetFolder, image.fileName);
          const published = await this.adminRecipeImageService.publishImageBuffer(request, "COVER", buffer);
          publishedStorageKeys.push(published.storageKey);
          coverImageUrl = published.imageUrl;
        }

        const stepImageUrls: Array<string | null> = [];
        for (const step of recipeBody.steps) {
          if (step.imageTempKey) {
            const published = await this.adminRecipeImageService.publishTempImage(request, "STEP", step.imageTempKey);
            tempImageKeys.push(step.imageTempKey);
            publishedStorageKeys.push(published.storageKey);
            stepImageUrls.push(published.imageUrl);
            continue;
          }
          if (!step.imageKey) {
            stepImageUrls.push(null);
            continue;
          }
          const image = imageMap.get(step.imageKey);
          if (!image) {
            throw new BadRequestException("步骤图片不存在");
          }
          const buffer = await readImageBuffer(rawBody.assetFolder, image.fileName);
          const published = await this.adminRecipeImageService.publishImageBuffer(request, "STEP", buffer);
          publishedStorageKeys.push(published.storageKey);
          stepImageUrls.push(published.imageUrl);
        }

        const contentInput: AdminRecipeContentInput = {
          name: recipeBody.title.trim(),
          story: recipeBody.story,
          baseServings: recipeBody.baseServings as number,
          difficulty: recipeBody.difficulty as AdminRecipeContentInput["difficulty"],
          duration: recipeBody.duration as AdminRecipeContentInput["duration"],
          estimatedCalories: recipeBody.estimatedCalories,
          tips: recipeBody.tips,
          ingredients: recipeBody.ingredients.map(item => ({
            ingredientId: item.ingredientId as number,
            amount: item.fuzzyText
              ? {
                  kind: "FUZZY",
                  text: item.fuzzyText
                }
              : {
                  kind: "EXACT",
                  quantity: item.quantity ?? "",
                  unitId: item.unitId as number
                }
          })),
          steps: recipeBody.steps.map((step, index) => ({
            text: step.text,
            imageUrl: stepImageUrls[index] ?? null,
            imageTempKey: null
          }))
        };

        const inspirationCategory = await this.requireInspirationCategory(tx, recipeBody.inspirationCategoryId);
        const content = await this.buildAdminRecipeContent(tx, contentInput, stepImageUrls);
        this.assertAdminRecipeContent(content);

        const nextVersion = await tx.recipeContentVersion.create({
          data: this.buildAdminRecipeVersionCreateInput(content, coverImageUrl)
        });
        await replaceAutoRecipeVersionTags(tx, nextVersion.id, content);
        const recipe = await tx.recipe.create({
          data: {
            ownerId: null,
            categoryId: null,
            inspirationCategoryId: inspirationCategory.id,
            currentVersionId: nextVersion.id,
            title: content.name,
            searchText: buildRecipeSearchText(content),
            coverImageUrl
          }
        });
        const updateResult = await tx.recipeImportItem.updateMany({
          where: { id: itemId, version: body.expectedVersion },
          data: {
            status: "PUBLISHED",
            recipeId: recipe.id,
            errorJson: toJson(nextState.errorItems),
            warnJson: toJson(nextState.warnItems),
            version: { increment: 1 }
          }
        });
        if (updateResult.count !== 1) {
          throw new ConflictException("导入条目已被更新，请刷新后重试");
        }
        const updated = await tx.recipeImportItem.findUnique({
          where: { id: itemId }
        });
        if (!updated) {
          throw new NotFoundException("导入条目不存在");
        }
        await this.writeRecipeImportJobStats(tx, updated.jobId);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "RECIPE_IMPORT_ITEM_PUBLISHED",
            objectType: "RECIPE_IMPORT_ITEM",
            objectId: updated.id,
            payload: {
              jobId: updated.jobId,
              recipeId: recipe.id,
              contentVersionId: nextVersion.id
            }
          }
        });
        await completeAdminIdempotentOperation(
          tx,
          body.operationId,
          "admin-recipe-import:publish",
          adminId,
          requestHash,
          this.toRecipeImportItemSummary(updated)
        );
        return updated.id;
      });

      const nextItem = await this.prisma.recipeImportItem.findUnique({
        where: { id: nextItemId }
      });
      if (!nextItem) {
        throw new NotFoundException("导入条目不存在");
      }
      return this.buildRecipeImportItemDetail(nextItem);
    } catch (error) {
      await this.adminRecipeImageService.removePublishedImages(publishedStorageKeys);
      throw error;
    } finally {
      await this.adminRecipeImageService.discardTempImages(tempImageKeys);
    }
  }

  async listRecipes(
    page: number,
    pageSize: number,
    keyword?: string,
    status?: string,
    categoryId?: UUID,
    adminId?: UUID
  ): Promise<PageResult<AdminRecipeSummary>> {
    if (!adminId) throw new ForbiddenException("无权执行该操作");
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedStatus = status?.trim();

    if (normalizedStatus && !["ACTIVE", "RECYCLED", "BLOCKED", "DELETED"].includes(normalizedStatus)) {
      throw new BadRequestException("系统菜谱状态参数错误");
    }

    const where: Prisma.RecipeWhereInput = {
      ownerId: null,
      inspirationCategoryId: {
        ...(categoryId ? { equals: categoryId } : { not: null })
      },
      ...(keyword
        ? {
            searchText: {
              contains: buildSearchKey(keyword)
            }
          }
        : {}),
      ...(normalizedStatus ? { status: normalizedStatus as RecipeStatus } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        include: {
          owner: {
            select: { uid: true }
          },
          inspirationCategory: true
        },
        orderBy: [{ updatedAt: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipe.count({ where })
    ]);

    return {
      items: items.map(recipe => this.toAdminRecipeSummary(recipe)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async createRecipe(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    adminId: UUID,
    body: CreateAdminRecipeRequest
  ): Promise<AdminRecipeDetail> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify({
      inspirationCategoryId: body.inspirationCategoryId,
      coverImageUrl: body.coverImageUrl,
      coverImageTempKey: body.coverImageTempKey,
      content: body.content
    });

    const publishedStorageKeys: string[] = [];
    const consumedTempKeys = new Set<string>();
    try {
      const result = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminRecipeDetail>(tx, body.operationId, "admin-recipe:create", adminId, requestHash);
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-recipe:create", adminId, requestHash);

        const inspirationCategory = await this.requireInspirationCategory(tx, body.inspirationCategoryId);
        const imageState = await this.buildAdminRecipeImageState(
          request,
          body.coverImageUrl,
          body.coverImageTempKey,
          body.content,
          null,
          publishedStorageKeys,
          consumedTempKeys
        );
        const content = await this.buildAdminRecipeContent(tx, body.content, imageState.stepImageUrls);
        this.assertAdminRecipeContent(content);

        const nextVersion = await tx.recipeContentVersion.create({
          data: this.buildAdminRecipeVersionCreateInput(content, imageState.coverImageUrl)
        });
        await replaceAutoRecipeVersionTags(tx, nextVersion.id, content);

        const created = await tx.recipe.create({
          data: {
            ownerId: null,
            categoryId: null,
            inspirationCategoryId: inspirationCategory.id,
            currentVersionId: nextVersion.id,
            title: content.name,
            searchText: buildRecipeSearchText(content),
            coverImageUrl: imageState.coverImageUrl
          },
          include: {
            owner: {
              select: { uid: true }
            },
            category: true,
            inspirationCategory: true,
            currentVersion: true
          }
        });

        const result = this.toAdminRecipeDetail(created);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "RECIPE_CREATED",
            objectType: "RECIPE",
            objectId: created.id,
            payload: {
              source: "SYSTEM",
              inspirationCategoryId: inspirationCategory.id,
              contentVersionId: nextVersion.id
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-recipe:create", adminId, requestHash, result);
        return result;
      });
      return result;
    } catch (error) {
      await this.adminRecipeImageService.removePublishedImages(publishedStorageKeys);
      throw error;
    } finally {
      await this.adminRecipeImageService.discardTempImages(consumedTempKeys);
    }
  }

  async listInspirationCategories(keyword: string | undefined, adminId: UUID): Promise<AdminInspirationCategorySummary[]> {
    await this.requireSuperAdmin(adminId);
    const normalizedKeyword = keyword?.trim();
    const where: Prisma.InspirationCategoryWhereInput = normalizedKeyword
      ? {
          name: {
            contains: normalizedKeyword,
            mode: "insensitive"
          }
        }
      : {};
    const categories = await this.prisma.inspirationCategory.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    if (!categories.length) return [];

    const counts = await this.prisma.recipe.groupBy({
      by: ["inspirationCategoryId"],
      where: {
        ownerId: null,
        inspirationCategoryId: {
          in: categories.map(item => item.id)
        }
      },
      _count: {
        _all: true
      }
    });
    const countMap = new Map(counts.map(item => [item.inspirationCategoryId ?? 0, item._count._all]));
    return categories.map(category => toAdminInspirationCategorySummary(category, countMap.get(category.id) ?? 0));
  }

  async createInspirationCategory(body: AdminInspirationCategoryPayloadRequest, adminId: UUID): Promise<AdminInspirationCategorySummary> {
    await this.requireSuperAdmin(adminId);
    const name = body.name.trim();
    const requestHash = name;
    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminInspirationCategorySummary>(
          tx,
          body.operationId,
          "admin-inspiration-category:create",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-inspiration-category:create", adminId, requestHash);
        await this.assertInspirationCategoryNameAvailable(tx, name, null);
        const sortOrder = await this.nextInspirationCategorySortOrder(tx);
        const category = await tx.inspirationCategory.create({
          data: {
            name,
            iconKey: null,
            sortOrder
          }
        });
        const result = toAdminInspirationCategorySummary(category, 0);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INSPIRATION_CATEGORY_CREATED",
            objectType: "INSPIRATION_CATEGORY",
            objectId: category.id,
            payload: { name }
          }
        });
        await completeAdminIdempotentOperation(
          tx,
          body.operationId,
          "admin-inspiration-category:create",
          adminId,
          requestHash,
          result
        );
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统菜谱分类名称已存在，请刷新后重试");
      }
      throw error;
    }
  }

  async updateInspirationCategory(
    categoryId: UUID,
    body: UpdateAdminInspirationCategoryRequest,
    adminId: UUID
  ): Promise<AdminInspirationCategorySummary> {
    await this.requireSuperAdmin(adminId);
    const name = body.name.trim();
    const requestHash = `${categoryId}:${body.expectedVersion}:${name}`;
    try {
      return await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminInspirationCategorySummary>(
          tx,
          body.operationId,
          "admin-inspiration-category:update",
          adminId,
          requestHash
        );
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-inspiration-category:update", adminId, requestHash);

        const category = await this.requireInspirationCategory(tx, categoryId);
        if (category.version !== body.expectedVersion) throw new ConflictException("系统菜谱分类已被更新，请刷新后重试");
        await this.assertInspirationCategoryNameAvailable(tx, name, categoryId);

        const updated = await tx.inspirationCategory.update({
          where: { id: categoryId },
          data: {
            name,
            version: { increment: 1 }
          }
        });
        const recipeCount = await tx.recipe.count({
          where: {
            ownerId: null,
            inspirationCategoryId: categoryId
          }
        });
        const result = toAdminInspirationCategorySummary(updated, recipeCount);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "INSPIRATION_CATEGORY_UPDATED",
            objectType: "INSPIRATION_CATEGORY",
            objectId: categoryId,
            payload: { name }
          }
        });
        await completeAdminIdempotentOperation(
          tx,
          body.operationId,
          "admin-inspiration-category:update",
          adminId,
          requestHash,
          result
        );
        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("系统菜谱分类名称已存在，请刷新后重试");
      }
      throw error;
    }
  }

  async reorderInspirationCategories(
    operationId: OperationId,
    items: ReorderItem[],
    adminId: UUID
  ): Promise<AdminInspirationCategorySummary[]> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify(items);
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminInspirationCategorySummary[]>(
        tx,
        operationId,
        "admin-inspiration-category:reorder",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-inspiration-category:reorder", adminId, requestHash);

      const all = await tx.inspirationCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      });
      this.assertReorderScope(all, items, "系统菜谱分类");
      await this.writeInspirationCategorySortOrder(tx, items.map(item => item.id));

      const [updated, counts] = await Promise.all([
        tx.inspirationCategory.findMany({
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }),
        tx.recipe.groupBy({
          by: ["inspirationCategoryId"],
          where: {
            ownerId: null,
            inspirationCategoryId: {
              in: items.map(item => item.id)
            }
          },
          _count: { _all: true }
        })
      ]);
      const countMap = new Map(counts.map(item => [item.inspirationCategoryId ?? 0, item._count._all]));
      const result = updated.map(category => toAdminInspirationCategorySummary(category, countMap.get(category.id) ?? 0));
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INSPIRATION_CATEGORY_REORDERED",
          objectType: "INSPIRATION_CATEGORY",
          objectId: updated[0]?.id ?? null,
          payload: { ids: items.map(item => item.id) }
        }
      });
      await completeAdminIdempotentOperation(
        tx,
        operationId,
        "admin-inspiration-category:reorder",
        adminId,
        requestHash,
        result
      );
      return result;
    });
  }

  async getRecipeDetail(recipeId: UUID, adminId: UUID): Promise<AdminRecipeDetail> {
    await this.requireSuperAdmin(adminId);
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        owner: {
          select: { uid: true }
        },
        category: true,
        inspirationCategory: true,
        currentVersion: true
      }
    });
    if (!recipe) throw new NotFoundException("菜谱不存在");
    return this.toAdminRecipeDetail(recipe);
  }

  async listRecipeReports(page: number, pageSize: number, status: string | undefined, adminId: UUID): Promise<PageResult<RecipeReportSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedStatus = status?.trim();
    if (normalizedStatus && !["OPEN", "RESOLVED"].includes(normalizedStatus)) {
      throw new BadRequestException("举报状态参数错误");
    }

    const where: Prisma.RecipeReportWhereInput = normalizedStatus ? { status: normalizedStatus as "OPEN" | "RESOLVED" } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipeReport.findMany({
        where,
        include: {
          reporter: {
            select: { uid: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipeReport.count({ where })
    ]);

    return {
      items: items.map(report => ({
        id: report.id,
        recipeId: report.recipeId,
        reporterUid: report.reporter.uid,
        reason: report.reason,
        status: report.status,
        createdAt: toIsoDate(report.createdAt)
      })),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async updateRecipe(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    recipeId: UUID,
    adminId: UUID,
    body: UpdateAdminRecipeRequest
  ): Promise<AdminRecipeDetail> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify({
      recipeId,
      expectedVersion: body.expectedVersion,
      inspirationCategoryId: body.inspirationCategoryId,
      coverImageUrl: body.coverImageUrl,
      coverImageTempKey: body.coverImageTempKey,
      content: body.content
    });

    const publishedStorageKeys: string[] = [];
    const consumedTempKeys = new Set<string>();
    try {
      const result = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminRecipeDetail>(tx, body.operationId, "admin-recipe:update", adminId, requestHash);
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-recipe:update", adminId, requestHash);

        const recipe = await tx.recipe.findUnique({
          where: { id: recipeId },
          include: {
            owner: {
              select: { uid: true }
            },
            category: true,
            inspirationCategory: true,
            currentVersion: true
          }
        });
        if (!recipe || recipe.ownerId !== null || !recipe.inspirationCategoryId) {
          throw new NotFoundException("系统菜谱不存在");
        }
        if (recipe.status === "DELETED") {
          throw new ConflictException("已删除菜谱不支持编辑");
        }
        if (recipe.version !== body.expectedVersion) {
          throw new ConflictException("菜谱版本已更新，请刷新后重试");
        }

        const inspirationCategory = await this.requireInspirationCategory(tx, body.inspirationCategoryId);
        const imageState = await this.buildAdminRecipeImageState(
          request,
          body.coverImageUrl,
          body.coverImageTempKey,
          body.content,
          recipe,
          publishedStorageKeys,
          consumedTempKeys
        );
        const content = await this.buildAdminRecipeContent(tx, body.content, imageState.stepImageUrls);
        this.assertAdminRecipeContent(content);

        const nextVersion = await tx.recipeContentVersion.create({
          data: this.buildAdminRecipeVersionCreateInput(content, imageState.coverImageUrl)
        });
        await replaceAutoRecipeVersionTags(tx, nextVersion.id, content);

        const updated = await tx.recipe.update({
          where: { id: recipeId },
          data: {
            currentVersionId: nextVersion.id,
            title: content.name,
            searchText: buildRecipeSearchText(content),
            inspirationCategoryId: inspirationCategory.id,
            coverImageUrl: imageState.coverImageUrl,
            version: { increment: 1 }
          },
          include: {
            owner: {
              select: { uid: true }
            },
            category: true,
            inspirationCategory: true,
            currentVersion: true
          }
        });

        const result = this.toAdminRecipeDetail(updated);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "RECIPE_UPDATED",
            objectType: "RECIPE",
            objectId: recipeId,
            payload: {
              previousVersionId: recipe.currentVersionId,
              nextVersionId: nextVersion.id,
              inspirationCategoryId: inspirationCategory.id
            }
          }
        });
        await completeAdminIdempotentOperation(tx, body.operationId, "admin-recipe:update", adminId, requestHash, result);
        return result;
      });
      return result;
    } catch (error) {
      await this.adminRecipeImageService.removePublishedImages(publishedStorageKeys);
      throw error;
    } finally {
      await this.adminRecipeImageService.discardTempImages(consumedTempKeys);
    }
  }

  async blockRecipe(recipeId: UUID, adminId: UUID, operationId: OperationId, reason: string) {
    await this.requireSuperAdmin(adminId);
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new BadRequestException("下架原因不能为空");
    const requestHash = `${recipeId}:${normalizedReason}`;

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminRecipeSummary>(
        tx,
        operationId,
        "admin-recipe:block",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe:block", adminId, requestHash);

      const changed = await tx.recipe.updateMany({
        where: { id: recipeId, ownerId: null, inspirationCategoryId: { not: null }, status: "ACTIVE" },
        data: {
          status: "BLOCKED",
          blockedReason: normalizedReason,
          blockedAt: new Date()
        }
      });
      if (changed.count === 0) throw new ConflictException("只有正常系统菜谱可以下架");
      const recipe = await tx.recipe.findUniqueOrThrow({
        where: { id: recipeId },
        include: {
          owner: { select: { uid: true } },
          inspirationCategory: true
        }
      });
      const result = this.toAdminRecipeSummary(recipe);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_BLOCKED",
          objectType: "RECIPE",
          objectId: recipeId,
          payload: { reason: normalizedReason }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe:block", adminId, requestHash, result);
      return result;
    });
  }

  async unblockRecipe(recipeId: UUID, adminId: UUID, operationId: OperationId) {
    await this.requireSuperAdmin(adminId);
    const requestHash = String(recipeId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminRecipeSummary>(
        tx,
        operationId,
        "admin-recipe:unblock",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe:unblock", adminId, requestHash);

      const changed = await tx.recipe.updateMany({
        where: { id: recipeId, ownerId: null, inspirationCategoryId: { not: null }, status: "BLOCKED" },
        data: {
          status: "ACTIVE",
          blockedReason: null,
          blockedAt: null
        }
      });
      if (changed.count === 0) throw new ConflictException("只有已下架系统菜谱可以恢复");
      const recipe = await tx.recipe.findUniqueOrThrow({
        where: { id: recipeId },
        include: {
          owner: { select: { uid: true } },
          inspirationCategory: true
        }
      });
      const result = this.toAdminRecipeSummary(recipe);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_UNBLOCKED",
          objectType: "RECIPE",
          objectId: recipeId,
          payload: {}
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe:unblock", adminId, requestHash, result);
      return result;
    });
  }

  async resolveRecipeReport(reportId: UUID, adminId: UUID, operationId: OperationId, resolutionNote?: string | null) {
    await this.requireSuperAdmin(adminId);
    const note = resolutionNote?.trim() || null;
    const requestHash = `${reportId}:${note ?? ""}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<RecipeReportSummary>(
        tx,
        operationId,
        "admin-recipe-report:resolve",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe-report:resolve", adminId, requestHash);

      const changed = await tx.recipeReport.updateMany({
        where: { id: reportId, status: "OPEN" },
        data: {
          status: "RESOLVED",
          resolutionNote: note,
          resolvedAt: new Date()
        }
      });
      if (changed.count === 0) throw new ConflictException("只有待处理举报可以处理");
      const report = await tx.recipeReport.findUniqueOrThrow({
        where: { id: reportId },
        include: { reporter: { select: { uid: true } } }
      });
      const result = {
        id: report.id,
        recipeId: report.recipeId,
        reporterUid: report.reporter.uid,
        reason: report.reason,
        status: report.status,
        createdAt: toIsoDate(report.createdAt)
      } satisfies RecipeReportSummary;
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_REPORT_RESOLVED",
          objectType: "RECIPE_REPORT",
          objectId: reportId,
          payload: { recipeId: report.recipeId, resolutionNote: note }
        }
      });
      await completeAdminIdempotentOperation(
        tx,
        operationId,
        "admin-recipe-report:resolve",
        adminId,
        requestHash,
        result
      );
      return result;
    });
  }

  private toAdminRecipeSummary(recipe: {
    id: UUID;
    title: string;
    coverImageUrl: string | null;
    status: RecipeStatus;
    inspirationCategoryId: UUID | null;
    inspirationCategory?: { id: UUID; name: string } | null;
    updatedAt: Date;
    owner?: { uid: number } | null;
  }): AdminRecipeSummary {
    if (!recipe.inspirationCategoryId || !recipe.inspirationCategory) {
      throw new NotFoundException("系统菜谱分类不存在");
    }
    return {
      id: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      status: recipe.status,
      inspirationCategoryId: recipe.inspirationCategoryId,
      inspirationCategoryName: recipe.inspirationCategory.name,
      updatedAt: toIsoDate(recipe.updatedAt),
      ownerUid: recipe.owner?.uid ?? null
    };
  }

  private toAdminRecipeDetail(recipe: AdminRecipeRow): AdminRecipeDetail {
    const content = versionToContent(recipe.currentVersion);
    return {
      id: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      status: recipe.status,
      ownerUid: recipe.owner?.uid ?? null,
      personalCategory: recipe.category ? toRecipeCategorySummary(recipe.category) : null,
      inspirationCategory: recipe.inspirationCategory ? toInspirationCategorySummary(recipe.inspirationCategory) : null,
      difficultyText: recipeDifficultyText(content.difficulty),
      durationText: recipeDurationText(content.duration),
      contentVersionId: recipe.currentVersionId,
      content,
      version: recipe.version,
      reportCount: recipe.reportCount,
      blockedReason: recipe.blockedReason,
      likeCount: recipe.likeCount,
      collectCount: recipe.collectCount,
      canEdit: isAdminEditableInspiration(recipe),
      createdAt: toIsoDate(recipe.createdAt),
      updatedAt: toIsoDate(recipe.updatedAt)
    };
  }

  private toRecipeImportJobSummary(job: RecipeImportJobRow): RecipeImportJobSummary {
    return {
      id: job.id,
      sourceType: job.sourceType,
      sourceName: job.sourceName,
      status: job.status,
      totalCount: job.totalCount,
      readyCount: job.readyCount,
      needsFixCount: job.needsFixCount,
      failedCount: job.failedCount,
      createdByAdminId: job.createdByAdminId,
      createdAt: toIsoDate(job.createdAt),
      updatedAt: toIsoDate(job.updatedAt)
    };
  }

  private toRecipeImportItemSummary(item: RecipeImportItemRow): RecipeImportItemSummary {
    const errorItems = fromJson<RecipeImportIssue[]>(item.errorJson);
    const warnItems = fromJson<RecipeImportIssue[]>(item.warnJson);
    return {
      id: item.id,
      jobId: item.jobId,
      sourcePath: item.sourcePath,
      title: item.title,
      status: item.status,
      errorCount: errorItems.length,
      warnCount: warnItems.length,
      recipeId: item.recipeId,
      version: item.version,
      createdAt: toIsoDate(item.createdAt),
      updatedAt: toIsoDate(item.updatedAt)
    };
  }

  private async buildRecipeImportItemDetail(item: RecipeImportItemRow): Promise<RecipeImportItemDetail> {
    const rawBody = fromJson<RecipeImportRawBody>(item.rawBodyJson);
    const parsedBody = fromJson<RecipeImportParsedBody>(item.parsedBodyJson);
    const recipeBody = fromJson<RecipeImportRecipeBody>(item.recipeBodyJson);
    const errorItems = fromJson<RecipeImportIssue[]>(item.errorJson);
    const warnItems = fromJson<RecipeImportIssue[]>(item.warnJson);
    const sourceImages = await Promise.all(
      readSourceImages(rawBody).map(async image => ({
        ...image,
        dataUrl: await readImageDataUrl(rawBody.assetFolder, image.fileName)
      }))
    );

    return {
      id: item.id,
      jobId: item.jobId,
      sourcePath: item.sourcePath,
      title: item.title,
      status: item.status,
      rawBody,
      parsedBody,
      recipeBody,
      errorItems,
      warnItems,
      sourceImages,
      recipeId: item.recipeId,
      version: item.version,
      createdAt: toIsoDate(item.createdAt),
      updatedAt: toIsoDate(item.updatedAt)
    };
  }

  private async prepareRecipeImportBody(tx: Prisma.TransactionClient, body: RecipeImportRecipeBody): Promise<RecipeImportRecipeBody> {
    const nextBody: RecipeImportRecipeBody = {
      inspirationCategoryId: body.inspirationCategoryId ?? null,
      title: body.title.trim(),
      story: body.story?.trim() || null,
      baseServings: body.baseServings ?? 1,
      difficulty: body.difficulty ?? null,
      duration: body.duration ?? null,
      estimatedCalories: body.estimatedCalories ?? null,
      tips: body.tips?.trim() || null,
      coverImageKey: body.coverImageKey?.trim() || null,
      coverImageTempKey: body.coverImageTempKey?.trim() || null,
      ingredients: body.ingredients.map(item => ({
        line: item.line.trim(),
        ingredientName: item.ingredientName.trim(),
        ingredientId: item.ingredientId ?? null,
        quantity: item.quantity?.trim() || null,
        unitText: item.unitText?.trim() || null,
        unitId: item.unitId ?? null,
        fuzzyText: item.fuzzyText ?? null,
        note: item.note?.trim() || null
      })),
      steps: body.steps.map(item => ({
        text: item.text.trim(),
        imageKey: item.imageKey?.trim() || null,
        imageTempKey: item.imageTempKey?.trim() || null
      }))
    };
    nextBody.ingredients = await this.materializeImportIngredients(tx, nextBody.ingredients);
    return nextBody;
  }

  private async buildRecipeImportItemState(
    tx: Prisma.TransactionClient,
    recipeBody: RecipeImportRecipeBody,
    images: RecipeImportImageSummary[]
  ) {
    const nextState = rebuildItemState(recipeBody, images);
    const ingredientIds = Array.from(new Set(recipeBody.ingredients.map(item => item.ingredientId).filter((value): value is UUID => value !== null)));
    if (!ingredientIds.length) {
      return nextState;
    }
    const ingredientRows = await tx.ingredient.findMany({
      where: {
        id: { in: ingredientIds },
        ownerId: null,
        status: {
          in: ["ACTIVE", "DISABLED"]
        }
      },
      include: {
        category: true
      }
    });
    const ingredientMap = new Map(ingredientRows.map(item => [item.id, item]));
    recipeBody.ingredients.forEach((item, index) => {
      if (!item.ingredientId) return;
      const ingredient = ingredientMap.get(item.ingredientId);
      const rowLabel = `ingredients.${index}.ingredientId`;
      if (!ingredient || ingredient.status !== "ACTIVE") {
        nextState.errorItems.push({ field: rowLabel, message: `第 ${index + 1} 行食材不存在或已下架` });
        return;
      }
      if (!ingredient.category.isSelectable) {
        nextState.errorItems.push({ field: rowLabel, message: `第 ${index + 1} 行食材仍在待归类，请先到食材管理完成归类` });
      }
    });
    return nextState;
  }

  private async materializeImportIngredients(
    tx: Prisma.TransactionClient,
    ingredients: RecipeImportRecipeBody["ingredients"]
  ): Promise<RecipeImportRecipeBody["ingredients"]> {
    const unclassifiedCategory = await this.requireImportIngredientCategory(tx);
    const nextRows: RecipeImportRecipeBody["ingredients"] = [];
    for (const item of ingredients) {
      if (item.ingredientId || item.fuzzyText || !item.unitId || !item.ingredientName.trim()) {
        nextRows.push(item);
        continue;
      }
      const searchKey = buildSearchKey(item.ingredientName);
      const existing = await tx.ingredient.findFirst({
        where: {
          ownerId: null,
          status: {
            in: ["ACTIVE", "DISABLED"]
          },
          searchKey
        },
        include: {
          category: true
        }
      });
      if (existing) {
        const activeIngredient =
          existing.status === "ACTIVE"
            ? existing
            : await tx.ingredient.update({
                where: { id: existing.id },
                data: {
                  status: "ACTIVE",
                  systemSortOrder: existing.systemSortOrder ?? (await this.nextSystemIngredientSortOrder(tx, existing.categoryId)),
                  displaySortOrder: existing.displaySortOrder ?? (await this.nextSystemIngredientDisplaySortOrder(tx))
                },
                include: {
                  category: true
                }
              });
        nextRows.push({
          ...item,
          ingredientId: activeIngredient.id,
          ingredientName: activeIngredient.name
        });
        continue;
      }
      const unit = await this.requireSystemUnit(tx, item.unitId);
      const created = await tx.ingredient.create({
        data: {
          ownerId: null,
          status: "ACTIVE",
          categoryId: unclassifiedCategory.id,
          defaultUnitId: unit.id,
          name: item.ingredientName,
          searchKey,
          systemSortOrder: await this.nextSystemIngredientSortOrder(tx, unclassifiedCategory.id),
          displaySortOrder: await this.nextSystemIngredientDisplaySortOrder(tx)
        }
      });
      nextRows.push({
        ...item,
        ingredientId: created.id,
        ingredientName: created.name,
        unitText: unit.name
      });
    }
    return nextRows;
  }

  private async writeRecipeImportJobStats(tx: Prisma.TransactionClient, jobId: UUID) {
    const rows = await tx.recipeImportItem.groupBy({
      by: ["status"],
      where: { jobId },
      _count: {
        _all: true
      }
    });
    const countMap = new Map(rows.map(item => [item.status, item._count._all]));
    const totalCount = Array.from(countMap.values()).reduce((sum, count) => sum + count, 0);
    const readyCount = countMap.get("READY") ?? 0;
    const needsFixCount = countMap.get("NEEDS_FIX") ?? 0;
    const failedCount = countMap.get("FAILED") ?? 0;
    const runningCount = (countMap.get("PENDING_PARSE") ?? 0) + (countMap.get("PUBLISHING") ?? 0);
    const publishedCount = countMap.get("PUBLISHED") ?? 0;

    let status: RecipeImportJobRow["status"] = "READY";
    if (totalCount === 0 || failedCount === totalCount) {
      status = "FAILED";
    } else if (runningCount > 0) {
      status = "RUNNING";
    } else if (readyCount === 0 && needsFixCount === 0 && publishedCount + failedCount === totalCount) {
      status = "COMPLETED";
    }

    await tx.recipeImportJob.update({
      where: { id: jobId },
      data: {
        status,
        totalCount,
        readyCount,
        needsFixCount,
        failedCount
      }
    });
  }

  private assertAdminRecipeContent(content: RecipeContentSnapshot) {
    if (!content.name.trim()) throw new BadRequestException("菜谱名称不能为空");
    if (content.baseServings < 1 || content.baseServings > 20) {
      throw new BadRequestException("基准人数必须为 1 到 20");
    }
    if (content.ingredients.length === 0) throw new BadRequestException("至少需要一个食材");
    if (!content.steps.some(item => item.text.trim() || item.imageUrl?.trim())) {
      throw new BadRequestException("至少需要一个制作步骤");
    }
    for (const item of content.ingredients) {
      if (item.amount.kind === "EXACT") {
        if (!item.amount.quantity.trim() || Number(item.amount.quantity) <= 0) {
          throw new BadRequestException("精确用量必须大于 0");
        }
      }
    }
  }

  private async buildAdminRecipeContent(
    tx: Prisma.TransactionClient,
    content: AdminRecipeContentInput,
    stepImageUrls: Array<string | null>
  ): Promise<RecipeContentSnapshot> {
    const ingredientIds = Array.from(new Set(content.ingredients.map(item => item.ingredientId)));
    const unitIds = Array.from(new Set(content.ingredients.flatMap(item => (item.amount.kind === "EXACT" ? [item.amount.unitId] : []))));
    const [ingredientRows, unitRows] = await Promise.all([
      tx.ingredient.findMany({
        where: {
          id: { in: ingredientIds },
          ownerId: null,
          status: "ACTIVE",
          category: {
            is: {
              isSelectable: true
            }
          }
        }
      }),
      unitIds.length === 0
        ? []
        : tx.unit.findMany({
            where: {
              id: { in: unitIds },
              ownerId: null
            }
          })
    ]);
    if (ingredientRows.length !== ingredientIds.length) throw new NotFoundException("系统食材不存在或已下架");
    if (unitRows.length !== unitIds.length) throw new NotFoundException("系统单位不存在");

    const ingredientMap = new Map(ingredientRows.map(item => [item.id, item]));
    const unitMap = new Map(unitRows.map(item => [item.id, item]));

    return {
      name: content.name.trim(),
      story: content.story?.trim() || null,
      baseServings: content.baseServings,
      difficulty: content.difficulty,
      duration: content.duration,
      estimatedCalories: content.estimatedCalories,
      tips: content.tips?.trim() || null,
      ingredients: content.ingredients.map(item => {
        const ingredient = ingredientMap.get(item.ingredientId);
        if (!ingredient) throw new NotFoundException("系统食材不存在或已下架");
        if (item.amount.kind === "FUZZY") {
          return {
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            source: "SYSTEM",
            categoryId: ingredient.categoryId,
            amount: {
              kind: "FUZZY",
              text: item.amount.text
            }
          };
        }
        const unit = unitMap.get(item.amount.unitId);
        if (!unit) throw new NotFoundException("系统单位不存在");
        return {
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          source: "SYSTEM",
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
      steps: content.steps
        .map((item, index) => ({
          text: item.text.trim(),
          imageUrl: stepImageUrls[index] ?? null
        }))
        .filter(item => item.text || item.imageUrl)
    };
  }

  private buildAdminRecipeVersionCreateInput(
    content: RecipeContentSnapshot,
    coverImageUrl: string | null
  ): Prisma.RecipeContentVersionUncheckedCreateInput {
    return {
      createdByUserId: null,
      name: content.name,
      story: content.story,
      baseServings: content.baseServings,
      difficulty: content.difficulty,
      duration: content.duration,
      estimatedCalories: content.estimatedCalories,
      tips: content.tips,
      ingredientsJson: toJson(content.ingredients),
      stepsJson: toJson(content.steps),
      imagesJson: toJson({
        coverImageUrl,
        stepImages: content.steps
          .map((item, index) => ({
            index,
            imageUrl: item.imageUrl
          }))
          .filter(item => item.imageUrl)
      }),
      searchText: buildRecipeSearchText(content),
      contentSizeBytes: contentSizeBytes(content)
    };
  }

  private async buildAdminRecipeImageState(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    coverImageUrl: string | null,
    coverImageTempKey: string | null,
    content: AdminRecipeContentInput,
    currentRecipe: AdminRecipeRow | null,
    publishedStorageKeys: string[],
    consumedTempKeys: Set<string>
  ) {
    const allowedCoverImageUrls = new Set<string>();
    const currentCoverImageUrl = normalizeImageUrl(currentRecipe?.coverImageUrl);
    if (currentCoverImageUrl) {
      allowedCoverImageUrls.add(currentCoverImageUrl);
    }
    const allowedStepUrls = new Set(
      (currentRecipe ? versionToContent(currentRecipe.currentVersion).steps : [])
        .map(item => normalizeImageUrl(item.imageUrl))
        .filter((item): item is string => !!item)
    );

    const nextCoverImageUrl = await this.resolveAdminRecipeImageUrl(
      request,
      "COVER",
      normalizeImageUrl(coverImageUrl),
      coverImageTempKey,
      allowedCoverImageUrls,
      "封面图",
      publishedStorageKeys,
      consumedTempKeys
    );

    const stepImageUrls: Array<string | null> = [];
    for (const step of content.steps) {
      const nextStepImageUrl = await this.resolveAdminRecipeImageUrl(
        request,
        "STEP",
        normalizeImageUrl(step.imageUrl),
        step.imageTempKey,
        allowedStepUrls,
        "步骤图",
        publishedStorageKeys,
        consumedTempKeys
      );
      stepImageUrls.push(nextStepImageUrl);
    }

    return {
      coverImageUrl: nextCoverImageUrl,
      stepImageUrls
    };
  }

  private async resolveAdminRecipeImageUrl(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    scene: "COVER" | "STEP",
    imageUrl: string | null,
    imageTempKey: string | null,
    allowedUrls: Set<string>,
    label: string,
    publishedStorageKeys: string[],
    consumedTempKeys: Set<string>
  ) {
    const normalizedTempKey = imageTempKey?.trim() || null;
    if (normalizedTempKey) {
      const published = await this.adminRecipeImageService.publishTempImage(request, scene, normalizedTempKey);
      publishedStorageKeys.push(published.storageKey);
      consumedTempKeys.add(normalizedTempKey);
      return published.imageUrl;
    }
    if (!imageUrl) {
      return null;
    }
    if (!allowedUrls.has(imageUrl)) {
      throw new BadRequestException(`${label}参数错误，请刷新后重试`);
    }
    return imageUrl;
  }

  private toUserRecipeSummary(recipe: AdminUserRecipeRow): MyRecipeSummary {
    const content = versionToContent(recipe.currentVersion);
    return {
      id: recipe.id,
      title: recipe.title,
      coverImageUrl: recipe.coverImageUrl,
      difficulty: content.difficulty,
      duration: content.duration,
      difficultyText: recipeDifficultyText(content.difficulty),
      durationText: recipeDurationText(content.duration),
      category: toRecipeCategorySummary(recipe.category!),
      contentVersionId: recipe.currentVersionId,
      version: recipe.version,
      updatedAt: toIsoDate(recipe.updatedAt)
    };
  }

  private toUserDraftSummary(draft: AdminDraftRow): RecipeDraftSummary {
    return {
      id: draft.id,
      recipeId: draft.recipeId,
      title: draft.title,
      coverImageUrl: draftCoverImageUrl(draft.contentJson),
      category: draft.category ? toRecipeCategorySummary(draft.category) : null,
      version: draft.version,
      updatedAt: toIsoDate(draft.updatedAt)
    };
  }

  private toCollectedRecipeSummary(collection: AdminCollectionRow): CollectedRecipeSummary {
    const content = versionToContent(collection.sourceVersion);
    return {
      id: collection.id,
      sourceRecipeId: collection.sourceRecipeId,
      title: collection.sourceVersion.name,
      coverImageUrl: collection.sourceRecipe.coverImageUrl,
      difficulty: content.difficulty,
      duration: content.duration,
      difficultyText: recipeDifficultyText(content.difficulty),
      durationText: recipeDurationText(content.duration),
      category: toInspirationCategorySummary(collection.sourceRecipe.inspirationCategory!),
      scenes: collection.sceneLinks.map(link => toRecipeSceneSummary(link.scene)),
      contentVersionId: collection.sourceVersionId,
      collectedAt: toIsoDate(collection.createdAt),
      updatedAt: toIsoDate(collection.updatedAt)
    };
  }

  private async requireUser(tx: Prisma.TransactionClient, userId: UUID) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        uid: true,
        nickname: true
      }
    });
    if (!user) throw new NotFoundException("用户不存在");
    return user;
  }

  private async requireUserExists(userId: UUID) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("用户不存在");
  }

  private async requireSuperAdmin(adminId: UUID) {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
      select: { status: true, roles: true }
    });
    if (!admin || admin.status !== "ACTIVE" || !admin.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("无权执行该操作");
    }
  }

  private async requireIngredientCategory(tx: Prisma.TransactionClient, categoryId: UUID) {
    const category = await tx.ingredientCategory.findUnique({
      where: { id: categoryId }
    });
    if (!category) throw new NotFoundException("食材分类不存在");
    return category;
  }

  private async requireInspirationCategory(tx: Prisma.TransactionClient, categoryId: UUID) {
    const category = await tx.inspirationCategory.findUnique({
      where: { id: categoryId }
    });
    if (!category) throw new NotFoundException("系统菜谱分类不存在");
    return category;
  }

  private async requireSelectableIngredientCategory(tx: Prisma.TransactionClient, categoryId: UUID) {
    const category = await this.requireIngredientCategory(tx, categoryId);
    if (!category.isSelectable) {
      throw new BadRequestException("该分类仅用于系统兜底，不能直接选择");
    }
    return category;
  }

  private async requireImportIngredientCategory(tx: Prisma.TransactionClient) {
    const category = await tx.ingredientCategory.findFirst({
      where: {
        code: "UNCLASSIFIED"
      }
    });
    if (!category) {
      throw new NotFoundException("待归类食材分类不存在");
    }
    return category;
  }

  private async requireSystemUnit(tx: Prisma.TransactionClient, unitId: UUID) {
    const unit = await tx.unit.findFirst({
      where: {
        id: unitId,
        ownerId: null
      }
    });
    if (!unit) throw new NotFoundException("系统单位不存在");
    return unit;
  }

  private async assertSystemUnitNameAvailable(tx: Prisma.TransactionClient, searchKey: string, unitId: UUID | null) {
    const existing = await tx.unit.findFirst({
      where: {
        ownerId: null,
        searchKey,
        ...(unitId ? { NOT: { id: unitId } } : {})
      }
    });
    if (existing) throw new ConflictException("系统单位名称已存在");
  }

  private async requireSystemIngredient(tx: Prisma.TransactionClient, ingredientId: UUID, includeDisabled = false) {
    const ingredient = await tx.ingredient.findFirst({
      where: {
        id: ingredientId,
        ownerId: null,
        status: includeDisabled
          ? {
              in: ["ACTIVE", "DISABLED"]
            }
          : "ACTIVE"
      },
      include: {
        category: true,
        defaultUnit: true
      }
    });
    if (!ingredient) throw new NotFoundException("系统食材不存在");
    return ingredient;
  }

  private async assertIngredientCategoryNameAvailable(tx: Prisma.TransactionClient, name: string, categoryId: UUID | null) {
    const existing = await tx.ingredientCategory.findFirst({
      where: {
        name,
        ...(categoryId ? { NOT: { id: categoryId } } : {})
      }
    });
    if (existing) throw new ConflictException("食材分类名称已存在");
  }

  private async assertInspirationCategoryNameAvailable(tx: Prisma.TransactionClient, name: string, categoryId: UUID | null) {
    const existing = await tx.inspirationCategory.findFirst({
      where: {
        name,
        ...(categoryId ? { NOT: { id: categoryId } } : {})
      }
    });
    if (existing) throw new ConflictException("系统菜谱分类名称已存在");
  }

  private async assertSystemIngredientNameAvailable(tx: Prisma.TransactionClient, searchKey: string, ingredientId: UUID | null) {
    const existing = await tx.ingredient.findFirst({
      where: {
        ownerId: null,
        status: {
          in: ["ACTIVE", "DISABLED"]
        },
        searchKey,
        ...(ingredientId ? { NOT: { id: ingredientId } } : {})
      }
    });
    if (existing) throw new ConflictException("系统食材名称已存在");
  }

  private async requirePendingIngredientRecommendation(tx: Prisma.TransactionClient, ingredientId: UUID) {
    const recommendation = await tx.ingredientRecommendation.findFirst({
      where: {
        ingredientId,
        status: "PENDING"
      },
      include: {
        ingredient: {
          include: {
            owner: {
              select: {
                id: true,
                uid: true,
                nickname: true
              }
            },
            defaultUnit: true
          }
        }
      }
    });
    if (!recommendation || !recommendation.ingredient.ownerId || recommendation.ingredient.status !== "ACTIVE") {
      throw new NotFoundException("待审核个人食材不存在");
    }
    return recommendation;
  }

  private async requirePendingUnitRecommendation(tx: Prisma.TransactionClient, recommendationId: UUID) {
    const recommendation = await tx.unitRecommendation.findFirst({
      where: {
        id: recommendationId,
        status: "PENDING"
      },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            nickname: true
          }
        },
        targetUnit: true
      }
    });
    if (!recommendation) {
      throw new NotFoundException("待审核单位建议不存在");
    }
    return recommendation;
  }

  private async requirePendingIngredientFeedback(tx: Prisma.TransactionClient, feedbackId: UUID) {
    const feedback = await tx.ingredientFeedback.findFirst({
      where: {
        id: feedbackId,
        status: "PENDING"
      },
      include: {
        ingredient: {
          include: {
            category: true,
            owner: {
              select: {
                id: true,
                uid: true,
                nickname: true
              }
            }
          }
        }
      }
    });
    if (!feedback || feedback.ingredient.ownerId !== null || !["ACTIVE", "DISABLED"].includes(feedback.ingredient.status)) {
      throw new NotFoundException("待审核食材纠错不存在");
    }
    return feedback;
  }

  private async requirePendingRecipeRecommendation(tx: Prisma.TransactionClient, recommendationId: UUID) {
    const recommendation = await tx.recipeRecommendation.findFirst({
      where: {
        id: recommendationId,
        status: "PENDING"
      },
      include: {
        recipe: {
          include: {
            owner: {
              select: {
                id: true,
                uid: true,
                nickname: true
              }
            },
            category: true
          }
        },
        sourceVersion: true,
        suggestedCategory: true
      }
    });
    if (!recommendation || !recommendation.recipe.ownerId || recommendation.recipe.status !== "ACTIVE") {
      throw new NotFoundException("待审核个人菜谱不存在");
    }
    return recommendation;
  }

  private async nextIngredientCategorySortOrder(tx: Prisma.TransactionClient) {
    const last = await tx.ingredientCategory.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true }
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async nextInspirationCategorySortOrder(tx: Prisma.TransactionClient) {
    const last = await tx.inspirationCategory.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true }
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async nextSystemIngredientSortOrder(tx: Prisma.TransactionClient, categoryId: UUID) {
    const last = await tx.ingredient.findFirst({
      where: {
        ownerId: null,
        status: "ACTIVE",
        categoryId
      },
      orderBy: { systemSortOrder: "desc" },
      select: { systemSortOrder: true }
    });
    return (last?.systemSortOrder ?? -1) + 1;
  }

  private async nextSystemIngredientDisplaySortOrder(tx: Prisma.TransactionClient) {
    const last = await tx.ingredient.findFirst({
      where: {
        ownerId: null,
        status: "ACTIVE"
      },
      orderBy: { displaySortOrder: "desc" },
      select: { displaySortOrder: true }
    });
    return (last?.displaySortOrder ?? -1) + 1;
  }

  private async nextSystemUnitSortOrder(tx: Prisma.TransactionClient, type: UnitSummary["type"]) {
    const last = await tx.unit.findFirst({
      where: {
        ownerId: null,
        type
      },
      orderBy: { systemSortOrder: "desc" },
      select: { systemSortOrder: true }
    });
    return (last?.systemSortOrder ?? -1) + 1;
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

  private async writeIngredientCategorySortOrder(tx: Prisma.TransactionClient, ids: UUID[]) {
    for (let index = 0; index < ids.length; index += 1) {
      await tx.ingredientCategory.update({
        where: { id: ids[index] },
        data: { sortOrder: -(index + 1) * 1000 }
      });
    }
    for (let index = 0; index < ids.length; index += 1) {
      await tx.ingredientCategory.update({
        where: { id: ids[index] },
        data: {
          sortOrder: index,
          version: { increment: 1 }
        }
      });
    }
  }

  private async writeInspirationCategorySortOrder(tx: Prisma.TransactionClient, ids: UUID[]) {
    for (let index = 0; index < ids.length; index += 1) {
      await tx.inspirationCategory.update({
        where: { id: ids[index] },
        data: { sortOrder: -(index + 1) * 1000 }
      });
    }
    for (let index = 0; index < ids.length; index += 1) {
      await tx.inspirationCategory.update({
        where: { id: ids[index] },
        data: {
          sortOrder: index,
          version: { increment: 1 }
        }
      });
    }
  }

  private async writeSystemIngredientSortOrder(tx: Prisma.TransactionClient, ids: UUID[], categoryId: UUID) {
    for (let index = 0; index < ids.length; index += 1) {
      await tx.ingredient.updateMany({
        where: {
          id: ids[index],
          ownerId: null,
          status: "ACTIVE",
          categoryId
        },
        data: {
          systemSortOrder: -(index + 1) * 1000
        }
      });
    }
    for (let index = 0; index < ids.length; index += 1) {
      await tx.ingredient.updateMany({
        where: {
          id: ids[index],
          ownerId: null,
          status: "ACTIVE",
          categoryId
        },
        data: {
          systemSortOrder: index,
          version: { increment: 1 }
        }
      });
    }
  }

  private async writeSystemIngredientDisplaySortOrder(tx: Prisma.TransactionClient, ids: UUID[]) {
    for (let index = 0; index < ids.length; index += 1) {
      await tx.ingredient.updateMany({
        where: {
          id: ids[index],
          ownerId: null,
          status: "ACTIVE"
        },
        data: {
          displaySortOrder: -(index + 1) * 1000
        }
      });
    }
    for (let index = 0; index < ids.length; index += 1) {
      await tx.ingredient.updateMany({
        where: {
          id: ids[index],
          ownerId: null,
          status: "ACTIVE"
        },
        data: {
          displaySortOrder: index,
          version: { increment: 1 }
        }
      });
    }
  }

  private async writeSystemUnitSortOrder(tx: Prisma.TransactionClient, type: UnitSummary["type"], ids: UUID[]) {
    for (let index = 0; index < ids.length; index += 1) {
      await tx.unit.updateMany({
        where: {
          id: ids[index],
          ownerId: null,
          type
        },
        data: {
          systemSortOrder: -(index + 1) * 1000
        }
      });
    }
    for (let index = 0; index < ids.length; index += 1) {
      await tx.unit.updateMany({
        where: {
          id: ids[index],
          ownerId: null,
          type
        },
        data: {
          systemSortOrder: index,
          version: {
            increment: 1
          }
        }
      });
    }
  }

  private async hasDraftUnitReference(tx: Prisma.TransactionClient, unitId: UUID) {
    const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM "recipe_drafts" AS draft
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(draft."content_json"->'ingredients', '[]'::jsonb)) AS item
        WHERE item->'amount'->>'kind' = 'EXACT'
          AND item->'amount'->>'unitId' = ${String(unitId)}
      ) AS "exists"
    `;
    return rows[0]?.exists === true;
  }

  private async hasRecipeVersionUnitReference(tx: Prisma.TransactionClient, unitId: UUID) {
    const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
      WITH "referenced_versions" AS (
        SELECT "current_version_id" AS "version_id" FROM "recipes"
        UNION
        SELECT "source_version_id" AS "version_id" FROM "recipe_collections"
        UNION
        SELECT "recipe_version_id" AS "version_id" FROM "meal_plan_dishes"
        UNION
        SELECT "bring_version_id" AS "version_id"
        FROM "dining_event_participants"
        WHERE "bring_version_id" IS NOT NULL
      )
      SELECT EXISTS (
        SELECT 1
        FROM "recipe_content_versions" AS version
        INNER JOIN "referenced_versions" AS refs
          ON refs."version_id" = version."id"
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(version."ingredients_json", '[]'::jsonb)) AS item
        WHERE item->'amount'->>'kind' = 'EXACT'
          AND item->'amount'->>'unitId' = ${String(unitId)}
      ) AS "exists"
    `;
    return rows[0]?.exists === true;
  }

  private readNickname(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private buildUserPatch(body: UpdateAdminUserRequest) {
    const patch: {
      nickname?: string | null;
      phone?: string;
    } = {};
    if (body.nickname !== undefined) {
      patch.nickname = this.readNickname(body.nickname);
    }
    if (body.phone !== undefined) {
      patch.phone = body.phone.trim();
    }
    return patch;
  }

  private async createUserRecord(
    tx: Prisma.TransactionClient,
    input: {
      phone: string;
      password: string;
      nickname: string | null;
      status: "ACTIVE" | "DISABLED";
    }
  ) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await tx.user.create({
          data: {
            uid: this.createUid(),
            phone: input.phone,
            nickname: input.nickname,
            passwordHash: hashPassword(input.password),
            status: input.status
          },
          select: {
            id: true,
            uid: true,
            nickname: true,
            avatarUrl: true,
            phone: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error;
        }
        const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
        if (targets.includes("phone")) {
          throw new ConflictException("手机号已存在");
        }
        if (!targets.includes("uid")) {
          throw error;
        }
      }
    }
    throw new BadRequestException("创建用户失败，请稍后重试");
  }

  private async updateUserRecord(
    tx: Prisma.TransactionClient,
    userId: UUID,
    patch: { nickname?: string | null; phone?: string }
  ) {
    try {
      return await tx.user.update({
        where: { id: userId },
        data: patch,
        select: {
          id: true,
          uid: true,
          nickname: true,
          avatarUrl: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
        if (targets.includes("phone")) {
          throw new ConflictException("手机号已存在");
        }
      }
      throw error;
    }
  }

  private createUid() {
    return randomInt(10_000_000, 100_000_000);
  }

  private hashSecret(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
}
