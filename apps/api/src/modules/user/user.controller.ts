import { Body, Controller, Get, Inject, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { UserAuthGuard } from "../../common/user-auth.guard";
import { UpdateCurrentUserDto, UpdateTasteProfileDto } from "../../contracts/dtos";
import { AuthService } from "../auth/auth.service";
import { TasteProfileService } from "./taste-profile.service";

@ApiTags("users")
@Controller("users")
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class UserController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(TasteProfileService) private readonly tasteProfileService: TasteProfileService
  ) {}

  @Get("me")
  @ApiOkResponse({ description: "当前用户" })
  getCurrent(@Req() request: RequestWithUser) {
    return this.authService.getCurrentUser(request.user.userId).then(result => ok(result));
  }

  @Put("me")
  @ApiOkResponse({ description: "更新当前用户" })
  updateCurrent(@Req() request: RequestWithUser, @Body() body: UpdateCurrentUserDto) {
    return this.authService.updateCurrentUser(request.user.userId, body).then(result => ok(result));
  }

  @Get("me/taste-profile")
  @ApiOkResponse({ description: "当前用户的口味、过敏与忌口资料" })
  getTasteProfile(@Req() request: RequestWithUser) {
    return this.tasteProfileService.getCurrent(request.user.userId).then(result => ok(result));
  }

  @Put("me/taste-profile")
  @ApiOkResponse({ description: "完整替换当前用户的口味、过敏与忌口资料" })
  updateTasteProfile(@Req() request: RequestWithUser, @Body() body: UpdateTasteProfileDto) {
    return this.tasteProfileService.updateCurrent(request.user.userId, body).then(result => ok(result));
  }
}
