import { cfg } from "@/config";
import { get, post, type OperationId, type PageResult, type UUID } from "@/apis/http";

export type FridgeTraceKind = "PURCHASED" | "USED" | "MANUAL_PRESENT" | "MANUAL_EMPTY";

export interface FridgeTraceSummary {
  id: UUID;
  ingredientId: UUID | null;
  name: string;
  categoryName: string | null;
  kind: FridgeTraceKind;
  label: string;
  recordedAt: string;
  windowDays: 7 | 15;
  presence: "PRESENT" | "EMPTY" | "UNCONFIRMED";
  archived: boolean;
  recentlyPurchased: boolean;
}

export interface CreateFridgeTraceRequest {
  operationId: OperationId;
  ingredientId?: UUID | null;
  name: string;
  categoryName?: string | null;
}

export interface FridgeTraceSummaryResponse {
  totalCount: number;
  latestTime: string | null;
}

export const fridgeApi = {
  list(page = 1, pageSize = 50) {
    return get<PageResult<FridgeTraceSummary>>(`${cfg.domain}/api/fridge-traces`, { page, pageSize });
  },
  getSummary() {
    return get<FridgeTraceSummaryResponse>(`${cfg.domain}/api/fridge-traces/summary`);
  },
  markPresent(body: CreateFridgeTraceRequest) {
    const { operationId, ...payload } = body;
    return post<FridgeTraceSummary>(`${cfg.domain}/api/fridge-traces/present`, payload, { idempotencyKey: operationId });
  },
  markPresentBatch(items: Array<Omit<CreateFridgeTraceRequest, "operationId">>, operationId: OperationId) {
    return post<FridgeTraceSummary[]>(`${cfg.domain}/api/fridge-traces/present/batch`, { items }, { idempotencyKey: operationId });
  },
  markEmpty(body: CreateFridgeTraceRequest) {
    const { operationId, ...payload } = body;
    return post<FridgeTraceSummary>(`${cfg.domain}/api/fridge-traces/empty`, payload, { idempotencyKey: operationId });
  }
};
