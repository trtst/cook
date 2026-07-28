import { cfg } from "@/config";
import { get, post, type PageResult, type UUID } from "@/apis/http";

export interface ShoppingItemSummary {
  id: UUID;
  name: string;
  quantityText: string | null;
  note: string | null;
  sourceType: "MANUAL" | "PLAN" | "EVENT" | "BRING";
  sourceKey: string | null;
  status: "OPEN" | "BOUGHT" | "DELETED";
  updatedAt: string;
}

export interface CreateShoppingItemRequest {
  operationId: UUID;
  name: string;
  quantityText?: string | null;
  note?: string | null;
}

export const shoppingApi = {
  list(status?: "OPEN" | "BOUGHT" | "DELETED", page = 1, pageSize = 50) {
    return get<PageResult<ShoppingItemSummary>>(`${cfg.domain}/api/shopping-items`, { status, page, pageSize });
  },
  create(body: CreateShoppingItemRequest) {
    return post<ShoppingItemSummary>(`${cfg.domain}/api/shopping-items`, body);
  },
  updateStatus(itemId: UUID, operationId: UUID, status: "OPEN" | "BOUGHT" | "DELETED") {
    return post<ShoppingItemSummary>(`${cfg.domain}/api/shopping-items/${encodeURIComponent(itemId)}/status`, {
      operationId,
      status
    });
  },
  previewGap(eventId: UUID) {
    return get<ShoppingItemSummary[]>(`${cfg.domain}/api/shopping-gap`, { eventId });
  },
  createEventGap(eventId: UUID, operationId: UUID) {
    return post<ShoppingItemSummary[]>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/shopping-gap`, {
      operationId
    });
  }
};
