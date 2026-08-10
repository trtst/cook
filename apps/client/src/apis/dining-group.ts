import { cfg } from "@/config";
import { get, post, put, uploadFile, type IsoDateTime, type OperationId, type UUID } from "./http";
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
  description: string | null;
  coverImageUrl: string | null;
  ownerUid: number;
  isOwned: boolean;
  canManageCover: boolean;
  myRole: DiningGroupRole;
  myStatus: LongTermMemberStatus;
  myStatusReason: LongTermMemberStatusReason | null;
  createdDays: number;
  memberCount: number;
  memberLimit: number;
  pollCount: number;
  diningEventCount: number;
  hasAttention: boolean;
  latestActivityTitle: string | null;
  latestActivityAt: IsoDateTime | null;
  state: DiningGroupState;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface DiningGroupMemberSummary {
  id: UUID;
  diningGroupId: UUID;
  userId: UUID;
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

export interface DiningGroupEditorPayload {
  name: string;
  description: string | null;
}

export interface CreateDiningGroupRequest extends DiningGroupEditorPayload {
  operationId: OperationId;
}

export interface CreateDiningGroupResponse {
  diningGroup: DiningGroupSummary;
}

export interface CreateInviteRequest {
  diningGroupId: UUID;
  operationId: OperationId;
}

export interface CreateInviteResult {
  inviteToken: string;
  sharePath: string;
  expiresAt: IsoDateTime;
}

export interface AcceptInviteRequest {
  operationId: OperationId;
}

export interface AcceptInviteResponse {
  diningGroup: DiningGroupSummary;
}

export interface UpdateDiningGroupRequest extends DiningGroupEditorPayload {
  operationId: OperationId;
  expectedVersion: number;
}

export interface UpdateDiningGroupResponse {
  diningGroup: DiningGroupSummary;
}

export interface UpdateDiningGroupCoverRequest {
  diningGroupId: UUID;
  expectedVersion: number;
  filePath: string;
  operationId: OperationId;
}

export interface UpdateDiningGroupCoverResponse {
  diningGroup: DiningGroupSummary;
}

export interface LeaveDiningGroupRequest {
  operationId: OperationId;
  expectedVersion: number;
}

export interface LeaveDiningGroupResponse {
  diningGroupId: UUID;
  leftAt: IsoDateTime;
}

export interface DissolveDiningGroupRequest {
  operationId: OperationId;
  expectedVersion: number;
}

export interface DissolveDiningGroupResponse {
  diningGroupId: UUID;
  dissolvedAt: IsoDateTime;
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
   * 显式开启饭搭子，并创建当前用户主理的第一个关系。
   */
  create(body: CreateDiningGroupRequest) {
    return post<CreateDiningGroupResponse>(
      `${cfg.domain}/api/dining-groups`,
      {
        name: body.name,
        description: body.description
      },
      { idempotencyKey: body.operationId }
    );
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
    return post<CreateInviteResult>(
      `${cfg.domain}/api/dining-group-invites`,
      { diningGroupId: body.diningGroupId },
      { idempotencyKey: body.operationId }
    );
  },
  /**
   * 接受饭搭子邀请并建立成员关系。
   * 接受邀请不影响接受人的个人菜谱、冰箱、计划和购物清单。
   */
  acceptInvite(inviteToken: string, body: AcceptInviteRequest) {
    return post<AcceptInviteResponse>(
      `${cfg.domain}/api/dining-group-invites/${encodeURIComponent(inviteToken)}/accept`,
      undefined,
      { idempotencyKey: body.operationId }
    );
  },
  /**
   * 当前主理人更新饭搭子的名称和简介。
   */
  update(diningGroupId: UUID, body: UpdateDiningGroupRequest) {
    return put<UpdateDiningGroupResponse>(
      `${cfg.domain}/api/dining-groups/${encodeURIComponent(String(diningGroupId))}`,
      {
        name: body.name,
        description: body.description,
        expectedVersion: body.expectedVersion
      },
      { idempotencyKey: body.operationId }
    );
  },
  async updateCover(body: UpdateDiningGroupCoverRequest) {
    const result = await uploadFile({
      url: `${cfg.domain}/api/dining-groups/${encodeURIComponent(String(body.diningGroupId))}/cover`,
      filePath: body.filePath,
      name: "file",
      headers: {
        "Idempotency-Key": body.operationId
      },
      formData: {
        expectedVersion: body.expectedVersion
      }
    });
    const payload = result.body as {
      code?: number;
      message?: string;
      data?: UpdateDiningGroupCoverResponse;
    } | null;
    if (!payload || typeof payload.code !== "number") {
      throw new Error("主图上传响应格式不正确");
    }
    if (result.status < 200 || result.status >= 300 || payload.code !== 0 || !payload.data) {
      throw new Error(payload.message || "主图上传失败");
    }
    return payload.data;
  },
  /**
   * 当前用户退出指定饭搭子关系。
   * 只结束成员关系，不恢复旧空间或生成个人数据快照。
   */
  leave(diningGroupId: UUID, body: LeaveDiningGroupRequest) {
    return post<LeaveDiningGroupResponse>(
      `${cfg.domain}/api/dining-groups/${encodeURIComponent(String(diningGroupId))}/leave`,
      { expectedVersion: body.expectedVersion },
      { idempotencyKey: body.operationId }
    );
  },
  dissolve(diningGroupId: UUID, body: DissolveDiningGroupRequest) {
    return post<DissolveDiningGroupResponse>(
      `${cfg.domain}/api/dining-groups/${encodeURIComponent(String(diningGroupId))}/dissolve`,
      { expectedVersion: body.expectedVersion },
      { idempotencyKey: body.operationId }
    );
  }
};
