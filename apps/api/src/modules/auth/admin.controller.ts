import { Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import type { RequestWithAdmin } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { LoginRateLimitGuard } from "../../common/login-rate-limit.guard";
import {
  AdminInspirationCategoryNameDto,
  AdminInspirationCategoryQueryDto,
  AdminIngredientCategoryNameDto,
  AdminIngredientCategoryQueryDto,
  AdminIngredientPayloadDto,
    AdminPendingIngredientQueryDto,
    AdminPendingRecipeQueryDto,
    AdminIngredientQueryDto,
  AdminUnitPayloadDto,
  AdminDiningGroupQueryDto,
  AdminLoginDto,
  AdminRecipeContentDto,
  AdminRecipeQueryDto,
  AdminRecipeReportQueryDto,
  AdminUserEntitlementQueryDto,
  BlockRecipeDto,
  CreateAdminRecipeDto,
  CreateAdminUserDto,
  DeleteAdminUnitDto,
  OperationDto,
  PageQueryDto,
  ReorderAdminInspirationCategoriesDto,
  ReorderAdminIngredientCategoriesDto,
  ReorderAdminIngredientsDto,
  ReorderAdminUnitsDto,
    ReviewPendingIngredientDto,
    ReviewPendingRecipeDto,
  ResetAdminUserPasswordDto,
  ResolveRecipeReportDto,
  SetAdminIngredientStatusDto,
  SetAdminUserStatusDto,
  UpdateAdminInspirationCategoryDto,
  UpdateAdminRecipeDto,
  UpdateAdminUnitDto,
  UpdateAdminIngredientCategoryDto,
  UpdateAdminIngredientImageDto,
  UpdateAdminIngredientDto,
  UpdateAdminUserDto
} from "../../contracts/dtos";
import {
  AdminDashboardSummaryModel,
  AdminDeleteUnitResultModel,
  AdminInspirationCategoryModel,
  AdminIngredientCategoryModel,
  AdminIngredientModel,
    AdminPendingIngredientModel,
    AdminPendingRecipeModel,
    AdminRecipeDetailModel,
    AdminReviewPendingRecipeResultModel,
    AdminReviewPendingIngredientResultModel,
  AdminUnitModel,
  AdminUserRecipeDomainOverviewModel,
  AdminDiningGroupModel,
  AdminLoginResultModel,
  AdminResetUserPasswordResultModel,
  AdminRecipeModel,
  AdminUserEntitlementModel,
  ApiOkArray,
  ApiOkModel,
  ApiOkPage,
  CollectionListModel,
  CollectedRecipeSummaryModel,
  MyRecipeSummaryModel,
  RecipeReportModel,
  RecipeDraftSummaryModel,
  UserProfileModel
} from "../../contracts/openapi";
import type { AdminRecipeContentInput, UnitType } from "../../contracts/types";
import { AdminService } from "../admin/admin.service";

type AssetRequest = { protocol?: string; get?: (name: string) => string | undefined };

function toAdminRecipeContentInput(content: AdminRecipeContentDto): AdminRecipeContentInput {
  return {
    name: content.name,
    story: content.story,
    baseServings: content.baseServings,
    difficulty: content.difficulty as AdminRecipeContentInput["difficulty"],
    duration: content.duration as AdminRecipeContentInput["duration"],
    tips: content.tips,
    ingredients: content.ingredients.map(item => ({
      ingredientId: item.ingredientId,
      amount:
        item.amount.kind === "EXACT"
          ? {
              kind: "EXACT",
              quantity: item.amount.quantity ?? "",
              unitId: item.amount.unitId as number
            }
          : {
              kind: "FUZZY",
              text: (item.amount.text ?? "适量") as "适量" | "少许" | "按需"
            }
    })),
    steps: content.steps.map(item => ({
      text: item.text,
      imageUrl: item.imageUrl,
      imageTempKey: item.imageTempKey
    }))
  };
}

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

  @Get("dashboard/summary")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(AdminDashboardSummaryModel, "后台首页摘要")
  getDashboardSummary(@Req() request: RequestWithAdmin) {
    return this.adminService.getDashboardSummary(request.admin.adminId).then(result => ok(result));
  }

  @Get("users")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(UserProfileModel, "后台用户只读查询")
  listUsers(@Req() request: RequestWithAdmin, @Query() query: PageQueryDto) {
    return this.adminService.listUsers(query.page, query.pageSize, query.keyword, request.admin.adminId).then(result => ok(result));
  }

  @Post("users")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(UserProfileModel, "后台创建一个用户")
  createUser(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateAdminUserDto
  ) {
    return this.adminService.createUser({ ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Get("users/:userId/recipe-domain")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(AdminUserRecipeDomainOverviewModel, "后台按用户读取菜谱域概览")
  getUserRecipeDomain(
    @Req() request: RequestWithAdmin,
    @Param("userId", ParseIntPipe) userId: number
  ) {
    return this.adminService.getUserRecipeDomain(userId, request.admin.adminId).then(result => ok(result));
  }

  @Get("users/:userId/recipes")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(MyRecipeSummaryModel, "后台按用户读取已发布菜谱")
  listUserRecipes(
    @Req() request: RequestWithAdmin,
    @Param("userId", ParseIntPipe) userId: number,
    @Query() query: PageQueryDto
  ) {
    return this.adminService
      .listUserRecipes(userId, request.admin.adminId, query.page, query.pageSize, query.keyword)
      .then(result => ok(result));
  }

  @Get("users/:userId/recipe-drafts")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(RecipeDraftSummaryModel, "后台按用户读取菜谱草稿")
  listUserRecipeDrafts(
    @Req() request: RequestWithAdmin,
    @Param("userId", ParseIntPipe) userId: number,
    @Query() query: PageQueryDto
  ) {
    return this.adminService
      .listUserRecipeDrafts(userId, request.admin.adminId, query.page, query.pageSize, query.keyword)
      .then(result => ok(result));
  }

  @Get("users/:userId/collections")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(CollectionListModel, "后台按用户读取合集列表")
  listUserCollections(
    @Req() request: RequestWithAdmin,
    @Param("userId", ParseIntPipe) userId: number
  ) {
    return this.adminService.listUserCollections(userId, request.admin.adminId).then(result => ok(result));
  }

  @Get("users/:userId/collections/:sceneId/recipes")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(CollectedRecipeSummaryModel, "后台按用户读取某合集内容")
  listUserCollectionRecipes(
    @Req() request: RequestWithAdmin,
    @Param("userId", ParseIntPipe) userId: number,
    @Param("sceneId", ParseIntPipe) sceneId: number,
    @Query() query: PageQueryDto
  ) {
    return this.adminService
      .listUserCollectionRecipes(userId, sceneId, request.admin.adminId, query.page, query.pageSize)
      .then(result => ok(result));
  }

  @Put("users/:userId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(UserProfileModel, "后台更新一个用户的昵称或手机号")
  updateUser(
    @Req() request: RequestWithAdmin,
    @Param("userId", ParseIntPipe) userId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateAdminUserDto
  ) {
    return this.adminService.updateUser(userId, { ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Post("users/:userId/status")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(UserProfileModel, "后台启用或禁用一个用户")
  setUserStatus(
    @Req() request: RequestWithAdmin,
    @Param("userId", ParseIntPipe) userId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: SetAdminUserStatusDto
  ) {
    return this.adminService.setUserStatus(userId, { ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Post("users/:userId/reset-password")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminResetUserPasswordResultModel, "后台重置一个用户的登录密码")
  resetUserPassword(
    @Req() request: RequestWithAdmin,
    @Param("userId", ParseIntPipe) userId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ResetAdminUserPasswordDto
  ) {
    return this.adminService.resetUserPassword(userId, { ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Get("dining-groups")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(AdminDiningGroupModel, "后台饭搭子只读查询")
  listDiningGroups(@Req() request: RequestWithAdmin, @Query() query: AdminDiningGroupQueryDto) {
    return this.adminService
      .listDiningGroups(query.page, query.pageSize, query.keyword, query.status, request.admin.adminId)
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
  @ApiOkPage(AdminRecipeModel, "后台系统菜谱列表")
  listRecipes(@Req() request: RequestWithAdmin, @Query() query: AdminRecipeQueryDto) {
    return this.adminService
      .listRecipes(query.page, query.pageSize, query.keyword, query.status, query.categoryId, request.admin.adminId)
      .then(result => ok(result));
  }

  @Get("pending-recipes")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(AdminPendingRecipeModel, "后台待审核个人菜谱推荐列表")
  listPendingRecipes(@Req() request: RequestWithAdmin, @Query() query: AdminPendingRecipeQueryDto) {
    return this.adminService.listPendingRecipes(query.page, query.pageSize, query.keyword, request.admin.adminId).then(result => ok(result));
  }

  @Post("recipes")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminRecipeDetailModel, "后台新增系统菜谱")
  createRecipe(
    @Req() request: RequestWithAdmin & AssetRequest,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateAdminRecipeDto
  ) {
    return this.adminService
      .createRecipe(request, request.admin.adminId, {
        operationId,
        inspirationCategoryId: body.inspirationCategoryId,
        coverImageUrl: body.coverImageUrl,
        coverImageTempKey: body.coverImageTempKey,
        content: toAdminRecipeContentInput(body.content)
      })
      .then(result => ok(result));
  }

  @Get("recipes/:recipeId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(AdminRecipeDetailModel, "后台菜谱详情")
  getRecipeDetail(@Req() request: RequestWithAdmin, @Param("recipeId", ParseIntPipe) recipeId: number) {
    return this.adminService.getRecipeDetail(recipeId, request.admin.adminId).then(result => ok(result));
  }

  @Put("recipes/:recipeId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminRecipeDetailModel, "后台编辑一个灵感菜谱正文")
  updateRecipe(
    @Req() request: RequestWithAdmin & AssetRequest,
    @Param("recipeId", ParseIntPipe) recipeId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateAdminRecipeDto
  ) {
    return this.adminService
      .updateRecipe(request, recipeId, request.admin.adminId, {
        operationId,
        expectedVersion: body.expectedVersion,
        inspirationCategoryId: body.inspirationCategoryId,
        coverImageUrl: body.coverImageUrl,
        coverImageTempKey: body.coverImageTempKey,
        content: toAdminRecipeContentInput(body.content)
      })
      .then(result => ok(result));
  }

  @Post("pending-recipes/:recommendationId/review")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminReviewPendingRecipeResultModel, "后台审核一个待收录的个人菜谱推荐")
  reviewPendingRecipe(
    @Req() request: RequestWithAdmin,
    @Param("recommendationId", ParseIntPipe) recommendationId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ReviewPendingRecipeDto
  ) {
    return this.adminService
      .reviewPendingRecipe(recommendationId, { ...body, operationId }, request.admin.adminId)
      .then(result => ok(result));
  }

  @Get("inspiration-categories")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkArray(AdminInspirationCategoryModel, "后台系统菜谱分类列表")
  listInspirationCategories(@Req() request: RequestWithAdmin, @Query() query: AdminInspirationCategoryQueryDto) {
    return this.adminService.listInspirationCategories(query.keyword, request.admin.adminId).then(result => ok(result));
  }

  @Post("inspiration-categories")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminInspirationCategoryModel, "后台新建系统菜谱分类")
  createInspirationCategory(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: AdminInspirationCategoryNameDto
  ) {
    return this.adminService.createInspirationCategory({ ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Put("inspiration-categories/:categoryId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminInspirationCategoryModel, "后台编辑系统菜谱分类")
  updateInspirationCategory(
    @Req() request: RequestWithAdmin,
    @Param("categoryId", ParseIntPipe) categoryId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateAdminInspirationCategoryDto
  ) {
    return this.adminService
      .updateInspirationCategory(categoryId, { ...body, operationId }, request.admin.adminId)
      .then(result => ok(result));
  }

  @Post("inspiration-categories/reorder")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkArray(AdminInspirationCategoryModel, "后台重排系统菜谱分类")
  reorderInspirationCategories(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ReorderAdminInspirationCategoriesDto
  ) {
    return this.adminService
      .reorderInspirationCategories(operationId, body.items, request.admin.adminId)
      .then(result => ok(result));
  }

  @Get("ingredient-categories")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkArray(AdminIngredientCategoryModel, "后台系统食材分类列表")
  listIngredientCategories(@Req() request: RequestWithAdmin, @Query() query: AdminIngredientCategoryQueryDto) {
    return this.adminService.listIngredientCategories(query.keyword, request.admin.adminId).then(result => ok(result));
  }

  @Post("ingredient-categories")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminIngredientCategoryModel, "后台新建系统食材分类")
  createIngredientCategory(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: AdminIngredientCategoryNameDto
  ) {
    return this.adminService.createIngredientCategory({ ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Put("ingredient-categories/:categoryId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminIngredientCategoryModel, "后台编辑系统食材分类")
  updateIngredientCategory(
    @Req() request: RequestWithAdmin,
    @Param("categoryId", ParseIntPipe) categoryId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateAdminIngredientCategoryDto
  ) {
    return this.adminService.updateIngredientCategory(categoryId, { ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Post("ingredient-categories/reorder")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkArray(AdminIngredientCategoryModel, "后台重排系统食材分类")
  reorderIngredientCategories(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ReorderAdminIngredientCategoriesDto
  ) {
    return this.adminService
      .reorderIngredientCategories(operationId, body.items, request.admin.adminId)
      .then(result => ok(result));
  }

  @Get("ingredients")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(AdminIngredientModel, "后台系统食材列表")
  listIngredients(
    @Req() request: RequestWithAdmin & AssetRequest,
    @Query() query: AdminIngredientQueryDto
  ) {
    return this.adminService
      .listIngredients(request, query.page, query.pageSize, query.categoryId, query.keyword, query.status, request.admin.adminId)
      .then(result => ok(result));
  }

  @Get("units")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkArray(AdminUnitModel, "后台系统单位列表")
  listSystemUnits(@Req() request: RequestWithAdmin) {
    return this.adminService.listSystemUnits(request.admin.adminId).then(result => ok(result));
  }

  @Post("units")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminUnitModel, "后台新建系统单位")
  createSystemUnit(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: AdminUnitPayloadDto
  ) {
    return this.adminService
      .createSystemUnit({ ...body, operationId, type: body.type as UnitType }, request.admin.adminId)
      .then(result => ok(result));
  }

  @Put("units/:unitId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminUnitModel, "后台编辑系统单位")
  updateSystemUnit(
    @Req() request: RequestWithAdmin,
    @Param("unitId", ParseIntPipe) unitId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateAdminUnitDto
  ) {
    return this.adminService
      .updateSystemUnit(unitId, { ...body, operationId, type: body.type as UnitType }, request.admin.adminId)
      .then(result => ok(result));
  }

  @Delete("units/:unitId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminDeleteUnitResultModel, "后台删除系统单位")
  deleteSystemUnit(
    @Req() request: RequestWithAdmin,
    @Param("unitId", ParseIntPipe) unitId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: DeleteAdminUnitDto
  ) {
    return this.adminService.deleteSystemUnit(unitId, operationId, body.expectedVersion, request.admin.adminId).then(result => ok(result));
  }

  @Post("units/reorder")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkArray(AdminUnitModel, "后台重排系统单位")
  reorderSystemUnits(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ReorderAdminUnitsDto
  ) {
    return this.adminService
      .reorderSystemUnits(body.type as UnitType, operationId, body.items, request.admin.adminId)
      .then(result => ok(result));
  }

  @Post("ingredients")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminIngredientModel, "后台新建系统食材")
  createIngredient(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: AdminIngredientPayloadDto
  ) {
    return this.adminService.createIngredient({ ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Put("ingredients/:ingredientId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminIngredientModel, "后台编辑系统食材")
  updateIngredient(
    @Req() request: RequestWithAdmin & AssetRequest,
    @Param("ingredientId", ParseIntPipe) ingredientId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateAdminIngredientDto
  ) {
    return this.adminService.updateIngredient(request, ingredientId, { ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Post("ingredients/:ingredientId/status")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminIngredientModel, "后台更新系统食材状态")
  setIngredientStatus(
    @Req() request: RequestWithAdmin & AssetRequest,
    @Param("ingredientId", ParseIntPipe) ingredientId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: SetAdminIngredientStatusDto
  ) {
    return this.adminService.setIngredientStatus(request, ingredientId, { ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Post("ingredients/:ingredientId/image")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminIngredientModel, "上传或替换系统食材图片")
  uploadIngredientImage(
    @Req() request: RequestWithAdmin & AssetRequest,
    @Param("ingredientId", ParseIntPipe) ingredientId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateAdminIngredientImageDto,
    @UploadedFile() file?: { buffer?: Buffer; size?: number }
  ) {
    return this.adminService
      .uploadIngredientImage(request, ingredientId, operationId, body.expectedVersion, file, request.admin.adminId)
      .then(result => ok(result));
  }

  @Delete("ingredients/:ingredientId/image")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminIngredientModel, "清空系统食材图片")
  clearIngredientImage(
    @Req() request: RequestWithAdmin & AssetRequest,
    @Param("ingredientId", ParseIntPipe) ingredientId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateAdminIngredientImageDto
  ) {
    return this.adminService
      .clearIngredientImage(request, ingredientId, operationId, body.expectedVersion, request.admin.adminId)
      .then(result => ok(result));
  }

  @Post("ingredients/reorder")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkArray(AdminIngredientModel, "后台重排系统食材")
  reorderIngredients(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ReorderAdminIngredientsDto
  ) {
    return this.adminService
      .reorderIngredients(body.categoryId, operationId, body.items, request.admin.adminId)
      .then(result => ok(result));
  }

  @Get("pending-ingredients")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(AdminPendingIngredientModel, "后台待审核个人食材列表")
  listPendingIngredients(@Req() request: RequestWithAdmin, @Query() query: AdminPendingIngredientQueryDto) {
    return this.adminService
      .listPendingIngredients(query.page, query.pageSize, query.keyword, request.admin.adminId)
      .then(result => ok(result));
  }

  @Post("pending-ingredients/:ingredientId/review")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminReviewPendingIngredientResultModel, "后台审核个人食材推荐")
  reviewPendingIngredient(
    @Req() request: RequestWithAdmin & AssetRequest,
    @Param("ingredientId", ParseIntPipe) ingredientId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ReviewPendingIngredientDto
  ) {
    return this.adminService.reviewPendingIngredient(request, ingredientId, { ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Get("recipe-reports")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(RecipeReportModel, "后台菜谱举报列表")
  listRecipeReports(@Req() request: RequestWithAdmin, @Query() query: AdminRecipeReportQueryDto) {
    return this.adminService.listRecipeReports(query.page, query.pageSize, query.status, request.admin.adminId).then(result => ok(result));
  }

  @Post("recipes/:recipeId/block")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminRecipeModel, "后台下架一个菜谱")
  blockRecipe(
    @Req() request: RequestWithAdmin,
    @Param("recipeId", ParseIntPipe) recipeId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: BlockRecipeDto
  ) {
    return this.adminService.blockRecipe(recipeId, request.admin.adminId, operationId, body.reason).then(result => ok(result));
  }

  @Post("recipes/:recipeId/unblock")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminRecipeModel, "后台恢复一个菜谱")
  unblockRecipe(
    @Req() request: RequestWithAdmin,
    @Param("recipeId", ParseIntPipe) recipeId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() _body: OperationDto
  ) {
    return this.adminService.unblockRecipe(recipeId, request.admin.adminId, operationId).then(result => ok(result));
  }

  @Post("recipe-reports/:reportId/resolve")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(RecipeReportModel, "后台处理一个菜谱举报")
  resolveRecipeReport(
    @Req() request: RequestWithAdmin,
    @Param("reportId", ParseIntPipe) reportId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ResolveRecipeReportDto
  ) {
    return this.adminService
      .resolveRecipeReport(reportId, request.admin.adminId, operationId, body.resolutionNote)
      .then(result => ok(result));
  }
}
