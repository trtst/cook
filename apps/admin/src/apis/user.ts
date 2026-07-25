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

export interface CreateAdminUserRequest {
  operationId: UUID;
  phone: string;
  password: string;
  nickname?: string;
  status?: "ACTIVE" | "DISABLED";
}

export interface UpdateAdminUserRequest {
  operationId: UUID;
  phone?: string;
  nickname?: string;
}

export interface SetAdminUserStatusRequest {
  operationId: UUID;
  status: "ACTIVE" | "DISABLED";
}

export interface ResetAdminUserPasswordRequest {
  operationId: UUID;
  newPassword: string;
}

export interface AdminResetUserPasswordResponse {
  userId: UUID;
  resetAt: IsoDateTime;
}

export type EntitlementTier = "FREE" | "PLUS" | "PRO" | "ULTRA";
export type DiningGroupState = "NORMAL" | "OVER_MEMBER_LIMIT";
export type DiningGroupRole = "OWNER" | "ADMIN" | "MEMBER";
export type LongTermMemberStatus = "ACTIVE" | "RESTRICTED" | "ENDED";

export interface UserMembership {
  tier: EntitlementTier;
  validUntil: IsoDateTime | null;
}

export interface DiningGroupUsageSummary {
  ownedCount: number;
  joinedCount: number;
  joinLimit: number;
  state: DiningGroupState;
}

export interface DiningGroupSummary {
  id: UUID;
  name: string;
  ownerUid: number;
  isOwned: boolean;
  myRole: DiningGroupRole;
  myStatus: LongTermMemberStatus;
  myStatusReason: string | null;
  memberCount: number;
  memberLimit: number;
  state: DiningGroupState;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface EffectiveImagePolicy {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  maxOutputBytes: number;
  maxInputBytes: number;
}

export interface StorageUsageSummary {
  state: "NORMAL" | "OVER_STORAGE_READONLY";
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  byModule: Array<{
    module: string;
    usedBytes: number;
  }>;
  calculatedAt: IsoDateTime;
}

export interface AdminUserEntitlementResponse {
  user: Pick<UserProfile, "id" | "uid" | "nickname" | "status">;
  membership: UserMembership;
  display: {
    canUseProfileBackground: boolean;
    canUseHomeBackground: boolean;
  };
  diningGroupUsage: DiningGroupUsageSummary;
  diningGroups: DiningGroupSummary[];
  storage: StorageUsageSummary;
  recipePolicy: {
    recipeLimit: number;
    recycleDays: number;
    variantLimitPerRoot: number;
  };
  invitePolicy: {
    inviteLimit: number;
    memberLimit: number;
  };
  imagePolicy: EffectiveImagePolicy;
}

export const userApi = {
  list(query: AdminListUsersQuery) {
    return requestData<PageResult<UserProfile>>("/admin/users", {
      query: { ...query }
    });
  },
  create(body: CreateAdminUserRequest) {
    return requestData<UserProfile>("/admin/users", {
      method: "POST",
      body
    });
  },
  update(userId: UUID, body: UpdateAdminUserRequest) {
    return requestData<UserProfile>(`/admin/users/${userId}`, {
      method: "PUT",
      body
    });
  },
  setStatus(userId: UUID, body: SetAdminUserStatusRequest) {
    return requestData<UserProfile>(`/admin/users/${userId}/status`, {
      method: "POST",
      body
    });
  },
  resetPassword(userId: UUID, body: ResetAdminUserPasswordRequest) {
    return requestData<AdminResetUserPasswordResponse>(`/admin/users/${userId}/reset-password`, {
      method: "POST",
      body
    });
  },
  getEntitlements(userId: UUID) {
    return requestData<AdminUserEntitlementResponse>("/admin/user-entitlements", {
      query: { userId }
    });
  }
};
