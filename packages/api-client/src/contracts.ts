import type { IsoDateTime, PageQuery, PageResult, RestaurantMemberSummary, RestaurantSummary, UserProfile, UUID } from "./types";

export interface WechatLoginRequest {
  code: string;
}

export interface WechatLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  user: UserProfile;
}

export interface UpdateCurrentUserRequest {
  nickname?: string;
  avatarUrl?: string;
  phone?: string;
}

export interface MyRestaurantsResult {
  restaurants: RestaurantSummary[];
  currentRestaurantId: UUID | null;
  limits: {
    ownedLimit: number;
    joinedLimit: number;
    freeMemberLimit: number;
  };
}

export interface CreateRestaurantRequest {
  name: string;
  operationId: UUID;
}

export interface CreateRestaurantResult {
  restaurant: RestaurantSummary;
  ownerMember: RestaurantMemberSummary;
}

export interface RestaurantMembersResult {
  restaurantId: UUID;
  members: RestaurantMemberSummary[];
}

export interface CreateInviteRequest {
  restaurantId: UUID;
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
  restaurant: RestaurantSummary;
  member: RestaurantMemberSummary;
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

export interface AdminListRestaurantsQuery extends PageQuery {
  keyword?: string;
  status?: string;
}

export type AdminListRestaurantsResult = PageResult<RestaurantSummary>;
