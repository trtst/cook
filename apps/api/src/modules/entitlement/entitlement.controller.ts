import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { UserAuthGuard } from "../../common/user-auth.guard";
import { EntitlementService } from "./entitlement.service";

@ApiTags("entitlements")
@Controller("entitlements")
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class EntitlementController {
  constructor(@Inject(EntitlementService) private readonly entitlementService: EntitlementService) {}

  @Get("current")
  @ApiOkResponse({ description: "当前用户和当前饭搭子的服务端有效权益" })
  getCurrent(@Req() request: RequestWithUser) {
    return this.entitlementService.getCurrent(request.user.userId).then(result => ok(result));
  }
}
