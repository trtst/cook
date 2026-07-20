import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { UserAuthGuard } from "../../common/user-auth.guard";
import { CreateInviteDto, DiningGroupMembersQueryDto, OperationDto } from "../../contracts/dtos";
import { DiningGroupService } from "./dining-group.service";

@ApiTags("dining-groups")
@Controller()
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class DiningGroupController {
  constructor(@Inject(DiningGroupService) private readonly diningGroupService: DiningGroupService) {}

  @Get("dining-groups/current")
  @ApiOkResponse({ description: "当前唯一饭搭子、原空间、权益和空间状态" })
  getCurrent(@Req() request: RequestWithUser) {
    return this.diningGroupService.getCurrent(request.user.userId).then(result => ok(result));
  }

  @Get("dining-group-members")
  @ApiOkResponse({ description: "当前饭搭子成员列表" })
  listMembers(@Req() request: RequestWithUser, @Query() query: DiningGroupMembersQueryDto) {
    return this.diningGroupService.listMembers(request.user.userId, query.diningGroupId).then(result => ok(result));
  }

  @Post("dining-group-invites")
  @ApiOkResponse({ description: "为当前饭搭子创建单次邀请" })
  createInvite(@Req() request: RequestWithUser, @Body() body: CreateInviteDto) {
    return this.diningGroupService
      .createInvite(request.user.userId, body.diningGroupId, body.operationId)
      .then(result => ok(result));
  }

  @Post("dining-group-invites/:inviteToken/accept")
  @ApiOkResponse({ description: "冻结原空间并加入当前唯一饭搭子" })
  acceptInvite(@Req() request: RequestWithUser, @Param("inviteToken") inviteToken: string, @Body() body: OperationDto) {
    return this.diningGroupService.acceptInvite(request.user.userId, inviteToken, body.operationId).then(result => ok(result));
  }

  @Post("dining-groups/:diningGroupId/leave")
  @ApiOkResponse({ description: "退出饭搭子、恢复原空间并创建迁出快照" })
  leave(
    @Req() request: RequestWithUser,
    @Param("diningGroupId") diningGroupId: string,
    @Body() body: OperationDto
  ) {
    return this.diningGroupService.leave(request.user.userId, diningGroupId, body.operationId).then(result => ok(result));
  }
}
