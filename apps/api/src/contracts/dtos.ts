import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, MinLength } from "class-validator";

export class PasswordLoginDto {
  @ApiProperty({ example: "13800000000" })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string;

  @ApiProperty({ example: "change-me" })
  @IsString()
  @MinLength(6)
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
  nickname?: string;

  @ApiPropertyOptional({ example: "https://example.com/avatar.png" })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: "13800000000" })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateDiningGroupDto {
  @ApiProperty({ example: "我的饭搭子" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  operationId!: string;
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
