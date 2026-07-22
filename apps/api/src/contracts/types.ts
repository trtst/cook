export type UUID = string;
export type IsoDateTime = string;

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  serverTime: IsoDateTime;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface UserBasic {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
}

export interface UserSummary {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface UserProfile extends UserBasic {
  id: UUID;
  status: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface PasswordLoginRequest {
  phone: string;
  password: string;
}

export interface PasswordLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  user: UserBasic;
}

export interface RefreshSessionResult {
  token: string;
  expiresAt: IsoDateTime;
}

export interface UpdateCurrentUserRequest {
  nickname?: string;
  avatarUrl?: string;
}

export interface ChangeCurrentPasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangeCurrentPasswordResult {
  changedAt: IsoDateTime;
}

export interface TasteProfileResponse {
  allergies: string[];
  strictDislikes: string[];
  dislikedIngredients: string[];
  flavorPreferences: string[];
  note: string | null;
  updatedAt: IsoDateTime;
}

export interface UpdateTasteProfileRequest {
  allergies: string[];
  strictDislikes: string[];
  dislikedIngredients: string[];
  flavorPreferences: string[];
  note: string | null;
}

export type DiningGroupRole = "OWNER" | "ADMIN" | "MEMBER";
export type DiningGroupStatus = "ACTIVE" | "FROZEN" | "ARCHIVED";
export type LongTermMemberStatus = "ACTIVE" | "RESTRICTED" | "ENDED";
export type LongTermMemberStatusReason = "LEFT" | "REMOVED" | "GROUP_DOWNGRADED" | "GROUP_DISSOLVED";
export type OriginalSpaceStatus = "ACTIVE" | "FROZEN";
export type CarryBackSnapshotStatus = "AVAILABLE" | "EXPIRED" | "DELETED" | "INVALIDATED";
export type SpaceState = "NORMAL" | "OVER_RECIPE_LIMIT" | "OVER_STORAGE_READONLY";

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
  state: SpaceState;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

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

export interface CreateInviteResult {
  inviteToken: string;
  sharePath: string;
  expiresAt: IsoDateTime;
}

export interface AcceptInviteResponse {
  currentSpace: CurrentSpaceSummary;
  originalSpace: CurrentOriginalSpaceSummary;
  pendingImportCounts: PendingImportCounts;
}

export interface LeaveDiningGroupResponse {
  restoredSpace: CurrentSpaceSummary;
  carryBackSnapshot: CarryBackSnapshotSummary | null;
  futureParticipationCount: number;
}

export interface GetCarryBackSnapshotsResponse {
  snapshots: CarryBackSnapshotSummary[];
}

export interface AdminDiningGroupSummary {
  id: UUID;
  name: string;
  ownerId: UUID;
  status: DiningGroupStatus;
  version: number;
  memberCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminUserEntitlementResponse {
  user: Pick<UserProfile, "id" | "uid" | "nickname" | "status">;
  currentSpace: {
    id: UUID;
    name: string;
  };
  entitlements: EffectiveEntitlementSnapshot;
}
