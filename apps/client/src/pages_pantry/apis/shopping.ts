import { cfg } from "@/config";
import { get, post, type IsoDateTime, type OperationId, type PageResult, type UUID } from "@/apis/http";

export interface ShoppingItemSummary {
  id: UUID;
  name: string;
  quantityText: string | null;
  note: string | null;
  sourceCount: number;
  sourceTitles: string[];
  sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
  sourceKey: string | null;
  status: "OPEN" | "BOUGHT" | "DELETED";
  updatedAt: IsoDateTime;
}

export interface ShoppingIngredientGroup {
  key: string;
  ingredientId: UUID;
  name: string;
  quantityLines: string[];
  recipeCount: number;
  recipeTitles: string[];
  updatedAt: IsoDateTime;
}

export interface ShoppingRecipeIngredientGroup {
  key: string;
  ingredientId: UUID;
  name: string;
  quantityLines: string[];
  updatedAt: IsoDateTime;
}

export interface ShoppingRecipeGroup {
  key: string;
  recipeId: UUID;
  sourceVersionId: UUID;
  title: string;
  addCount: number;
  totalServings: number;
  updatedAt: IsoDateTime;
  items: ShoppingRecipeIngredientGroup[];
}

export interface ShoppingBoardResponse {
  ingredientGroups: ShoppingIngredientGroup[];
  recipeGroups: ShoppingRecipeGroup[];
  otherItems: ShoppingItemSummary[];
}

export interface CreateShoppingItemRequest {
  operationId: OperationId;
  name: string;
  quantityText?: string | null;
  note?: string | null;
}

export interface CreateRecipeShoppingItemsRequest {
  operationId: OperationId;
  recipeId: UUID;
  sourceVersionId: UUID;
}

export type ShoppingListStatus = "ACTIVE" | "COMPLETED" | "VOIDED";
export type ShoppingListRole = "OWNER" | "COLLABORATOR";
export type ShoppingListInviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
export type ShoppingListInviteFilter = "ALL" | "PENDING" | "RESOLVED";
export type ShoppingListItemStatus = "OPEN" | "CHECKED" | "REMOVED";
export type ShoppingListItemFridgeAction = "APPLY" | "UNDO";
export type ShoppingListItemFridgeActionMode = "NONE" | "APPLY_FULL" | "APPLY_PARTIAL" | "NEED_CONFIRM" | "UNDO";
export type ShoppingInventoryStatus = "NONE" | "ENOUGH" | "SHORTAGE" | "UNKNOWN";

export interface ShoppingListStatusCount {
  status: ShoppingListStatus;
  count: number;
}

export interface ShoppingListSummaryResponse {
  statuses: ShoppingListStatusCount[];
  defaultStatus: ShoppingListStatus;
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
  sourceVersionId: UUID | null;
  planItemId: UUID | null;
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
  requiredQuantityText: string | null;
  remainingQuantityText: string | null;
  appliedInventoryQuantityText: string | null;
  note: string | null;
  status: ShoppingListItemStatus;
  fridgeText: string | null;
  inventoryStatus: ShoppingInventoryStatus;
  inventoryApplied: boolean;
  inventoryCovered: boolean;
  fridgeStatusText: string | null;
  fridgeActionLabel: string | null;
  fridgeActionMode: ShoppingListItemFridgeActionMode;
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

export interface UpdateShoppingListItemCheckRequest {
  operationId: OperationId;
  version: number;
  checked: boolean;
}

export interface ApplyShoppingListItemFridgeRequest {
  operationId: OperationId;
  version: number;
  action: ShoppingListItemFridgeAction;
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

export interface CompleteShoppingListEntryRequest {
  itemId: UUID;
  store: boolean;
  quantityText: string | null;
  expireDays: number | null;
  expireAt: string | null;
}

export interface CompleteShoppingListRequest {
  operationId: OperationId;
  version: number;
  entries: CompleteShoppingListEntryRequest[];
}

export interface ShareShoppingListLinkResponse {
  shareToken: string;
  shareUrl: string;
}

export interface ShareShoppingListMembersRequest {
  operationId: OperationId;
  version: number;
  targetUserIds: UUID[];
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
  list(status?: "OPEN" | "BOUGHT" | "DELETED", page = 1, pageSize = 50) {
    return get<PageResult<ShoppingItemSummary>>(`${cfg.domain}/api/shopping-items`, { status, page, pageSize });
  },
  getBoard() {
    return get<ShoppingBoardResponse>(`${cfg.domain}/api/shopping-items/board`);
  },
  create(body: CreateShoppingItemRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingItemSummary>(`${cfg.domain}/api/shopping-items`, payload, { idempotencyKey: operationId });
  },
  createFromRecipe(body: CreateRecipeShoppingItemsRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingBoardResponse>(`${cfg.domain}/api/shopping-items/from-recipe`, payload, { idempotencyKey: operationId });
  },
  updateStatus(itemId: UUID, operationId: OperationId, status: "OPEN" | "BOUGHT" | "DELETED") {
    return post<ShoppingItemSummary>(
      `${cfg.domain}/api/shopping-items/${encodeURIComponent(String(itemId))}/status`,
      { status },
      { idempotencyKey: operationId }
    );
  },
  updateGroupStatus(targetKey: string, operationId: OperationId, status: "OPEN" | "BOUGHT" | "DELETED") {
    return post<ShoppingBoardResponse>(
      `${cfg.domain}/api/shopping-items/group-status`,
      { targetKey, status },
      { idempotencyKey: operationId }
    );
  },
  previewGap() {
    return get<ShoppingItemSummary[]>(`${cfg.domain}/api/shopping-gap`);
  },
  createEventGap(eventId: UUID, operationId: OperationId) {
    return post<ShoppingItemSummary[]>(`${cfg.domain}/api/dining-events/${encodeURIComponent(String(eventId))}/shopping-gap`, undefined, {
      idempotencyKey: operationId
    });
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
  checkListItem(listId: UUID, itemId: UUID, body: UpdateShoppingListItemCheckRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListItemPatchResponse>(`${listPath(listId)}/items/${encodeURIComponent(String(itemId))}/check`, payload, {
      idempotencyKey: operationId
    });
  },
  applyListItemFridge(listId: UUID, itemId: UUID, body: ApplyShoppingListItemFridgeRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListItemPatchResponse>(`${listPath(listId)}/items/${encodeURIComponent(String(itemId))}/fridge`, payload, {
      idempotencyKey: operationId
    });
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
  completeList(listId: UUID, body: CompleteShoppingListRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/complete`, payload, { idempotencyKey: operationId });
  },
  createShareLink(listId: UUID, body: UpdateShoppingListStatusRequest) {
    const { operationId, ...payload } = body;
    return post<ShareShoppingListLinkResponse>(`${listPath(listId)}/share-link`, payload, { idempotencyKey: operationId });
  },
  disableShareLink(listId: UUID, body: UpdateShoppingListStatusRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/share-link/disable`, payload, { idempotencyKey: operationId });
  },
  shareListMembers(listId: UUID, body: ShareShoppingListMembersRequest) {
    const { operationId, ...payload } = body;
    return post<ShoppingListDetail>(`${listPath(listId)}/share-members`, payload, { idempotencyKey: operationId });
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
