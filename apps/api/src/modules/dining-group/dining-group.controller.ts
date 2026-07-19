import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { UserAuthGuard } from "../../common/user-auth.guard";
import { CreateInviteDto, CreateDiningGroupDto, OperationDto, DiningGroupMembersQueryDto } from "../../contracts/dtos";
import { DiningGroupService } from "./dining-group.service";

@ApiTags("dining-groups")
@Controller()
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class DiningGroupController {
  constructor(@Inject(DiningGroupService) private readonly diningGroupService: DiningGroupService) {}

  @Get("dining-groups/mine")
  @ApiOkResponse({ description: "我的饭搭子列表" })
  listMine(@Req() request: RequestWithUser) {
    return this.diningGroupService.listMine(request.user.userId).then(result => ok(result));
  }

  @Post("dining-groups")
  @ApiOkResponse({ description: "创建饭搭子" })
  create(@Req() request: RequestWithUser, @Body() body: CreateDiningGroupDto) {
    return this.diningGroupService.create(request.user.userId, body.name, body.operationId).then(result => ok(result));
  }

  @Get("dining-groups/:diningGroupId")
  @ApiOkResponse({ description: "饭搭子详情" })
  get(@Req() request: RequestWithUser, @Param("diningGroupId") diningGroupId: string) {
    return this.diningGroupService.get(request.user.userId, diningGroupId).then(result => ok(result));
  }

  @Get("dining-group-members")
  @ApiOkResponse({ description: "饭搭子成员列表" })
  listMembers(@Req() request: RequestWithUser, @Query() query: DiningGroupMembersQueryDto) {
    return this.diningGroupService.listMembers(request.user.userId, query.diningGroupId).then(result => ok(result));
  }

  @Post("dining-group-invites")
  @ApiOkResponse({ description: "创建邀请" })
  createInvite(@Req() request: RequestWithUser, @Body() body: CreateInviteDto) {
    return this.diningGroupService
      .createInvite(request.user.userId, body.diningGroupId, body.operationId)
      .then(result => ok(result));
  }

  @Post("dining-group-invites/:inviteToken/accept")
  @ApiOkResponse({ description: "接受邀请" })
  acceptInvite(@Req() request: RequestWithUser, @Param("inviteToken") inviteToken: string, @Body() body: OperationDto) {
    return this.diningGroupService.acceptInvite(request.user.userId, inviteToken, body.operationId).then(result => ok(result));
  }
}
