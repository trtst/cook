import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithContext, RequestWithUser } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { UserAuthGuard } from "../../common/user-auth.guard";
import { RedeemMembershipCodeDto } from "../../contracts/dtos";
import { ApiOkModel, RedeemMembershipCodeResultModel } from "../../contracts/openapi";
import { MembershipCodeService } from "./membership-code.service";

@ApiTags("membership-codes")
@Controller("membership-codes")
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class MembershipCodeController {
  constructor(@Inject(MembershipCodeService) private readonly membershipCodeService: MembershipCodeService) {}

  @Post("redeem")
  @ApiIdempotencyKey()
  @ApiOkModel(RedeemMembershipCodeResultModel, "核销当前用户的会员兑换码")
  redeemCode(
    @Req() request: RequestWithUser & Partial<RequestWithContext>,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: RedeemMembershipCodeDto
  ) {
    return this.membershipCodeService
      .redeemCurrent(request.user.userId, operationId, request.context, body.code)
      .then(result => ok(result));
  }
}
