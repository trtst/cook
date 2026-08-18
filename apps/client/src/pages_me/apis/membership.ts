import { cfg } from "@/config";
import { post, type IsoDateTime, type OperationId } from "@/apis/http";
import type { UserMembership } from "@/apis/user";

export interface RedeemMembershipCodeResult {
  membership: UserMembership;
  redeemedAt: IsoDateTime;
}

export const membershipApi = {
  redeemCode(code: string, operationId: OperationId) {
    return post<RedeemMembershipCodeResult>(`${cfg.domain}/api/membership-codes/redeem`, { code }, {
      idempotencyKey: operationId
    });
  }
};
