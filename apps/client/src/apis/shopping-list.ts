import { cfg } from "@/config";
import { get, post, type OperationId, type UUID } from "@/apis/http";

export interface ShoppingListSummary {
  id: UUID;
  name: string;
  memberCount: number;
  progressDoneCount: number;
  progressTotalCount: number;
}

export interface ShoppingItemSourceSummary {
  planItemId: UUID | null;
  recipeId?: UUID | null;
  sourceVersionId?: UUID | null;
}

export interface ShoppingListDetailItem {
  id: UUID;
  sources: ShoppingItemSourceSummary[];
}

export interface ShoppingListDetail extends ShoppingListSummary {
  items: ShoppingListDetailItem[];
}

interface ShoppingListPageResponse {
  items: ShoppingListSummary[];
}

export interface CreateShoppingListRequest {
  operationId: OperationId;
  name: string | null;
}

export interface AddRecipeToShoppingListRequest {
  operationId: OperationId;
  recipeId: UUID;
  sourceVersionId: UUID;
  planItemId?: UUID | null;
}

export interface AddPlanToShoppingListRequest {
  operationId: OperationId;
  planItemId: UUID;
}

export const shoppingListApi = {
  async listActive() {
    const result = await get<ShoppingListPageResponse>(`${cfg.domain}/api/shopping-lists`, { status: "ACTIVE" });
    return result.items;
  },
  getListDetail(listId: UUID) {
    return get<ShoppingListDetail>(`${cfg.domain}/api/shopping-lists/${encodeURIComponent(String(listId))}`);
  },
  createList(body: CreateShoppingListRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${cfg.domain}/api/shopping-lists`, payload, { idempotencyKey: operationId });
  },
  addRecipeToList(listId: UUID, body: AddRecipeToShoppingListRequest): Promise<ShoppingListDetail> {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(
      `${cfg.domain}/api/shopping-lists/${encodeURIComponent(String(listId))}/items/from-recipe`,
      payload,
      { idempotencyKey: operationId }
    );
  },
  addPlanToList(listId: UUID, body: AddPlanToShoppingListRequest): Promise<ShoppingListDetail> {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(
      `${cfg.domain}/api/shopping-lists/${encodeURIComponent(String(listId))}/items/from-plan`,
      payload,
      { idempotencyKey: operationId }
    );
  }
};
