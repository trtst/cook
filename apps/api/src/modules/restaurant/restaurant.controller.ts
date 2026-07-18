import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { UserAuthGuard } from "../../common/user-auth.guard";
import { CreateInviteDto, CreateRestaurantDto, OperationDto, RestaurantMembersQueryDto } from "../../contracts/dtos";
import { MockRestaurantService } from "./mock-restaurant.service";

@ApiTags("restaurants")
@Controller()
@UseGuards(UserAuthGuard)
@ApiBearerAuth("UserBearerAuth")
export class RestaurantController {
  constructor(@Inject(MockRestaurantService) private readonly restaurantService: MockRestaurantService) {}

  @Get("restaurants/mine")
  @ApiOkResponse({ description: "我的餐厅列表" })
  listMine() {
    return ok(this.restaurantService.listMine());
  }

  @Post("restaurants")
  @ApiOkResponse({ description: "创建餐厅" })
  create(@Body() body: CreateRestaurantDto) {
    return ok(this.restaurantService.create(body.name));
  }

  @Get("restaurants/:restaurantId")
  @ApiOkResponse({ description: "餐厅详情" })
  get(@Param("restaurantId") restaurantId: string) {
    return ok(this.restaurantService.get(restaurantId));
  }

  @Get("restaurant-members")
  @ApiOkResponse({ description: "餐厅成员列表" })
  listMembers(@Query() query: RestaurantMembersQueryDto) {
    return ok(this.restaurantService.listMembers(query.restaurantId));
  }

  @Post("restaurant-invites")
  @ApiOkResponse({ description: "创建邀请" })
  createInvite(@Body() body: CreateInviteDto) {
    return ok(this.restaurantService.createInvite(body.restaurantId));
  }

  @Post("restaurant-invites/:inviteToken/accept")
  @ApiOkResponse({ description: "接受邀请" })
  acceptInvite(@Param("inviteToken") inviteToken: string, @Body() _body: OperationDto) {
    return ok(this.restaurantService.acceptInvite(inviteToken));
  }
}
