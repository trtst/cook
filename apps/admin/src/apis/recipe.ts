import { requestData, uploadForm, type IsoDateTime, type PageQuery, type PageResult, type OperationId, type UUID } from "./http";

export interface AdminRecipeSummary {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
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
  content: {
    name: string;
    story: string | null;
    baseServings: number;
    difficulty: "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING" | null;
    duration: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" | null;
    estimatedCalories: number | null;
    tips: string | null;
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
            unitType: "WEIGHT" | "VOLUME" | "COUNT" | "SHAPE" | "CONTAINER" | "PACKAGE" | "OTHER";
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
  likeCount: number;
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
  markdown: string;
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
  imageKey: string | null;
  imageTempKey: string | null;
}

export interface RecipeImportRecipeBody {
  inspirationCategoryId: UUID | null;
  title: string;
  story: string | null;
  baseServings: number | null;
  difficulty: "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING" | null;
  duration: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" | null;
  estimatedCalories: number | null;
  tips: string | null;
  coverImageKey: string | null;
  coverImageTempKey: string | null;
  ingredients: RecipeImportIngredientDraft[];
  steps: RecipeImportStepDraft[];
}

export interface RecipeImportJobSummary {
  id: UUID;
  sourceType: "MARKDOWN" | "EXCEL";
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
  inspirationCategoryId?: UUID | null;
  file: File;
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
    formData.append("file", body.file);
    if (body.inspirationCategoryId !== undefined && body.inspirationCategoryId !== null) {
      formData.append("inspirationCategoryId", String(body.inspirationCategoryId));
    }
    return uploadForm<RecipeImportJobSummary>("/admin/recipe-import-jobs/markdown", formData, {
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
  resolveReport(reportId: UUID, operationId: OperationId, resolutionNote?: string | null) {
    return requestData<RecipeReportSummary>(`/admin/recipe-reports/${encodeURIComponent(String(reportId))}/resolve`, {
      method: "POST",
      body: { resolutionNote },
      idempotencyKey: operationId
    });
  }
};
