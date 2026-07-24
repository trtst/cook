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

const uuid = { type: "string" as const, format: "uuid" };
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

export class RecipeIngredientModel {
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) amount!: string;
}

export class RecipeStepModel {
  @ApiProperty({ type: String }) content!: string;
}

export class RecipeImageModel {
  @ApiProperty({ type: String }) key!: string;
  @ApiProperty({ type: String }) url!: string;
  @ApiProperty({ type: Number, minimum: 0 }) sizeBytes!: number;
}

export class RecipeContentModel {
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: [RecipeIngredientModel] }) ingredients!: RecipeIngredientModel[];
  @ApiProperty({ type: [RecipeStepModel] }) steps!: RecipeStepModel[];
  @ApiProperty(nullableString) servings!: string | null;
  @ApiProperty({ type: Number, nullable: true, minimum: 0 }) durationMinutes!: number | null;
  @ApiProperty({ type: [RecipeImageModel] }) images!: RecipeImageModel[];
}

export class RecipeSummaryModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String, enum: ["USER", "SYSTEM"] }) ownerType!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty(nullableString) coverImageUrl!: string | null;
  @ApiProperty({ ...uuid, nullable: true }) sourceRecipeId!: string | null;
  @ApiProperty({ type: Boolean }) isCustomized!: boolean;
  @ApiProperty({ type: String, enum: ["ACTIVE", "RECYCLED", "BLOCKED", "DELETED"] }) status!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class RecipeDetailModel extends RecipeSummaryModel {
  @ApiProperty({ type: Number, nullable: true }) ownerUid!: number | null;
  @ApiProperty({ type: RecipeContentModel }) content!: RecipeContentModel;
  @ApiProperty({ type: [String] }) hiddenBaseImages!: string[];
  @ApiProperty({ type: Boolean }) canEdit!: boolean;
  @ApiProperty({ type: Boolean }) canImport!: boolean;
  @ApiProperty({ type: Number, minimum: 1 }) version!: number;
  @ApiProperty(dateTime) createdAt!: string;
}

export class ImportRecipeResultModel {
  @ApiProperty({ type: RecipeDetailModel }) recipe!: RecipeDetailModel;
  @ApiProperty({ type: Boolean }) reusedExisting!: boolean;
}

export class DeleteRecipeResultModel {
  @ApiProperty(uuid) recipeId!: string;
  @ApiProperty({ type: String, enum: ["RECYCLED", "DELETED"] }) status!: string;
  @ApiProperty(dateTime) deletedAt!: string;
  @ApiProperty({ ...dateTime, nullable: true }) recycledUntil!: string | null;
}

export class RecipeReportModel {
  @ApiProperty(uuid) id!: string;
  @ApiProperty(uuid) recipeId!: string;
  @ApiProperty({ type: Number }) reporterUid!: number;
  @ApiProperty({ type: String }) reason!: string;
  @ApiProperty({ type: String, enum: ["OPEN", "RESOLVED"] }) status!: string;
  @ApiProperty(dateTime) createdAt!: string;
}

export class AdminRecipeModel extends RecipeSummaryModel {
  @ApiProperty({ type: Number, nullable: true }) ownerUid!: number | null;
  @ApiProperty({ type: Number, minimum: 0 }) reportCount!: number;
  @ApiProperty(nullableString) blockedReason!: string | null;
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
  @ApiProperty({ type: [RecipeImageModel] }) images!: RecipeImageModel[];
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
