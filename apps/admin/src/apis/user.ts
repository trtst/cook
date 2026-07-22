import { requestData, type IsoDateTime, type PageQuery, type PageResult, type UUID } from "./http";

export interface UserProfile {
  id: UUID;
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  status: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminListUsersQuery extends PageQuery {
  keyword?: string;
}

export type EntitlementTier = "FREE" | "PLUS";
export type EntitlementScope = "USER" | "DINING_GROUP";

export interface EffectiveImagePolicy {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  maxOutputBytes: number;
  maxInputBytes: number;
}

export interface EffectiveEntitlementSnapshot {
  personalTier: EntitlementTier;
  diningGroupTier: EntitlementTier;
  currentScope: EntitlementScope;
  recipeLimit: number;
  memberLimit: number | null;
  storageLimitBytes: number;
  snapshotDays: number;
  recycleDays: number;
  variantLimitPerRoot: number;
  imagePolicy: EffectiveImagePolicy;
}

export interface AdminUserEntitlementResponse {
  user: Pick<UserProfile, "id" | "uid" | "nickname" | "status">;
  currentSpace: {
    id: UUID;
    name: string;
  };
  entitlements: EffectiveEntitlementSnapshot;
}

export const userApi = {
  list(query: AdminListUsersQuery) {
    return requestData<PageResult<UserProfile>>("/admin/users", {
      query: { ...query }
    });
  },
  getEntitlements(userId: UUID) {
    return requestData<AdminUserEntitlementResponse>("/admin/user-entitlements", {
      query: { userId }
    });
  }
};
