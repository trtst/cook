import type {
  CollaborationMode,
  IsoDateTime,
  MemberStatus,
  RestaurantRole,
  SharedQuotaPolicy,
  UUID
} from "@next-meal/domain";

export type { CollaborationMode, IsoDateTime, MemberStatus, RestaurantRole, SharedQuotaPolicy, UUID };

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  serverTime: IsoDateTime;
}

export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface UserProfile {
  id: UUID;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  membership?: UserMembershipSnapshot;
  status: "ACTIVE" | string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface UserMembershipSnapshot {
  tier: "FREE" | "PLUS" | "PRO" | string;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | string;
  skinEntitlements: string[];
  expiresAt: IsoDateTime | null;
}

export interface UserSummary {
  id: UUID;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface RestaurantSummary {
  id: UUID;
  name: string;
  ownerId: UUID;
  collaborationMode: CollaborationMode;
  sharedQuotaPolicy: SharedQuotaPolicy;
  memberLimit: number;
  status: "ACTIVE" | string;
  version: number;
  myRole: RestaurantRole;
  myMemberStatus: MemberStatus;
  memberCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RestaurantMemberSummary {
  id: UUID;
  restaurantId: UUID;
  user: UserSummary;
  role: RestaurantRole;
  status: MemberStatus;
  joinedAt: IsoDateTime | null;
  invitedAt: IsoDateTime | null;
  version: number;
}
