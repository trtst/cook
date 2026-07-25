import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import type { RequestWithAdmin } from "../../common/auth-context";
import { LoginRateLimitGuard } from "../../common/login-rate-limit.guard";
import {
  AdminDiningGroupQueryDto,
  AdminLoginDto,
  AdminRecipeQueryDto,
  AdminRecipeReportQueryDto,
  AdminUserEntitlementQueryDto,
  BlockRecipeDto,
  CreateAdminUserDto,
  OperationDto,
  PageQueryDto,
  ResetAdminUserPasswordDto,
  ResolveRecipeReportDto,
  SetAdminUserStatusDto,
  UpdateAdminUserDto
} from "../../contracts/dtos";
import {
  AdminDiningGroupModel,
  AdminLoginResultModel,
  AdminResetUserPasswordResultModel,
  AdminRecipeModel,
  AdminUserEntitlementModel,
  ApiOkModel,
  ApiOkPage,
  RecipeReportModel,
  UserProfileModel
} from "../../contracts/openapi";
import { AdminService } from "../admin/admin.service";

@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Post("auth/login")
  @UseGuards(LoginRateLimitGuard)
  @ApiOkModel(AdminLoginResultModel, "管理员登录，返回后台 token")
  login(@Body() body: AdminLoginDto) {
    return this.adminService.login(body).then(result => ok(result));
  }

  @Get("users")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(UserProfileModel, "后台用户只读查询")
  listUsers(@Query() query: PageQueryDto) {
    return this.adminService.listUsers(query.page, query.pageSize, query.keyword).then(result => ok(result));
  }

  @Post("users")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(UserProfileModel, "后台创建一个用户")
  createUser(@Req() request: RequestWithAdmin, @Body() body: CreateAdminUserDto) {
    return this.adminService.createUser(body, request.admin.adminId).then(result => ok(result));
  }

  @Put("users/:userId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(UserProfileModel, "后台更新一个用户的昵称或手机号")
  updateUser(
    @Req() request: RequestWithAdmin,
    @Param("userId", new ParseUUIDPipe({ version: "4" })) userId: string,
    @Body() body: UpdateAdminUserDto
  ) {
    return this.adminService.updateUser(userId, body, request.admin.adminId).then(result => ok(result));
  }

  @Post("users/:userId/status")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(UserProfileModel, "后台启用或禁用一个用户")
  setUserStatus(
    @Req() request: RequestWithAdmin,
    @Param("userId", new ParseUUIDPipe({ version: "4" })) userId: string,
    @Body() body: SetAdminUserStatusDto
  ) {
    return this.adminService.setUserStatus(userId, body, request.admin.adminId).then(result => ok(result));
  }

  @Post("users/:userId/reset-password")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(AdminResetUserPasswordResultModel, "后台重置一个用户的登录密码")
  resetUserPassword(
    @Req() request: RequestWithAdmin,
    @Param("userId", new ParseUUIDPipe({ version: "4" })) userId: string,
    @Body() body: ResetAdminUserPasswordDto
  ) {
    return this.adminService.resetUserPassword(userId, body, request.admin.adminId).then(result => ok(result));
  }

  @Get("dining-groups")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(AdminDiningGroupModel, "后台饭搭子只读查询")
  listDiningGroups(@Query() query: AdminDiningGroupQueryDto) {
    return this.adminService
      .listDiningGroups(query.page, query.pageSize, query.keyword, query.status)
      .then(result => ok(result));
  }

  @Get("user-entitlements")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(AdminUserEntitlementModel, "后台查询用户当前有效权益")
  getUserEntitlements(@Req() request: RequestWithAdmin, @Query() query: AdminUserEntitlementQueryDto) {
    return this.adminService.getUserEntitlements(query.userId, request.admin.adminId).then(result => ok(result));
  }

  @Get("recipes")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(AdminRecipeModel, "后台菜谱治理列表")
  listRecipes(@Query() query: AdminRecipeQueryDto) {
    return this.adminService
      .listRecipes(query.page, query.pageSize, query.keyword, query.status, query.reportsOnly)
      .then(result => ok(result));
  }

  @Get("recipe-reports")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(RecipeReportModel, "后台菜谱举报列表")
  listRecipeReports(@Query() query: AdminRecipeReportQueryDto) {
    return this.adminService.listRecipeReports(query.page, query.pageSize, query.status).then(result => ok(result));
  }

  @Post("recipes/:recipeId/block")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(AdminRecipeModel, "后台下架一个菜谱")
  blockRecipe(
    @Req() request: RequestWithAdmin,
    @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string,
    @Body() body: BlockRecipeDto
  ) {
    return this.adminService.blockRecipe(recipeId, request.admin.adminId, body.operationId, body.reason).then(result => ok(result));
  }

  @Post("recipes/:recipeId/unblock")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(AdminRecipeModel, "后台恢复一个菜谱")
  unblockRecipe(
    @Req() request: RequestWithAdmin,
    @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string,
    @Body() body: OperationDto
  ) {
    return this.adminService.unblockRecipe(recipeId, request.admin.adminId, body.operationId).then(result => ok(result));
  }

  @Post("recipe-reports/:reportId/resolve")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(RecipeReportModel, "后台处理一个菜谱举报")
  resolveRecipeReport(
    @Req() request: RequestWithAdmin,
    @Param("reportId", new ParseUUIDPipe({ version: "4" })) reportId: string,
    @Body() body: ResolveRecipeReportDto
  ) {
    return this.adminService
      .resolveRecipeReport(reportId, request.admin.adminId, body.operationId, body.resolutionNote)
      .then(result => ok(result));
  }
}
