import { Body, Controller, Get, Inject, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  ChangeCurrentPasswordDto,
  UpdateCurrentUserDto,
  UpdateNotificationSettingsDto,
  UpdateTasteProfileDto,
  UpdateUserDisplayDto
} from "../../contracts/dtos";
import {
  ApiOkModel,
  ChangePasswordResultModel,
  MedalWallModel,
  MeResponseModel,
  NotificationBadgeModel,
  NotificationSettingsModel,
  StorageUsageModel,
  TasteProfileModel
} from "../../contracts/openapi";
import { AuthService } from "../auth/auth.service";
import { CurrentUserService } from "./current-user.service";
import { DisplayService } from "./display.service";
import { MedalService } from "./medal.service";
import { NotificationService } from "./notification.service";
import { TasteProfileService } from "./taste-profile.service";

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
    @Inject(TasteProfileService) private readonly tasteProfileService: TasteProfileService
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

  @Put("me/password")
  @ApiOkModel(ChangePasswordResultModel, "修改当前用户登录密码")
  updateCurrentPassword(@Req() request: RequestWithUser, @Body() body: ChangeCurrentPasswordDto) {
    return this.authService.updateCurrentPassword(request.user.userId, body).then(result => ok(result));
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
