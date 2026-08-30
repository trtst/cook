import { cfg } from "@/config";
import { get, post, type IsoDateTime, type OperationId, type UUID } from "@/apis/http";

export type ShoppingGapWindow = "NEXT_48_HOURS" | "NEXT_7_DAYS" | "LATER";
export type ShoppingListStatus = "ACTIVE" | "COMPLETED" | "VOIDED";
export type ShoppingListInviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
export type ShoppingListInviteFilter = "ALL" | "PENDING" | "RESOLVED";

export interface ShoppingGapEventSummary {
  eventId: UUID;
  title: string;
  scheduledAt: IsoDateTime;
  recipeTitles: string[];
}

export interface ShoppingGapItem {
  key: string;
  ingredientId: UUID | null;
  name: string;
  quantityText: string | null;
  sourceCount: number;
  eventCount: number;
  events: ShoppingGapEventSummary[];
}

export interface ShoppingGapSection {
  window: ShoppingGapWindow;
  title: string;
  description: string;
  itemCount: number;
  eventCount: number;
  items: ShoppingGapItem[];
}

export interface ShoppingGapResponse {
  sections: ShoppingGapSection[];
  totalItemCount: number;
  totalEventCount: number;
  hasLater: boolean;
  laterItemCount: number;
}

export interface ShoppingListSummary {
  id: UUID;
  name: string;
  status: ShoppingListStatus;
  memberCount: number;
  progressDoneCount: number;
  progressTotalCount: number;
}

export interface ShoppingListPageResponse {
  items: ShoppingListSummary[];
}

export interface ShoppingListStatusCount {
  status: ShoppingListStatus;
  count: number;
}

export interface ShoppingListSummaryResponse {
  statuses: ShoppingListStatusCount[];
  defaultStatus: ShoppingListStatus;
  activeListCount: number;
  pendingItemCount: number;
}

export interface ShoppingListDetail extends ShoppingListSummary {}

export interface ShoppingListInviteSummary {
  id: UUID;
  listId: UUID;
  name: string;
  ownerUid: number;
  ownerNickname: string | null;
  memberCount: number;
  memberLimit: number;
  itemCount: number;
  status: ShoppingListStatus;
  inviteStatus: ShoppingListInviteStatus;
  canJoin: boolean;
  invitedAt: IsoDateTime;
  handledAt: IsoDateTime | null;
}

interface ShoppingListInvitePageResponse {
  items: ShoppingListInviteSummary[];
}

interface AcceptedShoppingListDetail {
  id: UUID;
}

interface ShoppingListInviteActionResponse {
  inviteId: UUID;
  status: ShoppingListInviteStatus;
  updatedAt: IsoDateTime;
}

export interface CreateShoppingListRequest {
  operationId: OperationId;
  name: string | null;
}

export interface AddShoppingGapItemsRequest {
  operationId: OperationId;
  window: ShoppingGapWindow;
  gapKeys: string[];
}

export interface AddEventGapToShoppingListRequest {
  operationId: OperationId;
  eventId: UUID;
}

export interface AddPlanToShoppingListRequest {
  operationId: OperationId;
  planItemId: UUID;
}

export interface AddRecipeToShoppingListRequest {
  operationId: OperationId;
  recipeId: UUID;
  sourceVersionId: UUID;
  planItemId?: UUID | null;
}

export const shoppingApi = {
  previewGap() {
    return get<ShoppingGapResponse>(`${cfg.domain}/api/shopping-gap`);
  },
  getListSummary() {
    return get<ShoppingListSummaryResponse>(`${cfg.domain}/api/shopping-lists/summary`);
  },
  listInvites(filter?: ShoppingListInviteFilter) {
    return get<ShoppingListInvitePageResponse>(`${cfg.domain}/api/shopping-list-invites`, { filter });
  },
  listLists(status?: ShoppingListStatus) {
    return get<ShoppingListPageResponse>(`${cfg.domain}/api/shopping-lists`, { status });
  },
  createList(body: CreateShoppingListRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${cfg.domain}/api/shopping-lists`, payload, { idempotencyKey: operationId });
  },
  addGapItemsToList(listId: UUID, body: AddShoppingGapItemsRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${cfg.domain}/api/shopping-lists/${encodeURIComponent(String(listId))}/items/from-gap`, payload, {
      idempotencyKey: operationId
    });
  },
  addEventToList(listId: UUID, body: AddEventGapToShoppingListRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${cfg.domain}/api/shopping-lists/${encodeURIComponent(String(listId))}/items/from-event-gap`, payload, {
      idempotencyKey: operationId
    });
  },
  addPlanToList(listId: UUID, body: AddPlanToShoppingListRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${cfg.domain}/api/shopping-lists/${encodeURIComponent(String(listId))}/items/from-plan`, payload, {
      idempotencyKey: operationId
    });
  },
  addRecipeToList(listId: UUID, body: AddRecipeToShoppingListRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${cfg.domain}/api/shopping-lists/${encodeURIComponent(String(listId))}/items/from-recipe`, payload, {
      idempotencyKey: operationId
    });
  },
  acceptInvite(inviteId: UUID, operationId: OperationId) {
    return post<AcceptedShoppingListDetail>(
      `${cfg.domain}/api/shopping-list-invites/${encodeURIComponent(String(inviteId))}/accept`,
      undefined,
      { idempotencyKey: operationId }
    );
  },
  declineInvite(inviteId: UUID, operationId: OperationId) {
    return post<ShoppingListInviteActionResponse>(
      `${cfg.domain}/api/shopping-list-invites/${encodeURIComponent(String(inviteId))}/decline`,
      undefined,
      { idempotencyKey: operationId }
    );
  }
};
