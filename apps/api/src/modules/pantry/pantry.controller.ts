import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  AddRecipeToShoppingListDto,
  ConsumeFridgeItemsDto,
  CreateRandomMenuShoppingItemsDto,
  CreateFridgeItemDto,
  CreateRecipeShoppingItemsDto,
  CreateShoppingListDto,
  CreateShoppingListItemDto,
  CreateShoppingItemDto,
  DeleteShoppingListDto,
  CompleteShoppingListDto,
  LeaveShoppingListDto,
  OperationDto,
  PageQueryDto,
  RenameShoppingListDto,
  RemoveShoppingListItemDto,
  RemoveShoppingListMemberDto,
  ShoppingListInviteQueryDto,
  ShoppingListQueryDto,
  ShoppingItemQueryDto,
  ShareShoppingListMembersDto,
  UpdateFridgeItemDto,
  UpdateShoppingGroupStatusDto,
  UpdateShoppingListItemCheckDto,
  UpdateShoppingListStatusDto,
  UpdateShoppingStatusDto
} from "../../contracts/dtos";
import {
  ApiOkArray,
  ApiOkModel,
  ApiOkPage,
  FridgeItemModel,
  ShoppingBoardModel,
  ShoppingItemModel,
  ShoppingListDetailModel,
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

  @Get("fridge-items")
  @ApiOkPage(FridgeItemModel, "分页查询当前用户自己的冰箱条目")
  listFridge(@Req() request: RequestWithUser, @Query() query: PageQueryDto) {
    return this.pantryService.listFridge(request.user.userId, query.page, query.pageSize).then(result => ok(result));
  }

  @Post("fridge-items")
  @ApiIdempotencyKey()
  @ApiOkModel(FridgeItemModel, "创建一个冰箱条目")
  createFridgeItem(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateFridgeItemDto
  ) {
    return this.pantryService
      .createFridgeItem(request.user.userId, operationId, body.name, body.quantityText, body.note)
      .then(result => ok(result));
  }

  @Put("fridge-items/:itemId")
  @ApiIdempotencyKey()
  @ApiOkModel(FridgeItemModel, "更新一个冰箱条目")
  updateFridgeItem(
    @Req() request: RequestWithUser,
    @Param("itemId", ParseIntPipe) itemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateFridgeItemDto
  ) {
    return this.pantryService
      .updateFridgeItem(request.user.userId, itemId, operationId, body.name, body.quantityText, body.note)
      .then(result => ok(result));
  }

  @Post("fridge-items/consume")
  @ApiIdempotencyKey()
  @ApiOkPage(FridgeItemModel, "本人确认库存扣减")
  consumeFridgeItems(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ConsumeFridgeItemsDto
  ) {
    return this.pantryService.consumeFridgeItems(request.user.userId, operationId, body.itemIds).then(result => ok(result));
  }

  @Get("shopping-items")
  @ApiOkPage(ShoppingItemModel, "分页查询当前用户自己的购物清单")
  listShopping(@Req() request: RequestWithUser, @Query() query: ShoppingItemQueryDto) {
    return this.pantryService
      .listShopping(request.user.userId, query.page, query.pageSize, query.status)
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
      .addRecipeToShoppingList(request.user.userId, listId, operationId, body.recipeId, body.sourceVersionId)
      .then(result => ok(result));
  }

  @Post("shopping-lists/:listId/items/:itemId/check")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "勾选或取消勾选一个购物清单项")
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

  @Post("shopping-lists/:listId/items/:itemId/remove")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "把一个购物清单项从当前有效采购项中移除")
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

  @Post("shopping-lists/:listId/complete")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "完成一张购物清单并确认入库")
  completeShoppingList(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CompleteShoppingListDto
  ) {
    return this.pantryService
      .completeShoppingList(
        request.user.userId,
        listId,
        operationId,
        body.version,
        body.entries.map(entry => ({
          itemId: entry.itemId,
          store: entry.store,
          quantityText: entry.quantityText ?? null,
          expireDays: entry.expireDays ?? null,
          expireAt: entry.expireAt ?? null
        }))
      )
      .then(result => ok(result));
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

  @Post("shopping-lists/:listId/share-members")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingListDetailModel, "向饭搭子成员发送待确认的共享购物清单邀请")
  shareShoppingListMembers(
    @Req() request: RequestWithUser,
    @Param("listId", ParseIntPipe) listId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ShareShoppingListMembersDto
  ) {
    return this.pantryService
      .shareShoppingListMembers(request.user.userId, listId, operationId, body.version, body.targetUserIds)
      .then(result => ok(result));
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

  @Get("shopping-items/board")
  @ApiOkModel(ShoppingBoardModel, "读取当前用户待买购物清单的聚合视图")
  getShoppingBoard(@Req() request: RequestWithUser) {
    return this.pantryService.getShoppingBoard(request.user.userId).then(result => ok(result));
  }

  @Post("shopping-items")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingItemModel, "手动创建一个购物项")
  createShoppingItem(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateShoppingItemDto
  ) {
    return this.pantryService
      .createShoppingItem(request.user.userId, operationId, body.name, body.quantityText, body.note)
      .then(result => ok(result));
  }

  @Post("shopping-items/from-recipe")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingBoardModel, "把一份可读菜谱按固定版本加入当前用户购物清单")
  createRecipeShoppingItems(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateRecipeShoppingItemsDto
  ) {
    return this.pantryService
      .createRecipeShoppingItems(request.user.userId, operationId, body.recipeId, body.sourceVersionId)
      .then(result => ok(result));
  }

  @Post("shopping-items/from-random-menu")
  @ApiIdempotencyKey()
  @ApiOkArray(ShoppingItemModel, "把当前随机菜单确认采购的缺口写入本人购物清单")
  createRandomMenuShoppingItems(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateRandomMenuShoppingItemsDto
  ) {
    return this.pantryService
      .createRandomMenuShoppingItems(
        request.user.userId,
        operationId,
        body.items.map(item => ({
          slotId: item.slotId,
          recipeId: item.recipeId,
          recipeVersionId: item.recipeVersionId,
          ingredients: item.ingredients.map(ingredient => ({
            ingredientId: ingredient.ingredientId ?? null,
            ingredientName: ingredient.ingredientName,
            quantityText: ingredient.quantityText ?? null
          }))
        }))
      )
      .then(result => ok(result));
  }

  @Post("shopping-items/:itemId/status")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingItemModel, "更新购物项状态")
  updateShoppingStatus(
    @Req() request: RequestWithUser,
    @Param("itemId", ParseIntPipe) itemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateShoppingStatusDto
  ) {
    return this.pantryService
      .updateShoppingStatus(request.user.userId, itemId, operationId, body.status)
      .then(result => ok(result));
  }

  @Post("shopping-items/group-status")
  @ApiIdempotencyKey()
  @ApiOkModel(ShoppingBoardModel, "更新一个购物聚合分组的状态")
  updateShoppingGroupStatus(
    @Req() request: RequestWithUser,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateShoppingGroupStatusDto
  ) {
    return this.pantryService
      .updateShoppingGroupStatus(request.user.userId, operationId, body.targetKey, body.status)
      .then(result => ok(result));
  }

  @Get("shopping-gap")
  @ApiOkArray(ShoppingItemModel, "预览当前用户待处理饭局汇总后的购物缺口")
  previewGap(@Req() request: RequestWithUser) {
    return this.pantryService.previewGap(request.user.userId).then(result => ok(result));
  }

  @Post("dining-events/:eventId/shopping-gap")
  @ApiIdempotencyKey()
  @ApiOkArray(ShoppingItemModel, "把某个饭局菜单缺口写入本人购物清单")
  createGap(
    @Req() request: RequestWithUser,
    @Param("eventId", ParseIntPipe) eventId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() _body: OperationDto
  ) {
    return this.pantryService.createEventGap(request.user.userId, eventId, operationId).then(result => ok(result));
  }
}
