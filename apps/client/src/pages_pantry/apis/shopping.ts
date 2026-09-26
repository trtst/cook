import { cfg } from "@/config";
import { get, post, type IsoDateTime, type OperationId, type UUID } from "@/apis/http";

export type ShoppingGapWindow = "NEXT_48_HOURS" | "NEXT_7_DAYS" | "LATER";

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

export type ShoppingListStatus = "ACTIVE" | "COMPLETED" | "VOIDED";
export type ShoppingListRole = "OWNER" | "COLLABORATOR";
export type ShoppingListInviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
export type ShoppingListInviteFilter = "ALL" | "PENDING" | "RESOLVED";
export type ShoppingListItemStatus = "OPEN" | "CHECKED" | "REMOVED";

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

export interface ShoppingListSummary {
  id: UUID;
  name: string;
  status: ShoppingListStatus;
  role: ShoppingListRole;
  ownerUid: number;
  ownerNickname: string | null;
  memberCount: number;
  memberLimit: number;
  pendingInviteCount: number;
  progressDoneCount: number;
  progressTotalCount: number;
  hasActiveShareLink: boolean;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  completedAt: IsoDateTime | null;
  voidedAt: IsoDateTime | null;
}

export interface ShoppingListPageResponse {
  items: ShoppingListSummary[];
}

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

export interface ShoppingListInvitePageResponse {
  items: ShoppingListInviteSummary[];
}

export interface ShoppingItemSourceSummary {
  sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
  title: string | null;
  recipeId: UUID | null;
  recipeKind: "my" | "inspiration" | null;
  sourceVersionId: UUID | null;
  planItemId: UUID | null;
  planDate: string | null;
  diningEventId: UUID | null;
  sourceBatchKey: string | null;
  addCount: number | null;
  servings: number | null;
}

export interface ShoppingListDetailItem {
  id: UUID;
  ingredientId: UUID | null;
  name: string;
  categoryName: string | null;
  imageUrl: string | null;
  quantityText: string | null;
  note: string | null;
  status: ShoppingListItemStatus;
  checkedAt: IsoDateTime | null;
  updatedAt: IsoDateTime;
  sources: ShoppingItemSourceSummary[];
}

export interface ShoppingListCollaborator {
  userId: UUID;
  role: ShoppingListRole;
  joinedAt: IsoDateTime;
  user: {
    uid: number;
    nickname: string | null;
    avatarUrl: string | null;
  };
}

export interface ShoppingListDetail extends ShoppingListSummary {
  collaborators: ShoppingListCollaborator[];
  items: ShoppingListDetailItem[];
}

export interface ShoppingListItemPatchResponse {
  listId: UUID;
  version: number;
  progressDoneCount: number;
  progressTotalCount: number;
  item: ShoppingListDetailItem | null;
  removedItemId: UUID | null;
}

export interface CreateShoppingListRequest {
  operationId: OperationId;
  name: string | null;
}

export interface RenameShoppingListRequest {
  operationId: OperationId;
  version: number;
  name: string;
}

export interface CreateShoppingListItemRequest {
  operationId: OperationId;
  name: string;
  ingredientId: UUID | null;
  quantityText: string | null;
  note: string | null;
}

export interface AddRecipeToShoppingListRequest {
  operationId: OperationId;
  recipeId: UUID;
  sourceVersionId: UUID;
  planItemId?: UUID | null;
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

export interface UpdateShoppingListItemCheckRequest {
  operationId: OperationId;
  version: number;
  checked: boolean;
}

export interface UpdateShoppingListItemChecksRequest {
  operationId: OperationId;
  version: number;
  items: Array<{ itemId: UUID; checked: boolean }>;
}

export interface RemoveShoppingListItemRequest {
  operationId: OperationId;
  version: number;
}

export interface UpdateShoppingListStatusRequest {
  operationId: OperationId;
  version: number;
}

export interface DeleteShoppingListRequest {
  operationId: OperationId;
  version: number;
}

export interface ShareShoppingListLinkResponse {
  shareToken: string;
  shareUrl: string;
}

export interface RemoveShoppingListMemberRequest {
  operationId: OperationId;
  version: number;
}

export interface LeaveShoppingListRequest {
  operationId: OperationId;
  version: number;
}

export interface ShoppingListInviteActionResponse {
  inviteId: UUID;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
  updatedAt: IsoDateTime;
}

export interface ShoppingSharePreview {
  listId: UUID;
  name: string;
  ownerUid: number;
  ownerNickname: string | null;
  memberCount: number;
  memberLimit: number;
  joined: boolean;
  canJoin: boolean;
  itemCount: number;
  status: ShoppingListStatus;
}

function listPath(listId: UUID) {
  return `${cfg.domain}/api/shopping-lists/${encodeURIComponent(String(listId))}`;
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
  getListDetail(listId: UUID) {
    return get<ShoppingListDetail>(listPath(listId));
  },
  renameList(listId: UUID, body: RenameShoppingListRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/rename`, payload, { idempotencyKey: operationId });
  },
  createListItem(listId: UUID, body: CreateShoppingListItemRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/items`, payload, { idempotencyKey: operationId });
  },
  addRecipeToList(listId: UUID, body: AddRecipeToShoppingListRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/items/from-recipe`, payload, { idempotencyKey: operationId });
  },
  addGapItemsToList(listId: UUID, body: AddShoppingGapItemsRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/items/from-gap`, payload, { idempotencyKey: operationId });
  },
  addEventToList(listId: UUID, body: AddEventGapToShoppingListRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/items/from-event-gap`, payload, { idempotencyKey: operationId });
  },
  addPlanToList(listId: UUID, body: AddPlanToShoppingListRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/items/from-plan`, payload, { idempotencyKey: operationId });
  },
  checkListItem(listId: UUID, itemId: UUID, body: UpdateShoppingListItemCheckRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListItemPatchResponse>(`${listPath(listId)}/items/${encodeURIComponent(String(itemId))}/check`, payload, {
      idempotencyKey: operationId
    });
  },
  checkListItems(listId: UUID, body: UpdateShoppingListItemChecksRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/items/check`, payload, { idempotencyKey: operationId });
  },
  removeListItem(listId: UUID, itemId: UUID, body: RemoveShoppingListItemRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListItemPatchResponse>(`${listPath(listId)}/items/${encodeURIComponent(String(itemId))}/remove`, payload, {
      idempotencyKey: operationId
    });
  },
  voidList(listId: UUID, body: UpdateShoppingListStatusRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/void`, payload, { idempotencyKey: operationId });
  },
  restoreList(listId: UUID, body: UpdateShoppingListStatusRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/restore`, payload, { idempotencyKey: operationId });
  },
  copyList(listId: UUID, body: UpdateShoppingListStatusRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/copy`, payload, { idempotencyKey: operationId });
  },
  checkAllListItems(listId: UUID, body: UpdateShoppingListStatusRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/check-all`, payload, { idempotencyKey: operationId });
  },
  deleteList(listId: UUID, body: DeleteShoppingListRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListPageResponse>(`${listPath(listId)}/delete`, payload, { idempotencyKey: operationId });
  },
  createShareLink(listId: UUID, body: UpdateShoppingListStatusRequest) {
    const { operationId, ...payload } = body;
    return post<ShareShoppingListLinkResponse>(`${listPath(listId)}/share-link`, payload, { idempotencyKey: operationId });
  },
  disableShareLink(listId: UUID, body: UpdateShoppingListStatusRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/share-link/disable`, payload, { idempotencyKey: operationId });
  },
  removeListMember(listId: UUID, memberUserId: UUID, body: RemoveShoppingListMemberRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/members/${encodeURIComponent(String(memberUserId))}/remove`, payload, {
      idempotencyKey: operationId
    });
  },
  closeShare(listId: UUID, body: UpdateShoppingListStatusRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/share-close`, payload, { idempotencyKey: operationId });
  },
  leaveList(listId: UUID, body: LeaveShoppingListRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListPageResponse>(`${listPath(listId)}/leave`, payload, { idempotencyKey: operationId });
  },
  getSharePreview(shareToken: string) {
    return get<ShoppingSharePreview>(`${cfg.domain}/api/shopping-shares/${encodeURIComponent(shareToken)}`);
  },
  joinShare(shareToken: string, operationId: OperationId) {
    return post<ShoppingListDetail>(`${cfg.domain}/api/shopping-shares/${encodeURIComponent(shareToken)}/join`, undefined, {
      idempotencyKey: operationId
    });
  },
  acceptInvite(inviteId: UUID, operationId: OperationId) {
    return post<ShoppingListDetail>(
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
