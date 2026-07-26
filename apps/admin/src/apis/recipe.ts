import { requestData, type IsoDateTime, type PageQuery, type PageResult, type UUID } from "./http";

export interface AdminRecipeSummary {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  updatedAt: IsoDateTime;
  ownerUid: number | null;
  reportCount: number;
  blockedReason: string | null;
}

export interface RecipeReportSummary {
  id: UUID;
  recipeId: UUID;
  reporterUid: number;
  reason: string;
  status: "OPEN" | "RESOLVED";
  createdAt: IsoDateTime;
}

export interface AdminRecipeQuery extends PageQuery {
  keyword?: string;
  status?: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  reportsOnly?: boolean;
}

export interface AdminRecipeReportQuery extends PageQuery {
  status?: "OPEN" | "RESOLVED";
}

export const recipeApi = {
  list(query: AdminRecipeQuery) {
    return requestData<PageResult<AdminRecipeSummary>>("/admin/recipes", {
      query: { ...query }
    });
  },
  listReports(query: AdminRecipeReportQuery) {
    return requestData<PageResult<RecipeReportSummary>>("/admin/recipe-reports", {
      query: { ...query }
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
