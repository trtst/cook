import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  AcceptShareInviteDto,
  ChooseBringRecipeDto,
  CreateDiningEventDto,
  CreateMealPlanDto,
  InviteDiningGroupParticipantsDto,
  MealPlanQueryDto,
  RespondDiningEventDto
} from "../../contracts/dtos";
import { ApiOkModel, ApiOkPage, DiningEventModel, MealPlanModel, SharePreviewModel } from "../../contracts/openapi";
import { MealService } from "./meal.service";

@ApiTags("meal")
@Controller()
export class MealController {
  constructor(@Inject(MealService) private readonly mealService: MealService) {}

  @Get("meal-plans")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkPage(MealPlanModel, "分页查询当前用户的计划餐次")
  listMealPlans(@Req() request: RequestWithUser, @Query() query: MealPlanQueryDto) {
    return this.mealService
      .listMealPlans(request.user.userId, query.page, query.pageSize, query.from, query.to)
      .then(result => ok(result));
  }

  @Post("meal-plans")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(MealPlanModel, "创建或更新一个计划餐次")
  createMealPlan(@Req() request: RequestWithUser, @Body() body: CreateMealPlanDto) {
    return this.mealService
      .createMealPlan(request.user.userId, body.operationId, body.planDate, body.mealSlot, body.recipeId, body.note)
      .then(result => ok(result));
  }

  @Post("meal-plans/:planItemId/dining-event")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(DiningEventModel, "从计划餐次发起饭局")
  createDiningEvent(
    @Req() request: RequestWithUser,
    @Param("planItemId", new ParseUUIDPipe({ version: "4" })) planItemId: string,
    @Body() body: CreateDiningEventDto
  ) {
    return this.mealService
      .createDiningEvent(request.user.userId, planItemId, body.operationId, body.scheduledAt, body.location)
      .then(result => ok(result));
  }

  @Get("dining-events/:eventId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(DiningEventModel, "查看我的饭局详情或参与中的饭局详情")
  getDiningEvent(@Req() request: RequestWithUser, @Param("eventId", new ParseUUIDPipe({ version: "4" })) eventId: string) {
    return this.mealService.getDiningEvent(request.user.userId, eventId).then(result => ok(result));
  }

  @Post("dining-events/:eventId/invite-group")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(DiningEventModel, "从某个饭搭子一键邀请成员参加饭局")
  inviteDiningGroup(
    @Req() request: RequestWithUser,
    @Param("eventId", new ParseUUIDPipe({ version: "4" })) eventId: string,
    @Body() body: InviteDiningGroupParticipantsDto
  ) {
    return this.mealService
      .inviteDiningGroup(request.user.userId, eventId, body.diningGroupId, body.operationId)
      .then(result => ok(result));
  }

  @Post("dining-events/:eventId/respond")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(DiningEventModel, "参与人接受或拒绝饭局邀请")
  respondToDiningEvent(
    @Req() request: RequestWithUser,
    @Param("eventId", new ParseUUIDPipe({ version: "4" })) eventId: string,
    @Body() body: RespondDiningEventDto
  ) {
    return this.mealService
      .respondToDiningEvent(request.user.userId, eventId, body.operationId, body.status)
      .then(result => ok(result));
  }

  @Post("dining-events/:eventId/bring")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(DiningEventModel, "参与人选择我带菜")
  chooseBringRecipe(
    @Req() request: RequestWithUser,
    @Param("eventId", new ParseUUIDPipe({ version: "4" })) eventId: string,
    @Body() body: ChooseBringRecipeDto
  ) {
    return this.mealService
      .chooseBringRecipe(request.user.userId, eventId, body.recipeId, body.operationId)
      .then(result => ok(result));
  }

  @Get("share/:shareToken/preview")
  @ApiOkModel(SharePreviewModel, "饭局分享预览，只返回白名单字段")
  getSharePreview(@Param("shareToken") shareToken: string) {
    return this.mealService.getSharePreview(shareToken).then(result => ok(result));
  }

  @Post("share/:shareToken/accept")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(DiningEventModel, "登录用户通过分享加入饭局")
  acceptShareInvite(
    @Req() request: RequestWithUser,
    @Param("shareToken") shareToken: string,
    @Body() body: AcceptShareInviteDto
  ) {
    return this.mealService
      .acceptShareInvite(request.user.userId, shareToken, body.operationId, body.guestName)
      .then(result => ok(result));
  }
}
