import type { OperationId, UUID } from "@/apis/http";
import {
  shoppingApi as pantryShoppingApi,
  type ShoppingListDetail,
  type ShoppingListSummary
} from "@/apis/shopping";

export type { ShoppingListSummary };

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
    const result = await pantryShoppingApi.listLists("ACTIVE");
    return result.items;
  },
  createList(body: CreateRecipeShoppingListRequest) {
    return pantryShoppingApi.createList(body);
  },
  addRecipeToList(listId: UUID, body: AddRecipeToShoppingListRequest): Promise<ShoppingListDetail> {
    return pantryShoppingApi.addRecipeToList(listId, body);
  }
};
