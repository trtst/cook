import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  AcceptShareInviteDto,
  AddMealPlanItemDto,
  ClaimCookDto,
  ChooseBringRecipeDto,
  CompleteDiningEventDto,
  ConfirmMealPollDto,
  CompleteMealPlanDto,
  CreateDiningMemoryShareDto,
  CreateMealPollDto,
  CreateDiningEventDto,
  CreateMealPlanDto,
  GenerateMealPlanCookAssistantDto,
  GenerateRandomMenuDto,
  DiningGroupActivitiesQueryDto,
  InviteDiningGroupParticipantsDto,
  MealPollListQueryDto,
  MealPlanQueryDto,
  CheckRandomMenuGapDto,
  ReplaceRandomMenuSlotDto,
  RespondDiningEventDto,
  VoteMealPollDto
} from "../../contracts/dtos";
import {
  ApiOkArray,
  ApiOkModel,
  ApiOkPage,
  DiningMemorySharePreviewModel,
  DiningMemoryShareSnapshotModel,
  DiningEventModel,
  DiningGroupActivityModel,
  MealPlanCookAssistantModel,
  MealPlanModel,
  MealPollDetailModel,
  MealPollModel,
  RandomGapPreviewModel,
  RandomMenuModel,
  ReplaceRandomMenuSlotModel,
  SharePreviewModel
} from "../../contracts/openapi";
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

  @Get("meal-plans/:planItemId/cook-assistant")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(MealPlanCookAssistantModel, "读取当前计划餐次的做饭助手快照")
  getMealPlanCookAssistant(@Req() request: RequestWithUser, @Param("planItemId", ParseIntPipe) planItemId: number) {
    return this.mealService.getMealPlanCookAssistant(request.user.userId, planItemId).then(result => ok(result));
  }

  @Get("meal-polls")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkArray(MealPollModel, "读取当前饭搭子的点菜征集摘要列表")
  listMealPolls(@Req() request: RequestWithUser, @Query() query: MealPollListQueryDto) {
    return this.mealService
      .listMealPolls(request.user.userId, query.diningGroupId, query.status, query.planDate, query.mealSlot, query.limit)
      .then(result => ok(result));
  }

  @Post("meal-polls")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(MealPollDetailModel, "发起一条饭搭子点菜征集")
  createMealPoll(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateMealPollDto
  ) {
    return this.mealService
      .createMealPoll(
        request.user.userId,
        operationId,
        body.diningGroupId,
        body.planDate,
        body.mealSlot,
        body.deadlineAt,
        body.choiceLimit,
        body.note,
        body.candidateRecipeVersionIds
      )
      .then(result => ok(result));
  }

  @Get("meal-polls/:pollId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(MealPollDetailModel, "读取点菜征集详情")
  getMealPoll(@Req() request: RequestWithUser, @Param("pollId", ParseIntPipe) pollId: number) {
    return this.mealService.getMealPoll(request.user.userId, pollId).then(result => ok(result));
  }

  @Post("meal-polls/:pollId/vote")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(MealPollDetailModel, "提交或覆盖当前成员的点菜回应")
  voteMealPoll(
    @Req() request: RequestWithUser,
    @Param("pollId", ParseIntPipe) pollId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: VoteMealPollDto
  ) {
    return this.mealService
      .voteMealPoll(
        request.user.userId,
        pollId,
        operationId,
        body.expectedVersion,
        body.selectedCandidateIds,
        body.suggestionTitle,
        body.note
      )
      .then(result => ok(result));
  }

  @Post("meal-polls/:pollId/confirm")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(MealPollDetailModel, "确认最终菜单并生成或更新餐次与饭局")
  confirmMealPoll(
    @Req() request: RequestWithUser,
    @Param("pollId", ParseIntPipe) pollId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ConfirmMealPollDto
  ) {
    return this.mealService
      .confirmMealPoll(
        request.user.userId,
        pollId,
        operationId,
        body.expectedVersion,
        body.finalRecipeVersionIds,
        body.scheduledAt,
        body.location
      )
      .then(result => ok(result));
  }

  @Post("meal-plans")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(MealPlanModel, "创建或更新一个计划餐次")
  createMealPlan(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateMealPlanDto
  ) {
    return this.mealService
      .createMealPlan(
        request.user.userId,
        operationId,
        body.planDate,
        body.mealSlot,
        body.menuItems,
        body.expectedVersion,
        body.note
      )
      .then(result => ok(result));
  }

  @Post("meal-plans/items")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(MealPlanModel, "向某个餐次追加一道菜谱")
  addMealPlanItem(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: AddMealPlanItemDto
  ) {
    return this.mealService
      .addMealPlanItem(
        request.user.userId,
        operationId,
        body.planDate,
        body.mealSlot,
        body.recipeId,
        body.recipeVersionId,
        body.slotType ?? null,
        body.purchaseState ?? "READY"
      )
      .then(result => ok(result));
  }

  @Post("random-menus/generate")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(RandomMenuModel, "按餐次、人数和冰箱优先生成一桌随机菜单")
  generateRandomMenu(@Req() request: RequestWithUser, @Body() body: GenerateRandomMenuDto) {
    return this.mealService
      .generateRandomMenu(request.user.userId, body.mealSlot, body.peopleCount, body.fridgePreferred, body.slotPlan ?? null)
      .then(result => ok(result));
  }

  @Post("random-menu-slots/replace")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(ReplaceRandomMenuSlotModel, "替换当前随机菜单中的单个菜位")
  replaceRandomMenuSlot(@Req() request: RequestWithUser, @Body() body: ReplaceRandomMenuSlotDto) {
    return this.mealService
      .replaceRandomMenuSlot(
        request.user.userId,
        body.mealSlot,
        body.peopleCount,
        body.fridgePreferred,
        body.slotPlan,
        body.currentItems.map(item => ({
          slotId: item.slotId,
          slotType: item.slotType as
            | "MEAT"
            | "VEGETABLE"
            | "SOUP"
            | "STAPLE"
            | "BREAKFAST_STAPLE"
            | "BREAKFAST_PROTEIN"
            | "BREAKFAST_SIDE",
          recipeId: item.recipeId,
          recipeVersionId: item.recipeVersionId
        })),
        body.targetSlotId,
        body.targetSlotType,
        body.replaceConstraints.map(item => ({
          kind: item.kind as "FLAVOR" | "DURATION" | "INGREDIENT" | "AVOID_INGREDIENT",
          value: item.value ?? null,
          ingredientId: item.ingredientId ?? null,
          ingredientName: item.ingredientName ?? null
        })),
        body.rejectedRecipeVersionIds,
        body.requestSeq
      )
      .then(result => ok(result));
  }

  @Post("random-menu-gap/preview")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(RandomGapPreviewModel, "预检当前随机菜单的本桌缺口")
  previewRandomMenuGap(@Req() request: RequestWithUser, @Body() body: CheckRandomMenuGapDto) {
    return this.mealService
      .previewRandomMenuGap(request.user.userId, body.mealSlot, body.peopleCount, body.items, body.inventoryDecisions)
      .then(result => ok(result));
  }

  @Post("meal-plans/:planItemId/complete")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(MealPlanModel, "计划拥有者完成一个餐次")
  completeMealPlan(
    @Req() request: RequestWithUser,
    @Param("planItemId", ParseIntPipe) planItemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() _body: CompleteMealPlanDto
  ) {
    return this.mealService.completeMealPlan(request.user.userId, planItemId, operationId).then(result => ok(result));
  }

  @Post("meal-plans/:planItemId/cook-assistant")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(MealPlanCookAssistantModel, "生成或重生成当前计划餐次的做饭助手快照")
  generateMealPlanCookAssistant(
    @Req() request: RequestWithUser,
    @Param("planItemId", ParseIntPipe) planItemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() _body: GenerateMealPlanCookAssistantDto
  ) {
    return this.mealService.generateMealPlanCookAssistant(request.user.userId, planItemId, operationId).then(result => ok(result));
  }

  @Post("meal-plans/:planItemId/dining-event")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "从计划餐次发起饭局")
  createDiningEvent(
    @Req() request: RequestWithUser,
    @Param("planItemId", ParseIntPipe) planItemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateDiningEventDto
  ) {
    return this.mealService
      .createDiningEvent(request.user.userId, planItemId, operationId, body.scheduledAt, body.location)
      .then(result => ok(result));
  }

  @Get("dining-events/:eventId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(DiningEventModel, "查看我的饭局详情或参与中的饭局详情")
  getDiningEvent(@Req() request: RequestWithUser, @Param("eventId", ParseIntPipe) eventId: number) {
    return this.mealService.getDiningEvent(request.user.userId, eventId).then(result => ok(result));
  }

  @Get("dining-group-activities")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkArray(DiningGroupActivityModel, "读取当前饭搭子最近轻动态")
  listDiningGroupActivities(@Req() request: RequestWithUser, @Query() query: DiningGroupActivitiesQueryDto) {
    return this.mealService
      .listDiningGroupActivities(request.user.userId, query.diningGroupId, query.limit)
      .then(result => ok(result));
  }

  @Post("dining-events/:eventId/invite-group")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "从某个饭搭子一键邀请成员参加饭局")
  inviteDiningGroup(
    @Req() request: RequestWithUser,
    @Param("eventId", ParseIntPipe) eventId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: InviteDiningGroupParticipantsDto
  ) {
    return this.mealService
      .inviteDiningGroup(request.user.userId, eventId, body.diningGroupId, operationId)
      .then(result => ok(result));
  }

  @Post("dining-events/:eventId/respond")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "参与人接受或拒绝饭局邀请")
  respondToDiningEvent(
    @Req() request: RequestWithUser,
    @Param("eventId", ParseIntPipe) eventId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: RespondDiningEventDto
  ) {
    return this.mealService
      .respondToDiningEvent(request.user.userId, eventId, operationId, body.status)
      .then(result => ok(result));
  }

  @Post("dining-events/:eventId/bring")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "参与人选择我带菜")
  chooseBringRecipe(
    @Req() request: RequestWithUser,
    @Param("eventId", ParseIntPipe) eventId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ChooseBringRecipeDto
  ) {
    return this.mealService
      .chooseBringRecipe(request.user.userId, eventId, body.recipeId, operationId)
      .then(result => ok(result));
  }

  @Post("dining-events/:eventId/cook")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "认领或释放一道菜的掌勺人")
  claimCook(
    @Req() request: RequestWithUser,
    @Param("eventId", ParseIntPipe) eventId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ClaimCookDto
  ) {
    return this.mealService
      .claimCook(request.user.userId, eventId, operationId, body.expectedVersion, body.menuItemId, body.action)
      .then(result => ok(result));
  }

  @Post("dining-events/:eventId/complete")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "饭局发起人完成一场饭局")
  completeDiningEvent(
    @Req() request: RequestWithUser,
    @Param("eventId", ParseIntPipe) eventId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() _body: CompleteDiningEventDto
  ) {
    return this.mealService.completeDiningEvent(request.user.userId, eventId, operationId).then(result => ok(result));
  }

  @Post("dining-events/:eventId/memory-shares")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningMemoryShareSnapshotModel, "生成一张饭搭子卡不可变分享快照")
  createDiningMemoryShare(
    @Req() request: RequestWithUser,
    @Param("eventId", ParseIntPipe) eventId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateDiningMemoryShareDto
  ) {
    return this.mealService
      .createDiningMemoryShare(
        request.user.userId,
        eventId,
        operationId,
        body.showParticipants ?? true,
        body.caption ?? null
      )
      .then(result => ok(result));
  }

  @Get("share/:shareToken/preview")
  @ApiOkModel(SharePreviewModel, "饭局分享预览，只返回白名单字段")
  getSharePreview(@Param("shareToken") shareToken: string) {
    return this.mealService.getSharePreview(shareToken).then(result => ok(result));
  }

  @Get("memory-shares/:shareToken/preview")
  @ApiOkModel(DiningMemorySharePreviewModel, "饭搭子卡分享预览，只返回不可变白名单快照")
  getDiningMemorySharePreview(@Param("shareToken") shareToken: string) {
    return this.mealService.getDiningMemorySharePreview(shareToken).then(result => ok(result));
  }

  @Post("share/:shareToken/accept")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "登录用户通过分享加入饭局")
  acceptShareInvite(
    @Req() request: RequestWithUser,
    @Param("shareToken") shareToken: string,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: AcceptShareInviteDto
  ) {
    return this.mealService
      .acceptShareInvite(request.user.userId, shareToken, operationId, body.guestName)
      .then(result => ok(result));
  }
}
