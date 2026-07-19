import { Body, Controller, Get, Inject, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { UserAuthGuard } from "../../common/user-auth.guard";
import { UpdateCurrentUserDto } from "../../contracts/dtos";
import { AuthService } from "../auth/auth.service";

@ApiTags("users")
@Controller("users")
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class UserController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

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
}
