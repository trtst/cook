import type {
  CollaborationMode,
  IsoDateTime,
  MemberStatus,
  DiningGroupRole,
  SharedQuotaPolicy,
  UUID
} from "@next-meal/domain";

export type { CollaborationMode, IsoDateTime, MemberStatus, DiningGroupRole, SharedQuotaPolicy, UUID };

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
  /** Non-sequential public user number for display and support lookup. */
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  status: "ACTIVE" | string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface UserBasic {
  id: UUID;
  /** Non-sequential public user number for display and support lookup. */
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
}

export interface UserSummary {
  id: UUID;
  /** Non-sequential public user number for display and support lookup. */
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface DiningGroupSummary {
  id: UUID;
  name: string;
  ownerId: UUID;
  collaborationMode: CollaborationMode;
  sharedQuotaPolicy: SharedQuotaPolicy;
  memberLimit: number;
  status: "ACTIVE" | string;
  version: number;
  myRole: DiningGroupRole;
  myMemberStatus: MemberStatus;
  memberCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface DiningGroupMemberSummary {
  id: UUID;
  diningGroupId: UUID;
  user: UserSummary;
  role: DiningGroupRole;
  status: MemberStatus;
  joinedAt: IsoDateTime | null;
  invitedAt: IsoDateTime | null;
  version: number;
}
