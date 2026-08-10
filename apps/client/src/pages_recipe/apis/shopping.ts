import { cfg } from "@/config";
import { get, post, type OperationId, type UUID } from "@/apis/http";

export interface ShoppingListSummary {
  id: UUID;
  name: string;
  memberCount: number;
  progressDoneCount: number;
  progressTotalCount: number;
}

export interface ShoppingListDetail extends ShoppingListSummary {}

interface ShoppingListPageResponse {
  items: ShoppingListSummary[];
}

export interface CreateRecipeShoppingListRequest {
  operationId: OperationId;
  name: string | null;
}

export interface AddRecipeToShoppingListRequest {
  operationId: OperationId;
  recipeId: UUID;
  sourceVersionId: UUID;
}

export const shoppingApi = {
  async listActive() {
    const result = await get<ShoppingListPageResponse>(`${cfg.domain}/api/shopping-lists`, { status: "ACTIVE" });
    return result.items;
  },
  createList(body: CreateRecipeShoppingListRequest) {
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
  }
};
