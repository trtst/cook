import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { LoginRateLimitGuard } from "../../common/login-rate-limit.guard";
import { PasswordLoginDto } from "../../contracts/dtos";
import { AuthService } from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("login")
  @UseGuards(LoginRateLimitGuard)
  @ApiOkResponse({ description: "手机号密码登录，返回用户 token 和用户摘要" })
  loginWithPassword(@Body() body: PasswordLoginDto) {
    return this.authService.loginWithPassword(body).then(result => ok(result));
  }
}
