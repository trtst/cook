import { BadRequestException, Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  CreateDiningGroupDto,
  CreateInviteDto,
  DiningGroupMembersQueryDto,
  OperationDto,
  RemoveDiningGroupMemberDto,
  UpdateDiningGroupCoverDto,
  UpdateDiningGroupDto,
  VersionedOperationDto
} from "../../contracts/dtos";
import {
  AcceptInviteResultModel,
  ApiOkModel,
  CreateDiningGroupResultModel,
  CreateInviteResultModel,
  DiningGroupMembersModel,
  DissolveDiningGroupResultModel,
  LeaveDiningGroupResultModel,
  MyDiningGroupsModel,
  RemoveDiningGroupMemberResultModel,
  StorageUsageModel,
  UpdateDiningGroupCoverResultModel,
  UpdateDiningGroupResultModel
} from "../../contracts/openapi";
import { DiningGroupService } from "./dining-group.service";

@ApiTags("dining-groups")
@Controller()
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class DiningGroupController {
  constructor(@Inject(DiningGroupService) private readonly diningGroupService: DiningGroupService) {}

  @Get("dining-groups")
  @ApiOkModel(MyDiningGroupsModel, "查询本人主理和加入的有效饭搭子")
  listMine(@Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined }) {
    return this.diningGroupService.listMine(request, request.user.userId).then(result => ok(result));
  }

  @Post("dining-groups")
  @ApiIdempotencyKey()
  @ApiOkModel(CreateDiningGroupResultModel, "显式开启饭搭子并创建本人主理的首个关系")
  createDiningGroup(
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateDiningGroupDto
  ) {
    return this.diningGroupService.createDiningGroup(request, request.user.userId, operationId, body).then(result => ok(result));
  }

  @Get("dining-group-members")
  @ApiOkModel(DiningGroupMembersModel, "查询某个有效饭搭子的成员")
  listMembers(@Req() request: RequestWithUser, @Query() query: DiningGroupMembersQueryDto) {
    return this.diningGroupService.listMembers(request.user.userId, query.diningGroupId).then(result => ok(result));
  }

  @Get("storage-usage")
  @ApiOkModel(StorageUsageModel, "查询个人空间额度摘要")
  getStorageUsage(@Req() request: RequestWithUser) {
    return this.diningGroupService.getStorageUsage(request.user.userId).then(result => ok(result));
  }

  @Post("dining-group-invites")
  @ApiIdempotencyKey()
  @ApiOkModel(CreateInviteResultModel, "为指定饭搭子创建单次邀请")
  createInvite(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateInviteDto
  ) {
    return this.diningGroupService
      .createInvite(request.user.userId, body.diningGroupId, operationId)
      .then(result => ok(result));
  }

  @Post("dining-group-invites/:inviteToken/accept")
  @ApiIdempotencyKey()
  @ApiOkModel(AcceptInviteResultModel, "接受邀请并建立新的饭搭子成员关系")
  acceptInvite(
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @Param("inviteToken") inviteToken: string,
    @ReadIdempotencyKey() operationId: string,
    @Body() _body: OperationDto
  ) {
    return this.diningGroupService.acceptInvite(request, request.user.userId, inviteToken, operationId).then(result => ok(result));
  }

  @Put("dining-groups/:diningGroupId")
  @ApiIdempotencyKey()
  @ApiOkModel(UpdateDiningGroupResultModel, "更新当前主理饭搭子的名称和简介")
  updateDiningGroup(
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @Param("diningGroupId", ParseIntPipe) diningGroupId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateDiningGroupDto
  ) {
    return this.diningGroupService
      .updateDiningGroup(request, request.user.userId, diningGroupId, operationId, body)
      .then(result => ok(result));
  }

  @Post("dining-groups/:diningGroupId/cover")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiIdempotencyKey()
  @ApiOkModel(UpdateDiningGroupCoverResultModel, "主理人上传或替换饭搭子主页主图")
  updateDiningGroupCover(
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @Param("diningGroupId", ParseIntPipe) diningGroupId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateDiningGroupCoverDto,
    @UploadedFile() file?: { buffer?: Buffer; size?: number }
  ) {
    if (!file) {
      throw new BadRequestException("请上传图片");
    }
    return this.diningGroupService
      .updateDiningGroupCover(request, request.user.userId, diningGroupId, operationId, body.expectedVersion, file)
      .then(result => ok(result));
  }

  @Post("dining-groups/:diningGroupId/leave")
  @ApiIdempotencyKey()
  @ApiOkModel(LeaveDiningGroupResultModel, "主动退出饭搭子，不回填个人数据")
  leave(
    @Req() request: RequestWithUser,
    @Param("diningGroupId", ParseIntPipe) diningGroupId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: VersionedOperationDto
  ) {
    return this.diningGroupService
      .leave(request.user.userId, diningGroupId, operationId, body.expectedVersion)
      .then(result => ok(result));
  }

  @Post("dining-groups/:diningGroupId/remove-member")
  @ApiIdempotencyKey()
  @ApiOkModel(RemoveDiningGroupMemberResultModel, "主理人移除指定成员")
  removeMember(
    @Req() request: RequestWithUser,
    @Param("diningGroupId", ParseIntPipe) diningGroupId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: RemoveDiningGroupMemberDto
  ) {
    return this.diningGroupService
      .removeMember(request.user.userId, diningGroupId, body.userId, operationId, body.expectedVersion)
      .then(result => ok(result));
  }

  @Post("dining-groups/:diningGroupId/dissolve")
  @ApiIdempotencyKey()
  @ApiOkModel(DissolveDiningGroupResultModel, "主理人直接解散饭搭子，只结束关系对象")
  dissolve(
    @Req() request: RequestWithUser,
    @Param("diningGroupId", ParseIntPipe) diningGroupId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: VersionedOperationDto
  ) {
    return this.diningGroupService
      .dissolve(request.user.userId, diningGroupId, operationId, body.expectedVersion)
      .then(result => ok(result));
  }
}
