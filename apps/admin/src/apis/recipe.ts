import { requestData, type IsoDateTime, type PageQuery, type PageResult, type UUID } from "./http";

export interface AdminRecipeSummary {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
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
  status?: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
}

export interface AdminRecipeReportQuery extends PageQuery {
  status?: "OPEN" | "RESOLVED";
}

export interface UpdateAdminRecipePayload {
  operationId: UUID;
  expectedVersion: number;
  inspirationCategoryId: UUID;
  content: AdminRecipeContentInput;
}

export const recipeApi = {
  list(query: AdminRecipeQuery) {
    return requestData<PageResult<AdminRecipeSummary>>("/admin/recipes", {
      query: { ...query }
    });
  },
  getDetail(recipeId: UUID) {
    return requestData<AdminRecipeDetail>(`/admin/recipes/${encodeURIComponent(recipeId)}`);
  },
  update(recipeId: UUID, body: UpdateAdminRecipePayload) {
    return requestData<AdminRecipeDetail>(`/admin/recipes/${encodeURIComponent(recipeId)}`, {
      method: "PUT",
      body
    });
  },
  listReports(query: AdminRecipeReportQuery) {
    return requestData<PageResult<RecipeReportSummary>>("/admin/recipe-reports", {
      query: { ...query }
    });
  },
  listInspirationCategories() {
    return requestData<AdminInspirationCategorySummary[]>("/inspiration-categories", {
      auth: false
    });
  },
  block(recipeId: UUID, operationId: UUID, reason: string) {
    return requestData<AdminRecipeSummary>(`/admin/recipes/${encodeURIComponent(recipeId)}/block`, {
      method: "POST",
      body: { operationId, reason }
    });
  },
  unblock(recipeId: UUID, operationId: UUID) {
    return requestData<AdminRecipeSummary>(`/admin/recipes/${encodeURIComponent(recipeId)}/unblock`, {
      method: "POST",
      body: { operationId }
    });
  },
  resolveReport(reportId: UUID, operationId: UUID, resolutionNote?: string | null) {
    return requestData<RecipeReportSummary>(`/admin/recipe-reports/${encodeURIComponent(reportId)}/resolve`, {
      method: "POST",
      body: { operationId, resolutionNote }
    });
  }
};
