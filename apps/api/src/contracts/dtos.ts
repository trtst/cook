import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsBoolean,
  IsArray,
  IsDefined,
  IsEmpty,
  IsInt,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested
} from "class-validator";

function trimItems(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map(item => (typeof item === "string" ? item.trim() : item));
}

export class PasswordLoginDto {
  @ApiProperty({ example: "13800000000" })
  @IsString()
  @MaxLength(11)
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string;

  @ApiProperty({ example: "change-me" })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}

export class CodeLoginDto {
  @ApiProperty({ example: "13800000000" })
  @IsString()
  @MaxLength(11)
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class AdminLoginDto {
  @ApiProperty({ example: "admin" })
  @IsString()
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: "password" })
  @IsString()
  @MaxLength(128)
  password!: string;
}

export class UpdateCurrentUserDto {
  @ApiPropertyOptional({ example: "小明" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @ApiPropertyOptional({ example: "https://example.com/avatar.png" })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string;
}

export class ChangeCurrentPasswordDto {
  @ApiProperty({ example: "change-me" })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ example: "change-me-2" })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword!: string;
}

export class UpdateTasteProfileDto {
  @ApiProperty({ type: [String], maxItems: 50 })
  @Transform(({ value }) => trimItems(value))
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(64, { each: true })
  allergies!: string[];

  @ApiProperty({ type: [String], maxItems: 50 })
  @Transform(({ value }) => trimItems(value))
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(64, { each: true })
  strictDislikes!: string[];

  @ApiProperty({ type: [String], maxItems: 50 })
  @Transform(({ value }) => trimItems(value))
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(64, { each: true })
  dislikedIngredients!: string[];

  @ApiProperty({ type: [String], maxItems: 50 })
  @Transform(({ value }) => trimItems(value))
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(64, { each: true })
  flavorPreferences!: string[];

  @ApiProperty({ nullable: true, maxLength: 1000 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  note!: string | null;
}

export class OperationDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  operationId!: string;
}

export class CreateAdminUserDto extends OperationDto {
  @ApiProperty({ example: "13800000000" })
  @IsString()
  @MaxLength(11)
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string;

  @ApiProperty({ example: "change-me" })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: "小明" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @ApiPropertyOptional({ example: "ACTIVE" })
  @IsOptional()
  @IsIn(["ACTIVE", "DISABLED"])
  status?: "ACTIVE" | "DISABLED";
}

export class UpdateAdminUserDto extends OperationDto {
  @ApiPropertyOptional({ example: "小明" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @ApiPropertyOptional({ example: "13800000000" })
  @IsOptional()
  @IsString()
  @MaxLength(11)
  @Matches(/^1[3-9]\d{9}$/)
  phone?: string;
}

export class SetAdminUserStatusDto extends OperationDto {
  @ApiProperty({ example: "DISABLED" })
  @IsIn(["ACTIVE", "DISABLED"])
  status!: "ACTIVE" | "DISABLED";
}

export class ResetAdminUserPasswordDto extends OperationDto {
  @ApiProperty({ example: "change-me-2" })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword!: string;
}

export class UpdateLoginImageDto extends OperationDto {}

export class VersionedOperationDto extends OperationDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class DiningGroupMembersQueryDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  diningGroupId!: string;
}

export class CreateInviteDto extends OperationDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  diningGroupId!: string;
}

export class RemoveDiningGroupMemberDto extends VersionedOperationDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  userId!: string;
}

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyword?: string;
}

export class AdminDiningGroupQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "ACTIVE" })
  @IsOptional()
  @IsIn(["ACTIVE", "ARCHIVED"])
  status?: string;
}

export class AdminUserEntitlementQueryDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  userId!: string;
}

export class RecipeListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class RecipeDraftListQueryDto extends PageQueryDto {}

export class IngredientListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: "ALL" })
  @IsOptional()
  @IsIn(["SYSTEM", "PERSONAL", "ALL"])
  source?: string;
}

export class UnitListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "WEIGHT" })
  @IsOptional()
  @IsIn(["WEIGHT", "VOLUME", "COUNT", "SHAPE", "CONTAINER", "PACKAGE", "OTHER"])
  type?: string;

  @ApiPropertyOptional({ example: "ALL" })
  @IsOptional()
  @IsIn(["SYSTEM", "PERSONAL", "ALL"])
  source?: string;
}

export class IngredientRecommendationListQueryDto extends PageQueryDto {}

export class InspirationRecipeListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: "RECOMMENDED" })
  @IsOptional()
  @IsIn(["RECOMMENDED", "LATEST"])
  sort?: string;

  @ApiPropertyOptional({ example: "BEGINNER" })
  @IsOptional()
  @IsIn(["BEGINNER", "EASY", "SKILLED", "CHALLENGING"])
  difficulty?: string;

  @ApiPropertyOptional({ example: "WITHIN_15" })
  @IsOptional()
  @IsIn(["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60"])
  duration?: string;
}

export class CollectionRecipeListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsOptional()
  @IsUUID()
  sceneId?: string;
}

export class MealPlanQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "2026-07-23" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: "2026-07-30" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class RecipeCategoryNameDto extends OperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name!: string;
}

export class UpdateRecipeCategoryDto extends VersionedOperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name!: string;
}

export class RecipeSceneNameDto extends OperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name!: string;
}

export class UpdateRecipeSceneDto extends VersionedOperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name!: string;
}

export class ReorderItemDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  id!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ReorderRecipeCategoriesDto extends OperationDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

export class ReorderRecipeScenesDto extends OperationDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

export class ReorderRecipesDto extends OperationDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

export class CreateUnitDto extends OperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  name!: string;

  @ApiProperty({ example: "WEIGHT" })
  @IsIn(["WEIGHT", "VOLUME", "COUNT", "SHAPE", "CONTAINER", "PACKAGE", "OTHER"])
  type!: string;
}

export class CreateIngredientDto extends OperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  defaultUnitId!: string;
}

export class UpdateIngredientDto extends VersionedOperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  defaultUnitId!: string;
}

export class RecommendIngredientDto extends OperationDto {}

export class RecipeAmountDto {
  @ApiProperty({ example: "EXACT" })
  @IsIn(["EXACT", "FUZZY"])
  kind!: string;

  @ApiPropertyOptional({ example: "2.5" })
  @ValidateIf(object => object.kind === "EXACT")
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  quantity?: string;

  @ApiPropertyOptional({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @ValidateIf(object => object.kind === "EXACT")
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ example: "适量" })
  @ValidateIf(object => object.kind === "FUZZY")
  @IsIn(["适量", "少许", "按需"])
  text?: string;
}

export class RecipeIngredientDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  ingredientId!: string;

  @ApiProperty({ type: RecipeAmountDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RecipeAmountDto)
  amount!: RecipeAmountDto;
}

export class RecipeStepDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  text!: string;
}

export class RecipeDraftContentDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ nullable: true, maxLength: 2000 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  story!: string | null;

  @ApiProperty({ nullable: true, example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  categoryId!: string | null;

  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  sceneIds!: string[];

  @ApiProperty({ nullable: true, minimum: 1, maximum: 20 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  baseServings!: number | null;

  @ApiPropertyOptional({ nullable: true, example: "BEGINNER" })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsIn(["BEGINNER", "EASY", "SKILLED", "CHALLENGING"])
  difficulty!: string | null;

  @ApiPropertyOptional({ nullable: true, example: "WITHIN_15" })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsIn(["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60"])
  duration!: string | null;

  @ApiProperty({ nullable: true, maxLength: 1000 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  tips!: string | null;

  @ApiProperty({ type: [RecipeIngredientDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];

  @ApiProperty({ type: [RecipeStepDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecipeStepDto)
  steps!: RecipeStepDto[];
}

export class CreateRecipeDraftDto extends OperationDto {
  @ApiProperty({ nullable: true, example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  recipeId!: string | null;

  @ApiProperty({ type: RecipeDraftContentDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RecipeDraftContentDto)
  content!: RecipeDraftContentDto;
}

export class UpdateRecipeDraftDto extends VersionedOperationDto {
  @ApiProperty({ type: RecipeDraftContentDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RecipeDraftContentDto)
  content!: RecipeDraftContentDto;
}

export class DeleteRecipeDraftDto extends VersionedOperationDto {}

export class PublishRecipeDraftDto extends VersionedOperationDto {}

export class DeleteRecipeDto extends VersionedOperationDto {}

export class CreateCollectionRecipeDto extends OperationDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  sourceRecipeId!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  sourceVersionId!: string;

  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  sceneIds!: string[];
}

export class ReportRecipeDto extends OperationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  reason!: string;
}

export class CreateMealPlanDto extends OperationDto {
  @ApiProperty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  planDate!: string;

  @ApiProperty()
  @IsIn(["BREAKFAST", "LUNCH", "DINNER"])
  mealSlot!: string;

  @ApiProperty()
  @IsUUID()
  recipeId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(255)
  note?: string | null;
}

export class CreateDiningEventDto extends OperationDto {
  @ApiProperty()
  @IsISO8601({ strict: true })
  scheduledAt!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(255)
  location?: string | null;
}

export class InviteDiningGroupParticipantsDto extends OperationDto {
  @ApiProperty()
  @IsUUID()
  diningGroupId!: string;
}

export class RespondDiningEventDto extends OperationDto {
  @ApiProperty({ example: "ACCEPTED" })
  @IsIn(["ACCEPTED", "DECLINED"])
  status!: string;
}

export class AcceptShareInviteDto extends OperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  guestName!: string;
}

export class ChooseBringRecipeDto extends OperationDto {
  @ApiProperty()
  @IsUUID()
  recipeId!: string;
}

export class CreateFridgeItemDto extends OperationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(64)
  quantityText?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(255)
  note?: string | null;
}

export class UpdateFridgeItemDto extends CreateFridgeItemDto {}

export class CreateShoppingItemDto extends OperationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(64)
  quantityText?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(255)
  note?: string | null;
}

export class ShoppingItemQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "OPEN" })
  @IsOptional()
  @IsIn(["OPEN", "BOUGHT", "DELETED"])
  status?: string;
}

export class ShoppingGapQueryDto {
  @ApiProperty()
  @IsUUID()
  eventId!: string;
}

export class UpdateShoppingStatusDto extends OperationDto {
  @ApiProperty({ example: "BOUGHT" })
  @IsIn(["OPEN", "BOUGHT", "DELETED"])
  status!: string;
}

export class ConsumeFridgeItemsDto extends OperationDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  itemIds!: string[];
}

export class AdminRecipeQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "ACTIVE" })
  @IsOptional()
  @IsIn(["ACTIVE", "RECYCLED", "BLOCKED", "DELETED"])
  status?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean()
  reportsOnly?: boolean;
}

export class AdminRecipeReportQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "OPEN" })
  @IsOptional()
  @IsIn(["OPEN", "RESOLVED"])
  status?: string;
}

export class AdminIngredientCategoryQueryDto {
  @ApiPropertyOptional({ example: "蔬菜" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(20)
  keyword?: string;
}

export class AdminIngredientQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "西红柿" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  declare keyword?: string;

  @ApiPropertyOptional({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: "ACTIVE", enum: ["ACTIVE", "DISABLED", "ALL"] })
  @IsOptional()
  @IsIn(["ACTIVE", "DISABLED", "ALL"])
  status?: "ACTIVE" | "DISABLED" | "ALL";
}

export class AdminUnitPayloadDto extends OperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  name!: string;

  @ApiProperty({ example: "WEIGHT" })
  @IsIn(["WEIGHT", "VOLUME", "COUNT", "SHAPE", "CONTAINER", "PACKAGE", "OTHER"])
  type!: string;
}

export class UpdateAdminUnitDto extends VersionedOperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  name!: string;

  @ApiProperty({ example: "WEIGHT" })
  @IsIn(["WEIGHT", "VOLUME", "COUNT", "SHAPE", "CONTAINER", "PACKAGE", "OTHER"])
  type!: string;
}

export class DeleteAdminUnitDto extends VersionedOperationDto {}

export class ReorderAdminUnitsDto extends OperationDto {
  @ApiProperty({ example: "WEIGHT" })
  @IsIn(["WEIGHT", "VOLUME", "COUNT", "SHAPE", "CONTAINER", "PACKAGE", "OTHER"])
  type!: string;

  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

export class AdminIngredientCategoryNameDto extends OperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name!: string;
}

export class UpdateAdminIngredientCategoryDto extends VersionedOperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name!: string;
}

export class ReorderAdminIngredientCategoriesDto extends OperationDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

export class AdminIngredientPayloadDto extends OperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  defaultUnitId!: string;
}

export class UpdateAdminIngredientDto extends VersionedOperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  defaultUnitId!: string;
}

export class UpdateAdminIngredientImageDto extends VersionedOperationDto {}

export class SetAdminIngredientStatusDto extends VersionedOperationDto {
  @ApiProperty({ example: "DISABLED", enum: ["ACTIVE", "DISABLED"] })
  @IsIn(["ACTIVE", "DISABLED"])
  status!: "ACTIVE" | "DISABLED";
}

export class ReorderAdminIngredientsDto extends OperationDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

export class AdminPendingIngredientQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "西红柿" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  declare keyword?: string;
}

export class ReviewPendingIngredientDto extends VersionedOperationDto {
  @ApiProperty({ example: "APPROVE_CREATE" })
  @IsIn(["APPROVE_CREATE", "APPROVE_MERGE", "REJECT"])
  action!: "APPROVE_CREATE" | "APPROVE_MERGE" | "REJECT";

  @ApiPropertyOptional()
  @ValidateIf(object => object.action !== "REJECT")
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @ValidateIf(object => object.action !== "REJECT")
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @ValidateIf(object => object.action !== "REJECT")
  @IsUUID()
  defaultUnitId?: string;

  @ApiPropertyOptional({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @ValidateIf(object => object.action === "APPROVE_MERGE")
  @IsUUID()
  targetIngredientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class BlockRecipeDto extends OperationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  reason!: string;
}

export class ResolveRecipeReportDto extends OperationDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(255)
  resolutionNote?: string | null;
}

export class UpdateUserDisplayDto extends OperationDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(512)
  profileBackgroundUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(512)
  homeBackgroundUrl?: string | null;
}
