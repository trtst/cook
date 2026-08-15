import { cfg } from "@/config";
import { get, post, put, type PageResult, type OperationId, type UUID } from "@/apis/http";

export interface FridgeItemSummary {
  id: UUID;
  ingredientId: UUID | null;
  name: string;
  quantityText: string | null;
  exactQuantity: string | null;
  exactUnitId: UUID | null;
  exactUnitName: string | null;
  note: string | null;
  available: boolean;
  expireAt: string | null;
  stockText: string | null;
  reservedText: string | null;
  availableText: string | null;
  reservations: Array<{
    shoppingListId: UUID;
    shoppingListName: string;
    shoppingItemId: UUID;
    reservedText: string;
  }>;
  updatedAt: string;
}

export interface CreateFridgeItemRequest {
  operationId: OperationId;
  name: string;
  ingredientId?: UUID | null;
  quantityText?: string | null;
  exactQuantity?: string | null;
  exactUnitId?: UUID | null;
  expireAt?: string | null;
  note?: string | null;
}

export interface UpdateFridgeItemRequest {
  operationId: OperationId;
  quantityText?: string | null;
  exactQuantity?: string | null;
  exactUnitId?: UUID | null;
  expireAt?: string | null;
  note?: string | null;
}

function normalizeFridgeItem(item: Partial<FridgeItemSummary> & Pick<FridgeItemSummary, "id" | "name" | "available" | "updatedAt">): FridgeItemSummary {
  return {
    id: item.id,
    ingredientId: item.ingredientId ?? null,
    name: item.name,
    quantityText: item.quantityText ?? null,
    exactQuantity: item.exactQuantity ?? null,
    exactUnitId: item.exactUnitId ?? null,
    exactUnitName: item.exactUnitName ?? null,
    note: item.note ?? null,
    available: item.available,
    expireAt: item.expireAt ?? null,
    stockText: item.stockText ?? item.quantityText ?? null,
    reservedText: item.reservedText ?? null,
    availableText: item.availableText ?? item.stockText ?? item.quantityText ?? null,
    reservations: Array.isArray(item.reservations) ? item.reservations : [],
    updatedAt: item.updatedAt
  };
}

export const fridgeApi = {
  list(page = 1, pageSize = 50) {
    return get<PageResult<FridgeItemSummary>>(`${cfg.domain}/api/fridge-items`, { page, pageSize }).then(result => ({
      ...result,
      items: result.items.map(item => normalizeFridgeItem(item))
    }));
  },
  create(body: CreateFridgeItemRequest) {
    const { operationId, ...payload } = body;
    return post<FridgeItemSummary>(`${cfg.domain}/api/fridge-items`, payload, { idempotencyKey: operationId }).then(item =>
      normalizeFridgeItem(item)
    );
  },
  update(itemId: UUID, body: UpdateFridgeItemRequest) {
    const { operationId, ...payload } = body;
    return put<FridgeItemSummary>(`${cfg.domain}/api/fridge-items/${encodeURIComponent(itemId)}`, payload, {
      idempotencyKey: operationId
    }).then(item => normalizeFridgeItem(item));
  },
  consume(itemIds: UUID[], operationId: OperationId) {
    return post<PageResult<FridgeItemSummary>>(`${cfg.domain}/api/fridge-items/consume`, { itemIds }, { idempotencyKey: operationId }).then(
      result => ({
        ...result,
        items: result.items.map(item => normalizeFridgeItem(item))
      })
    );
  }
};
