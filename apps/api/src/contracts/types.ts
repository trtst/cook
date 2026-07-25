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

export interface SessionUser {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface UserDisplay {
  profileBackgroundUrl: string | null;
  homeBackgroundUrl: string | null;
  canUseProfileBackground: boolean;
  canUseHomeBackground: boolean;
}

export interface UserMembership {
  tier: EntitlementTier;
  validUntil: IsoDateTime | null;
}

export interface MeResponse extends SessionUser {
  phone: string | null;
  display: UserDisplay;
  membership: UserMembership;
}

export interface UserSummary {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface UserProfile extends SessionUser {
  id: UUID;
  phone: string | null;
  status: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface PasswordLoginRequest {
  phone: string;
  password: string;
}

export interface CodeLoginRequest {
  phone: string;
  code: string;
}

export interface PasswordLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  user: SessionUser;
}

export interface CodeLoginResult {
  token: string;
  expiresAt: IsoDateTime;
  user: SessionUser;
}

export interface RefreshSessionResult {
  token: string;
  expiresAt: IsoDateTime;
}

export interface LoginImageConfig {
  imageUrl: string | null;
}

export interface AppConfigResponse {
  login: LoginImageConfig;
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
export type DiningGroupStatus = "ACTIVE" | "ARCHIVED";
export type LongTermMemberStatus = "ACTIVE" | "RESTRICTED" | "ENDED";
export type LongTermMemberStatusReason =
  | "LEFT"
  | "REMOVED"
  | "USER_OVER_LIMIT"
  | "OWNER_OVER_LIMIT"
  | "GROUP_DISSOLVED";
export type RelationshipState = "NORMAL" | "OVER_MEMBER_LIMIT";
export type EntitlementTier = "FREE" | "PLUS" | "PRO" | "ULTRA";
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
  state: RelationshipState;
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

export interface EffectiveImagePolicy {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  maxOutputBytes: number;
  maxInputBytes: number;
}

export interface ResolvedPolicy {
  tier: EntitlementTier;
  validUntil: IsoDateTime | null;
  recipeLimit: number;
  inviteLimit: number;
  joinLimit: number;
  memberLimit: number;
  storageLimitBytes: number;
  recycleDays: number;
  variantLimitPerRoot: number;
  imagePolicy: EffectiveImagePolicy;
  ownedDiningGroupCount: number;
  joinedDiningGroupCount: number;
  state: RelationshipState;
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
  state: RelationshipState;
}

export interface GetMyDiningGroupsResponse {
  items: DiningGroupSummary[];
  usage: DiningGroupUsageSummary;
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
  diningGroup: DiningGroupSummary;
}

export interface LeaveDiningGroupResponse {
  diningGroupId: UUID;
  leftAt: IsoDateTime;
}

export interface RemoveDiningGroupMemberResponse {
  diningGroupId: UUID;
  userId: UUID;
  removedAt: IsoDateTime;
}

export interface DissolveDiningGroupResponse {
  diningGroupId: UUID;
  dissolvedAt: IsoDateTime;
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
  membership: UserMembership;
  display: Pick<UserDisplay, "canUseProfileBackground" | "canUseHomeBackground">;
  diningGroupUsage: DiningGroupUsageSummary;
  diningGroups: DiningGroupSummary[];
  storage: StorageUsageSummary;
  recipePolicy: Pick<ResolvedPolicy, "recipeLimit" | "recycleDays" | "variantLimitPerRoot">;
  invitePolicy: Pick<ResolvedPolicy, "inviteLimit" | "memberLimit">;
  imagePolicy: EffectiveImagePolicy;
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

export interface RecipeIngredientInput {
  name: string;
  amount: string;
}

export interface RecipeStepInput {
  content: string;
}

export interface RecipeImageInput {
  key: string;
  url: string;
  sizeBytes: number;
}

export interface RecipeContentInput {
  name: string;
  ingredients: RecipeIngredientInput[];
  steps: RecipeStepInput[];
  servings: string | null;
  durationMinutes: number | null;
}

export interface RecipeContentPayload extends RecipeContentInput {
  images: RecipeImageInput[];
}

export interface RecipeSummary {
  id: UUID;
  ownerType: "USER" | "SYSTEM";
  title: string;
  coverImageUrl: string | null;
  sourceRecipeId: UUID | null;
  isCustomized: boolean;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  updatedAt: IsoDateTime;
}

export interface RecipeDetail extends RecipeSummary {
  ownerUid: number | null;
  content: RecipeContentPayload;
  hiddenBaseImages: string[];
  canEdit: boolean;
  canImport: boolean;
  version: number;
  createdAt: IsoDateTime;
}

export interface RecipeListResult {
  items: RecipeSummary[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface ImportRecipeResult {
  recipe: RecipeDetail;
  reusedExisting: boolean;
}

export interface DeleteRecipeResponse {
  recipeId: UUID;
  status: "RECYCLED" | "DELETED";
  deletedAt: IsoDateTime;
  recycledUntil: IsoDateTime | null;
}

export interface RecipeReportSummary {
  id: UUID;
  recipeId: UUID;
  reporterUid: number;
  reason: string;
  status: "OPEN" | "RESOLVED";
  createdAt: IsoDateTime;
}

export interface AdminRecipeSummary extends RecipeSummary {
  ownerUid: number | null;
  reportCount: number;
  blockedReason: string | null;
}

export interface MealPlanSummary {
  id: UUID;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  hasDiningEvent: boolean;
  diningEventId: UUID | null;
  createdAt: IsoDateTime;
}

export interface DiningEventParticipantSummary {
  id: UUID;
  userUid: number | null;
  guestName: string | null;
  sourceType: "DINING_GROUP" | "SHARE";
  status: "INVITED" | "ACCEPTED" | "DECLINED" | "REMOVED";
  bringRecipeId: UUID | null;
  bringRecipeTitle: string | null;
}

export interface DiningEventSummary {
  id: UUID;
  title: string;
  scheduledAt: IsoDateTime;
  location: string | null;
  status: "PLANNED" | "CONFIRMED" | "CANCELLED";
  planItemId: UUID | null;
  diningGroupId: UUID | null;
  menu: RecipeContentPayload;
  participants: DiningEventParticipantSummary[];
  shareTokenPath: string | null;
  createdAt: IsoDateTime;
}

export interface FridgeItemSummary {
  id: UUID;
  name: string;
  quantityText: string | null;
  note: string | null;
  available: boolean;
  updatedAt: IsoDateTime;
}

export interface ShoppingItemSummary {
  id: UUID;
  name: string;
  quantityText: string | null;
  note: string | null;
  sourceType: "MANUAL" | "PLAN" | "EVENT" | "BRING";
  sourceKey: string | null;
  status: "OPEN" | "BOUGHT" | "DELETED";
  updatedAt: IsoDateTime;
}

export interface SharePreviewResponse {
  title: string;
  scheduledAt: IsoDateTime;
  location: string | null;
  menu: Pick<RecipeContentPayload, "name" | "ingredients" | "images">;
  organizerUid: number;
}
