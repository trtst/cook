import { requestData, uploadForm, type IsoDateTime, type PageQuery, type PageResult, type OperationId, type UUID } from "./http";

export interface AdminRecipeSummary {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  version: number;
  inspirationCategoryId: UUID;
  inspirationCategoryName: string;
  updatedAt: IsoDateTime;
  ownerUid: number | null;
}

export interface RecipeReportSummary {
  id: UUID;
  recipeId: UUID;
  reporterUid: number;
  reason: string;
  status: "OPEN" | "RESOLVED";
  createdAt: IsoDateTime;
}

export interface AdminInspirationCategorySummary {
  id: UUID;
  name: string;
  iconKey: string | null;
  version: number;
  recipeCount: number;
  updatedAt: IsoDateTime;
}

export interface RecipeIngredientInputAmount {
  kind: "EXACT" | "FUZZY";
  quantity?: string;
  unitId?: UUID;
  text?: "适量" | "少许" | "按需";
}

export interface RecipeIngredientInput {
  ingredientId: UUID;
  amount: RecipeIngredientInputAmount;
}

export interface AdminRecipeContentInput {
  name: string;
  story: string | null;
  baseServings: number;
  difficulty: "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING";
  duration: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60";
  estimatedCalories: number | null;
  tips: string | null;
  keywords: string[];
  tools?: Array<{ name: string }>;
  ingredients: RecipeIngredientInput[];
  steps: Array<{
    text: string;
    imageUrl: string | null;
    imageTempKey: string | null;
  }>;
}

export interface AdminRecipeImageUploadResult {
  image: {
    tempKey: string;
    scene: "COVER" | "STEP";
    contentType: string;
    sizeBytes: number;
    width: number;
    height: number;
  };
}

export interface AdminRecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  ownerUid: number | null;
  personalCategory: { id: UUID; name: string; version: number } | null;
  inspirationCategory: AdminInspirationCategorySummary | null;
  difficultyText: string | null;
  durationText: string | null;
  contentVersionId: UUID;
  assistantState: {
    status: "MISSING" | "READY" | "FAILED";
    hasSnapshot: boolean;
    generatedAt: IsoDateTime | null;
    lastAttemptAt: IsoDateTime | null;
    attemptCount: number;
    lastError: string | null;
  };
  assistant: {
    generatedAt: IsoDateTime;
    summary: {
      stepCount: number;
      prepStepCount: number;
      cookStepCount: number;
      serveStepCount: number;
      totalDurationText: string | null;
    };
    steps: Array<{
      order: number;
      phase: "PREP" | "COOK" | "SERVE";
      action?: string;
      title: string;
      detail: string;
      imageUrl: string | null;
      durationMinutes: number | null;
      durationText: string | null;
    }>;
  } | null;
  wiki: {
    tags: Array<{
      tagCode: string;
      tagValue: string;
      displayValue: string;
      source: "AUTO" | "USER" | "OPS" | "AI";
      status: "CONFIRMED" | "CANDIDATE" | "UNMAPPED" | "NEEDS_REVIEW";
      confidence: number | null;
      sortOrder: number | null;
      isLocked: boolean;
    }>;
    nutrition: {
      status: "COMPLETE" | "ESTIMATED" | "INSUFFICIENT" | "NONE";
      qualityLabel: "估算较完整" | "结果为估算" | "当前数据不足" | null;
      perServing: { calories: number | null; protein: number | null; fat: number | null; carbohydrate: number | null } | null;
      perRecipe: { calories: number | null; protein: number | null; fat: number | null; carbohydrate: number | null } | null;
      calculatedAt: IsoDateTime | null;
      sourceVersion: string | null;
      coverageRate: number | null;
    };
    qualityCards: Array<{
      code: "CONTENT" | "STRUCTURED_DATA" | "BUSINESS_TAGS" | "NUTRITION" | "ASSISTANT" | "FRONTEND_CONSUMPTION" | "RANDOM_MENU";
      title: string;
      status: "COMPLETE" | "INCOMPLETE";
      score: number;
      blockingReasons: string[];
    }>;
  };
  content: {
    name: string;
    story: string | null;
    baseServings: number;
    difficulty: "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING" | null;
    duration: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" | null;
    estimatedCalories: number | null;
    tips: string | null;
    keywords: string[];
    tools: Array<{ name: string }>;
    ingredients: Array<{
      ingredientId: UUID;
      ingredientName: string;
      source: "SYSTEM" | "PERSONAL";
      categoryId: UUID;
      amount:
        | {
            kind: "EXACT";
            quantity: string;
            unitId: UUID;
            unitName: string;
            unitType: "WEIGHT" | "VOLUME" | "COMMON" | "PACKAGE";
          }
        | {
            kind: "FUZZY";
            text: "适量" | "少许" | "按需";
          };
    }>;
    steps: Array<{ text: string; imageUrl: string | null }>;
  };
  version: number;
  reportCount: number;
  blockedReason: string | null;
  collectCount: number;
  canEdit: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminRecipeQuery extends PageQuery {
  keyword?: string;
  categoryId?: UUID;
  status?: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
}

export interface AdminRecipeReportQuery extends PageQuery {
  status?: "OPEN" | "RESOLVED";
}

export interface UpdateAdminRecipePayload {
  operationId: OperationId;
  expectedVersion: number;
  inspirationCategoryId: UUID;
  coverImageUrl: string | null;
  coverImageTempKey: string | null;
  content: AdminRecipeContentInput;
}

export interface CreateAdminRecipePayload {
  operationId: OperationId;
  inspirationCategoryId: UUID;
  coverImageUrl: string | null;
  coverImageTempKey: string | null;
  content: AdminRecipeContentInput;
}

export interface InspirationCategoryPayload {
  operationId: OperationId;
  name: string;
}

export interface UpdateInspirationCategoryPayload extends InspirationCategoryPayload {
  expectedVersion: number;
}

export interface DeleteInspirationCategoryPayload {
  operationId: OperationId;
  expectedVersion: number;
}

export interface ReorderItem {
  id: UUID;
  expectedVersion: number;
}

export interface AdminPendingRecipeSummary {
  id: UUID;
  recipeId: UUID;
  recipeTitle: string;
  contentVersionId: UUID;
  version: number;
  status: "PENDING";
  suggestedCategory: AdminInspirationCategorySummary;
  personalCategory: { id: UUID; name: string; version: number } | null;
  user: {
    id: UUID;
    uid: number;
    nickname: string | null;
  };
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminPendingRecipeQuery extends PageQuery {
  keyword?: string;
}

export interface AdminReviewPendingRecipePayload {
  operationId: OperationId;
  action: "APPROVE" | "REJECT";
  expectedVersion: number;
  inspirationCategoryId?: UUID;
  reason?: string;
}

export interface AdminReviewPendingRecipeResult {
  id: UUID;
  status: "APPROVED" | "REJECTED";
  reviewedAt: IsoDateTime;
  targetRecipeId: UUID | null;
}

export interface RecipeImportIssue {
  field: string | null;
  message: string;
}

export interface RecipeImportImageSummary {
  key: string;
  alt: string | null;
  fileName: string;
  width: number | null;
  height: number | null;
}

export interface RecipeImportRawBody {
  sourcePath: string;
  jsonText: string;
  assetFolder: string;
  images: RecipeImportImageSummary[];
}

export interface RecipeImportParsedBody {
  titleLine: string | null;
  story: string | null;
  baseServingsText: string | null;
  difficultyText: string | null;
  durationText: string | null;
  caloriesText: string | null;
  ingredientLines: string[];
  stepLines: string[];
  tipLines: string[];
}

export interface RecipeImportIngredientDraft {
  line: string;
  ingredientName: string;
  ingredientId: UUID | null;
  quantity: string | null;
  unitText: string | null;
  unitId: UUID | null;
  fuzzyText: "适量" | "少许" | "按需" | null;
  note: string | null;
}

export interface RecipeImportStepDraft {
  text: string;
  imageUrl?: string | null;
  imageKey: string | null;
  imageTempKey: string | null;
}

export interface RecipeImportToolDraft {
  name: string;
}

export type RecipeImportTagCode = "CUISINE" | "DISH_STYLE" | "MEAL_TYPE" | "DISH_ROLE" | "MAIN_PROTEIN_TYPE" | "FLAVOR_PROFILE" | "SPICE_LEVEL";

export interface RecipeImportTagDraft {
  tagCode: RecipeImportTagCode;
  tagValue: string;
}

export type RecipeImportAssistantPhase = "PREP" | "COOK" | "SERVE";
export type RecipeImportAssistantAction =
  | "SHOP" | "WASH" | "SOAK" | "THAW" | "CUT" | "SLICE" | "DICE" | "SHRED" | "MINCE"
  | "MARINATE" | "BLANCH" | "MEASURE" | "MIX" | "BOIL" | "SIMMER" | "STEAM" | "STIR_FRY"
  | "PAN_FRY" | "DEEP_FRY" | "BRAISE" | "ROAST" | "BAKE" | "PRESSURE_COOK" | "REDUCE"
  | "SEASON" | "PLATE" | "GARNISH" | "PORTION" | "REST" | "OTHER";

export interface RecipeImportAssistantStepDraft {
  order: number;
  phase: RecipeImportAssistantPhase;
  action: RecipeImportAssistantAction;
  title: string;
  detail: string;
  imageUrl: string | null;
  durationMinutes: number | null;
  durationText: string | null;
}

export interface RecipeImportRecipeBody {
  inspirationCategoryId: UUID | null;
  title: string;
  story: string | null;
  baseServings: number | null;
  difficulty: "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING" | null;
  duration: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" | null;
  tips: string | null;
  keywords: string[];
  coverImageUrl?: string | null;
  coverImageKey: string | null;
  coverImageTempKey: string | null;
  tools: RecipeImportToolDraft[];
  tags: RecipeImportTagDraft[];
  assistantSteps: RecipeImportAssistantStepDraft[];
  ingredients: RecipeImportIngredientDraft[];
  steps: RecipeImportStepDraft[];
}

export interface RecipeImportJobSummary {
  id: UUID;
  sourceType: "JSON";
  sourceName: string;
  status: "PENDING" | "RUNNING" | "READY" | "FAILED" | "COMPLETED";
  totalCount: number;
  readyCount: number;
  needsFixCount: number;
  failedCount: number;
  createdByAdminId: UUID;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RecipeImportItemSummary {
  id: UUID;
  jobId: UUID;
  sourcePath: string;
  title: string | null;
  status: "PENDING_PARSE" | "NEEDS_FIX" | "READY" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  errorCount: number;
  warnCount: number;
  recipeId: UUID | null;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RecipeImportJobDetail extends RecipeImportJobSummary {
  items: PageResult<RecipeImportItemSummary>;
}

export interface RecipeImportItemDetail {
  id: UUID;
  jobId: UUID;
  sourcePath: string;
  title: string | null;
  status: "PENDING_PARSE" | "NEEDS_FIX" | "READY" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  rawBody: RecipeImportRawBody;
  parsedBody: RecipeImportParsedBody;
  recipeBody: RecipeImportRecipeBody;
  errorItems: RecipeImportIssue[];
  warnItems: RecipeImportIssue[];
  sourceImages: Array<RecipeImportImageSummary & { dataUrl: string; canUseAsCover: boolean }>;
  recipeId: UUID | null;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RecipeImportJobQuery extends PageQuery {
  status?: RecipeImportJobSummary["status"];
}

export interface RecipeImportItemQuery extends PageQuery {
  status?: RecipeImportItemSummary["status"];
}

export interface CreateRecipeImportJobPayload {
  operationId: OperationId;
  files: File[];
}

export interface UpdateRecipeImportItemPayload {
  operationId: OperationId;
  expectedVersion: number;
  recipeBody: RecipeImportRecipeBody;
}

export interface PublishRecipeImportItemPayload {
  operationId: OperationId;
  expectedVersion: number;
}

export const recipeApi = {
  list(query: AdminRecipeQuery) {
    return requestData<PageResult<AdminRecipeSummary>>("/admin/recipes", {
      query: { ...query }
    });
  },
  listPending(query: AdminPendingRecipeQuery) {
    return requestData<PageResult<AdminPendingRecipeSummary>>("/admin/pending-recipes", {
      query: { ...query }
    });
  },
  uploadImage(scene: "COVER" | "STEP", file: File, operationId: OperationId) {
    const formData = new FormData();
    formData.append("scene", scene);
    formData.append("file", file);
    return uploadForm<AdminRecipeImageUploadResult>("/admin/recipe-images", formData, {
      idempotencyKey: operationId
    });
  },
  create(body: CreateAdminRecipePayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminRecipeDetail>("/admin/recipes", {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  getDetail(recipeId: UUID) {
    return requestData<AdminRecipeDetail>(`/admin/recipes/${encodeURIComponent(String(recipeId))}`);
  },
  update(recipeId: UUID, body: UpdateAdminRecipePayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminRecipeDetail>(`/admin/recipes/${encodeURIComponent(String(recipeId))}`, {
      method: "PUT",
      body: payload,
      idempotencyKey: operationId
    });
  },
  regenerateAssistant(recipeId: UUID, operationId: OperationId) {
    return requestData<AdminRecipeDetail>(`/admin/recipes/${encodeURIComponent(String(recipeId))}/assistant/regenerate`, {
      method: "POST",
      idempotencyKey: operationId
    });
  },
  reviewPending(recommendationId: UUID, body: AdminReviewPendingRecipePayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminReviewPendingRecipeResult>(`/admin/pending-recipes/${encodeURIComponent(String(recommendationId))}/review`, {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  createImportJob(body: CreateRecipeImportJobPayload) {
    const formData = new FormData();
    body.files.forEach(file => formData.append("files", file));
    return uploadForm<RecipeImportJobSummary>("/admin/recipe-import-jobs/json", formData, {
      idempotencyKey: body.operationId
    });
  },
  listImportJobs(query: RecipeImportJobQuery) {
    return requestData<PageResult<RecipeImportJobSummary>>("/admin/recipe-import-jobs", {
      query: { ...query }
    });
  },
  getImportJobDetail(jobId: UUID, query: RecipeImportItemQuery) {
    return requestData<RecipeImportJobDetail>(`/admin/recipe-import-jobs/${encodeURIComponent(String(jobId))}`, {
      query: { ...query }
    });
  },
  deleteImportJob(jobId: UUID, operationId: OperationId) {
    return requestData<{ jobId: UUID; deletedAt: IsoDateTime }>(`/admin/recipe-import-jobs/${encodeURIComponent(String(jobId))}`, {
      method: "DELETE",
      idempotencyKey: operationId
    });
  },
  getImportItemDetail(itemId: UUID) {
    return requestData<RecipeImportItemDetail>(`/admin/recipe-import-items/${encodeURIComponent(String(itemId))}`);
  },
  updateImportItem(itemId: UUID, body: UpdateRecipeImportItemPayload) {
    const { operationId, ...payload } = body;
    return requestData<RecipeImportItemDetail>(`/admin/recipe-import-items/${encodeURIComponent(String(itemId))}`, {
      method: "PUT",
      body: payload,
      idempotencyKey: operationId
    });
  },
  publishImportItem(itemId: UUID, body: PublishRecipeImportItemPayload) {
    const { operationId, ...payload } = body;
    return requestData<RecipeImportItemDetail>(`/admin/recipe-import-items/${encodeURIComponent(String(itemId))}/publish`, {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  listReports(query: AdminRecipeReportQuery) {
    return requestData<PageResult<RecipeReportSummary>>("/admin/recipe-reports", {
      query: { ...query }
    });
  },
  listInspirationCategories(keyword?: string) {
    return requestData<AdminInspirationCategorySummary[]>("/admin/inspiration-categories", {
      query: { keyword }
    });
  },
  createInspirationCategory(body: InspirationCategoryPayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminInspirationCategorySummary>("/admin/inspiration-categories", {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  updateInspirationCategory(categoryId: UUID, body: UpdateInspirationCategoryPayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminInspirationCategorySummary>(`/admin/inspiration-categories/${encodeURIComponent(String(categoryId))}`, {
      method: "PUT",
      body: payload,
      idempotencyKey: operationId
    });
  },
  deleteInspirationCategory(categoryId: UUID, body: DeleteInspirationCategoryPayload) {
    return requestData<{ categoryId: UUID; deletedAt: IsoDateTime }>(`/admin/inspiration-categories/${encodeURIComponent(String(categoryId))}`, {
      method: "DELETE",
      body: { expectedVersion: body.expectedVersion },
      idempotencyKey: body.operationId
    });
  },
  reorderInspirationCategories(operationId: OperationId, items: ReorderItem[]) {
    return requestData<AdminInspirationCategorySummary[]>("/admin/inspiration-categories/reorder", {
      method: "POST",
      body: { items },
      idempotencyKey: operationId
    });
  },
  block(recipeId: UUID, operationId: OperationId, reason: string) {
    return requestData<AdminRecipeSummary>(`/admin/recipes/${encodeURIComponent(String(recipeId))}/block`, {
      method: "POST",
      body: { reason },
      idempotencyKey: operationId
    });
  },
  unblock(recipeId: UUID, operationId: OperationId) {
    return requestData<AdminRecipeSummary>(`/admin/recipes/${encodeURIComponent(String(recipeId))}/unblock`, {
      method: "POST",
      idempotencyKey: operationId
    });
  },
  deleteBlocked(recipeId: UUID, body: { operationId: OperationId; expectedVersion: number }) {
    return requestData<{ recipeId: UUID; deletedAt: IsoDateTime }>(`/admin/recipes/${encodeURIComponent(String(recipeId))}`, {
      method: "DELETE",
      body: { expectedVersion: body.expectedVersion },
      idempotencyKey: body.operationId
    });
  },
  resolveReport(reportId: UUID, operationId: OperationId, resolutionNote?: string | null) {
    return requestData<RecipeReportSummary>(`/admin/recipe-reports/${encodeURIComponent(String(reportId))}/resolve`, {
      method: "POST",
      body: { resolutionNote },
      idempotencyKey: operationId
    });
  }
};
