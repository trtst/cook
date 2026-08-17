import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
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

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
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
const ingredientProteinTypeValues = ["PORK", "CHICKEN", "BEEF", "LAMB", "DUCK", "SEAFOOD", "EGG", "TOFU", "NONE"] as const;
const mealSlotValues = ["BREAKFAST", "LUNCH", "AFTERNOON_TEA", "DINNER", "LATE_NIGHT"] as const;

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

export class UpdateHomeEntryItemDto {
  @ApiProperty({ enum: ["MAIN", "SIDE_TOP", "SIDE_BOTTOM", "QUICK_1", "QUICK_2", "QUICK_3", "QUICK_4"] })
  @IsIn(["MAIN", "SIDE_TOP", "SIDE_BOTTOM", "QUICK_1", "QUICK_2", "QUICK_3", "QUICK_4"])
  placement!: "MAIN" | "SIDE_TOP" | "SIDE_BOTTOM" | "QUICK_1" | "QUICK_2" | "QUICK_3" | "QUICK_4";

  @ApiProperty({ maxLength: 20 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  title!: string;

  @ApiProperty({ nullable: true, maxLength: 40 })
  @Transform(({ value }) => trimString(value))
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(40)
  subtitle!: string | null;

  @ApiProperty({ enum: ["PAGE", "WEB_VIEW"] })
  @IsIn(["PAGE", "WEB_VIEW"])
  targetType!: "PAGE" | "WEB_VIEW";

  @ApiProperty({ maxLength: 512 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  targetValue!: string;

  @ApiProperty({ nullable: true, maxLength: 512 })
  @Transform(({ value }) => trimString(value))
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(512)
  imageUrl!: string | null;

  @ApiProperty({ nullable: true, maxLength: 8 })
  @Transform(({ value }) => trimString(value))
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(8)
  badgeText!: string | null;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class UpdateHomeEntriesDto extends OperationDto {
  @ApiProperty({ type: [UpdateHomeEntryItemDto], minItems: 1, maxItems: 7 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique(item => (typeof item === "object" && item && "placement" in item ? (item as { placement?: unknown }).placement : item))
  @ValidateNested({ each: true })
  @Type(() => UpdateHomeEntryItemDto)
  items!: UpdateHomeEntryItemDto[];
}

export class UpdateHomeEntryImageDto extends OperationDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class SetHomeEntryStatusDto extends OperationDto {
  @ApiProperty({ enum: ["LISTED", "UNLISTED"] })
  @IsIn(["LISTED", "UNLISTED"])
  status!: "LISTED" | "UNLISTED";

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CreateTableTopicDto extends OperationDto {
  @ApiProperty({ maxLength: 30 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  title!: string;

  @ApiProperty({ maxLength: 240 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  summary!: string;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  activityAt!: string;

  @ApiProperty({ enum: ["PAGE", "WEB_VIEW"] })
  @IsIn(["PAGE", "WEB_VIEW"])
  targetType!: "PAGE" | "WEB_VIEW";

  @ApiProperty({ nullable: true, maxLength: 512 })
  @Transform(({ value }) => trimString(value))
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(512)
  targetValue!: string | null;
}

export class UpdateTableTopicDto extends CreateTableTopicDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class SetTableTopicStatusDto extends OperationDto {
  @ApiProperty({ enum: ["LISTED", "UNLISTED"] })
  @IsIn(["LISTED", "UNLISTED"])
  status!: "LISTED" | "UNLISTED";

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class UpdateTableTopicImageDto extends OperationDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class HomeTopicRecipeQueryDto {
  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(40)
  keyword?: string;
}

export class HomeTopicPickDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeId!: number;

  @ApiProperty({ nullable: true, maxLength: 60 })
  @Transform(({ value }) => trimString(value))
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(60)
  recommendNote!: string | null;
}

export class CreateHomeTopicDto extends OperationDto {
  @ApiProperty({ maxLength: 20 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  title!: string;

  @ApiProperty({ nullable: true, maxLength: 40 })
  @Transform(({ value }) => trimString(value))
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(40)
  subTitle!: string | null;

  @ApiProperty({ enum: ["WEEKEND_GATHERING", "QUICK_AFTER_WORK", "HOME_STYLE", "ONE_PERSON", "BREAKFAST", "LIGHT_DINNER"] })
  @IsIn(["WEEKEND_GATHERING", "QUICK_AFTER_WORK", "HOME_STYLE", "ONE_PERSON", "BREAKFAST", "LIGHT_DINNER"])
  recType!: "WEEKEND_GATHERING" | "QUICK_AFTER_WORK" | "HOME_STYLE" | "ONE_PERSON" | "BREAKFAST" | "LIGHT_DINNER";

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  issueNo!: number;

  @ApiProperty({ maxLength: 120 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  description!: string;

  @ApiProperty({ type: [HomeTopicPickDto], minItems: 3 })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayUnique((item: HomeTopicPickDto) => item.recipeId)
  @ValidateNested({ each: true })
  @Type(() => HomeTopicPickDto)
  items!: HomeTopicPickDto[];
}

export class UpdateHomeTopicDto extends CreateHomeTopicDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class SetHomeTopicStatusDto extends OperationDto {
  @ApiProperty({ enum: ["LISTED", "UNLISTED"] })
  @IsIn(["LISTED", "UNLISTED"])
  status!: "LISTED" | "UNLISTED";

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class UpdateHomeTopicImageDto extends OperationDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

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

class DiningGroupFieldsDto extends OperationDto {
  @ApiProperty({ example: "小满家的饭搭子" })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: "一起商量这一周要吃什么。" })
  @Transform(({ value }) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(120)
  description!: string | null;
}

export class CreateDiningGroupDto extends DiningGroupFieldsDto {
}

export class UpdateDiningGroupDto extends DiningGroupFieldsDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class UpdateDiningGroupCoverDto extends OperationDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
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
  category?: "MEAL_CHECKIN" | "DINING_COLLABORATION" | "HOLIDAY_LIMITED" | "RECOMMENDATION_CONTRIBUTION";
}

class MedalTemplateFieldsDto {
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

export class UpdateAdminMedalTemplateImageDto extends VersionedOperationDto {}

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
  @IsIn(["WEIGHT", "VOLUME", "COMMON", "PACKAGE"])
  type?: string;

  @ApiPropertyOptional({ example: "ALL" })
  @IsOptional()
  @IsIn(["SYSTEM", "PERSONAL", "ALL"])
  source?: string;
}

export class IngredientRecommendationListQueryDto extends PageQueryDto {}

export class UnitRecommendationListQueryDto extends PageQueryDto {}

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
  @IsIn(["WEIGHT", "VOLUME", "COMMON", "PACKAGE"])
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

export class CreateMealPlanMenuItemDto {
  @ApiProperty({
    enum: ["MEAT", "VEGETABLE", "SOUP", "STAPLE", "BREAKFAST_STAPLE", "BREAKFAST_PROTEIN", "BREAKFAST_SIDE"],
    nullable: true
  })
  @ValidateIf((_object, value) => value !== null)
  @IsIn(["MEAT", "VEGETABLE", "SOUP", "STAPLE", "BREAKFAST_STAPLE", "BREAKFAST_PROTEIN", "BREAKFAST_SIDE"])
  slotType!: string | null;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeId!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeVersionId!: number;

  @ApiProperty({ enum: ["READY", "PENDING"] })
  @IsIn(["READY", "PENDING"])
  purchaseState!: string;
}

export class CreateMealPlanDto extends OperationDto {
  @ApiProperty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  planDate!: string;

  @ApiProperty({ enum: mealSlotValues })
  @IsIn(mealSlotValues)
  mealSlot!: string;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number | null;

  @ApiProperty({ type: [CreateMealPlanMenuItemDto], maxItems: 12 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CreateMealPlanMenuItemDto)
  menuItems!: CreateMealPlanMenuItemDto[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(255)
  note?: string | null;
}

export class AddMealPlanItemDto extends OperationDto {
  @ApiProperty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  planDate!: string;

  @ApiProperty({ enum: mealSlotValues })
  @IsIn(mealSlotValues)
  mealSlot!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeId!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeVersionId!: number;

  @ApiPropertyOptional({
    enum: ["MEAT", "VEGETABLE", "SOUP", "STAPLE", "BREAKFAST_STAPLE", "BREAKFAST_PROTEIN", "BREAKFAST_SIDE"],
    nullable: true
  })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsIn(["MEAT", "VEGETABLE", "SOUP", "STAPLE", "BREAKFAST_STAPLE", "BREAKFAST_PROTEIN", "BREAKFAST_SIDE"])
  slotType?: string | null;

  @ApiPropertyOptional({ enum: ["READY", "PENDING"], default: "READY" })
  @IsOptional()
  @IsIn(["READY", "PENDING"])
  purchaseState?: string;
}

export class RandomSlotPlanDto {
  @ApiProperty({ minimum: 0, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(12)
  meatCount!: number;

  @ApiProperty({ minimum: 0, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(12)
  vegetableCount!: number;

  @ApiProperty({ minimum: 0, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(12)
  soupCount!: number;

  @ApiProperty({ minimum: 0, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(12)
  stapleCount!: number;

  @ApiProperty({ minimum: 0, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(12)
  breakfastStapleCount!: number;

  @ApiProperty({ minimum: 0, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(12)
  breakfastProteinCount!: number;

  @ApiProperty({ minimum: 0, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(12)
  breakfastSideCount!: number;
}

export class GenerateRandomMenuDto extends OperationDto {
  @ApiProperty({ enum: ["BREAKFAST", "LUNCH", "DINNER"] })
  @IsIn(["BREAKFAST", "LUNCH", "DINNER"])
  mealSlot!: "BREAKFAST" | "LUNCH" | "DINNER";

  @ApiProperty({ minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  peopleCount!: number;

  @ApiProperty()
  @IsBoolean()
  fridgePreferred!: boolean;

  @ApiPropertyOptional({ type: RandomSlotPlanDto, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @ValidateNested()
  @Type(() => RandomSlotPlanDto)
  slotPlan?: RandomSlotPlanDto | null;
}

export class ReplaceRandomMenuCurrentItemDto {
  @ApiProperty({ minLength: 1, maxLength: 64 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  slotId!: string;

  @ApiProperty({ enum: ["MEAT", "VEGETABLE", "SOUP", "STAPLE", "BREAKFAST_STAPLE", "BREAKFAST_PROTEIN", "BREAKFAST_SIDE"] })
  @IsIn(["MEAT", "VEGETABLE", "SOUP", "STAPLE", "BREAKFAST_STAPLE", "BREAKFAST_PROTEIN", "BREAKFAST_SIDE"])
  slotType!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeId!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeVersionId!: number;
}

export class RandomReplaceConstraintDto {
  @ApiProperty({ enum: ["FLAVOR", "DURATION", "INGREDIENT", "AVOID_INGREDIENT"] })
  @IsIn(["FLAVOR", "DURATION", "INGREDIENT", "AVOID_INGREDIENT"])
  kind!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 64 })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(64)
  value?: string | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ingredientId?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 64 })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(64)
  ingredientName?: string | null;
}

export class ReplaceRandomMenuSlotDto extends OperationDto {
  @ApiProperty({ enum: ["BREAKFAST", "LUNCH", "DINNER"] })
  @IsIn(["BREAKFAST", "LUNCH", "DINNER"])
  mealSlot!: "BREAKFAST" | "LUNCH" | "DINNER";

  @ApiProperty({ minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  peopleCount!: number;

  @ApiProperty()
  @IsBoolean()
  fridgePreferred!: boolean;

  @ApiProperty({ type: RandomSlotPlanDto })
  @ValidateNested()
  @Type(() => RandomSlotPlanDto)
  slotPlan!: RandomSlotPlanDto;

  @ApiProperty({ type: [ReplaceRandomMenuCurrentItemDto], maxItems: 12 })
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ReplaceRandomMenuCurrentItemDto)
  currentItems!: ReplaceRandomMenuCurrentItemDto[];

  @ApiProperty({ minLength: 1, maxLength: 64 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  targetSlotId!: string;

  @ApiProperty({ enum: ["MEAT", "VEGETABLE", "SOUP", "STAPLE", "BREAKFAST_STAPLE", "BREAKFAST_PROTEIN", "BREAKFAST_SIDE"] })
  @IsIn(["MEAT", "VEGETABLE", "SOUP", "STAPLE", "BREAKFAST_STAPLE", "BREAKFAST_PROTEIN", "BREAKFAST_SIDE"])
  targetSlotType!: string;

  @ApiProperty({ type: [RandomReplaceConstraintDto], maxItems: 6 })
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => RandomReplaceConstraintDto)
  replaceConstraints!: RandomReplaceConstraintDto[];

  @ApiProperty({ type: [Number], maxItems: 30 })
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  rejectedRecipeVersionIds!: number[];

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestSeq!: number;
}

export class RandomGapInventoryDecisionDto {
  @ApiProperty({ minLength: 1, maxLength: 64 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  slotId!: string;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ingredientId?: number | null;

  @ApiProperty({ maxLength: 120 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  ingredientName!: string;

  @ApiProperty({ enum: ["HAS", "MISSING"] })
  @IsIn(["HAS", "MISSING"])
  decision!: "HAS" | "MISSING";
}

export class RandomGapCheckItemDto {
  @ApiProperty({ minLength: 1, maxLength: 64 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  slotId!: string;

  @ApiProperty({ enum: ["MEAT", "VEGETABLE", "SOUP", "STAPLE", "BREAKFAST_STAPLE", "BREAKFAST_PROTEIN", "BREAKFAST_SIDE"] })
  @IsIn(["MEAT", "VEGETABLE", "SOUP", "STAPLE", "BREAKFAST_STAPLE", "BREAKFAST_PROTEIN", "BREAKFAST_SIDE"])
  slotType!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeId!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeVersionId!: number;
}

export class CheckRandomMenuGapDto extends OperationDto {
  @ApiProperty({ enum: ["BREAKFAST", "LUNCH", "DINNER"] })
  @IsIn(["BREAKFAST", "LUNCH", "DINNER"])
  mealSlot!: "BREAKFAST" | "LUNCH" | "DINNER";

  @ApiProperty({ minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  peopleCount!: number;

  @ApiProperty({ type: [RandomGapCheckItemDto], maxItems: 12 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => RandomGapCheckItemDto)
  items!: RandomGapCheckItemDto[];

  @ApiProperty({ type: [RandomGapInventoryDecisionDto], maxItems: 80 })
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => RandomGapInventoryDecisionDto)
  inventoryDecisions!: RandomGapInventoryDecisionDto[];
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

export class CreateDirectDiningEventDto extends OperationDto {
  @ApiProperty({ example: "2026-08-17" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  planDate!: string;

  @ApiProperty({ enum: mealSlotValues })
  @IsIn(mealSlotValues)
  mealSlot!: string;

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

export class UpdateDiningEventCoverDto extends OperationDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class MealPollListQueryDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  diningGroupId!: number;

  @ApiPropertyOptional({ enum: ["OPEN", "CLOSED", "CONFIRMED", "COMPLETED"] })
  @IsOptional()
  @IsIn(["OPEN", "CLOSED", "CONFIRMED", "COMPLETED"])
  status?: "OPEN" | "CLOSED" | "CONFIRMED" | "COMPLETED";

  @ApiPropertyOptional({ example: "2026-08-02" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  planDate?: string;

  @ApiPropertyOptional({ enum: mealSlotValues })
  @IsOptional()
  @IsIn(mealSlotValues)
  mealSlot?: (typeof mealSlotValues)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class DiningGroupActivitiesQueryDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  diningGroupId!: number;

  @ApiPropertyOptional({ minimum: 3, maximum: 5, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(5)
  limit?: number;
}

export class CreateMealPollDto extends OperationDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  diningGroupId!: number;

  @ApiProperty({ example: "2026-08-02" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  planDate!: string;

  @ApiProperty({ enum: mealSlotValues })
  @IsIn(mealSlotValues)
  mealSlot!: (typeof mealSlotValues)[number];

  @ApiProperty({ example: "2026-08-02T10:30:00.000Z" })
  @IsISO8601({ strict: true })
  deadlineAt!: string;

  @ApiProperty({ minimum: 1, maximum: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  choiceLimit!: number;

  @ApiProperty({ nullable: true, maxLength: 255 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(255)
  note!: string | null;

  @ApiProperty({ type: [Number], maxItems: 20 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  candidateRecipeVersionIds!: number[];
}

export class VoteMealPollDto extends VersionedOperationDto {
  @ApiProperty({ type: [Number], maxItems: 3 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  selectedCandidateIds!: number[];

  @ApiProperty({ nullable: true, maxLength: 120 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  suggestionTitle!: string | null;

  @ApiProperty({ nullable: true, maxLength: 255 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  note!: string | null;
}

export class ConfirmMealPollDto extends VersionedOperationDto {
  @ApiProperty({ type: [Number], maxItems: 20 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  finalRecipeVersionIds!: number[];

  @ApiProperty({ nullable: true, example: "2026-08-02T18:30:00.000Z" })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601({ strict: true })
  scheduledAt!: string | null;

  @ApiProperty({ nullable: true, maxLength: 255 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  location!: string | null;
}

export class CompleteMealPlanDto extends OperationDto {}

export class GenerateMealPlanCookAssistantDto extends OperationDto {}

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

export class ClaimCookDto extends VersionedOperationDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  menuItemId!: number;

  @ApiProperty({ enum: ["CLAIM", "RELEASE"] })
  @IsIn(["CLAIM", "RELEASE"])
  action!: "CLAIM" | "RELEASE";
}

export class CreateDiningMemoryShareDto extends OperationDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showParticipants?: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 120 })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(120)
  caption?: string | null;
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

  @ApiPropertyOptional({ example: resourceIdExample, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ingredientId?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(64)
  quantityText?: string | null;

  @ApiPropertyOptional({ example: "2.5", nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  exactQuantity?: string | null;

  @ApiPropertyOptional({ example: resourceIdExample, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  exactUnitId?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(255)
  note?: string | null;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601()
  expireAt?: string | null;
}

export class UpdateFridgeItemDto extends OperationDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(64)
  quantityText?: string | null;

  @ApiPropertyOptional({ example: "2.5", nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  exactQuantity?: string | null;

  @ApiPropertyOptional({ example: resourceIdExample, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  exactUnitId?: number | null;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601()
  expireAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(255)
  note?: string | null;
}

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

export class CreateRecipeShoppingItemsDto extends OperationDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeId!: number;

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceVersionId!: number;
}

export class CreateRandomMenuShoppingIngredientDto {
  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ingredientId?: number | null;

  @ApiProperty({ maxLength: 120 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  ingredientName!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 64 })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(64)
  quantityText?: string | null;
}

export class CreateRandomMenuShoppingItemDto {
  @ApiProperty({ minLength: 1, maxLength: 64 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  slotId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeId!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeVersionId!: number;

  @ApiProperty({ type: [CreateRandomMenuShoppingIngredientDto], maxItems: 80 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => CreateRandomMenuShoppingIngredientDto)
  ingredients!: CreateRandomMenuShoppingIngredientDto[];
}

export class CreateRandomMenuShoppingItemsDto extends OperationDto {
  @ApiProperty({ type: [CreateRandomMenuShoppingItemDto], maxItems: 12 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CreateRandomMenuShoppingItemDto)
  items!: CreateRandomMenuShoppingItemDto[];
}

export class ShoppingItemQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "OPEN" })
  @IsOptional()
  @IsIn(["OPEN", "BOUGHT", "DELETED"])
  status?: string;
}

export class ShoppingListQueryDto extends OperationDto {
  @ApiPropertyOptional({ example: "ACTIVE" })
  @IsOptional()
  @IsIn(["ACTIVE", "COMPLETED", "VOIDED"])
  status?: string;
}

export class ShoppingListInviteQueryDto {
  @ApiPropertyOptional({ example: "ALL", enum: ["ALL", "PENDING", "RESOLVED"] })
  @IsOptional()
  @IsIn(["ALL", "PENDING", "RESOLVED"])
  filter?: string;
}

export class CreateShoppingListDto extends OperationDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 20 })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(20)
  name?: string | null;
}

export class RenameShoppingListDto extends OperationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ maxLength: 20 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name!: string;
}

export class CreateShoppingListItemDto extends OperationDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: resourceIdExample, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ingredientId?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 64 })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(64)
  quantityText?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(255)
  note?: string | null;
}

export class AddRecipeToShoppingListDto extends OperationDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipeId!: number;

  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceVersionId!: number;

  @ApiPropertyOptional({ example: resourceIdExample, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planItemId?: number | null;
}

export class AddPlanToShoppingListDto extends OperationDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planItemId!: number;
}

export class UpdateShoppingListItemCheckDto extends OperationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  checked!: boolean;
}

export class ApplyShoppingListItemFridgeDto extends OperationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ enum: ["APPLY", "UNDO"] })
  @IsIn(["APPLY", "UNDO"])
  action!: "APPLY" | "UNDO";
}

export class RemoveShoppingListItemDto extends OperationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class UpdateShoppingListStatusDto extends OperationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class CompleteShoppingListEntryDto {
  @ApiProperty({ example: resourceIdExample })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  store!: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 64 })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(64)
  quantityText?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 7 })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  expireDays?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601()
  expireAt?: string | null;
}

export class CompleteShoppingListDto extends OperationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ type: [CompleteShoppingListEntryDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CompleteShoppingListEntryDto)
  entries!: CompleteShoppingListEntryDto[];
}

export class ShareShoppingListMembersDto extends OperationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  targetUserIds!: number[];
}

export class RemoveShoppingListMemberDto extends OperationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class LeaveShoppingListDto extends OperationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class DeleteShoppingListDto extends OperationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class UpdateShoppingStatusDto extends OperationDto {
  @ApiProperty({ example: "BOUGHT" })
  @IsIn(["OPEN", "BOUGHT", "DELETED"])
  status!: string;
}

export class UpdateShoppingGroupStatusDto extends OperationDto {
  @ApiProperty({ example: "ingredient:1" })
  @IsString()
  @MaxLength(160)
  targetKey!: string;

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

  @ApiPropertyOptional({ example: "MISSING", enum: ["ALL", "MISSING"] })
  @IsOptional()
  @IsIn(["ALL", "MISSING"])
  factStatus?: "ALL" | "MISSING";
}

export class AdminUnitPayloadDto extends OperationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  name!: string;

  @ApiProperty({ example: "WEIGHT" })
  @IsIn(["WEIGHT", "VOLUME", "COMMON", "PACKAGE"])
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
  @IsIn(["WEIGHT", "VOLUME", "COMMON", "PACKAGE"])
  type!: string;
}

export class DeleteAdminUnitDto extends VersionedOperationDto {}

export class ReorderAdminUnitsDto extends OperationDto {
  @ApiProperty({ example: "WEIGHT" })
  @IsIn(["WEIGHT", "VOLUME", "COMMON", "PACKAGE"])
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

  @ApiProperty({ nullable: true, minimum: 0, maximum: 20000 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20000)
  estimatedCalories!: number | null;

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

export class RecipeImportJobQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ["PENDING", "RUNNING", "READY", "FAILED", "COMPLETED"] })
  @IsOptional()
  @IsIn(["PENDING", "RUNNING", "READY", "FAILED", "COMPLETED"])
  status?: "PENDING" | "RUNNING" | "READY" | "FAILED" | "COMPLETED";
}

export class RecipeImportItemQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ["PENDING_PARSE", "NEEDS_FIX", "READY", "PUBLISHING", "PUBLISHED", "FAILED"] })
  @IsOptional()
  @IsIn(["PENDING_PARSE", "NEEDS_FIX", "READY", "PUBLISHING", "PUBLISHED", "FAILED"])
  status?: "PENDING_PARSE" | "NEEDS_FIX" | "READY" | "PUBLISHING" | "PUBLISHED" | "FAILED";
}

export class CreateRecipeImportMarkdownJobDto {
  @ApiPropertyOptional({ example: resourceIdExample, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inspirationCategoryId?: number | null;
}

export class RecipeImportIssueDto {
  @ApiPropertyOptional({ nullable: true })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  field!: string | null;

  @ApiProperty({ maxLength: 255 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  message!: string;
}

export class RecipeImportIngredientDto {
  @ApiProperty({ maxLength: 255 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  line!: string;

  @ApiProperty({ maxLength: 64 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  ingredientName!: string;

  @ApiPropertyOptional({ example: resourceIdExample, nullable: true })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ingredientId!: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 32 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(32)
  quantity!: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 16 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(16)
  unitText!: string | null;

  @ApiPropertyOptional({ example: resourceIdExample, nullable: true })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId!: number | null;

  @ApiPropertyOptional({ nullable: true, enum: ["适量", "少许", "按需"] })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsIn(["适量", "少许", "按需"])
  fuzzyText!: "适量" | "少许" | "按需" | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  note!: string | null;
}

export class RecipeImportStepDto {
  @ApiProperty({ maxLength: 2000 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  text!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 128 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  imageKey!: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 128 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  imageTempKey!: string | null;
}

export class RecipeImportRecipeBodyDto {
  @ApiPropertyOptional({ example: resourceIdExample, nullable: true })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inspirationCategoryId!: number | null;

  @ApiProperty({ maxLength: 120 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  story!: string | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 20 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  baseServings!: number | null;

  @ApiPropertyOptional({ nullable: true, enum: ["BEGINNER", "EASY", "SKILLED", "CHALLENGING"] })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsIn(["BEGINNER", "EASY", "SKILLED", "CHALLENGING"])
  difficulty!: string | null;

  @ApiPropertyOptional({ nullable: true, enum: ["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60"] })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsIn(["WITHIN_15", "BETWEEN_15_30", "BETWEEN_30_60", "OVER_60"])
  duration!: string | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 20000 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20000)
  estimatedCalories!: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  tips!: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 128 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  coverImageKey!: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 128 })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  coverImageTempKey!: string | null;

  @ApiProperty({ type: [RecipeImportIngredientDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecipeImportIngredientDto)
  ingredients!: RecipeImportIngredientDto[];

  @ApiProperty({ type: [RecipeImportStepDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecipeImportStepDto)
  steps!: RecipeImportStepDto[];
}

export class UpdateRecipeImportItemDto extends VersionedOperationDto {
  @ApiProperty({ type: RecipeImportRecipeBodyDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RecipeImportRecipeBodyDto)
  recipeBody!: RecipeImportRecipeBodyDto;
}

export class PublishRecipeImportItemDto extends VersionedOperationDto {}

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

  @ApiPropertyOptional({ enum: ingredientProteinTypeValues, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsIn(ingredientProteinTypeValues)
  proteinType?: "PORK" | "CHICKEN" | "BEEF" | "LAMB" | "DUCK" | "SEAFOOD" | "EGG" | "TOFU" | "NONE" | null;

  @ApiProperty({ example: false })
  @IsBoolean()
  isStaple!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  isSpicyIngredient!: boolean;

  @ApiPropertyOptional({ type: [String], maxItems: 20 })
  @IsOptional()
  @Transform(({ value }) => trimItems(value))
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(32, { each: true })
  aliases?: string[];
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

  @ApiPropertyOptional({ enum: ingredientProteinTypeValues, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsIn(ingredientProteinTypeValues)
  proteinType?: "PORK" | "CHICKEN" | "BEEF" | "LAMB" | "DUCK" | "SEAFOOD" | "EGG" | "TOFU" | "NONE" | null;

  @ApiProperty({ example: false })
  @IsBoolean()
  isStaple!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  isSpicyIngredient!: boolean;

  @ApiPropertyOptional({ type: [String], maxItems: 20 })
  @IsOptional()
  @Transform(({ value }) => trimItems(value))
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(32, { each: true })
  aliases?: string[];
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

export class AdminPendingUnitRecommendationQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "汤勺" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(32)
  declare keyword?: string;
}

export class ReviewPendingUnitRecommendationDto extends VersionedOperationDto {
  @ApiProperty({ example: "APPROVE" })
  @IsIn(["APPROVE", "REJECT"])
  action!: "APPROVE" | "REJECT";

  @ApiPropertyOptional()
  @ValidateIf(object => object.action === "APPROVE")
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  name?: string;

  @ApiPropertyOptional({ example: "WEIGHT" })
  @ValidateIf(object => object.action === "APPROVE")
  @IsIn(["WEIGHT", "VOLUME", "COMMON", "PACKAGE"])
  type?: string;

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
