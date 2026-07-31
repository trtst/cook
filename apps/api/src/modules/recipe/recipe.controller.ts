import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  CreateMyRecipeFromInspirationDto,
  CreateIngredientDto,
  CreateIngredientFeedbackDto,
  IngredientRecommendationListQueryDto,
  CreateCollectionRecipeDto,
  CreateRecipeDraftDto,
  CreateUnitDto,
  CollectionRecipeListQueryDto,
  DeleteRecipeDraftDto,
  DeleteRecipeDto,
    IngredientListQueryDto,
    InspirationRecipeListQueryDto,
    OperationDto,
    PublishRecipeDraftDto,
    RecommendIngredientDto,
    RecommendRecipeDto,
    RecipeCategoryNameDto,
    RecipeDraftListQueryDto,
    RecipeListQueryDto,
    RecipeSceneNameDto,
    ReorderRecipeCategoriesDto,
    ReorderRecipesDto,
    ReorderRecipeScenesDto,
    ReportRecipeDto,
    UnitListQueryDto,
    UpdateRecipeCategoryDto,
    UpdateIngredientDto,
    UpdateRecipeDraftDto,
    UpdateRecipeSceneDto,
    WithdrawRecipeRecommendationDto
  } from "../../contracts/dtos";
import {
  ApiOkArray,
  ApiOkModel,
  ApiOkPage,
  CollectionListModel,
  CollectedRecipeDetailModel,
  CollectedRecipeSummaryModel,
  DeleteRecipeDraftResultModel,
  DeleteRecipeResultModel,
  IngredientCategoryModel,
  IngredientFeedbackResultModel,
  IngredientRecommendationModel,
  IngredientModel,
  InspirationCategoryModel,
    InspirationRecipeDetailModel,
    InspirationRecipeSummaryModel,
    MyRecipeDetailModel,
    MyRecipeSummaryModel,
    PublishRecipeDraftResultModel,
    RecipeRecommendationModel,
    RecipeCategoryModel,
  RecipeDraftDetailModel,
  RecipeDraftSummaryModel,
  RecipeReportModel,
  RecipeSceneModel,
  SaveRecipeDraftResultModel,
  SaveCollectionRecipeResultModel,
  UnitModel
} from "../../contracts/openapi";
import type { RecipeDraftContentInput, UnitType } from "../../contracts/types";
import { RecipeService } from "./recipe.service";

function toAssetRequest(request: RequestWithUser) {
  const current = request as RequestWithUser & {
    protocol?: string;
    headers?: Record<string, string | string[] | undefined>;
  };
  return {
    protocol: current.protocol,
    get(name: string) {
      const value = current.headers?.[name.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    }
  };
}

function toDraftContentInput(content: CreateRecipeDraftDto["content"] | UpdateRecipeDraftDto["content"]): RecipeDraftContentInput {
  return {
    name: content.name,
    story: content.story,
    categoryId: content.categoryId,
    sceneIds: content.sceneIds,
    originVersionId: content.originVersionId ?? null,
    originCoverImageUrl: content.originCoverImageUrl ?? null,
    coverUploadId: content.coverUploadId,
    coverImageUrl: content.coverImageUrl,
    baseServings: content.baseServings,
    difficulty: content.difficulty as RecipeDraftContentInput["difficulty"],
    duration: content.duration as RecipeDraftContentInput["duration"],
    tips: content.tips,
    ingredients: content.ingredients.map(item => ({
      ingredientId: item.ingredientId,
      name: item.name,
      quantity: item.quantity,
      unitId: item.unitId,
      fuzzyText: item.fuzzyText,
      categoryId: item.categoryId,
      defaultUnitId: item.defaultUnitId,
      source: item.source
    })),
    steps: content.steps.map(item => ({
      slotKey: item.slotKey,
      text: item.text,
      uploadId: item.uploadId,
      imageUrl: item.imageUrl
    }))
  };
}

@ApiTags("recipes")
@Controller()
export class RecipeController {
  constructor(@Inject(RecipeService) private readonly recipeService: RecipeService) {}

  @Get("inspiration-categories")
  @ApiOkArray(InspirationCategoryModel, "匿名读取灵感平台分类")
  listInspirationCategories() {
    return this.recipeService.listInspirationCategories().then(result => ok(result));
  }

  @Get("inspiration-recipes")
  @ApiOkPage(InspirationRecipeSummaryModel, "匿名分页读取灵感菜谱摘要")
  listInspirationRecipes(@Query() query: InspirationRecipeListQueryDto) {
    return this.recipeService
      .listInspirationRecipes(
        query.page,
        query.pageSize,
        query.keyword,
        query.categoryId,
        query.sort as "RECOMMENDED" | "LATEST" | undefined,
        query.difficulty as "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING" | undefined,
        query.duration as "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" | undefined
      )
      .then(result => ok(result));
  }

  @Get("inspiration-recipes/:recipeId")
  @ApiOkModel(InspirationRecipeDetailModel, "匿名读取一个可曝光灵感菜谱详情")
  getInspirationRecipe(@Param("recipeId", ParseIntPipe) recipeId: number) {
    return this.recipeService.getInspirationRecipe(recipeId).then(result => ok(result));
  }

  @Get("recipe-categories")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkArray(RecipeCategoryModel, "读取我的个人分类")
  listRecipeCategories(@Req() request: RequestWithUser) {
    return this.recipeService.listRecipeCategories(request.user.userId).then(result => ok(result));
  }

  @Post("recipe-categories")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(RecipeCategoryModel, "新建个人分类")
  createRecipeCategory(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: RecipeCategoryNameDto
  ) {
    return this.recipeService.createRecipeCategory(request.user.userId, operationId, body.name).then(result => ok(result));
  }

  @Put("recipe-categories/:categoryId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(RecipeCategoryModel, "改名一个个人分类")
  updateRecipeCategory(
    @Req() request: RequestWithUser,
    @Param("categoryId", ParseIntPipe) categoryId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateRecipeCategoryDto
  ) {
    return this.recipeService
      .updateRecipeCategory(request.user.userId, categoryId, operationId, body.expectedVersion, body.name)
      .then(result => ok(result));
  }

  @Post("recipe-categories/reorder")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkArray(RecipeCategoryModel, "重排我的个人分类")
  reorderRecipeCategories(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ReorderRecipeCategoriesDto
  ) {
    return this.recipeService.reorderRecipeCategories(request.user.userId, operationId, body.items).then(result => ok(result));
  }

  @Get("recipe-scenes")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkArray(RecipeSceneModel, "读取我的个人场景")
  listRecipeScenes(@Req() request: RequestWithUser) {
    return this.recipeService.listRecipeScenes(request.user.userId).then(result => ok(result));
  }

  @Post("recipe-scenes")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(RecipeSceneModel, "新建个人场景")
  createRecipeScene(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: RecipeSceneNameDto
  ) {
    return this.recipeService.createRecipeScene(request.user.userId, operationId, body.name).then(result => ok(result));
  }

  @Put("recipe-scenes/:sceneId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(RecipeSceneModel, "改名一个个人场景")
  updateRecipeScene(
    @Req() request: RequestWithUser,
    @Param("sceneId", ParseIntPipe) sceneId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateRecipeSceneDto
  ) {
    return this.recipeService
      .updateRecipeScene(request.user.userId, sceneId, operationId, body.expectedVersion, body.name)
      .then(result => ok(result));
  }

  @Post("recipe-scenes/reorder")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkArray(RecipeSceneModel, "重排我的个人场景")
  reorderRecipeScenes(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ReorderRecipeScenesDto
  ) {
    return this.recipeService.reorderRecipeScenes(request.user.userId, operationId, body.items).then(result => ok(result));
  }

  @Get("ingredient-categories")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkArray(IngredientCategoryModel, "读取系统食材分类")
  listIngredientCategories() {
    return this.recipeService.listIngredientCategories().then(result => ok(result));
  }

  @Get("ingredients")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkPage(IngredientModel, "分页读取系统或我的食材")
  listIngredients(@Req() request: RequestWithUser, @Query() query: IngredientListQueryDto) {
    return this.recipeService
      .listIngredients(toAssetRequest(request), request.user.userId, query.page, query.pageSize, query.keyword, query.categoryId, query.source)
      .then(result => ok(result));
  }

  @Post("ingredients")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(IngredientModel, "新建我的食材")
  createIngredient(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateIngredientDto
  ) {
    return this.recipeService
      .createIngredient(toAssetRequest(request), request.user.userId, operationId, body.name, body.categoryId, body.defaultUnitId)
      .then(result => ok(result));
  }

  @Put("ingredients/:ingredientId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(IngredientModel, "编辑我的个人食材")
  updateIngredient(
    @Req() request: RequestWithUser,
    @Param("ingredientId", ParseIntPipe) ingredientId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateIngredientDto
  ) {
    return this.recipeService
      .updateIngredient(
        toAssetRequest(request),
        request.user.userId,
        ingredientId,
        operationId,
        body.expectedVersion,
        body.name,
        body.categoryId,
        body.defaultUnitId
      )
      .then(result => ok(result));
  }

  @Post("ingredients/:ingredientId/recommendations")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(IngredientRecommendationModel, "显式推荐个人食材进入系统库")
  recommendIngredient(
    @Req() request: RequestWithUser,
    @Param("ingredientId", ParseIntPipe) ingredientId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: RecommendIngredientDto
  ) {
    return this.recipeService.recommendIngredient(toAssetRequest(request), request.user.userId, ingredientId, operationId).then(result => ok(result));
  }

  @Post("ingredients/:ingredientId/feedbacks")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(IngredientFeedbackResultModel, "提交系统食材纠错反馈")
  createIngredientFeedback(
    @Req() request: RequestWithUser,
    @Param("ingredientId", ParseIntPipe) ingredientId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateIngredientFeedbackDto
  ) {
    return this.recipeService
      .createIngredientFeedback(request.user.userId, ingredientId, {
        operationId,
        name: body.name,
        categoryId: body.categoryId,
        note: body.note
      })
      .then(result => ok(result));
  }

  @Get("ingredient-recommendations")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkPage(IngredientRecommendationModel, "分页读取我的食材推荐记录")
  listIngredientRecommendations(@Req() request: RequestWithUser, @Query() query: IngredientRecommendationListQueryDto) {
    return this.recipeService
      .listIngredientRecommendations(toAssetRequest(request), request.user.userId, query.page, query.pageSize)
      .then(result => ok(result));
  }

  @Get("units")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkPage(UnitModel, "分页读取系统或我的单位")
  listUnits(@Req() request: RequestWithUser, @Query() query: UnitListQueryDto) {
    return this.recipeService
      .listUnits(request.user.userId, query.page, query.pageSize, query.keyword, query.type, query.source)
      .then(result => ok(result));
  }

  @Post("units")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(UnitModel, "新建我的单位")
  createUnit(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateUnitDto
  ) {
    return this.recipeService.createUnit(request.user.userId, operationId, body.name, body.type as UnitType).then(result => ok(result));
  }

  @Get("recipe-drafts")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkPage(RecipeDraftSummaryModel, "分页读取我的草稿箱")
  listRecipeDrafts(@Req() request: RequestWithUser, @Query() query: RecipeDraftListQueryDto) {
    return this.recipeService.listRecipeDrafts(request.user.userId, query.page, query.pageSize, query.keyword).then(result => ok(result));
  }

  @Post("recipe-drafts")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(SaveRecipeDraftResultModel, "首次保存一个新草稿或编辑草稿")
  createRecipeDraft(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateRecipeDraftDto
  ) {
    return this.recipeService
      .createRecipeDraft(request.user.userId, operationId, body.recipeId, toDraftContentInput(body.content))
      .then(result => ok(result));
  }

  @Get("recipe-drafts/:draftId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(RecipeDraftDetailModel, "读取我的一个草稿详情")
  getRecipeDraft(@Req() request: RequestWithUser, @Param("draftId", ParseIntPipe) draftId: number) {
    return this.recipeService.getRecipeDraft(request.user.userId, draftId).then(result => ok(result));
  }

  @Put("recipe-drafts/:draftId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(SaveRecipeDraftResultModel, "保存一个已有草稿")
  updateRecipeDraft(
    @Req() request: RequestWithUser,
    @Param("draftId", ParseIntPipe) draftId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateRecipeDraftDto
  ) {
    return this.recipeService
      .updateRecipeDraft(request.user.userId, draftId, operationId, body.expectedVersion, toDraftContentInput(body.content))
      .then(result => ok(result));
  }

  @Post("recipe-drafts/:draftId/delete")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DeleteRecipeDraftResultModel, "删除一个草稿")
  deleteRecipeDraft(
    @Req() request: RequestWithUser,
    @Param("draftId", ParseIntPipe) draftId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: DeleteRecipeDraftDto
  ) {
    return this.recipeService
      .deleteRecipeDraft(request.user.userId, draftId, operationId, body.expectedVersion)
      .then(result => ok(result));
  }

  @Post("recipe-drafts/:draftId/publish")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(PublishRecipeDraftResultModel, "发布一个草稿到我的菜谱")
  publishRecipeDraft(
    @Req() request: RequestWithUser,
    @Param("draftId", ParseIntPipe) draftId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: PublishRecipeDraftDto
  ) {
    return this.recipeService
      .publishRecipeDraft(request.user.userId, draftId, operationId, body.expectedVersion)
      .then(result => ok(result));
  }

  @Get("recipes")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkPage(MyRecipeSummaryModel, "分页读取我的已发布菜谱")
  listMyRecipes(@Req() request: RequestWithUser, @Query() query: RecipeListQueryDto) {
    return this.recipeService
      .listMyRecipes(request.user.userId, query.page, query.pageSize, query.keyword, query.categoryId)
      .then(result => ok(result));
  }

  @Get("recipes/:recipeId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(MyRecipeDetailModel, "读取我的一个已发布菜谱详情")
  getMyRecipe(@Req() request: RequestWithUser, @Param("recipeId", ParseIntPipe) recipeId: number) {
    return this.recipeService.getMyRecipe(request.user.userId, recipeId).then(result => ok(result));
  }

  @Post("recipes/from-inspiration")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(PublishRecipeDraftResultModel, "从灵感详情直接加入我的菜谱")
  createMyRecipeFromInspiration(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateMyRecipeFromInspirationDto
  ) {
    return this.recipeService
      .createMyRecipeFromInspiration(
        request.user.userId,
        operationId,
        body.sourceRecipeId,
        body.sourceVersionId,
        body.categoryId,
        body.sceneIds
      )
      .then(result => ok(result));
  }

  @Post("recipes/:recipeId/recommendations")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(RecipeRecommendationModel, "推荐我的已发布菜谱进入系统菜谱审核")
  recommendRecipe(
    @Req() request: RequestWithUser,
    @Param("recipeId", ParseIntPipe) recipeId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: RecommendRecipeDto
  ) {
    return this.recipeService
      .recommendRecipe(request.user.userId, recipeId, operationId, body.inspirationCategoryId)
      .then(result => ok(result));
  }

  @Post("recipe-recommendations/:recommendationId/withdraw")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(RecipeRecommendationModel, "撤回一个待审核中的菜谱推荐")
  withdrawRecipeRecommendation(
    @Req() request: RequestWithUser,
    @Param("recommendationId", ParseIntPipe) recommendationId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: WithdrawRecipeRecommendationDto
  ) {
    return this.recipeService
      .withdrawRecipeRecommendation(request.user.userId, recommendationId, operationId, body.expectedVersion)
      .then(result => ok(result));
  }

  @Post("recipes/reorder")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkArray(MyRecipeSummaryModel, "重排某个分类下的我的菜谱")
  reorderRecipes(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ReorderRecipesDto
  ) {
    return this.recipeService.reorderRecipes(request.user.userId, body.categoryId, operationId, body.items).then(result => ok(result));
  }

  @Post("recipes/:recipeId/delete")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DeleteRecipeResultModel, "删除我的一个已发布菜谱")
  deleteRecipe(
    @Req() request: RequestWithUser,
    @Param("recipeId", ParseIntPipe) recipeId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: DeleteRecipeDto
  ) {
    return this.recipeService.deleteRecipe(request.user.userId, recipeId, operationId, body.expectedVersion).then(result => ok(result));
  }

  @Get("collections")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(CollectionListModel, "读取我的合集列表和总收藏数")
  listCollections(@Req() request: RequestWithUser) {
    return this.recipeService.listCollections(request.user.userId).then(result => ok(result));
  }

  @Get("collections/recipes")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkPage(CollectedRecipeSummaryModel, "分页读取我的合集内容")
  listCollectionRecipes(@Req() request: RequestWithUser, @Query() query: CollectionRecipeListQueryDto) {
    return this.recipeService
      .listCollectionRecipes(request.user.userId, query.page, query.pageSize, query.keyword, query.sceneId)
      .then(result => ok(result));
  }

  @Get("collections/recipes/:collectionRecipeId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(CollectedRecipeDetailModel, "读取我的一个收藏快照详情")
  getCollectionRecipe(
    @Req() request: RequestWithUser,
    @Param("collectionRecipeId", ParseIntPipe) collectionRecipeId: number
  ) {
    return this.recipeService.getCollectionRecipe(request.user.userId, collectionRecipeId).then(result => ok(result));
  }

  @Post("collections/recipes")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(SaveCollectionRecipeResultModel, "收藏一个灵感固定版本到我的合集")
  collectRecipe(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateCollectionRecipeDto
  ) {
    return this.recipeService
      .collectRecipe(request.user.userId, operationId, body.sourceRecipeId, body.sourceVersionId, body.sceneIds)
      .then(result => ok(result));
  }

  @Post("recipes/:recipeId/report")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(RecipeReportModel, "举报一个可见菜谱")
  reportRecipe(
    @Req() request: RequestWithUser,
    @Param("recipeId", ParseIntPipe) recipeId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ReportRecipeDto
  ) {
    return this.recipeService.reportRecipe(request.user.userId, recipeId, operationId, body.reason).then(result => ok(result));
  }
}
