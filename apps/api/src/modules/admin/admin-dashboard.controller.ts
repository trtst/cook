import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import type { RequestWithAdmin } from "../../common/auth-context";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import { AdminDashboardTrendQueryDto } from "../../contracts/dtos";
import { AdminDashboardTrendsResponseModel, ApiOkModel } from "../../contracts/openapi";
import { AdminDashboardService } from "./admin-dashboard.service";

@ApiTags("admin-dashboard")
@Controller("admin/dashboard")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
@ApiBearerAuth("AdminBearerAuth")
export class AdminDashboardController {
  constructor(@Inject(AdminDashboardService) private readonly adminDashboardService: AdminDashboardService) {}

  @Get("trends")
  @ApiOkModel(AdminDashboardTrendsResponseModel, "后台首页趋势图数据")
  getTrends(@Req() request: RequestWithAdmin, @Query() query: AdminDashboardTrendQueryDto) {
    return this.adminDashboardService.getTrends(request.admin.adminId, query.range).then(result => ok(result));
  }
}
