import { Body, Controller, Delete, Get, Inject, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import type { RequestWithAdmin } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { UpdateLoginImageDto } from "../../contracts/dtos";
import { ApiOkModel, AppConfigResponseModel } from "../../contracts/openapi";
import { AppConfigService } from "./app-config.service";

type AdminAssetRequest = RequestWithAdmin & {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

@ApiTags("admin-app-config")
@Controller("admin/app-config")
@UseGuards(AdminAuthGuard)
@ApiBearerAuth("AdminBearerAuth")
export class AdminAppConfigController {
  constructor(@Inject(AppConfigService) private readonly appConfigService: AppConfigService) {}

  @Get()
  @ApiOkModel(AppConfigResponseModel, "读取后台公共配置")
  getConfig(@Req() request: { protocol?: string; get?: (name: string) => string | undefined }) {
    return this.appConfigService.getPublicConfig(request).then(result => ok(result));
  }

  @Post("login-image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiIdempotencyKey()
  @ApiOkModel(AppConfigResponseModel, "上传或替换登录弹窗图片")
  uploadLoginImage(
    @Req() request: AdminAssetRequest,
    @ReadIdempotencyKey() operationId: string,
    @Body() _body: UpdateLoginImageDto,
    @UploadedFile() file?: { buffer?: Buffer; size?: number }
  ) {
    return this.appConfigService.saveLoginImage(request, request.admin.adminId, operationId, file).then(result => ok(result));
  }

  @Delete("login-image")
  @ApiIdempotencyKey()
  @ApiOkModel(AppConfigResponseModel, "清空登录弹窗图片")
  clearLoginImage(
    @Req() request: AdminAssetRequest,
    @ReadIdempotencyKey() operationId: string,
    @Body() _body: UpdateLoginImageDto
  ) {
    return this.appConfigService.clearLoginImage(request, request.admin.adminId, operationId).then(result => ok(result));
  }
}
