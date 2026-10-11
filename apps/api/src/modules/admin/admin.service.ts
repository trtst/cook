import { createHash, randomInt } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { Prisma, type IngredientStatus, type RecipeStatus } from "@prisma/client";
import { recipeDifficultyText, recipeDurationText } from "../../common/display-text";
import type { RecipeImagePosition } from "../../common/recipe-image-name";
import { maskPhone } from "../../common/phone";
import type {
  AdminRecipeContentInput,
  AdminDashboardSummary,
    AdminInspirationCategoryPayloadRequest,
    AdminInspirationCategorySummary,
    AdminPendingUnitRecommendationSummary,
    AdminPendingRecipeSummary,
  AdminRecipeDetail,
  AdminRecipeImageBackfillRequest,
  AdminRecipeImageBackfillResult,
  AdminRecipeImageExportItem,
  AdminRecipeImportContentSyncResult,
  AdminRecipeWiki,
  AdminRecipeWikiNutrition,
  AdminRecipeWikiTag,
  AdminDeleteIngredientCategoryResult,
    AdminDeleteIngredientResult,
    AdminIngredientMergeResult,
    AdminDeletePendingIngredientResult,
    AdminDeletePendingItemResult,
    AdminDeleteInspirationCategoryResult,
    AdminDeleteRecipeImportJobResult,
    AdminDeleteRecipeImportItemResult,
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
  MergeAdminIngredientRequest,
  SetAdminIngredientCategoryStatusRequest,
  AdminUnitPayloadRequest,
  AdminUnitSummary,
  AdminResetUserPasswordResponse,
  AdminRecipeSummary,
  ConfirmAdminRecipeWikiCandidatesResult,
  UpdateAdminRecipeWikiCandidateRequest,
  AdminRecipeWikiSummary,
  AdminRecipeWikiExportDocument,
  AdminRecipeWikiBatchExportDocument,
  AdminRecipeWikiRevisionExportDocument,
  AdminRecipeWikiImportResult,
  AdminRecipeWikiDismissResult,
  AdminRecipeWikiDismissBatchResult,
  AdminRecipeWikiRejectResult,
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
  RecipeImportTagDraft,
  RecipeIngredientInput,
  RecipeSceneSummary,
  RecipeReportSummary,
  ReorderItem,
  ResetAdminUserPasswordRequest,
  SetAdminUserStatusRequest,
  UnitSummary,
  UpdateAdminUnitRequest,
  UpdateAdminInspirationCategoryRequest,
  UpdateAdminIngredientCategoryRequest,
  UpdateAdminIngredientRequest,
  UpdateAdminIngredientNutritionRequest,
  UpdateRecipeImportItemRequest,
  RecipeImportAssistantStepDraft,
  UpdateAdminRecipeRequest,
  UpdateAdminUserRequest,
  UserProfile,
  UUID,
  PublishRecipeImportItemRequest
} from "../../contracts/types";
import { PrismaService } from "../../common/prisma.service";
import { invalidateMergedIngredientRecommendationCaches } from "./ingredient-merge-cache";
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
  buildIngredientSearchWhere,
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
import { pickPublicContentOwner } from "../recipe/public-content-user-pool";
import { indexRecipeVersionIngredients } from "../recipe/recipe-version-ingredients";
import { toOwnerNicknameSnapshot } from "../recipe/recipe-owner-snapshot";
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
import { parseRecipeWikiDocument, type RecipeWikiImportItem, type RecipeWikiReplaceField } from "./recipe-wiki-json";

function toIsoDate(value: Date) {
  return value.toISOString();
}

const maxImportRemoteImages = 50;
const maxImportRemoteImageBytes = 100 * 1024 * 1024;
const maxImportRemoteImageBudgetMs = 2 * 60 * 1000;
const recipeWikiTagCodes = [
  "CUISINE",
  "DISH_STYLE",
  "MEAL_TYPE",
  "DISH_ROLE",
  "MAIN_PROTEIN_TYPE",
  "FLAVOR_PROFILE",
  "SPICE_LEVEL"
] as const;
const recipeWikiReplaceFields: RecipeWikiReplaceField[] = [
  "name", "story", "difficulty", "duration", "tips", "keywords", "ingredients", "tools", "steps", "tags", "assistant.steps"
];

function parseRecipeWikiReplaceFields(value?: string): Set<RecipeWikiReplaceField> {
  if (value === undefined) return new Set(["tags", "assistant.steps"]);
  let fields: unknown;
  try {
    fields = JSON.parse(value) as unknown;
  } catch {
    throw new BadRequestException("替换字段格式不正确");
  }
  if (!Array.isArray(fields) || fields.length === 0 || fields.some(field => !recipeWikiReplaceFields.includes(field as RecipeWikiReplaceField))) {
    throw new BadRequestException("请选择至少一个有效替换字段");
  }
  const unique = new Set(fields as RecipeWikiReplaceField[]);
  if (unique.size !== fields.length) throw new BadRequestException("替换字段不能重复");
  return unique;
}

export function isValidWikiRecipeQuantity(value: string) {
  const quantity = value.trim();
  return /^\d+(?:\.\d+)?$/.test(quantity) && Number.isFinite(Number(quantity)) && Number(quantity) > 0;
}

function recipeImportTempKeys(body: RecipeImportRecipeBody) {
  return new Set(
    [body.coverImageTempKey, ...body.steps.map(step => step.imageTempKey), ...(body.assistantSteps ?? []).map(step => step.imageTempKey)]
      .map(value => value?.trim())
      .filter((value): value is string => Boolean(value))
  );
}

function readRecipeImportPrompts(jsonText: string) {
  const empty = {
    steps: [] as Array<{ text: string | null; imagePrompt: string | null }>,
    assistantSteps: [] as Array<{ text: string | null; imagePrompt: string | null }>
  };
  try {
    const document: unknown = JSON.parse(jsonText);
    if (!document || typeof document !== "object" || Array.isArray(document)) return empty;
    const root = document as Record<string, unknown>;
    const recipe = root.recipe;
    const wiki = root.wiki;
    if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) return empty;
    const content = (recipe as Record<string, unknown>).content;
    if (!content || typeof content !== "object" || Array.isArray(content)) return empty;
    const assistant = wiki && typeof wiki === "object" && !Array.isArray(wiki)
      ? (wiki as Record<string, unknown>).assistant
      : null;
    const rawSteps = (content as Record<string, unknown>).steps;
    const rawAssistantSteps = assistant && typeof assistant === "object" && !Array.isArray(assistant)
      ? (assistant as Record<string, unknown>).steps
      : null;
    const readSteps = (rows: unknown) => {
      if (!Array.isArray(rows)) return [] as Array<{ text: string | null; imagePrompt: string | null }>;
      return rows.map(step => {
        if (!step || typeof step !== "object" || Array.isArray(step)) return { text: null, imagePrompt: null };
        const row = step as Record<string, unknown>;
        return {
          text: typeof row.text === "string" ? row.text.trim() : null,
          imagePrompt: typeof row.imagePrompt === "string" && row.imagePrompt.trim() ? row.imagePrompt.trim() : null
        };
      });
    };
    return {
      steps: readSteps(rawSteps),
      assistantSteps: readSteps(rawAssistantSteps)
    };
  } catch {
    return empty;
  }
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

export function safeRecipeWikiImportErrorMessage(error: unknown) {
  return error instanceof HttpException ? error.message : "Wiki 导入失败";
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
  publicContentPoolMember?: { userId: UUID } | null;
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
    isPublicContentPoolMember: Boolean(user.publicContentPoolMember),
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
}> & {
  mergedTo?: { id: UUID; name: string } | null;
};
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
    defaultUnitId: UUID | null;
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
    status: ingredient.status,
    categoryId: ingredient.categoryId,
    categoryName: ingredient.category.name,
    defaultUnit: ingredient.defaultUnit ? toUnitSummary(ingredient.defaultUnit) : null,
    mergedTo: ingredient.mergedTo ? { id: ingredient.mergedTo.id, name: ingredient.mergedTo.name } : null,
    proteinType: ingredient.proteinType as IngredientProteinType | null,
    isStaple: ingredient.isStaple,
    isSpicyIngredient: ingredient.isSpicyIngredient,
    aliases: ingredient.aliases,
    imageUrl: ingredient.imageUrl,
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
        take: normalizedPageSize,
        include: { publicContentPoolMember: { select: { userId: true } } }
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
          publicContentPoolMember: { select: { userId: true } },
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
          publicContentPoolMember: { select: { userId: true } },
          createdAt: true,
          updatedAt: true
        }
      });
      if (!current) throw new NotFoundException("用户不存在");
      if (body.status === "DISABLED" && current.publicContentPoolMember) {
        throw new ConflictException("公共内容用户池成员不能禁用");
      }

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
                publicContentPoolMember: { select: { userId: true } },
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

      const resolved = await this.entitlementService.resolveForUser(tx, userId);

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
      const [publishedCount, draftCount, savedInspirationCount, latestRecipe, latestDraft, latestSavedInspiration] = await Promise.all([
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
        savedInspirationCount,
        latestPublishedAt: latestRecipe ? toIsoDate(latestRecipe.updatedAt) : null,
        latestDraftAt: latestDraft ? toIsoDate(latestDraft.updatedAt) : null,
        latestSavedInspirationAt: latestSavedInspiration ? toIsoDate(latestSavedInspiration.updatedAt) : null
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

    const governedCounts = await this.prisma.ingredient.groupBy({
      by: ["categoryId"],
      where: {
        ownerId: null,
        status: {
          in: ["ACTIVE", "DISABLED", "MERGED"]
        },
        categoryId: {
          in: categories.map(item => item.id)
        }
      },
      _count: {
        _all: true
      }
    });
    const unclassifiedCategoryIds = categories.filter(item => item.code === "UNCLASSIFIED").map(item => item.id);
    const pendingCounts = unclassifiedCategoryIds.length
      ? await this.prisma.ingredient.groupBy({
          by: ["categoryId"],
          where: {
            ownerId: null,
            status: "PENDING",
            categoryId: { in: unclassifiedCategoryIds }
          },
          _count: {
            _all: true
          }
        })
      : [];
    const countMap = new Map(governedCounts.map(item => [item.categoryId, item._count._all]));
    for (const item of pendingCounts) {
      countMap.set(item.categoryId, (countMap.get(item.categoryId) ?? 0) + item._count._all);
    }
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
    adminId: UUID,
    imageStatus?: string
  ): Promise<PageResult<AdminIngredientSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = toPositiveInt(pageSize, 20);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedKeyword = keyword?.trim();
    const normalizedStatus = status === "PENDING" || status === "DISABLED" || status === "MERGED" || status === "ALL" ? status : "ACTIVE";
    const normalizedFactStatus = factStatus === "MISSING" ? "MISSING" : "ALL";
    const normalizedImageStatus = imageStatus === "MISSING" ? "MISSING" : "ALL";
    const where: Prisma.IngredientWhereInput = {
      ownerId: null,
      status:
        normalizedStatus === "ALL"
          ? {
              in: ["PENDING", "ACTIVE", "DISABLED", "MERGED"]
            }
          : normalizedStatus,
      ...(categoryId ? { categoryId } : {}),
      ...(normalizedKeyword ? buildIngredientSearchWhere(normalizedKeyword) : {}),
      ...(normalizedImageStatus === "MISSING" ? { imageUrl: null } : {})
    };
    const orderBy = categoryId
      ? ([{ systemSortOrder: "asc" }, { createdAt: "asc" }] satisfies Prisma.IngredientOrderByWithRelationInput[])
      : ([{ displaySortOrder: "asc" }, { createdAt: "asc" }] satisfies Prisma.IngredientOrderByWithRelationInput[]);
    if (normalizedFactStatus === "MISSING") {
      const rows = await this.prisma.ingredient.findMany({
        where,
        include: {
          category: true,
          defaultUnit: true,
          mergedTo: { select: { id: true, name: true } }
        },
        orderBy
      });
      const filtered = rows.filter(item => hasIngredientTagFactGap(item));
      const items = filtered.slice(skip, skip + normalizedPageSize);
      return {
        items: items.map(item => ({
          ...toAdminIngredientSummary(item),
          imageUrl: this.ingredientImageService.buildImageUrl(item.imageUrl, request)
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
          defaultUnit: true,
          mergedTo: { select: { id: true, name: true } }
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
        imageUrl: this.ingredientImageService.buildImageUrl(item.imageUrl, request)
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
        await this.assertSystemIngredientTermsAvailable(tx, aliases, []);
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
        await this.assertSystemIngredientTermsAvailable(tx, aliases, [ingredientId]);
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
          imageUrl: this.ingredientImageService.buildImageUrl(updated.imageUrl, request)
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

        await tx.$queryRaw`SELECT "id" FROM "ingredients" WHERE "id" = ${ingredientId} FOR UPDATE`;
        const ingredient = await this.requireSystemIngredient(tx, ingredientId, true);
        if (ingredient.version !== body.expectedVersion) throw new ConflictException("食材已被更新，请刷新后重试");
        if (body.status === "ACTIVE" && !ingredient.defaultUnitId) {
          throw new BadRequestException("食材缺少默认单位，请先补充后再上架");
        }
        if (body.status === "DISABLED" && ingredient.status !== "DISABLED") {
          const mergedFromCount = await tx.ingredient.count({
            where: {
              ownerId: null,
              status: "MERGED",
              mergedToId: ingredientId
            }
          });
          if (mergedFromCount > 0) {
            throw new ConflictException("该食材仍是归并主食材，请先将它合并到其他启用中的主食材");
          }
        }

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
          imageUrl: this.ingredientImageService.buildImageUrl(updated.imageUrl, request)
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

  async mergeIngredient(
    sourceIngredientId: UUID,
    body: MergeAdminIngredientRequest,
    adminId: UUID
  ): Promise<AdminIngredientMergeResult> {
    await this.requireSuperAdmin(adminId);
    if (sourceIngredientId === body.targetIngredientId) {
      throw new BadRequestException("来源食材和主食材不能相同");
    }
    const requestHash = JSON.stringify({
      sourceIngredientId,
      expectedVersion: body.expectedVersion,
      targetIngredientId: body.targetIngredientId
    });

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminIngredientMergeResult>(
        tx,
        body.operationId,
        "admin-ingredient:merge",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-ingredient:merge", adminId, requestHash);

      const lockedIngredientIds = [sourceIngredientId, body.targetIngredientId].sort((left, right) => left - right);
      for (const ingredientId of lockedIngredientIds) {
        await tx.$queryRaw`SELECT "id" FROM "ingredients" WHERE "id" = ${ingredientId} FOR UPDATE`;
      }

      const [source, target] = await Promise.all([
        tx.ingredient.findFirst({
          where: { id: sourceIngredientId, ownerId: null },
          include: { category: true, defaultUnit: true }
        }),
        tx.ingredient.findFirst({
          where: { id: body.targetIngredientId, ownerId: null, status: "ACTIVE" },
          include: { category: true, defaultUnit: true }
        })
      ]);
      if (!source) throw new NotFoundException("来源系统食材不存在");
      if (!target) throw new NotFoundException("目标系统食材不存在或未启用");
      if (source.version !== body.expectedVersion) {
        throw new ConflictException("食材已被更新，请刷新后重试");
      }
      if (source.status !== "ACTIVE" && source.status !== "DISABLED") {
        throw new BadRequestException("只有启用中或已下架的系统食材可以合并");
      }

      const mergedChildren = await tx.ingredient.findMany({
        where: {
          ownerId: null,
          status: "MERGED",
          mergedToId: sourceIngredientId
        },
        select: { id: true, name: true, aliases: true }
      });
      const sourceIds = [sourceIngredientId, ...mergedChildren.map(item => item.id)];
      const targetAliases = normalizeIngredientAliases(target.name, [
        ...(target.aliases ?? []),
        source.name,
        ...(source.aliases ?? []),
        ...mergedChildren.flatMap(item => [item.name, ...(item.aliases ?? [])])
      ]);
      await this.assertSystemIngredientTermsAvailable(tx, targetAliases, [target.id, ...sourceIds]);
      await tx.ingredient.update({
        where: { id: target.id },
        data: {
          aliases: targetAliases,
          version: { increment: 1 }
        }
      });
      let repointedCount = 0;
      for (const child of mergedChildren) {
        const updated = await tx.ingredient.updateMany({
          where: { id: child.id, status: "MERGED", mergedToId: sourceIngredientId },
          data: { mergedToId: target.id, version: { increment: 1 } }
        });
        if (updated.count !== 1) {
          throw new ConflictException("归并项已被更新，请刷新后重试");
        }
        repointedCount += 1;
      }

      const sourceUpdate = await tx.ingredient.updateMany({
        where: {
          id: sourceIngredientId,
          ownerId: null,
          version: body.expectedVersion,
          status: source.status
        },
        data: {
          status: "MERGED",
          mergedToId: target.id,
          version: { increment: 1 }
        }
      });
      if (sourceUpdate.count !== 1) {
        throw new ConflictException("食材已被更新，请刷新后重试");
      }

      await invalidateMergedIngredientRecommendationCaches(tx, sourceIds);
      const [fridgeResult, shoppingResult] = await Promise.all([
        tx.fridgeTrace.updateMany({
          where: { ingredientId: { in: sourceIds } },
          data: { ingredientId: target.id }
        }),
        tx.shoppingItem.updateMany({
          where: { ingredientId: { in: sourceIds } },
          data: { ingredientId: target.id }
        })
      ]);
      const importItemCount = await this.refreshRecipeImportIngredientReferences(tx, sourceIds, {
        id: target.id,
        name: target.name,
        categoryCode: target.category.code
      });
      const now = new Date();
      const result: AdminIngredientMergeResult = {
        sourceIngredientId,
        targetIngredientId: target.id,
        mergedAt: toIsoDate(now)
      };
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "INGREDIENT_MERGED",
          objectType: "INGREDIENT",
          objectId: sourceIngredientId,
          payload: {
            sourceStatus: source.status,
            targetIngredientId: target.id,
            repointedCount,
            fridgeCount: fridgeResult.count,
            shoppingCount: shoppingResult.count,
            importItemCount
          }
        }
      });
      await completeAdminIdempotentOperation(
        tx,
        body.operationId,
        "admin-ingredient:merge",
        adminId,
        requestHash,
        result
      );
      return result;
    });
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

      const ingredient = await this.requireSystemIngredient(tx, ingredientId, true, true);
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
        tx.fridgeTrace.count({ where: { ingredientId } }),
        tx.shoppingItem.count({ where: { ingredientId } }),
        tx.ingredientNutrientMapping.count({ where: { ingredientId } }),
        tx.ingredientUnitNutrientConversion.count({ where: { ingredientId } })
      ]);
      const hasBlockingReferences =
        mergedCount > 0 ||
        recommendationCount > 0 ||
        targetRecommendationCount > 0 ||
        feedbackCount > 0 ||
        fridgeCount > 0 ||
        shoppingCount > 0 ||
        (await this.hasDraftIngredientReference(tx, ingredientId)) ||
        (await this.hasRecipeVersionIngredientReference(tx, ingredientId));
      if (hasBlockingReferences || (ingredient.status !== "PENDING" && (nutrientMappingCount > 0 || nutrientConversionCount > 0))) {
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

        const imageUpdatedAt = new Date();
        const imageUrl = this.ingredientImageService.buildStoredImageUrl(request, ingredientId, imageUpdatedAt);
        const updated = await tx.ingredient.update({
          where: { id: ingredientId },
          data: {
            imageUrl,
            imageUpdatedAt,
            version: { increment: 1 }
          },
          include: {
            category: true,
            defaultUnit: true
          }
        });
        const result = {
          ...toAdminIngredientSummary(updated as AdminIngredientRow),
          imageUrl: this.ingredientImageService.buildImageUrl(updated.imageUrl, request)
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
            imageUrl: null,
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
        const automaticTarget = body.action === "APPROVE_CREATE" && body.name?.trim()
          ? await tx.ingredient.findFirst({
              where: {
                ownerId: null,
                status: { in: ["ACTIVE", "DISABLED"] },
                searchKey: buildSearchKey(body.name.trim())
              },
              select: { id: true }
            })
          : null;
        const lockTargetIngredientId = body.action === "APPROVE_MERGE"
          ? body.targetIngredientId
          : automaticTarget?.id;
        const ingredientIds = lockTargetIngredientId
          ? [ingredientId, lockTargetIngredientId].sort((left, right) => left - right)
          : [ingredientId];
        for (const lockedIngredientId of ingredientIds) {
          await tx.$queryRaw`SELECT "id" FROM "ingredients" WHERE "id" = ${lockedIngredientId} FOR UPDATE`;
        }
        const importedIngredient = await this.findPendingImportedIngredient(tx, ingredientId);
        if (importedIngredient) {
          return this.reviewPendingImportedIngredient(
            tx,
            importedIngredient,
            body,
            adminId,
            requestHash,
            reviewContent,
            automaticTarget?.id ?? null
          );
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
              defaultUnitId: unit.id,
              defaultUnitName: unit.name,
              reviewNote: reviewContent.reviewNote,
              reviewReasonCode: null,
              reviewAdvice: null,
              targetIngredientId: updatedTarget.id,
              reviewedAt: now
            }
          });
          targetIngredientId = updatedTarget.id;
        } else {
          if (automaticTarget) {
            const lockedDuplicate = await this.requireSystemIngredient(tx, automaticTarget.id, true);
            if (lockedDuplicate.searchKey !== searchKey) {
              throw new ConflictException("系统食材已更新，请刷新后重试");
            }
            const nextSortOrder =
              lockedDuplicate.categoryId === body.categoryId
                ? lockedDuplicate.systemSortOrder
                : await this.nextSystemIngredientSortOrder(tx, body.categoryId);
            const displaySortOrder =
              lockedDuplicate.status === "ACTIVE" ? lockedDuplicate.displaySortOrder : await this.nextSystemIngredientDisplaySortOrder(tx);
            const updatedTarget = await tx.ingredient.update({
              where: { id: lockedDuplicate.id },
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
              defaultUnitId: unit.id,
              defaultUnitName: unit.name,
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
              defaultUnitId: unit.id,
              defaultUnitName: unit.name,
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
    reviewContent: ReturnType<typeof resolveIngredientReviewNote>,
    automaticTargetId: UUID | null
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
        name: importedIngredient.name,
        categoryCode: importedIngredient.category.code
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
      if (automaticTargetId) {
        const lockedDuplicate = await this.requireSystemIngredient(tx, automaticTargetId, true);
        if (lockedDuplicate.searchKey !== searchKey) {
          throw new ConflictException("系统食材已更新，请刷新后重试");
        }
        const updatedTarget = await tx.ingredient.update({
          where: { id: lockedDuplicate.id },
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
      name,
      categoryCode: category.code
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
        await indexRecipeVersionIngredients(tx, nextVersion.id, nextVersion.ingredientsJson);
        await replaceAutoRecipeVersionTags(tx, nextVersion.id, sourceContent);
        await this.syncRecipeAssistant(tx, nextVersion.id, sourceContent);

        const created = await tx.recipe.create({
          data: {
            ownerId: recommendation.recipe.ownerId,
            ownerNicknameSnapshot: recommendation.recipe.ownerNicknameSnapshot,
            isInspiration: true,
            inspirationPublishedAt: now,
            categoryId: null,
            inspirationCategoryId: inspirationCategory.id,
            currentVersionId: nextVersion.id,
            title: sourceContent.name,
            searchText: buildRecipeSearchText(sourceContent),
            coverImageUrl: recommendation.recipe.coverImageUrl
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
            const errorItems = [...parsed.errorItems, ...state.errorItems];
            const warnItems = [...parsed.warnItems, ...state.warnItems];
            await tx.recipeImportItem.create({
              data: {
                jobId: jobId as UUID,
                sourcePath: source.sourcePath,
                title: recipeBody.title.trim() || parsed.parsedBody.titleLine || null,
                status: errorItems.length > 0 ? "NEEDS_FIX" : "READY",
                rawBodyJson: toJson(rawBody),
                parsedBodyJson: toJson(parsed.parsedBody),
                recipeBodyJson: toJson(recipeBody),
                errorJson: toJson(errorItems),
                warnJson: toJson(warnItems)
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
    await this.discardAdminRecipeTempImagesWithAudit(tempKeys, adminId, "RECIPE_IMPORT_JOB", jobId, "import-job-delete");
    return result;
  }

  async deleteRecipeImportItem(itemId: UUID, expectedVersion: number, operationId: OperationId, adminId: UUID): Promise<AdminDeleteRecipeImportItemResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${itemId}:${expectedVersion}`;
    const { result, tempKeys } = await this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminDeleteRecipeImportItemResult>(
        tx, operationId, "admin-recipe-import:delete-item", adminId, requestHash
      );
      if (repeated) return { result: repeated, tempKeys: [] };
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe-import:delete-item", adminId, requestHash);
      const item = await tx.recipeImportItem.findFirst({
        where: { id: itemId, job: { sourceType: "JSON" } },
        select: { id: true, jobId: true, recipeBodyJson: true, version: true }
      });
      if (!item) throw new NotFoundException("导入条目不存在");
      if (item.version !== expectedVersion) throw new ConflictException("导入条目已更新，请刷新后重试");
      const recipeBody = normalizeRecipeImportBody(fromJson<RecipeImportRecipeBody>(item.recipeBodyJson));
      const result: AdminDeleteRecipeImportItemResult = {
        itemId: item.id,
        jobId: item.jobId,
        deletedAt: toIsoDate(new Date())
      };
      const deleted = await tx.recipeImportItem.deleteMany({ where: { id: item.id, version: expectedVersion } });
      if (deleted.count !== 1) throw new ConflictException("导入条目已更新，请刷新后重试");
      await this.writeRecipeImportJobStats(tx, item.jobId);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_IMPORT_ITEM_DELETED",
          objectType: "RECIPE_IMPORT_ITEM",
          objectId: item.id,
          payload: { jobId: item.jobId }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe-import:delete-item", adminId, requestHash, result);
      return { result, tempKeys: Array.from(recipeImportTempKeys(recipeBody)) };
    });
    await this.discardAdminRecipeTempImagesWithAudit(tempKeys, adminId, "RECIPE_IMPORT_ITEM", itemId, "import-item-delete");
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
      if (currentItem.recipeId) {
        throw new ConflictException("该导入条目已关联正式菜谱，不能再修改；请直接编辑正式菜谱");
      }

      const rawBody = fromJson<RecipeImportRawBody>(currentItem.rawBodyJson);
      const previousRecipeBody = normalizeRecipeImportBody(fromJson<RecipeImportRecipeBody>(currentItem.recipeBodyJson));
      const previousTempKeys = recipeImportTempKeys(previousRecipeBody);
      const sourcePrompts = readRecipeImportPrompts(rawBody.jsonText);
      const nextRecipeBody = await this.prepareRecipeImportBody(tx, body.recipeBody, true);
      nextRecipeBody.steps = nextRecipeBody.steps.map((step, index) => ({
        ...step,
        imagePrompt: step.imagePrompt?.trim() || previousRecipeBody.steps[index]?.imagePrompt?.trim() || (
          sourcePrompts.steps[index]?.text === step.text ? sourcePrompts.steps[index].imagePrompt : null
        )
      }));
      const previousAssistantSteps = previousRecipeBody.assistantSteps ?? [];
      nextRecipeBody.assistantSteps = (nextRecipeBody.assistantSteps ?? []).map((step, index) => {
        const previousStep = previousAssistantSteps[index];
        return {
          ...step,
          imagePrompt: step.imagePrompt?.trim() || previousStep?.imagePrompt?.trim() || sourcePrompts.assistantSteps[index]?.imagePrompt || null
        };
      });
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

    await this.discardAdminRecipeTempImagesWithAudit(staleTempKeys, adminId, "RECIPE_IMPORT_ITEM", itemId, "import-item-update");

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
      if (preflight.recipeId) return this.buildRecipeImportItemDetail(preflight);
      if (preflight.version !== body.expectedVersion) {
        throw new ConflictException("导入条目已被更新，请刷新后重试");
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

      const recipeId = await this.reserveRecipeId(this.prisma);
      const contentVersionId = await this.reserveRecipeContentVersionId(this.prisma);
      const stagedImages = await this.stageRecipeImportImages(
        request,
        recipeId,
        contentVersionId,
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
        if (currentItem.recipeId) {
          await completeAdminIdempotentOperation(
            tx,
            body.operationId,
            "admin-recipe-import:publish",
            adminId,
            requestHash,
            this.toRecipeImportItemSummary(currentItem)
          );
          return { id: currentItem.id, repeated: true };
        }
        if (currentItem.version !== body.expectedVersion) {
          throw new ConflictException("导入条目已被更新，请刷新后重试");
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
            imageTempKey: null,
            imagePrompt: step.imagePrompt ?? null
          }))
        };

        const inspirationCategory = await this.requireInspirationCategory(tx, recipeBody.inspirationCategoryId);
        const content = await this.buildAdminRecipeContent(tx, contentInput, stagedImages.stepImageUrls);
        this.assertAdminRecipeContent(content);

        const nextVersion = await tx.recipeContentVersion.create({
          data: { id: contentVersionId, ...this.buildAdminRecipeVersionCreateInput(content, stagedImages.coverImageUrl) }
        });
        await indexRecipeVersionIngredients(tx, nextVersion.id, nextVersion.ingredientsJson);
        await loadRecipeNutritionSummary(tx, nextVersion.id, content);
        await createImportedRecipeVersionTags(tx, nextVersion.id, recipeBody.tags ?? []);
        await replaceAutoRecipeVersionTags(tx, nextVersion.id, content);
        await this.syncRecipeAssistant(tx, nextVersion.id, content, stagedImages.assistantSteps);
        let inspirationOwnerId: UUID;
        try {
          inspirationOwnerId = await pickPublicContentOwner(tx);
        } catch (error) {
          if (error instanceof Error && error.message.includes("公共内容用户池")) {
            throw new ConflictException("公共内容用户池未完成配置，请先准备 100 个有效用户");
          }
          throw error;
        }
        const inspirationOwner = await tx.user.findUnique({
          where: { id: inspirationOwnerId },
          select: { nickname: true }
        });
        if (!inspirationOwner) throw new ConflictException("公共内容用户不存在");
        const recipe = await tx.recipe.create({
          data: {
            id: recipeId,
            ownerId: inspirationOwnerId,
            ownerNicknameSnapshot: toOwnerNicknameSnapshot(inspirationOwner.nickname),
            isInspiration: true,
            inspirationPublishedAt: new Date(),
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
        await this.removeAdminRecipeImagesWithAudit(publishedStorageKeys, adminId, "RECIPE_IMPORT_ITEM", itemId, "import-idempotency-replay");
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
        await this.removeAdminRecipeImagesWithAudit(publishedStorageKeys, adminId, "RECIPE_IMPORT_ITEM", itemId, "import-publish-rollback");
      }
      throw error;
    } finally {
      await this.discardAdminRecipeTempImagesWithAudit(tempImageKeys, adminId, "RECIPE_IMPORT_ITEM", itemId, "import-temp-cleanup");
    }
  }

  private async stageRecipeImportImages(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    recipeId: UUID,
    contentVersionId: number,
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
    const publishRemoteImage = (scene: "COVER" | "STEP", imageUrl: string, position: RecipeImagePosition) => {
      const normalizedUrl = imageUrl.trim();
      const cacheKey = `${scene}:${JSON.stringify(position)}:${normalizedUrl}`;
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
        const result = await this.adminRecipeImageService.publishRemoteImage(request, recipeId, contentVersionId, scene, normalizedUrl, position);
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
      const published = await this.adminRecipeImageService.publishTempImage(request, recipeId, contentVersionId, "COVER", recipeBody.coverImageTempKey, { type: "COVER" });
      tempImageKeys.push(recipeBody.coverImageTempKey);
      publishedStorageKeys.push(published.storageKey);
      coverImageUrl = published.imageUrl;
    } else if (recipeBody.coverImageKey) {
      const image = imageMap.get(recipeBody.coverImageKey);
      if (!image) throw new BadRequestException("封面图片不存在");
      const buffer = await readImageBuffer(rawBody.assetFolder, image.fileName);
      const published = await this.adminRecipeImageService.publishImageBuffer(request, recipeId, contentVersionId, "COVER", buffer, { type: "COVER" });
      publishedStorageKeys.push(published.storageKey);
      coverImageUrl = published.imageUrl;
    } else if (recipeBody.coverImageUrl) {
      const published = await publishRemoteImage("COVER", recipeBody.coverImageUrl, { type: "COVER" });
      publishedStorageKeys.push(published.storageKey);
      coverImageUrl = published.imageUrl;
    }

    const stepImageUrls: Array<string | null> = [];
    for (const [index, step] of recipeBody.steps.entries()) {
      const position: RecipeImagePosition = { type: "STEP", order: index + 1 };
      if (step.imageTempKey) {
        const published = await this.adminRecipeImageService.publishTempImage(request, recipeId, contentVersionId, "STEP", step.imageTempKey, position);
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
        const published = await publishRemoteImage("STEP", step.imageUrl, position);
        publishedStorageKeys.push(published.storageKey);
        stepImageUrls.push(published.imageUrl);
        continue;
      }
      const image = imageMap.get(step.imageKey);
      if (!image) throw new BadRequestException("步骤图片不存在");
      const buffer = await readImageBuffer(rawBody.assetFolder, image.fileName);
      const published = await this.adminRecipeImageService.publishImageBuffer(request, recipeId, contentVersionId, "STEP", buffer, position);
      publishedStorageKeys.push(published.storageKey);
      stepImageUrls.push(published.imageUrl);
    }

    const assistantSteps: NonNullable<RecipeImportRecipeBody["assistantSteps"]> = [];
    for (const [index, assistantStep] of (recipeBody.assistantSteps ?? []).entries()) {
      const position: RecipeImagePosition = { type: "WIKI_STEP", order: Number(assistantStep.order) || index + 1 };
      if (assistantStep.imageTempKey) {
        const published = await this.adminRecipeImageService.publishTempImage(request, recipeId, contentVersionId, "STEP", assistantStep.imageTempKey, position);
        tempImageKeys.push(assistantStep.imageTempKey);
        publishedStorageKeys.push(published.storageKey);
        assistantSteps.push({ ...assistantStep, imageTempKey: null, imageUrl: published.imageUrl });
        continue;
      }
      if (!assistantStep.imageUrl) {
        assistantSteps.push(assistantStep);
        continue;
      }
      const published = await publishRemoteImage("STEP", assistantStep.imageUrl, position);
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
          inspirationCategory: true,
          currentVersion: {
            select: {
              versionTags: { where: { status: "CANDIDATE", source: { not: "AUTO" }, tagCode: { in: [...recipeWikiTagCodes] } }, select: { id: true } },
              cookAssistant: { select: { candidateJson: true, status: true } }
            }
          }
        },
        orderBy: [{ blockedAt: { sort: "asc", nulls: "first" } }, { updatedAt: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipe.count({ where })
    ]);

    return {
      items: items.map(recipe => ({
        ...this.toAdminRecipeSummary(recipe),
        hasWikiCandidate: recipe.currentVersion.versionTags.length > 0 || (
          recipe.currentVersion.cookAssistant?.candidateJson != null && recipe.currentVersion.cookAssistant.status !== "READY"
        )
      })),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async setRecipeRecommendationRank(
    recipeId: UUID,
    adminId: UUID,
    body: { operationId: OperationId; expectedVersion: number; rank: "NORMAL" | "DOWNRANK" | "STRONG_DOWNRANK"; reason: string }
  ): Promise<AdminRecipeSummary> {
    await this.requireSuperAdmin(adminId);
    const reason = body.reason.trim();
    if (!reason) throw new BadRequestException("调整原因不能为空");
    const requestHash = `${recipeId}:${body.expectedVersion}:${body.rank}:${reason}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminRecipeSummary>(
        tx,
        body.operationId,
        "admin-recipe:recommendation-rank",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, body.operationId, "admin-recipe:recommendation-rank", adminId, requestHash);

      const current = await tx.recipe.findFirst({
        where: { id: recipeId, isInspiration: true, inspirationCategoryId: { not: null } },
        select: { id: true, version: true, recommendationRank: true }
      });
      if (!current) throw new NotFoundException("系统灵感菜谱不存在");
      if (current.version !== body.expectedVersion) throw new ConflictException("菜谱已被更新，请刷新后重试");
      const changed = await tx.recipe.updateMany({
        where: { id: recipeId, isInspiration: true, inspirationCategoryId: { not: null }, version: body.expectedVersion },
        data: {
          recommendationRank: body.rank,
          recommendationRankReason: body.rank === "NORMAL" ? null : reason,
          version: { increment: 1 }
        }
      });
      if (changed.count !== 1) throw new ConflictException("菜谱已被更新，请刷新后重试");
      const recipe = await tx.recipe.findUniqueOrThrow({
        where: { id: recipeId },
        include: { owner: { select: { uid: true } }, inspirationCategory: true }
      });
      const result = this.toAdminRecipeSummary(recipe);
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_RECOMMENDATION_RANK_UPDATED",
          objectType: "RECIPE",
          objectId: recipeId,
          payload: {
            previousRank: current.recommendationRank,
            rank: body.rank,
            reason
          }
        }
      });
      await completeAdminIdempotentOperation(tx, body.operationId, "admin-recipe:recommendation-rank", adminId, requestHash, result);
      return result;
    });
  }

  async syncRecipeContentFromImports(
    recipeIds: UUID[],
    operationId: OperationId,
    adminId: UUID
  ): Promise<AdminRecipeImportContentSyncResult> {
    await this.requireSuperAdmin(adminId);
    const uniqueIds = Array.from(new Set(recipeIds)).sort((left, right) => left - right);
    if (!uniqueIds.length || uniqueIds.length > 100) throw new BadRequestException("一次最多同步 100 道菜谱");
    const requestHash = JSON.stringify(uniqueIds);
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminRecipeImportContentSyncResult>(
        tx, operationId, "admin-recipe:sync-import-content", adminId, requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe:sync-import-content", adminId, requestHash);
      const items: AdminRecipeImportContentSyncResult["items"] = [];
      for (const recipeId of uniqueIds) {
        await tx.$executeRawUnsafe("SAVEPOINT admin_recipe_content_sync_item");
        try {
          await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${recipeId} FOR UPDATE`;
          const recipe = await tx.recipe.findUnique({
            where: { id: recipeId },
            include: {
              currentVersion: {
                include: {
                  versionTags: true,
                  cookAssistant: true,
                  cookAssistantUnlocks: { where: { status: "CONSUMED" } }
                }
              }
            }
          });
          if (!recipe || !recipe.isInspiration || !recipe.inspirationCategoryId || recipe.status !== "ACTIVE") {
            throw new Error("不是正常的已发布系统菜谱");
          }

          const imports = await tx.recipeImportItem.findMany({
            where: { recipeId, status: "PUBLISHED", job: { sourceType: "JSON" } },
            select: { recipeBodyJson: true, rawBodyJson: true }
          });
          if (imports.length !== 1) {
            throw new Error(imports.length === 0 ? "找不到唯一关联的已发布导入 JSON" : "关联了多份导入 JSON，无法确定同步来源");
          }
          const importBody = normalizeRecipeImportBody(fromJson<RecipeImportRecipeBody>(imports[0]!.recipeBodyJson));
          if (!importBody.title.trim() || !importBody.ingredients.length || !importBody.steps.length) {
            throw new Error("关联导入 JSON 的菜名、食材或步骤不完整");
          }
          const currentContent = versionToContent(recipe.currentVersion);
          if (!currentContent.difficulty || !currentContent.duration) {
            throw new Error("当前菜谱的难度或时长不完整，无法只同步指定正文项目");
          }
          if (importBody.steps.length !== currentContent.steps.length) {
            throw new Error("导入步骤数量与当前步骤图槽位不一致");
          }
          const imageMismatch = currentContent.steps.some((step, index) => Boolean(step.imageUrl) && step.text !== importBody.steps[index]?.text);
          if (imageMismatch) throw new Error("步骤图对应的步骤文字已变化，无法安全对位");
          if (importBody.ingredients.some(item => !item.ingredientId || (!item.fuzzyText && !item.unitId))) {
            throw new Error("导入 JSON 中有食材或单位尚未完成结构化匹配");
          }

          const sourcePrompts = readRecipeImportPrompts(fromJson<RecipeImportRawBody>(imports[0]!.rawBodyJson).jsonText);
          const contentInput: AdminRecipeContentInput = {
            name: importBody.title.trim(),
            story: importBody.story,
            baseServings: currentContent.baseServings,
            difficulty: currentContent.difficulty,
            duration: currentContent.duration,
            estimatedCalories: currentContent.estimatedCalories,
            tips: currentContent.tips,
            keywords: importBody.keywords,
            tools: importBody.tools ?? [],
            ingredients: importBody.ingredients.map(item => ({
              ingredientId: item.ingredientId!,
              amount: item.fuzzyText
                ? { kind: "FUZZY", text: item.fuzzyText }
                : { kind: "EXACT", quantity: item.quantity ?? "", unitId: item.unitId! }
            })),
            steps: importBody.steps.map((step, index) => ({
              text: step.text,
              imageUrl: currentContent.steps[index]?.imageUrl ?? null,
              imageTempKey: null,
              imagePrompt: step.imagePrompt?.trim() || (
                sourcePrompts.steps[index]?.text === step.text.trim() ? sourcePrompts.steps[index]?.imagePrompt : null
              )
            }))
          };
          const content = await this.buildAdminRecipeContent(
            tx,
            contentInput,
            currentContent.steps.map(step => step.imageUrl)
          );
          this.assertAdminRecipeContent(content);

          const nextVersion = await tx.recipeContentVersion.create({
            data: this.buildAdminRecipeVersionCreateInput(content, recipe.coverImageUrl)
          });
          await indexRecipeVersionIngredients(tx, nextVersion.id, nextVersion.ingredientsJson);
          await loadRecipeNutritionSummary(tx, nextVersion.id, content);
          if (recipe.currentVersion.versionTags.length) {
            await tx.recipeVersionTag.createMany({
              data: recipe.currentVersion.versionTags.map(({ id: _id, recipeVersionId: _versionId, createdAt: _createdAt, updatedAt: _updatedAt, ...tag }) => ({
                ...tag,
                recipeVersionId: nextVersion.id
              }))
            });
          }
          await replaceAutoRecipeVersionTags(tx, nextVersion.id, content);
          const assistant = recipe.currentVersion.cookAssistant;
          if (assistant) {
            await tx.recipeCookAssistant.create({
              data: {
                recipeVersionId: nextVersion.id,
                status: assistant.status,
                candidateJson: assistant.candidateJson == null ? Prisma.DbNull : toJson(assistant.candidateJson),
                snapshotJson: assistant.snapshotJson == null ? Prisma.DbNull : toJson(assistant.snapshotJson),
                generatedAt: assistant.generatedAt,
                lastAttemptAt: assistant.lastAttemptAt,
                attemptCount: assistant.attemptCount,
                lastError: assistant.lastError,
                source: assistant.source,
                isLocked: assistant.isLocked,
                updatedByAdminId: assistant.updatedByAdminId
              }
            });
          }
          if (recipe.currentVersion.cookAssistantUnlocks.length) {
            await tx.cookAssistantUnlock.createMany({
              data: recipe.currentVersion.cookAssistantUnlocks.map(({ id: _id, recipeVersionId: _versionId, ...unlock }) => ({
                ...unlock,
                recipeVersionId: nextVersion.id,
                countsTowardDailyLimit: false
              }))
            });
          }
          const updated = await tx.recipe.updateMany({
            where: { id: recipeId, currentVersionId: recipe.currentVersionId, version: recipe.version },
            data: {
              currentVersionId: nextVersion.id,
              title: content.name,
              searchText: buildRecipeSearchText(content),
              version: { increment: 1 }
            }
          });
          if (updated.count !== 1) throw new ConflictException("菜谱已被更新，请刷新后重试");
          await tx.auditEvent.create({
            data: {
              actorType: "ADMIN",
              actorAdminId: adminId,
              action: "RECIPE_CONTENT_SYNCED_FROM_IMPORT",
              objectType: "RECIPE",
              objectId: recipeId,
              payload: { previousVersionId: recipe.currentVersionId, nextVersionId: nextVersion.id }
            }
          });
          items.push({
            recipeId,
            status: "SYNCED",
            contentVersionId: recipe.currentVersionId,
            nextContentVersionId: nextVersion.id,
            message: null
          });
          await tx.$executeRawUnsafe("RELEASE SAVEPOINT admin_recipe_content_sync_item");
        } catch (error) {
          await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT admin_recipe_content_sync_item");
          await tx.$executeRawUnsafe("RELEASE SAVEPOINT admin_recipe_content_sync_item");
          items.push({
            recipeId,
            status: "SKIPPED",
            contentVersionId: null,
            nextContentVersionId: null,
            message: error instanceof BadRequestException || error instanceof ConflictException
              ? error.message
              : error instanceof Error && error.constructor === Error
                ? error.message
                : "同步失败，请稍后重试"
          });
        }
      }
      const result: AdminRecipeImportContentSyncResult = {
        syncedCount: items.filter(item => item.status === "SYNCED").length,
        skippedCount: items.filter(item => item.status === "SKIPPED").length,
        items
      };
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe:sync-import-content", adminId, requestHash, result);
      return result;
    });
  }

  async confirmRecipeWikiCandidates(recipeIds: UUID[], operationId: OperationId, adminId: UUID): Promise<ConfirmAdminRecipeWikiCandidatesResult> {
    await this.requireSuperAdmin(adminId);
    const uniqueIds = Array.from(new Set(recipeIds)).sort((left, right) => left - right);
    if (!uniqueIds.length || uniqueIds.length > 100) throw new BadRequestException("一次最多确认 100 道菜谱候选");
    const requestHash = JSON.stringify(uniqueIds);
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<ConfirmAdminRecipeWikiCandidatesResult>(
        tx, operationId, "admin-recipe-wiki:confirm-candidates", adminId, requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:confirm-candidates", adminId, requestHash);
      const confirmedRecipeIds: UUID[] = [];
      const assistantReadyRecipeIds: UUID[] = [];
      const assistantNeedsReviewRecipeIds: UUID[] = [];
      for (const recipeId of uniqueIds) {
        await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${recipeId} FOR UPDATE`;
        const recipe = await tx.recipe.findFirst({
          where: { id: recipeId, status: "ACTIVE", isInspiration: true },
          select: {
            id: true,
            currentVersionId: true,
            currentVersion: { select: { versionTags: { where: { status: "CANDIDATE", source: { not: "AUTO" }, tagCode: { in: [...recipeWikiTagCodes] } }, select: { id: true } }, cookAssistant: true } }
          }
        });
        if (!recipe) throw new BadRequestException("存在无效或非正常菜谱");
        const assistant = recipe.currentVersion.cookAssistant;
        const hasTags = recipe.currentVersion.versionTags.length > 0;
        const hasAssistant = assistant?.candidateJson != null && assistant.status !== "READY";
        if (!hasTags && !hasAssistant) throw new ConflictException("所选菜谱没有待确认的 Wiki 候选，请刷新列表");
        if (hasTags) {
          await tx.recipeVersionTag.updateMany({
            where: { recipeVersionId: recipe.currentVersionId, status: "CANDIDATE", source: { not: "AUTO" }, tagCode: { in: [...recipeWikiTagCodes] } },
            data: { status: "CONFIRMED", isLocked: true }
          });
        }
        let assistantConfirmed = false;
        if (hasAssistant && assistant) {
          const candidate = fromJson<ReturnType<typeof buildImportedRecipeAssistantSnapshot>>(assistant.candidateJson);
          if (this.isRecipeAssistantCandidateReady(candidate)) {
            const now = new Date();
            await tx.recipeCookAssistant.update({
              where: { recipeVersionId: recipe.currentVersionId },
              data: { status: "READY", candidateJson: Prisma.DbNull, snapshotJson: toJson(candidate), generatedAt: now, lastError: null, updatedByAdminId: adminId }
            });
            await this.settleRecipeWikiRequests(tx, recipe.currentVersionId, "READY", now);
            assistantReadyRecipeIds.push(recipeId);
            assistantConfirmed = true;
          } else {
            assistantNeedsReviewRecipeIds.push(recipeId);
          }
        } else if (assistant?.status === "READY") {
          assistantReadyRecipeIds.push(recipeId);
        }
        confirmedRecipeIds.push(recipeId);
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN",
            actorAdminId: adminId,
            action: "RECIPE_WIKI_CANDIDATES_CONFIRMED",
            objectType: "RECIPE",
            objectId: recipeId,
            payload: { contentVersionId: recipe.currentVersionId, tagCount: recipe.currentVersion.versionTags.length, assistantConfirmed }
          }
        });
      }
      const result = { confirmedRecipeIds, assistantReadyRecipeIds, assistantNeedsReviewRecipeIds } satisfies ConfirmAdminRecipeWikiCandidatesResult;
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:confirm-candidates", adminId, requestHash, result);
      return result;
    });
  }

  async updateRecipeWikiCandidate(
    recipeId: UUID,
    operationId: OperationId,
    body: UpdateAdminRecipeWikiCandidateRequest,
    adminId: UUID
  ): Promise<AdminRecipeDetail> {
    await this.requireSuperAdmin(adminId);
    const requestHash = JSON.stringify({ recipeId, ...body });
    await this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<{ recipeId: UUID }>(
        tx, operationId, "admin-recipe-wiki:edit-candidate", adminId, requestHash
      );
      if (repeated) return;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:edit-candidate", adminId, requestHash);
      await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${recipeId} FOR UPDATE`;
      const recipe = await tx.recipe.findFirst({
        where: { id: recipeId, status: "ACTIVE", isInspiration: true },
        select: {
          id: true,
          currentVersionId: true,
          currentVersion: { select: { cookAssistant: { select: { status: true } } } }
        }
      });
      if (!recipe) throw new NotFoundException("正常系统菜谱不存在");
      if (recipe.currentVersionId !== body.expectedContentVersionId) {
        throw new ConflictException("菜谱正文版本已更新，请刷新后重试");
      }
      if (recipe.currentVersion.cookAssistant?.status === "READY") {
        throw new ConflictException("当前 Wiki 已前台可用，不能按候选内容覆盖");
      }
      const assistantSteps: RecipeImportAssistantStepDraft[] = body.assistantSteps.map(step => ({ ...step, imageTempKey: null }));
      const document = {
        schemaVersion: "recipe.wiki.v1",
        recipeId,
        contentVersionId: recipe.currentVersionId,
        wiki: {
          tags: body.tags,
          assistant: { steps: assistantSteps.map(({ imageTempKey: _imageTempKey, ...step }) => step) }
        }
      };
      const parsed = parseRecipeWikiDocument(document);
      if (parsed.issues.length || !parsed.items[0]) {
        throw new BadRequestException(parsed.issues.slice(0, 10).map(item => `${item.field ?? "Wiki"}：${item.message}`).join("；") || "候选 Wiki 格式不正确");
      }
      const item = parsed.items[0];
      const candidate = buildImportedRecipeAssistantSnapshot(item.assistantSteps);
      if (!this.isRecipeAssistantCandidateReady(candidate)) throw new BadRequestException("Wiki 助理步骤必须补全标题、内容和正整数时长");
      await tx.recipeVersionTag.deleteMany({
        where: { recipeVersionId: recipe.currentVersionId, source: "OPS", status: "CANDIDATE", tagCode: { in: [...recipeWikiTagCodes] } }
      });
      const confirmedOpsTags = await tx.recipeVersionTag.findMany({
        where: { recipeVersionId: recipe.currentVersionId, source: "OPS", tagCode: { in: [...recipeWikiTagCodes] } },
        select: { tagCode: true, tagValue: true }
      });
      const confirmedOpsTagKeys = new Set(confirmedOpsTags.map(tag => `${tag.tagCode}:${tag.tagValue}`));
      const candidateTags = item.tags.filter(tag => !confirmedOpsTagKeys.has(`${tag.tagCode}:${tag.tagValue}`));
      if (candidateTags.length) await tx.recipeVersionTag.createMany({
        data: candidateTags.map((tag, index) => ({
          recipeVersionId: recipe.currentVersionId,
          tagCode: tag.tagCode,
          tagValue: tag.tagValue,
          source: "OPS" as const,
          status: "CANDIDATE" as const,
          confidence: 1,
          sortOrder: index,
          isLocked: false
        }))
      });
      const now = new Date();
      await tx.recipeCookAssistant.upsert({
        where: { recipeVersionId: recipe.currentVersionId },
        update: {
          status: "NEEDS_REVIEW",
          candidateJson: toJson(candidate),
          snapshotJson: Prisma.DbNull,
          generatedAt: null,
          lastAttemptAt: now,
          attemptCount: { increment: 1 },
          lastError: null,
          source: "OPS",
          updatedByAdminId: adminId
        },
        create: {
          recipeVersionId: recipe.currentVersionId,
          status: "NEEDS_REVIEW",
          candidateJson: toJson(candidate),
          snapshotJson: Prisma.DbNull,
          generatedAt: null,
          lastAttemptAt: now,
          attemptCount: 1,
          lastError: null,
          source: "OPS",
          updatedByAdminId: adminId
        }
      });
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_WIKI_CANDIDATE_EDITED",
          objectType: "RECIPE",
          objectId: recipeId,
          payload: { contentVersionId: recipe.currentVersionId, tagCount: candidateTags.length, assistantStepCount: item.assistantSteps.length }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:edit-candidate", adminId, requestHash, { recipeId });
    });
    return this.getRecipeDetail(recipeId, adminId);
  }

  async exportRecipes(
    page: number,
    pageSize: number,
    keyword: string | undefined,
    status: string | undefined,
    categoryId: UUID | undefined,
    adminId: UUID
  ): Promise<PageResult<AdminRecipeImageExportItem & { recipeId: UUID }>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = Math.min(toPositiveInt(pageSize, 100), 100);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const normalizedStatus = status?.trim();
    if (normalizedStatus && !["ACTIVE", "RECYCLED", "BLOCKED", "DELETED"].includes(normalizedStatus)) {
      throw new BadRequestException("系统菜谱状态参数错误");
    }
    const where: Prisma.RecipeWhereInput = {
      isInspiration: true,
      inspirationCategoryId: categoryId ? { equals: categoryId } : { not: null },
      ...(keyword?.trim() ? { searchText: { contains: buildSearchKey(keyword) } } : {}),
      ...(normalizedStatus ? { status: normalizedStatus as RecipeStatus } : {})
    };
    const [recipes, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        select: {
          id: true,
          currentVersionId: true,
          currentVersion: {
            select: {
              name: true,
              story: true,
              tips: true,
              keywordsJson: true,
              stepsJson: true,
              cookAssistant: { select: { status: true, generatedAt: true, snapshotJson: true } }
            }
          }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipe.count({ where })
    ]);
    return {
      items: recipes.map(recipe => {
        const steps = fromJson<Array<{ imagePrompt?: string | null }>>(recipe.currentVersion.stepsJson);
        const assistant = versionAssistantToSnapshot(recipe.currentVersion.cookAssistant);
        return {
          recipeId: recipe.id,
          contentVersionId: recipe.currentVersionId,
          title: recipe.currentVersion.name,
          description: recipe.currentVersion.story ?? "",
          keywords: fromJson<string[]>(recipe.currentVersion.keywordsJson),
          tips: recipe.currentVersion.tips ?? "",
          steps: steps.map((step, index) => ({ order: index + 1, imagePrompt: step.imagePrompt ?? null })),
          wikiSteps: (assistant?.steps ?? []).map(step => ({ order: step.order, imagePrompt: step.imagePrompt ?? null }))
        };
      }),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + recipes.length < total
    };
  }

  async exportRecipeWikiRevision(
    input: { recipeIds?: UUID[]; categoryId?: UUID; keyword?: string },
    adminId: UUID
  ): Promise<AdminRecipeWikiRevisionExportDocument> {
    await this.requireSuperAdmin(adminId);
    if (input.recipeIds && (input.categoryId || input.keyword?.trim())) {
      throw new BadRequestException("勾选菜谱导出不能同时使用分类或关键词筛选");
    }
    const recipeIds = input.recipeIds ? Array.from(new Set(input.recipeIds)) : undefined;
    if (recipeIds && (!recipeIds.length || recipeIds.length > 100 || recipeIds.length !== input.recipeIds?.length)) {
      throw new BadRequestException("一次最多导出 100 道不重复的菜谱");
    }
    const where: Prisma.RecipeWhereInput = {
      isInspiration: true,
      status: "ACTIVE",
      inspirationCategoryId: input.categoryId ? { equals: input.categoryId } : { not: null },
      ...(recipeIds ? { id: { in: recipeIds } } : {}),
      ...(input.keyword?.trim() ? { searchText: { contains: buildSearchKey(input.keyword) } } : {}),
      currentVersion: { is: { cookAssistant: { is: { status: "READY" } } } }
    };
    const recipes = await this.prisma.recipe.findMany({
      where,
      select: {
        id: true,
        currentVersionId: true,
        inspirationCategoryId: true,
        coverImageUrl: true,
        currentVersion: {
          select: {
            name: true,
            story: true,
            baseServings: true,
            difficulty: true,
            duration: true,
            tips: true,
            keywordsJson: true,
            toolsJson: true,
            ingredientsJson: true,
            stepsJson: true,
            versionTags: {
              where: { tagCode: { in: [...recipeWikiTagCodes] } },
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              select: { tagCode: true, tagValue: true }
            },
            cookAssistant: { select: { status: true, generatedAt: true, snapshotJson: true } }
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: recipeIds ? 100 : 101
    });
    if (recipeIds && recipes.length !== recipeIds.length) {
      throw new BadRequestException("勾选项中包含非 ACTIVE 菜谱或当前版本 Wiki 未 READY 的菜谱");
    }
    if (!recipeIds && recipes.length > 100) {
      throw new BadRequestException("当前筛选超过 100 道菜谱，请缩小分类或关键词范围后再导出");
    }

    const contents = recipes.map(recipe => versionToContent(recipe.currentVersion));
    const categoryIds = Array.from(new Set(contents.flatMap(content => content.ingredients.map(item => item.categoryId))));
    const ingredientCategories = categoryIds.length
      ? await this.prisma.ingredientCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, code: true } })
      : [];
    const categoryCodeById = new Map(ingredientCategories.map(item => [item.id, item.code]));

    const document: AdminRecipeWikiRevisionExportDocument = {
      schemaVersion: "recipe.import.batch.v1",
      recipes: recipes.map((recipe, index) => {
        const content = contents[index];
        const assistant = versionAssistantToSnapshot(recipe.currentVersion.cookAssistant);
        return {
          recipe: {
            recipeId: recipe.id,
            contentVersionId: recipe.currentVersionId,
            inspirationCategoryId: recipe.inspirationCategoryId!,
            coverImageUrl: recipe.coverImageUrl,
            content: {
              name: content.name,
              story: content.story ?? "",
              baseServings: content.baseServings,
              difficulty: content.difficulty ?? "",
              duration: content.duration ?? "",
              tips: content.tips ?? "",
              keywords: content.keywords,
              ingredients: content.ingredients.map(item => ({
                name: item.ingredientName,
                quantity: item.amount.kind === "EXACT" ? item.amount.quantity : null,
                unit: item.amount.kind === "EXACT" ? item.amount.unitName : null,
                fuzzyText: item.amount.kind === "FUZZY" ? "适量" : null,
                categoryCode: categoryCodeById.get(item.categoryId) ?? null
              })),
              tools: (content.tools ?? []).map(item => ({ name: item.name })),
              steps: content.steps.map(item => ({ text: item.text, imageUrl: item.imageUrl, imagePrompt: item.imagePrompt ?? null }))
            }
          },
          wiki: {
            tags: recipe.currentVersion.versionTags.map(tag => ({
              tagCode: tag.tagCode as RecipeImportTagDraft["tagCode"],
              tagValue: tag.tagValue
            })),
            assistant: {
              steps: (assistant?.steps ?? []).map(step => ({
                order: step.order,
                phase: step.phase,
                action: step.action ?? "OTHER",
                title: step.title,
                detail: step.detail,
                imageUrl: step.imageUrl,
                imagePrompt: step.imagePrompt ?? null,
                durationMinutes: step.durationMinutes,
                durationText: step.durationText
              }))
            }
          }
        };
      })
    };
    if (Buffer.byteLength(JSON.stringify(document), "utf8") > 10 * 1024 * 1024) {
      throw new BadRequestException("修订文件超过 10MB，请缩小分类或关键词范围后再导出");
    }
    return document;
  }

  async backfillRecipeImages(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    recipeId: UUID,
    body: AdminRecipeImageBackfillRequest,
    adminId: UUID
  ): Promise<AdminRecipeImageBackfillResult> {
    await this.requireSuperAdmin(adminId);
    const tempKeys = body.images.map(item => item.tempKey);
    const publishedStorageKeys: string[] = [];
    let removePublishedImages = false;
    try {
      const targets = body.images.map(item => {
        const match = /^(\d+)_(\d+)(?:_step(_wiki)?(\d+))?\.jpg$/i.exec(item.fileName);
        if (!match) throw new BadRequestException(`图片文件名格式错误：${item.fileName}`);
        const contentVersionId = Number(match[1]);
        const parsedRecipeId = Number(match[2]);
        const order = match[4] ? Number(match[4]) : null;
        if (!Number.isSafeInteger(contentVersionId) || !Number.isSafeInteger(parsedRecipeId) || (order !== null && (!Number.isSafeInteger(order) || order < 1))) {
          throw new BadRequestException(`图片文件名中的 ID 或步骤序号无效：${item.fileName}`);
        }
        if (parsedRecipeId !== recipeId) throw new BadRequestException(`图片不属于当前菜谱：${item.fileName}`);
        const target = order === null ? "COVER" as const : match[3] ? "WIKI_STEP" as const : "RECIPE_STEP" as const;
        return { ...item, contentVersionId, target, order };
      });
      const targetKeys = targets.map(item => `${item.target}:${item.order ?? 0}`);
      if (new Set(targetKeys).size !== targetKeys.length) throw new BadRequestException("同一图片位置不能重复上传");
      if (new Set(targets.map(item => item.tempKey)).size !== targets.length) throw new BadRequestException("临时图片不能重复使用");
      const sourceVersionId = targets[0]?.contentVersionId;
      if (!sourceVersionId || targets.some(item => item.contentVersionId !== sourceVersionId)) {
        throw new BadRequestException("同一批图片必须属于同一个菜谱内容版本");
      }
      const requestHash = JSON.stringify({ recipeId, images: targets.map(({ fileName, tempKey }) => ({ fileName, tempKey })) });
      const cached = await this.prisma.$transaction(tx =>
        getAdminIdempotentResult<AdminRecipeImageBackfillResult>(tx, body.operationId, "admin-recipe:image-backfill", adminId, requestHash)
      );
      if (cached) return cached;

      const source = await this.prisma.recipe.findUnique({
        where: { id: recipeId },
        include: {
          currentVersion: {
            include: {
              versionTags: true,
              nutritionSnapshots: true,
              completenessSnapshots: true,
              cookAssistant: true,
              cookAssistantUnlocks: true
            }
          }
        }
      });
      if (!source || !source.isInspiration || !source.inspirationCategoryId || source.status !== "ACTIVE") {
        throw new NotFoundException("正常系统菜谱不存在");
      }
      if (source.currentVersionId !== sourceVersionId) throw new ConflictException("菜谱正文版本已变化，请重新导出");
      const nextContentVersionId = await this.reserveRecipeContentVersionId(this.prisma);

      const content = versionToContent(source.currentVersion);
      const sourceWiki = versionAssistantToSnapshot(source.currentVersion.cookAssistant);
      for (const target of targets) {
        if (target.target === "RECIPE_STEP" && (!target.order || target.order > content.steps.length)) {
          throw new BadRequestException(`菜谱步骤不存在：${target.fileName}`);
        }
        if (target.target === "WIKI_STEP" && (!sourceWiki || !target.order || target.order > sourceWiki.steps.length)) {
          throw new BadRequestException(`Wiki 步骤不存在：${target.fileName}`);
        }
      }

      const published: Array<{ target: typeof targets[number]; imageUrl: string }> = [];
      for (const target of targets) {
        const result = await this.adminRecipeImageService.publishTempImage(
          request,
          recipeId,
          nextContentVersionId,
          target.target === "COVER" ? "COVER" : "STEP",
          target.tempKey,
          target.target === "COVER"
            ? { type: "COVER" }
            : { type: target.target === "WIKI_STEP" ? "WIKI_STEP" : "STEP", order: target.order as number }
        );
        publishedStorageKeys.push(result.storageKey);
        published.push({ target, imageUrl: result.imageUrl });
      }
      const publishedByFile = new Map(published.map(item => [item.target.fileName, item.imageUrl]));
      const result = await this.prisma.$transaction(async tx => {
          const repeated = await getAdminIdempotentResult<AdminRecipeImageBackfillResult>(
            tx,
            body.operationId,
            "admin-recipe:image-backfill",
            adminId,
            requestHash
          );
          if (repeated) return { result: repeated, repeated: true };
          await startAdminIdempotentOperation(tx, body.operationId, "admin-recipe:image-backfill", adminId, requestHash);

          const current = await tx.recipe.findUnique({
            where: { id: recipeId },
            include: {
              currentVersion: {
                include: {
                  versionTags: true,
                  nutritionSnapshots: true,
                  completenessSnapshots: true,
                  cookAssistant: true,
                  cookAssistantUnlocks: true
                }
              }
            }
          });
          if (!current || !current.isInspiration || !current.inspirationCategoryId || current.status !== "ACTIVE") {
            throw new NotFoundException("正常系统菜谱不存在");
          }
          if (current.currentVersionId !== sourceVersionId) throw new ConflictException("菜谱正文版本已变化，请重新导出");

          const updatedContent = versionToContent(current.currentVersion);
          let coverImageUrl = current.coverImageUrl;
          const wiki = versionAssistantToSnapshot(current.currentVersion.cookAssistant);
          for (const target of targets) {
            if (target.target === "RECIPE_STEP" && (!target.order || target.order > updatedContent.steps.length)) {
              throw new BadRequestException(`菜谱步骤不存在：${target.fileName}`);
            }
            if (target.target === "WIKI_STEP" && (!wiki || !target.order || target.order > wiki.steps.length)) {
              throw new ConflictException(`Wiki 步骤已变化，请重新导出：${target.fileName}`);
            }
          }
          for (const target of targets) {
            const imageUrl = publishedByFile.get(target.fileName);
            if (!imageUrl) throw new BadRequestException(`图片上传未完成：${target.fileName}`);
            if (target.target === "COVER") {
              coverImageUrl = imageUrl;
            } else if (target.target === "RECIPE_STEP" && target.order) {
              updatedContent.steps[target.order - 1] = { ...updatedContent.steps[target.order - 1]!, imageUrl };
            } else if (target.target === "WIKI_STEP" && target.order && wiki) {
              wiki.steps[target.order - 1] = { ...wiki.steps[target.order - 1]!, imageUrl };
            }
          }

          const nextVersion = await tx.recipeContentVersion.create({
            data: { id: nextContentVersionId, ...this.buildAdminRecipeVersionCreateInput(updatedContent, coverImageUrl) }
          });
          await indexRecipeVersionIngredients(tx, nextVersion.id, nextVersion.ingredientsJson);
          if (current.currentVersion.versionTags.length) {
              await tx.recipeVersionTag.createMany({
                data: current.currentVersion.versionTags.map(({ id: _id, recipeVersionId: _recipeVersionId, createdAt: _createdAt, updatedAt: _updatedAt, ...tag }) => ({
                  ...tag,
                  recipeVersionId: nextVersion.id
                }))
              });
          }
          const nutrition = current.currentVersion.nutritionSnapshots[0];
          if (nutrition) {
              const { id: _id, recipeVersionId: _recipeVersionId, createdAt: _createdAt, updatedAt: _updatedAt, ...snapshot } = nutrition;
              await tx.recipeNutritionSnapshot.create({
                data: {
                  ...snapshot,
                  recipeVersionId: nextVersion.id,
                  perServingJson: snapshot.perServingJson ?? Prisma.DbNull,
                  perRecipeJson: snapshot.perRecipeJson ?? Prisma.DbNull
                }
              });
          }
          if (current.currentVersion.completenessSnapshots.length) {
              await tx.recipeCompletenessSnapshot.createMany({
                data: current.currentVersion.completenessSnapshots.map(({ id: _id, recipeVersionId: _recipeVersionId, createdAt: _createdAt, updatedAt: _updatedAt, ...snapshot }) => ({
                  ...snapshot,
                  recipeVersionId: nextVersion.id,
                  contentBlockingReasons: snapshot.contentBlockingReasons ?? Prisma.JsonNull,
                  structuredDataBlockingReasons: snapshot.structuredDataBlockingReasons ?? Prisma.JsonNull,
                  tagBlockingReasons: snapshot.tagBlockingReasons ?? Prisma.JsonNull,
                  nutritionBlockingReasons: snapshot.nutritionBlockingReasons ?? Prisma.JsonNull,
                  assistantBlockingReasons: snapshot.assistantBlockingReasons ?? Prisma.JsonNull,
                  frontendBlockingReasons: snapshot.frontendBlockingReasons ?? Prisma.JsonNull,
                  randomMenuBlockingReasons: snapshot.randomMenuBlockingReasons ?? Prisma.JsonNull
                }))
              });
          }
          const assistant = current.currentVersion.cookAssistant;
          if (assistant) {
              const updateImages = (value: unknown) => {
                if (value == null) return null;
                const snapshot = fromJson<{ steps: Array<{ order: number; imageUrl: string | null }> }>(value);
                snapshot.steps = snapshot.steps.map(step => {
                  const replacement = targets.find(item => item.target === "WIKI_STEP" && item.order === step.order);
                  return replacement ? { ...step, imageUrl: publishedByFile.get(replacement.fileName) ?? step.imageUrl } : step;
                });
                return snapshot;
              };
              const candidate = updateImages(assistant.candidateJson);
              const snapshot = updateImages(assistant.snapshotJson);
              await tx.recipeCookAssistant.create({
                data: {
                  recipeVersionId: nextVersion.id,
                  status: assistant.status,
                  candidateJson: candidate === null ? Prisma.DbNull : toJson(candidate),
                  snapshotJson: snapshot === null ? Prisma.DbNull : toJson(snapshot),
                  generatedAt: assistant.generatedAt,
                  lastAttemptAt: assistant.lastAttemptAt,
                  attemptCount: assistant.attemptCount,
                  lastError: assistant.lastError,
                  source: assistant.source,
                  isLocked: assistant.isLocked,
                  updatedByAdminId: adminId
                }
              });
          }
          if (current.currentVersion.cookAssistantUnlocks.length) {
              await tx.cookAssistantUnlock.createMany({
                data: current.currentVersion.cookAssistantUnlocks.map(({ id: _id, recipeVersionId: _recipeVersionId, ...unlock }) => ({
                  ...unlock,
                  recipeVersionId: nextVersion.id
                }))
              });
          }
          const updatedRecipe = await tx.recipe.updateMany({
            where: { id: recipeId, currentVersionId: sourceVersionId, version: current.version },
            data: {
              currentVersionId: nextContentVersionId,
              coverImageUrl,
              version: { increment: 1 }
            }
          });
          if (updatedRecipe.count !== 1) throw new ConflictException("菜谱已被更新，请刷新后重试");
          const response: AdminRecipeImageBackfillResult = {
            recipeId,
            contentVersionId: sourceVersionId,
            nextContentVersionId,
            updatedCount: targets.length,
            items: targets.map(target => ({
              fileName: target.fileName,
              target: target.target,
              order: target.order,
              imageUrl: publishedByFile.get(target.fileName)!
            }))
          };
          await tx.auditEvent.create({
            data: {
              actorType: "ADMIN",
              actorAdminId: adminId,
              action: "RECIPE_IMAGES_BACKFILLED",
              objectType: "RECIPE",
              objectId: recipeId,
              payload: {
                contentVersionId: sourceVersionId,
                nextContentVersionId,
                imageCount: targets.length
              }
            }
          });
          await completeAdminIdempotentOperation(tx, body.operationId, "admin-recipe:image-backfill", adminId, requestHash, response);
          return { result: response, repeated: false };
        });
        if (result.repeated) removePublishedImages = true;
        return result.result;
    } catch (error) {
      removePublishedImages = true;
      throw error;
    } finally {
      const failedPublishedKeys = removePublishedImages
        ? await this.adminRecipeImageService.removePublishedImages(publishedStorageKeys)
        : [];
      const failedTempKeys = await this.adminRecipeImageService.discardTempImages(tempKeys);
      if (failedPublishedKeys.length || failedTempKeys.length) {
        try {
          await this.prisma.auditEvent.create({
            data: {
              actorType: "ADMIN",
              actorAdminId: adminId,
              action: "RECIPE_IMAGE_CLEANUP_FAILED",
              objectType: "RECIPE",
              objectId: recipeId,
              payload: { storageKeys: failedPublishedKeys, tempKeys: failedTempKeys }
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown error";
          console.error(`[admin] recipe image cleanup audit failed for recipe ${recipeId}: ${message}`);
        }
      }
    }
  }

  async listRecipeWiki(
    page: number,
    pageSize: number,
    keyword: string | undefined,
    adminId: UUID
  ): Promise<PageResult<AdminRecipeWikiSummary>> {
    await this.requireSuperAdmin(adminId);
    const normalizedPage = toPositiveInt(page, 1);
    const normalizedPageSize = Math.min(toPositiveInt(pageSize, 20), 100);
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const searchKey = keyword?.trim() ? buildSearchKey(keyword) : null;
    const where: Prisma.RecipeWhereInput = {
      status: "ACTIVE",
      ...(searchKey ? { title: { contains: searchKey } } : {}),
      currentVersion: {
        is: {
          OR: [
            { cookAssistant: { is: null } },
            { cookAssistant: { is: { status: { not: "READY" }, isQueueDismissed: false } } }
          ]
        }
      }
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        include: {
          owner: { select: { uid: true, nickname: true } },
          currentVersion: {
            select: {
              cookAssistant: { select: { status: true } },
              recipeWikiRequests: {
                orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
                take: 1,
                select: {
                  requestedAt: true,
                  user: { select: { uid: true, nickname: true } }
                }
              }
            }
          }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: normalizedPageSize
      }),
      this.prisma.recipe.count({ where })
    ]);

    const versionIds = items.map(item => item.currentVersionId);
    const pendingRows = versionIds.length
      ? await this.prisma.recipeCookAssistantRequest.groupBy({
          by: ["recipeVersionId"],
          where: { recipeVersionId: { in: versionIds }, status: "PENDING" },
          _count: { _all: true }
        })
      : [];
    const pendingMap = new Map(pendingRows.map(row => [row.recipeVersionId, row._count._all]));
    const importRows = versionIds.length
      ? await this.prisma.recipeImportItem.findMany({
          where: { recipeId: { in: items.map(item => item.id) }, job: { sourceType: "JSON" } },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          distinct: ["recipeId"],
          select: { recipeId: true }
        })
      : [];
    const importWikiRecipeIds = new Set(importRows.flatMap(item => item.recipeId === null ? [] : [item.recipeId]));

    return {
      items: items.map(item => {
        const latest = item.currentVersion.recipeWikiRequests[0] ?? null;
        const wikiStatus = (item.currentVersion.cookAssistant?.status ?? "MISSING") as AdminRecipeWikiSummary["wikiStatus"];
        return {
          id: item.id,
          title: item.title,
          coverImageUrl: item.coverImageUrl,
          contentVersionId: item.currentVersionId,
          ownerUid: item.owner.uid,
          ownerNickname: item.owner.nickname,
          sourceType: item.isInspiration ? "PUBLIC_CONTENT_POOL" : "USER",
          wikiStatus,
          hasImportWiki: importWikiRecipeIds.has(item.id),
          hasPendingRequest: (pendingMap.get(item.currentVersionId) ?? 0) > 0,
          latestRequestAt: latest ? toIsoDate(latest.requestedAt) : null,
          latestRequestUserUid: latest?.user.uid ?? null,
          latestRequestUserNickname: latest?.user.nickname ?? null,
          updatedAt: toIsoDate(item.updatedAt)
        };
      }),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: skip + items.length < total
    };
  }

  async quickFillRecipeWikiFromImport(
    recipeId: UUID,
    expectedContentVersionId: UUID,
    operationId: OperationId,
    adminId: UUID
  ): Promise<AdminRecipeDetail> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${recipeId}:${expectedContentVersionId}`;
    await this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<{ recipeId: UUID }>(
        tx, operationId, "admin-recipe-wiki:quick-fill-import", adminId, requestHash
      );
      if (repeated) return;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:quick-fill-import", adminId, requestHash);
      await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${recipeId} FOR UPDATE`;
      const recipe = await tx.recipe.findFirst({
        where: { id: recipeId, status: "ACTIVE" },
        select: { id: true, currentVersionId: true, currentVersion: { select: { cookAssistant: { select: { status: true } } } } }
      });
      if (!recipe) throw new NotFoundException("正常菜谱不存在");
      if (recipe.currentVersionId !== expectedContentVersionId) {
        throw new ConflictException("菜谱正文版本已更新，请刷新后重试");
      }
      if (recipe.currentVersion.cookAssistant?.status === "READY") {
        throw new ConflictException("当前 Wiki 已前台可用，不能从导入记录覆盖");
      }
      const source = await tx.recipeImportItem.findFirst({
        where: { recipeId, job: { sourceType: "JSON" } },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { recipeBodyJson: true }
      });
      if (!source) throw new NotFoundException("没有关联的菜谱导入 Wiki 数据");
      const recipeBody = normalizeRecipeImportBody(fromJson<RecipeImportRecipeBody>(source.recipeBodyJson));
      const item: RecipeWikiImportItem = {
        recipeId,
        contentVersionId: expectedContentVersionId,
        recipeContent: null,
        tags: recipeBody.tags ?? [],
        assistantSteps: (recipeBody.assistantSteps ?? []).map(step => ({
          order: step.order,
          phase: step.phase,
          action: step.action ?? "OTHER",
          title: step.title,
          detail: step.detail,
          imageUrl: step.imageTempKey ? null : step.imageUrl ?? null,
          imagePrompt: step.imagePrompt ?? null,
          durationMinutes: step.durationMinutes,
          durationText: step.durationText ?? null
        }))
      };
      await this.importRecipeWikiItem(tx, item, adminId, { preserveExistingTags: true });
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:quick-fill-import", adminId, requestHash, { recipeId });
    });
    return this.getRecipeDetail(recipeId, adminId);
  }

  async exportRecipeWiki(recipeId: UUID, adminId: UUID): Promise<AdminRecipeWikiExportDocument> {
    await this.requireSuperAdmin(adminId);
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        currentVersion: {
          include: {
            versionTags: true,
            cookAssistant: true
          }
        }
      }
    });
    if (!recipe || recipe.status !== "ACTIVE") throw new NotFoundException("正常菜谱不存在");
    return this.buildRecipeWikiExportDocument(recipe);
  }

  async exportRecipeWikiBatch(recipeIds: UUID[], adminId: UUID): Promise<AdminRecipeWikiBatchExportDocument> {
    await this.requireSuperAdmin(adminId);
    const uniqueIds = Array.from(new Set(recipeIds));
    const recipes = await this.prisma.recipe.findMany({
      where: { id: { in: uniqueIds }, status: "ACTIVE" },
      include: {
        currentVersion: {
          include: {
            versionTags: true,
            cookAssistant: true
          }
        }
      }
    });
    if (recipes.length !== uniqueIds.length) throw new BadRequestException("存在无效或非正常菜谱");
    const byId = new Map(recipes.map(recipe => [recipe.id, recipe]));
    return {
      schemaVersion: "recipe.wiki.batch.v1",
      recipes: uniqueIds.map(id => {
        const document = this.buildRecipeWikiExportDocument(byId.get(id)!);
        const { schemaVersion: _schemaVersion, ...item } = document;
        return item;
      })
    };
  }

  async importRecipeWiki(buffer: Buffer, operationId: OperationId, adminId: UUID, fields?: string): Promise<AdminRecipeWikiImportResult> {
    await this.requireSuperAdmin(adminId);
    if (buffer.byteLength > 10 * 1024 * 1024) throw new BadRequestException("Wiki JSON 文件不能超过 10MB");
    const selectedFields = parseRecipeWikiReplaceFields(fields);
    let document: unknown;
    try {
      document = JSON.parse(buffer.toString("utf8")) as unknown;
    } catch {
      throw new BadRequestException("Wiki JSON 格式不正确");
    }
    const parsed = parseRecipeWikiDocument(document, selectedFields);
    if (parsed.issues.length) {
      throw new BadRequestException(parsed.issues.slice(0, 10).map(item => `${item.field ?? "根"}：${item.message}`).join("；"));
    }
    const itemCount = parsed.items.length + parsed.invalidItems.length;
    if (!itemCount || itemCount > 100) throw new BadRequestException("一次最多导入 100 条 Wiki");
    const recipeIds = [...parsed.items.map(item => item.recipeId), ...parsed.invalidItems.map(item => item.recipeId)];
    if (new Set(recipeIds).size !== recipeIds.length) throw new BadRequestException("文件中 recipeId 不能重复");

    const requestHash = createHash("sha256").update(buffer).update(JSON.stringify([...selectedFields].sort())).digest("hex");
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminRecipeWikiImportResult>(tx, operationId, "admin-recipe-wiki:import", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:import", adminId, requestHash);

      const items: AdminRecipeWikiImportResult["items"] = parsed.invalidItems.map(item => ({
        recipeId: item.recipeId,
        status: "REJECTED",
        message: item.issues.slice(0, 5).map(issue => `${issue.field ?? "字段"}：${issue.message}`).join("；").slice(0, 500)
      }));
      for (const item of [...parsed.items].sort((left, right) => left.recipeId - right.recipeId)) {
        await tx.$executeRawUnsafe("SAVEPOINT admin_recipe_wiki_item");
        try {
          await this.importRecipeWikiItem(tx, item, adminId, { selectedFields });
          await tx.$executeRawUnsafe("RELEASE SAVEPOINT admin_recipe_wiki_item");
          items.push({ recipeId: item.recipeId, status: "REPLACED", message: null });
        } catch (error) {
          await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT admin_recipe_wiki_item");
          await tx.$executeRawUnsafe("RELEASE SAVEPOINT admin_recipe_wiki_item");
          items.push({
            recipeId: item.recipeId,
            status: "REJECTED",
            message: safeRecipeWikiImportErrorMessage(error)
          });
        }
      }
      const result = {
        replacedCount: items.filter(item => item.status === "REPLACED").length,
        rejectedCount: items.filter(item => item.status === "REJECTED").length,
        items
      } satisfies AdminRecipeWikiImportResult;
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:import", adminId, requestHash, result);
      return result;
    });
  }

  async rejectRecipeWiki(recipeId: UUID, reason: string, operationId: OperationId, adminId: UUID): Promise<AdminRecipeWikiRejectResult> {
    await this.requireSuperAdmin(adminId);
    const rejectionReason = reason.trim();
    if (!rejectionReason) throw new BadRequestException("拒绝原因不能为空");
    const requestHash = `${recipeId}:${rejectionReason}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminRecipeWikiRejectResult>(tx, operationId, "admin-recipe-wiki:reject", adminId, requestHash);
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:reject", adminId, requestHash);
      const recipe = await tx.recipe.findUnique({
        where: { id: recipeId },
        include: { currentVersion: { include: { cookAssistant: true } } }
      });
      if (!recipe || recipe.status !== "ACTIVE") throw new NotFoundException("正常菜谱不存在");
      if (recipe.currentVersion.cookAssistant?.status === "READY") throw new ConflictException("当前 Wiki 已完成，不能拒绝");
      const now = new Date();
      const userIds = await this.settleRecipeWikiRequests(tx, recipe.currentVersionId, "REJECTED", now, rejectionReason);
      await tx.recipeCookAssistant.upsert({
        where: { recipeVersionId: recipe.currentVersionId },
        update: {
          status: "NEEDS_REVIEW",
          lastError: rejectionReason,
          lastAttemptAt: now,
          updatedByAdminId: adminId
        },
        create: {
          recipeVersionId: recipe.currentVersionId,
          status: "NEEDS_REVIEW",
          lastError: rejectionReason,
          lastAttemptAt: now,
          attemptCount: 1,
          candidateJson: Prisma.DbNull,
          snapshotJson: Prisma.DbNull,
          generatedAt: null,
          updatedByAdminId: adminId
        }
      });
      const result = {
        recipeId,
        contentVersionId: recipe.currentVersionId,
        status: "REJECTED" as const,
        rejectedRequestCount: userIds.length,
        rejectionReason
      } satisfies AdminRecipeWikiRejectResult;
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_WIKI_REJECTED",
          objectType: "RECIPE",
          objectId: recipeId,
          payload: { contentVersionId: recipe.currentVersionId, rejectionReason, rejectedRequestCount: userIds.length }
        }
      });
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:reject", adminId, requestHash, result);
      return result;
    });
  }

  async dismissRecipeWiki(
    recipeId: UUID,
    expectedContentVersionId: UUID,
    operationId: OperationId,
    adminId: UUID
  ): Promise<AdminRecipeWikiDismissResult> {
    await this.requireSuperAdmin(adminId);
    const requestHash = `${recipeId}:${expectedContentVersionId}`;
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminRecipeWikiDismissResult>(
        tx, operationId, "admin-recipe-wiki:dismiss", adminId, requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:dismiss", adminId, requestHash);
      const result = await this.dismissRecipeWikiEntry(tx, recipeId, expectedContentVersionId, adminId);
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:dismiss", adminId, requestHash, result);
      return result;
    });
  }

  async dismissRecipeWikiBatch(
    items: Array<{ recipeId: UUID; expectedContentVersionId: UUID }>,
    operationId: OperationId,
    adminId: UUID
  ): Promise<AdminRecipeWikiDismissBatchResult> {
    await this.requireSuperAdmin(adminId);
    if (!items.length || items.length > 100 || new Set(items.map(item => item.recipeId)).size !== items.length) {
      throw new BadRequestException("批量删除需要选择 1 至 100 个不重复的 Wiki 补充项");
    }
    const orderedItems = [...items].sort((left, right) => left.recipeId - right.recipeId);
    const requestHash = JSON.stringify(orderedItems);
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AdminRecipeWikiDismissBatchResult>(
        tx, operationId, "admin-recipe-wiki:dismiss-batch", adminId, requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:dismiss-batch", adminId, requestHash);
      let dismissedRequestCount = 0;
      for (const item of orderedItems) {
        const result = await this.dismissRecipeWikiEntry(tx, item.recipeId, item.expectedContentVersionId, adminId);
        dismissedRequestCount += result.dismissedRequestCount;
      }
      const result = { dismissedCount: orderedItems.length, dismissedRequestCount } satisfies AdminRecipeWikiDismissBatchResult;
      await completeAdminIdempotentOperation(tx, operationId, "admin-recipe-wiki:dismiss-batch", adminId, requestHash, result);
      return result;
    });
  }

  private async dismissRecipeWikiEntry(
    tx: Prisma.TransactionClient,
    recipeId: UUID,
    expectedContentVersionId: UUID,
    adminId: UUID
  ): Promise<AdminRecipeWikiDismissResult> {
    await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${recipeId} FOR UPDATE`;
    const recipe = await tx.recipe.findUnique({
      where: { id: recipeId },
      include: { currentVersion: { include: { cookAssistant: true } } }
    });
    if (!recipe || recipe.status !== "ACTIVE") throw new NotFoundException("正常菜谱不存在");
    if (recipe.currentVersionId !== expectedContentVersionId) throw new ConflictException("菜谱正文版本已变化，请刷新后重试");
    if (recipe.currentVersion.cookAssistant?.status === "READY") throw new ConflictException("当前 Wiki 已完成，不能从待补充列表删除");

    const now = new Date();
    const dismissedRequestCount = (await this.settleRecipeWikiRequests(
      tx, recipe.currentVersionId, "REJECTED", now, "后台已从待补充列表移除该 Wiki"
    )).length;
    await tx.recipeCookAssistant.upsert({
      where: { recipeVersionId: recipe.currentVersionId },
      update: { isQueueDismissed: true, updatedByAdminId: adminId },
      create: {
        recipeVersionId: recipe.currentVersionId,
        status: "PENDING",
        isQueueDismissed: true,
        lastAttemptAt: now,
        attemptCount: 1,
        candidateJson: Prisma.DbNull,
        snapshotJson: Prisma.DbNull,
        generatedAt: null,
        updatedByAdminId: adminId
      }
    });
    await tx.auditEvent.create({
      data: {
        actorType: "ADMIN",
        actorAdminId: adminId,
        action: "RECIPE_WIKI_QUEUE_DISMISSED",
        objectType: "RECIPE",
        objectId: recipeId,
        payload: { contentVersionId: recipe.currentVersionId, dismissedRequestCount }
      }
    });
    return { recipeId, contentVersionId: recipe.currentVersionId, status: "DISMISSED", dismissedRequestCount };
  }

  private buildRecipeWikiExportDocument(recipe: {
    id: UUID;
    currentVersionId: UUID;
    currentVersion: {
      versionTags: Array<{ tagCode: string; tagValue: string }>;
      cookAssistant: { status: string; generatedAt: Date | null; snapshotJson: unknown } | null;
    };
  }): AdminRecipeWikiExportDocument {
    const assistant = versionAssistantToSnapshot(recipe.currentVersion.cookAssistant);
    return {
      schemaVersion: "recipe.wiki.v1",
      recipeId: recipe.id,
      contentVersionId: recipe.currentVersionId,
      wiki: {
        tags: recipe.currentVersion.versionTags
          .filter(item => (recipeWikiTagCodes as readonly string[]).includes(item.tagCode))
          .map(item => ({ tagCode: item.tagCode as RecipeWikiImportItem["tags"][number]["tagCode"], tagValue: item.tagValue })),
        assistant: {
          steps: (assistant?.steps ?? []).map(step => ({
            order: step.order,
            phase: step.phase,
            action: step.action ?? "OTHER",
            title: step.title,
            detail: step.detail,
            imageUrl: step.imageUrl,
            imagePrompt: step.imagePrompt ?? null,
            durationMinutes: step.durationMinutes,
            durationText: step.durationText
          }))
        }
      }
    };
  }

  private async replaceRecipeContentFields(
    tx: Prisma.TransactionClient,
    recipe: Prisma.RecipeGetPayload<{ include: { currentVersion: true } }>,
    item: RecipeWikiImportItem,
    selectedFields: ReadonlySet<RecipeWikiReplaceField>
  ) {
    const fields = [...selectedFields].filter((field): field is Exclude<RecipeWikiReplaceField, "tags" | "assistant.steps"> => field !== "tags" && field !== "assistant.steps");
    if (!fields.length) return null;
    const raw = item.recipeContent;
    if (!raw) throw new BadRequestException("菜谱正文内容缺失");
    const content = versionToContent(recipe.currentVersion);
    const next: RecipeContentSnapshot = { ...content, tools: [...(content.tools ?? [])], ingredients: [...content.ingredients], steps: [...content.steps] };

    if (selectedFields.has("name")) {
      if (typeof raw.name !== "string" || !raw.name.trim() || raw.name.trim().length > 120) throw new BadRequestException("菜谱名称必须为 1 到 120 个字符");
      next.name = raw.name.trim();
    }
    if (selectedFields.has("story")) {
      if (raw.story !== null && typeof raw.story !== "string") throw new BadRequestException("菜谱故事格式不正确");
      if (typeof raw.story === "string" && raw.story.length > 2000) throw new BadRequestException("菜谱故事不能超过 2000 个字符");
      next.story = typeof raw.story === "string" ? raw.story.trim() || null : null;
    }
    if (selectedFields.has("difficulty")) {
      const values = ["BEGINNER", "EASY", "SKILLED", "CHALLENGING", null];
      const difficulty = raw.difficulty === "" ? null : raw.difficulty;
      if (!values.includes(difficulty as never)) throw new BadRequestException("菜谱难度不支持");
      next.difficulty = difficulty as RecipeContentSnapshot["difficulty"];
    }
    if (selectedFields.has("duration")) {
      const values = ["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60", null];
      const duration = raw.duration === "" ? null : raw.duration;
      if (!values.includes(duration as never)) throw new BadRequestException("菜谱时长不支持");
      next.duration = duration as RecipeContentSnapshot["duration"];
    }
    if (selectedFields.has("tips")) {
      if (raw.tips !== null && typeof raw.tips !== "string") throw new BadRequestException("小贴士格式不正确");
      if (typeof raw.tips === "string" && raw.tips.length > 1000) throw new BadRequestException("小贴士不能超过 1000 个字符");
      next.tips = typeof raw.tips === "string" ? raw.tips.trim() || null : null;
    }
    if (selectedFields.has("keywords")) {
      if (!Array.isArray(raw.keywords) || raw.keywords.length > 20 || raw.keywords.some(value => typeof value !== "string" || value.length > 64)) throw new BadRequestException("关键词必须是最多 20 项、每项不超过 64 个字符的字符串数组");
      next.keywords = Array.from(new Set((raw.keywords as string[]).map(value => value.trim()).filter(Boolean)));
    }
    if (selectedFields.has("tools")) {
      if (!Array.isArray(raw.tools) || raw.tools.length > 40 || raw.tools.some(value => !value || typeof value !== "object" || typeof (value as { name?: unknown }).name !== "string" || (value as { name: string }).name.length > 64)) {
        throw new BadRequestException("工具必须是名称对象数组");
      }
      next.tools = (raw.tools as Array<{ name: string }>).map(value => ({ name: value.name.trim() })).filter(value => value.name);
    }
    if (selectedFields.has("ingredients")) {
      if (!Array.isArray(raw.ingredients) || raw.ingredients.length === 0) throw new BadRequestException("至少需要一个食材");
      const rows = raw.ingredients as Array<Record<string, unknown>>;
      if (rows.length > 100 || rows.some(value => !value || typeof value !== "object" || Array.isArray(value))) throw new BadRequestException("食材条目格式不正确");
      const names = rows.map(value => value.name);
      if (names.some(value => typeof value !== "string" || !value.trim())) throw new BadRequestException("食材名称不能为空");
      const ingredientRows = await tx.ingredient.findMany({
        where: { ownerId: null, status: { in: ["ACTIVE", "MERGED"] }, searchKey: { in: (names as string[]).map(buildSearchKey) } },
        include: { category: true, mergedTo: { include: { category: true } } }
      });
      const activeByKey = new Map<string, Map<UUID, { id: UUID; name: string; categoryId: UUID; category: { code: string } }>>();
      for (const row of ingredientRows) {
        const target = row.status === "MERGED" ? row.mergedTo : row;
        if (target?.ownerId === null && target.status === "ACTIVE") {
          const key = buildSearchKey(row.name);
          const matches = activeByKey.get(key) ?? new Map<UUID, typeof target>();
          matches.set(target.id, target);
          activeByKey.set(key, matches);
        }
      }
      const unitNames = rows.flatMap(value => typeof value.unit === "string" ? [value.unit] : []);
      const units = unitNames.length
        ? await tx.unit.findMany({ where: { ownerId: null, searchKey: { in: unitNames.map(buildSearchKey) } } })
        : [];
      next.ingredients = rows.map((value, index) => {
        const name = (value.name as string).trim();
        const ingredientMatches = [...(activeByKey.get(buildSearchKey(name))?.values() ?? [])];
        if (!ingredientMatches.length) throw new NotFoundException(`第 ${index + 1} 个食材“${name}”未匹配到启用中的系统食材`);
        if (ingredientMatches.length !== 1) throw new ConflictException(`第 ${index + 1} 个食材“${name}”匹配到多个系统食材`);
        const ingredient = ingredientMatches[0]!;
        if (typeof value.categoryCode === "string" && value.categoryCode !== ingredient.category.code) {
          throw new BadRequestException(`第 ${index + 1} 个食材分类与系统数据不一致`);
        }
        if (value.fuzzyText === "适量") {
          return { ingredientId: ingredient.id, ingredientName: ingredient.name, source: "SYSTEM", categoryId: ingredient.categoryId, categoryCode: ingredient.category.code, amount: { kind: "FUZZY", text: "适量" } };
        }
        if (typeof value.quantity !== "string" || value.quantity.length > 64 || !isValidWikiRecipeQuantity(value.quantity) || typeof value.unit !== "string" || !value.unit.trim()) {
          throw new BadRequestException(`第 ${index + 1} 个食材的用量或单位不完整`);
        }
        const unitMatches = units.filter(unit => unit.searchKey === buildSearchKey(value.unit as string));
        if (unitMatches.length !== 1) throw new NotFoundException(`第 ${index + 1} 个食材的单位“${value.unit}”未唯一匹配到系统单位`);
        const unit = unitMatches[0];
        return {
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          source: "SYSTEM",
          categoryId: ingredient.categoryId,
          categoryCode: ingredient.category.code,
          amount: { kind: "EXACT", quantity: value.quantity.trim(), unitId: unit.id, unitName: unit.name, unitType: unit.type }
        };
      });
    }
    if (selectedFields.has("steps")) {
      if (!Array.isArray(raw.steps) || raw.steps.length === 0 || raw.steps.length > 40) throw new BadRequestException("制作步骤必须为 1 到 40 步");
      next.steps = (raw.steps as Array<Record<string, unknown>>).map((step, index) => {
        if (!step || typeof step !== "object" || Array.isArray(step)) throw new BadRequestException(`第 ${index + 1} 个步骤格式不正确`);
        if (!step || typeof step.text !== "string" || !step.text.trim() || step.text.length > 2000) throw new BadRequestException(`第 ${index + 1} 个步骤内容无效`);
        if (step.imageUrl !== null && step.imageUrl !== undefined && typeof step.imageUrl !== "string") throw new BadRequestException(`第 ${index + 1} 个步骤图片地址无效`);
        if (typeof step.imageUrl === "string") {
          if (step.imageUrl.length > 512) throw new BadRequestException(`第 ${index + 1} 个步骤图片地址过长`);
          try {
            const imageUrl = new URL(step.imageUrl);
            if (imageUrl.protocol !== "https:" && imageUrl.protocol !== "http:") throw new Error("protocol");
          } catch {
            throw new BadRequestException(`第 ${index + 1} 个步骤图片地址无效`);
          }
        }
        if (step.imagePrompt !== null && step.imagePrompt !== undefined && typeof step.imagePrompt !== "string") throw new BadRequestException(`第 ${index + 1} 个步骤图片提示词无效`);
        if (typeof step.imagePrompt === "string" && step.imagePrompt.length > 1000) throw new BadRequestException(`第 ${index + 1} 个步骤图片提示词过长`);
        return { text: step.text.trim(), imageUrl: typeof step.imageUrl === "string" ? step.imageUrl : null, imagePrompt: typeof step.imagePrompt === "string" ? step.imagePrompt.trim() || null : null };
      });
    }

    const data: Prisma.RecipeContentVersionUpdateInput = {
      ...(selectedFields.has("name") ? { name: next.name } : {}),
      ...(selectedFields.has("story") ? { story: next.story } : {}),
      ...(selectedFields.has("difficulty") ? { difficulty: next.difficulty } : {}),
      ...(selectedFields.has("duration") ? { duration: next.duration } : {}),
      ...(selectedFields.has("tips") ? { tips: next.tips } : {}),
      ...(selectedFields.has("keywords") ? { keywordsJson: toJson(next.keywords) } : {}),
      ...(selectedFields.has("tools") ? { toolsJson: toJson(next.tools ?? []) } : {}),
      ...(selectedFields.has("ingredients") ? { ingredientsJson: toJson(next.ingredients) } : {}),
      ...(selectedFields.has("steps") ? { stepsJson: toJson(next.steps), imagesJson: toJson({ coverImageUrl: recipe.coverImageUrl, stepImages: next.steps.map((step, index) => ({ index, imageUrl: step.imageUrl })).filter(step => step.imageUrl) }) } : {}),
      searchText: buildRecipeSearchText(next),
      contentSizeBytes: contentSizeBytes(next)
    };
    await tx.recipeContentVersion.update({ where: { id: item.contentVersionId }, data });
    const recipeData: Prisma.RecipeUpdateInput = {
      ...(selectedFields.has("name") ? { title: next.name } : {}),
      searchText: buildRecipeSearchText(next),
      version: { increment: 1 }
    };
    await tx.recipe.update({ where: { id: recipe.id }, data: recipeData });
    if (selectedFields.has("ingredients")) {
      await tx.recipeVersionIngredient.deleteMany({ where: { recipeVersionId: item.contentVersionId } });
      await indexRecipeVersionIngredients(tx, item.contentVersionId, toJson(next.ingredients) as unknown as Prisma.JsonValue);
      await tx.recipeNutritionSnapshot.deleteMany({ where: { recipeVersionId: item.contentVersionId } });
      await loadRecipeNutritionSummary(tx, item.contentVersionId, next);
    }
    if (["name", "story", "ingredients", "steps"].some(field => selectedFields.has(field as RecipeWikiReplaceField))) {
      await replaceAutoRecipeVersionTags(tx, item.contentVersionId, next);
    }
    return next;
  }

  private async importRecipeWikiItem(
    tx: Prisma.TransactionClient,
    item: RecipeWikiImportItem,
    adminId: UUID,
    options: { preserveExistingTags?: boolean; selectedFields?: ReadonlySet<RecipeWikiReplaceField> } = {}
  ) {
    await tx.$queryRaw`SELECT "id" FROM "recipes" WHERE "id" = ${item.recipeId} FOR UPDATE`;
    const recipe = await tx.recipe.findUnique({
      where: { id: item.recipeId },
      include: { currentVersion: { include: { cookAssistant: true } } }
    });
    if (!recipe || recipe.status !== "ACTIVE") throw new NotFoundException("菜谱不存在或不是正常状态");
    if (recipe.currentVersionId !== item.contentVersionId) throw new ConflictException("菜谱正文版本已变化，请重新导出");
    const selectedFields = options.selectedFields ?? new Set<RecipeWikiReplaceField>(["tags", "assistant.steps"]);
    const updatedContent = await this.replaceRecipeContentFields(tx, recipe, item, selectedFields);
    const candidate = selectedFields.has("assistant.steps") ? buildImportedRecipeAssistantSnapshot(item.assistantSteps) : null;
    if (candidate && !this.isRecipeAssistantCandidateReady(candidate)) throw new BadRequestException("Wiki 助理步骤不完整，不能保存为 READY");
    const now = new Date();

    if (selectedFields.has("tags")) await tx.recipeVersionTag.deleteMany({
      where: options.preserveExistingTags
        ? { recipeVersionId: item.contentVersionId, source: "OPS", status: "CANDIDATE", tagCode: { in: [...recipeWikiTagCodes] } }
        : { recipeVersionId: item.contentVersionId, tagCode: { in: [...recipeWikiTagCodes] } }
    });
    const existingTags = selectedFields.has("tags") && options.preserveExistingTags
      ? await tx.recipeVersionTag.findMany({
          where: { recipeVersionId: item.contentVersionId, tagCode: { in: [...recipeWikiTagCodes] } },
          select: { tagCode: true, tagValue: true, source: true }
        })
      : [];
    const existingTagCodes = new Set(existingTags.map(tag => tag.tagCode));
    const existingTagKeys = new Set(existingTags.map(tag => `${tag.tagCode}:${tag.tagValue}`));
    const importedTags = !selectedFields.has("tags") ? [] : options.preserveExistingTags
      ? item.tags.filter(tag => tag.tagCode === "MEAL_TYPE"
          ? !existingTagKeys.has(`${tag.tagCode}:${tag.tagValue}`)
          : !existingTagCodes.has(tag.tagCode))
      : item.tags;
    if (importedTags.length) {
      await tx.recipeVersionTag.createMany({
        data: importedTags.map((tag, index) => ({
          recipeVersionId: item.contentVersionId,
          tagCode: tag.tagCode,
          tagValue: tag.tagValue,
          source: "OPS" as const,
          status: "CONFIRMED" as const,
          confidence: 1,
          sortOrder: index,
          isLocked: true
        }))
      });
    }
    if (candidate) await tx.recipeCookAssistant.upsert({
      where: { recipeVersionId: item.contentVersionId },
      update: {
        status: "READY",
        candidateJson: Prisma.DbNull,
        snapshotJson: toJson(candidate),
        generatedAt: now,
        lastAttemptAt: now,
        attemptCount: { increment: 1 },
        lastError: null,
        source: "OPS",
        updatedByAdminId: adminId
      },
      create: {
        recipeVersionId: item.contentVersionId,
        status: "READY",
        candidateJson: Prisma.DbNull,
        snapshotJson: toJson(candidate),
        generatedAt: now,
        lastAttemptAt: now,
        attemptCount: 1,
        lastError: null,
        source: "OPS",
        updatedByAdminId: adminId
      }
    });
    const userIds = candidate ? await this.settleRecipeWikiRequests(tx, item.contentVersionId, "READY", now) : [];
    await tx.auditEvent.create({
      data: {
        actorType: "ADMIN",
        actorAdminId: adminId,
        action: selectedFields.has("tags") || selectedFields.has("assistant.steps") ? "RECIPE_WIKI_IMPORTED" : "RECIPE_CONTENT_REPLACED",
        objectType: "RECIPE",
        objectId: item.recipeId,
        payload: { contentVersionId: item.contentVersionId, replacedFields: [...selectedFields], tagCount: importedTags.length, assistantStepCount: candidate ? item.assistantSteps.length : 0, contentReplaced: Boolean(updatedContent), notifiedUserCount: userIds.length }
      }
    });
  }

  private async settleRecipeWikiRequests(
    tx: Prisma.TransactionClient,
    recipeVersionId: UUID,
    status: "READY" | "REJECTED",
    now: Date,
    rejectionReason: string | null = null
  ) {
    const requests = await tx.recipeCookAssistantRequest.findMany({
      where: { recipeVersionId, status: "PENDING" },
      select: { userId: true }
    });
    await tx.recipeCookAssistantRequest.updateMany({
      where: { recipeVersionId, status: "PENDING" },
      data: {
        status,
        resolvedAt: now,
        rejectionReason: status === "REJECTED" ? rejectionReason : null
      }
    });
    if (status === "READY") {
      await tx.cookAssistantUnlock.updateMany({
        where: { recipeVersionId, status: "RESERVED" },
        data: { status: "CONSUMED" }
      });
    } else {
      await tx.cookAssistantUnlock.deleteMany({
        where: { recipeVersionId, status: "RESERVED" }
      });
    }
    return requests.map(item => item.userId);
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
    let cleanupRecipeId: UUID | null = null;
    try {
      const result = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<AdminRecipeDetail>(tx, body.operationId, "admin-recipe:create", adminId, requestHash);
        if (repeated) return repeated;
        await startAdminIdempotentOperation(tx, body.operationId, "admin-recipe:create", adminId, requestHash);

        const inspirationCategory = await this.requireInspirationCategory(tx, body.inspirationCategoryId);
        const recipeId = await this.reserveRecipeId(tx);
        const contentVersionId = await this.reserveRecipeContentVersionId(tx);
        cleanupRecipeId = recipeId;
        const imageState = await this.buildAdminRecipeImageState(
          request,
          recipeId,
          contentVersionId,
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
          data: { id: contentVersionId, ...this.buildAdminRecipeVersionCreateInput(content, imageState.coverImageUrl) }
        });
        await indexRecipeVersionIngredients(tx, nextVersion.id, nextVersion.ingredientsJson);
        await replaceAutoRecipeVersionTags(tx, nextVersion.id, content);
        await this.syncRecipeAssistant(tx, nextVersion.id, content);

        let inspirationOwnerId: UUID;
        try {
          inspirationOwnerId = await pickPublicContentOwner(tx);
        } catch (error) {
          if (error instanceof Error && error.message.includes("公共内容用户池")) {
            throw new ConflictException("公共内容用户池未完成配置，请先准备 100 个有效用户");
          }
          throw error;
        }
        const inspirationOwner = await tx.user.findUnique({
          where: { id: inspirationOwnerId },
          select: { nickname: true }
        });
        if (!inspirationOwner) throw new ConflictException("公共内容用户不存在");
        const created = await tx.recipe.create({
          data: {
            id: recipeId,
            ownerId: inspirationOwnerId,
            ownerNicknameSnapshot: toOwnerNicknameSnapshot(inspirationOwner.nickname),
            isInspiration: true,
            inspirationPublishedAt: new Date(),
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
      await this.removeAdminRecipeImagesWithAudit(publishedStorageKeys, adminId, "RECIPE", cleanupRecipeId, "create-rollback");
      throw error;
    } finally {
      await this.discardAdminRecipeTempImagesWithAudit(consumedTempKeys, adminId, "RECIPE", cleanupRecipeId, "create-temp-cleanup");
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
        const contentVersionId = await this.reserveRecipeContentVersionId(tx);
        const imageState = await this.buildAdminRecipeImageState(
          request,
          recipeId,
          contentVersionId,
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
          data: { id: contentVersionId, ...this.buildAdminRecipeVersionCreateInput(content, imageState.coverImageUrl) }
        });
        await indexRecipeVersionIngredients(tx, nextVersion.id, nextVersion.ingredientsJson);
        await replaceAutoRecipeVersionTags(tx, nextVersion.id, content);
        await this.syncRecipeAssistant(tx, nextVersion.id, content);

        const updated = await tx.recipe.update({
          where: { id: recipeId },
          data: {
            currentVersionId: nextVersion.id,
            title: content.name,
            searchText: buildRecipeSearchText(content),
            inspirationCategoryId: inspirationCategory.id,
            inspirationPublishedAt: recipe.inspirationPublishedAt ?? new Date(),
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
      await this.removeAdminRecipeImagesWithAudit(publishedStorageKeys, adminId, "RECIPE", recipeId, "update-rollback");
      throw error;
    } finally {
      await this.discardAdminRecipeTempImagesWithAudit(consumedTempKeys, adminId, "RECIPE", recipeId, "update-temp-cleanup");
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
        tx.diningEventParticipantBringRecipe.count({ where: { recipeId } }),
        tx.recipeCollection.count({ where: { sourceVersionId: recipe.currentVersionId } }),
        tx.homeTopicItem.count({ where: { sourceVersionId: recipe.currentVersionId } }),
        tx.mealPlanDish.count({ where: { recipeVersionId: recipe.currentVersionId } }),
        tx.diningEventParticipantBringRecipe.count({ where: { recipeVersionId: recipe.currentVersionId } }),
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
          diningEventParticipantBringRecipes: { none: {} },
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
    await this.removeAdminRecipeImagesWithAudit(deletion.storageKeys, adminId, "RECIPE", recipeId, "recipe-delete");
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

  private async removeAdminRecipeImagesWithAudit(
    storageKeys: Iterable<string>,
    adminId: UUID,
    objectType: string,
    objectId: UUID | null,
    phase: string
  ) {
    const failedStorageKeys = await this.adminRecipeImageService.removePublishedImages(storageKeys);
    await this.auditAdminRecipeImageCleanupFailure(adminId, objectType, objectId, { storageKeys: failedStorageKeys, phase });
  }

  private async discardAdminRecipeTempImagesWithAudit(
    tempKeys: Iterable<string>,
    adminId: UUID,
    objectType: string,
    objectId: UUID | null,
    phase: string
  ) {
    const failedTempKeys = await this.adminRecipeImageService.discardTempImages(tempKeys);
    await this.auditAdminRecipeImageCleanupFailure(adminId, objectType, objectId, { tempKeys: failedTempKeys, phase });
  }

  private async auditAdminRecipeImageCleanupFailure(
    adminId: UUID,
    objectType: string,
    objectId: UUID | null,
    payload: { storageKeys?: string[]; tempKeys?: string[]; phase: string }
  ) {
    if (!payload.storageKeys?.length && !payload.tempKeys?.length) return;
    try {
      await this.prisma.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorAdminId: adminId,
          action: "RECIPE_IMAGE_CLEANUP_FAILED",
          objectType,
          objectId,
          payload
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[admin] recipe image cleanup audit failed for ${objectType} ${objectId}, payload=${JSON.stringify(payload)}: ${message}`);
    }
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
    recommendationRank?: "NORMAL" | "DOWNRANK" | "STRONG_DOWNRANK";
    recommendationRankReason?: string | null;
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
      ownerUid: recipe.owner?.uid ?? null,
      hasWikiCandidate: false,
      recommendationRank: recipe.recommendationRank ?? "NORMAL",
      recommendationRankReason: recipe.recommendationRankReason ?? null
    };
  }

  private async toAdminRecipeDetail(tx: Prisma.TransactionClient | PrismaService, recipe: AdminRecipeRow): Promise<AdminRecipeDetail> {
    const content = versionToContent(recipe.currentVersion);
    const assistantRecord = await this.loadRecipeAssistantRecord(tx, recipe.currentVersionId);
    const assistant = versionAssistantToSnapshot(assistantRecord);
    const assistantCandidate = assistantRecord?.candidateJson == null || assistantRecord.status === "READY"
      ? null
      : fromJson<AdminRecipeDetail["assistantCandidate"]>(assistantRecord.candidateJson);
    const categoryIds = Array.from(new Set(content.ingredients.map(item => item.categoryId)));
    const [tags, nutrition, ingredientCategories] = await Promise.all([
      this.loadRecipeWikiTags(tx, recipe.currentVersionId, content),
      loadRecipeNutritionSummary(tx, recipe.currentVersionId, content),
      categoryIds.length ? tx.ingredientCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, code: true } }) : []
    ]);
    const categoryCodeById = new Map(ingredientCategories.map(item => [item.id, item.code]));
    const detailContent: RecipeContentSnapshot = {
      ...content,
      ingredients: content.ingredients.map(item => ({ ...item, categoryCode: categoryCodeById.get(item.categoryId) ?? null }))
    };
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
      content: detailContent,
      assistantState: this.toRecipeAssistantState(assistantRecord),
      assistant,
      assistantCandidate,
      wiki,
      version: recipe.version,
      reportCount: recipe.reportCount,
      blockedReason: recipe.blockedReason,
      collectCount: recipe.collectCount,
      recommendationRank: recipe.recommendationRank,
      recommendationRankReason: recipe.recommendationRankReason,
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
        EGG: "蛋类",
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
        hasCandidate: false,
        hasSnapshot: false,
        generatedAt: null,
        lastAttemptAt: null,
        attemptCount: 0,
        lastError: null
      };
    }

    return {
      status: record.status,
      hasCandidate: record.candidateJson != null && record.status !== "READY",
      hasSnapshot: record.status === "READY" && Boolean(record.generatedAt && record.snapshotJson != null),
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
    const ingredientIds = Array.from(new Set(
      recipeBody.ingredients
        .map(ingredient => ingredient.ingredientId)
        .filter((value): value is UUID => value !== null)
    ));
    const ingredientRows = ingredientIds.length === 0
      ? []
      : await this.prisma.ingredient.findMany({
          where: {
            id: { in: ingredientIds },
            ownerId: null,
            status: { in: ["PENDING", "ACTIVE", "DISABLED"] }
          },
          include: {
            category: true,
            defaultUnit: true
          }
        });
    const ingredientMap = new Map(ingredientRows.map(ingredient => [ingredient.id, ingredient]));
    const ingredientRefs = ingredientIds.flatMap(id => {
      const ingredient = ingredientMap.get(id);
      return ingredient ? [toAdminIngredientSummary(ingredient)] : [];
    });
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
      ingredientRefs,
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
        quantity: item.fuzzyText ? null : item.quantity?.trim() || null,
        unitText: item.fuzzyText ? null : item.unitText?.trim() || null,
        unitId: item.fuzzyText ? null : item.unitId ?? null,
        fuzzyText: item.fuzzyText ? "适量" : null,
        note: item.note?.trim() || null,
        categoryCode: item.categoryCode?.trim() || null
      })),
      steps: body.steps.map(item => ({
        text: item.text.trim(),
        imageUrl: item.imageUrl?.trim() || null,
        imageKey: item.imageKey?.trim() || null,
        imageTempKey: item.imageTempKey?.trim() || null,
        imagePrompt: item.imagePrompt?.trim() || null
      }))
    };
    if (!strictMatch) {
      nextBody.ingredients = await this.materializeImportIngredients(tx, nextBody.ingredients);
    } else {
      const ingredientIds = Array.from(new Set(
        nextBody.ingredients
          .map(item => item.ingredientId)
          .filter((id): id is UUID => id !== null)
      ));
      const ingredientSelect = {
        id: true,
        ownerId: true,
        name: true,
        status: true,
        category: {
          select: { code: true }
        },
        mergedTo: {
          select: {
            id: true,
            ownerId: true,
            name: true,
            status: true,
            category: {
              select: { code: true }
            }
          }
        }
      } satisfies Prisma.IngredientSelect;
      const readReferencedIngredients = async () => ingredientIds.length > 0
        ? await tx.ingredient.findMany({
            where: {
              id: { in: ingredientIds },
              ownerId: null
            },
            select: ingredientSelect
          })
        : [];
      let referencedIngredients = await readReferencedIngredients();
      const lockedIds = new Set<UUID>();
      const lockIngredients = async (ids: UUID[]) => {
        for (const ingredientId of Array.from(new Set(ids)).sort((left, right) => left - right)) {
          if (lockedIds.has(ingredientId)) continue;
          await tx.$queryRaw`SELECT "id" FROM "ingredients" WHERE "id" = ${ingredientId} FOR UPDATE`;
          lockedIds.add(ingredientId);
        }
      };
      await lockIngredients([
        ...ingredientIds,
        ...referencedIngredients.flatMap(item => item.mergedTo ? [item.mergedTo.id] : [])
      ]);
      referencedIngredients = await readReferencedIngredients();
      const lateTargetIds = referencedIngredients.flatMap(item => item.mergedTo ? [item.mergedTo.id] : []);
      if (lateTargetIds.some(id => !lockedIds.has(id))) {
        await lockIngredients(lateTargetIds);
        referencedIngredients = await readReferencedIngredients();
      }
      const referencedById = new Map(referencedIngredients.map(item => [item.id, item]));
      nextBody.ingredients = nextBody.ingredients.map(item => {
        const referenced = item.ingredientId ? referencedById.get(item.ingredientId) : null;
        if (!referenced) return item;
        const selected = referenced.status === "MERGED" ? referenced.mergedTo : referenced;
        if (
          referenced.status === "MERGED"
          && (!selected || selected.ownerId !== null || selected.status !== "ACTIVE")
        ) {
          throw new ConflictException("归并食材目标无效，请先修复食材治理数据");
        }
        if (!selected) throw new ConflictException("归并食材目标无效，请先修复食材治理数据");
        return {
          ...item,
          ingredientId: selected.id,
          ingredientName: selected.name,
          categoryCode: selected.category.code
        };
      });
    }
    return nextBody;
  }

  private async refreshRecipeImportIngredientReferences(
    tx: Prisma.TransactionClient,
    sourceIngredientId: UUID | UUID[],
    targetIngredient: { id: UUID; name: string; categoryCode: string }
  ) {
    const sourceIngredientIds = new Set(Array.isArray(sourceIngredientId) ? sourceIngredientId : [sourceIngredientId]);
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
    let updatedCount = 0;
    for (const item of items) {
      const recipeBody = normalizeRecipeImportBody(fromJson<RecipeImportRecipeBody>(item.recipeBodyJson));
      let changed = false;
      const nextIngredients = recipeBody.ingredients.map(ingredient => {
        if (!ingredient.ingredientId || !sourceIngredientIds.has(ingredient.ingredientId)) return ingredient;
        changed = true;
        return {
          ...ingredient,
          ingredientId: targetIngredient.id,
          ingredientName: targetIngredient.name,
          categoryCode: targetIngredient.categoryCode
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
      updatedCount += 1;
      jobIds.add(item.jobId);
    }
    for (const jobId of jobIds) {
      await this.writeRecipeImportJobStats(tx, jobId);
    }
    return updatedCount;
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
                in: ["ACTIVE", "PENDING", "DISABLED"]
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
        if (!ingredient) {
          nextState.errorItems.push({ field: rowLabel, message: `第 ${index + 1} 行食材不存在` });
        } else if (ingredient.status === "DISABLED") {
          nextState.errorItems.push({ field: rowLabel, message: `第 ${index + 1} 行食材已下架，请重新匹配` });
        } else if (ingredient.status === "PENDING") {
          nextState.errorItems.push({ field: rowLabel, message: `第 ${index + 1} 行食材仍在待归类，请先到食材管理完成归类` });
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
      if (item.ingredientId) {
        const matched = await tx.ingredient.findFirst({
          where: {
            id: item.ingredientId,
            ownerId: null,
            status: { in: ["ACTIVE", "MERGED", "PENDING", "DISABLED"] }
          },
          include: {
            category: true,
            mergedTo: {
              include: { category: true }
            }
          }
        });
        if (matched) {
          const selected = matched.status === "MERGED" ? matched.mergedTo : matched;
          if (
            matched.status === "MERGED"
            && (!selected || selected.ownerId !== null || selected.status !== "ACTIVE")
          ) {
            throw new ConflictException("归并食材目标无效，请先修复食材治理数据");
          }
          if (!selected) throw new ConflictException("归并食材目标无效，请先修复食材治理数据");
          nextRows.push({
            ...item,
            ingredientId: selected.id,
            ingredientName: selected.name,
            categoryCode: selected.category.code
          });
          continue;
        }
      }
      if (!item.ingredientName.trim()) {
        nextRows.push({ ...item, ingredientId: null });
        continue;
      }
      const searchKey = buildSearchKey(item.ingredientName);
      const existingRows = await tx.ingredient.findMany({
        where: {
          ownerId: null,
          status: {
            in: ["ACTIVE", "MERGED", "DISABLED", "PENDING"]
          },
          searchKey
        },
        include: {
          category: true,
          mergedTo: {
            include: { category: true }
          }
        }
      });
      const active = existingRows.find(row => row.status === "ACTIVE") ?? null;
      const merged = existingRows.find(row => row.status === "MERGED") ?? null;
      const mergedTarget = merged?.mergedTo?.ownerId === null && merged.mergedTo.status === "ACTIVE"
        ? merged.mergedTo
        : null;
      if (!active && merged && !mergedTarget) {
        throw new ConflictException("归并食材目标无效，请先修复食材治理数据");
      }
      const existing = active
        ?? mergedTarget
        ?? existingRows.find(row => row.status === "PENDING")
        ?? existingRows.find(row => row.status === "DISABLED")
        ?? null;
      if (existing) {
        nextRows.push({
          ...item,
          ingredientId: existing.id,
          ingredientName: existing.name,
          categoryCode: existing.category.code
        });
        continue;
      }
      const category = item.categoryCode
        ? await tx.ingredientCategory.findFirst({
            where: { code: item.categoryCode, isSelectable: true }
          })
        : unclassifiedCategory;
      const targetCategory = category ?? unclassifiedCategory;
      if (!targetCategory.id) {
        throw new NotFoundException("食材分类不存在");
      }
      const unit = item.unitId ? await this.requireSystemUnit(tx, item.unitId) : null;
      const created = await tx.ingredient.create({
        data: {
          ownerId: null,
          status: "PENDING",
          categoryId: targetCategory.id,
          defaultUnitId: unit?.id ?? null,
          name: item.ingredientName,
          searchKey,
          systemSortOrder: await this.nextSystemIngredientSortOrder(tx, targetCategory.id),
          displaySortOrder: await this.nextSystemIngredientDisplaySortOrder(tx)
        }
      });
      nextRows.push({
        ...item,
        ingredientId: created.id,
        ingredientName: created.name,
        unitText: unit?.name ?? item.unitText,
        categoryCode: targetCategory.code
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
          imageUrl: stepImageUrls[index] ?? null,
          imagePrompt: item.imagePrompt?.trim() || null
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
    const current = await tx.recipeCookAssistant.findUnique({ where: { recipeVersionId } });
    const keepsPublishedSnapshot = Boolean(
      current?.status === "READY" && current.snapshotJson && current.generatedAt
    );

    try {
      const candidate = importedSteps.length > 0
        ? buildImportedRecipeAssistantSnapshot(importedSteps)
        : buildRecipeAssistantSnapshot(content);
      const canPublish = importedSteps.length > 0 && this.isRecipeAssistantCandidateReady(candidate);
      await tx.recipeCookAssistant.upsert({
        where: { recipeVersionId },
        update: {
          status: canPublish ? "READY" : keepsPublishedSnapshot ? "READY" : "NEEDS_REVIEW",
          candidateJson: canPublish || keepsPublishedSnapshot ? Prisma.DbNull : toJson(candidate),
          snapshotJson: canPublish ? toJson(candidate) : keepsPublishedSnapshot ? toJson(current!.snapshotJson) : Prisma.DbNull,
          generatedAt: canPublish ? attemptedAt : keepsPublishedSnapshot ? current!.generatedAt : null,
          lastAttemptAt: attemptedAt,
          attemptCount: { increment: 1 },
          lastError: null,
          source: importedSteps.length > 0 ? "OPS" : "AUTO"
        },
        create: {
          recipeVersionId,
          status: canPublish ? "READY" : "NEEDS_REVIEW",
          candidateJson: canPublish ? Prisma.DbNull : toJson(candidate),
          snapshotJson: canPublish ? toJson(candidate) : Prisma.DbNull,
          generatedAt: canPublish ? attemptedAt : null,
          lastAttemptAt: attemptedAt,
          attemptCount: 1,
          lastError: null,
          source: importedSteps.length > 0 ? "OPS" : "AUTO"
        }
      });
    } catch (error) {
      const lastError = normalizeRecipeAssistantError(error);
      await tx.recipeCookAssistant.upsert({
        where: { recipeVersionId },
        update: {
          status: keepsPublishedSnapshot ? "READY" : "FAILED",
          candidateJson: Prisma.DbNull,
          snapshotJson: keepsPublishedSnapshot ? toJson(current!.snapshotJson) : Prisma.DbNull,
          generatedAt: keepsPublishedSnapshot ? current!.generatedAt : null,
          lastAttemptAt: attemptedAt,
          attemptCount: { increment: 1 },
          lastError
        },
        create: {
          recipeVersionId,
          status: "FAILED",
          candidateJson: Prisma.DbNull,
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

  private isRecipeAssistantCandidateReady(candidate: ReturnType<typeof buildImportedRecipeAssistantSnapshot>) {
    return candidate.steps.length > 0 && candidate.steps.every(step => {
      return (
        ["PREP", "COOK", "SERVE"].includes(step.phase) &&
        Boolean(step.title.trim()) &&
        Boolean(step.detail.trim()) &&
        step.durationMinutes !== null &&
        Number.isInteger(step.durationMinutes) &&
        step.durationMinutes > 0
      );
    });
  }

  private async buildAdminRecipeImageState(
    request: { protocol?: string; get?: (name: string) => string | undefined },
    recipeId: UUID,
    contentVersionId: number,
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
      recipeId,
      contentVersionId,
      "COVER",
      { type: "COVER" },
      normalizeImageUrl(coverImageUrl),
      coverImageTempKey,
      allowedCoverImageUrls,
      "封面图",
      publishedStorageKeys,
      consumedTempKeys
    );

    const stepImageUrls: Array<string | null> = [];
    for (const [index, step] of content.steps.entries()) {
      const nextStepImageUrl = await this.resolveAdminRecipeImageUrl(
        request,
        recipeId,
        contentVersionId,
        "STEP",
        { type: "STEP", order: index + 1 },
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
    recipeId: UUID,
    contentVersionId: number,
    scene: "COVER" | "STEP",
    position: RecipeImagePosition,
    imageUrl: string | null,
    imageTempKey: string | null,
    allowedUrls: Set<string>,
    label: string,
    publishedStorageKeys: string[],
    consumedTempKeys: Set<string>
  ) {
    const normalizedTempKey = imageTempKey?.trim() || null;
    if (normalizedTempKey) {
      const published = await this.adminRecipeImageService.publishTempImage(request, recipeId, contentVersionId, scene, normalizedTempKey, position);
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

  private async reserveRecipeId(tx: Prisma.TransactionClient | PrismaService = this.prisma): Promise<UUID> {
    const rows = await tx.$queryRaw<Array<{ id: bigint | number }>>`SELECT nextval(pg_get_serial_sequence('recipes', 'id')) AS id`;
    const recipeId = Number(rows[0]?.id);
    if (!Number.isSafeInteger(recipeId) || recipeId <= 0) {
      throw new ConflictException("无法创建菜谱，请稍后重试");
    }
    return recipeId;
  }

  private async reserveRecipeContentVersionId(tx: Prisma.TransactionClient | PrismaService = this.prisma): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ id: bigint | number }>>`SELECT nextval(pg_get_serial_sequence('recipe_content_versions', 'id')) AS id`;
    const contentVersionId = Number(rows[0]?.id);
    if (!Number.isSafeInteger(contentVersionId) || contentVersionId <= 0) {
      throw new ConflictException("无法创建菜谱内容版本，请稍后重试");
    }
    return contentVersionId;
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

  private async requireSystemIngredient(tx: Prisma.TransactionClient, ingredientId: UUID, includeDisabled = false, includePending = false) {
    const statuses: IngredientStatus[] = includePending
      ? ["ACTIVE", "DISABLED", "PENDING"]
      : includeDisabled
        ? ["ACTIVE", "DISABLED"]
        : ["ACTIVE"];
    const ingredient = await tx.ingredient.findFirst({
      where: {
        id: ingredientId,
        ownerId: null,
        status: { in: statuses }
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
    await this.assertSystemIngredientTermsAvailable(tx, [searchKey], ingredientId ? [ingredientId] : []);
  }

  private async assertSystemIngredientTermsAvailable(
    tx: Prisma.TransactionClient,
    terms: string[],
    excludedIngredientIds: UUID[]
  ) {
    const searchKeys = Array.from(new Set(terms.map(item => buildSearchKey(item)).filter(Boolean)));
    if (!searchKeys.length) return;
    const existing = await tx.ingredient.findMany({
      where: {
        ownerId: null,
        status: { in: ["ACTIVE", "DISABLED", "MERGED"] },
        ...(excludedIngredientIds.length ? { NOT: { id: { in: excludedIngredientIds } } } : {})
      },
      select: { id: true, name: true, searchKey: true, aliases: true }
    });
    const normalizedTerms = new Set(searchKeys);
    const hasConflict = existing.some(ingredient =>
      [ingredient.name, ingredient.searchKey, ...ingredient.aliases].some(term => normalizedTerms.has(buildSearchKey(term)))
    );
    if (hasConflict) throw new ConflictException("系统食材名称已存在");
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
        SELECT "recipe_version_id" AS "version_id"
        FROM "dining_event_participant_bring_recipes"
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
        SELECT "recipe_version_id" AS "version_id"
        FROM "dining_event_participant_bring_recipes"
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
          publicContentPoolMember: { select: { userId: true } },
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
