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
import { Prisma, type RecipeStatus } from "@prisma/client";
import { recipeDifficultyText, recipeDurationText } from "../../common/display-text";
import { maskPhone } from "../../common/phone";
import type {
  AdminRecipeContentInput,
  AdminDashboardSummary,
    AdminInspirationCategoryPayloadRequest,
    AdminInspirationCategorySummary,
    AdminPendingUnitRecommendationSummary,
    AdminPendingRecipeSummary,
  AdminRecipeDetail,
  AdminRecipeWiki,
  AdminRecipeWikiNutrition,
  AdminRecipeWikiTag,
  AdminDeleteIngredientCategoryResult,
    AdminDeleteIngredientResult,
    AdminDeletePendingIngredientResult,
    AdminDeletePendingItemResult,
    AdminDeleteInspirationCategoryResult,
    AdminDeleteRecipeImportJobResult,
    AdminDeleteRecipeResult,
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
  AdminNutritionFoodSummary,
  AdminNutritionCategorySummary,
  AdminIngredientNutritionDetail,
  SetAdminIngredientStatusRequest,
  SetAdminIngredientCategoryStatusRequest,
  AdminUnitPayloadRequest,
  AdminUnitSummary,
  AdminResetUserPasswordResponse,
  AdminRecipeSummary,
  AdminUserRecipeDomainOverview,
  CollectionListResponse,
  CollectionSceneSummary,
  CollectedRecipeSummary,
  CreateAdminRecipeRequest,
  CreateAdminUserRequest,
  AdminLoginRequest,
  AdminUserEntitlementResponse,
  AdminUserPhoneRevealResponse,
  IngredientProteinType,
  InspirationCategorySummary,
  MyRecipeSummary,
  PageResult,
  OperationId,
  RecipeCategorySummary,
  RecipeContentSnapshot,
  RecipeDraftSummary,
  RecipeImportIssue,
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
  SetAdminUserStatusRequest,
  StorageUsageSummary,
  UnitSummary,
  UpdateAdminUnitRequest,
  UpdateAdminInspirationCategoryRequest,
  UpdateAdminIngredientCategoryRequest,
  UpdateAdminIngredientRequest,
  UpdateAdminIngredientNutritionRequest,
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
import { hashPassword, passwordPolicyError, verifyPassword } from "../../common/security/password";
import { EntitlementService } from "../entitlement/entitlement.service";
import {
  buildRecipeAssistantSnapshot,
  buildImportedRecipeAssistantSnapshot,
  buildRecipeSearchText,
  buildSearchKey,
  contentSizeBytes,
  draftCoverImageUrl,
  fromJson,
  toJson,
  versionAssistantToSnapshot,
  versionToContent
} from "../recipe/recipe-content";
import { inferIngredientTagFacts } from "../recipe/ingredient-tag-facts";
import { loadRecipeNutritionSummary } from "../recipe/recipe-nutrition";
import { buildNutritionFoodWhere, buildNutritionSnapshotDeleteWhere, normalizeNutritionCategory, normalizeNutritionSearch, nutritionSourceVersion, toAdminNutritionFood } from "./nutrition-admin";
import { buildRecipeWikiQualityCards } from "../recipe/recipe-wiki";
import { createImportedRecipeVersionTags, replaceAutoRecipeVersionTags } from "../recipe/recipe-version-tags";
import { inspirationRecipeWhere, pickRecipeInspirationOwner } from "../recipe/recipe-inspiration-owner";
import { MedalService } from "../user/medal.service";
import { AdminRecipeImageService } from "./admin-recipe-image.service";
import { IngredientImageService } from "./ingredient-image.service";
import {
  buildIngredientRefs,
  buildUnitRefs,
  readImageBuffer,
  readImageDataUrl,
  readSourceImages
} from "./recipe-import-markdown";
import {
  normalizeRecipeImportBody,
  isImportedIngredientPlaceholder,
  parseJsonSource,
  readJsonSourcesFromFiles,
  rebuildJsonItemState,
  type RecipeImportJsonSource
} from "./recipe-import-json";

function toIsoDate(value: Date) {
  return value.toISOString();
}

const maxImportRemoteImages = 50;
const maxImportRemoteImageBytes = 100 * 1024 * 1024;
const maxImportRemoteImageBudgetMs = 2 * 60 * 1000;

function recipeImportTempKeys(body: RecipeImportRecipeBody) {
  return new Set(
    [body.coverImageTempKey, ...body.steps.map(step => step.imageTempKey)]
      .map(value => value?.trim())
      .filter((value): value is string => Boolean(value))
  );
}

function toDateText(value: Date | null) {
  if (!value) return null;
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function normalizeRecipeAssistantError(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "做饭建议生成失败";
  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
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
  cookNo: string | null;
  bio: string | null;
  gender: string | null;
  birthDate: Date | null;
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
    cookNo: user.cookNo,
    bio: user.bio,
    gender: user.gender as UserProfile["gender"],
    birthDate: toDateText(user.birthDate),
    phone: maskPhone(user.phone),
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
type RecipeAssistantRecord = Prisma.RecipeCookAssistantGetPayload<{}>;

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
type AdminPendingIngredientListRow = {
  ingredient: {
    id: UUID;
    name: string;
    version: number;
    categoryId: UUID;
    defaultUnitId: UUID;
    owner: {
      id: UUID;
      uid: number;
      nickname: string | null;
    } | null;
    defaultUnit: {
      name: string;
    } | null;
  };
  categoryName: string | null;
  userId: UUID | null;
  createdAt: Date;
  updatedAt: Date;
  source: "PERSONAL" | "JSON_IMPORT";
};
type AdminPendingImportedIngredientRow = Prisma.IngredientGetPayload<{
  include: {
    category: true;
    defaultUnit: true;
    owner: {
      select: {
        id: true;
        uid: true;
        nickname: true;
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

function isAdminEditableInspiration(recipe: Pick<AdminRecipeRow, "isInspiration" | "inspirationCategoryId" | "status">) {
  return recipe.isInspiration && !!recipe.inspirationCategoryId && recipe.status !== "DELETED";
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

function toAdminPendingIngredientSummary(row: AdminPendingIngredientListRow): AdminPendingIngredientSummary {
  return {
    id: row.ingredient.id,
    name: row.ingredient.name,
    version: row.ingredient.version,
    categoryId: row.ingredient.categoryId,
    categoryName: row.categoryName,
    defaultUnitId: row.ingredient.defaultUnitId,
    defaultUnitName: row.ingredient.defaultUnit?.name ?? null,
    status: "PENDING",
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    source: row.source,
    user: row.ingredient.owner
      ? {
          id: row.ingredient.owner.id,
          uid: row.ingredient.owner.uid,
          nickname: row.ingredient.owner.nickname
        }
      : null
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const [
      userTodayNewCount,
      userSevenDayNewCount,
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
      pendingRecipeCount,
      pendingPersonalIngredientCount,
      pendingImportedIngredientCount,
      ingredientCategoryCount,
      ingredientItemCount,
      unitCount,
      todayRedeemedCount
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
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
      this.prisma.recipeRecommendation.count({ where: { status: "PENDING" } }),
      this.prisma.ingredientRecommendation.count({ where: { status: "PENDING" } }),
      this.prisma.ingredient.count({ where: { ownerId: null, status: "PENDING" } }),
      this.prisma.ingredientCategory.count(),
      this.prisma.ingredient.count({ where: { ownerId: null, status: "ACTIVE" } }),
      this.prisma.unit.count({ where: { ownerId: null } }),
      this.prisma.membershipCode.count({ where: { redeemedAt: { gte: today } } })
    ]);

    return {
      overview: {
        todayNewUsers: userTodayNewCount,
        sevenDayNewUsers: userSevenDayNewCount,
        totalUsers: userTotal,
        openReportCount: recipeOpenReportCount,
        pendingRecipeCount,
        pendingIngredientCount: pendingPersonalIngredientCount + pendingImportedIngredientCount,
        todayRedeemedCount
      },
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
            { cookNo: { contains: normalizedKeyword, mode: "insensitive" as const } },
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
    this.assertUserPassword(body.password);
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
          cookNo: true,
          bio: true,
          gender: true,
          birthDate: true,
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
      const phoneChanged = patch.phone !== undefined && patch.phone !== current.phone;
      const auditPayload = phoneChanged
        ? {
            oldPhone: maskPhone(current.phone),
            newPhone: maskPhone(patch.phone),
            ...(patch.nickname !== undefined ? { nickname: patch.nickname } : {})
          }
        : {
            ...(patch.nickname !== undefined ? { nickname: patch.nickname } : {}),
            ...(patch.phone !== undefined ? { phone: maskPhone(patch.phone) } : {})
          };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: phoneChanged ? "USER_PHONE_CHANGED" : "USER_UPDATED",
          objectType: "USER",
          objectId: userId,
          payload: auditPayload
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
          cookNo: true,
          bio: true,
          gender: true,
          birthDate: true,
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
                cookNo: true,
                bio: true,
                gender: true,
                birthDate: true,
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
    this.assertUserPassword(body.newPassword);
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

  async revealUserPhone(userId: UUID, adminId: UUID): Promise<AdminUserPhoneRevealResponse> {
    return this.prisma.$transaction(async tx => {
      const admin = await tx.adminAccount.findUnique({
        where: { id: adminId },
        select: { status: true, roles: true }
      });
      if (!admin || admin.status !== "ACTIVE" || !admin.roles.includes("SUPER_ADMIN")) {
        throw new ForbiddenException("无权查看用户手机号");
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true }
      });
      if (!user) throw new NotFoundException("用户不存在");

      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "USER_PHONE_REVEALED",
          objectType: "USER",
          objectId: user.id,
          payload: { reason: "admin-entitlement-phone-reveal" }
        }
      });

      return { phone: user.phone };
    });
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
          avatarUrl: true,
          cookNo: true,
          bio: true,
          gender: true,
          birthDate: true,
          phone: true,
          status: true
        }
      });
      if (!user) throw new NotFoundException("用户不存在");

      const [resolved, storageRows] = await Promise.all([
        this.entitlementService.resolveForUser(tx, userId),
        tx.storageLedger.findMany({
          where: { userId },
          select: {
            module: true,
            usedBytes: true
          }
        })
      ]);

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
          avatarUrl: user.avatarUrl,
          cookNo: user.cookNo,
          bio: user.bio,
          gender: user.gender as AdminUserEntitlementResponse["user"]["gender"],
          birthDate: toDateText(user.birthDate),
          phone: maskPhone(user.phone),
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

  async setIngredientCategoryStatus(
    categoryId: UUID,
    body: SetAdminIngredientCategoryStatusRequest,
    adminId: UUID
  ): Promise<AdminIngredientCategorySummary> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${categoryId}:${body.expectedVersion}:${body.status}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminIngredientCategorySummary>(
        tx,
        body.operationId,
        "admin-ingredient-category:set-status",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-category:set-status", adminId, requestHash);

      const category = await this.requireIngredientCategory(tx, categoryId);
      if (category.version !== body.expectedVersion) throw new ConflictException("食材分类已被更新，请刷新后重试");
      if (category.code === "UNCLASSIFIED") throw new BadRequestException("待归类分类不能上架或下架");
      const isSelectable = body.status === "ACTIVE";
      const updated =
        category.isSelectable === isSelectable
          ? category
          : await tx.ingredientCategory.update({
              where: { id: categoryId },
              data: {
                isSelectable,
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
          action: "INGREDIENT_CATEGORY_STATUS_CHANGED",
          objectType: "INGREDIENT_CATEGORY",
          objectId: categoryId,
          payload: {
            status: body.status
          }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient-category:set-status", adminId, requestHash, result);
      return result;
    });
  }

  async deleteIngredientCategory(
    categoryId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    adminId: UUID
  ): Promise<AdminDeleteIngredientCategoryResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${categoryId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeleteIngredientCategoryResult>(
        tx,
        operationId,
        "admin-ingredient-category:delete",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-ingredient-category:delete", adminId, requestHash);

      const category = await this.requireIngredientCategory(tx, categoryId);
      if (category.version !== expectedVersion) throw new ConflictException("食材分类已被更新，请刷新后重试");
      if (category.code === "UNCLASSIFIED") throw new BadRequestException("待归类分类不能删除");
      const [ingredientCount, feedbackCount, suggestedFeedbackCount] = await Promise.all([
        tx.ingredient.count({ where: { categoryId } }),
        tx.ingredientFeedback.count({ where: { categoryId } }),
        tx.ingredientFeedback.count({ where: { suggestedCategoryId: categoryId } })
      ]);
      if (ingredientCount > 0 || feedbackCount > 0 || suggestedFeedbackCount > 0) {
        throw new ConflictException("该分类仍被食材或纠错记录使用，不能删除");
      }

      await tx.ingredientCategory.delete({
        where: { id: categoryId }
      });
      const result: AdminDeleteIngredientCategoryResult = {
        categoryId,
        deletedAt: toIsoDate(new Date())
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INGREDIENT_CATEGORY_DELETED",
          objectType: "INGREDIENT_CATEGORY",
          objectId: categoryId,
          payload: {
            name: category.name,
            code: category.code
          }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient-category:delete", adminId, requestHash, result);
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

  async listNutritionCategories(adminId: UUID): Promise<AdminNutritionCategorySummary[]> {
    await this.requireSuperAdmin(adminId);
    const rows = await this.prisma.nutrientFood.findMany({
      where: { sourceVersion: nutritionSourceVersion, category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" }
    });
    return rows.flatMap(row => row.category?.trim() ? [{ category: row.category.trim() }] : []);
  }

  async listNutritionFoods(page: number, pageSize: number, keyword: string | undefined, category: string | undefined, adminId: UUID): Promise<PageResult<AdminNutritionFoodSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = Math.min(toPositiveInt(pageSize, 20), 100);
    const search = normalizeNutritionSearch(keyword);
    const selectedCategory = normalizeNutritionCategory(category);
    const where = buildNutritionFoodWhere(search, selectedCategory);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.nutrientFood.findMany({
        where,
        select: { id: true, sourceFoodCode: true, name: true, category: true, edibleRate: true, calories: true, protein: true, fat: true, carbohydrate: true, sourceVersion: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (normalizedPage - 1) * normalizedPageSize,
        take: normalizedPageSize
      }),
      this.prisma.nutrientFood.count({ where })
    ]);
    return {
      items: rows.map(row => toAdminNutritionFood(row)),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: normalizedPage * normalizedPageSize < total
    };
  }

  async getIngredientNutrition(ingredientId: UUID, adminId: UUID): Promise<AdminIngredientNutritionDetail> {
    await this.requireSuperAdmin(adminId);
    await this.requireSystemIngredient(this.prisma, ingredientId, true);
    return this.readIngredientNutrition(this.prisma, ingredientId);
  }

  private async readIngredientNutrition(db: PrismaService | Prisma.TransactionClient, ingredientId: UUID): Promise<AdminIngredientNutritionDetail> {
    const mapping = await db.ingredientNutrientMapping.findUnique({
      where: { ingredientId_sourceVersion: { ingredientId, sourceVersion: nutritionSourceVersion } },
      include: { nutrientFood: true }
    });
    const conversions = await db.ingredientUnitNutrientConversion.findMany({
      where: { ingredientId, sourceVersion: nutritionSourceVersion },
      include: { unit: true },
      orderBy: { unitId: "asc" }
    });
    let food = null;
    if (mapping?.nutrientFood) {
      food = toAdminNutritionFood(mapping.nutrientFood);
    }
    return {
      ingredientId,
      mapping: mapping ? { id: mapping.id, status: mapping.status, matchType: mapping.matchType, confidence: mapping.confidence, sourceVersion: mapping.sourceVersion, food } : null,
      conversions: conversions.map(item => ({ unitId: item.unitId, unitName: item.unit.name, gramsPerUnit: item.gramsPerUnit, sourceVersion: item.sourceVersion }))
    };
  }

  async updateIngredientNutrition(ingredientId: UUID, body: UpdateAdminIngredientNutritionRequest, adminId: UUID): Promise<AdminIngredientNutritionDetail> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify({ ingredientId, nutrientFoodId: body.nutrientFoodId, matchType: body.matchType, confidence: body.confidence, conversions: body.conversions });
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminIngredientNutritionDetail>(tx, body.operationId, "admin-ingredient:nutrition", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:nutrition", adminId, requestHash);
      await this.requireSystemIngredient(tx, ingredientId, true);
      if (body.nutrientFoodId !== null) {
        const food = await tx.nutrientFood.findFirst({ where: { id: body.nutrientFoodId, sourceVersion: nutritionSourceVersion } });
        if (!food) throw new BadRequestException("营养数据不存在或版本已更新");
      }
      const unitIds = body.conversions.map(item => item.unitId);
      if (new Set(unitIds).size !== unitIds.length) throw new BadRequestException("单位换算不能重复");
      for (const conversion of body.conversions) await this.requireSystemUnit(tx, conversion.unitId);
      await tx.ingredientNutrientMapping.upsert({
        where: { ingredientId_sourceVersion: { ingredientId, sourceVersion: nutritionSourceVersion } },
        update: { nutrientFoodId: body.nutrientFoodId, status: body.nutrientFoodId === null ? "UNMAPPED" : "CONFIRMED", matchType: body.matchType, confidence: body.confidence },
        create: { ingredientId, nutrientFoodId: body.nutrientFoodId, status: body.nutrientFoodId === null ? "UNMAPPED" : "CONFIRMED", matchType: body.matchType, confidence: body.confidence, sourceVersion: nutritionSourceVersion }
      });
      await tx.ingredientUnitNutrientConversion.deleteMany({ where: { ingredientId, sourceVersion: nutritionSourceVersion } });
      if (body.conversions.length) await tx.ingredientUnitNutrientConversion.createMany({ data: body.conversions.map(item => ({ ingredientId, unitId: item.unitId, gramsPerUnit: item.gramsPerUnit, sourceVersion: nutritionSourceVersion })) });
      const affectedVersions = await tx.$queryRaw<Array<{ recipeVersionId: number }>>(Prisma.sql`
        SELECT snapshot."recipe_version_id" AS "recipeVersionId"
        FROM "recipe_nutrition_snapshots" AS snapshot
        INNER JOIN "recipe_content_versions" AS version
          ON version."id" = snapshot."recipe_version_id"
        WHERE snapshot."source_version" = ${nutritionSourceVersion}
          AND snapshot."source" = 'AUTO'
          AND snapshot."is_locked" = false
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(version."ingredients_json", '[]'::jsonb)) AS item
            WHERE item->>'ingredientId' = ${String(ingredientId)}
          )
      `);
      const recipeVersionIds = affectedVersions.map(item => item.recipeVersionId);
      if (recipeVersionIds.length > 0) {
        await tx.recipeNutritionSnapshot.deleteMany({ where: buildNutritionSnapshotDeleteWhere(recipeVersionIds) });
      }
      await tx.auditEvent.create({ data: { actorType: "ADMIN", actorAdminId: adminId, action: "INGREDIENT_NUTRITION_UPDATED", objectType: "INGREDIENT", objectId: ingredientId, payload: { nutrientFoodId: body.nutrientFoodId, conversionCount: body.conversions.length, invalidatedSnapshotCount: recipeVersionIds.length } } });
      const result = await this.readIngredientNutrition(tx, ingredientId);
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:nutrition", adminId, requestHash, result);
      return result;
    });
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

  async deleteSystemIngredient(
    ingredientId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    adminId: UUID
  ): Promise<AdminDeleteIngredientResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${ingredientId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeleteIngredientResult>(
        tx,
        operationId,
        "admin-ingredient:delete",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-ingredient:delete", adminId, requestHash);

      const ingredient = await this.requireSystemIngredient(tx, ingredientId, true);
      if (ingredient.version !== expectedVersion) throw new ConflictException("食材已被更新，请刷新后重试");

      const [
        mergedCount,
        recommendationCount,
        targetRecommendationCount,
        feedbackCount,
        fridgeCount,
        shoppingCount,
        nutrientMappingCount,
        nutrientConversionCount
      ] = await Promise.all([
        tx.ingredient.count({ where: { mergedToId: ingredientId } }),
        tx.ingredientRecommendation.count({ where: { ingredientId } }),
        tx.ingredientRecommendation.count({ where: { targetIngredientId: ingredientId } }),
        tx.ingredientFeedback.count({ where: { ingredientId } }),
        tx.fridgeItem.count({ where: { ingredientId } }),
        tx.shoppingItem.count({ where: { ingredientId } }),
        tx.ingredientNutrientMapping.count({ where: { ingredientId } }),
        tx.ingredientUnitNutrientConversion.count({ where: { ingredientId } })
      ]);
      if (
        mergedCount > 0 ||
        recommendationCount > 0 ||
        targetRecommendationCount > 0 ||
        feedbackCount > 0 ||
        fridgeCount > 0 ||
        shoppingCount > 0 ||
        nutrientMappingCount > 0 ||
        nutrientConversionCount > 0 ||
        (await this.hasDraftIngredientReference(tx, ingredientId)) ||
        (await this.hasRecipeVersionIngredientReference(tx, ingredientId))
      ) {
        throw new ConflictException("该食材仍被个人数据、菜谱或审核记录使用，不能删除");
      }

      await tx.ingredient.delete({
        where: { id: ingredientId }
      });
      const result: AdminDeleteIngredientResult = {
        ingredientId,
        deletedAt: toIsoDate(new Date())
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INGREDIENT_DELETED",
          objectType: "INGREDIENT",
          objectId: ingredientId,
          payload: {
            name: ingredient.name,
            categoryId: ingredient.categoryId,
            source: "SYSTEM"
          }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient:delete", adminId, requestHash, result);
      return result;
    });
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
    const sourceTake = skip + normalizedPageSize;
    const normalizedKeyword = keyword?.trim();
    const uidKeyword = normalizedKeyword && /^\d+$/.test(normalizedKeyword) ? Number(normalizedKeyword) : null;
    const recommendationWhere: Prisma.IngredientRecommendationWhereInput = {
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
    const systemWhere: Prisma.IngredientWhereInput = {
      ownerId: null,
      status: "PENDING",
      ...(normalizedKeyword
        ? {
            OR: [
              { name: { contains: normalizedKeyword, mode: "insensitive" } },
              { category: { is: { name: { contains: normalizedKeyword, mode: "insensitive" } } } },
              { defaultUnit: { is: { name: { contains: normalizedKeyword, mode: "insensitive" } } } }
            ]
          }
        : {})
    };
    const [personalItems, personalTotal, systemItems, systemTotal] = await this.prisma.$transaction([
      this.prisma.ingredientRecommendation.findMany({
        where: recommendationWhere,
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
        take: sourceTake
      }),
      this.prisma.ingredientRecommendation.count({ where: recommendationWhere }),
      this.prisma.ingredient.findMany({
        where: systemWhere,
        include: {
          category: true,
          defaultUnit: true,
          owner: {
            select: {
              id: true,
              uid: true,
              nickname: true
            }
          }
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: sourceTake
      }),
      this.prisma.ingredient.count({ where: systemWhere })
    ]);

    const personalRows: AdminPendingIngredientListRow[] = personalItems.map(item => ({
      ingredient: item.ingredient,
      categoryName: item.categoryName,
      userId: item.userId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      source: "PERSONAL"
    }));
    const systemRows: AdminPendingIngredientListRow[] = systemItems.map(item => ({
      ingredient: item,
      categoryName: item.category.name,
      userId: null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      source: "JSON_IMPORT"
    }));
    const mergedRows = [...personalRows, ...systemRows].sort((left, right) => {
      const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime();
      return createdAtDelta !== 0 ? createdAtDelta : left.ingredient.id - right.ingredient.id;
    });
    const pageItems = mergedRows.slice(skip, skip + normalizedPageSize);

    return {
      items: pageItems.map(toAdminPendingIngredientSummary),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total: personalTotal + systemTotal,
      hasNext: skip + pageItems.length < personalTotal + systemTotal
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

  async deletePendingIngredient(
    ingredientId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    adminId: UUID
  ): Promise<AdminDeletePendingIngredientResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${ingredientId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeletePendingIngredientResult>(
        tx,
        operationId,
        "admin-pending-ingredient:delete",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-pending-ingredient:delete", adminId, requestHash);

      await tx.$queryRaw`SELECT "id" FROM "ingredients" WHERE "id" = ${ingredientId} FOR UPDATE`;
      const recommendation = await this.requirePendingIngredientRecommendation(tx, ingredientId);
      if (recommendation.ingredient.version !== expectedVersion) {
        throw new ConflictException("食材已被更新，请刷新后重试");
      }
      await tx.ingredientRecommendation.delete({
        where: { id: recommendation.id }
      });
      const result: AdminDeletePendingIngredientResult = {
        id: ingredientId,
        deletedAt: toIsoDate(new Date())
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INGREDIENT_RECOMMENDATION_DELETED",
          objectType: "INGREDIENT",
          objectId: ingredientId,
          payload: {
            recommendationId: recommendation.id,
            name: recommendation.ingredientName
          }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-pending-ingredient:delete", adminId, requestHash, result);
      return result;
    });
  }

  async deletePendingUnitRecommendation(
    recommendationId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    adminId: UUID
  ): Promise<AdminDeletePendingItemResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${recommendationId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeletePendingItemResult>(
        tx,
        operationId,
        "admin-pending-unit:delete",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-pending-unit:delete", adminId, requestHash);

      await tx.$queryRaw`SELECT "id" FROM "unit_recommendations" WHERE "id" = ${recommendationId} FOR UPDATE`;
      const recommendation = await this.requirePendingUnitRecommendation(tx, recommendationId);
      if (recommendation.version !== expectedVersion) {
        throw new ConflictException("单位建议已更新，请刷新后重试");
      }
      await tx.unitRecommendation.delete({
        where: { id: recommendation.id }
      });
      const result: AdminDeletePendingItemResult = {
        id: recommendation.id,
        deletedAt: toIsoDate(new Date())
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "UNIT_RECOMMENDATION_DELETED",
          objectType: "UNIT_RECOMMENDATION",
          objectId: recommendation.id,
          payload: {
            name: recommendation.unitName,
            type: recommendation.unitType
          }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-pending-unit:delete", adminId, requestHash, result);
      return result;
    });
  }

  async deleteIngredientFeedback(
    feedbackId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    adminId: UUID
  ): Promise<AdminDeletePendingItemResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${feedbackId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeletePendingItemResult>(
        tx,
        operationId,
        "admin-ingredient-feedback:delete",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-ingredient-feedback:delete", adminId, requestHash);

      await tx.$queryRaw`SELECT "id" FROM "ingredient_feedbacks" WHERE "id" = ${feedbackId} FOR UPDATE`;
      const feedback = await this.requirePendingIngredientFeedback(tx, feedbackId);
      if (feedback.ingredient.version !== expectedVersion) {
        throw new ConflictException("食材已被更新，请刷新后重试");
      }
      await tx.ingredientFeedback.delete({
        where: { id: feedback.id }
      });
      const result: AdminDeletePendingItemResult = {
        id: feedback.id,
        deletedAt: toIsoDate(new Date())
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INGREDIENT_FEEDBACK_DELETED",
          objectType: "INGREDIENT",
          objectId: feedback.ingredientId,
          payload: {
            feedbackId,
            suggestedName: feedback.suggestedName
          }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-ingredient-feedback:delete", adminId, requestHash, result);
      return result;
    });
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
        const importedIngredient = await this.findPendingImportedIngredient(tx, ingredientId);
        if (importedIngredient) {
          return this.reviewPendingImportedIngredient(tx, importedIngredient, body, adminId, requestHash, reviewContent);
        }
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

  private async reviewPendingImportedIngredient(
    tx: Prisma.TransactionClient,
    importedIngredient: AdminPendingImportedIngredientRow,
    body: AdminReviewPendingIngredientRequest,
    adminId: UUID,
    requestHash: string,
    reviewContent: ReturnType<typeof resolveIngredientReviewNote>
  ): Promise<AdminReviewPendingIngredientResult> {
    const repeated = await getAdminIdempotentResult<AdminReviewPendingIngredientResult>(
      tx,
      body.operationId,
      "admin-pending-ingredient:review",
      adminId,
      requestHash
    );
    if (repeated) return repeated;
    if (importedIngredient.version !== body.expectedVersion) {
      throw new ConflictException("食材已被更新，请刷新后重试");
    }
    await startAdminIdempotentOperation(tx, body.operationId, "admin-pending-ingredient:review", adminId, requestHash);

    const now = new Date();
    if (body.action === "REJECT") {
      await tx.ingredient.update({
        where: { id: importedIngredient.id },
        data: {
          status: "DISABLED",
          version: { increment: 1 }
        }
      });
      await this.refreshRecipeImportIngredientReferences(tx, importedIngredient.id, {
        id: importedIngredient.id,
        name: importedIngredient.name
      });
      const result = {
        id: importedIngredient.id,
        status: "REJECTED",
        reviewedAt: toIsoDate(now),
        targetIngredientId: null
      } satisfies AdminReviewPendingIngredientResult;
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_IMPORT_INGREDIENT_REVIEWED",
          objectType: "INGREDIENT",
          objectId: importedIngredient.id,
          payload: {
            action: body.action,
            rejectReasonCode: reviewContent.reviewReasonCode,
            reason: reviewContent.auditReason,
            advice: reviewContent.reviewAdvice
          }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-pending-ingredient:review", adminId, requestHash, result);
      return result;
    }

    const name = body.name?.trim() || "";
    if (isImportedIngredientPlaceholder(name)) {
      throw new BadRequestException("请先将导入占位食材改为真实名称，不能直接通过");
    }
    if (!name) throw new BadRequestException("食材名称不能为空");
    if (!body.categoryId) throw new BadRequestException("请选择分类");
    if (!body.defaultUnitId) throw new BadRequestException("请选择默认单位");
    const category = await this.requireSelectableIngredientCategory(tx, body.categoryId);
    const unit = await this.requireSystemUnit(tx, body.defaultUnitId);
    const searchKey = buildSearchKey(name);
    let targetIngredientId: UUID = importedIngredient.id;
    if (body.action === "APPROVE_MERGE") {
      if (!body.targetIngredientId) throw new BadRequestException("请选择归并目标");
      const mergeTarget = await this.requireSystemIngredient(tx, body.targetIngredientId);
      await this.assertSystemIngredientNameAvailable(tx, searchKey, mergeTarget.id);
      const updatedTarget = await tx.ingredient.update({
        where: { id: mergeTarget.id },
        data: {
          name,
          searchKey,
          categoryId: category.id,
          defaultUnitId: unit.id,
          systemSortOrder:
            mergeTarget.categoryId === category.id
              ? mergeTarget.systemSortOrder
              : await this.nextSystemIngredientSortOrder(tx, category.id),
          version: { increment: 1 }
        }
      });
      await tx.ingredient.update({
        where: { id: importedIngredient.id },
        data: {
          status: "MERGED",
          mergedToId: updatedTarget.id,
          version: { increment: 1 }
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
          searchKey
        }
      });
      if (duplicate) {
        const updatedTarget = await tx.ingredient.update({
          where: { id: duplicate.id },
          data: {
            status: "ACTIVE",
            name,
            searchKey,
            categoryId: category.id,
            defaultUnitId: unit.id,
            version: { increment: 1 }
          }
        });
        await tx.ingredient.update({
          where: { id: importedIngredient.id },
          data: {
            status: "MERGED",
            mergedToId: updatedTarget.id,
            version: { increment: 1 }
          }
        });
        targetIngredientId = updatedTarget.id;
      } else {
        await tx.ingredient.update({
          where: { id: importedIngredient.id },
          data: {
            status: "ACTIVE",
            mergedToId: null,
            name,
            searchKey,
            categoryId: category.id,
            defaultUnitId: unit.id,
            systemSortOrder: await this.nextSystemIngredientSortOrder(tx, category.id),
            displaySortOrder: await this.nextSystemIngredientDisplaySortOrder(tx),
            version: { increment: 1 }
          }
        });
      }
    }
    await this.refreshRecipeImportIngredientReferences(tx, importedIngredient.id, {
      id: targetIngredientId,
      name
    });
    const result = {
      id: importedIngredient.id,
      status: "APPROVED",
      reviewedAt: toIsoDate(now),
      targetIngredientId
    } satisfies AdminReviewPendingIngredientResult;
    await tx.auditEvent.create({
      data: {
        actorType: "ADMIN",
        actorAdminId: adminId,
        action: "RECIPE_IMPORT_INGREDIENT_REVIEWED",
        objectType: "INGREDIENT",
        objectId: importedIngredient.id,
        payload: {
          action: body.action,
          targetIngredientId,
          reason: reviewContent.auditReason
        }
      }
    });
    await completeAdminIdempotentOperation(tx, body.operationId, "admin-pending-ingredient:review", adminId, requestHash, result);
    return result;
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
        await this.syncRecipeAssistant(tx, nextVersion.id, sourceContent);

        const created = await tx.recipe.create({
          data: {
            ownerId: null,
            isInspiration: true,
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
    files: Array<{ originalname?: string; buffer?: Buffer; size?: number }>,
    adminId: UUID,
    operationId: OperationId
  ): Promise<RecipeImportJobSummary> {
    await this.requireSuperAdmin(adminId);
    if (files.length === 0) {
      throw new BadRequestException("请至少上传一个 JSON 文件");
    }
    const sourceName = files.map(file => file.originalname || "").filter(Boolean).join(", ");

    const sources = readJsonSourcesFromFiles(files);
    if (sources.length === 0) {
      throw new BadRequestException("未找到可导入的 JSON 文件");
    }
    const fileHashBuilder = createHash("sha256");
    for (const file of files) {
      fileHashBuilder.update(file.originalname || "");
      fileHashBuilder.update(file.buffer || Buffer.alloc(0));
    }
    const requestHash = `JSON:${sourceName}:${fileHashBuilder.digest("hex")}`;
    let jobId: UUID | null = null;
    let startedRecordId: UUID | null = null;

    const repeated = await this.prisma.$transaction(async tx => {
      const result = await getAdminIdempotentResult<RecipeImportJobSummary>(tx, operationId, "admin-recipe-import:create", adminId, requestHash);
      if (result) {
        return result;
      }

      const existing = await tx.idempotencyRecord.findFirst({
        where: {
          operationId,
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
            operationId,
            operationType: "admin-recipe-import:create",
            adminId,
            status: "FAILED"
          }
        });
      }

      const started = await startAdminIdempotentOperation(tx, operationId, "admin-recipe-import:create", adminId, requestHash);
      startedRecordId = started.id;
      const job = await tx.recipeImportJob.create({
        data: {
          sourceType: "JSON",
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
          const parsed = parseJsonSource(source as RecipeImportJsonSource, refs);
          await this.prisma.$transaction(async tx => {
            const rawBody = {
              ...parsed.rawBody,
              assetFolder: "",
              images: []
            };
            const recipeBody = await this.prepareRecipeImportBody(tx, parsed.recipeBody);
            const state = await this.buildRecipeImportItemState(tx, recipeBody, rawBody);
            await tx.recipeImportItem.create({
              data: {
                jobId: jobId as UUID,
                sourcePath: source.sourcePath,
                title: recipeBody.title.trim() || parsed.parsedBody.titleLine || null,
                status: state.errorItems.length > 0 ? "NEEDS_FIX" : "READY",
                rawBodyJson: toJson(rawBody),
                parsedBodyJson: toJson(parsed.parsedBody),
                recipeBodyJson: toJson(recipeBody),
                errorJson: toJson(state.errorItems),
                warnJson: toJson(state.warnItems)
              }
            });
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "解析 JSON 失败";
          await this.prisma.recipeImportItem.create({
            data: {
              jobId,
              sourcePath: source.sourcePath,
              title: null,
              status: "FAILED",
              rawBodyJson: toJson({
                sourcePath: source.sourcePath,
                jsonText: source.jsonText,
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
                inspirationCategoryId: null,
                title: "",
                story: null,
                baseServings: null,
                difficulty: null,
                duration: null,
                tips: null,
                coverImageKey: null,
                coverImageUrl: null,
                coverImageTempKey: null,
                tools: [],
                tags: [],
                assistantSteps: [],
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
          operationId,
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

    const where: Prisma.RecipeImportJobWhereInput = {
      sourceType: "JSON",
      ...(statusText ? { status: statusText as RecipeImportJobRow["status"] } : {})
    };
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

  async deleteRecipeImportJob(jobId: UUID, operationId: OperationId, adminId: UUID): Promise<AdminDeleteRecipeImportJobResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = String(jobId);
    const { result, tempKeys } = await this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeleteRecipeImportJobResult>(
        tx,
        operationId,
        "admin-recipe-import:delete-job",
        adminId,
        requestHash
      );
      if (repeated) return { result: repeated, tempKeys: [] };
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe-import:delete-job", adminId, requestHash);

      const job = await tx.recipeImportJob.findFirst({
        where: { id: jobId, sourceType: "JSON" },
        select: { id: true, status: true, sourceName: true }
      });
      if (!job) throw new NotFoundException("导入任务不存在");
      if (job.status === "RUNNING") throw new ConflictException("导入任务处理中，暂不能删除");

      const items = await tx.recipeImportItem.findMany({
        where: { jobId },
        select: { recipeBodyJson: true }
      });
      const tempKeys = new Set<string>();
      for (const item of items) {
        const body = normalizeRecipeImportBody(fromJson<RecipeImportRecipeBody>(item.recipeBodyJson));
        for (const key of recipeImportTempKeys(body)) tempKeys.add(key);
      }
      await tx.recipeImportJob.delete({ where: { id: jobId } });
      const result: AdminDeleteRecipeImportJobResult = {
        jobId,
        deletedAt: toIsoDate(new Date())
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_IMPORT_JOB_DELETED",
          objectType: "RECIPE_IMPORT_JOB",
          objectId: jobId,
          payload: { sourceName: job.sourceName }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe-import:delete-job", adminId, requestHash, result);
      return { result, tempKeys: Array.from(tempKeys) };
    });
    const failedTempKeys = await this.adminRecipeImageService.discardTempImages(tempKeys);
    if (failedTempKeys.length > 0) {
      await this.prisma.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_IMAGE_CLEANUP_FAILED",
          objectType: "RECIPE_IMPORT_JOB",
          objectId: jobId,
          payload: { tempKeys: failedTempKeys }
        }
      });
    }
    return result;
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

    const job = await this.prisma.recipeImportJob.findFirst({
      where: { id: jobId, sourceType: "JSON" }
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
    const item = await this.prisma.recipeImportItem.findFirst({
      where: { id: itemId, job: { sourceType: "JSON" } }
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

    const { nextItemId, staleTempKeys } = await this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<RecipeImportItemSummary>(tx, body.operationId, "admin-recipe-import:update", adminId, requestHash);
      if (repeated) {
        return { nextItemId: repeated.id, staleTempKeys: [] };
      }
      await startAdminIdempotentOperation(tx, body.operationId, "admin-recipe-import:update", adminId, requestHash);

      const currentItem = await tx.recipeImportItem.findFirst({
        where: { id: itemId, job: { sourceType: "JSON" } }
      });
      if (!currentItem) {
        throw new NotFoundException("导入条目不存在");
      }
      if (currentItem.version !== body.expectedVersion) {
        throw new ConflictException("导入条目已被更新，请刷新后重试");
      }

      const rawBody = fromJson<RecipeImportRawBody>(currentItem.rawBodyJson);
      const previousRecipeBody = normalizeRecipeImportBody(fromJson<RecipeImportRecipeBody>(currentItem.recipeBodyJson));
      const previousTempKeys = recipeImportTempKeys(previousRecipeBody);
      const nextRecipeBody = await this.prepareRecipeImportBody(tx, body.recipeBody, true);
      const nextTempKeys = recipeImportTempKeys(nextRecipeBody);
      const staleTempKeys = Array.from(previousTempKeys).filter(key => !nextTempKeys.has(key));
      const nextState = await this.buildRecipeImportItemState(tx, nextRecipeBody, rawBody);
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
      return { nextItemId: updated.id, staleTempKeys };
    });

    const failedTempKeys = await this.adminRecipeImageService.discardTempImages(staleTempKeys);
    if (failedTempKeys.length > 0) {
      await this.prisma.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_IMAGE_CLEANUP_FAILED",
          objectType: "RECIPE_IMPORT_ITEM",
          objectId: itemId,
          payload: { tempKeys: failedTempKeys }
        }
      });
    }

    const nextItem = await this.prisma.recipeImportItem.findFirst({
      where: { id: nextItemId, job: { sourceType: "JSON" } }
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
    let publicationCommitted = false;

    try {
      const repeated = await this.prisma.$transaction(tx =>
        getAdminIdempotentResult<RecipeImportItemSummary>(tx, body.operationId, "admin-recipe-import:publish", adminId, requestHash)
      );
      if (repeated) {
        const repeatedItem = await this.prisma.recipeImportItem.findFirst({ where: { id: repeated.id, job: { sourceType: "JSON" } } });
        if (!repeatedItem) throw new NotFoundException("导入条目不存在");
        return this.buildRecipeImportItemDetail(repeatedItem);
      }

      const preflight = await this.prisma.recipeImportItem.findFirst({ where: { id: itemId, job: { sourceType: "JSON" } } });
      if (!preflight) throw new NotFoundException("导入条目不存在");
      if (preflight.version !== body.expectedVersion) {
        throw new ConflictException("导入条目已被更新，请刷新后重试");
      }
      if (preflight.status === "PUBLISHED" && preflight.recipeId) {
        throw new ConflictException("该导入条目已发布");
      }
      const preflightRawBody = fromJson<RecipeImportRawBody>(preflight.rawBodyJson);
      const preflightRecipeBody = normalizeRecipeImportBody(fromJson<RecipeImportRecipeBody>(preflight.recipeBodyJson));
      const preflightState = await this.prisma.$transaction(async tx => {
        const nextState = await this.buildRecipeImportItemState(tx, preflightRecipeBody, preflightRawBody);
        if (nextState.errorItems.length > 0) {
          throw new BadRequestException("导入条目还有未补全字段，请先保存修正");
        }
        if (!preflightRecipeBody.inspirationCategoryId) {
          throw new BadRequestException("请选择系统菜谱分类");
        }
        await this.requireInspirationCategory(tx, preflightRecipeBody.inspirationCategoryId);
        return nextState;
      });

      const stagedImages = await this.stageRecipeImportImages(
        request,
        preflightRawBody,
        preflightRecipeBody,
        publishedStorageKeys,
        tempImageKeys
      );

      const publication = await this.prisma.$transaction(async tx => {
        const repeatedDuringUpload = await getAdminIdempotentResult<RecipeImportItemSummary>(tx, body.operationId, "admin-recipe-import:publish", adminId, requestHash);
        if (repeatedDuringUpload) {
          return { id: repeatedDuringUpload.id, repeated: true };
        }
        await startAdminIdempotentOperation(tx, body.operationId, "admin-recipe-import:publish", adminId, requestHash);

        const currentItem = await tx.recipeImportItem.findFirst({
          where: { id: itemId, job: { sourceType: "JSON" } }
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
        const recipeBody = normalizeRecipeImportBody(fromJson<RecipeImportRecipeBody>(currentItem.recipeBodyJson));
        const nextState = await this.buildRecipeImportItemState(tx, recipeBody, rawBody);
        if (nextState.errorItems.length > 0) {
          throw new BadRequestException("导入条目还有未补全字段，请先保存修正");
        }
        if (!recipeBody.inspirationCategoryId) {
          throw new BadRequestException("请选择系统菜谱分类");
        }

        const contentInput: AdminRecipeContentInput = {
          name: recipeBody.title.trim(),
          story: recipeBody.story,
          baseServings: recipeBody.baseServings as number,
          difficulty: recipeBody.difficulty as AdminRecipeContentInput["difficulty"],
          duration: recipeBody.duration as AdminRecipeContentInput["duration"],
          estimatedCalories: null,
          tips: recipeBody.tips,
          keywords: recipeBody.keywords,
          tools: recipeBody.tools ?? [],
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
            imageUrl: stagedImages.stepImageUrls[index] ?? null,
            imageTempKey: null
          }))
        };

        const inspirationCategory = await this.requireInspirationCategory(tx, recipeBody.inspirationCategoryId);
        const content = await this.buildAdminRecipeContent(tx, contentInput, stagedImages.stepImageUrls);
        this.assertAdminRecipeContent(content);

        const nextVersion = await tx.recipeContentVersion.create({
          data: this.buildAdminRecipeVersionCreateInput(content, stagedImages.coverImageUrl)
        });
        await loadRecipeNutritionSummary(tx, nextVersion.id, content);
        await createImportedRecipeVersionTags(tx, nextVersion.id, recipeBody.tags ?? []);
        await replaceAutoRecipeVersionTags(tx, nextVersion.id, content);
        await this.syncRecipeAssistant(tx, nextVersion.id, content, stagedImages.assistantSteps);
        let inspirationOwnerId: UUID;
        try {
          inspirationOwnerId = await pickRecipeInspirationOwner(tx);
        } catch (error) {
          if (error instanceof Error && error.message.includes("灵感菜谱归属用户池")) {
            throw new ConflictException("灵感菜谱归属用户池未完成配置，请先准备 100 个有效用户");
          }
          throw error;
        }
        const recipe = await tx.recipe.create({
          data: {
            ownerId: inspirationOwnerId,
            isInspiration: true,
            categoryId: null,
            inspirationCategoryId: inspirationCategory.id,
            currentVersionId: nextVersion.id,
            title: content.name,
            searchText: buildRecipeSearchText(content),
            coverImageUrl: stagedImages.coverImageUrl
          }
        });
        const updateResult = await tx.recipeImportItem.updateMany({
          where: { id: itemId, version: body.expectedVersion },
          data: {
            status: "PUBLISHED",
            recipeId: recipe.id,
            errorJson: toJson(nextState.errorItems.length ? nextState.errorItems : preflightState.errorItems),
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
        return { id: updated.id, repeated: false };
      });

      publicationCommitted = !publication.repeated;
      if (publication.repeated) {
        await this.adminRecipeImageService.removePublishedImages(publishedStorageKeys);
      }
      const nextItem = await this.prisma.recipeImportItem.findFirst({
        where: { id: publication.id, job: { sourceType: "JSON" } }
      });
      if (!nextItem) {
        throw new NotFoundException("导入条目不存在");
      }
      return this.buildRecipeImportItemDetail(nextItem);
    } catch (error) {
      if (!publicationCommitted) {
        await this.adminRecipeImageService.removePublishedImages(publishedStorageKeys);
      }
      throw error;
    } finally {
      const failedTempKeys = (await this.adminRecipeImageService.discardTempImages(tempImageKeys)) ?? [];
      if (failedTempKeys.length > 0) {
        await this.prisma.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "RECIPE_IMAGE_CLEANUP_FAILED",
            objectType: "RECIPE_IMPORT_ITEM",
            objectId: itemId,
            payload: { tempKeys: failedTempKeys }
          }
        });
      }
    }
  }

  private async stageRecipeImportImages(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    rawBody: RecipeImportRawBody,
    recipeBody: RecipeImportRecipeBody,
    publishedStorageKeys: string[],
    tempImageKeys: string[]
  ) {
    const imageMap = new Map(rawBody.images.map(image => [image.key, image]));
    const remoteImageCache = new Map<string, Promise<{ storageKey: string; imageUrl: string; sizeBytes?: number }>>();
    const remoteImageStartedAt = Date.now();
    let remoteImageCount = 0;
    let remoteImageBytes = 0;
    const publishRemoteImage = (scene: "COVER" | "STEP", imageUrl: string) => {
      const normalizedUrl = imageUrl.trim();
      const cacheKey = `${scene}:${normalizedUrl}`;
      const cached = remoteImageCache.get(cacheKey);
      if (cached) return cached;
      if (remoteImageCount >= maxImportRemoteImages) {
        throw new BadRequestException(`本次发布远程图片数量不能超过 ${maxImportRemoteImages} 张`);
      }
      if (Date.now() - remoteImageStartedAt >= maxImportRemoteImageBudgetMs) {
        throw new BadRequestException("本次发布远程图片处理超时");
      }
      remoteImageCount += 1;
      const published = (async () => {
        const result = await this.adminRecipeImageService.publishRemoteImage(request, scene, normalizedUrl);
        const sizeBytes = Number(result.sizeBytes) || 0;
        remoteImageBytes += sizeBytes;
        if (remoteImageBytes > maxImportRemoteImageBytes) {
          publishedStorageKeys.push(result.storageKey);
          throw new BadRequestException("本次发布远程图片总大小不能超过 100 MB");
        }
        if (Date.now() - remoteImageStartedAt >= maxImportRemoteImageBudgetMs) {
          publishedStorageKeys.push(result.storageKey);
          throw new BadRequestException("本次发布远程图片处理超时");
        }
        return result;
      })();
      remoteImageCache.set(cacheKey, published);
      return published;
    };

    let coverImageUrl: string | null = null;
    if (recipeBody.coverImageTempKey) {
      const published = await this.adminRecipeImageService.publishTempImage(request, "COVER", recipeBody.coverImageTempKey);
      tempImageKeys.push(recipeBody.coverImageTempKey);
      publishedStorageKeys.push(published.storageKey);
      coverImageUrl = published.imageUrl;
    } else if (recipeBody.coverImageKey) {
      const image = imageMap.get(recipeBody.coverImageKey);
      if (!image) throw new BadRequestException("封面图片不存在");
      const buffer = await readImageBuffer(rawBody.assetFolder, image.fileName);
      const published = await this.adminRecipeImageService.publishImageBuffer(request, "COVER", buffer);
      publishedStorageKeys.push(published.storageKey);
      coverImageUrl = published.imageUrl;
    } else if (recipeBody.coverImageUrl) {
      const published = await publishRemoteImage("COVER", recipeBody.coverImageUrl);
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
        if (!step.imageUrl) {
          stepImageUrls.push(null);
          continue;
        }
        const published = await publishRemoteImage("STEP", step.imageUrl);
        publishedStorageKeys.push(published.storageKey);
        stepImageUrls.push(published.imageUrl);
        continue;
      }
      const image = imageMap.get(step.imageKey);
      if (!image) throw new BadRequestException("步骤图片不存在");
      const buffer = await readImageBuffer(rawBody.assetFolder, image.fileName);
      const published = await this.adminRecipeImageService.publishImageBuffer(request, "STEP", buffer);
      publishedStorageKeys.push(published.storageKey);
      stepImageUrls.push(published.imageUrl);
    }

    const assistantSteps: NonNullable<RecipeImportRecipeBody["assistantSteps"]> = [];
    for (const assistantStep of recipeBody.assistantSteps ?? []) {
      if (!assistantStep.imageUrl) {
        assistantSteps.push(assistantStep);
        continue;
      }
      const published = await publishRemoteImage("STEP", assistantStep.imageUrl);
      publishedStorageKeys.push(published.storageKey);
      assistantSteps.push({ ...assistantStep, imageUrl: published.imageUrl });
    }

    return { coverImageUrl, stepImageUrls, assistantSteps };
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
      isInspiration: true,
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
        orderBy: [{ blockedAt: { sort: "asc", nulls: "first" } }, { updatedAt: "desc" }],
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
        await this.syncRecipeAssistant(tx, nextVersion.id, content);

        const created = await tx.recipe.create({
          data: {
            ownerId: null,
            isInspiration: true,
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

        const result = await this.toAdminRecipeDetail(tx, created);
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
        isInspiration: true,
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
            isInspiration: true,
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

  async deleteInspirationCategory(
    categoryId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    adminId: UUID
  ): Promise<AdminDeleteInspirationCategoryResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${categoryId}:${expectedVersion}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeleteInspirationCategoryResult>(
        tx,
        operationId,
        "admin-inspiration-category:delete",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-inspiration-category:delete", adminId, requestHash);

      const category = await this.requireInspirationCategory(tx, categoryId);
      if (category.version !== expectedVersion) throw new ConflictException("系统菜谱分类已被更新，请刷新后重试");
      const [recipeCount, recommendationCount] = await Promise.all([
        tx.recipe.count({ where: { inspirationCategoryId: categoryId } }),
        tx.recipeRecommendation.count({ where: { suggestedCategoryId: categoryId } })
      ]);
      if (recipeCount > 0 || recommendationCount > 0) {
        throw new ConflictException("该分类仍被菜谱或审核记录使用，不能删除");
      }

      await tx.inspirationCategory.delete({ where: { id: categoryId } });
      const result: AdminDeleteInspirationCategoryResult = {
        categoryId,
        deletedAt: toIsoDate(new Date())
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INSPIRATION_CATEGORY_DELETED",
          objectType: "INSPIRATION_CATEGORY",
          objectId: categoryId,
          payload: { name: category.name }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-inspiration-category:delete", adminId, requestHash, result);
      return result;
    });
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
            isInspiration: true,
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
    return this.toAdminRecipeDetail(this.prisma, recipe);
  }

  async regenerateRecipeAssistant(recipeId: UUID, adminId: UUID, operationId: OperationId): Promise<AdminRecipeDetail> {
    await this.requireSuperAdmin(adminId);
    const requestHash = String(recipeId);
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminRecipeDetail>(
        tx,
        operationId,
        "admin-recipe-assistant:regenerate",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe-assistant:regenerate", adminId, requestHash);

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
      if (!recipe || !recipe.isInspiration || !recipe.inspirationCategoryId) {
        throw new NotFoundException("系统菜谱不存在");
      }

      const content = versionToContent(recipe.currentVersion);
      const assistantState = await this.syncRecipeAssistant(tx, recipe.currentVersionId, content);
      const result = await this.toAdminRecipeDetail(tx, recipe);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_ASSISTANT_REGENERATED",
          objectType: "RECIPE",
          objectId: recipeId,
          payload: {
            contentVersionId: recipe.currentVersionId,
            assistantStatus: assistantState.status,
            hasSnapshot: assistantState.hasSnapshot,
            lastError: assistantState.lastError
          }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe-assistant:regenerate", adminId, requestHash, result);
      return result;
    });
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
        if (!recipe || !recipe.isInspiration || !recipe.inspirationCategoryId) {
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
        const contentInput = body.content.tools === undefined
          ? { ...body.content, tools: versionToContent(recipe.currentVersion).tools ?? [] }
          : body.content;
        const content = await this.buildAdminRecipeContent(tx, contentInput, imageState.stepImageUrls);
        this.assertAdminRecipeContent(content);

        const nextVersion = await tx.recipeContentVersion.create({
          data: this.buildAdminRecipeVersionCreateInput(content, imageState.coverImageUrl)
        });
        await replaceAutoRecipeVersionTags(tx, nextVersion.id, content);
        await this.syncRecipeAssistant(tx, nextVersion.id, content);

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

        const result = await this.toAdminRecipeDetail(tx, updated);
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
        where: { id: recipeId, isInspiration: true, inspirationCategoryId: { not: null }, status: "ACTIVE" },
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
        where: { id: recipeId, isInspiration: true, inspirationCategoryId: { not: null }, status: "BLOCKED" },
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

  async deleteBlockedRecipe(
    recipeId: UUID,
    operationId: OperationId,
    expectedVersion: number,
    adminId: UUID
  ): Promise<AdminDeleteRecipeResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${recipeId}:${expectedVersion}`;
    const deletion = await this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeleteRecipeResult>(
        tx,
        operationId,
        "admin-recipe:delete",
        adminId,
        requestHash
      );
      if (repeated) return { result: repeated, storageKeys: [] as string[] };
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe:delete", adminId, requestHash);

      const recipe = await tx.recipe.findFirst({
        where: {
          id: recipeId,
          isInspiration: true,
          status: "BLOCKED"
        },
        select: {
          id: true,
          title: true,
          version: true,
          coverImageUrl: true,
          originCoverImageUrl: true,
          currentVersionId: true,
          currentVersion: {
            select: {
              id: true,
              imagesJson: true,
              cookAssistant: {
                select: { snapshotJson: true }
              }
            }
          }
        }
      });
      if (!recipe) throw new NotFoundException("下架系统菜谱不存在");
      if (recipe.version !== expectedVersion) throw new ConflictException("菜谱已被更新，请刷新后重试");

      const [collectionCount, homeTopicCount, mealPlanCount, diningParticipantCount, versionCollectionCount, versionTopicCount, versionMealPlanCount, versionParticipantCount, versionWishCount, versionMenuCount, shoppingCount] = await Promise.all([
        tx.recipeCollection.count({ where: { sourceRecipeId: recipeId } }),
        tx.homeTopicItem.count({ where: { recipeId } }),
        tx.mealPlanDish.count({ where: { recipeId } }),
        tx.diningEventParticipant.count({ where: { bringRecipeId: recipeId } }),
        tx.recipeCollection.count({ where: { sourceVersionId: recipe.currentVersionId } }),
        tx.homeTopicItem.count({ where: { sourceVersionId: recipe.currentVersionId } }),
        tx.mealPlanDish.count({ where: { recipeVersionId: recipe.currentVersionId } }),
        tx.diningEventParticipant.count({ where: { bringVersionId: recipe.currentVersionId } }),
        tx.diningEventWishItem.count({ where: { recipeVersionId: recipe.currentVersionId } }),
        tx.diningEventMenuItem.count({ where: { recipeVersionId: recipe.currentVersionId } }),
        tx.shoppingItem.count({ where: { sourceRecipeVersionId: recipe.currentVersionId } })
      ]);
      if (
        collectionCount > 0 ||
        homeTopicCount > 0 ||
        mealPlanCount > 0 ||
        diningParticipantCount > 0 ||
        versionCollectionCount > 0 ||
        versionTopicCount > 0 ||
        versionMealPlanCount > 0 ||
        versionParticipantCount > 0 ||
        versionWishCount > 0 ||
        versionMenuCount > 0 ||
        shoppingCount > 0
      ) {
        throw new ConflictException("该下架菜谱仍被业务数据引用，不能物理删除");
      }

      const storageKeys = this.collectRecipeImageStorageKeys(recipe);
      await tx.recipe.delete({ where: { id: recipeId } });
      await tx.recipeContentVersion.deleteMany({
        where: {
          id: recipe.currentVersionId,
          currentRecipes: { none: {} },
          originRecipes: { none: {} },
          collections: { none: {} },
          homeTopicItems: { none: {} },
          shoppingSourceItems: { none: {} },
          mealPlanDishes: { none: {} },
          mealPollCandidates: { none: {} },
          diningEventParticipants: { none: {} },
          diningEventMenuItems: { none: {} },
          diningEventWishItems: { none: {} },
          uploadAssets: { none: {} }
        }
      });
      const result: AdminDeleteRecipeResult = {
        recipeId,
        deletedAt: toIsoDate(new Date())
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_DELETED",
          objectType: "RECIPE",
          objectId: recipeId,
          payload: { title: recipe.title, source: "BLOCKED_INSPIRATION" }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe:delete", adminId, requestHash, result);
      return { result, storageKeys };
    });
    const failedStorageKeys = await this.adminRecipeImageService.removePublishedImages(deletion.storageKeys);
    if (failedStorageKeys.length > 0) {
      await this.prisma.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_IMAGE_CLEANUP_FAILED",
          objectType: "RECIPE",
          objectId: recipeId,
          payload: { storageKeys: failedStorageKeys }
        }
      });
    }
    return deletion.result;
  }

  private collectRecipeImageStorageKeys(recipe: {
    coverImageUrl?: string | null;
    originCoverImageUrl?: string | null;
    currentVersion: { imagesJson: unknown; cookAssistant?: { snapshotJson: unknown } | null };
  }) {
    const urls: string[] = [];
    const collect = (value: unknown) => {
      if (typeof value === "string") {
        urls.push(value);
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) collect(item);
        return;
      }
      if (value && typeof value === "object") {
        for (const item of Object.values(value)) collect(item);
      }
    };
    collect(recipe.coverImageUrl);
    collect(recipe.originCoverImageUrl);
    collect(recipe.currentVersion.imagesJson);
    collect(recipe.currentVersion.cookAssistant?.snapshotJson);
    return Array.from(new Set(urls.map(url => this.adminRecipeImageService.publishedStorageKeyFromUrl(url)).filter((key): key is string => Boolean(key))));
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
    version: number;
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
      version: recipe.version,
      inspirationCategoryId: recipe.inspirationCategoryId,
      inspirationCategoryName: recipe.inspirationCategory.name,
      updatedAt: toIsoDate(recipe.updatedAt),
      ownerUid: recipe.owner?.uid ?? null
    };
  }

  private async toAdminRecipeDetail(tx: Prisma.TransactionClient | PrismaService, recipe: AdminRecipeRow): Promise<AdminRecipeDetail> {
    const content = versionToContent(recipe.currentVersion);
    const assistantRecord = await this.loadRecipeAssistantRecord(tx, recipe.currentVersionId);
    const assistant = versionAssistantToSnapshot(assistantRecord);
    const [tags, nutrition] = await Promise.all([
      this.loadRecipeWikiTags(tx, recipe.currentVersionId, content),
      loadRecipeNutritionSummary(tx, recipe.currentVersionId, content)
    ]);
    const nutritionSnapshot = await tx.recipeNutritionSnapshot.findUnique({
      where: { recipeVersionId: recipe.currentVersionId },
      select: { coverageRate: true }
    });
    const wikiNutrition: AdminRecipeWikiNutrition = {
      ...nutrition,
      coverageRate: nutritionSnapshot?.coverageRate ?? null
    };
    const wiki: AdminRecipeWiki = {
      tags,
      nutrition: wikiNutrition,
      qualityCards: buildRecipeWikiQualityCards({ content, tags, nutrition, assistant })
    };
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
      assistantState: this.toRecipeAssistantState(assistantRecord),
      assistant,
      wiki,
      version: recipe.version,
      reportCount: recipe.reportCount,
      blockedReason: recipe.blockedReason,
      collectCount: recipe.collectCount,
      canEdit: isAdminEditableInspiration(recipe),
      createdAt: toIsoDate(recipe.createdAt),
      updatedAt: toIsoDate(recipe.updatedAt)
    };
  }

  private async loadRecipeWikiTags(
    tx: Prisma.TransactionClient | PrismaService,
    recipeVersionId: UUID,
    content: RecipeContentSnapshot
  ): Promise<AdminRecipeWikiTag[]> {
    const rows = await tx.recipeVersionTag.findMany({
      where: { recipeVersionId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        tagCode: true,
        tagValue: true,
        source: true,
        status: true,
        confidence: true,
        sortOrder: true,
        isLocked: true
      }
    });
    return rows.map(row => ({
      tagCode: row.tagCode,
      tagValue: row.tagValue,
      displayValue: this.recipeWikiTagDisplayValue(row.tagCode, row.tagValue, content),
      source: row.source,
      status: row.status,
      confidence: row.confidence === null ? null : Number(row.confidence),
      sortOrder: row.sortOrder,
      isLocked: row.isLocked
    }));
  }

  private recipeWikiTagDisplayValue(tagCode: string, tagValue: string, content: RecipeContentSnapshot) {
    const display: Record<string, Record<string, string>> = {
      CUISINE: {
        SICHUAN_HUNAN: "川湘菜",
        JIANG_ZHE: "江浙菜",
        CANTONESE: "粤菜",
        FUJIAN: "闽菜",
        NORTHERN: "北方菜",
        YUN_GUI: "云贵菜",
        TAIWAN: "台湾菜",
        FUSION: "融合菜",
        OTHER: "其他菜系（待人工确认）"
      },
      DISH_STYLE: {
        STIR_FRY: "炒菜",
        COLD_DISH: "凉菜",
        SOUP: "汤羹",
        STAPLE_FOOD: "主食",
        STEW: "炖煮",
        STEAMED: "蒸菜",
        BRAISED: "卤味",
        FRIED: "煎炸",
        BBQ: "烧烤",
        HOT_POT: "火锅",
        SNACK: "小吃点心"
      },
      MEAL_TYPE: {
        BREAKFAST: "早餐",
        LUNCH: "午餐",
        AFTERNOON_TEA: "下午茶",
        DINNER: "晚餐",
        LATE_NIGHT: "夜宵"
      },
      DISH_ROLE: {
        MAIN: "荤菜/主菜",
        VEGETABLE: "素菜",
        COLD_DISH: "凉菜",
        SOUP: "汤",
        STAPLE: "主食"
      },
      MAIN_PROTEIN_TYPE: {
        PORK: "猪肉",
        CHICKEN: "鸡肉",
        BEEF: "牛肉",
        LAMB: "羊肉",
        DUCK: "鸭肉",
        FISH: "鱼类",
        NONE: "无主蛋白"
      },
      FLAVOR_PROFILE: {
        LIGHT: "清淡",
        MILD: "温和",
        SPICY: "辛辣",
        SOUR: "酸味",
        SWEET: "甜味"
      },
      SPICE_LEVEL: {
        NONE: "不辣",
        MILD: "微辣",
        MEDIUM: "中辣",
        HOT: "重辣"
      }
    };
    if (tagCode === "PRIMARY_INGREDIENT") {
      const ingredient = content.ingredients.find(item => String(item.ingredientId) === tagValue);
      return ingredient?.ingredientName ?? `食材 ID ${tagValue}`;
    }
    return display[tagCode]?.[tagValue] ?? tagValue;
  }

  private async loadRecipeAssistantRecord(tx: Prisma.TransactionClient | PrismaService, recipeVersionId: UUID) {
    return tx.recipeCookAssistant.findUnique({
      where: { recipeVersionId }
    });
  }

  private toRecipeAssistantState(record: RecipeAssistantRecord | null): AdminRecipeDetail["assistantState"] {
    if (!record) {
      return {
        status: "MISSING",
        hasSnapshot: false,
        generatedAt: null,
        lastAttemptAt: null,
        attemptCount: 0,
        lastError: null
      };
    }

    return {
      status: record.status,
      hasSnapshot: Boolean(record.generatedAt && record.snapshotJson != null),
      generatedAt: record.generatedAt ? toIsoDate(record.generatedAt) : null,
      lastAttemptAt: toIsoDate(record.lastAttemptAt),
      attemptCount: record.attemptCount,
      lastError: record.lastError
    };
  }

  private toRecipeImportJobSummary(job: RecipeImportJobRow): RecipeImportJobSummary {
    return {
      id: job.id,
      sourceType: "JSON",
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
    const recipeBody = normalizeRecipeImportBody(fromJson<RecipeImportRecipeBody>(item.recipeBodyJson));
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

  private async prepareRecipeImportBody(
    tx: Prisma.TransactionClient,
    body: RecipeImportRecipeBody,
    strictMatch = false
  ): Promise<RecipeImportRecipeBody> {
    const nextBody: RecipeImportRecipeBody = {
      inspirationCategoryId: body.inspirationCategoryId ?? null,
      title: body.title.trim(),
      story: body.story?.trim() || null,
      baseServings: body.baseServings ?? null,
      difficulty: body.difficulty ?? null,
      duration: body.duration ?? null,
      tips: body.tips?.trim() || null,
      keywords: Array.from(new Set(body.keywords.map(item => item.trim()).filter(Boolean))),
      coverImageUrl: body.coverImageUrl?.trim() || null,
      coverImageKey: body.coverImageKey?.trim() || null,
      coverImageTempKey: body.coverImageTempKey?.trim() || null,
      tools: body.tools?.map(item => ({ name: item.name.trim() })) ?? [],
      tags: body.tags ?? [],
      assistantSteps: body.assistantSteps ?? [],
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
        imageUrl: item.imageUrl?.trim() || null,
        imageKey: item.imageKey?.trim() || null,
        imageTempKey: item.imageTempKey?.trim() || null
      }))
    };
    if (!strictMatch) {
      nextBody.ingredients = await this.materializeImportIngredients(tx, nextBody.ingredients);
    }
    return nextBody;
  }

  private async refreshRecipeImportIngredientReferences(
    tx: Prisma.TransactionClient,
    sourceIngredientId: UUID,
    targetIngredient: { id: UUID; name: string }
  ) {
    const items = await tx.recipeImportItem.findMany({
      where: {
        job: { sourceType: "JSON" },
        status: { not: "PUBLISHED" }
      },
      select: {
        id: true,
        jobId: true,
        version: true,
        rawBodyJson: true,
        recipeBodyJson: true
      }
    });
    const jobIds = new Set<UUID>();
    for (const item of items) {
      const recipeBody = normalizeRecipeImportBody(fromJson<RecipeImportRecipeBody>(item.recipeBodyJson));
      let changed = false;
      const nextIngredients = recipeBody.ingredients.map(ingredient => {
        if (ingredient.ingredientId !== sourceIngredientId) return ingredient;
        changed = true;
        return {
          ...ingredient,
          ingredientId: targetIngredient.id,
          ingredientName: targetIngredient.name
        };
      });
      if (!changed) continue;

      const nextBody = {
        ...recipeBody,
        ingredients: nextIngredients
      };
      const rawBody = fromJson<RecipeImportRawBody>(item.rawBodyJson);
      const nextState = await this.buildRecipeImportItemState(tx, nextBody, rawBody);
      const updateResult = await tx.recipeImportItem.updateMany({
        where: {
          id: item.id,
          version: item.version
        },
        data: {
          recipeBodyJson: toJson(nextBody),
          status: nextState.errorItems.length > 0 ? "NEEDS_FIX" : "READY",
          errorJson: toJson(nextState.errorItems),
          warnJson: toJson(nextState.warnItems),
          version: { increment: 1 }
        }
      });
      if (updateResult.count !== 1) {
        throw new ConflictException("导入条目已被更新，请刷新后重试");
      }
      jobIds.add(item.jobId);
    }
    for (const jobId of jobIds) {
      await this.writeRecipeImportJobStats(tx, jobId);
    }
  }

  private async buildRecipeImportItemState(
    tx: Prisma.TransactionClient,
    recipeBody: RecipeImportRecipeBody,
    rawBody: RecipeImportRawBody
  ) {
    const nextState = rebuildJsonItemState(recipeBody);
    const ingredientIds = Array.from(new Set(recipeBody.ingredients.map(item => item.ingredientId).filter((value): value is UUID => value !== null)));
    const unitIds = Array.from(new Set(recipeBody.ingredients.map(item => item.unitId).filter((value): value is UUID => value !== null)));
    const [ingredientRows, unitRows] = await Promise.all([
      ingredientIds.length === 0
        ? []
        : tx.ingredient.findMany({
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
    const ingredientMap = new Map(ingredientRows.map(item => [item.id, item]));
    const unitMap = new Map(unitRows.map(item => [item.id, item]));
    recipeBody.ingredients.forEach((item, index) => {
      if (item.ingredientId) {
        const ingredient = ingredientMap.get(item.ingredientId);
        const rowLabel = `ingredients.${index}.ingredientId`;
        if (!ingredient || ingredient.status !== "ACTIVE") {
          nextState.errorItems.push({ field: rowLabel, message: `第 ${index + 1} 行食材不存在或已下架` });
        } else {
          if (buildSearchKey(item.ingredientName) !== buildSearchKey(ingredient.name)) {
            nextState.errorItems.push({ field: `ingredients.${index}.ingredientName`, message: `第 ${index + 1} 行食材名称未严格匹配系统食材` });
          }
          if (!ingredient.category.isSelectable) {
            nextState.errorItems.push({ field: rowLabel, message: `第 ${index + 1} 行食材仍在待归类，请先到食材管理完成归类` });
          }
        }
      }
      if (item.unitId) {
        const unit = unitMap.get(item.unitId);
        if (!unit) {
          nextState.errorItems.push({ field: `ingredients.${index}.unitId`, message: `第 ${index + 1} 行单位不存在` });
        } else if (item.unitText && buildSearchKey(item.unitText) !== buildSearchKey(unit.name)) {
          nextState.errorItems.push({ field: `ingredients.${index}.unitText`, message: `第 ${index + 1} 行单位未严格匹配系统单位` });
        }
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
      if (isImportedIngredientPlaceholder(item.ingredientName)) {
        nextRows.push({ ...item, ingredientId: null });
        continue;
      }
      if (item.ingredientId || !item.unitId || !item.ingredientName.trim()) {
        nextRows.push(item);
        continue;
      }
      const searchKey = buildSearchKey(item.ingredientName);
      const existing = await tx.ingredient.findFirst({
        where: {
          ownerId: null,
          status: {
            in: ["ACTIVE", "DISABLED", "PENDING"]
          },
          searchKey
        },
        include: {
          category: true
        }
      });
      if (existing) {
        if (existing.status === "DISABLED") {
          nextRows.push({ ...item, ingredientId: null });
          continue;
        }
        const activeIngredient = existing;
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
          status: "PENDING",
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
      keywords: Array.from(new Set(content.keywords.map(item => item.trim()).filter(Boolean))),
      tools: content.tools?.map(item => ({ name: item.name.trim() })).filter(item => item.name) ?? [],
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
      keywordsJson: toJson(content.keywords),
      toolsJson: toJson(content.tools ?? []),
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

  private async syncRecipeAssistant(
    tx: Prisma.TransactionClient,
    recipeVersionId: UUID,
    content: RecipeContentSnapshot,
    importedSteps: RecipeImportRecipeBody["assistantSteps"] = []
  ) {
    const attemptedAt = new Date();

    try {
      const snapshot = importedSteps.length > 0
        ? buildImportedRecipeAssistantSnapshot(importedSteps)
        : buildRecipeAssistantSnapshot(content);
      await tx.recipeCookAssistant.upsert({
        where: { recipeVersionId },
        update: {
          status: "READY",
          snapshotJson: toJson(snapshot),
          generatedAt: attemptedAt,
          lastAttemptAt: attemptedAt,
          attemptCount: { increment: 1 },
          lastError: null
        },
        create: {
          recipeVersionId,
          status: "READY",
          snapshotJson: toJson(snapshot),
          generatedAt: attemptedAt,
          lastAttemptAt: attemptedAt,
          attemptCount: 1,
          lastError: null
        }
      });
    } catch (error) {
      const lastError = normalizeRecipeAssistantError(error);
      await tx.recipeCookAssistant.upsert({
        where: { recipeVersionId },
        update: {
          status: "FAILED",
          lastAttemptAt: attemptedAt,
          attemptCount: { increment: 1 },
          lastError
        },
        create: {
          recipeVersionId,
          status: "FAILED",
          snapshotJson: Prisma.DbNull,
          generatedAt: null,
          lastAttemptAt: attemptedAt,
          attemptCount: 1,
          lastError
        }
      });
    }

    const record = await this.loadRecipeAssistantRecord(tx, recipeVersionId);
    return this.toRecipeAssistantState(record);
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
      keywords: content.keywords,
      estimatedCalories: content.estimatedCalories,
      category: recipe.category ? toRecipeCategorySummary(recipe.category) : null,
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

  private assertUserPassword(password: string) {
    const message = passwordPolicyError(password);
    if (message) throw new BadRequestException(message);
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
      throw new NotFoundException("待审核食材不存在");
    }
    return recommendation;
  }

  private async findPendingImportedIngredient(tx: Prisma.TransactionClient, ingredientId: UUID) {
    return tx.ingredient.findFirst({
      where: {
        id: ingredientId,
        ownerId: null,
        status: "PENDING"
      },
      include: {
        category: true,
        defaultUnit: true,
        owner: {
          select: {
            id: true,
            uid: true,
            nickname: true
          }
        }
      }
    });
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
      throw new NotFoundException("食材纠错不存在");
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
      throw new NotFoundException("待审核菜谱不存在");
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

  private async hasDraftIngredientReference(tx: Prisma.TransactionClient, ingredientId: UUID) {
    const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM "recipe_drafts" AS draft
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(draft."content_json"->'ingredients', '[]'::jsonb)) AS item
        WHERE item->>'ingredientId' = ${String(ingredientId)}
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

  private async hasRecipeVersionIngredientReference(tx: Prisma.TransactionClient, ingredientId: UUID) {
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
        WHERE item->>'ingredientId' = ${String(ingredientId)}
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
        const uid = this.createUid();
        return await tx.user.create({
          data: {
            uid,
            cookNo: String(uid),
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
            cookNo: true,
            bio: true,
            gender: true,
            birthDate: true,
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
        if (!targets.includes("uid") && !targets.includes("cook_no") && !targets.includes("cookNo")) {
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
          cookNo: true,
          bio: true,
          gender: true,
          birthDate: true,
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
