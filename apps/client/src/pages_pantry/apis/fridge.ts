import { cfg } from "@/config";
import { get, post, put, type PageResult, type OperationId, type UUID } from "@/apis/http";

export interface FridgeItemSummary {
  id: UUID;
  name: string;
  quantityText: string | null;
  note: string | null;
  available: boolean;
  updatedAt: string;
}

export interface FridgeItemRequest {
  operationId: OperationId;
  name: string;
  quantityText?: string | null;
  note?: string | null;
}

export const fridgeApi = {
  list(page = 1, pageSize = 50) {
    return get<PageResult<FridgeItemSummary>>(`${cfg.domain}/api/fridge-items`, { page, pageSize });
  },
  create(body: FridgeItemRequest) {
    const { operationId, ...payload } = body;
    return post<FridgeItemSummary>(`${cfg.domain}/api/fridge-items`, payload, { idempotencyKey: operationId });
  },
  update(itemId: UUID, body: FridgeItemRequest) {
    const { operationId, ...payload } = body;
    return put<FridgeItemSummary>(`${cfg.domain}/api/fridge-items/${encodeURIComponent(itemId)}`, payload, {
      idempotencyKey: operationId
    });
  },
  consume(itemIds: UUID[], operationId: OperationId) {
    return post<PageResult<FridgeItemSummary>>(`${cfg.domain}/api/fridge-items/consume`, { itemIds }, { idempotencyKey: operationId });
  }
};
