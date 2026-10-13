import { Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithAdmin } from "../../common/auth-context";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { CreateHomeTopicDto, DeleteHomeTopicDto, DismissHomeTopicTodoDto, HomeTopicBatchImportDto, HomeTopicHistoryQueryDto, HomeTopicRecipeQueryDto, ReplaceHomeTopicItemDto, SetHomeTopicScheduleDto, SetHomeTopicStatusDto, UpdateHomeTopicDto, UpdateHomeTopicImageDto } from "../../contracts/dtos";
import { AdminHomeTopicItemModel, AdminHomeTopicMiniCodeResponseModel, AdminHomeTopicTodosPageModel, AdminHomeTopicsResponseModel, ApiOkModel, HomeTopicBatchImportResponseModel, HomeTopicBatchPreviewResponseModel, HomeTopicMenuCheckResponseModel, HomeTopicRecipeSearchResponseModel, HomeTopicRecipeStatsResponseModel, RebuildHomeTopicRecipeStatsResponseModel } from "../../contracts/openapi";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import { HomeTopicService } from "./home-topic.service";
import { HomeTopicMenuCheckService } from "./home-topic-menu-check.service";
import { HomeTopicStatsService } from "./home-topic-stats.service";

@ApiTags("admin-home-topics")
@Controller("admin/home-topics")
@UseGuards(AdminAuthGuard)
@ApiBearerAuth("AdminBearerAuth")
export class AdminHomeTopicController {
  constructor(
    @Inject(HomeTopicService) private readonly homeTopicService: HomeTopicService,
    @Inject(HomeTopicMenuCheckService) private readonly menuCheckService: HomeTopicMenuCheckService,
    @Inject(HomeTopicStatsService) private readonly statsService: HomeTopicStatsService
  ) {}

  @Get("statistics")
  @UseGuards(SuperAdminGuard)
  @ApiOkModel(HomeTopicRecipeStatsResponseModel, "读取共享周刊可用菜谱统计快照")
  getRecipeStats() {
    return this.statsService.getSnapshot().then(result => ok(result));
  }

  @Post("statistics/rebuild")
  @UseGuards(SuperAdminGuard)
  @ApiIdempotencyKey()
  @ApiOkModel(RebuildHomeTopicRecipeStatsResponseModel, "重建共享周刊可用菜谱统计快照")
  rebuildRecipeStats(@Req() request: RequestWithAdmin, @ReadIdempotencyKey() operationId: string) {
    return this.statsService.rebuild(request.admin.adminId, operationId).then(result => ok(result));
  }

  @Get(":topicId/menu-check")
  @UseGuards(SuperAdminGuard)
  @ApiOkModel(HomeTopicMenuCheckResponseModel, "读取或生成指定周刊版本的菜单结构检查")
  getMenuCheck(@Param("topicId", ParseIntPipe) topicId: number) {
    return this.menuCheckService.getMenuCheck(topicId).then(result => ok(result));
  }

  @Get()
  @ApiOkModel(AdminHomeTopicsResponseModel, "读取后台本周灵感专题配置")
  getTopics() {
    return this.homeTopicService.getAdminTopics().then(result => ok(result));
  }

  @Get(":topicId/mini-code")
  @ApiOkModel(AdminHomeTopicMiniCodeResponseModel, "生成打开指定共享周刊的小程序码图片数据")
  getTopicMiniCode(@Param("topicId", ParseIntPipe) topicId: number) {
    return this.homeTopicService.createTopicMiniCode(topicId).then(result => ok(result));
  }

  @Get("recipes")
  @UseGuards(SuperAdminGuard)
  @ApiOkModel(HomeTopicRecipeSearchResponseModel, "搜索可加入专题的灵感菜谱")
  searchRecipes(@Query() query: HomeTopicRecipeQueryDto) {
    return this.homeTopicService.searchRecipes(query).then(result => ok(result));
  }

  @Post("import/preview")
  @UseGuards(SuperAdminGuard)
  @ApiOkModel(HomeTopicBatchPreviewResponseModel, "预览并校验共享周刊 JSON 批次")
  previewImport(@Body() body: HomeTopicBatchImportDto) {
    return this.homeTopicService.previewBatchImport(body).then(result => ok(result));
  }

  @Post("import")
  @UseGuards(SuperAdminGuard)
  @ApiIdempotencyKey()
  @ApiOkModel(HomeTopicBatchImportResponseModel, "将共享周刊 JSON 批次有效期导入为草稿")
  importBatch(@Req() request: RequestWithAdmin, @ReadIdempotencyKey() operationId: string, @Body() body: HomeTopicBatchImportDto) {
    return this.homeTopicService.importBatch(request.admin.adminId, operationId, body).then(result => ok(result));
  }

  @Get("todos")
  @ApiOkModel(AdminHomeTopicTodosPageModel, "分页读取失效的共享周刊菜谱待办")
  getTodos(@Query() query: HomeTopicHistoryQueryDto) {
    return this.homeTopicService.listTopicTodos(query.page, query.pageSize).then(result => ok(result));
  }

  @Post()
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeTopicsResponseModel, "新建本周灵感专题")
  createTopic(@Req() request: RequestWithAdmin, @ReadIdempotencyKey() operationId: string, @Body() body: CreateHomeTopicDto) {
    return this.homeTopicService.createTopic(request.admin.adminId, operationId, body).then(result => ok(result));
  }

  @Put(":topicId")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeTopicsResponseModel, "更新本周灵感专题")
  updateTopic(
    @Req() request: RequestWithAdmin,
    @Param("topicId", ParseIntPipe) topicId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateHomeTopicDto
  ) {
    return this.homeTopicService.updateTopic(request.admin.adminId, topicId, operationId, body).then(result => ok(result));
  }

  @Post(":topicId/status")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeTopicItemModel, "切换本周灵感专题上架状态")
  setTopicStatus(
    @Req() request: RequestWithAdmin,
    @Param("topicId", ParseIntPipe) topicId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: SetHomeTopicStatusDto
  ) {
    return this.homeTopicService.setTopicStatus(request.admin.adminId, topicId, operationId, body).then(result => ok(result));
  }

  @Post(":topicId/schedule")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeTopicItemModel, "设置、调整或取消共享周刊预约发布")
  setTopicSchedule(
    @Req() request: RequestWithAdmin,
    @Param("topicId", ParseIntPipe) topicId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: SetHomeTopicScheduleDto
  ) {
    return this.homeTopicService.setTopicSchedule(request.admin.adminId, topicId, operationId, body).then(result => ok(result));
  }

  @Post("items/:itemId/replace")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeTopicItemModel, "替换失效的共享周刊菜谱")
  replaceTopicItem(
    @Req() request: RequestWithAdmin,
    @Param("itemId", ParseIntPipe) itemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ReplaceHomeTopicItemDto
  ) {
    return this.homeTopicService.replaceTopicItem(request.admin.adminId, itemId, operationId, body).then(result => ok(result));
  }

  @Post("items/:itemId/dismiss")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeTopicItemModel, "忽略失效的共享周刊菜谱待办")
  dismissTopicTodo(
    @Req() request: RequestWithAdmin,
    @Param("itemId", ParseIntPipe) itemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: DismissHomeTopicTodoDto
  ) {
    return this.homeTopicService.dismissTopicTodo(request.admin.adminId, itemId, operationId, body).then(result => ok(result));
  }

  @Delete(":topicId")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeTopicsResponseModel, "删除未上架本周灵感专题")
  deleteTopic(
    @Req() request: RequestWithAdmin,
    @Param("topicId", ParseIntPipe) topicId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: DeleteHomeTopicDto
  ) {
    return this.homeTopicService.deleteTopic(request.admin.adminId, topicId, operationId, body).then(result => ok(result));
  }

  @Post(":topicId/image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeTopicItemModel, "上传或替换本周灵感专题封面图")
  uploadTopicImage(
    @Req() request: RequestWithAdmin,
    @Param("topicId", ParseIntPipe) topicId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateHomeTopicImageDto,
    @UploadedFile() file?: { buffer?: Buffer; size?: number }
  ) {
    return this.homeTopicService
      .uploadTopicImage(request.admin.adminId, topicId, operationId, body.expectedVersion, file)
      .then(result => ok(result));
  }

  @Delete(":topicId/image")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeTopicItemModel, "清空本周灵感专题封面图")
  clearTopicImage(
    @Req() request: RequestWithAdmin,
    @Param("topicId", ParseIntPipe) topicId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateHomeTopicImageDto
  ) {
    return this.homeTopicService
      .clearTopicImage(request.admin.adminId, topicId, operationId, body.expectedVersion)
      .then(result => ok(result));
  }
}
