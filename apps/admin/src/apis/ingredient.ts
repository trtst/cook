import { requestData, uploadForm, type IsoDateTime, type PageResult, type OperationId, type UUID } from "./http";

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
  code: string;
  name: string;
  isSelectable: boolean;
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
export type AdminIngredientRejectReasonCode =
  | "NAME_NOT_CLEAR"
  | "NAME_HAS_BRAND"
  | "CATEGORY_NOT_FIT"
  | "UNIT_NOT_FIT"
  | "OUT_OF_SCOPE"
  | "OTHER";

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

export interface AdminPendingIngredientFeedbackSummary {
  id: UUID;
  ingredientId: UUID;
  ingredientVersion: number;
  ingredientName: string;
  categoryId: UUID;
  categoryName: string;
  suggestedName: string;
  suggestedCategoryId: UUID;
  suggestedCategoryName: string;
  note: string | null;
  status: "PENDING";
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  user: AdminIngredientSuggestionUser;
}

export interface AdminReviewPendingIngredientPayload {
  operationId: OperationId;
  action: AdminIngredientReviewAction;
  expectedVersion: number;
  name?: string;
  categoryId?: UUID;
  defaultUnitId?: UUID;
  targetIngredientId?: UUID;
  rejectReasonCode?: AdminIngredientRejectReasonCode;
  reason?: string;
}

export interface AdminReviewPendingIngredientResult {
  id: UUID;
  status: "APPROVED" | "REJECTED";
  reviewedAt: IsoDateTime;
  targetIngredientId: UUID | null;
}

export interface AdminReviewIngredientFeedbackPayload {
  operationId: OperationId;
  action: "APPROVE" | "REJECT";
  expectedVersion: number;
  name?: string;
  categoryId?: UUID;
  reason?: string;
}

export interface AdminReviewIngredientFeedbackResult {
  id: UUID;
  ingredientId: UUID;
  status: "APPROVED" | "REJECTED";
  reviewedAt: IsoDateTime;
}

export interface IngredientCategoryPayload {
  operationId: OperationId;
  name: string;
}

export interface UpdateIngredientCategoryPayload extends IngredientCategoryPayload {
  expectedVersion: number;
}

export interface IngredientPayload {
  operationId: OperationId;
  name: string;
  categoryId: UUID;
  defaultUnitId: UUID;
}

export interface UpdateIngredientPayload extends IngredientPayload {
  expectedVersion: number;
}

export interface UnitPayload {
  operationId: OperationId;
  name: string;
  type: AdminUnitSummary["type"];
}

export interface UpdateUnitPayload extends UnitPayload {
  expectedVersion: number;
}

export interface DeleteUnitPayload {
  operationId: OperationId;
  expectedVersion: number;
}

export interface UpdateIngredientStatusPayload {
  operationId: OperationId;
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

export interface AdminIngredientFeedbackListQuery {
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
    const { operationId, ...payload } = body;
    return requestData<AdminIngredientCategorySummary>("/admin/ingredient-categories", {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  updateCategory(categoryId: UUID, body: UpdateIngredientCategoryPayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminIngredientCategorySummary>(`/admin/ingredient-categories/${encodeURIComponent(String(categoryId))}`, {
      method: "PUT",
      body: payload,
      idempotencyKey: operationId
    });
  },
  reorderCategories(operationId: OperationId, items: ReorderItem[]) {
    return requestData<AdminIngredientCategorySummary[]>("/admin/ingredient-categories/reorder", {
      method: "POST",
      body: { items },
      idempotencyKey: operationId
    });
  },
  listUnits() {
    return requestData<AdminUnitSummary[]>("/admin/units");
  },
  createUnit(body: UnitPayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminUnitSummary>("/admin/units", {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  updateUnit(unitId: UUID, body: UpdateUnitPayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminUnitSummary>(`/admin/units/${encodeURIComponent(String(unitId))}`, {
      method: "PUT",
      body: payload,
      idempotencyKey: operationId
    });
  },
  deleteUnit(unitId: UUID, body: DeleteUnitPayload) {
    return requestData<{ unitId: UUID; deletedAt: IsoDateTime }>(`/admin/units/${encodeURIComponent(String(unitId))}`, {
      method: "DELETE",
      body: { expectedVersion: body.expectedVersion },
      idempotencyKey: body.operationId
    });
  },
  reorderUnits(type: AdminUnitSummary["type"], operationId: OperationId, items: ReorderItem[]) {
    return requestData<AdminUnitSummary[]>("/admin/units/reorder", {
      method: "POST",
      body: {
        type,
        items
      },
      idempotencyKey: operationId
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
    const { operationId, ...payload } = body;
    return requestData<AdminIngredientSummary>("/admin/ingredients", {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  updateIngredient(ingredientId: UUID, body: UpdateIngredientPayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminIngredientSummary>(`/admin/ingredients/${encodeURIComponent(String(ingredientId))}`, {
      method: "PUT",
      body: payload,
      idempotencyKey: operationId
    });
  },
  setIngredientStatus(ingredientId: UUID, body: UpdateIngredientStatusPayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminIngredientSummary>(`/admin/ingredients/${encodeURIComponent(String(ingredientId))}/status`, {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  uploadIngredientImage(ingredientId: UUID, file: File, operationId: OperationId, expectedVersion: number) {
    const formData = new FormData();
    formData.append("expectedVersion", String(expectedVersion));
    formData.append("file", file);
    return uploadForm<AdminIngredientSummary>(`/admin/ingredients/${encodeURIComponent(String(ingredientId))}/image`, formData, {
      idempotencyKey: operationId
    });
  },
  clearIngredientImage(ingredientId: UUID, operationId: OperationId, expectedVersion: number) {
    return requestData<AdminIngredientSummary>(`/admin/ingredients/${encodeURIComponent(String(ingredientId))}/image`, {
      method: "DELETE",
      body: { expectedVersion },
      idempotencyKey: operationId
    });
  },
  reorderIngredients(categoryId: UUID | undefined, operationId: OperationId, items: ReorderItem[]) {
    return requestData<AdminIngredientSummary[]>("/admin/ingredients/reorder", {
      method: "POST",
      body: {
        categoryId,
        items
      },
      idempotencyKey: operationId
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
  listIngredientFeedbacks(query: AdminIngredientFeedbackListQuery) {
    return requestData<PageResult<AdminPendingIngredientFeedbackSummary>>("/admin/ingredient-feedbacks", {
      query: {
        page: query.page,
        pageSize: query.pageSize,
        keyword: query?.keyword
      }
    });
  },
  reviewPendingIngredient(ingredientId: UUID, body: AdminReviewPendingIngredientPayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminReviewPendingIngredientResult>(`/admin/pending-ingredients/${encodeURIComponent(String(ingredientId))}/review`, {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  },
  reviewIngredientFeedback(feedbackId: UUID, body: AdminReviewIngredientFeedbackPayload) {
    const { operationId, ...payload } = body;
    return requestData<AdminReviewIngredientFeedbackResult>(`/admin/ingredient-feedbacks/${encodeURIComponent(String(feedbackId))}/review`, {
      method: "POST",
      body: payload,
      idempotencyKey: operationId
    });
  }
};
