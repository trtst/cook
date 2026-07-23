import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  CreateRecipeDto,
  DeleteRecipeDto,
  OperationDto,
  RecipeListQueryDto,
  ReportRecipeDto,
  UpdateRecipeDto
} from "../../contracts/dtos";
import {
  ApiOkModel,
  ApiOkPage,
  DeleteRecipeResultModel,
  ImportRecipeResultModel,
  RecipeDetailModel,
  RecipeReportModel,
  RecipeSummaryModel
} from "../../contracts/openapi";
import type { RecipeContentInput } from "../../contracts/types";
import { RecipeService } from "./recipe.service";

function toRecipeContent(content: CreateRecipeDto["content"] | UpdateRecipeDto["content"]): RecipeContentInput {
  if (content.images !== undefined) {
    throw new BadRequestException("图片上传功能尚未开放");
  }
  return {
    name: content.name,
    ingredients: content.ingredients,
    steps: content.steps,
    servings: content.servings ?? null,
    durationMinutes: content.durationMinutes ?? null
  };
}

@ApiTags("recipes")
@Controller("recipes")
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class RecipeController {
  constructor(@Inject(RecipeService) private readonly recipeService: RecipeService) {}

  @Get()
  @ApiOkPage(RecipeSummaryModel, "分页查询我的个人菜谱、系统菜谱或合并搜索结果")
  list(@Req() request: RequestWithUser, @Query() query: RecipeListQueryDto) {
    return this.recipeService
      .list(request.user.userId, query.page, query.pageSize, query.keyword, query.scope)
      .then(result => ok(result));
  }

  @Get(":recipeId")
  @ApiOkModel(RecipeDetailModel, "读取单个菜谱详情，返回基础版本与个人覆盖合并后的有效正文")
  getDetail(@Req() request: RequestWithUser, @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string) {
    return this.recipeService.getDetail(request.user.userId, recipeId).then(result => ok(result));
  }

  @Post()
  @ApiOkModel(RecipeDetailModel, "新建个人菜谱")
  create(@Req() request: RequestWithUser, @Body() body: CreateRecipeDto) {
    return this.recipeService.create(request.user.userId, body.operationId, toRecipeContent(body.content)).then(result => ok(result));
  }

  @Post(":recipeId/import")
  @ApiOkModel(ImportRecipeResultModel, "导入系统或其他用户菜谱")
  importRecipe(
    @Req() request: RequestWithUser,
    @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string,
    @Body() body: OperationDto
  ) {
    return this.recipeService.importRecipe(request.user.userId, recipeId, body.operationId).then(result => ok(result));
  }

  @Put(":recipeId")
  @ApiOkModel(RecipeDetailModel, "更新个人菜谱，按规则写入覆盖或独立版本")
  update(
    @Req() request: RequestWithUser,
    @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string,
    @Body() body: UpdateRecipeDto
  ) {
    return this.recipeService
      .update(request.user.userId, recipeId, body.operationId, body.expectedVersion, toRecipeContent(body.content))
      .then(result => ok(result));
  }

  @Post(":recipeId/delete")
  @ApiOkModel(DeleteRecipeResultModel, "删除个人菜谱，按当前套餐决定回收或永久删除")
  deleteRecipe(
    @Req() request: RequestWithUser,
    @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string,
    @Body() body: DeleteRecipeDto
  ) {
    return this.recipeService
      .deleteRecipe(request.user.userId, recipeId, body.operationId, body.expectedVersion)
      .then(result => ok(result));
  }

  @Post(":recipeId/report")
  @ApiOkModel(RecipeReportModel, "举报菜谱")
  report(
    @Req() request: RequestWithUser,
    @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string,
    @Body() body: ReportRecipeDto
  ) {
    return this.recipeService.reportRecipe(request.user.userId, recipeId, body.operationId, body.reason).then(result => ok(result));
  }
}
