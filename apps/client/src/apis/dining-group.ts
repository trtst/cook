/**
 * 饭搭子域接口与核心 DTO。
 *
 * 这一层承担两件事：
 * 1. 暴露页面和 store 需要的当前空间、成员、邀请、退出等接口。
 * 2. 集中保存这些接口当前真实返回的结构，避免页面散落字面量字段。
 *
 * 这里不做业务状态推导，例如“是否可导入/是否应展示某个入口”，
 * 那些判断应该留在页面或 store，根据真实字段组合得出。
 */
import { cfg } from "@/config";
import { get, post, type IsoDateTime, type UUID } from "./http";
import type { UserSummary } from "./user";

export type DiningGroupRole = "OWNER" | "ADMIN" | "MEMBER";
export type LongTermMemberStatus = "ACTIVE" | "RESTRICTED" | "ENDED";
export type LongTermMemberStatusReason = "LEFT" | "REMOVED" | "GROUP_DOWNGRADED" | "GROUP_DISSOLVED";
export type OriginalSpaceStatus = "ACTIVE" | "FROZEN";
export type CarryBackSnapshotStatus = "AVAILABLE" | "EXPIRED" | "DELETED" | "INVALIDATED";
export type SpaceState = "NORMAL" | "OVER_RECIPE_LIMIT" | "OVER_STORAGE_READONLY";
export type EntitlementTier = "FREE" | "PLUS";
export type EntitlementScope = "USER" | "DINING_GROUP";
export type StorageModule =
	| "RECIPE"
	| "FRIDGE"
	| "MEAL"
	| "SHOPPING"
	| "MEAL_GUEST"
	| "TECHNICAL_SNAPSHOT"
	| "RECYCLE_BIN";

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

export interface PendingImportCounts {
	recipe: number;
	fridgeItem: number;
	planDraft: number;
	shoppingItem: number;
}

export interface CurrentSpaceSummary {
	id: UUID;
	name: string;
	ownerUid: number;
	myRole: DiningGroupRole;
	myStatus: LongTermMemberStatus;
	myStatusReason: LongTermMemberStatusReason | null;
	memberCount: number;
	memberLimit: number;
	recipeCount: number;
	isShared: boolean;
	sharedSince: IsoDateTime | null;
	sharedDays: number | null;
	state: SpaceState;
	version: number;
	createdAt: IsoDateTime;
	updatedAt: IsoDateTime;
}

/**
 * 原空间在当前产品规则里可能为 null，也可能冻结存在。
 * 调用方必须按返回值显式判断，不能假设用户永远处于单人空间或共享空间。
 */
export interface OriginalSpaceSummary {
	id: UUID;
	name: string;
	status: OriginalSpaceStatus;
	frozenAt: IsoDateTime | null;
	canImport: boolean;
	pendingImportCounts: PendingImportCounts;
}

export interface CurrentOriginalSpaceSummary {
	status: OriginalSpaceStatus;
	canImport: boolean;
}

export interface CarryBackSnapshotSummary {
	id: UUID;
	sourceDiningGroupId: UUID;
	sourceDiningGroupName: string;
	status: CarryBackSnapshotStatus;
	expiresAt: IsoDateTime;
	createdAt: IsoDateTime;
	itemCounts: {
		recipe: number;
		fridgeItem: number;
		shoppingItem: number;
	};
}

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

/**
 * 存储使用量是当前空间视角，而不是个人视角。
 * 后续页面若展示超限态，需要以这里的 state/used/limit 为准，不应自行估算。
 */
export interface StorageUsageSummary {
	state: SpaceState;
	usedBytes: number;
	limitBytes: number;
	remainingBytes: number;
	byModule: Array<{
		module: StorageModule;
		usedBytes: number;
	}>;
}

export interface GetCurrentDiningGroupContextResponse {
	currentSpace: CurrentSpaceSummary;
	originalSpace: CurrentOriginalSpaceSummary | null;
	entitlements: EffectiveEntitlementSnapshot;
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

export interface AcceptInviteResponse {
	currentSpace: CurrentSpaceSummary;
	originalSpace: CurrentOriginalSpaceSummary;
	pendingImportCounts: PendingImportCounts;
}

export interface LeaveDiningGroupRequest {
	operationId: UUID;
}

export interface LeaveDiningGroupResponse {
	restoredSpace: CurrentSpaceSummary;
	carryBackSnapshot: CarryBackSnapshotSummary | null;
	futureParticipationCount: number;
}

export const diningGroupApi = {
	getCurrent() {
		return get<GetCurrentDiningGroupContextResponse>(`${cfg.domain}/api/dining-groups/current`);
	},
	/**
	 * 成员列表依赖服务端当前空间权限校验。
	 * 这里即使传入 diningGroupId，也只是把参数透传给后端，不代表前端拥有跨空间查询能力。
	 */
	listMembers(diningGroupId: UUID) {
		return get<DiningGroupMembersResult>(`${cfg.domain}/api/dining-group-members`, { diningGroupId });
	},
	createInvite(body: CreateInviteRequest) {
		return post<CreateInviteResult>(`${cfg.domain}/api/dining-group-invites`, body);
	},
	/**
	 * 动态 token 属于 path 参数的一部分，必须先做 encode。
	 * 这里直接写完整地址，读代码时可以立刻看出真实请求路径。
	 */
	acceptInvite(inviteToken: string, body: AcceptInviteRequest) {
		return post<AcceptInviteResponse>(`${cfg.domain}/api/dining-group-invites/${encodeURIComponent(inviteToken)}/accept`, body);
	},
	leave(diningGroupId: UUID, body: LeaveDiningGroupRequest) {
		return post<LeaveDiningGroupResponse>(`${cfg.domain}/api/dining-groups/${encodeURIComponent(diningGroupId)}/leave`, body);
	}
};
