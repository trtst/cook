import { cfg } from "@/config";
import { get, post, put, type PageResult, type UUID } from "@/apis/http";

export interface FridgeItemSummary {
  id: UUID;
  name: string;
  quantityText: string | null;
  note: string | null;
  available: boolean;
  updatedAt: string;
}

export interface FridgeItemRequest {
  operationId: UUID;
  name: string;
  quantityText?: string | null;
  note?: string | null;
}

export const fridgeApi = {
  list(page = 1, pageSize = 50) {
    return get<PageResult<FridgeItemSummary>>(`${cfg.domain}/api/fridge-items`, { page, pageSize });
  },
  create(body: FridgeItemRequest) {
    return post<FridgeItemSummary>(`${cfg.domain}/api/fridge-items`, body);
  },
  update(itemId: UUID, body: FridgeItemRequest) {
    return put<FridgeItemSummary>(`${cfg.domain}/api/fridge-items/${encodeURIComponent(itemId)}`, body);
  },
  consume(itemIds: UUID[], operationId: UUID) {
    return post<PageResult<FridgeItemSummary>>(`${cfg.domain}/api/fridge-items/consume`, { itemIds, operationId });
  }
};
