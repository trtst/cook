import { Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithAdmin } from "../../common/auth-context";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { CreateHomeTopicDto, HomeTopicRecipeQueryDto, SetHomeTopicStatusDto, UpdateHomeTopicDto, UpdateHomeTopicImageDto } from "../../contracts/dtos";
import { AdminHomeTopicItemModel, AdminHomeTopicsResponseModel, ApiOkModel, HomeTopicRecipeSearchResponseModel } from "../../contracts/openapi";
import { HomeTopicService } from "./home-topic.service";

@ApiTags("admin-home-topics")
@Controller("admin/home-topics")
@UseGuards(AdminAuthGuard)
@ApiBearerAuth("AdminBearerAuth")
export class AdminHomeTopicController {
  constructor(@Inject(HomeTopicService) private readonly homeTopicService: HomeTopicService) {}

  @Get()
  @ApiOkModel(AdminHomeTopicsResponseModel, "读取后台本周灵感专题配置")
  getTopics() {
    return this.homeTopicService.getAdminTopics().then(result => ok(result));
  }

  @Get("recipes")
  @ApiOkModel(HomeTopicRecipeSearchResponseModel, "搜索可加入专题的灵感菜谱")
  searchRecipes(@Query() query: HomeTopicRecipeQueryDto) {
    return this.homeTopicService.searchRecipes(query.keyword).then(result => ok(result));
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
