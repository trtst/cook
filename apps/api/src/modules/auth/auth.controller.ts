import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { LoginRateLimitGuard } from "../../common/login-rate-limit.guard";
import { UserAuthGuard } from "../../common/user-auth.guard";
import { PasswordLoginDto } from "../../contracts/dtos";
import { ApiOkModel, PasswordLoginResultModel, RefreshSessionResultModel } from "../../contracts/openapi";
import { AuthService } from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("login")
  @UseGuards(LoginRateLimitGuard)
  @ApiOkModel(PasswordLoginResultModel, "手机号密码登录，返回用户 token 和用户摘要")
  loginWithPassword(@Body() body: PasswordLoginDto) {
    return this.authService.loginWithPassword(body).then(result => ok(result));
  }

  @Post("refresh")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(RefreshSessionResultModel, "刷新小程序用户 token")
  refreshSession(@Req() request: RequestWithUser) {
    return this.authService.refreshSession(request.user.userId).then(result => ok(result));
  }
}
