import { cfg } from "@/config";
import { get, post, type IsoDateTime, type UUID } from "./http";
import type { UserSummary } from "./user";

export type DiningGroupRole = "OWNER" | "ADMIN" | "MEMBER";
export type LongTermMemberStatus = "ACTIVE" | "RESTRICTED" | "ENDED";
export type LongTermMemberStatusReason =
  | "LEFT"
  | "REMOVED"
  | "USER_OVER_LIMIT"
  | "OWNER_OVER_LIMIT"
  | "GROUP_DISSOLVED";
export type DiningGroupState = "NORMAL" | "OVER_MEMBER_LIMIT";
export type StorageModule =
  | "RECIPE"
  | "FRIDGE"
  | "MEAL"
  | "SHOPPING"
  | "MEAL_GUEST"
  | "TECHNICAL_SNAPSHOT"
  | "RECYCLE_BIN"
  | "PROFILE_ASSET";

export interface DiningGroupSummary {
  id: UUID;
  name: string;
  ownerUid: number;
  isOwned: boolean;
  myRole: DiningGroupRole;
  myStatus: LongTermMemberStatus;
  myStatusReason: LongTermMemberStatusReason | null;
  memberCount: number;
  memberLimit: number;
  state: DiningGroupState;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface DiningGroupMemberSummary {
  id: UUID;
  diningGroupId: UUID;
  user: UserSummary;
  role: DiningGroupRole;
  status: LongTermMemberStatus;
  statusReason: LongTermMemberStatusReason | null;
  joinedAt: IsoDateTime;
  restrictedAt: IsoDateTime | null;
  endedAt: IsoDateTime | null;
  version: number;
}

export interface StorageUsageSummary {
  state: "NORMAL" | "OVER_STORAGE_READONLY";
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  byModule: Array<{
    module: StorageModule;
    usedBytes: number;
  }>;
  calculatedAt: IsoDateTime;
}

export interface DiningGroupUsageSummary {
  ownedCount: number;
  joinedCount: number;
  joinLimit: number;
  state: DiningGroupState;
}

export interface GetMyDiningGroupsResponse {
  items: DiningGroupSummary[];
  usage: DiningGroupUsageSummary;
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

export interface AcceptInviteResponse {
  diningGroup: DiningGroupSummary;
}

export interface LeaveDiningGroupRequest {
  operationId: UUID;
  expectedVersion: number;
}

export interface LeaveDiningGroupResponse {
  diningGroupId: UUID;
  leftAt: IsoDateTime;
}

export interface DiningGroupMembersResult {
  diningGroupId: UUID;
  members: DiningGroupMemberSummary[];
}

export const diningGroupApi = {
  /**
   * 读取当前用户主理或加入的饭搭子关系列表。
   * 返回关系用量，不负责切换个人菜谱、冰箱、计划或购物数据归属。
   */
  getMine() {
    return get<GetMyDiningGroupsResponse>(`${cfg.domain}/api/dining-groups`);
  },
  /**
   * 读取当前用户个人存储用量。
   * 用于展示容量状态和各模块占用，不属于饭搭子共享空间。
   */
  getStorageUsage() {
    return get<StorageUsageSummary>(`${cfg.domain}/api/storage-usage`);
  },
  /**
   * 读取指定饭搭子关系的成员列表。
   * 调用人必须已经是该关系的有效成员。
   */
  listMembers(diningGroupId: UUID) {
    return get<DiningGroupMembersResult>(`${cfg.domain}/api/dining-group-members`, { diningGroupId });
  },
  /**
   * 为指定饭搭子关系创建邀请。
   * 只生成邀请 token 和分享路径，不复制或迁移任何个人数据。
   */
  createInvite(body: CreateInviteRequest) {
    return post<CreateInviteResult>(`${cfg.domain}/api/dining-group-invites`, body);
  },
  /**
   * 接受饭搭子邀请并建立成员关系。
   * 接受邀请不影响接受人的个人菜谱、冰箱、计划和购物清单。
   */
  acceptInvite(inviteToken: string, body: AcceptInviteRequest) {
    return post<AcceptInviteResponse>(`${cfg.domain}/api/dining-group-invites/${encodeURIComponent(inviteToken)}/accept`, body);
  },
  /**
   * 当前用户退出指定饭搭子关系。
   * 只结束成员关系，不恢复旧空间或生成个人数据快照。
   */
  leave(diningGroupId: UUID, body: LeaveDiningGroupRequest) {
    return post<LeaveDiningGroupResponse>(`${cfg.domain}/api/dining-groups/${encodeURIComponent(diningGroupId)}/leave`, body);
  }
};
