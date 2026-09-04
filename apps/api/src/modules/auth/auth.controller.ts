import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithContext, RequestWithUser } from "../../common/auth-context";
import { LoginRateLimitGuard } from "../../common/login-rate-limit.guard";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  AuthChangePasswordDto,
  AuthPasswordLoginDto,
  AuthSetPasswordDto,
  AuthSmsLoginDto,
  AuthSmsSendDto,
  AuthWechatPhoneLoginDto,
  AuthWechatSessionDto,
  LogoutAuthSessionDto,
  RefreshAuthSessionDto
} from "../../contracts/dtos";
import {
  ApiOkModel,
  ApiOkNull,
  AuthMeResponseModel,
  AuthSessionResultModel,
  AuthSmsSendResultModel,
  ChangePasswordResultModel,
  WechatSessionResultModel
} from "../../contracts/openapi";
import { AuthService } from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("wechat/session")
  @UseGuards(LoginRateLimitGuard)
  @ApiOkModel(WechatSessionResultModel, "识别当前微信身份并返回已绑定会话或短期手机号授权会话")
  wechatSession(@Req() request: RequestWithContext, @Body() body: AuthWechatSessionDto) {
    return this.authService.wechatSession(body, request.context).then(result => ok(result));
  }

  @Post("wechat/phone-login")
  @UseGuards(LoginRateLimitGuard)
  @ApiOkModel(AuthSessionResultModel, "使用微信手机号组件授权完成登录或手机号账号绑定")
  loginWithWechatPhone(@Req() request: RequestWithContext, @Body() body: AuthWechatPhoneLoginDto) {
    return this.authService.loginWithWechatPhone(body, request.context).then(result => ok(result));
  }

  @Post("sms/send")
  @UseGuards(LoginRateLimitGuard)
  @ApiOkModel(AuthSmsSendResultModel, "发送真实短信登录验证码")
  sendSmsCode(@Req() request: RequestWithContext, @Body() body: AuthSmsSendDto) {
    return this.authService.sendSmsCode(body, request.context).then(result => ok(result));
  }

  @Post("sms/login")
  @UseGuards(LoginRateLimitGuard)
  @ApiOkModel(AuthSessionResultModel, "使用短信验证码登录手机号账号")
  loginWithSms(@Req() request: RequestWithContext, @Body() body: AuthSmsLoginDto) {
    return this.authService.loginWithSms(body, request.context).then(result => ok(result));
  }

  @Post("password/login")
  @UseGuards(LoginRateLimitGuard)
  @ApiOkModel(AuthSessionResultModel, "使用手机号密码登录")
  loginWithPassword(@Req() request: RequestWithContext, @Body() body: AuthPasswordLoginDto) {
    return this.authService.loginWithPassword(body, request.context).then(result => ok(result));
  }

  @Post("password/set")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(ChangePasswordResultModel, "为当前手机号账号设置登录密码")
  setPassword(@Req() request: RequestWithUser, @Body() body: AuthSetPasswordDto) {
    return this.authService.setPassword(request.user.userId, body).then(result => ok(result));
  }

  @Post("password/change")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(ChangePasswordResultModel, "修改当前手机号账号的登录密码")
  changePassword(@Req() request: RequestWithUser, @Body() body: AuthChangePasswordDto) {
    return this.authService.changePassword(request.user.userId, body).then(result => ok(result));
  }

  @Post("refresh")
  @ApiOkModel(AuthSessionResultModel, "轮换 refresh token 并返回新的登录会话")
  refresh(@Req() request: RequestWithContext, @Body() body: RefreshAuthSessionDto) {
    return this.authService.refresh(body, request.context).then(result => ok(result));
  }

  @Post("logout")
  @ApiOkNull("吊销当前 refresh token")
  logout(@Body() body: LogoutAuthSessionDto) {
    return this.authService.logout(body).then(() => ok(null));
  }

  @Get("me")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(AuthMeResponseModel, "当前登录用户的最小认证资料")
  getMe(@Req() request: RequestWithUser) {
    return this.authService.getMe(request.user.userId).then(result => ok(result));
  }
}
