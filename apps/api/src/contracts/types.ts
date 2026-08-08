export type UUID = number;
export type ResourceId = UUID;
export type OperationId = string;
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

export type HomeEntryPlacement = "MAIN" | "SIDE_TOP" | "SIDE_BOTTOM" | "QUICK_1" | "QUICK_2" | "QUICK_3" | "QUICK_4";
export type HomeEntryTargetType = "PAGE" | "WEB_VIEW";

export interface HomeEntryItem {
  id: string;
  placement: HomeEntryPlacement;
  title: string;
  subtitle: string | null;
  targetType: HomeEntryTargetType;
  targetValue: string;
  imageUrl: string | null;
  badgeText: string | null;
}

export interface HomeEntriesResponse {
  items: HomeEntryItem[];
}

export interface AdminHomeEntryItem extends HomeEntryItem {
  version: number;
}

export interface HomeEntryPageTarget {
  label: string;
  value: string;
}

export interface AdminHomeEntriesResponse {
  items: AdminHomeEntryItem[];
  pageTargets: HomeEntryPageTarget[];
}

export interface UpdateHomeEntryItemRequest {
  placement: HomeEntryPlacement;
  title: string;
  subtitle: string | null;
  targetType: HomeEntryTargetType;
  targetValue: string;
  imageUrl: string | null;
  badgeText: string | null;
  expectedVersion: number;
}

export interface UpdateHomeEntriesRequest {
  items: UpdateHomeEntryItemRequest[];
}

export type TableTopicStatus = "LISTED" | "UNLISTED";
export type TableTopicTargetType = "PAGE" | "WEB_VIEW";

export interface TableTopicListItem {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  activityAt: IsoDateTime;
  participantCount: number;
}

export interface TableTopicDetail {
  id: UUID;
  title: string;
  summary: string;
  coverImageUrl: string | null;
  activityAt: IsoDateTime;
  participantCount: number;
  joined: boolean;
  targetType: TableTopicTargetType;
  targetValue: string | null;
}

export interface TableTopicListResponse {
  items: TableTopicListItem[];
}

export interface TableTopicDetailResponse {
  topic: TableTopicDetail;
}

export interface AdminTableTopicItem {
  id: UUID;
  title: string;
  summary: string;
  coverImageUrl: string | null;
  activityAt: IsoDateTime;
  participantCount: number;
  targetType: TableTopicTargetType;
  targetValue: string | null;
  status: TableTopicStatus;
  version: number;
  updatedAt: IsoDateTime;
}

export interface AdminTableTopicsResponse {
  topics: AdminTableTopicItem[];
}

export interface CreateTableTopicRequest {
  title: string;
  summary: string;
  activityAt: IsoDateTime;
  targetType: TableTopicTargetType;
  targetValue: string | null;
}

export interface UpdateTableTopicRequest extends CreateTableTopicRequest {
  expectedVersion: number;
}

export interface SetTableTopicStatusRequest {
  status: TableTopicStatus;
  expectedVersion: number;
}

export type HomeTopicType =
  | "WEEKEND_GATHERING"
  | "QUICK_AFTER_WORK"
  | "HOME_STYLE"
  | "ONE_PERSON"
  | "BREAKFAST"
  | "LIGHT_DINNER";
export type HomeTopicStatus = "LISTED" | "UNLISTED";

export interface HomeTopicTypeOption {
  label: string;
  value: HomeTopicType;
}

export interface HomeTopicRecipeItem {
  id: UUID;
  sourceVersionId: UUID;
  sort: number;
  title: string;
  coverImageUrl: string | null;
  ownedRecipeId: UUID | null;
  recommendNote: string | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  difficultyText: string | null;
  durationText: string | null;
  category: InspirationCategorySummary;
  likeCount: number;
  collectCount: number;
  updatedAt: IsoDateTime;
}

export interface HomeTopicHistoryItem {
  id: UUID;
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  recTypeText: string;
  issueNo: number;
  description: string;
  coverImageUrl: string | null;
  recipeCount: number;
  publishedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface HomeTopicDetail {
  id: UUID;
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  recTypeText: string;
  issueNo: number;
  description: string;
  coverImageUrl: string | null;
  recipeCount: number;
  publishedAt: IsoDateTime;
  updatedAt: IsoDateTime;
  items: HomeTopicRecipeItem[];
  history: HomeTopicHistoryItem[];
}

export interface HomeTopicCurrentResponse {
  topic: HomeTopicDetail | null;
}

export interface HomeTopicDetailResponse {
  topic: HomeTopicDetail;
}

export interface AdminHomeTopicItem {
  id: UUID;
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  recTypeText: string;
  status: HomeTopicStatus;
  issueNo: number;
  description: string;
  coverImageUrl: string | null;
  recipeCount: number;
  publishedAt: IsoDateTime;
  updatedAt: IsoDateTime;
  items: HomeTopicRecipeItem[];
  version: number;
}

export interface AdminHomeTopicsResponse {
  topics: AdminHomeTopicItem[];
  recTypes: HomeTopicTypeOption[];
}

export interface CreateHomeTopicRequest {
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  issueNo: number;
  description: string;
  recipeIds: UUID[];
}

export interface UpdateHomeTopicRequest extends CreateHomeTopicRequest {
  expectedVersion: number;
}

export interface SetHomeTopicStatusRequest {
  status: HomeTopicStatus;
  expectedVersion: number;
}

export interface HomeTopicRecipeQuery {
  keyword?: string;
}

export interface HomeTopicRecipeSearchResponse {
  items: HomeTopicRecipeItem[];
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

export interface AdminDashboardSummary {
  user: {
    total: number;
    activeCount: number;
    disabledCount: number;
  };
  diningGroup: {
    total: number;
    activeCount: number;
    memberCount: number;
  };
  recipe: {
    total: number;
    activeCount: number;
    blockedCount: number;
    recycledCount: number;
    openReportCount: number;
  };
  ingredient: {
    categoryCount: number;
    itemCount: number;
    unitCount: number;
  };
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
  operationId: OperationId;
  phone: string;
  password: string;
  nickname?: string;
  status?: "ACTIVE" | "DISABLED";
}

export interface UpdateAdminUserRequest {
  operationId: OperationId;
  phone?: string;
  nickname?: string;
}

export interface SetAdminUserStatusRequest {
  operationId: OperationId;
  status: "ACTIVE" | "DISABLED";
}

export interface ResetAdminUserPasswordRequest {
  operationId: OperationId;
  newPassword: string;
}

export interface AdminIngredientCategoryPayloadRequest {
  operationId: OperationId;
  name: string;
}

export interface UpdateAdminIngredientCategoryRequest extends AdminIngredientCategoryPayloadRequest {
  expectedVersion: number;
}

export interface AdminIngredientPayloadRequest {
  operationId: OperationId;
  name: string;
  categoryId: UUID;
  defaultUnitId: UUID;
}

export interface UpdateAdminIngredientRequest extends AdminIngredientPayloadRequest {
  expectedVersion: number;
}

export interface SetAdminIngredientStatusRequest {
  operationId: OperationId;
  expectedVersion: number;
  status: "ACTIVE" | "DISABLED";
}

export type AdminIngredientReviewAction = "APPROVE_CREATE" | "APPROVE_MERGE" | "REJECT";
export type AdminIngredientRejectReasonCode =
  | "NAME_NOT_CLEAR"
  | "NAME_HAS_BRAND"
  | "CATEGORY_NOT_FIT"
  | "UNIT_NOT_FIT"
  | "OUT_OF_SCOPE"
  | "OTHER";

export interface AdminReviewPendingIngredientRequest {
  operationId: OperationId;
  action: AdminIngredientReviewAction;
  expectedVersion: number;
  name?: string;
  categoryId?: UUID;
  defaultUnitId?: UUID;
  targetIngredientId?: UUID;
  rejectReasonCode?: AdminIngredientRejectReasonCode;
  reason?: string;
}

export interface AdminUnitPayloadRequest {
  operationId: OperationId;
  name: string;
  type: UnitType;
}

export interface UpdateAdminUnitRequest extends AdminUnitPayloadRequest {
  expectedVersion: number;
}

export interface AdminResetUserPasswordResponse {
  userId: UUID;
  resetAt: IsoDateTime;
}

export type RecipeDifficulty = "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING";
export type RecipeDuration = "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60";
export type UnitType = "WEIGHT" | "VOLUME" | "COUNT" | "SHAPE" | "CONTAINER" | "PACKAGE" | "OTHER";
export type IngredientSource = "SYSTEM" | "PERSONAL";
export type InspirationSort = "RECOMMENDED" | "LATEST";
export type IngredientRecommendationStatus = "PENDING" | "REJECTED" | "ADOPTED" | "MERGED";
export type UploadAssetScene = "RECIPE_COVER" | "RECIPE_STEP";
export type UploadAssetStatus = "TEMP" | "BOUND" | "DELETED";

export type RecipeAmountInput =
  | {
      kind: "EXACT";
      quantity: string;
      unitId: UUID;
    }
  | {
      kind: "FUZZY";
      text: "适量" | "少许" | "按需";
    };

export type RecipeAmountSnapshot =
  | {
      kind: "EXACT";
      quantity: string;
      unitId: UUID;
      unitName: string;
      unitType: UnitType;
    }
  | {
      kind: "FUZZY";
      text: "适量" | "少许" | "按需";
    };

export interface RecipeCategorySummary {
  id: UUID;
  name: string;
  version: number;
}

export interface RecipeSceneSummary {
  id: UUID;
  name: string;
  version: number;
}

export interface InspirationCategorySummary {
  id: UUID;
  name: string;
  iconKey: string | null;
}

export interface AdminInspirationCategorySummary {
  id: UUID;
  name: string;
  iconKey: string | null;
  version: number;
  recipeCount: number;
  updatedAt: IsoDateTime;
}

export interface IngredientCategorySummary {
  id: UUID;
  name: string;
}

export interface UnitSummary {
  id: UUID;
  name: string;
  type: UnitType;
  source: IngredientSource;
}

export interface IngredientSummary {
  id: UUID;
  name: string;
  source: IngredientSource;
  categoryId: UUID;
  defaultUnit: UnitSummary;
  imageUrl: string | null;
  recommendationStatus: "PENDING" | "REJECTED" | null;
  version: number;
}

export interface IngredientRecommendationSummary {
  id: UUID;
  ingredientId: UUID;
  ingredientVersion: number;
  ingredientName: string;
  status: IngredientRecommendationStatus;
  category: IngredientCategorySummary;
  defaultUnit: UnitSummary;
  reviewNote: string | null;
  reviewAdvice: string | null;
  adoptedIngredient: IngredientSummary | null;
  mergedIngredient: IngredientSummary | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  reviewedAt: IsoDateTime | null;
}

export interface RecommendIngredientRequest {
  operationId: OperationId;
}

export interface CreateIngredientFeedbackRequest {
  operationId: OperationId;
  name: string;
  categoryId: UUID;
  note?: string;
}

export interface IngredientFeedbackResult {
  id: UUID;
  ingredientId: UUID;
  status: "PENDING";
  createdAt: IsoDateTime;
}

export interface UploadImageSummary {
  id: UUID;
  publicId: string;
  scene: UploadAssetScene;
  slotKey: string;
  status: UploadAssetStatus;
  imageUrl: string;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime | null;
}

export interface UploadImageResponse {
  upload: UploadImageSummary;
}

export type AdminRecipeImageScene = "COVER" | "STEP";

export interface AdminRecipeImageUploadSummary {
  tempKey: string;
  scene: AdminRecipeImageScene;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface AdminRecipeImageUploadResponse {
  image: AdminRecipeImageUploadSummary;
}

export interface RecipeIngredientInput {
  ingredientId: UUID;
  amount: RecipeAmountInput;
}

export interface RecipeDraftIngredientInput {
  ingredientId: UUID | null;
  name: string;
  quantity: string;
  unitId: UUID | null;
  fuzzyText: "适量" | "少许" | "按需" | null;
  categoryId: UUID | null;
  defaultUnitId: UUID | null;
  source: IngredientSource | null;
}

export interface RecipeIngredientSnapshot {
  ingredientId: UUID;
  ingredientName: string;
  source: IngredientSource;
  categoryId: UUID;
  amount: RecipeAmountSnapshot;
}

export interface RecipeStepSnapshot {
  text: string;
  imageUrl: string | null;
}

export interface AdminRecipeStepInput {
  text: string;
  imageUrl: string | null;
  imageTempKey: string | null;
}

export interface RecipeDraftStepInput {
  slotKey: string;
  text: string;
  uploadId: UUID | null;
  imageUrl?: string | null;
}

export interface RecipeContentSnapshot {
  name: string;
  story: string | null;
  baseServings: number;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  estimatedCalories: number | null;
  tips: string | null;
  ingredients: RecipeIngredientSnapshot[];
  steps: RecipeStepSnapshot[];
}

export interface RecipeDraftContentInput {
  name: string;
  story: string | null;
  categoryId: UUID | null;
  sceneIds: UUID[];
  originVersionId?: UUID | null;
  originCoverImageUrl?: string | null;
  coverUploadId: UUID | null;
  coverImageUrl?: string | null;
  baseServings: number | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  tips: string | null;
  ingredients: RecipeDraftIngredientInput[];
  steps: RecipeDraftStepInput[];
}

export interface AdminRecipeContentInput {
  name: string;
  story: string | null;
  baseServings: number;
  difficulty: RecipeDifficulty;
  duration: RecipeDuration;
  estimatedCalories: number | null;
  tips: string | null;
  ingredients: RecipeIngredientInput[];
  steps: AdminRecipeStepInput[];
}

export interface ReorderItem {
  id: UUID;
  expectedVersion: number;
}

export interface RecipeDraftSummary {
  id: UUID;
  recipeId: UUID | null;
  title: string | null;
  coverImageUrl: string | null;
  category: RecipeCategorySummary | null;
  version: number;
  updatedAt: IsoDateTime;
}

export interface RecipeDraftDetail {
  id: UUID;
  recipeId: UUID | null;
  version: number;
  content: RecipeDraftContentInput;
  ingredientRefs: IngredientSummary[];
  unitRefs: UnitSummary[];
  category: RecipeCategorySummary | null;
  scenes: RecipeSceneSummary[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface SaveRecipeDraftResponse {
  id: UUID;
  recipeId: UUID | null;
  version: number;
  updatedAt: IsoDateTime;
}

export interface DeleteRecipeDraftResponse {
  draftId: UUID;
  deletedAt: IsoDateTime;
}

export interface MyRecipeSummary {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  category: RecipeCategorySummary;
  version: number;
  updatedAt: IsoDateTime;
}

export interface MyRecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  category: RecipeCategorySummary;
  scenes: RecipeSceneSummary[];
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  ingredientRefs: IngredientSummary[];
  unitRefs: UnitSummary[];
  recommendation: RecipeRecommendationSummary | null;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type RecipeRecommendationStatus = "PENDING" | "REJECTED" | "ADOPTED" | "WITHDRAWN";

export interface RecipeRecommendationSummary {
  id: UUID;
  recipeId: UUID;
  sourceVersionId: UUID;
  recipeTitle: string;
  curatedByName: string;
  suggestedCategory: InspirationCategorySummary;
  status: RecipeRecommendationStatus;
  reviewNote: string | null;
  adoptedRecipeId: UUID | null;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  reviewedAt: IsoDateTime | null;
  withdrawnAt: IsoDateTime | null;
}

export interface CollectionSceneSummary {
  id: UUID;
  name: string;
  version: number;
  recipeCount: number;
  updatedAt: IsoDateTime | null;
}

export interface CollectionListResponse {
  items: CollectionSceneSummary[];
  totalCount: number;
}

export interface CollectedRecipeSummary {
  id: UUID;
  sourceRecipeId: UUID;
  title: string;
  coverImageUrl: string | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  category: InspirationCategorySummary;
  scenes: RecipeSceneSummary[];
  contentVersionId: UUID;
  collectedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CollectedRecipeDetail {
  id: UUID;
  sourceRecipeId: UUID;
  title: string;
  coverImageUrl: string | null;
  category: InspirationCategorySummary;
  scenes: RecipeSceneSummary[];
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  collectedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface SaveCollectionRecipeRequest {
  operationId: OperationId;
  sourceRecipeId: UUID;
  sourceVersionId: UUID;
  sceneIds: UUID[];
}

export interface SaveCollectionRecipeResponse {
  recipe: CollectedRecipeDetail;
}

export interface PublishRecipeDraftResponse {
  recipe: MyRecipeDetail;
}

export interface DeleteRecipeResponse {
  recipeId: UUID;
  status: "RECYCLED" | "DELETED";
  deletedAt: IsoDateTime;
  recycledUntil: IsoDateTime | null;
}

export interface InspirationRecipeSummary {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  category: InspirationCategorySummary;
  likeCount: number;
  collectCount: number;
  updatedAt: IsoDateTime;
}

export interface InspirationRecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  category: InspirationCategorySummary;
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  likeCount: number;
  collectCount: number;
  curatedByName: string | null;
  updatedAt: IsoDateTime;
}

export interface RecipeReportSummary {
  id: UUID;
  recipeId: UUID;
  reporterUid: number;
  reason: string;
  status: "OPEN" | "RESOLVED";
  createdAt: IsoDateTime;
}

export interface AdminRecipeSummary {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  inspirationCategoryId: UUID;
  inspirationCategoryName: string;
  updatedAt: IsoDateTime;
  ownerUid: number | null;
}

export interface AdminRecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  ownerUid: number | null;
  personalCategory: RecipeCategorySummary | null;
  inspirationCategory: InspirationCategorySummary | null;
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  version: number;
  reportCount: number;
  blockedReason: string | null;
  likeCount: number;
  collectCount: number;
  canEdit: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface UpdateAdminRecipeRequest {
  operationId: OperationId;
  expectedVersion: number;
  inspirationCategoryId: UUID;
  coverImageUrl: string | null;
  coverImageTempKey: string | null;
  content: AdminRecipeContentInput;
}

export interface CreateAdminRecipeRequest {
  operationId: OperationId;
  inspirationCategoryId: UUID;
  coverImageUrl: string | null;
  coverImageTempKey: string | null;
  content: AdminRecipeContentInput;
}

export type RecipeImportSourceType = "MARKDOWN" | "EXCEL";
export type RecipeImportJobStatus = "PENDING" | "RUNNING" | "READY" | "FAILED" | "COMPLETED";
export type RecipeImportItemStatus = "PENDING_PARSE" | "NEEDS_FIX" | "READY" | "PUBLISHING" | "PUBLISHED" | "FAILED";

export interface RecipeImportIssue {
  field: string | null;
  message: string;
}

export interface RecipeImportImageSummary {
  key: string;
  alt: string | null;
  fileName: string;
  width: number | null;
  height: number | null;
}

export interface RecipeImportRawBody {
  sourcePath: string;
  markdown: string;
  assetFolder: string;
  images: RecipeImportImageSummary[];
}

export interface RecipeImportIngredientDraft {
  line: string;
  ingredientName: string;
  ingredientId: UUID | null;
  quantity: string | null;
  unitText: string | null;
  unitId: UUID | null;
  fuzzyText: "适量" | "少许" | "按需" | null;
  note: string | null;
}

export interface RecipeImportStepDraft {
  text: string;
  imageKey: string | null;
  imageTempKey: string | null;
}

export interface RecipeImportParsedBody {
  titleLine: string | null;
  story: string | null;
  baseServingsText: string | null;
  difficultyText: string | null;
  durationText: string | null;
  caloriesText: string | null;
  ingredientLines: string[];
  stepLines: string[];
  tipLines: string[];
}

export interface RecipeImportRecipeBody {
  inspirationCategoryId: UUID | null;
  title: string;
  story: string | null;
  baseServings: number | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  estimatedCalories: number | null;
  tips: string | null;
  coverImageKey: string | null;
  coverImageTempKey: string | null;
  ingredients: RecipeImportIngredientDraft[];
  steps: RecipeImportStepDraft[];
}

export interface RecipeImportJobSummary {
  id: UUID;
  sourceType: RecipeImportSourceType;
  sourceName: string;
  status: RecipeImportJobStatus;
  totalCount: number;
  readyCount: number;
  needsFixCount: number;
  failedCount: number;
  createdByAdminId: UUID;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RecipeImportItemSummary {
  id: UUID;
  jobId: UUID;
  sourcePath: string;
  title: string | null;
  status: RecipeImportItemStatus;
  errorCount: number;
  warnCount: number;
  recipeId: UUID | null;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RecipeImportJobDetail extends RecipeImportJobSummary {
  items: PageResult<RecipeImportItemSummary>;
}

export interface RecipeImportItemPreviewImage extends RecipeImportImageSummary {
  dataUrl: string;
  canUseAsCover: boolean;
}

export interface RecipeImportItemDetail {
  id: UUID;
  jobId: UUID;
  sourcePath: string;
  title: string | null;
  status: RecipeImportItemStatus;
  rawBody: RecipeImportRawBody;
  parsedBody: RecipeImportParsedBody;
  recipeBody: RecipeImportRecipeBody;
  errorItems: RecipeImportIssue[];
  warnItems: RecipeImportIssue[];
  sourceImages: RecipeImportItemPreviewImage[];
  recipeId: UUID | null;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CreateRecipeImportJobRequest {
  operationId: OperationId;
  sourceType: "MARKDOWN";
  inspirationCategoryId: UUID | null;
}

export interface UpdateRecipeImportItemRequest {
  operationId: OperationId;
  expectedVersion: number;
  recipeBody: RecipeImportRecipeBody;
}

export interface PublishRecipeImportItemRequest {
  operationId: OperationId;
  expectedVersion: number;
}

export interface RecommendRecipeRequest {
  operationId: OperationId;
  inspirationCategoryId: UUID;
}

export interface WithdrawRecipeRecommendationRequest {
  operationId: OperationId;
  expectedVersion: number;
}

export interface AdminInspirationCategoryPayloadRequest {
  operationId: OperationId;
  name: string;
}

export interface UpdateAdminInspirationCategoryRequest extends AdminInspirationCategoryPayloadRequest {
  expectedVersion: number;
}

export interface AdminPendingRecipeSummary {
  id: UUID;
  recipeId: UUID;
  recipeTitle: string;
  contentVersionId: UUID;
  version: number;
  status: "PENDING";
  suggestedCategory: InspirationCategorySummary;
  personalCategory: RecipeCategorySummary | null;
  user: AdminIngredientSuggestionUser;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type AdminRecipeReviewAction = "APPROVE" | "REJECT";

export interface AdminReviewPendingRecipeRequest {
  operationId: OperationId;
  action: AdminRecipeReviewAction;
  expectedVersion: number;
  inspirationCategoryId?: UUID;
  reason?: string;
}

export interface AdminReviewPendingRecipeResult {
  id: UUID;
  status: "APPROVED" | "REJECTED";
  reviewedAt: IsoDateTime;
  targetRecipeId: UUID | null;
}

export interface AdminIngredientCategorySummary {
  id: UUID;
  code: string;
  name: string;
  isSelectable: boolean;
  version: number;
  ingredientCount: number;
  updatedAt: IsoDateTime;
}

export interface AdminIngredientSummary {
  id: UUID;
  name: string;
  version: number;
  status: "ACTIVE" | "DISABLED";
  categoryId: UUID;
  categoryName: string;
  defaultUnit: UnitSummary;
  imageUrl: string | null;
  updatedAt: IsoDateTime;
}

export interface AdminIngredientSuggestionUser {
  id: UUID;
  uid: number;
  nickname: string | null;
}

export interface AdminPendingIngredientSummary {
  id: UUID;
  name: string;
  version: number;
  categoryId: UUID | null;
  categoryName: string | null;
  defaultUnitId: UUID | null;
  defaultUnitName: string | null;
  status: "PENDING";
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  user: AdminIngredientSuggestionUser;
}

export interface AdminReviewPendingIngredientResult {
  id: UUID;
  status: "APPROVED" | "REJECTED";
  reviewedAt: IsoDateTime;
  targetIngredientId: UUID | null;
}

export interface AdminPendingIngredientFeedbackSummary {
  id: UUID;
  ingredientId: UUID;
  ingredientVersion: number;
  ingredientName: string;
  categoryId: UUID;
  categoryName: string;
  suggestedName: string;
  suggestedCategoryId: UUID;
  suggestedCategoryName: string;
  note: string | null;
  status: "PENDING";
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  user: AdminIngredientSuggestionUser;
}

export interface AdminReviewIngredientFeedbackRequest {
  operationId: OperationId;
  action: "APPROVE" | "REJECT";
  expectedVersion: number;
  name?: string;
  categoryId?: UUID;
  reason?: string;
}

export interface AdminReviewIngredientFeedbackResult {
  id: UUID;
  ingredientId: UUID;
  status: "APPROVED" | "REJECTED";
  reviewedAt: IsoDateTime;
}

export interface AdminUnitSummary {
  id: UUID;
  name: string;
  type: UnitType;
  source: "SYSTEM";
  version: number;
  updatedAt: IsoDateTime;
}

export interface AdminDeleteUnitResult {
  unitId: UUID;
  deletedAt: IsoDateTime;
}

export interface AdminUserRecipeDomainOverview {
  user: Pick<UserProfile, "id" | "uid" | "nickname">;
  publishedCount: number;
  draftCount: number;
  collectionCount: number;
  sceneCount: number;
  latestPublishedAt: IsoDateTime | null;
  latestDraftAt: IsoDateTime | null;
  latestCollectionAt: IsoDateTime | null;
}

export interface MealPlanSummary {
  id: UUID;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  status: "PLANNED" | "COMPLETED";
  completedAt: IsoDateTime | null;
  hasDiningEvent: boolean;
  diningEventId: UUID | null;
  createdAt: IsoDateTime;
}

export interface DiningEventParticipantSummary {
  id: UUID;
  userUid: number | null;
  displayName: string | null;
  avatarUrl: string | null;
  guestName: string | null;
  sourceType: "DINING_GROUP" | "SHARE";
  status: "INVITED" | "ACCEPTED" | "DECLINED" | "REMOVED";
  bringRecipeId: UUID | null;
  bringRecipeTitle: string | null;
}

export type MealPollStatus = "OPEN" | "CLOSED" | "CONFIRMED" | "COMPLETED";
export type MealPollCandidateStatus = "ACTIVE" | "PENDING" | "REJECTED";
export type ActivityState = "PENDING" | "DONE" | "EXPIRED";
export type DiningGroupActivityKind =
  | "POLL_OPENED"
  | "POLL_VOTED"
  | "POLL_SUGGESTED"
  | "POLL_NOTED"
  | "MENU_CONFIRMED"
  | "COOK_CLAIMED"
  | "BRING_UPDATED"
  | "MEAL_COMPLETED"
  | "MEMORY_CREATED"
  | "MEMBER_JOINED"
  | "INVITE_PENDING";

export interface MealPollSummary {
  id: UUID;
  diningGroupId: UUID;
  title: string;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  status: MealPollStatus;
  deadlineAt: IsoDateTime;
  choiceLimit: number;
  note: string | null;
  candidateCount: number;
  responseCount: number;
  confirmedPlanItemId: UUID | null;
  confirmedDiningEventId: UUID | null;
  version: number;
  createdAt: IsoDateTime;
}

export interface MealPollCandidateSummary {
  id: UUID;
  recipeId: UUID | null;
  recipeVersionId: UUID | null;
  title: string;
  coverUrl: string | null;
  status: MealPollCandidateStatus;
  sourceType: "RECIPE" | "SUGGESTION";
  suggestedByUid: number | null;
  voteCount: number;
}

export interface MealPollResponseSummary {
  id: UUID;
  userUid: number;
  selectedCandidateIds: UUID[];
  suggestionCandidateId: UUID | null;
  note: string | null;
  respondedAt: IsoDateTime;
}

export interface MealPollDetail extends MealPollSummary {
  candidates: MealPollCandidateSummary[];
  responses: MealPollResponseSummary[];
}

export interface DiningGroupActivitySummary {
  id: UUID;
  diningGroupId: UUID;
  kind: DiningGroupActivityKind;
  state: ActivityState;
  actorUid: number | null;
  actorName: string | null;
  title: string;
  detail: string | null;
  pollId: UUID | null;
  planItemId: UUID | null;
  diningEventId: UUID | null;
  createdAt: IsoDateTime;
}

export interface DiningEventMenuItemSummary {
  id: UUID;
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  cookUserUid: number | null;
  cookName: string | null;
  version: number;
}

export interface DiningEventSummary {
  id: UUID;
  title: string;
  scheduledAt: IsoDateTime;
  location: string | null;
  status: "PLANNED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  organizerUid: number | null;
  organizerName: string | null;
  organizerAvatarUrl: string | null;
  planItemId: UUID | null;
  diningGroupId: UUID | null;
  menu: RecipeContentSnapshot;
  menuItems: DiningEventMenuItemSummary[];
  participants: DiningEventParticipantSummary[];
  shareTokenPath: string | null;
  completedAt: IsoDateTime | null;
  version: number;
  createdAt: IsoDateTime;
}

export interface DiningMemoryShareMenuItem {
  title: string;
  coverUrl: string | null;
  cookName: string | null;
}

export interface DiningMemoryShareParticipant {
  displayName: string;
  avatarUrl: string | null;
  role: "ORGANIZER" | "PARTICIPANT" | "GUEST";
}

export interface DiningMemorySharePreview {
  title: string;
  planDate: string | null;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER" | null;
  menuItems: DiningMemoryShareMenuItem[];
  participants: DiningMemoryShareParticipant[];
  caption: string | null;
  sharedAt: IsoDateTime;
  snapshotVersion: number;
}

export interface DiningMemoryShareSnapshot extends DiningMemorySharePreview {
  id: UUID;
  diningEventId: UUID;
  sharePath: string;
}

export interface MealPollListQuery {
  diningGroupId: UUID;
  status?: MealPollStatus;
  planDate?: string;
  mealSlot?: "BREAKFAST" | "LUNCH" | "DINNER";
  limit?: number;
}

export interface DiningGroupActivitiesQuery {
  diningGroupId: UUID;
  limit?: number;
}

export interface CreateMealPollRequest {
  operationId: OperationId;
  diningGroupId: UUID;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  deadlineAt: IsoDateTime;
  choiceLimit: number;
  note: string | null;
  candidateRecipeVersionIds: UUID[];
}

export interface VoteMealPollRequest {
  operationId: OperationId;
  expectedVersion: number;
  selectedCandidateIds: UUID[];
  suggestionTitle: string | null;
  note: string | null;
}

export interface ConfirmMealPollRequest {
  operationId: OperationId;
  expectedVersion: number;
  finalRecipeVersionIds: UUID[];
  scheduledAt: IsoDateTime | null;
  location: string | null;
}

export interface ClaimCookRequest {
  operationId: OperationId;
  expectedVersion: number;
  menuItemId: UUID;
  action: "CLAIM" | "RELEASE";
}

export interface CreateDiningMemoryShareRequest {
  operationId: OperationId;
  showParticipants: boolean;
  caption: string | null;
}

export type MedalAwardRule =
  | "MEAL_COMPLETION"
  | "DINING_EVENT_COMPLETION"
  | "GROUP_MEAL_COMPLETION"
  | "FULL_LOOP_COMPLETION"
  | "RECOMMENDATION_ADOPTED_TOTAL";

export type MedalCategory =
  | "MEAL_CHECKIN"
  | "DINING_COLLABORATION"
  | "HOLIDAY_LIMITED"
  | "RECOMMENDATION_CONTRIBUTION";
export type MedalTemplateStatus = "DRAFT" | "LISTED" | "UNLISTED" | "ARCHIVED";

export interface MedalCategorySummary {
  key: MedalCategory;
  name: string;
  totalCount: number;
  earnedCount: number;
}

export interface UserMedalSummary {
  code: string;
  awardRule: MedalAwardRule;
  iconKey: string;
  imageUrl: string | null;
  earnedImageUrl: string | null;
  lockedImageUrl: string | null;
  category: MedalCategory;
  categoryName: string;
  name: string;
  description: string;
  condition: string;
  earnedUserCount: number;
  earned: boolean;
  isLimited: boolean;
  startAt: IsoDateTime | null;
  endAt: IsoDateTime | null;
  awardedAt: IsoDateTime | null;
}

export interface MedalWallResponse {
  earnedCount: number;
  totalCount: number;
  categories: MedalCategorySummary[];
  items: UserMedalSummary[];
}

export interface AdminMedalTemplateSummary {
  id: UUID;
  code: string;
  awardRule: MedalAwardRule;
  category: MedalCategory;
  categoryName: string;
  name: string;
  description: string;
  condition: string;
  iconKey: string;
  imageUrl: string | null;
  earnedImageUrl: string | null;
  lockedImageUrl: string | null;
  status: MedalTemplateStatus;
  targetCount: number;
  sortOrder: number;
  isLimited: boolean;
  startAt: IsoDateTime | null;
  endAt: IsoDateTime | null;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminMedalTemplateQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: MedalTemplateStatus;
  category?: MedalCategory;
}

export interface CreateAdminMedalTemplateRequest {
  operationId: OperationId;
  awardRule: MedalAwardRule;
  category: MedalCategory;
  name: string;
  description: string;
  condition: string;
  status?: Exclude<MedalTemplateStatus, "ARCHIVED">;
  targetCount?: number;
  sortOrder?: number;
  isLimited: boolean;
  startAt: IsoDateTime | null;
  endAt: IsoDateTime | null;
}

export interface UpdateAdminMedalTemplateRequest {
  operationId: OperationId;
  expectedVersion: number;
  category: MedalCategory;
  name: string;
  description: string;
  condition: string;
  targetCount?: number;
  sortOrder?: number;
  isLimited: boolean;
  startAt: IsoDateTime | null;
  endAt: IsoDateTime | null;
}

export interface SetAdminMedalTemplateStatusRequest {
  operationId: OperationId;
  expectedVersion: number;
  status: MedalTemplateStatus;
}

export interface UpdateAdminMedalTemplateImageRequest {
  operationId: OperationId;
  expectedVersion: number;
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
  menu: Pick<RecipeContentSnapshot, "name" | "ingredients">;
  organizerUid: number;
}
