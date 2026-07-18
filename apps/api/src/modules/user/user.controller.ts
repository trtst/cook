import { Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { UserAuthGuard } from "../../common/user-auth.guard";
import { UpdateCurrentUserDto } from "../../contracts/dtos";
import { MockAuthService } from "../auth/mock-auth.service";

@ApiTags("users")
@Controller("users")
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class UserController {
  constructor(@Inject(MockAuthService) private readonly authService: MockAuthService) {}

  @Get("me")
  @ApiOkResponse({ description: "当前用户" })
  getCurrent() {
    return ok(this.authService.getCurrentUser());
  }

  @Put("me")
  @ApiOkResponse({ description: "更新当前用户" })
  updateCurrent(@Body() body: UpdateCurrentUserDto) {
    return ok(this.authService.updateCurrentUser(body));
  }
}
