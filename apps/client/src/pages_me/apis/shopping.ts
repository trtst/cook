import { cfg } from "@/config";
import { get, post, type IsoDateTime, type OperationId, type UUID } from "@/apis/http";

export type ShoppingListStatus = "ACTIVE" | "COMPLETED" | "VOIDED";
export type ShoppingListInviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
export type ShoppingListInviteFilter = "ALL" | "PENDING" | "RESOLVED";

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

export const shoppingApi = {
  listInvites(filter?: ShoppingListInviteFilter) {
    return get<ShoppingListInvitePageResponse>(`${cfg.domain}/api/shopping-list-invites`, { filter });
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
