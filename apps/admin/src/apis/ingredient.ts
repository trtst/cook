import { requestData, uploadForm, type IsoDateTime, type PageResult, type UUID } from "./http";

export interface UnitSummary {
  id: UUID;
  name: string;
  type: "WEIGHT" | "VOLUME" | "COUNT" | "SHAPE" | "CONTAINER" | "PACKAGE" | "OTHER";
  source: "SYSTEM" | "PERSONAL";
}

export interface AdminUnitSummary {
  id: UUID;
  name: string;
  type: "WEIGHT" | "VOLUME" | "COUNT" | "SHAPE" | "CONTAINER" | "PACKAGE" | "OTHER";
  source: "SYSTEM";
  version: number;
  updatedAt: IsoDateTime;
}

export interface AdminIngredientCategorySummary {
  id: UUID;
  name: string;
  version: number;
  ingredientCount: number;
  updatedAt: IsoDateTime;
}

export interface AdminIngredientSummary {
  id: UUID;
  name: string;
  version: number;
  status: "ACTIVE" | "DISABLED";
  categoryId: UUID;
  categoryName: string;
  defaultUnit: UnitSummary;
  imageUrl: string | null;
  updatedAt: IsoDateTime;
}

export type AdminIngredientReviewStatus = "PENDING";

export type AdminIngredientReviewAction = "APPROVE_CREATE" | "APPROVE_MERGE" | "REJECT";

export interface AdminIngredientSuggestionUser {
  id: UUID;
  uid: number;
  nickname: string | null;
}

export interface AdminPendingIngredientSummary {
  id: UUID;
  name: string;
  version: number;
  categoryId: UUID | null;
  categoryName: string | null;
  defaultUnitId: UUID | null;
  defaultUnitName: string | null;
  status: AdminIngredientReviewStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  user: AdminIngredientSuggestionUser;
}

export interface AdminReviewPendingIngredientPayload {
  operationId: UUID;
  action: AdminIngredientReviewAction;
  expectedVersion: number;
  name?: string;
  categoryId?: UUID;
  defaultUnitId?: UUID;
  targetIngredientId?: UUID;
  reason?: string;
}

export interface AdminReviewPendingIngredientResult {
  id: UUID;
  status: "APPROVED" | "REJECTED";
  reviewedAt: IsoDateTime;
  targetIngredientId: UUID | null;
}

export interface IngredientCategoryPayload {
  operationId: UUID;
  name: string;
}

export interface UpdateIngredientCategoryPayload extends IngredientCategoryPayload {
  expectedVersion: number;
}

export interface IngredientPayload {
  operationId: UUID;
  name: string;
  categoryId: UUID;
  defaultUnitId: UUID;
}

export interface UpdateIngredientPayload extends IngredientPayload {
  expectedVersion: number;
}

export interface UnitPayload {
  operationId: UUID;
  name: string;
  type: AdminUnitSummary["type"];
}

export interface UpdateUnitPayload extends UnitPayload {
  expectedVersion: number;
}

export interface DeleteUnitPayload {
  operationId: UUID;
  expectedVersion: number;
}

export interface UpdateIngredientStatusPayload {
  operationId: UUID;
  expectedVersion: number;
  status: "ACTIVE" | "DISABLED";
}

export interface ReorderItem {
  id: UUID;
  expectedVersion: number;
}

export interface AdminIngredientListQuery {
  page: number;
  pageSize: number;
  categoryId?: UUID;
  keyword?: string;
  status?: "ACTIVE" | "DISABLED" | "ALL";
}

export interface AdminPendingIngredientListQuery {
  page: number;
  pageSize: number;
  keyword?: string;
}

export const ingredientApi = {
  listCategories(keyword?: string) {
    return requestData<AdminIngredientCategorySummary[]>("/admin/ingredient-categories", {
      query: { keyword }
    });
  },
  createCategory(body: IngredientCategoryPayload) {
    return requestData<AdminIngredientCategorySummary>("/admin/ingredient-categories", {
      method: "POST",
      body
    });
  },
  updateCategory(categoryId: UUID, body: UpdateIngredientCategoryPayload) {
    return requestData<AdminIngredientCategorySummary>(`/admin/ingredient-categories/${encodeURIComponent(categoryId)}`, {
      method: "PUT",
      body
    });
  },
  reorderCategories(operationId: UUID, items: ReorderItem[]) {
    return requestData<AdminIngredientCategorySummary[]>("/admin/ingredient-categories/reorder", {
      method: "POST",
      body: { operationId, items }
    });
  },
  listUnits() {
    return requestData<AdminUnitSummary[]>("/admin/units");
  },
  createUnit(body: UnitPayload) {
    return requestData<AdminUnitSummary>("/admin/units", {
      method: "POST",
      body
    });
  },
  updateUnit(unitId: UUID, body: UpdateUnitPayload) {
    return requestData<AdminUnitSummary>(`/admin/units/${encodeURIComponent(unitId)}`, {
      method: "PUT",
      body
    });
  },
  deleteUnit(unitId: UUID, body: DeleteUnitPayload) {
    return requestData<{ unitId: UUID; deletedAt: IsoDateTime }>(`/admin/units/${encodeURIComponent(unitId)}`, {
      method: "DELETE",
      body
    });
  },
  reorderUnits(type: AdminUnitSummary["type"], operationId: UUID, items: ReorderItem[]) {
    return requestData<AdminUnitSummary[]>("/admin/units/reorder", {
      method: "POST",
      body: {
        type,
        operationId,
        items
      }
    });
  },
  listIngredients(query: AdminIngredientListQuery) {
    return requestData<PageResult<AdminIngredientSummary>>("/admin/ingredients", {
      query: {
        page: query.page,
        pageSize: query.pageSize,
        categoryId: query?.categoryId,
        keyword: query?.keyword,
        status: query?.status
      }
    });
  },
  createIngredient(body: IngredientPayload) {
    return requestData<AdminIngredientSummary>("/admin/ingredients", {
      method: "POST",
      body
    });
  },
  updateIngredient(ingredientId: UUID, body: UpdateIngredientPayload) {
    return requestData<AdminIngredientSummary>(`/admin/ingredients/${encodeURIComponent(ingredientId)}`, {
      method: "PUT",
      body
    });
  },
  setIngredientStatus(ingredientId: UUID, body: UpdateIngredientStatusPayload) {
    return requestData<AdminIngredientSummary>(`/admin/ingredients/${encodeURIComponent(ingredientId)}/status`, {
      method: "POST",
      body
    });
  },
  uploadIngredientImage(ingredientId: UUID, file: File, operationId: UUID, expectedVersion: number) {
    const formData = new FormData();
    formData.append("operationId", operationId);
    formData.append("expectedVersion", String(expectedVersion));
    formData.append("file", file);
    return uploadForm<AdminIngredientSummary>(`/admin/ingredients/${encodeURIComponent(ingredientId)}/image`, formData);
  },
  clearIngredientImage(ingredientId: UUID, operationId: UUID, expectedVersion: number) {
    return requestData<AdminIngredientSummary>(`/admin/ingredients/${encodeURIComponent(ingredientId)}/image`, {
      method: "DELETE",
      body: {
        operationId,
        expectedVersion
      }
    });
  },
  reorderIngredients(categoryId: UUID, operationId: UUID, items: ReorderItem[]) {
    return requestData<AdminIngredientSummary[]>("/admin/ingredients/reorder", {
      method: "POST",
      body: {
        categoryId,
        operationId,
        items
      }
    });
  },
  listPendingIngredients(query: AdminPendingIngredientListQuery) {
    return requestData<PageResult<AdminPendingIngredientSummary>>("/admin/pending-ingredients", {
      query: {
        page: query.page,
        pageSize: query.pageSize,
        keyword: query?.keyword
      }
    });
  },
  reviewPendingIngredient(ingredientId: UUID, body: AdminReviewPendingIngredientPayload) {
    return requestData<AdminReviewPendingIngredientResult>(`/admin/pending-ingredients/${encodeURIComponent(ingredientId)}/review`, {
      method: "POST",
      body
    });
  }
};
