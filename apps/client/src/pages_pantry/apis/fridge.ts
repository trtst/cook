import { cfg } from "@/config";
import { get, post, put, type PageResult, type OperationId, type UUID } from "@/apis/http";

export interface FridgeItemSummary {
  id: UUID;
  ingredientId: UUID | null;
  categoryName: string | null;
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
  available?: boolean;
  quantityText?: string | null;
  exactQuantity?: string | null;
  exactUnitId?: UUID | null;
  expireAt?: string | null;
  note?: string | null;
}

export interface UpdateFridgeItemsRequest {
  operationId: OperationId;
  itemIds: UUID[];
  available?: boolean;
  quantityText?: string | null;
  exactQuantity?: string | null;
  exactUnitId?: UUID | null;
}

export interface FridgeExpiryReminderSendResponse {
  sentAt: string;
}

export interface FridgeStockGroup {
  unitId: UUID;
  unitName: string;
  quantity: string;
  batchCount: number;
}

export interface FridgeBatchSummary extends FridgeItemSummary {
  ingredientId: UUID | null;
  isExpired: boolean;
  isExpiredWithin15Days: boolean;
  needsConfirmation: boolean;
  createdAt: string;
}

export interface FridgeIngredientSummary {
  id: UUID;
  ingredientId: UUID | null;
  categoryName: string | null;
  name: string;
  stockText: string;
  stockGroups: FridgeStockGroup[];
  expireAt: string | null;
  isExpired: boolean;
  expiredBatchCount: number;
  batchCount: number;
  hasReservation: boolean;
  needsConfirmation: boolean;
  identityPending: boolean;
  updatedAt: string;
}

export interface FridgeIngredientDetail extends FridgeIngredientSummary {
  activeBatches: FridgeBatchSummary[];
  expiredBatches: FridgeBatchSummary[];
}

export interface FridgeConsumeResponse {
  detail: FridgeIngredientDetail;
  allocations: Array<{ batchId: UUID; quantity: string; unitId: UUID }>;
}

function normalizeFridgeItem(item: Partial<FridgeItemSummary> & Pick<FridgeItemSummary, "id" | "name" | "available" | "updatedAt">): FridgeItemSummary {
  return {
    id: item.id,
    ingredientId: item.ingredientId ?? null,
    categoryName: item.categoryName ?? null,
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

function normalizeFridgeBatch(item: FridgeBatchSummary): FridgeBatchSummary {
  return {
    ...item,
    ...normalizeFridgeItem(item)
  };
}

export const fridgeApi = {
  list(page = 1, pageSize = 50) {
    return get<PageResult<FridgeIngredientSummary>>(`${cfg.domain}/api/fridge-items`, { page, pageSize }).then(result => ({
      ...result,
      items: result.items.map(item => ({
        ...item,
        stockGroups: Array.isArray(item.stockGroups) ? item.stockGroups : [],
        stockText: item.stockText || "未填库存"
      }))
    }));
  },
  getDetail(ingredientId: UUID) {
    return get<FridgeIngredientDetail>(`${cfg.domain}/api/fridge-items/${encodeURIComponent(String(ingredientId))}`).then(detail => ({
      ...detail,
      activeBatches: detail.activeBatches.map(item => normalizeFridgeBatch(item)),
      expiredBatches: detail.expiredBatches.map(item => normalizeFridgeBatch(item))
    }));
  },
  getBatchDetail(itemId: UUID) {
    return get<FridgeIngredientDetail>(`${cfg.domain}/api/fridge-items/batch/${encodeURIComponent(String(itemId))}`).then(detail => ({
      ...detail,
      activeBatches: detail.activeBatches.map(item => normalizeFridgeBatch(item)),
      expiredBatches: detail.expiredBatches.map(item => normalizeFridgeBatch(item))
    }));
  },
  getHistory(ingredientId: UUID, page = 1, pageSize = 20) {
    return get<PageResult<FridgeBatchSummary>>(`${cfg.domain}/api/fridge-items/${encodeURIComponent(String(ingredientId))}/history`, {
      page,
      pageSize
    }).then(result => ({
      ...result,
      items: result.items.map(item => normalizeFridgeBatch(item))
    }));
  },
  sendExpiryReminder(itemId: UUID, operationId: OperationId) {
    return post<FridgeExpiryReminderSendResponse>(
      `${cfg.domain}/api/fridge-items/${encodeURIComponent(itemId)}/expiry-reminder`,
      {},
      { idempotencyKey: operationId }
    );
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
  updateMany(body: UpdateFridgeItemsRequest) {
    const { operationId, itemIds, ...payload } = body;
    return put<FridgeItemSummary[]>(`${cfg.domain}/api/fridge-items/batch-state`, { itemIds, ...payload }, {
      idempotencyKey: operationId
    }).then(items => items.map(item => normalizeFridgeItem(item)));
  },
  consume(ingredientId: UUID, exactQuantity: string, exactUnitId: UUID, operationId: OperationId) {
    return post<FridgeConsumeResponse>(
      `${cfg.domain}/api/fridge-items/consume`,
      { ingredientId, exactQuantity, exactUnitId },
      { idempotencyKey: operationId }
    ).then(result => ({
      ...result,
      detail: {
        ...result.detail,
        activeBatches: result.detail.activeBatches.map(item => normalizeFridgeBatch(item)),
        expiredBatches: result.detail.expiredBatches.map(item => normalizeFridgeBatch(item))
      }
    }));
  }
};
