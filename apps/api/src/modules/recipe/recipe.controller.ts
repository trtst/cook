import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  CreateIngredientDto,
  CreateRecipeDraftDto,
  CreateUnitDto,
  DeleteRecipeDraftDto,
  DeleteRecipeDto,
  IngredientListQueryDto,
  InspirationRecipeListQueryDto,
  OperationDto,
  PublishRecipeDraftDto,
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
  UpdateRecipeDraftDto,
  UpdateRecipeSceneDto
} from "../../contracts/dtos";
import {
  ApiOkArray,
  ApiOkModel,
  ApiOkPage,
  DeleteRecipeDraftResultModel,
  DeleteRecipeResultModel,
  IngredientCategoryModel,
  IngredientModel,
  InspirationCategoryModel,
  InspirationRecipeDetailModel,
  InspirationRecipeSummaryModel,
  MyRecipeDetailModel,
  MyRecipeSummaryModel,
  PublishRecipeDraftResultModel,
  RecipeCategoryModel,
  RecipeDraftDetailModel,
  RecipeDraftSummaryModel,
  RecipeReportModel,
  RecipeSceneModel,
  UnitModel
} from "../../contracts/openapi";
import type { RecipeDraftContentInput, UnitType } from "../../contracts/types";
import { RecipeService } from "./recipe.service";

function toDraftContentInput(content: CreateRecipeDraftDto["content"] | UpdateRecipeDraftDto["content"]): RecipeDraftContentInput {
  return {
    name: content.name,
    story: content.story,
    categoryId: content.categoryId,
    sceneIds: content.sceneIds,
    baseServings: content.baseServings,
    difficulty: content.difficulty as RecipeDraftContentInput["difficulty"],
    durationMinutes: content.durationMinutes,
    tips: content.tips,
    ingredients: content.ingredients.map(item => ({
      ingredientId: item.ingredientId,
      amount:
        item.amount.kind === "EXACT"
          ? {
              kind: "EXACT",
              quantity: item.amount.quantity ?? "",
              unitId: item.amount.unitId ?? ""
            }
          : {
              kind: "FUZZY",
              text: (item.amount.text ?? "适量") as "适量" | "少许" | "按需"
            }
    })),
    steps: content.steps.map(item => ({
      text: item.text
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
        query.difficulty as "EASY" | "MEDIUM" | "HARD" | undefined,
        query.maxDurationMinutes
      )
      .then(result => ok(result));
  }

  @Get("inspiration-recipes/:recipeId")
  @ApiOkModel(InspirationRecipeDetailModel, "匿名读取一个可曝光灵感菜谱详情")
  getInspirationRecipe(@Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string) {
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
  @ApiOkModel(RecipeCategoryModel, "新建个人分类")
  createRecipeCategory(@Req() request: RequestWithUser, @Body() body: RecipeCategoryNameDto) {
    return this.recipeService.createRecipeCategory(request.user.userId, body.operationId, body.name).then(result => ok(result));
  }

  @Put("recipe-categories/:categoryId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(RecipeCategoryModel, "改名一个个人分类")
  updateRecipeCategory(
    @Req() request: RequestWithUser,
    @Param("categoryId", new ParseUUIDPipe({ version: "4" })) categoryId: string,
    @Body() body: UpdateRecipeCategoryDto
  ) {
    return this.recipeService
      .updateRecipeCategory(request.user.userId, categoryId, body.operationId, body.expectedVersion, body.name)
      .then(result => ok(result));
  }

  @Post("recipe-categories/reorder")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkArray(RecipeCategoryModel, "重排我的个人分类")
  reorderRecipeCategories(@Req() request: RequestWithUser, @Body() body: ReorderRecipeCategoriesDto) {
    return this.recipeService.reorderRecipeCategories(request.user.userId, body.operationId, body.items).then(result => ok(result));
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
  @ApiOkModel(RecipeSceneModel, "新建个人场景")
  createRecipeScene(@Req() request: RequestWithUser, @Body() body: RecipeSceneNameDto) {
    return this.recipeService.createRecipeScene(request.user.userId, body.operationId, body.name).then(result => ok(result));
  }

  @Put("recipe-scenes/:sceneId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(RecipeSceneModel, "改名一个个人场景")
  updateRecipeScene(
    @Req() request: RequestWithUser,
    @Param("sceneId", new ParseUUIDPipe({ version: "4" })) sceneId: string,
    @Body() body: UpdateRecipeSceneDto
  ) {
    return this.recipeService
      .updateRecipeScene(request.user.userId, sceneId, body.operationId, body.expectedVersion, body.name)
      .then(result => ok(result));
  }

  @Post("recipe-scenes/reorder")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkArray(RecipeSceneModel, "重排我的个人场景")
  reorderRecipeScenes(@Req() request: RequestWithUser, @Body() body: ReorderRecipeScenesDto) {
    return this.recipeService.reorderRecipeScenes(request.user.userId, body.operationId, body.items).then(result => ok(result));
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
      .listIngredients(request.user.userId, query.page, query.pageSize, query.keyword, query.categoryId, query.source)
      .then(result => ok(result));
  }

  @Post("ingredients")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(IngredientModel, "新建我的食材")
  createIngredient(@Req() request: RequestWithUser, @Body() body: CreateIngredientDto) {
    return this.recipeService
      .createIngredient(request.user.userId, body.operationId, body.name, body.categoryId, body.defaultUnitId)
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
  @ApiOkModel(UnitModel, "新建我的单位")
  createUnit(@Req() request: RequestWithUser, @Body() body: CreateUnitDto) {
    return this.recipeService.createUnit(request.user.userId, body.operationId, body.name, body.type as UnitType).then(result => ok(result));
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
  @ApiOkModel(RecipeDraftDetailModel, "首次保存一个新草稿或编辑草稿")
  createRecipeDraft(@Req() request: RequestWithUser, @Body() body: CreateRecipeDraftDto) {
    return this.recipeService
      .createRecipeDraft(request.user.userId, body.operationId, body.recipeId, toDraftContentInput(body.content))
      .then(result => ok(result));
  }

  @Get("recipe-drafts/:draftId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(RecipeDraftDetailModel, "读取我的一个草稿详情")
  getRecipeDraft(@Req() request: RequestWithUser, @Param("draftId", new ParseUUIDPipe({ version: "4" })) draftId: string) {
    return this.recipeService.getRecipeDraft(request.user.userId, draftId).then(result => ok(result));
  }

  @Put("recipe-drafts/:draftId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(RecipeDraftDetailModel, "保存一个已有草稿")
  updateRecipeDraft(
    @Req() request: RequestWithUser,
    @Param("draftId", new ParseUUIDPipe({ version: "4" })) draftId: string,
    @Body() body: UpdateRecipeDraftDto
  ) {
    return this.recipeService
      .updateRecipeDraft(request.user.userId, draftId, body.operationId, body.expectedVersion, toDraftContentInput(body.content))
      .then(result => ok(result));
  }

  @Post("recipe-drafts/:draftId/delete")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(DeleteRecipeDraftResultModel, "删除一个草稿")
  deleteRecipeDraft(
    @Req() request: RequestWithUser,
    @Param("draftId", new ParseUUIDPipe({ version: "4" })) draftId: string,
    @Body() body: DeleteRecipeDraftDto
  ) {
    return this.recipeService
      .deleteRecipeDraft(request.user.userId, draftId, body.operationId, body.expectedVersion)
      .then(result => ok(result));
  }

  @Post("recipe-drafts/:draftId/publish")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(PublishRecipeDraftResultModel, "发布一个草稿到我的菜谱")
  publishRecipeDraft(
    @Req() request: RequestWithUser,
    @Param("draftId", new ParseUUIDPipe({ version: "4" })) draftId: string,
    @Body() body: PublishRecipeDraftDto
  ) {
    return this.recipeService
      .publishRecipeDraft(request.user.userId, draftId, body.operationId, body.expectedVersion)
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
  getMyRecipe(@Req() request: RequestWithUser, @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string) {
    return this.recipeService.getMyRecipe(request.user.userId, recipeId).then(result => ok(result));
  }

  @Post("recipes/reorder")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkArray(MyRecipeSummaryModel, "重排某个分类下的我的菜谱")
  reorderRecipes(@Req() request: RequestWithUser, @Body() body: ReorderRecipesDto) {
    return this.recipeService.reorderRecipes(request.user.userId, body.categoryId, body.operationId, body.items).then(result => ok(result));
  }

  @Post("recipes/:recipeId/delete")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(DeleteRecipeResultModel, "删除我的一个已发布菜谱")
  deleteRecipe(
    @Req() request: RequestWithUser,
    @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string,
    @Body() body: DeleteRecipeDto
  ) {
    return this.recipeService.deleteRecipe(request.user.userId, recipeId, body.operationId, body.expectedVersion).then(result => ok(result));
  }

  @Post("recipes/:recipeId/report")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(RecipeReportModel, "举报一个可见菜谱")
  reportRecipe(
    @Req() request: RequestWithUser,
    @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string,
    @Body() body: ReportRecipeDto
  ) {
    return this.recipeService.reportRecipe(request.user.userId, recipeId, body.operationId, body.reason).then(result => ok(result));
  }
}
