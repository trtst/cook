import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  AddShoppingGapItemsDto,
  AddEventGapToShoppingListDto,
  AddPlanToShoppingListDto,
  AddRecipeToShoppingListDto,
  CreateFridgeTraceDto,
  CreateFridgeTraceBatchDto,
  CreateShoppingListDto,
  CreateShoppingListItemDto,
  DeleteShoppingListDto,
  LeaveShoppingListDto,
  OperationDto,
  PageQueryDto,
  RenameShoppingListDto,
  RemoveShoppingListItemDto,
  RemoveShoppingListMemberDto,
  ShoppingListInviteQueryDto,
  ShoppingListQueryDto,
  UpdateShoppingListItemCheckDto,
  UpdateShoppingListItemChecksDto,
  UpdateShoppingListStatusDto
} from "../../contracts/dtos";
import {
  ApiOkArray,
  ApiOkModel,
  ApiOkPage,
  FridgeTraceIngredientModel,
  FridgeTraceModel,
  FridgeTraceSummaryResponseModel,
  ShoppingGapPreviewItemModel,
  ShoppingGapResponseModel,
  ShoppingListDetailModel,
  ShoppingListItemPatchResponseModel,
  ShoppingListInviteActionModel,
  ShoppingListInvitePageResponseModel,
  ShoppingListPageResponseModel,
  ShoppingListSummaryResponseModel,
  ShoppingShareLinkModel,
  ShoppingSharePreviewModel
} from "../../contracts/openapi";
import { PantryService } from "./pantry.service";

@ApiTags("pantry")
@Controller()
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class PantryController {
  constructor(@Inject(PantryService) private readonly pantryService: PantryService) {}

  @Get("fridge-traces")
  @ApiOkPage(FridgeTraceIngredientModel, "读取当前用户食材有无状态")
  listFridgeTraces(@Req() request: RequestWithUser, @Query() query: PageQueryDto) {
    return this.pantryService.listFridgeTraces(request.user.userId, query.page, query.pageSize).then(result => ok(result));
  }

  @Get("fridge-traces/summary")
  @ApiOkModel(FridgeTraceSummaryResponseModel, "读取当前用户近期冰箱痕迹摘要")
  getFridgeTraceSummary(@Req() request: RequestWithUser) {
    return this.pantryService.getFridgeTraceSummary(request.user.userId).then(result => ok(result));
  }

  @Post("fridge-traces/present")
  @ApiIdempotencyKey()
  @ApiOkModel(FridgeTraceModel, "手动标记食材还有")
  markFridgeTracePresent(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateFridgeTraceDto
  ) {
    return this.pantryService
      .markFridgeTracePresent(request.user.userId, operationId, body.ingredientId ?? null, body.name, body.categoryName ?? null)
      .then(result => ok(result));
  }

  @Post("fridge-traces/present/batch")
  @ApiIdempotencyKey()
  @ApiOkArray(FridgeTraceModel, "在单个事务中确认多项食材还有")
  markFridgeTracesPresent(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateFridgeTraceBatchDto
  ) {
    return this.pantryService
      .markFridgeTracesPresent(request.user.userId, operationId, body.items.map(item => ({
        ingredientId: item.ingredientId ?? null,
        name: item.name,
        categoryName: item.categoryName ?? null
      })))
      .then(result => ok(result));
  }

  @Post("fridge-traces/empty")
  @ApiIdempotencyKey()
  @ApiOkModel(FridgeTraceModel, "手动标记食材用完")
  markFridgeTraceEmpty(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateFridgeTraceDto
  ) {
    return this.pantryService
      .markFridgeTraceEmpty(request.user.userId, operationId, body.ingredientId ?? null, body.name, body.categoryName ?? null)
      .then(result => ok(result));
  }

  @Get("shopping-lists/summary")
  @ApiOkModel(ShoppingListSummaryResponseModel, "读取购物清单首页顶部状态卡摘要")
  getShoppingListSummary(@Req() request: RequestWithUser) {
    return this.pantryService.getShoppingListSummary(request.user.userId).then(result => ok(result));
  }

  @Get("shopping-lists")
  @ApiOkModel(ShoppingListPageResponseModel, "按状态读取当前用户可见的购物清单列表")
  listShoppingLists(@Req() request: RequestWithUser, @Query() query: ShoppingListQueryDto) {
    return this.pantryService.listShoppingLists(request.user.userId, query.status).then(result => ok(result));
  }

  @Get("shopping-list-invites")
  @ApiOkModel(ShoppingListInvitePageResponseModel, "读取当前用户的购物清单协作邀请")
  listShoppingListInvites(@Req() request: RequestWithUser, @Query() query: ShoppingListInviteQueryDto) {
    return this.pantryService.listShoppingListInvites(request.user.userId, query.filter).then(result => ok(result));
  }

  @Post("shopping-lists")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "创建一张空白购物清单")
  createShoppingList(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateShoppingListDto
  ) {
    return this.pantryService.createShoppingList(request.user.userId, operationId, body.name ?? null).then(result => ok(result));
  }

  @Get("shopping-lists/:listId")
  @ApiOkModel(ShoppingListDetailModel, "读取一张购物清单详情")
  getShoppingListDetail(@Req() request: RequestWithUser, @Param("listId", ParseIntPipe) listId: number) {
    return this.pantryService.getShoppingListDetail(request.user.userId, listId).then(result => ok(result));
  }

  @Post("shopping-lists/:listId/rename")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "重命名购物清单")
  renameShoppingList(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: RenameShoppingListDto
  ) {
    return this.pantryService
      .renameShoppingList(request.user.userId, listId, operationId, body.version, body.name)
      .then(result => ok(result));
  }

  @Post("shopping-lists/:listId/items")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "向购物清单手动增加一项食材")
  createShoppingListItem(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateShoppingListItemDto
  ) {
    return this.pantryService
      .createShoppingListItem(request.user.userId, listId, operationId, body.name, body.ingredientId ?? null, body.quantityText ?? null, body.note ?? null)
      .then(result => ok(result));
  }

  @Post("shopping-lists/:listId/items/from-recipe")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "把一份可读菜谱固定版本写入购物清单")
  addRecipeToShoppingList(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: AddRecipeToShoppingListDto
  ) {
    return this.pantryService
      .addRecipeToShoppingList(request.user.userId, listId, operationId, body.recipeId, body.sourceVersionId, body.planItemId ?? null)
      .then(result => ok(result));
  }

  @Post("shopping-lists/:listId/items/from-plan")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "把一顿计划里的菜谱整单写入购物清单")
  addPlanToShoppingList(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: AddPlanToShoppingListDto
  ) {
    return this.pantryService
      .addPlanToShoppingList(request.user.userId, listId, operationId, body.planItemId)
      .then(result => ok(result));
  }

  @Post("shopping-lists/:listId/items/from-gap")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "把需求页选中的食材写入购物清单")
  addGapItemsToShoppingList(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: AddShoppingGapItemsDto
  ) {
    return this.pantryService
      .addGapItemsToShoppingList(request.user.userId, listId, operationId, body.window, body.gapKeys)
      .then(result => ok(result));
  }

  @Post("shopping-lists/:listId/items/from-event-gap")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "把某个饭局当前完整需求写入指定购物清单")
  addEventGapToShoppingList(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: AddEventGapToShoppingListDto
  ) {
    return this.pantryService
      .addEventGapToShoppingList(request.user.userId, listId, operationId, body.eventId)
      .then(result => ok(result));
  }

  @Post("shopping-lists/:listId/items/:itemId/check")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListItemPatchResponseModel, "勾选或取消勾选一个购物清单项")
  updateShoppingListItemCheck(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateShoppingListItemCheckDto
  ) {
    return this.pantryService
      .updateShoppingListItemCheck(request.user.userId, listId, itemId, operationId, body.version, body.checked)
      .then(result => ok(result));
  }

  @Post("shopping-lists/:listId/items/check")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "批量提交购物清单项的勾选变化")
  updateShoppingListItemChecks(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateShoppingListItemChecksDto
  ) {
    return this.pantryService
      .updateShoppingListItemChecks(request.user.userId, listId, operationId, body.version, body.items)
      .then(result => ok(result));
  }

  @Post("shopping-lists/:listId/items/:itemId/remove")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListItemPatchResponseModel, "把一个购物清单项从当前有效采购项中移除")
  removeShoppingListItem(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: RemoveShoppingListItemDto
  ) {
    return this.pantryService
      .removeShoppingListItem(request.user.userId, listId, itemId, operationId, body.version)
      .then(result => ok(result));
  }

  @Post("shopping-lists/:listId/void")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "作废一张购物清单")
  voidShoppingList(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateShoppingListStatusDto
  ) {
    return this.pantryService.voidShoppingList(request.user.userId, listId, operationId, body.version).then(result => ok(result));
  }

  @Post("shopping-lists/:listId/restore")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "恢复一张已作废购物清单")
  restoreShoppingList(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateShoppingListStatusDto
  ) {
    return this.pantryService.restoreShoppingList(request.user.userId, listId, operationId, body.version).then(result => ok(result));
  }

  @Post("shopping-lists/:listId/copy")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "复制一张购物清单，生成新的采购中清单")
  copyShoppingList(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateShoppingListStatusDto
  ) {
    return this.pantryService.copyShoppingList(request.user.userId, listId, operationId, body.version).then(result => ok(result));
  }

  @Post("shopping-lists/:listId/check-all")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "把当前清单下的全部有效食材标记为已购")
  checkAllShoppingListItems(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateShoppingListStatusDto
  ) {
    return this.pantryService.checkAllShoppingListItems(request.user.userId, listId, operationId, body.version).then(result => ok(result));
  }

  @Post("shopping-lists/:listId/delete")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListPageResponseModel, "删除一张已完成或已作废购物清单")
  deleteShoppingList(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: DeleteShoppingListDto
  ) {
    return this.pantryService.deleteShoppingList(request.user.userId, listId, operationId, body.version).then(result => ok(result));
  }

  @Post("shopping-lists/:listId/share-link")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingShareLinkModel, "生成或重置购物清单分享链接")
  createShoppingListShareLink(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateShoppingListStatusDto
  ) {
    return this.pantryService.createShoppingListShareLink(request.user.userId, listId, operationId, body.version).then(result => ok(result));
  }

  @Post("shopping-lists/:listId/share-link/disable")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "失效当前购物清单分享链接")
  disableShoppingListShareLink(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateShoppingListStatusDto
  ) {
    return this.pantryService.disableShoppingListShareLink(request.user.userId, listId, operationId, body.version).then(result => ok(result));
  }

  @Post("shopping-lists/:listId/members/:memberUserId/remove")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "移除一个已加入的购物清单协作者")
  removeShoppingListMember(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @Param("memberUserId", ParseIntPipe) memberUserId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: RemoveShoppingListMemberDto
  ) {
    return this.pantryService
      .removeShoppingListMember(request.user.userId, listId, memberUserId, operationId, body.version)
      .then(result => ok(result));
  }

  @Post("shopping-lists/:listId/share-close")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "关闭当前购物清单的新增共享入口")
  closeShoppingListShare(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateShoppingListStatusDto
  ) {
    return this.pantryService.closeShoppingListShare(request.user.userId, listId, operationId, body.version).then(result => ok(result));
  }

  @Post("shopping-list-invites/:inviteId/accept")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "接受一条共享购物清单邀请并加入协作")
  acceptShoppingListInvite(
    @Req() request: RequestWithUser,
    @Param("inviteId", ParseIntPipe) inviteId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() _body: OperationDto
  ) {
    return this.pantryService.acceptShoppingListInvite(request.user.userId, inviteId, operationId).then(result => ok(result));
  }

  @Post("shopping-list-invites/:inviteId/decline")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListInviteActionModel, "拒绝一条共享购物清单邀请")
  declineShoppingListInvite(
    @Req() request: RequestWithUser,
    @Param("inviteId", ParseIntPipe) inviteId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() _body: OperationDto
  ) {
    return this.pantryService.declineShoppingListInvite(request.user.userId, inviteId, operationId).then(result => ok(result));
  }

  @Post("shopping-lists/:listId/leave")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListPageResponseModel, "协作者退出一张共享购物清单")
  leaveShoppingList(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: LeaveShoppingListDto
  ) {
    return this.pantryService.leaveShoppingList(request.user.userId, listId, operationId, body.version).then(result => ok(result));
  }

  @Get("shopping-shares/:shareToken")
  @ApiOkModel(ShoppingSharePreviewModel, "读取购物清单分享链接预览")
  getShoppingSharePreview(@Req() request: RequestWithUser, @Param("shareToken") shareToken: string) {
    return this.pantryService.getShoppingSharePreview(request.user.userId, shareToken).then(result => ok(result));
  }

  @Post("shopping-shares/:shareToken/join")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "通过分享链接加入一张共享购物清单")
  joinShoppingShare(
    @Req() request: RequestWithUser,
    @Param("shareToken") shareToken: string,
    @ReadIdempotencyKey() operationId: string,
    @Body() _body: OperationDto
  ) {
    return this.pantryService.joinShoppingShare(request.user.userId, shareToken, operationId).then(result => ok(result));
  }

  @Get("shopping-gap")
  @ApiOkModel(ShoppingGapResponseModel, "预览当前用户待处理饭局汇总后的准备需求")
  previewGap(@Req() request: RequestWithUser) {
    return this.pantryService.previewGap(request.user.userId).then(result => ok(result));
  }

  @Get("meal-plans/:planItemId/shopping-gap")
  @ApiOkArray(ShoppingGapPreviewItemModel, "预览指定餐次的完整准备需求")
  previewPlanGap(
    @Req() request: RequestWithUser,
    @Param("planItemId", ParseIntPipe) planItemId: number
  ) {
    return this.pantryService.previewPlanGap(request.user.userId, planItemId).then(result => ok(result));
  }

  @Get("dining-events/:eventId/shopping-gap")
  @ApiOkArray(ShoppingGapPreviewItemModel, "预览指定饭局的完整准备需求")
  previewEventGap(
    @Req() request: RequestWithUser,
    @Param("eventId", ParseIntPipe) eventId: number
  ) {
    return this.pantryService.previewEventGap(request.user.userId, eventId).then(result => ok(result));
  }

}
