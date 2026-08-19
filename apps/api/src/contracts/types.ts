export type UUID = number;
export type ResourceId = UUID;
export type OperationId = string;
export type IsoDateTime = string;
export type MealSlot = "BREAKFAST" | "LUNCH" | "AFTERNOON_TEA" | "DINNER" | "LATE_NIGHT";

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

export interface WechatLoginRequest {
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

export interface WechatLoginResult {
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
export type HomeEntryStatus = "LISTED" | "UNLISTED";

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
  status: HomeEntryStatus;
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

export interface SetHomeEntryStatusRequest {
  status: HomeEntryStatus;
  expectedVersion: number;
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

export interface HomeTopicPickInput {
  recipeId: UUID;
  recommendNote: string | null;
}

export interface CreateHomeTopicRequest {
  title: string;
  subTitle: string | null;
  recType: HomeTopicType;
  issueNo: number;
  description: string;
  items: HomeTopicPickInput[];
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

export interface RedeemMembershipCodeRequest {
  code: string;
}

export interface RedeemMembershipCodeResult {
  membership: UserMembership;
  redeemedAt: IsoDateTime;
}

export type MembershipCodeKind = "FORMAL" | "TRIAL";
export type MembershipCodeStatus = "ACTIVE" | "REDEEMED" | "DISABLED";
export type MembershipCodeBatchWindowState = "NO_LIMIT" | "PENDING" | "ACTIVE" | "EXPIRED";

export interface AdminMembershipSkuItem {
  id: UUID;
  code: string;
  kind: MembershipCodeKind;
  tier: EntitlementTier;
  durationDays: number;
  redeemEnabled: boolean;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminMembershipSkuListResponse {
  items: AdminMembershipSkuItem[];
  syncedAt: IsoDateTime;
}

export interface SetAdminMembershipSkuStatusRequest {
  redeemEnabled: boolean;
  expectedVersion: number;
}

export interface CreateAdminMembershipCodeBatchRequest {
  skuCode: string;
  name: string;
  redeemEnabled: boolean;
  startsAt?: IsoDateTime | null;
  endsAt?: IsoDateTime | null;
}

export interface SetAdminMembershipCodeBatchStatusRequest {
  redeemEnabled: boolean;
  expectedVersion: number;
}

export interface AdminMembershipCodeBatchItem {
  id: UUID;
  sku: AdminMembershipSkuItem;
  name: string;
  redeemEnabled: boolean;
  startsAt: IsoDateTime | null;
  endsAt: IsoDateTime | null;
  windowState: MembershipCodeBatchWindowState;
  version: number;
  codeCount: number;
  activeCodeCount: number;
  redeemedCodeCount: number;
  disabledCodeCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface GenerateAdminMembershipCodesRequest {
  quantity: number;
}

export interface GeneratedMembershipCodeRow {
  code: string;
  codeMask: string;
}

export interface AdminMembershipCodeOperatorSummary {
  id: UUID;
  uid: number;
  nickname: string | null;
}

export interface AdminMembershipCodeItem {
  id: UUID;
  batchId: UUID;
  batchName: string;
  skuCode: string;
  kind: MembershipCodeKind;
  tier: EntitlementTier;
  durationDays: number;
  codeMask: string;
  status: MembershipCodeStatus;
  redeemedBy: AdminMembershipCodeOperatorSummary | null;
  redeemedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminMembershipCodeGenerationOperatorSummary {
  id: UUID;
  username: string;
  displayName: string;
}

export interface AdminMembershipCodeGenerationItem {
  id: UUID;
  batchId: UUID;
  batchName: string;
  skuCode: string;
  generatedCount: number;
  generatedBy: AdminMembershipCodeGenerationOperatorSummary | null;
  exportedAt: IsoDateTime;
  createdAt: IsoDateTime;
}

export interface AdminGenerateMembershipCodesResult {
  batch: AdminMembershipCodeBatchItem;
  generatedCount: number;
  exportedAt: IsoDateTime;
  codes: GeneratedMembershipCodeRow[];
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

export interface AdminDashboardSummary {
  overview: {
    todayNewUsers: number;
    sevenDayNewUsers: number;
    totalUsers: number;
    openReportCount: number;
    pendingRecipeCount: number;
    pendingIngredientCount: number;
    todayRedeemedCount: number;
  };
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

export interface AdminDashboardTrendPoint {
  date: string;
  label: string;
  newUsers: number;
  totalUsers: number;
  openReportCount: number;
  pendingRecipeCount: number;
  pendingIngredientCount: number;
  membershipGeneratedCount: number;
  membershipRedeemedCount: number;
}

export interface AdminDashboardTrendsResponse {
  range: "7D" | "30D";
  points: AdminDashboardTrendPoint[];
}

export interface AdminSiteContentChannelSummary {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminSiteContentOperatorSummary {
  id: UUID;
  username: string;
  displayName: string;
}

export interface AdminSiteContentSummary {
  id: UUID;
  type: "PAGE" | "ARTICLE";
  status: "DRAFT" | "PUBLISHED" | "UNLISTED";
  channel: AdminSiteContentChannelSummary | null;
  slug: string;
  path: string;
  title: string;
  summary: string;
  label: string;
  heroNote: string | null;
  coverImageUrl: string | null;
  publishedAt: IsoDateTime | null;
  effectiveAt: IsoDateTime | null;
  sortOrder: number;
  version: number;
  updatedBy: AdminSiteContentOperatorSummary | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminSitePageSummary extends AdminSiteContentSummary {
  exists: boolean;
  fixedSlug: string;
}

export interface AdminSiteContentDetail extends AdminSiteContentSummary {
  bodyHtml: string;
  bodyText: string;
}

export interface AdminSiteContentImageUploadResult {
  imageUrl: string;
}

export interface CreateAdminSiteContentRequest {
  operationId: OperationId;
  type: "PAGE" | "ARTICLE";
  channelId?: UUID | null;
  slug: string;
  path?: string | null;
  title: string;
  summary: string;
  label: string;
  heroNote?: string | null;
  coverImageUrl?: string | null;
  bodyHtml: string;
  bodyText: string;
  effectiveAt?: IsoDateTime | null;
  sortOrder?: number;
}

export interface UpdateAdminSiteContentRequest extends CreateAdminSiteContentRequest {
  expectedVersion: number;
}

export interface UpdateAdminSiteContentStatusRequest {
  operationId: OperationId;
  status: "DRAFT" | "PUBLISHED" | "UNLISTED";
  expectedVersion: number;
}

export interface CreateAdminSiteContentChannelRequest {
  operationId: OperationId;
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdateAdminSiteContentChannelRequest extends CreateAdminSiteContentChannelRequest {
  expectedVersion: number;
}

export interface SiteContentDetail {
  id: UUID;
  type: "PAGE" | "ARTICLE";
  slug: string;
  path: string;
  title: string;
  summary: string;
  label: string;
  heroNote: string | null;
  coverImageUrl: string | null;
  bodyHtml: string;
  bodyText: string;
  publishedAt: IsoDateTime | null;
  effectiveAt: IsoDateTime | null;
  updatedAt: IsoDateTime;
  channelCode: string | null;
  channelName: string | null;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminUserEntitlementResponse {
  user: Pick<UserProfile, "id" | "uid" | "nickname" | "status">;
  membership: UserMembership;
  display: Pick<UserDisplay, "canUseProfileBackground" | "canUseHomeBackground">;
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
  proteinType?: IngredientProteinType | null;
  isStaple: boolean;
  isSpicyIngredient: boolean;
  aliases?: string[];
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

export interface AdminPendingUnitRecommendationSummary {
  id: UUID;
  name: string;
  type: UnitType;
  version: number;
  status: "PENDING";
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  user: Pick<UserProfile, "id" | "uid" | "nickname">;
}

export interface AdminReviewPendingUnitRecommendationRequest {
  operationId: OperationId;
  action: "APPROVE" | "REJECT";
  expectedVersion: number;
  name?: string;
  type?: UnitType;
  reason?: string;
}

export interface AdminReviewPendingUnitRecommendationResult {
  id: UUID;
  status: "APPROVED" | "REJECTED";
  reviewedAt: IsoDateTime;
  targetUnitId: UUID | null;
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
export type RecipeSlotType =
  | "MEAT"
  | "VEGETABLE"
  | "SOUP"
  | "STAPLE"
  | "BREAKFAST_STAPLE"
  | "BREAKFAST_PROTEIN"
  | "BREAKFAST_SIDE";
export type RecipeProteinType = "PORK" | "CHICKEN" | "BEEF" | "LAMB" | "DUCK" | "FISH" | "NONE";
export type IngredientProteinType =
  | "PORK"
  | "CHICKEN"
  | "BEEF"
  | "LAMB"
  | "DUCK"
  | "SEAFOOD"
  | "EGG"
  | "TOFU"
  | "NONE";
export type MealPlanDishPurchaseState = "READY" | "PENDING";
export type UnitType = "WEIGHT" | "VOLUME" | "COMMON" | "PACKAGE";
export type IngredientSource = "SYSTEM" | "PERSONAL";
export type InspirationSort = "RECOMMENDED" | "LATEST";
export type IngredientRecommendationStatus = "PENDING" | "REJECTED" | "ADOPTED" | "MERGED";
export type UnitRecommendationStatus = "PENDING" | "REJECTED" | "ADOPTED" | "MERGED";
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

export interface UnitRecommendationSummary {
  id: UUID;
  unitName: string;
  unitType: UnitType;
  status: UnitRecommendationStatus;
  reviewNote: string | null;
  reviewAdvice: string | null;
  targetUnit: UnitSummary | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  reviewedAt: IsoDateTime | null;
}

export interface RecommendIngredientRequest {
  operationId: OperationId;
}

export interface RecommendUnitRequest {
  operationId: OperationId;
  name: string;
  type: UnitType;
}

export interface UnitRecommendationQuery {
  page?: number;
  pageSize?: number;
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

export type RecipeAssistantStepPhase = "PREP" | "COOK" | "SERVE";

export interface RecipeAssistantStep {
  order: number;
  phase: RecipeAssistantStepPhase;
  title: string;
  detail: string;
  imageUrl: string | null;
  durationText: string | null;
}

export interface RecipeAssistantSummary {
  stepCount: number;
  prepStepCount: number;
  cookStepCount: number;
  serveStepCount: number;
  totalDurationText: string | null;
}

export interface RecipeAssistantSnapshot {
  generatedAt: IsoDateTime;
  summary: RecipeAssistantSummary;
  steps: RecipeAssistantStep[];
}

export interface RecipeDraftContentInput {
  name: string;
  story: string | null;
  categoryId: UUID | null;
  inspirationCategoryId?: UUID | null;
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
  difficultyText: string | null;
  durationText: string | null;
  category: RecipeCategorySummary;
  contentVersionId: UUID;
  version: number;
  updatedAt: IsoDateTime;
}

export interface MyRecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  difficultyText: string | null;
  durationText: string | null;
  category: RecipeCategorySummary;
  inspirationCategory: InspirationCategorySummary | null;
  scenes: RecipeSceneSummary[];
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  assistant: RecipeAssistantSnapshot | null;
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
  difficultyText: string | null;
  durationText: string | null;
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
  difficultyText: string | null;
  durationText: string | null;
  category: InspirationCategorySummary;
  scenes: RecipeSceneSummary[];
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  assistant: RecipeAssistantSnapshot | null;
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
  difficultyText: string | null;
  durationText: string | null;
  category: InspirationCategorySummary;
  likeCount: number;
  collectCount: number;
  updatedAt: IsoDateTime;
}

export interface InspirationRecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  difficultyText: string | null;
  durationText: string | null;
  category: InspirationCategorySummary;
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  assistant: RecipeAssistantSnapshot | null;
  likeCount: number;
  collectCount: number;
  ownedRecipeId: UUID | null;
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

export interface RecipeAssistantStateSummary {
  status: "MISSING" | "READY" | "FAILED";
  hasSnapshot: boolean;
  generatedAt: IsoDateTime | null;
  lastAttemptAt: IsoDateTime | null;
  attemptCount: number;
  lastError: string | null;
}

export interface AdminRecipeDetail {
  id: UUID;
  title: string;
  coverImageUrl: string | null;
  status: "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED";
  ownerUid: number | null;
  personalCategory: RecipeCategorySummary | null;
  inspirationCategory: InspirationCategorySummary | null;
  difficultyText: string | null;
  durationText: string | null;
  contentVersionId: UUID;
  content: RecipeContentSnapshot;
  assistantState: RecipeAssistantStateSummary;
  assistant: RecipeAssistantSnapshot | null;
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
  proteinType: IngredientProteinType | null;
  isStaple: boolean;
  isSpicyIngredient: boolean;
  aliases: string[];
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

export interface CreateMealPlanMenuItemRequest {
  slotType: RecipeSlotType | null;
  sortOrder: number;
  recipeId: UUID;
  recipeVersionId: UUID;
  purchaseState: MealPlanDishPurchaseState;
}

export interface CreateMealPlanRequest {
  operationId: OperationId;
  planDate: string;
  mealSlot: MealSlot;
  expectedVersion?: number | null;
  title?: string | null;
  menuItems: CreateMealPlanMenuItemRequest[];
  note?: string | null;
}

export interface UpdateMealPlanTitleRequest {
  operationId: OperationId;
  expectedVersion: number;
  title?: string | null;
}

export interface RandomSlotPlan {
  meatCount: number;
  vegetableCount: number;
  soupCount: number;
  stapleCount: number;
  breakfastStapleCount: number;
  breakfastProteinCount: number;
  breakfastSideCount: number;
}

export type RandomMenuWarningCode = "INSUFFICIENT_CANDIDATES" | "PARTIAL_MENU";
export type RandomFridgeFit = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type RandomReplaceConstraintKind = "FLAVOR" | "DURATION" | "INGREDIENT" | "AVOID_INGREDIENT";

export interface RandomMenuWarning {
  code: RandomMenuWarningCode;
  message: string;
  slotTypes: RecipeSlotType[];
}

export interface RandomMenuItem {
  slotId: string;
  slotType: RecipeSlotType;
  slotIndex: number;
  recipeId: UUID;
  recipeVersionId: UUID;
  title: string;
  coverUrl: string | null;
  servings: number | null;
  duration: RecipeDuration | null;
  durationText: string | null;
  estimatedCalories: number | null;
  flavorTags: string[];
  mainProteinType: RecipeProteinType | null;
  fridgeFit: RandomFridgeFit;
}

export interface GenerateRandomMenuRequest {
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  peopleCount: number;
  fridgePreferred: boolean;
  slotPlan?: RandomSlotPlan | null;
}

export interface RandomMenuResponse {
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  peopleCount: number;
  fridgePreferred: boolean;
  slotPlan: RandomSlotPlan;
  items: RandomMenuItem[];
  warnings: RandomMenuWarning[];
  generatedAt: IsoDateTime;
}

export interface ReplaceRandomMenuCurrentItem {
  slotId: string;
  slotType: RecipeSlotType;
  recipeId: UUID;
  recipeVersionId: UUID;
}

export interface RandomReplaceConstraint {
  kind: RandomReplaceConstraintKind;
  value?: string | null;
  ingredientId?: UUID | null;
  ingredientName?: string | null;
}

export interface ReplaceRandomMenuSlotRequest {
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  peopleCount: number;
  fridgePreferred: boolean;
  slotPlan: RandomSlotPlan;
  currentItems: ReplaceRandomMenuCurrentItem[];
  targetSlotId: string;
  targetSlotType: RecipeSlotType;
  replaceConstraints: RandomReplaceConstraint[];
  rejectedRecipeVersionIds: UUID[];
  requestSeq: number;
}

export interface ReplaceRandomMenuSlotResponse {
  requestSeq: number;
  slot: RandomMenuItem | null;
  warning: RandomMenuWarning | null;
}

export interface RandomGapInventoryDecision {
  slotId: string;
  ingredientId?: UUID | null;
  ingredientName: string;
  decision: "HAS" | "MISSING";
}

export interface RandomGapCheckItem {
  slotId: string;
  slotType: RecipeSlotType;
  recipeId: UUID;
  recipeVersionId: UUID;
}

export interface CheckRandomMenuGapRequest {
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  peopleCount: number;
  items: RandomGapCheckItem[];
  inventoryDecisions: RandomGapInventoryDecision[];
}

export type RandomGapStatus = "OK" | "PARTIAL" | "MISSING" | "UNKNOWN";
export type RandomGapInventoryStatus = "ENOUGH" | "PARTIAL" | "MISSING" | "UNKNOWN";

export interface RandomGapIngredient {
  decisionKey: string;
  ingredientId: UUID | null;
  ingredientName: string;
  quantityText: string | null;
  inventoryStatus: RandomGapInventoryStatus;
  purchasable: boolean;
}

export interface RandomGapItem {
  slotId: string;
  slotType: RecipeSlotType;
  recipeId: UUID;
  recipeVersionId: UUID;
  recipeName: string;
  status: RandomGapStatus;
  missingIngredients: RandomGapIngredient[];
  actions: {
    canKeep: boolean;
    canReplace: boolean;
    canRemove: boolean;
    canAddToShopping: boolean;
  };
  unresolvedUnknownCount: number;
}

export interface RandomGapSummary {
  okCount: number;
  partialCount: number;
  missingCount: number;
  unknownCount: number;
}

export interface CheckRandomMenuGapResponse {
  items: RandomGapItem[];
  summary: RandomGapSummary;
  canCreatePlan: boolean;
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
  mealSlot: MealSlot;
  title: string;
  menuItems: MealPlanMenuItemSummary[];
  menuLocked: boolean;
  status: "PLANNED" | "COMPLETED";
  version: number;
  completedAt: IsoDateTime | null;
  hasDiningEvent: boolean;
  diningEventId: UUID | null;
  createdAt: IsoDateTime;
}

export interface AddMealPlanItemRequest {
  operationId: OperationId;
  planDate: string;
  mealSlot: MealSlot;
  recipeId: UUID;
  recipeVersionId: UUID;
  slotType?: RecipeSlotType | null;
  purchaseState?: MealPlanDishPurchaseState;
}

export interface MealPlanCookAssistantTask {
  title: string;
  detail: string;
  dishTitles: string[];
}

export interface MealPlanCookAssistantTimelineStep {
  order: number;
  title: string;
  detail: string;
  dishTitles: string[];
  parallelKey: string | null;
}

export interface MealPlanCookAssistantSummary {
  dishCount: number;
  prepTaskCount: number;
  timelineStepCount: number;
  totalDurationText: string | null;
  suggestedStartTime: string | null;
  notes: string[];
}

export interface MealPlanCookAssistant {
  planItemId: UUID;
  hasSnapshot: boolean;
  isStale: boolean;
  generatedAt: IsoDateTime | null;
  summary: MealPlanCookAssistantSummary;
  prepTasks: MealPlanCookAssistantTask[];
  cookTimeline: MealPlanCookAssistantTimelineStep[];
  serveTasks: MealPlanCookAssistantTask[];
}

export interface MealPlanMenuItemSummary {
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  servings: number | null;
  duration: RecipeDuration | null;
  durationText: string | null;
  slotType: RecipeSlotType | null;
  purchaseState: MealPlanDishPurchaseState;
  sortOrder: number;
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

export type ActivityState = "PENDING" | "DONE" | "EXPIRED";
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
  note: string | null;
  coverImageUrl: string | null;
  status: "PLANNED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  organizerUid: number | null;
  organizerName: string | null;
  organizerAvatarUrl: string | null;
  planItemId: UUID | null;
  diningGroupId: UUID | null;
  menu: RecipeContentSnapshot;
  menuItems: DiningEventMenuItemSummary[];
  participants: DiningEventParticipantSummary[];
  hasActiveShareLink: boolean;
  shareTokenPath: string | null;
  completedAt: IsoDateTime | null;
  version: number;
  createdAt: IsoDateTime;
}

export interface DiningEventShareLinkResponse {
  shareTokenPath: string;
  expiresAt: IsoDateTime | null;
}

export interface UpdateDiningEventNoteRequest {
  operationId: OperationId;
  expectedVersion: number;
  note: string | null;
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
  mealSlot: MealSlot | null;
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
  ingredientId: UUID | null;
  categoryName: string | null;
  name: string;
  quantityText: string | null;
  exactQuantity: string | null;
  exactUnitId: UUID | null;
  exactUnitName: string | null;
  note: string | null;
  available: boolean;
  expireAt: IsoDateTime | null;
  stockText: string | null;
  reservedText: string | null;
  availableText: string | null;
  reservations: Array<{
    shoppingListId: UUID;
    shoppingListName: string;
    shoppingItemId: UUID;
    reservedText: string;
  }>;
  updatedAt: IsoDateTime;
}

export interface CreateFridgeItemRequest {
  operationId: OperationId;
  name: string;
  ingredientId?: UUID | null;
  quantityText?: string | null;
  exactQuantity?: string | null;
  exactUnitId?: UUID | null;
  expireAt?: IsoDateTime | null;
  note?: string | null;
}

export interface UpdateFridgeItemRequest {
  operationId: OperationId;
  quantityText?: string | null;
  exactQuantity?: string | null;
  exactUnitId?: UUID | null;
  expireAt?: IsoDateTime | null;
  note?: string | null;
}

export interface ShoppingItemSummary {
  id: UUID;
  name: string;
  quantityText: string | null;
  note: string | null;
  sourceCount: number;
  sourceTitles: string[];
  sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
  sourceKey: string | null;
  status: "OPEN" | "BOUGHT" | "DELETED";
  updatedAt: IsoDateTime;
}

export type ShoppingGapWindow = "NEXT_48_HOURS" | "NEXT_7_DAYS" | "LATER";

export interface ShoppingGapEventSummary {
  eventId: UUID;
  title: string;
  scheduledAt: IsoDateTime;
  recipeTitles: string[];
}

export interface ShoppingGapItem {
  key: string;
  ingredientId: UUID | null;
  name: string;
  quantityText: string | null;
  sourceCount: number;
  eventCount: number;
  events: ShoppingGapEventSummary[];
}

export interface ShoppingGapSection {
  window: ShoppingGapWindow;
  title: string;
  description: string;
  itemCount: number;
  eventCount: number;
  items: ShoppingGapItem[];
}

export interface ShoppingGapResponse {
  sections: ShoppingGapSection[];
  totalItemCount: number;
  totalEventCount: number;
  hasLater: boolean;
  laterItemCount: number;
}

export type ShoppingListStatus = "ACTIVE" | "COMPLETED" | "VOIDED";
export type ShoppingListRole = "OWNER" | "COLLABORATOR";
export type ShoppingListInviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
export type ShoppingListInviteFilter = "ALL" | "PENDING" | "RESOLVED";
export type ShoppingListItemStatus = "OPEN" | "CHECKED" | "REMOVED";
export type ShoppingListItemFridgeAction = "APPLY" | "UNDO";
export type ShoppingListItemFridgeActionMode = "NONE" | "APPLY_FULL" | "APPLY_PARTIAL" | "NEED_CONFIRM" | "UNDO";
export type ShoppingInventoryStatus = "NONE" | "ENOUGH" | "SHORTAGE" | "UNKNOWN";

export interface ShoppingListStatusCount {
  status: ShoppingListStatus;
  count: number;
}

export interface ShoppingListSummaryResponse {
  statuses: ShoppingListStatusCount[];
  defaultStatus: ShoppingListStatus;
}

export interface ShoppingListSummary {
  id: UUID;
  name: string;
  status: ShoppingListStatus;
  role: ShoppingListRole;
  ownerUid: number;
  ownerNickname: string | null;
  memberCount: number;
  memberLimit: number;
  pendingInviteCount: number;
  progressDoneCount: number;
  progressTotalCount: number;
  hasActiveShareLink: boolean;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  completedAt: IsoDateTime | null;
  voidedAt: IsoDateTime | null;
}

export interface ShoppingListPageResponse {
  items: ShoppingListSummary[];
}

export interface ShoppingListInviteSummary {
  id: UUID;
  listId: UUID;
  name: string;
  ownerUid: number;
  ownerNickname: string | null;
  memberCount: number;
  memberLimit: number;
  itemCount: number;
  status: ShoppingListStatus;
  inviteStatus: ShoppingListInviteStatus;
  canJoin: boolean;
  invitedAt: IsoDateTime;
  handledAt: IsoDateTime | null;
}

export interface ShoppingListInvitePageResponse {
  items: ShoppingListInviteSummary[];
}

export interface ShoppingItemSourceSummary {
  sourceType: "MANUAL" | "RECIPE" | "PLAN" | "EVENT" | "BRING" | "RANDOM_MENU";
  title: string | null;
  recipeId: UUID | null;
  sourceVersionId: UUID | null;
  planItemId: UUID | null;
  diningEventId: UUID | null;
  sourceBatchKey: string | null;
  addCount: number | null;
  servings: number | null;
}

export interface ShoppingListDetailItem {
  id: UUID;
  ingredientId: UUID | null;
  name: string;
  categoryName: string | null;
  imageUrl: string | null;
  quantityText: string | null;
  requiredQuantityText: string | null;
  remainingQuantityText: string | null;
  appliedInventoryQuantityText: string | null;
  note: string | null;
  status: ShoppingListItemStatus;
  fridgeText: string | null;
  inventoryStatus: ShoppingInventoryStatus;
  inventoryApplied: boolean;
  inventoryCovered: boolean;
  fridgeStatusText: string | null;
  fridgeActionLabel: string | null;
  fridgeActionMode: ShoppingListItemFridgeActionMode;
  checkedAt: IsoDateTime | null;
  updatedAt: IsoDateTime;
  sources: ShoppingItemSourceSummary[];
}

export interface ShoppingListCollaborator {
  userId: UUID;
  role: ShoppingListRole;
  joinedAt: IsoDateTime;
  user: UserSummary;
}

export interface ShoppingListDetail extends ShoppingListSummary {
  collaborators: ShoppingListCollaborator[];
  items: ShoppingListDetailItem[];
}

export interface ShoppingListItemPatchResponse {
  listId: UUID;
  version: number;
  progressDoneCount: number;
  progressTotalCount: number;
  item: ShoppingListDetailItem | null;
  removedItemId: UUID | null;
}

export interface CreateShoppingListRequest {
  operationId: OperationId;
  name: string | null;
}

export interface ApplyShoppingListItemFridgeRequest {
  operationId: OperationId;
  version: number;
  action: ShoppingListItemFridgeAction;
}

export interface RenameShoppingListRequest {
  operationId: OperationId;
  version: number;
  name: string;
}

export interface CreateShoppingListItemRequest {
  operationId: OperationId;
  name: string;
  ingredientId: UUID | null;
  quantityText: string | null;
  note: string | null;
}

export interface AddShoppingGapItemsRequest {
  operationId: OperationId;
  window: ShoppingGapWindow;
  gapKeys: string[];
}

export interface AddRecipeToShoppingListRequest {
  operationId: OperationId;
  recipeId: UUID;
  sourceVersionId: UUID;
  planItemId?: UUID | null;
}

export interface AddPlanToShoppingListRequest {
  operationId: OperationId;
  planItemId: UUID;
}

export interface CreateRandomMenuShoppingIngredientRequest {
  ingredientId?: UUID | null;
  ingredientName: string;
  quantityText: string | null;
}

export interface CreateRandomMenuShoppingItemRequest {
  slotId: string;
  recipeId: UUID;
  recipeVersionId: UUID;
  ingredients: CreateRandomMenuShoppingIngredientRequest[];
}

export interface CreateRandomMenuShoppingItemsRequest {
  operationId: OperationId;
  items: CreateRandomMenuShoppingItemRequest[];
}

export interface UpdateShoppingListItemCheckRequest {
  operationId: OperationId;
  version: number;
  checked: boolean;
}

export interface RemoveShoppingListItemRequest {
  operationId: OperationId;
  version: number;
}

export interface UpdateShoppingListStatusRequest {
  operationId: OperationId;
  version: number;
}

export interface DeleteShoppingListRequest {
  operationId: OperationId;
  version: number;
}

export interface CompleteShoppingListEntryRequest {
  itemId: UUID;
  store: boolean;
  quantityText: string | null;
  expireDays: number | null;
  expireAt: string | null;
}

export interface CompleteShoppingListRequest {
  operationId: OperationId;
  version: number;
  entries: CompleteShoppingListEntryRequest[];
}

export interface ShareShoppingListLinkResponse {
  shareToken: string;
  shareUrl: string;
}

export interface RemoveShoppingListMemberRequest {
  operationId: OperationId;
  version: number;
}

export interface LeaveShoppingListRequest {
  operationId: OperationId;
  version: number;
}

export interface UpdateShoppingListInviteRequest {
  operationId: OperationId;
}

export interface ShoppingListInviteActionResponse {
  inviteId: UUID;
  status: ShoppingListInviteStatus;
  updatedAt: IsoDateTime;
}

export interface ShoppingSharePreview {
  listId: UUID;
  name: string;
  ownerUid: number;
  ownerNickname: string | null;
  memberCount: number;
  memberLimit: number;
  joined: boolean;
  canJoin: boolean;
  itemCount: number;
  status: ShoppingListStatus;
}

export interface ShoppingIngredientGroup {
  key: string;
  ingredientId: UUID;
  name: string;
  quantityLines: string[];
  recipeCount: number;
  recipeTitles: string[];
  updatedAt: IsoDateTime;
}

export interface ShoppingRecipeIngredientGroup {
  key: string;
  ingredientId: UUID;
  name: string;
  quantityLines: string[];
  updatedAt: IsoDateTime;
}

export interface ShoppingRecipeGroup {
  key: string;
  recipeId: UUID;
  sourceVersionId: UUID;
  title: string;
  addCount: number;
  totalServings: number;
  updatedAt: IsoDateTime;
  items: ShoppingRecipeIngredientGroup[];
}

export interface ShoppingBoardResponse {
  ingredientGroups: ShoppingIngredientGroup[];
  recipeGroups: ShoppingRecipeGroup[];
  otherItems: ShoppingItemSummary[];
}

export interface CreateRecipeShoppingItemsRequest {
  operationId: OperationId;
  recipeId: UUID;
  sourceVersionId: UUID;
}

export interface UpdateShoppingGroupStatusRequest {
  operationId: OperationId;
  targetKey: string;
  status: "OPEN" | "BOUGHT" | "DELETED";
}

export interface SharePreviewResponse {
  title: string;
  planItemId: UUID | null;
  planDate: string | null;
  mealSlot: MealSlot | null;
  scheduledAt: IsoDateTime;
  coverImageUrl: string | null;
  organizerName: string | null;
  menuPreview: string[];
  countdownText: string | null;
  locationHint: string | null;
}
