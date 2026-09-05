import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { Writable } from "node:stream";
import { ok } from "../../common/api-response";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import type { RequestWithAdmin, RequestWithUser } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { OptionalUserAuthGuard } from "../../common/optional-user-auth.guard";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  AdminSiteContentArticleQueryDto,
  AdminSiteContentChannelQueryDto,
  CreateAdminSiteContentChannelDto,
  CreateAdminSiteContentDto,
  DeleteAdminSiteContentDto,
  ResolveSiteContentDto,
  SiteContentArticleQueryDto,
  SiteOfficialMessageQueryDto,
  UpdateAdminSiteContentChannelDto,
  UpdateAdminSiteContentDto,
  UpdateAdminSiteContentStatusDto
} from "../../contracts/dtos";
import {
  AdminSiteContentChannelModel,
  AdminSiteContentDetailModel,
  AdminSiteContentDeleteResultModel,
  AdminSiteContentImageUploadResultModel,
  AdminSiteContentSummaryModel,
  AdminSitePageSummaryModel,
  ApiOkModel,
  ApiOkPage,
  SiteContentArticleDetailModel,
  SiteContentArticleListModel,
  SiteContentArticleLikeResultModel,
  SiteContentArticleViewResultModel,
  SiteContentDetailModel,
  SiteOfficialMessageDetailModel,
  SiteOfficialMessageSummaryModel
} from "../../contracts/openapi";
import { AdminSiteContentService } from "./admin-site-content.service";
import { SiteContentImageService } from "./site-content-image.service";

type ResponseLike = Writable & {
  setHeader: (name: string, value: string | number) => void;
};

type AssetRequest = RequestWithAdmin & {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

@ApiTags("admin-content")
@Controller("admin/content")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
@ApiBearerAuth("AdminBearerAuth")
export class AdminSiteContentController {
  constructor(
    @Inject(AdminSiteContentService) private readonly adminSiteContentService: AdminSiteContentService,
    @Inject(SiteContentImageService) private readonly siteContentImageService: SiteContentImageService
  ) {}

  @Get("channels")
  @ApiOkPage(AdminSiteContentChannelModel, "后台内容栏目列表")
  listChannels(@Req() request: RequestWithAdmin, @Query() query: AdminSiteContentChannelQueryDto) {
    return this.adminSiteContentService.listChannels(query.page, query.pageSize, query.code, request.admin.adminId).then(result => ok(result));
  }

  @Post("channels")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminSiteContentChannelModel, "后台新增内容栏目")
  createChannel(@Req() request: RequestWithAdmin, @ReadIdempotencyKey() operationId: string, @Body() body: CreateAdminSiteContentChannelDto) {
    return this.adminSiteContentService.createChannel({ ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Put("channels/:channelId")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminSiteContentChannelModel, "后台编辑内容栏目")
  updateChannel(
    @Req() request: RequestWithAdmin,
    @Param("channelId", ParseIntPipe) channelId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateAdminSiteContentChannelDto
  ) {
    return this.adminSiteContentService.updateChannel(channelId, { ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Get("pages")
  @ApiOkPage(AdminSitePageSummaryModel, "后台固定页列表")
  async listPages(@Req() request: RequestWithAdmin) {
    const items = await this.adminSiteContentService.listPages(request.admin.adminId);
    return ok({
      items,
      page: 1,
      pageSize: items.length || 1,
      total: items.length,
      hasNext: false
    });
  }

  @Get("articles")
  @ApiOkPage(AdminSiteContentSummaryModel, "后台文章列表")
  listArticles(@Req() request: RequestWithAdmin, @Query() query: AdminSiteContentArticleQueryDto) {
    return this.adminSiteContentService
      .listArticles(query.page, query.pageSize, request.admin.adminId, {
        channelId: query.channelId,
        status: query.status,
        keyword: query.keyword
      })
      .then(result => ok(result));
  }

  @Get(":contentId")
  @ApiOkModel(AdminSiteContentDetailModel, "后台内容详情")
  getDetail(@Req() request: RequestWithAdmin, @Param("contentId", ParseIntPipe) contentId: number) {
    return this.adminSiteContentService.getDetail(contentId, request.admin.adminId).then(result => ok(result));
  }

  @Post()
  @ApiIdempotencyKey()
  @ApiOkModel(AdminSiteContentDetailModel, "后台新建内容")
  createContent(@Req() request: RequestWithAdmin, @ReadIdempotencyKey() operationId: string, @Body() body: CreateAdminSiteContentDto) {
    return this.adminSiteContentService.createContent({ ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Put(":contentId")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminSiteContentDetailModel, "后台保存内容")
  updateContent(
    @Req() request: RequestWithAdmin,
    @Param("contentId", ParseIntPipe) contentId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateAdminSiteContentDto
  ) {
    return this.adminSiteContentService.updateContent(contentId, { ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Post(":contentId/status")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminSiteContentDetailModel, "后台切换内容状态")
  setStatus(
    @Req() request: RequestWithAdmin,
    @Param("contentId", ParseIntPipe) contentId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateAdminSiteContentStatusDto
  ) {
    return this.adminSiteContentService.setStatus(contentId, { ...body, operationId }, request.admin.adminId).then(result => ok(result));
  }

  @Delete(":contentId")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminSiteContentDeleteResultModel, "后台删除内容")
  deleteContent(
    @Req() request: RequestWithAdmin,
    @Param("contentId", ParseIntPipe) contentId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: DeleteAdminSiteContentDto
  ) {
    return this.adminSiteContentService.deleteContent(contentId, operationId, body.expectedVersion, request.admin.adminId).then(result => ok(result));
  }

  @Post("images")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminSiteContentImageUploadResultModel, "上传内容正文图片")
  uploadImage(
    @Req() request: AssetRequest,
    @ReadIdempotencyKey() operationId: string,
    @UploadedFile() file?: { buffer?: Buffer; size?: number }
  ) {
    if (!file) {
      throw new BadRequestException("请上传图片");
    }
    return this.siteContentImageService.uploadImage(request, request.admin.adminId, operationId, file).then(result => ok(result));
  }
}

@ApiTags("site-content")
@Controller("site-contents")
export class SiteContentController {
  constructor(@Inject(AdminSiteContentService) private readonly adminSiteContentService: AdminSiteContentService) {}

  @Get("resolve")
  @ApiOkModel(SiteContentDetailModel, "按 path 读取已发布内容")
  resolve(@Query() query: ResolveSiteContentDto) {
    return this.adminSiteContentService.resolvePublicContent(query.path).then(result => ok(result));
  }
}

@ApiTags("site-content")
@Controller("site-contents/articles")
export class SiteContentArticleController {
  constructor(@Inject(AdminSiteContentService) private readonly adminSiteContentService: AdminSiteContentService) {}

  @Get()
  @UseGuards(OptionalUserAuthGuard)
  @ApiOkModel(SiteContentArticleListModel, "读取文章列表")
  list(@Req() request: Partial<RequestWithUser>, @Query() query: SiteContentArticleQueryDto) {
    return this.adminSiteContentService
      .listPublicArticles(request.user?.userId ?? null, query.page, query.pageSize, query.channelCode)
      .then(result => ok(result));
  }

  @Get(":articleId")
  @UseGuards(OptionalUserAuthGuard)
  @ApiOkModel(SiteContentArticleDetailModel, "读取文章详情")
  getDetail(@Req() request: Partial<RequestWithUser>, @Param("articleId", ParseIntPipe) articleId: number) {
    return this.adminSiteContentService.getPublicArticleDetail(request.user?.userId ?? null, articleId).then(result => ok(result));
  }

  @Post(":articleId/view")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(SiteContentArticleViewResultModel, "累积文章阅读数")
  recordView(
    @Req() request: RequestWithUser,
    @Param("articleId", ParseIntPipe) articleId: number,
    @ReadIdempotencyKey() operationId: string
  ) {
    return this.adminSiteContentService.recordPublicArticleView(request.user.userId, articleId, operationId).then(result => ok(result));
  }

  @Post(":articleId/like")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(SiteContentArticleLikeResultModel, "点赞文章")
  like(@Req() request: RequestWithUser, @Param("articleId", ParseIntPipe) articleId: number, @ReadIdempotencyKey() operationId: string) {
    return this.adminSiteContentService.likePublicArticle(request.user.userId, articleId, operationId).then(result => ok(result));
  }

  @Delete(":articleId/like")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(SiteContentArticleLikeResultModel, "取消点赞文章")
  unlike(@Req() request: RequestWithUser, @Param("articleId", ParseIntPipe) articleId: number, @ReadIdempotencyKey() operationId: string) {
    return this.adminSiteContentService.unlikePublicArticle(request.user.userId, articleId, operationId).then(result => ok(result));
  }
}

@ApiTags("site-content")
@Controller("site-contents/official-messages")
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class SiteOfficialMessageController {
  constructor(@Inject(AdminSiteContentService) private readonly adminSiteContentService: AdminSiteContentService) {}

  @Get()
  @ApiOkPage(SiteOfficialMessageSummaryModel, "读取系统官方消息列表")
  list(@Req() request: RequestWithUser, @Query() query: SiteOfficialMessageQueryDto) {
    return this.adminSiteContentService.listOfficialMessages(request.user.userId, query.page, query.pageSize).then(result => ok(result));
  }

  @Get(":contentId")
  @ApiOkModel(SiteOfficialMessageDetailModel, "读取系统官方消息详情")
  getDetail(@Req() request: RequestWithUser, @Param("contentId", ParseIntPipe) contentId: number) {
    return this.adminSiteContentService.getOfficialMessageDetail(request.user.userId, contentId).then(result => ok(result));
  }
}

@ApiExcludeController()
@Controller("static/uploads/site-content-images")
export class SiteContentImagePublicController {
  constructor(@Inject(SiteContentImageService) private readonly siteContentImageService: SiteContentImageService) {}

  @Get(":fileName")
  async getImage(@Param("fileName") fileName: string, @Res() response: ResponseLike) {
    const asset = await this.siteContentImageService.getImageAsset(fileName);
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }
}
