import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { HomeFeatureBoardPlacement } from "@prisma/client";
import { ok } from "../../common/api-response";
import type { RequestWithAdmin } from "../../common/auth-context";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { SetHomeEntryStatusDto, UpdateHomeEntriesDto, UpdateHomeEntryImageDto } from "../../contracts/dtos";
import { AdminHomeEntriesResponseModel, AdminHomeEntryItemModel, ApiOkModel } from "../../contracts/openapi";
import { HomeService } from "./home.service";

function parsePlacement(placement: string): HomeFeatureBoardPlacement {
  if (
    placement === "MAIN" ||
    placement === "SIDE_TOP" ||
    placement === "SIDE_BOTTOM" ||
    placement === "QUICK_1" ||
    placement === "QUICK_2" ||
    placement === "QUICK_3" ||
    placement === "QUICK_4"
  ) {
    return placement;
  }
  throw new NotFoundException("首页快捷入口不存在");
}

@ApiTags("admin-home-entries")
@Controller("admin/home-entries")
@UseGuards(AdminAuthGuard)
@ApiBearerAuth("AdminBearerAuth")
export class AdminHomeController {
  constructor(@Inject(HomeService) private readonly homeService: HomeService) {}

  @Get()
  @ApiOkModel(AdminHomeEntriesResponseModel, "读取小程序首页快捷入口配置")
  getHomeEntries() {
    return this.homeService.getAdminHomeEntries().then(result => ok(result));
  }

  @Put()
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeEntriesResponseModel, "更新小程序首页快捷入口配置")
  updateHomeEntries(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateHomeEntriesDto
  ) {
    return this.homeService.updateAdminHomeEntries(request.admin.adminId, operationId, body).then(result => ok(result));
  }

  @Post(":placement/status")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeEntryItemModel, "切换首页四宫格入口上架状态")
  setHomeEntryStatus(
    @Req() request: RequestWithAdmin,
    @Param("placement") placement: string,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: SetHomeEntryStatusDto
  ) {
    return this.homeService
      .setAdminHomeEntryStatus(request.admin.adminId, operationId, parsePlacement(placement), body)
      .then(result => ok(result));
  }

  @Post(":placement/image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeEntryItemModel, "上传或替换首页快捷入口图片")
  uploadHomeEntryImage(
    @Req() request: RequestWithAdmin,
    @Param("placement") placement: string,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateHomeEntryImageDto,
    @UploadedFile() file?: { buffer?: Buffer; size?: number }
  ) {
    return this.homeService
      .uploadAdminHomeEntryImage(request.admin.adminId, operationId, parsePlacement(placement), body.expectedVersion, file)
      .then(result => ok(result));
  }

  @Delete(":placement/image")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminHomeEntryItemModel, "清空首页快捷入口图片")
  clearHomeEntryImage(
    @Req() request: RequestWithAdmin,
    @Param("placement") placement: string,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateHomeEntryImageDto
  ) {
    return this.homeService
      .clearAdminHomeEntryImage(request.admin.adminId, operationId, parsePlacement(placement), body.expectedVersion)
      .then(result => ok(result));
  }
}
