import { BadRequestException, Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
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
  ConfirmMealPlanMenuDto,
  CompleteMealPlanDto,
  CreateDiningMemoryShareDto,
  CreateDirectDiningEventDto,
  CreateDiningEventDto,
  CreateMealPlanDto,
  GenerateMealPlanCookAssistantDto,
  GenerateRandomMenuDto,
  MealPlanQueryDto,
  CheckRandomMenuGapDto,
  ReplaceRandomMenuSlotDto,
  RespondDiningEventDto,
  UpdateDiningEventNoteDto,
  UpdateMealPlanTitleDto,
  UpdateDiningEventScheduleDto,
  UpdateDiningEventCoverDto,
} from "../../contracts/dtos";
import {
  ApiOkArray,
  ApiOkModel,
  ApiOkPage,
  DiningMemorySharePreviewModel,
  DiningMemoryShareSnapshotModel,
  DiningEventModel,
  DiningEventShareLinkModel,
  MealPlanCookAssistantModel,
  MealPlanModel,
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
        body.title,
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

  @Post("meal-plans/:planItemId/title")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(MealPlanModel, "更新一个计划餐次的标题")
  updateMealPlanTitle(
    @Req() request: RequestWithUser,
    @Param("planItemId", ParseIntPipe) planItemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateMealPlanTitleDto
  ) {
    return this.mealService
      .updateMealPlanTitle(request.user.userId, planItemId, operationId, body.expectedVersion, body.title)
      .then(result => ok(result));
  }

  @Post("meal-plans/:planItemId/confirm-menu")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(MealPlanModel, "确认当前餐次菜单，锁定后不再允许调整菜单结构")
  confirmMealPlanMenu(
    @Req() request: RequestWithUser,
    @Param("planItemId", ParseIntPipe) planItemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ConfirmMealPlanMenuDto
  ) {
    return this.mealService
      .confirmMealPlanMenu(request.user.userId, planItemId, operationId, body.expectedVersion)
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
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @Param("planItemId", ParseIntPipe) planItemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateDiningEventDto
  ) {
    return this.mealService
      .createDiningEvent(request.user.userId, planItemId, operationId, body.scheduledAt, body.location, request)
      .then(result => ok(result));
  }

  @Post("dining-events")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "直接创建一场饭局，必要时自动补一条空菜单餐次")
  createDirectDiningEvent(
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateDirectDiningEventDto
  ) {
    return this.mealService
      .createDirectDiningEvent(request, request.user.userId, operationId, body.planDate, body.mealSlot, body.scheduledAt, body.location)
      .then(result => ok(result));
  }

  @Get("dining-events/:eventId")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(DiningEventModel, "查看我的饭局详情或参与中的饭局详情")
  getDiningEvent(
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @Param("eventId", ParseIntPipe) eventId: number
  ) {
    return this.mealService.getDiningEvent(request.user.userId, eventId, undefined, undefined, request).then(result => ok(result));
  }

  @Post("dining-events/:eventId/share-link")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventShareLinkModel, "生成或重置饭局邀请分享链接")
  createDiningEventShareLink(
    @Req() request: RequestWithUser,
    @Param("eventId", ParseIntPipe) eventId: number,
    @ReadIdempotencyKey() operationId: string
  ) {
    return this.mealService.createDiningEventShareLink(request.user.userId, eventId, operationId).then(result => ok(result));
  }

  @Post("dining-events/:eventId/share-link/disable")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "关闭当前饭局的好友邀请链接")
  disableDiningEventShareLink(
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @Param("eventId", ParseIntPipe) eventId: number,
    @ReadIdempotencyKey() operationId: string
  ) {
    return this.mealService
      .disableDiningEventShareLink(request.user.userId, eventId, operationId, request)
      .then(result => ok(result));
  }

  @Post("dining-events/:eventId/participants/:participantId/revoke")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "撤回一条待确认的饭局邀请")
  revokeDiningEventParticipantInvite(
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @Param("eventId", ParseIntPipe) eventId: number,
    @Param("participantId", ParseIntPipe) participantId: number,
    @ReadIdempotencyKey() operationId: string
  ) {
    return this.mealService
      .revokeDiningEventParticipantInvite(request.user.userId, eventId, participantId, operationId, request)
      .then(result => ok(result));
  }

  @Post("dining-events/:eventId/participants/:participantId/reinvite")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "再次邀请一位已拒绝或已移除的饭搭子成员")
  reinviteDiningEventParticipant(
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @Param("eventId", ParseIntPipe) eventId: number,
    @Param("participantId", ParseIntPipe) participantId: number,
    @ReadIdempotencyKey() operationId: string
  ) {
    return this.mealService
      .reinviteDiningEventParticipant(request.user.userId, eventId, participantId, operationId, request)
      .then(result => ok(result));
  }

  @Post("dining-events/:eventId/schedule")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "更新一场饭局的时间和地点")
  updateDiningEventSchedule(
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @Param("eventId", ParseIntPipe) eventId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateDiningEventScheduleDto
  ) {
    return this.mealService
      .updateDiningEventSchedule(request, request.user.userId, eventId, operationId, body.expectedVersion, body.scheduledAt, body.location)
      .then(result => ok(result));
  }

  @Post("dining-events/:eventId/note")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "更新一场饭局的公开备注")
  updateDiningEventNote(
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @Param("eventId", ParseIntPipe) eventId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateDiningEventNoteDto
  ) {
    return this.mealService
      .updateDiningEventNote(request, request.user.userId, eventId, operationId, body.expectedVersion, body.note)
      .then(result => ok(result));
  }

  @Post("dining-events/:eventId/cover")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiIdempotencyKey()
  @ApiOkModel(DiningEventModel, "上传或替换饭局封面图")
  updateDiningEventCover(
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @Param("eventId", ParseIntPipe) eventId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateDiningEventCoverDto,
    @UploadedFile() file?: { buffer?: Buffer; size?: number }
  ) {
    if (!file) {
      throw new BadRequestException("请上传图片");
    }
    return this.mealService
      .updateDiningEventCover(request, request.user.userId, eventId, operationId, body.expectedVersion, file)
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
