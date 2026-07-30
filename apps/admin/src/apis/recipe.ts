import { requestData, type IsoDateTime, type PageQuery, type PageResult, type OperationId, type UUID } from "./http";

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
  tips: string | null;
  ingredients: RecipeIngredientInput[];
  steps: Array<{ text: string }>;
}

export interface AdminRecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  ownerUid: number | null;
  personalCategory: { id: UUID; name: string; version: number } | null;
  inspirationCategory: AdminInspirationCategorySummary | null;
  contentVersionId: UUID;
  content: {
    name: string;
    story: string | null;
    baseServings: number;
    difficulty: "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING" | null;
    duration: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" | null;
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
    steps: Array<{ text: string }>;
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
  content: AdminRecipeContentInput;
}

export interface CreateAdminRecipePayload {
  operationId: OperationId;
  inspirationCategoryId: UUID;
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
