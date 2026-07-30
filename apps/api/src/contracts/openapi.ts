import { applyDecorators, type Type } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiProperty, getSchemaPath } from "@nestjs/swagger";

function envelopeSchema(data: Record<string, unknown>) {
  return {
    type: "object",
    required: ["code", "message", "data", "serverTime"],
    properties: {
      code: { type: "integer", example: 0 },
      message: { type: "string", example: "ok" },
      data,
      serverTime: { type: "string", format: "date-time" }
    }
  };
}

export function ApiOkModel(model: Type<unknown>, description: string) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({ description, schema: envelopeSchema({ $ref: getSchemaPath(model) }) })
  );
}

export function ApiOkArray(model: Type<unknown>, description: string) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description,
      schema: envelopeSchema({ type: "array", items: { $ref: getSchemaPath(model) } })
    })
  );
}

export function ApiOkPage(model: Type<unknown>, description: string) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description,
      schema: envelopeSchema({
        type: "object",
        required: ["items", "page", "pageSize", "total", "hasNext"],
        properties: {
          items: { type: "array", items: { $ref: getSchemaPath(model) } },
          page: { type: "integer", minimum: 1 },
          pageSize: { type: "integer", minimum: 1, maximum: 100 },
          total: { type: "integer", minimum: 0 },
          hasNext: { type: "boolean" }
        }
      })
    })
  );
}

const uuid = { type: Number, minimum: 1 };
const dateTime = { type: "string" as const, format: "date-time" };
const nullableString = { type: String, nullable: true };
const tierValues = ["FREE", "PLUS", "PRO", "ULTRA"];

export class SessionUserModel {
  @ApiProperty({ type: Number }) uid!: number;
  @ApiProperty(nullableString) nickname!: string | null;
  @ApiProperty(nullableString) avatarUrl!: string | null;
}

export class PasswordLoginResultModel {
  @ApiProperty({ type: String }) token!: string;
  @ApiProperty(dateTime) expiresAt!: string;
  @ApiProperty({ type: SessionUserModel }) user!: SessionUserModel;
}

export class CodeLoginResultModel extends PasswordLoginResultModel {}

export class RefreshSessionResultModel {
  @ApiProperty({ type: String }) token!: string;
  @ApiProperty(dateTime) expiresAt!: string;
}

export class LoginImageConfigModel {
  @ApiProperty({ type: String, nullable: true }) imageUrl!: string | null;
}

export class AppConfigResponseModel {
  @ApiProperty({ type: LoginImageConfigModel }) login!: LoginImageConfigModel;
}

export class AdminIdentityModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) username!: string;
  @ApiProperty({ type: String }) displayName!: string;
  @ApiProperty({ type: [String] }) roles!: string[];
}

export class AdminLoginResultModel extends RefreshSessionResultModel {
  @ApiProperty({ type: AdminIdentityModel }) admin!: AdminIdentityModel;
}

export class UserDisplayModel {
  @ApiProperty(nullableString) profileBackgroundUrl!: string | null;
  @ApiProperty(nullableString) homeBackgroundUrl!: string | null;
  @ApiProperty({ type: Boolean }) canUseProfileBackground!: boolean;
  @ApiProperty({ type: Boolean }) canUseHomeBackground!: boolean;
}

export class UserMembershipModel {
  @ApiProperty({ type: String, enum: tierValues }) tier!: string;
  @ApiProperty({ ...dateTime, nullable: true }) validUntil!: string | null;
}

export class MeResponseModel extends SessionUserModel {
  @ApiProperty(nullableString) phone!: string | null;
  @ApiProperty({ type: UserDisplayModel }) display!: UserDisplayModel;
  @ApiProperty({ type: UserMembershipModel }) membership!: UserMembershipModel;
}

export class UserProfileModel extends SessionUserModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty(nullableString) phone!: string | null;
  @ApiProperty({ type: String }) status!: string;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class ChangePasswordResultModel {
  @ApiProperty(dateTime) changedAt!: string;
}

export class TasteProfileModel {
  @ApiProperty({ type: [String] }) allergies!: string[];
  @ApiProperty({ type: [String] }) strictDislikes!: string[];
  @ApiProperty({ type: [String] }) dislikedIngredients!: string[];
  @ApiProperty({ type: [String] }) flavorPreferences!: string[];
  @ApiProperty(nullableString) note!: string | null;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class UserSummaryModel {
  @ApiProperty({ type: Number }) uid!: number;
  @ApiProperty(nullableString) nickname!: string | null;
  @ApiProperty(nullableString) avatarUrl!: string | null;
}

export class DiningGroupSummaryModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Number }) ownerUid!: number;
  @ApiProperty({ type: Boolean }) isOwned!: boolean;
  @ApiProperty({ type: String, enum: ["OWNER", "ADMIN", "MEMBER"] }) myRole!: string;
  @ApiProperty({ type: String, enum: ["ACTIVE", "RESTRICTED", "ENDED"] }) myStatus!: string;
  @ApiProperty({ type: String, nullable: true }) myStatusReason!: string | null;
  @ApiProperty({ type: Number, minimum: 0 }) memberCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) memberLimit!: number;
  @ApiProperty({ type: String, enum: ["NORMAL", "OVER_MEMBER_LIMIT"] }) state!: string;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class DiningGroupUsageModel {
  @ApiProperty({ type: Number, minimum: 0 }) ownedCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) joinedCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) joinLimit!: number;
  @ApiProperty({ type: String, enum: ["NORMAL", "OVER_MEMBER_LIMIT"] }) state!: string;
}

export class MyDiningGroupsModel {
  @ApiProperty({ type: [DiningGroupSummaryModel] }) items!: DiningGroupSummaryModel[];
  @ApiProperty({ type: DiningGroupUsageModel }) usage!: DiningGroupUsageModel;
}

export class DiningGroupMemberModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty(uuid) diningGroupId!: string;
  @ApiProperty({ type: UserSummaryModel }) user!: UserSummaryModel;
  @ApiProperty({ type: String, enum: ["OWNER", "ADMIN", "MEMBER"] }) role!: string;
  @ApiProperty({ type: String, enum: ["ACTIVE", "RESTRICTED", "ENDED"] }) status!: string;
  @ApiProperty({ type: String, nullable: true }) statusReason!: string | null;
  @ApiProperty(dateTime) joinedAt!: string;
  @ApiProperty({ ...dateTime, nullable: true }) restrictedAt!: string | null;
  @ApiProperty({ ...dateTime, nullable: true }) endedAt!: string | null;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
}

export class DiningGroupMembersModel {
  @ApiProperty(uuid) diningGroupId!: string;
  @ApiProperty({ type: [DiningGroupMemberModel] }) members!: DiningGroupMemberModel[];
}

export class StorageModuleUsageModel {
  @ApiProperty({ enum: ["RECIPE", "FRIDGE", "MEAL", "SHOPPING", "MEAL_GUEST", "TECHNICAL_SNAPSHOT", "RECYCLE_BIN", "PROFILE_ASSET"] })
  module!: string;
  @ApiProperty({ type: Number, minimum: 0 }) usedBytes!: number;
}

export class StorageUsageModel {
  @ApiProperty({ type: String, enum: ["NORMAL", "OVER_STORAGE_READONLY"] }) state!: string;
  @ApiProperty({ type: Number, minimum: 0 }) usedBytes!: number;
  @ApiProperty({ type: Number, minimum: 0 }) limitBytes!: number;
  @ApiProperty({ type: Number, minimum: 0 }) remainingBytes!: number;
  @ApiProperty({ type: [StorageModuleUsageModel] }) byModule!: StorageModuleUsageModel[];
  @ApiProperty(dateTime) calculatedAt!: string;
}

export class CreateInviteResultModel {
  @ApiProperty({ type: String }) inviteToken!: string;
  @ApiProperty({ type: String }) sharePath!: string;
  @ApiProperty(dateTime) expiresAt!: string;
}

export class AcceptInviteResultModel {
  @ApiProperty({ type: DiningGroupSummaryModel }) diningGroup!: DiningGroupSummaryModel;
}

export class LeaveDiningGroupResultModel {
  @ApiProperty(uuid) diningGroupId!: string;
  @ApiProperty(dateTime) leftAt!: string;
}

export class RemoveDiningGroupMemberResultModel {
  @ApiProperty(uuid) diningGroupId!: string;
  @ApiProperty(uuid) userId!: string;
  @ApiProperty(dateTime) removedAt!: string;
}

export class DissolveDiningGroupResultModel {
  @ApiProperty(uuid) diningGroupId!: string;
  @ApiProperty(dateTime) dissolvedAt!: string;
}

export class ImagePolicyModel {
  @ApiProperty({ type: Number, minimum: 0 }) quality!: number;
  @ApiProperty({ type: Number, minimum: 0 }) maxWidth!: number;
  @ApiProperty({ type: Number, minimum: 0 }) maxHeight!: number;
  @ApiProperty({ type: Number, minimum: 0 }) maxOutputBytes!: number;
  @ApiProperty({ type: Number, minimum: 0 }) maxInputBytes!: number;
}

export class RecipePolicyModel {
  @ApiProperty({ type: Number, minimum: 0 }) recipeLimit!: number;
  @ApiProperty({ type: Number, minimum: 0 }) recycleDays!: number;
  @ApiProperty({ type: Number, minimum: 0 }) variantLimitPerRoot!: number;
}

export class InvitePolicyModel {
  @ApiProperty({ type: Number, minimum: 0 }) inviteLimit!: number;
  @ApiProperty({ type: Number, minimum: 0 }) memberLimit!: number;
}

export class AdminEntitlementUserModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: Number }) uid!: number;
  @ApiProperty(nullableString) nickname!: string | null;
  @ApiProperty({ type: String }) status!: string;
}

export class AdminDisplayCapabilityModel {
  @ApiProperty({ type: Boolean }) canUseProfileBackground!: boolean;
  @ApiProperty({ type: Boolean }) canUseHomeBackground!: boolean;
}

export class AdminUserEntitlementModel {
  @ApiProperty({ type: AdminEntitlementUserModel }) user!: AdminEntitlementUserModel;
  @ApiProperty({ type: UserMembershipModel }) membership!: UserMembershipModel;
  @ApiProperty({ type: AdminDisplayCapabilityModel }) display!: AdminDisplayCapabilityModel;
  @ApiProperty({ type: DiningGroupUsageModel }) diningGroupUsage!: DiningGroupUsageModel;
  @ApiProperty({ type: [DiningGroupSummaryModel] }) diningGroups!: DiningGroupSummaryModel[];
  @ApiProperty({ type: StorageUsageModel }) storage!: StorageUsageModel;
  @ApiProperty({ type: RecipePolicyModel }) recipePolicy!: RecipePolicyModel;
  @ApiProperty({ type: InvitePolicyModel }) invitePolicy!: InvitePolicyModel;
  @ApiProperty({ type: ImagePolicyModel }) imagePolicy!: ImagePolicyModel;
}

export class AdminResetUserPasswordResultModel {
  @ApiProperty(uuid) userId!: string;
  @ApiProperty(dateTime) resetAt!: string;
}

export class AdminDiningGroupModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty(uuid) ownerId!: string;
  @ApiProperty({ type: String, enum: ["ACTIVE", "ARCHIVED"] }) status!: string;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty({ type: Number, minimum: 0 }) memberCount!: number;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class AdminDashboardUserSummaryModel {
  @ApiProperty({ type: Number, minimum: 0 }) total!: number;
  @ApiProperty({ type: Number, minimum: 0 }) activeCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) disabledCount!: number;
}

export class AdminDashboardDiningGroupSummaryModel {
  @ApiProperty({ type: Number, minimum: 0 }) total!: number;
  @ApiProperty({ type: Number, minimum: 0 }) activeCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) memberCount!: number;
}

export class AdminDashboardRecipeSummaryModel {
  @ApiProperty({ type: Number, minimum: 0 }) total!: number;
  @ApiProperty({ type: Number, minimum: 0 }) activeCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) blockedCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) recycledCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) openReportCount!: number;
}

export class AdminDashboardIngredientSummaryModel {
  @ApiProperty({ type: Number, minimum: 0 }) categoryCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) itemCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) unitCount!: number;
}

export class AdminDashboardSummaryModel {
  @ApiProperty({ type: AdminDashboardUserSummaryModel }) user!: AdminDashboardUserSummaryModel;
  @ApiProperty({ type: AdminDashboardDiningGroupSummaryModel }) diningGroup!: AdminDashboardDiningGroupSummaryModel;
  @ApiProperty({ type: AdminDashboardRecipeSummaryModel }) recipe!: AdminDashboardRecipeSummaryModel;
  @ApiProperty({ type: AdminDashboardIngredientSummaryModel }) ingredient!: AdminDashboardIngredientSummaryModel;
}

export class RecipeCategoryModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
}

export class RecipeSceneModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
}

export class InspirationCategoryModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty(nullableString) iconKey!: string | null;
}

export class AdminInspirationCategoryModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty(nullableString) iconKey!: string | null;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty({ type: Number, minimum: 0 }) recipeCount!: number;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class IngredientCategoryModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
}

export class UnitModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, enum: ["WEIGHT", "VOLUME", "COUNT", "SHAPE", "CONTAINER", "PACKAGE", "OTHER"] }) type!: string;
  @ApiProperty({ type: String, enum: ["SYSTEM", "PERSONAL"] }) source!: string;
}

export class IngredientModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, enum: ["SYSTEM", "PERSONAL"] }) source!: string;
  @ApiProperty(uuid) categoryId!: string;
  @ApiProperty({ type: UnitModel }) defaultUnit!: UnitModel;
  @ApiProperty(nullableString) imageUrl!: string | null;
  @ApiProperty({ type: String, enum: ["PENDING", "REJECTED"], nullable: true }) recommendationStatus!: "PENDING" | "REJECTED" | null;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
}

export class IngredientRecommendationModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty(uuid) ingredientId!: string;
  @ApiProperty({ type: Number, minimum: 1 }) ingredientVersion!: number;
  @ApiProperty({ type: String }) ingredientName!: string;
  @ApiProperty({ type: String, enum: ["PENDING", "REJECTED", "ADOPTED", "MERGED"] }) status!: string;
  @ApiProperty({ type: IngredientCategoryModel }) category!: IngredientCategoryModel;
  @ApiProperty({ type: UnitModel }) defaultUnit!: UnitModel;
  @ApiProperty(nullableString) reviewNote!: string | null;
  @ApiProperty(nullableString) reviewAdvice!: string | null;
  @ApiProperty({ type: IngredientModel, nullable: true }) adoptedIngredient!: IngredientModel | null;
  @ApiProperty({ type: IngredientModel, nullable: true }) mergedIngredient!: IngredientModel | null;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
  @ApiProperty({ ...dateTime, nullable: true }) reviewedAt!: string | null;
}

export class RecipeAmountModel {
  @ApiProperty({ type: String, enum: ["EXACT", "FUZZY"] }) kind!: string;
  @ApiProperty({ type: String, nullable: true }) quantity!: string | null;
  @ApiProperty({ ...uuid, nullable: true }) unitId!: string | null;
  @ApiProperty(nullableString) unitName!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["WEIGHT", "VOLUME", "COUNT", "SHAPE", "CONTAINER", "PACKAGE", "OTHER"] })
  unitType!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["适量", "少许", "按需"] }) text!: string | null;
}

export class RecipeIngredientModel {
  @ApiProperty(uuid) ingredientId!: string;
  @ApiProperty({ type: String }) ingredientName!: string;
  @ApiProperty({ type: String, enum: ["SYSTEM", "PERSONAL"] }) source!: string;
  @ApiProperty(uuid) categoryId!: string;
  @ApiProperty({ type: RecipeAmountModel }) amount!: RecipeAmountModel;
}

export class RecipeStepModel {
  @ApiProperty({ type: String }) text!: string;
  @ApiProperty(nullableString) imageUrl!: string | null;
}

export class RecipeContentModel {
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty(nullableString) story!: string | null;
  @ApiProperty({ type: Number, minimum: 1, maximum: 20 }) baseServings!: number;
  @ApiProperty({ type: String, nullable: true, enum: ["BEGINNER", "EASY", "SKILLED", "CHALLENGING"] }) difficulty!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60"] }) duration!: string | null;
  @ApiProperty(nullableString) tips!: string | null;
  @ApiProperty({ type: [RecipeIngredientModel] }) ingredients!: RecipeIngredientModel[];
  @ApiProperty({ type: [RecipeStepModel] }) steps!: RecipeStepModel[];
}

export class RecipeIngredientInputAmountModel {
  @ApiProperty({ type: String, enum: ["EXACT", "FUZZY"] }) kind!: string;
  @ApiProperty({ type: String, nullable: true }) quantity!: string | null;
  @ApiProperty({ ...uuid, nullable: true }) unitId!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["适量", "少许", "按需"] }) text!: string | null;
}

export class RecipeIngredientInputModel {
  @ApiProperty(uuid) ingredientId!: string;
  @ApiProperty({ type: RecipeIngredientInputAmountModel }) amount!: RecipeIngredientInputAmountModel;
}

export class RecipeDraftIngredientModel {
  @ApiProperty({ ...uuid, nullable: true }) ingredientId!: string | null;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) quantity!: string;
  @ApiProperty({ ...uuid, nullable: true }) unitId!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["适量", "少许", "按需"] }) fuzzyText!: string | null;
  @ApiProperty({ ...uuid, nullable: true }) categoryId!: string | null;
  @ApiProperty({ ...uuid, nullable: true }) defaultUnitId!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["SYSTEM", "PERSONAL"] }) source!: string | null;
}

export class RecipeDraftStepModel {
  @ApiProperty({ type: String }) slotKey!: string;
  @ApiProperty({ type: String }) text!: string;
  @ApiProperty({ ...uuid, nullable: true }) uploadId!: string | null;
  @ApiProperty(nullableString) imageUrl!: string | null;
}

export class RecipeDraftContentModel {
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty(nullableString) story!: string | null;
  @ApiProperty({ ...uuid, nullable: true }) categoryId!: string | null;
  @ApiProperty({ type: [Number] }) sceneIds!: string[];
  @ApiProperty({ ...uuid, nullable: true }) originVersionId!: string | null;
  @ApiProperty(nullableString) originCoverImageUrl!: string | null;
  @ApiProperty({ ...uuid, nullable: true }) coverUploadId!: string | null;
  @ApiProperty(nullableString) coverImageUrl!: string | null;
  @ApiProperty({ type: Number, nullable: true, minimum: 1, maximum: 20 }) baseServings!: number | null;
  @ApiProperty({ type: String, nullable: true, enum: ["BEGINNER", "EASY", "SKILLED", "CHALLENGING"] }) difficulty!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60"] }) duration!: string | null;
  @ApiProperty(nullableString) tips!: string | null;
  @ApiProperty({ type: [RecipeDraftIngredientModel] }) ingredients!: RecipeDraftIngredientModel[];
  @ApiProperty({ type: [RecipeDraftStepModel] }) steps!: RecipeDraftStepModel[];
}

export class UploadImageModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) publicId!: string;
  @ApiProperty({ type: String, enum: ["RECIPE_COVER", "RECIPE_STEP"] }) scene!: string;
  @ApiProperty({ type: String }) slotKey!: string;
  @ApiProperty({ type: String, enum: ["TEMP", "BOUND", "DELETED"] }) status!: string;
  @ApiProperty({ type: String }) imageUrl!: string;
  @ApiProperty({ type: String }) contentType!: string;
  @ApiProperty({ type: Number, minimum: 0 }) sizeBytes!: number;
  @ApiProperty({ type: Number, minimum: 1 }) width!: number;
  @ApiProperty({ type: Number, minimum: 1 }) height!: number;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty({ ...dateTime, nullable: true }) expiresAt!: string | null;
}

export class UploadImageResultModel {
  @ApiProperty({ type: UploadImageModel }) upload!: UploadImageModel;
}

export class RecipeDraftSummaryModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ ...uuid, nullable: true }) recipeId!: string | null;
  @ApiProperty(nullableString) title!: string | null;
  @ApiProperty({ type: RecipeCategoryModel, nullable: true }) category!: RecipeCategoryModel | null;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class RecipeDraftDetailModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ ...uuid, nullable: true }) recipeId!: string | null;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty({ type: RecipeDraftContentModel }) content!: RecipeDraftContentModel;
  @ApiProperty({ type: [IngredientModel] }) ingredientRefs!: IngredientModel[];
  @ApiProperty({ type: [UnitModel] }) unitRefs!: UnitModel[];
  @ApiProperty({ type: RecipeCategoryModel, nullable: true }) category!: RecipeCategoryModel | null;
  @ApiProperty({ type: [RecipeSceneModel] }) scenes!: RecipeSceneModel[];
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class SaveRecipeDraftResultModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ ...uuid, nullable: true }) recipeId!: string | null;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class MyRecipeSummaryModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty(nullableString) coverImageUrl!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["BEGINNER", "EASY", "SKILLED", "CHALLENGING"] }) difficulty!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60"] }) duration!: string | null;
  @ApiProperty({ type: RecipeCategoryModel }) category!: RecipeCategoryModel;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class MyRecipeDetailModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty(nullableString) coverImageUrl!: string | null;
  @ApiProperty({ type: RecipeCategoryModel }) category!: RecipeCategoryModel;
  @ApiProperty({ type: [RecipeSceneModel] }) scenes!: RecipeSceneModel[];
  @ApiProperty(uuid) contentVersionId!: string;
  @ApiProperty({ type: RecipeContentModel }) content!: RecipeContentModel;
  @ApiProperty({ type: [IngredientModel] }) ingredientRefs!: IngredientModel[];
  @ApiProperty({ type: [UnitModel] }) unitRefs!: UnitModel[];
  @ApiProperty({ type: () => RecipeRecommendationModel, nullable: true }) recommendation!: RecipeRecommendationModel | null;
  @ApiProperty({ type: String, enum: ["ACTIVE", "RECYCLED", "BLOCKED", "DELETED"] }) status!: string;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class CollectionSceneModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty({ type: Number, minimum: 0 }) recipeCount!: number;
  @ApiProperty({ ...dateTime, nullable: true }) updatedAt!: string | null;
}

export class CollectionListModel {
  @ApiProperty({ type: [CollectionSceneModel] }) items!: CollectionSceneModel[];
  @ApiProperty({ type: Number, minimum: 0 }) totalCount!: number;
}

export class CollectedRecipeSummaryModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty(uuid) sourceRecipeId!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty(nullableString) coverImageUrl!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["BEGINNER", "EASY", "SKILLED", "CHALLENGING"] }) difficulty!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60"] }) duration!: string | null;
  @ApiProperty({ type: InspirationCategoryModel }) category!: InspirationCategoryModel;
  @ApiProperty({ type: [RecipeSceneModel] }) scenes!: RecipeSceneModel[];
  @ApiProperty(uuid) contentVersionId!: string;
  @ApiProperty(dateTime) collectedAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class CollectedRecipeDetailModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty(uuid) sourceRecipeId!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty(nullableString) coverImageUrl!: string | null;
  @ApiProperty({ type: InspirationCategoryModel }) category!: InspirationCategoryModel;
  @ApiProperty({ type: [RecipeSceneModel] }) scenes!: RecipeSceneModel[];
  @ApiProperty(uuid) contentVersionId!: string;
  @ApiProperty({ type: RecipeContentModel }) content!: RecipeContentModel;
  @ApiProperty(dateTime) collectedAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class SaveCollectionRecipeResultModel {
  @ApiProperty({ type: CollectedRecipeDetailModel }) recipe!: CollectedRecipeDetailModel;
}

export class PublishRecipeDraftResultModel {
  @ApiProperty({ type: MyRecipeDetailModel }) recipe!: MyRecipeDetailModel;
}

export class DeleteRecipeDraftResultModel {
  @ApiProperty(uuid) draftId!: string;
  @ApiProperty(dateTime) deletedAt!: string;
}

export class DeleteRecipeResultModel {
  @ApiProperty(uuid) recipeId!: string;
  @ApiProperty({ type: String, enum: ["RECYCLED", "DELETED"] }) status!: string;
  @ApiProperty(dateTime) deletedAt!: string;
  @ApiProperty({ ...dateTime, nullable: true }) recycledUntil!: string | null;
}

export class InspirationRecipeSummaryModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty(nullableString) coverImageUrl!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["BEGINNER", "EASY", "SKILLED", "CHALLENGING"] }) difficulty!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60"] }) duration!: string | null;
  @ApiProperty({ type: InspirationCategoryModel }) category!: InspirationCategoryModel;
  @ApiProperty({ type: Number, minimum: 0 }) likeCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) collectCount!: number;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class InspirationRecipeDetailModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty(nullableString) coverImageUrl!: string | null;
  @ApiProperty({ type: InspirationCategoryModel }) category!: InspirationCategoryModel;
  @ApiProperty(uuid) contentVersionId!: string;
  @ApiProperty({ type: RecipeContentModel }) content!: RecipeContentModel;
  @ApiProperty({ type: Number, minimum: 0 }) likeCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) collectCount!: number;
  @ApiProperty(nullableString) curatedByName!: string | null;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class RecipeRecommendationModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty(uuid) recipeId!: string;
  @ApiProperty(uuid) sourceVersionId!: string;
  @ApiProperty({ type: String }) recipeTitle!: string;
  @ApiProperty({ type: String }) curatedByName!: string;
  @ApiProperty({ type: InspirationCategoryModel }) suggestedCategory!: InspirationCategoryModel;
  @ApiProperty({ type: String, enum: ["PENDING", "REJECTED", "ADOPTED", "WITHDRAWN"] }) status!: string;
  @ApiProperty(nullableString) reviewNote!: string | null;
  @ApiProperty({ ...uuid, nullable: true }) adoptedRecipeId!: string | null;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
  @ApiProperty({ ...dateTime, nullable: true }) reviewedAt!: string | null;
  @ApiProperty({ ...dateTime, nullable: true }) withdrawnAt!: string | null;
}

export class RecipeReportModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty(uuid) recipeId!: string;
  @ApiProperty({ type: Number }) reporterUid!: number;
  @ApiProperty({ type: String }) reason!: string;
  @ApiProperty({ type: String, enum: ["OPEN", "RESOLVED"] }) status!: string;
  @ApiProperty(dateTime) createdAt!: string;
}

export class AdminRecipeModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty(nullableString) coverImageUrl!: string | null;
  @ApiProperty({ type: String, enum: ["ACTIVE", "RECYCLED", "BLOCKED", "DELETED"] }) status!: string;
  @ApiProperty(uuid) inspirationCategoryId!: string;
  @ApiProperty({ type: String }) inspirationCategoryName!: string;
  @ApiProperty(dateTime) updatedAt!: string;
  @ApiProperty({ type: Number, nullable: true }) ownerUid!: number | null;
}

export class AdminRecipeContentInputModel {
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty(nullableString) story!: string | null;
  @ApiProperty({ type: Number, minimum: 1, maximum: 20 }) baseServings!: number;
  @ApiProperty({ type: String, enum: ["BEGINNER", "EASY", "SKILLED", "CHALLENGING"] }) difficulty!: string;
  @ApiProperty({ type: String, enum: ["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60"] }) duration!: string;
  @ApiProperty(nullableString) tips!: string | null;
  @ApiProperty({ type: [RecipeIngredientInputModel] }) ingredients!: RecipeIngredientInputModel[];
  @ApiProperty({ type: [RecipeStepModel] }) steps!: RecipeStepModel[];
}

export class AdminRecipeDetailModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty(nullableString) coverImageUrl!: string | null;
  @ApiProperty({ type: String, enum: ["ACTIVE", "RECYCLED", "BLOCKED", "DELETED"] }) status!: string;
  @ApiProperty({ type: Number, nullable: true }) ownerUid!: number | null;
  @ApiProperty({ type: RecipeCategoryModel, nullable: true }) personalCategory!: RecipeCategoryModel | null;
  @ApiProperty({ type: InspirationCategoryModel, nullable: true }) inspirationCategory!: InspirationCategoryModel | null;
  @ApiProperty(uuid) contentVersionId!: string;
  @ApiProperty({ type: RecipeContentModel }) content!: RecipeContentModel;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty({ type: Number, minimum: 0 }) reportCount!: number;
  @ApiProperty(nullableString) blockedReason!: string | null;
  @ApiProperty({ type: Number, minimum: 0 }) likeCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) collectCount!: number;
  @ApiProperty({ type: Boolean }) canEdit!: boolean;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class AdminIngredientSuggestionUserModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: Number }) uid!: number;
  @ApiProperty(nullableString) nickname!: string | null;
}

export class AdminPendingRecipeModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty(uuid) recipeId!: string;
  @ApiProperty({ type: String }) recipeTitle!: string;
  @ApiProperty(uuid) contentVersionId!: string;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty({ type: String, enum: ["PENDING"] }) status!: string;
  @ApiProperty({ type: InspirationCategoryModel }) suggestedCategory!: InspirationCategoryModel;
  @ApiProperty({ type: RecipeCategoryModel, nullable: true }) personalCategory!: RecipeCategoryModel | null;
  @ApiProperty({ type: () => AdminIngredientSuggestionUserModel }) user!: AdminIngredientSuggestionUserModel;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class AdminReviewPendingRecipeResultModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String, enum: ["APPROVED", "REJECTED"] }) status!: string;
  @ApiProperty(dateTime) reviewedAt!: string;
  @ApiProperty({ ...uuid, nullable: true }) targetRecipeId!: string | null;
}

export class AdminIngredientCategoryModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Boolean }) isSelectable!: boolean;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty({ type: Number, minimum: 0 }) ingredientCount!: number;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class AdminIngredientModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty({ type: String, enum: ["ACTIVE", "DISABLED"] }) status!: string;
  @ApiProperty(uuid) categoryId!: string;
  @ApiProperty({ type: String }) categoryName!: string;
  @ApiProperty({ type: UnitModel }) defaultUnit!: UnitModel;
  @ApiProperty(nullableString) imageUrl!: string | null;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class AdminPendingIngredientModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty({ ...uuid, nullable: true }) categoryId!: string | null;
  @ApiProperty(nullableString) categoryName!: string | null;
  @ApiProperty({ ...uuid, nullable: true }) defaultUnitId!: string | null;
  @ApiProperty(nullableString) defaultUnitName!: string | null;
  @ApiProperty({ type: String, enum: ["PENDING"] }) status!: string;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
  @ApiProperty({ type: () => AdminIngredientSuggestionUserModel }) user!: AdminIngredientSuggestionUserModel;
}

export class AdminReviewPendingIngredientResultModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String, enum: ["APPROVED", "REJECTED"] }) status!: string;
  @ApiProperty(dateTime) reviewedAt!: string;
  @ApiProperty({ ...uuid, nullable: true }) targetIngredientId!: string | null;
}

export class AdminUnitModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, enum: ["WEIGHT", "VOLUME", "COUNT", "SHAPE", "CONTAINER", "PACKAGE", "OTHER"] }) type!: string;
  @ApiProperty({ type: String, enum: ["SYSTEM"] }) source!: string;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class AdminDeleteUnitResultModel {
  @ApiProperty(uuid) unitId!: string;
  @ApiProperty(dateTime) deletedAt!: string;
}

export class AdminUserRecipeDomainUserModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: Number }) uid!: number;
  @ApiProperty(nullableString) nickname!: string | null;
}

export class AdminUserRecipeDomainOverviewModel {
  @ApiProperty({ type: AdminUserRecipeDomainUserModel }) user!: AdminUserRecipeDomainUserModel;
  @ApiProperty({ type: Number, minimum: 0 }) publishedCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) draftCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) collectionCount!: number;
  @ApiProperty({ type: Number, minimum: 0 }) sceneCount!: number;
  @ApiProperty({ ...dateTime, nullable: true }) latestPublishedAt!: string | null;
  @ApiProperty({ ...dateTime, nullable: true }) latestDraftAt!: string | null;
  @ApiProperty({ ...dateTime, nullable: true }) latestCollectionAt!: string | null;
}

export class MealPlanModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String, format: "date" }) planDate!: string;
  @ApiProperty({ type: String, enum: ["BREAKFAST", "LUNCH", "DINNER"] }) mealSlot!: string;
  @ApiProperty({ ...uuid, nullable: true }) recipeId!: string | null;
  @ApiProperty(uuid) recipeVersionId!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: Boolean }) hasDiningEvent!: boolean;
  @ApiProperty({ ...uuid, nullable: true }) diningEventId!: string | null;
  @ApiProperty(dateTime) createdAt!: string;
}

export class DiningEventParticipantModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: Number, nullable: true }) userUid!: number | null;
  @ApiProperty(nullableString) guestName!: string | null;
  @ApiProperty({ type: String, enum: ["DINING_GROUP", "SHARE"] }) sourceType!: string;
  @ApiProperty({ type: String, enum: ["INVITED", "ACCEPTED", "DECLINED", "REMOVED"] }) status!: string;
  @ApiProperty({ ...uuid, nullable: true }) bringRecipeId!: string | null;
  @ApiProperty(nullableString) bringRecipeTitle!: string | null;
}

export class DiningEventModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty(dateTime) scheduledAt!: string;
  @ApiProperty(nullableString) location!: string | null;
  @ApiProperty({ type: String, enum: ["PLANNED", "CONFIRMED", "CANCELLED"] }) status!: string;
  @ApiProperty({ ...uuid, nullable: true }) planItemId!: string | null;
  @ApiProperty({ ...uuid, nullable: true }) diningGroupId!: string | null;
  @ApiProperty({ type: RecipeContentModel }) menu!: RecipeContentModel;
  @ApiProperty({ type: [DiningEventParticipantModel] }) participants!: DiningEventParticipantModel[];
  @ApiProperty(nullableString) shareTokenPath!: string | null;
  @ApiProperty(dateTime) createdAt!: string;
}

export class ShareMenuModel {
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: [RecipeIngredientModel] }) ingredients!: RecipeIngredientModel[];
}

export class SharePreviewModel {
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty(dateTime) scheduledAt!: string;
  @ApiProperty(nullableString) location!: string | null;
  @ApiProperty({ type: ShareMenuModel }) menu!: ShareMenuModel;
  @ApiProperty({ type: Number }) organizerUid!: number;
}

export class FridgeItemModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty(nullableString) quantityText!: string | null;
  @ApiProperty(nullableString) note!: string | null;
  @ApiProperty({ type: Boolean }) available!: boolean;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class ShoppingItemModel {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty(nullableString) quantityText!: string | null;
  @ApiProperty(nullableString) note!: string | null;
  @ApiProperty({ type: String, enum: ["MANUAL", "PLAN", "EVENT", "BRING"] }) sourceType!: string;
  @ApiProperty(nullableString) sourceKey!: string | null;
  @ApiProperty({ type: String, enum: ["OPEN", "BOUGHT", "DELETED"] }) status!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}
