import type { IsoDateTime, PageQuery, PageResult, DiningGroupMemberSummary, DiningGroupSummary, UserBasic, UserProfile, UUID } from "./types";

export interface PasswordLoginRequest {
  phone: string;
  password: string;
}

export interface PasswordLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  userId: UUID;
  user: UserBasic;
}

export interface RefreshSessionResult {
  token: string;
  expiresAt: IsoDateTime;
}

export interface UpdateCurrentUserRequest {
  nickname?: string;
  avatarUrl?: string;
  phone?: string;
}

export interface MyDiningGroupsResult {
  diningGroups: DiningGroupSummary[];
  currentDiningGroupId: UUID | null;
  limits: {
    ownedLimit: number;
    joinedLimit: number;
    freeMemberLimit: number;
  };
}

export interface CreateDiningGroupRequest {
  name: string;
  operationId: UUID;
}

export interface CreateDiningGroupResult {
  diningGroup: DiningGroupSummary;
  ownerMember: DiningGroupMemberSummary;
}

export interface DiningGroupMembersResult {
  diningGroupId: UUID;
  members: DiningGroupMemberSummary[];
}

export interface CreateInviteRequest {
  diningGroupId: UUID;
  operationId: UUID;
}

export interface CreateInviteResult {
  inviteToken: string;
  sharePath: string;
  expiresAt: IsoDateTime;
}

export interface AcceptInviteRequest {
  operationId: UUID;
}

export interface AcceptInviteResult {
  diningGroup: DiningGroupSummary;
  member: DiningGroupMemberSummary;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  admin: {
    id: UUID;
    username: string;
    displayName: string;
    roles: string[];
  };
}

export interface AdminListUsersQuery extends PageQuery {
  keyword?: string;
}

export type AdminListUsersResult = PageResult<UserProfile>;

export interface AdminListDiningGroupsQuery extends PageQuery {
  keyword?: string;
  status?: string;
}

export type AdminListDiningGroupsResult = PageResult<DiningGroupSummary>;
