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

const resourceIdExample = 1001;
const medalRuleValues = [
  "MEAL_COMPLETION",
  "DINING_EVENT_COMPLETION",
  "GROUP_MEAL_COMPLETION",
  "FULL_LOOP_COMPLETION",
  "RECOMMENDATION_ADOPTED_TOTAL"
] as const;
const medalCategoryValues = [
  "MEAL_CHECKIN",
  "DINING_COLLABORATION",
  "HOLIDAY_LIMITED",
  "RECOMMENDATION_CONTRIBUTION"
] as const;
const medalStatusValues = ["DRAFT", "LISTED", "UNLISTED", "ARCHIVED"] as const;
const editableMedalStatusValues = ["DRAFT", "LISTED", "UNLISTED"] as const;

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
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  diningGroupId!: number;
}

export class CreateInviteDto extends OperationDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  diningGroupId!: number;
}

export class RemoveDiningGroupMemberDto extends VersionedOperationDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;
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

export class AdminMedalTemplateQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: medalStatusValues })
  @IsOptional()
  @IsIn(medalStatusValues)
  status?: "DRAFT" | "LISTED" | "UNLISTED" | "ARCHIVED";

  @ApiPropertyOptional({ enum: medalCategoryValues })
  @IsOptional()
  @IsIn(medalCategoryValues)
  category?: "MEAL_CHECKIN" | "DINING_COLLABORATION" | "HOLIDAY_LIMITED";
}

class MedalTemplateFieldsDto {
  @ApiProperty({ enum: medalCategoryValues })
  @IsIn(medalCategoryValues)
  category!: "MEAL_CHECKIN" | "DINING_COLLABORATION" | "HOLIDAY_LIMITED";

  @ApiProperty({ example: "开火第一餐" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: "第一次把自己安排的一餐真正做完吃成。" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description!: string;

  @ApiProperty({ example: "完成任意一个自己的计划餐次。" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  condition!: string;

  @ApiProperty({ example: "PLAN" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  iconKey!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  isLimited!: boolean;

  @ApiProperty({ nullable: true, example: "2026-10-01T00:00:00.000Z" })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601()
  startAt!: string | null;

  @ApiProperty({ nullable: true, example: "2026-10-07T23:59:59.000Z" })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601()
  endAt!: string | null;
}

export class CreateAdminMedalTemplateDto extends OperationDto {
  @ApiProperty({ example: "FIRST_COMPLETED_MEAL" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  code!: string;

  @ApiProperty({ enum: medalRuleValues })
  @IsIn(medalRuleValues)
  awardRule!:
    | "MEAL_COMPLETION"
    | "DINING_EVENT_COMPLETION"
    | "GROUP_MEAL_COMPLETION"
    | "FULL_LOOP_COMPLETION"
    | "RECOMMENDATION_ADOPTED_TOTAL";

  @ApiProperty({ enum: editableMedalStatusValues, required: false })
  @IsOptional()
  @IsIn(editableMedalStatusValues)
  status?: "DRAFT" | "LISTED" | "UNLISTED";

  @ApiProperty({ enum: medalCategoryValues })
  @IsIn(medalCategoryValues)
  category!: "MEAL_CHECKIN" | "DINING_COLLABORATION" | "HOLIDAY_LIMITED" | "RECOMMENDATION_CONTRIBUTION";

  @ApiProperty({ example: "开火第一餐" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: "第一次把自己安排的一餐真正做完吃成。" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description!: string;

  @ApiProperty({ example: "完成任意一个自己的计划餐次。" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  condition!: string;

  @ApiProperty({ example: "PLAN" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  iconKey!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetCount?: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  isLimited!: boolean;

  @ApiProperty({ nullable: true, example: "2026-10-01T00:00:00.000Z" })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601()
  startAt!: string | null;

  @ApiProperty({ nullable: true, example: "2026-10-07T23:59:59.000Z" })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601()
  endAt!: string | null;
}

export class UpdateAdminMedalTemplateDto extends VersionedOperationDto {
  @ApiProperty({ enum: medalCategoryValues })
  @IsIn(medalCategoryValues)
  category!: "MEAL_CHECKIN" | "DINING_COLLABORATION" | "HOLIDAY_LIMITED" | "RECOMMENDATION_CONTRIBUTION";

  @ApiProperty({ example: "开火第一餐" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: "第一次把自己安排的一餐真正做完吃成。" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description!: string;

  @ApiProperty({ example: "完成任意一个自己的计划餐次。" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  condition!: string;

  @ApiProperty({ example: "PLAN" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  iconKey!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetCount?: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  isLimited!: boolean;

  @ApiProperty({ nullable: true, example: "2026-10-01T00:00:00.000Z" })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601()
  startAt!: string | null;

  @ApiProperty({ nullable: true, example: "2026-10-07T23:59:59.000Z" })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601()
  endAt!: string | null;
}

export class SetAdminMedalTemplateStatusDto extends VersionedOperationDto {
  @ApiProperty({ enum: medalStatusValues })
  @IsIn(medalStatusValues)
  status!: "DRAFT" | "LISTED" | "UNLISTED" | "ARCHIVED";
}

export class AdminDiningGroupQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "ACTIVE" })
  @IsOptional()
  @IsIn(["ACTIVE", "ARCHIVED"])
  status?: string;
}

export class AdminUserEntitlementQueryDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;
}

export class RecipeListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: resourceIdExample })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;
}

export class RecipeDraftListQueryDto extends PageQueryDto {}

export class IngredientListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: resourceIdExample })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

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
  @ApiPropertyOptional({ example: resourceIdExample })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

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
  @ApiPropertyOptional({ example: resourceIdExample })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sceneId?: number;
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
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;

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
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;

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

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultUnitId!: number;
}

export class UpdateIngredientDto extends VersionedOperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultUnitId!: number;
}

export class RecommendIngredientDto extends OperationDto {}

export class CreateIngredientFeedbackDto extends OperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class RecommendRecipeDto extends OperationDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inspirationCategoryId!: number;
}

export class WithdrawRecipeRecommendationDto extends VersionedOperationDto {}

export class RecipeAmountDto {
  @ApiProperty({ example: "EXACT" })
  @IsIn(["EXACT", "FUZZY"])
  kind!: string;

  @ApiPropertyOptional({ example: "2.5" })
  @ValidateIf(object => object.kind === "EXACT")
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  quantity?: string;

  @ApiPropertyOptional({ example: resourceIdExample })
  @ValidateIf(object => object.kind === "EXACT")
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId?: number;

  @ApiPropertyOptional({ example: "适量" })
  @ValidateIf(object => object.kind === "FUZZY")
  @IsIn(["适量", "少许", "按需"])
  text?: string;
}

export class RecipeIngredientDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ingredientId!: number;

  @ApiProperty({ type: RecipeAmountDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RecipeAmountDto)
  amount!: RecipeAmountDto;
}

export class RecipeDraftIngredientDto {
  @ApiProperty({ nullable: true, example: resourceIdExample })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ingredientId!: number | null;

  @ApiProperty({ example: "番茄", maxLength: 64 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: "2", maxLength: 32 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(32)
  quantity!: string;

  @ApiProperty({ nullable: true, example: resourceIdExample })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId!: number | null;

  @ApiProperty({ nullable: true, example: "适量" })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsIn(["适量", "少许", "按需"])
  fuzzyText!: "适量" | "少许" | "按需" | null;

  @ApiProperty({ nullable: true, example: resourceIdExample })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number | null;

  @ApiProperty({ nullable: true, example: resourceIdExample })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultUnitId!: number | null;

  @ApiProperty({ nullable: true, example: "PERSONAL", enum: ["SYSTEM", "PERSONAL"] })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsIn(["SYSTEM", "PERSONAL"])
  source!: "SYSTEM" | "PERSONAL" | null;
}

export class RecipeStepDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  text!: string;

  @ApiProperty({ nullable: true, maxLength: 512 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(512)
  imageUrl!: string | null;
}

export class AdminRecipeStepDto extends RecipeStepDto {
  @ApiProperty({ nullable: true, maxLength: 128 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  imageTempKey!: string | null;
}

export class RecipeDraftStepDto {
  @ApiProperty({ example: "step-1" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  slotKey!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  text!: string;

  @ApiProperty({ nullable: true, example: resourceIdExample })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  uploadId!: number | null;

  @ApiProperty({ nullable: true, maxLength: 512 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(512)
  imageUrl!: string | null;
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

  @ApiProperty({ nullable: true, example: resourceIdExample })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number | null;

  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  sceneIds!: number[];

  @ApiPropertyOptional({ nullable: true, example: resourceIdExample })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  originVersionId?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 512 })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(512)
  originCoverImageUrl?: string | null;

  @ApiProperty({ nullable: true, example: resourceIdExample })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  coverUploadId!: number | null;

  @ApiProperty({ nullable: true, maxLength: 512 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(512)
  coverImageUrl!: string | null;

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

  @ApiProperty({ type: [RecipeDraftIngredientDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecipeDraftIngredientDto)
  ingredients!: RecipeDraftIngredientDto[];

  @ApiProperty({ type: [RecipeDraftStepDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecipeDraftStepDto)
  steps!: RecipeDraftStepDto[];
}

export class UploadRecipeImageDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  draftId!: number;

  @ApiProperty({ example: "RECIPE_STEP", enum: ["RECIPE_COVER", "RECIPE_STEP"] })
  @IsIn(["RECIPE_COVER", "RECIPE_STEP"])
  scene!: "RECIPE_COVER" | "RECIPE_STEP";

  @ApiProperty({ example: "step-1" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  slotKey!: string;
}

export class CreateRecipeDraftDto extends OperationDto {
  @ApiProperty({ nullable: true, example: resourceIdExample })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeId!: number | null;

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

export class CreateMyRecipeFromInspirationDto extends OperationDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceRecipeId!: number;

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceVersionId!: number;

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;

  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  sceneIds!: number[];
}

export class CreateCollectionRecipeDto extends OperationDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceRecipeId!: number;

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceVersionId!: number;

  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  sceneIds!: number[];
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeId!: number;

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

export class CompleteMealPlanDto extends OperationDto {}

export class InviteDiningGroupParticipantsDto extends OperationDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  diningGroupId!: number;
}

export class RespondDiningEventDto extends OperationDto {
  @ApiProperty({ example: "ACCEPTED" })
  @IsIn(["ACCEPTED", "DECLINED"])
  status!: string;
}

export class CompleteDiningEventDto extends OperationDto {}

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeId!: number;
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventId!: number;
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
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  itemIds!: number[];
}

export class AdminRecipeQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: resourceIdExample })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({ example: "ACTIVE" })
  @IsOptional()
  @IsIn(["ACTIVE", "RECYCLED", "BLOCKED", "DELETED"])
  status?: string;
}

export class AdminRecipeReportQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "OPEN" })
  @IsOptional()
  @IsIn(["OPEN", "RESOLVED"])
  status?: string;
}

export class AdminPendingRecipeQueryDto extends PageQueryDto {}

export class AdminInspirationCategoryQueryDto {
  @ApiPropertyOptional({ example: "家常快手" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(20)
  keyword?: string;
}

export class AdminIngredientCategoryQueryDto {
  @ApiPropertyOptional({ example: "蔬果菌菇" })
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

  @ApiPropertyOptional({ example: resourceIdExample })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

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

export class AdminRecipeContentDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ nullable: true, maxLength: 2000 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  story!: string | null;

  @ApiProperty({ minimum: 1, maximum: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  baseServings!: number;

  @ApiProperty({ example: "BEGINNER" })
  @IsIn(["BEGINNER", "EASY", "SKILLED", "CHALLENGING"])
  difficulty!: string;

  @ApiProperty({ example: "WITHIN_15" })
  @IsIn(["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60"])
  duration!: string;

  @ApiProperty({ nullable: true, maxLength: 1000 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  tips!: string | null;

  @ApiProperty({ type: [RecipeIngredientDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];

  @ApiProperty({ type: [AdminRecipeStepDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AdminRecipeStepDto)
  steps!: AdminRecipeStepDto[];
}

export class UpdateAdminRecipeDto extends VersionedOperationDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inspirationCategoryId!: number;

  @ApiProperty({ nullable: true, maxLength: 512 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(512)
  coverImageUrl!: string | null;

  @ApiProperty({ nullable: true, maxLength: 128 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  coverImageTempKey!: string | null;

  @ApiProperty({ type: AdminRecipeContentDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => AdminRecipeContentDto)
  content!: AdminRecipeContentDto;
}

export class CreateAdminRecipeDto extends OperationDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inspirationCategoryId!: number;

  @ApiProperty({ nullable: true, maxLength: 512 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(512)
  coverImageUrl!: string | null;

  @ApiProperty({ nullable: true, maxLength: 128 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  coverImageTempKey!: string | null;

  @ApiProperty({ type: AdminRecipeContentDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => AdminRecipeContentDto)
  content!: AdminRecipeContentDto;
}

export class UploadAdminRecipeImageDto {
  @ApiProperty({ example: "COVER", enum: ["COVER", "STEP"] })
  @IsIn(["COVER", "STEP"])
  scene!: "COVER" | "STEP";
}

export class ReviewPendingRecipeDto extends VersionedOperationDto {
  @ApiProperty({ example: "APPROVE", enum: ["APPROVE", "REJECT"] })
  @IsIn(["APPROVE", "REJECT"])
  action!: "APPROVE" | "REJECT";

  @ApiPropertyOptional({ example: resourceIdExample, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inspirationCategoryId?: number;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class AdminInspirationCategoryNameDto extends OperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name!: string;
}

export class UpdateAdminInspirationCategoryDto extends VersionedOperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name!: string;
}

export class ReorderAdminInspirationCategoriesDto extends OperationDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
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

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultUnitId!: number;
}

export class UpdateAdminIngredientDto extends VersionedOperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultUnitId!: number;
}

export class UpdateAdminIngredientImageDto extends VersionedOperationDto {}

export class SetAdminIngredientStatusDto extends VersionedOperationDto {
  @ApiProperty({ example: "DISABLED", enum: ["ACTIVE", "DISABLED"] })
  @IsIn(["ACTIVE", "DISABLED"])
  status!: "ACTIVE" | "DISABLED";
}

export class ReorderAdminIngredientsDto extends OperationDto {
  @ApiPropertyOptional({ example: resourceIdExample })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

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

export class AdminPendingIngredientFeedbackQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "香菜" })
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

  @ApiPropertyOptional({ example: resourceIdExample })
  @ValidateIf(object => object.action !== "REJECT")
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({ example: resourceIdExample })
  @ValidateIf(object => object.action !== "REJECT")
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultUnitId?: number;

  @ApiPropertyOptional({ example: resourceIdExample })
  @ValidateIf(object => object.action === "APPROVE_MERGE")
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetIngredientId?: number;

  @ApiPropertyOptional({ example: "NAME_NOT_CLEAR" })
  @ValidateIf(object => object.action === "REJECT")
  @IsIn(["NAME_NOT_CLEAR", "NAME_HAS_BRAND", "CATEGORY_NOT_FIT", "UNIT_NOT_FIT", "OUT_OF_SCOPE", "OTHER"])
  rejectReasonCode?: "NAME_NOT_CLEAR" | "NAME_HAS_BRAND" | "CATEGORY_NOT_FIT" | "UNIT_NOT_FIT" | "OUT_OF_SCOPE" | "OTHER";

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ReviewIngredientFeedbackDto extends VersionedOperationDto {
  @ApiProperty({ example: "APPROVE" })
  @IsIn(["APPROVE", "REJECT"])
  action!: "APPROVE" | "REJECT";

  @ApiPropertyOptional()
  @ValidateIf(object => object.action === "APPROVE")
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional({ example: resourceIdExample })
  @ValidateIf(object => object.action === "APPROVE")
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

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
