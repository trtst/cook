import type {
  CarryBackSnapshotSummary,
  CarryBackItem,
  CarryItemType,
  CurrentSpaceSummary,
  EffectiveEntitlementSnapshot,
  GuestInvitationAction,
  ImportableItem,
  ImportableItemType,
  IsoDateTime,
  MealGuestInvitationSummary,
  OriginalSpaceSummary,
  PageQuery,
  PageResult,
  PendingImportCounts,
  RecipeContentInput,
  RecipeSummary,
  SpaceState,
  StorageUsageSummary,
  DiningGroupMemberSummary,
  AdminDiningGroupSummary,
  UserBasic,
  UserProfile,
  UUID
} from "./types";

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
  originalSpace: OriginalSpaceSummary;
  pendingImportCounts: PendingImportCounts;
}

export interface GetCurrentDiningGroupContextResponse {
  currentSpace: CurrentSpaceSummary;
  originalSpace: OriginalSpaceSummary | null;
  carryBackSnapshots: CarryBackSnapshotSummary[];
  entitlements: EffectiveEntitlementSnapshot;
  storage: StorageUsageSummary;
}

export interface LeaveDiningGroupRequest {
  operationId: UUID;
}

export interface LeaveDiningGroupResponse {
  restoredSpace: CurrentSpaceSummary;
  carryBackSnapshot: CarryBackSnapshotSummary | null;
  futureParticipationCount: number;
}

export interface GetOriginalSpaceImportableDataQuery extends PageQuery {
  itemType: ImportableItemType;
}

export interface GetOriginalSpaceImportableDataResponse extends PageResult<ImportableItem> {
  originalSpaceId: UUID;
}

export interface OriginalSpaceImportSelection {
  itemType: ImportableItemType;
  itemId: UUID;
}

export interface ImportOriginalSpaceDataRequest {
  operationId: UUID;
  selections: OriginalSpaceImportSelection[];
}

export interface ImportOriginalSpaceDataResponse {
  importedCount: number;
  skippedCount: number;
  state: SpaceState;
  usedBytes: number;
  limitBytes: number;
}

export interface GetCarryBackSnapshotsResponse {
  snapshots: CarryBackSnapshotSummary[];
}

export interface CarryItemsQuery extends PageQuery {
  snapshotId: UUID;
  itemType: CarryItemType;
}

export type CarryItemsResponse = PageResult<CarryBackItem>;

export interface CarryBackImportSelection {
  itemType: "RECIPE" | "FRIDGE_ITEM" | "SHOPPING_ITEM";
  itemId: UUID;
}

export interface ImportCarryBackSnapshotRequest {
  operationId: UUID;
  selections: CarryBackImportSelection[];
}

export interface ImportCarryBackSnapshotResponse {
  importedCount: number;
  skippedCount: number;
  state: SpaceState;
  usedBytes: number;
  limitBytes: number;
}

export type GetCurrentEntitlementsResponse = EffectiveEntitlementSnapshot;

export type GetStorageUsageResponse = StorageUsageSummary;

export interface UpdateTasteProfileRequest {
  allergies: string[];
  strictDislikes: string[];
  dislikedIngredients: string[];
  flavorPreferences: string[];
  note: string | null;
}

export interface CreateMealGuestInvitationsRequest {
  operationId: UUID;
  guestUserIds: UUID[];
}

export interface TasteSnapshotInput {
  allergies: string[];
  strictDislikes: string[];
  dislikedIngredients: string[];
  flavorPreferences: string[];
  note: string | null;
}

export interface RespondMealGuestInvitationRequest {
  operationId: UUID;
  action: GuestInvitationAction;
  tasteSnapshot: TasteSnapshotInput | null;
}

export interface CreateMealGuestInvitationsResponse {
  invitations: MealGuestInvitationSummary[];
}

export interface RespondMealGuestInvitationResponse {
  invitation: MealGuestInvitationSummary;
}

export interface CreateRecipeRequest {
  operationId: UUID;
  name: string;
  category: string | null;
  note: string | null;
  coverAssetId: UUID | null;
  sourceVersionId: UUID | null;
  content: RecipeContentInput;
}

export interface UpdateRecipeRequest {
  operationId: UUID;
  version: number;
  name: string;
  category: string | null;
  note: string | null;
  coverAssetId: UUID | null;
  baseVersionId: UUID;
  content: RecipeContentInput;
}

export interface RecipeDetailResponse extends RecipeSummary {
  category: string | null;
  note: string | null;
  content: RecipeContentInput;
  variantSummary: {
    rootRecipeId: UUID | null;
    variantCount: number;
    variantLimit: number;
    canCreateVariant: boolean;
  };
}

export interface RecipeImportRequest {
  operationId: UUID;
  sourceType: "SYSTEM" | "PUBLIC";
  sourceVersionId: UUID;
}

export interface RecipeImportResponse {
  recipe: RecipeSummary;
  duplicateState: "CREATED" | "OPENED_EXISTING";
}

export interface CreateRecipeVariantRequest {
  operationId: UUID;
  rootRecipeId: UUID;
  variantName: string;
}

export interface CreateRecipeVariantResponse {
  recipe: RecipeSummary;
  variantCount: number;
  variantLimit: number;
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

export type AdminListDiningGroupsResult = PageResult<AdminDiningGroupSummary>;

export interface AdminUserEntitlementResponse {
  user: Pick<UserProfile, "id" | "uid" | "nickname" | "status">;
  currentSpace: {
    id: UUID;
    name: string;
  };
  entitlements: EffectiveEntitlementSnapshot;
}
