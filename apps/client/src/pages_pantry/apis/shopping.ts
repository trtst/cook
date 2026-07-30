import { cfg } from "@/config";
import { get, post, type PageResult, type OperationId, type UUID } from "@/apis/http";

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
  operationId: OperationId;
  name: string;
  quantityText?: string | null;
  note?: string | null;
}

export const shoppingApi = {
  list(status?: "OPEN" | "BOUGHT" | "DELETED", page = 1, pageSize = 50) {
    return get<PageResult<ShoppingItemSummary>>(`${cfg.domain}/api/shopping-items`, { status, page, pageSize });
  },
  create(body: CreateShoppingItemRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingItemSummary>(`${cfg.domain}/api/shopping-items`, payload, { idempotencyKey: operationId });
  },
  updateStatus(itemId: UUID, operationId: OperationId, status: "OPEN" | "BOUGHT" | "DELETED") {
    return post<ShoppingItemSummary>(
      `${cfg.domain}/api/shopping-items/${encodeURIComponent(itemId)}/status`,
      { status },
      { idempotencyKey: operationId }
    );
  },
  previewGap(eventId: UUID) {
    return get<ShoppingItemSummary[]>(`${cfg.domain}/api/shopping-gap`, { eventId });
  },
  createEventGap(eventId: UUID, operationId: OperationId) {
    return post<ShoppingItemSummary[]>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/shopping-gap`, undefined, {
      idempotencyKey: operationId
    });
  }
};
