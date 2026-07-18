import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { WechatLoginDto } from "../../contracts/dtos";
import { MockAuthService } from "./mock-auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(MockAuthService) private readonly authService: MockAuthService) {}

  @Post("wechat/login")
  @ApiOkResponse({ description: "微信登录，返回用户 token 和用户摘要" })
  loginWithWechat(@Body() body: WechatLoginDto) {
    return ok(this.authService.loginWithWechat(body));
  }
}
