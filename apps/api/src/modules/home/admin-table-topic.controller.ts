import { Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithAdmin } from "../../common/auth-context";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { CreateTableTopicDto, SetTableTopicStatusDto, UpdateTableTopicDto, UpdateTableTopicImageDto } from "../../contracts/dtos";
import { AdminTableTopicItemModel, AdminTableTopicsResponseModel, ApiOkModel } from "../../contracts/openapi";
import { TableTopicService } from "./table-topic.service";

type AssetRequest = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

@ApiTags("admin-table-topics")
@Controller("admin/table-topics")
@UseGuards(AdminAuthGuard)
@ApiBearerAuth("AdminBearerAuth")
export class AdminTableTopicController {
  constructor(@Inject(TableTopicService) private readonly tableTopicService: TableTopicService) {}

  @Get()
  @ApiOkModel(AdminTableTopicsResponseModel, "读取后台餐桌话题配置")
  getTopics(@Req() request: AssetRequest) {
    return this.tableTopicService.getAdminTopics(request).then(result => ok(result));
  }

  @Post()
  @ApiIdempotencyKey()
  @ApiOkModel(AdminTableTopicsResponseModel, "新建餐桌话题")
  createTopic(@Req() request: RequestWithAdmin & AssetRequest, @ReadIdempotencyKey() operationId: string, @Body() body: CreateTableTopicDto) {
    return this.tableTopicService.createTopic(request, request.admin.adminId, operationId, body).then(result => ok(result));
  }

  @Put(":topicId")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminTableTopicsResponseModel, "更新餐桌话题")
  updateTopic(
    @Req() request: RequestWithAdmin & AssetRequest,
    @Param("topicId", ParseIntPipe) topicId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateTableTopicDto
  ) {
    return this.tableTopicService.updateTopic(request, request.admin.adminId, topicId, operationId, body).then(result => ok(result));
  }

  @Post(":topicId/status")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminTableTopicItemModel, "切换餐桌话题上架状态")
  setTopicStatus(
    @Req() request: RequestWithAdmin & AssetRequest,
    @Param("topicId", ParseIntPipe) topicId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: SetTableTopicStatusDto
  ) {
    return this.tableTopicService.setTopicStatus(request, request.admin.adminId, topicId, operationId, body).then(result => ok(result));
  }

  @Post(":topicId/image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminTableTopicItemModel, "上传或替换餐桌话题封面图")
  uploadTopicImage(
    @Req() request: RequestWithAdmin & AssetRequest,
    @Param("topicId", ParseIntPipe) topicId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateTableTopicImageDto,
    @UploadedFile() file?: { buffer?: Buffer; size?: number }
  ) {
    return this.tableTopicService
      .uploadTopicImage(request, request.admin.adminId, topicId, operationId, body.expectedVersion, file)
      .then(result => ok(result));
  }

  @Delete(":topicId/image")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminTableTopicItemModel, "清空餐桌话题封面图")
  clearTopicImage(
    @Req() request: RequestWithAdmin & AssetRequest,
    @Param("topicId", ParseIntPipe) topicId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateTableTopicImageDto
  ) {
    return this.tableTopicService
      .clearTopicImage(request, request.admin.adminId, topicId, operationId, body.expectedVersion)
      .then(result => ok(result));
  }
}
