import type {
  CarryBackSnapshotStatus,
  CarryItemType,
  DiningGroupStatus,
  DiningGroupInviteStatus,
  DiningGroupRole,
  DuplicateState,
  EntitlementScope,
  EntitlementTier,
  GuestInvitationAction,
  ImportableItemType,
  IsoDateTime,
  LongTermMemberStatusReason,
  LongTermMemberStatus,
  MealGuestInvitationStatus,
  OriginalSpaceStatus,
  RecipeOriginType,
  RecipeRecordStatus,
  SpaceState,
  StorageModule,
  UUID
} from "@next-meal/domain";

export type {
  CarryBackSnapshotStatus,
  CarryItemType,
  DiningGroupStatus,
  DiningGroupInviteStatus,
  DiningGroupRole,
  DuplicateState,
  EntitlementScope,
  EntitlementTier,
  GuestInvitationAction,
  ImportableItemType,
  IsoDateTime,
  LongTermMemberStatusReason,
  LongTermMemberStatus,
  MealGuestInvitationStatus,
  OriginalSpaceStatus,
  RecipeOriginType,
  RecipeRecordStatus,
  SpaceState,
  StorageModule,
  UUID
};

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  serverTime: IsoDateTime;
}

export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface UserProfile {
  id: UUID;
  /** Non-sequential public user number for display and support lookup. */
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  status: "ACTIVE" | string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface UserBasic {
  id: UUID;
  /** Non-sequential public user number for display and support lookup. */
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
}

export interface UserSummary {
  id: UUID;
  /** Non-sequential public user number for display and support lookup. */
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
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

export interface PendingImportCounts {
  recipe: number;
  fridgeItem: number;
  planDraft: number;
  shoppingItem: number;
}

/** 服务端唯一当前长期空间摘要。 */
export interface CurrentSpaceSummary {
  id: UUID;
  name: string;
  ownerId: UUID;
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

export interface CarryRecipeItem {
  itemId: UUID;
  itemType: "RECIPE";
  name: string;
  fixedVersionId: UUID;
  estimatedBytes: number;
}

export interface CarryFridgeItem {
  itemId: UUID;
  itemType: "FRIDGE_ITEM";
  ingredientName: string;
  quantityText: string | null;
  confirmRequired: true;
  estimatedBytes: number;
}

export interface CarryShoppingItem {
  itemId: UUID;
  itemType: "SHOPPING_ITEM";
  title: string;
  estimatedBytes: number;
}

export type CarryBackItem = CarryRecipeItem | CarryFridgeItem | CarryShoppingItem;

export interface StorageModuleUsage {
  module: StorageModule;
  usedBytes: number;
}

export interface EffectiveImagePolicy {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  maxOutputBytes: number;
  maxInputBytes: number;
}

/** 服务端已解析的有效权益，调用端不得自行叠加个人和饭搭子权益。 */
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
  byModule: StorageModuleUsage[];
}

export interface RecipeImportableItem {
  itemType: "RECIPE";
  itemId: UUID;
  recipeId: UUID;
  name: string;
  duplicateState: DuplicateState;
  estimatedBytes: number;
  sourceVersionId: UUID | null;
  currentVersionId: UUID;
}

export interface FridgeItemImportableItem {
  itemType: "FRIDGE_ITEM";
  itemId: UUID;
  ingredientName: string;
  quantityText: string | null;
  confirmRequired: true;
  estimatedBytes: number;
}

export interface PlanDraftImportableItem {
  itemType: "PLAN_DRAFT";
  itemId: UUID;
  title: string;
  scheduledAt: IsoDateTime | null;
  estimatedBytes: number;
}

export interface ShoppingImportableItem {
  itemType: "SHOPPING_ITEM";
  itemId: UUID;
  title: string;
  estimatedBytes: number;
}

export type ImportableItem =
  | RecipeImportableItem
  | FridgeItemImportableItem
  | PlanDraftImportableItem
  | ShoppingImportableItem;

export interface TasteProfileResponse {
  allergies: string[];
  strictDislikes: string[];
  dislikedIngredients: string[];
  flavorPreferences: string[];
  note: string | null;
  updatedAt: IsoDateTime;
}

export interface MealGuestInvitationSummary {
  id: UUID;
  mealPlanId: UUID;
  guestUserId: UUID;
  status: MealGuestInvitationStatus;
  respondedAt: IsoDateTime | null;
  expiresAt: IsoDateTime;
}

export interface RecipeSummary {
  id: UUID;
  dishConceptId: UUID;
  rootRecipeId: UUID | null;
  name: string;
  variantName: string | null;
  originType: RecipeOriginType;
  status: RecipeRecordStatus;
  coverUrl: string | null;
  sourceVersionId: UUID | null;
  currentVersionId: UUID;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RecipeIngredientInput {
  ingredientName: string;
  amountText: string | null;
}

export interface RecipeStepInput {
  text: string;
  imageAssetId: UUID | null;
}

export interface RecipeContentInput {
  servingsText: string | null;
  durationText: string | null;
  difficultyText: string | null;
  ingredients: RecipeIngredientInput[];
  steps: RecipeStepInput[];
}
