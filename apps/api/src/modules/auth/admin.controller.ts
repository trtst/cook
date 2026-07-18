import { Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import { AdminLoginDto, AdminRestaurantQueryDto, PageQueryDto } from "../../contracts/dtos";
import { MockRestaurantService } from "../restaurant/mock-restaurant.service";
import { MockAuthService } from "./mock-auth.service";

@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(
    @Inject(MockAuthService) private readonly authService: MockAuthService,
    @Inject(MockRestaurantService) private readonly restaurantService: MockRestaurantService
  ) {}

  @Post("auth/login")
  @ApiOkResponse({ description: "管理员登录，返回后台 token" })
  login(@Body() body: AdminLoginDto) {
    return ok(this.authService.loginAdmin(body));
  }

  @Get("users")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkResponse({ description: "后台用户只读查询" })
  listUsers(@Query() query: PageQueryDto) {
    return ok(this.authService.listUsers(query.page, query.pageSize, query.keyword));
  }

  @Get("restaurants")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkResponse({ description: "后台餐厅只读查询" })
  listRestaurants(@Query() query: AdminRestaurantQueryDto) {
    return ok(this.restaurantService.listRestaurants(query.page, query.pageSize, query.keyword, query.status));
  }
}
