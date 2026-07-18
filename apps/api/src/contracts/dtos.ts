import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class WechatLoginDto {
  @ApiProperty({ example: "wx-login-code" })
  @IsString()
  code!: string;
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

export class CreateRestaurantDto {
  @ApiProperty({ example: "我们家餐厅" })
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

export class RestaurantMembersQueryDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  restaurantId!: string;
}

export class CreateInviteDto extends OperationDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  restaurantId!: string;
}

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keyword?: string;
}

export class AdminRestaurantQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: "ACTIVE" })
  @IsOptional()
  @IsString()
  status?: string;
}
