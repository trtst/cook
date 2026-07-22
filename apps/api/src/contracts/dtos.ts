import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf
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
  username!: string;

  @ApiProperty({ example: "password" })
  @IsString()
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
  keyword?: string;
}

export class AdminDiningGroupQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "ACTIVE" })
  @IsOptional()
  @IsString()
  status?: string;
}

export class AdminUserEntitlementQueryDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  userId!: string;
}
