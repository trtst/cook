import { Body, Controller, Get, Inject, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { ok } from "../../common/api-response";
import type { RequestWithContext, RequestWithUser } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  CompletePhoneChangeDto,
  AuthPhoneChangeNewCodeDto,
  AuthPhoneCodeSendDto,
  ChangeCurrentPasswordDto,
  NotificationFeedQueryDto,
  StartPhoneChangeDto,
  UpdateCurrentUserDto,
  UpdateNotificationSettingsDto,
  UpdateTasteProfileDto,
  UpdateUserDisplayDto
} from "../../contracts/dtos";
import {
  ApiOkPage,
  ApiOkModel,
  AuthSmsSendResultModel,
  ChangePasswordResultModel,
  MedalWallModel,
  MeResponseModel,
  NotificationBadgeModel,
  NotificationFeedItemModel,
  NotificationSettingsModel,
  StartPhoneChangeResultModel,
  StorageUsageModel,
  TasteProfileModel
} from "../../contracts/openapi";
import { AuthService } from "../auth/auth.service";
import { CurrentUserService } from "./current-user.service";
import { DisplayService } from "./display.service";
import { MedalService } from "./medal.service";
import { NotificationService } from "./notification.service";
import { TasteProfileService } from "./taste-profile.service";
import { UploadService } from "../upload/upload.service";

type AssetRequest = { protocol?: string; get?: (name: string) => string | undefined };

@ApiTags("users")
@Controller("users")
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class UserController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(CurrentUserService) private readonly currentUserService: CurrentUserService,
    @Inject(DisplayService) private readonly displayService: DisplayService,
    @Inject(MedalService) private readonly medalService: MedalService,
    @Inject(NotificationService) private readonly notificationService: NotificationService,
    @Inject(TasteProfileService) private readonly tasteProfileService: TasteProfileService,
    @Inject(UploadService) private readonly uploadService: UploadService
  ) {}

  @Get("me")
  @ApiOkModel(MeResponseModel, "当前用户")
  getCurrent(@Req() request: RequestWithUser) {
    return this.currentUserService.getCurrent(request.user.userId).then(result => ok(result));
  }

  @Put("me")
  @ApiOkModel(MeResponseModel, "更新当前用户")
  updateCurrent(@Req() request: RequestWithUser, @Body() body: UpdateCurrentUserDto) {
    return this.currentUserService.updateCurrent(request.user.userId, body).then(result => ok(result));
  }

  @Post("me/avatar")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiIdempotencyKey()
  @ApiOkModel(MeResponseModel, "上传并更新当前用户头像")
  async uploadCurrentAvatar(
    @Req() request: RequestWithUser & AssetRequest,
    @ReadIdempotencyKey() operationId: string,
    @UploadedFile() file?: { buffer?: Buffer; size?: number }
  ) {
    await this.uploadService.uploadUserAvatar(request, request.user.userId, operationId, file);
    return ok(await this.currentUserService.getCurrent(request.user.userId));
  }

  @Put("me/password")
  @ApiIdempotencyKey()
  @ApiOkModel(ChangePasswordResultModel, "修改当前用户登录密码")
  updateCurrentPassword(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ChangeCurrentPasswordDto
  ) {
    return this.authService.updateCurrentPassword(request.user.userId, operationId, body).then(result => ok(result));
  }

  @Post("me/phone/change-current-code")
  @ApiOkModel(AuthSmsSendResultModel, "发送当前绑定手机号换绑验证码")
  sendCurrentPhoneChangeCode(@Req() request: RequestWithUser & RequestWithContext, @Body() body: AuthPhoneCodeSendDto) {
    return this.authService.sendCurrentPhoneChangeCode(request.user.userId, body, request.context).then(result => ok(result));
  }

  @Post("me/phone/bind")
  @ApiIdempotencyKey()
  @ApiOkModel(MeResponseModel, "绑定当前用户手机号")
  async bindCurrentPhone(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: StartPhoneChangeDto
  ) {
    await this.authService.bindCurrentPhone(request.user.userId, operationId, body);
    return ok(await this.currentUserService.getCurrent(request.user.userId));
  }

  @Post("me/phone/change-start")
  @ApiIdempotencyKey()
  @ApiOkModel(StartPhoneChangeResultModel, "校验当前绑定手机号并创建短期换绑会话")
  startPhoneChange(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: StartPhoneChangeDto
  ) {
    return this.authService.startPhoneChange(request.user.userId, operationId, body).then(result => ok(result));
  }

  @Post("me/phone/change-new-code")
  @ApiOkModel(AuthSmsSendResultModel, "发送新手机号换绑验证码")
  sendNewPhoneChangeCode(@Req() request: RequestWithUser & RequestWithContext, @Body() body: AuthPhoneChangeNewCodeDto) {
    return this.authService.sendNewPhoneChangeCode(request.user.userId, body, request.context).then(result => ok(result));
  }

  @Post("me/phone/change-complete")
  @ApiIdempotencyKey()
  @ApiOkModel(MeResponseModel, "完成当前用户手机号更换")
  async completePhoneChange(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CompletePhoneChangeDto
  ) {
    await this.authService.completePhoneChange(request.user.userId, operationId, body);
    return ok(await this.currentUserService.getCurrent(request.user.userId));
  }

  @Get("me/medals")
  @ApiOkModel(MedalWallModel, "当前用户的勋章墙摘要")
  getCurrentMedals(@Req() request: RequestWithUser & AssetRequest) {
    return this.medalService.getCurrent(request, request.user.userId).then(result => ok(result));
  }

  @Get("me/taste-profile")
  @ApiOkModel(TasteProfileModel, "当前用户的口味、过敏与忌口资料")
  getTasteProfile(@Req() request: RequestWithUser) {
    return this.tasteProfileService.getCurrent(request.user.userId).then(result => ok(result));
  }

  @Get("me/notification-settings")
  @ApiOkModel(NotificationSettingsModel, "当前用户的提醒设置")
  getNotificationSettings(@Req() request: RequestWithUser) {
    return this.notificationService.getSettings(request.user.userId).then(result => ok(result));
  }

  @Put("me/notification-settings")
  @ApiOkModel(NotificationSettingsModel, "完整替换当前用户的提醒设置")
  updateNotificationSettings(@Req() request: RequestWithUser, @Body() body: UpdateNotificationSettingsDto) {
    return this.notificationService.updateSettings(request.user.userId, body).then(result => ok(result));
  }

  @Get("me/notification-badge")
  @ApiOkModel(NotificationBadgeModel, "当前用户通知中心的未读徽标")
  getNotificationBadge(@Req() request: RequestWithUser) {
    return this.notificationService.getBadge(request.user.userId).then(result => ok(result));
  }

  @Get("me/notification-feed")
  @ApiOkPage(NotificationFeedItemModel, "当前用户通知中心的统一时间流分页列表")
  getNotificationFeed(@Req() request: RequestWithUser, @Query() query: NotificationFeedQueryDto) {
    return this.notificationService.getFeed(request.user.userId, query.page, query.pageSize).then(result => ok(result));
  }

  @Put("me/notification-feed-read")
  @ApiOkModel(NotificationBadgeModel, "标记当前用户通知中心为已读")
  markNotificationFeedRead(@Req() request: RequestWithUser) {
    return this.notificationService.markFeedRead(request.user.userId).then(result => ok(result));
  }

  @Put("me/taste-profile")
  @ApiOkModel(TasteProfileModel, "完整替换当前用户的口味、过敏与忌口资料")
  updateTasteProfile(@Req() request: RequestWithUser, @Body() body: UpdateTasteProfileDto) {
    return this.tasteProfileService.updateCurrent(request.user.userId, body).then(result => ok(result));
  }

  @Put("me/display")
  @ApiIdempotencyKey()
  @ApiOkModel(MeResponseModel, "更新当前用户的我的页和首页背景图设置")
  updateDisplay(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateUserDisplayDto
  ) {
    return this.displayService
      .updateCurrent(request.user.userId, operationId, body.profileBackgroundUrl, body.homeBackgroundUrl)
      .then(result => ok(result));
  }
}

@ApiTags("storage")
@Controller("storage-usage")
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class StorageUsageController {
  constructor(@Inject(CurrentUserService) private readonly currentUserService: CurrentUserService) {}

  @Get()
  @ApiOkModel(StorageUsageModel, "当前用户的逻辑空间模块明细")
  getCurrent(@Req() request: RequestWithUser) {
    return this.currentUserService.getStorageUsage(request.user.userId).then(result => ok(result));
  }
}
