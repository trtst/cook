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
  @ApiPropertyOptional({ example: "mine" })
  @IsOptional()
  @IsIn(["mine", "system", "all"])
  scope?: string;
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

export class RecipeIngredientDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  amount!: string;
}

export class RecipeStepDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}

export class RecipeContentDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(64)
  servings?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationMinutes?: number | null;

  @IsEmpty({ message: "图片上传功能尚未开放" })
  images?: never;
}

export class CreateRecipeDto extends OperationDto {
  @ApiProperty({ type: RecipeContentDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RecipeContentDto)
  content!: RecipeContentDto;
}

export class UpdateRecipeDto extends VersionedOperationDto {
  @ApiProperty({ type: RecipeContentDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RecipeContentDto)
  content!: RecipeContentDto;
}

export class DeleteRecipeDto extends VersionedOperationDto {}

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
