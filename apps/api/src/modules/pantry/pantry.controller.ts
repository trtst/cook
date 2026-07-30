import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  ConsumeFridgeItemsDto,
  CreateFridgeItemDto,
  CreateShoppingItemDto,
  OperationDto,
  PageQueryDto,
  ShoppingGapQueryDto,
  ShoppingItemQueryDto,
  UpdateFridgeItemDto,
  UpdateShoppingStatusDto
} from "../../contracts/dtos";
import { ApiOkArray, ApiOkModel, ApiOkPage, FridgeItemModel, ShoppingItemModel } from "../../contracts/openapi";
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

  @Get("shopping-gap")
  @ApiOkArray(ShoppingItemModel, "预览某个饭局菜单相对于本人冰箱的购物缺口")
  previewGap(@Req() request: RequestWithUser, @Query() query: ShoppingGapQueryDto) {
    return this.pantryService.previewEventGap(request.user.userId, query.eventId).then(result => ok(result));
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
