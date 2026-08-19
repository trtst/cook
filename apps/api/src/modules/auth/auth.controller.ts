import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { LoginRateLimitGuard } from "../../common/login-rate-limit.guard";
import { UserAuthGuard } from "../../common/user-auth.guard";
import { CodeLoginDto, PasswordLoginDto, WechatLoginDto } from "../../contracts/dtos";
import {
  ApiOkModel,
  CodeLoginResultModel,
  PasswordLoginResultModel,
  RefreshSessionResultModel,
  WechatLoginResultModel
} from "../../contracts/openapi";
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

  @Post("code-login")
  @UseGuards(LoginRateLimitGuard)
  @ApiOkModel(CodeLoginResultModel, "手机号验证码登录，测试阶段固定验证码为 123456")
  loginWithCode(@Body() body: CodeLoginDto) {
    return this.authService.loginWithCode(body).then(result => ok(result));
  }

  @Post("wechat-login")
  @UseGuards(LoginRateLimitGuard)
  @ApiOkModel(WechatLoginResultModel, "小程序微信登录，服务端按 openid 识别或创建用户")
  loginWithWechat(@Body() body: WechatLoginDto) {
    return this.authService.loginWithWechat(body).then(result => ok(result));
  }

  @Post("refresh")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(RefreshSessionResultModel, "刷新小程序用户 token")
  refreshSession(@Req() request: RequestWithUser) {
    return this.authService.refreshSession(request.user.userId).then(result => ok(result));
  }
}
