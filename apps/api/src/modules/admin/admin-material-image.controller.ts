import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { Writable } from "node:stream";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import { ok } from "../../common/api-response";
import type { RequestWithAdmin } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import { AdminMaterialImageQueryDto, UploadAdminMaterialImageDto } from "../../contracts/dtos";
import { AdminMaterialImageDeleteResultModel, AdminMaterialImageItemModel, ApiOkModel, ApiOkPage } from "../../contracts/openapi";
import { AdminMaterialImageService } from "./admin-material-image.service";

type AssetRequest = RequestWithAdmin & {
  protocol?: string;
  get?: (name: string) => string | undefined;
};
type ResponseLike = Writable & {
  setHeader: (name: string, value: string | number) => void;
};

@ApiTags("admin-material")
@Controller("admin/material-images")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
@ApiBearerAuth("AdminBearerAuth")
export class AdminMaterialImageController {
  constructor(@Inject(AdminMaterialImageService) private readonly materialImageService: AdminMaterialImageService) {}

  @Get()
  @ApiOkPage(AdminMaterialImageItemModel, "后台图片素材列表")
  listImages(@Req() request: AssetRequest, @Query() query: AdminMaterialImageQueryDto) {
    return this.materialImageService.listImages(request, query.page, query.pageSize).then(result => ok(result));
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminMaterialImageItemModel, "上传后台图片素材")
  uploadImage(
    @Req() request: AssetRequest,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UploadAdminMaterialImageDto,
    @UploadedFile() file?: { buffer?: Buffer; size?: number }
  ) {
    if (!file) {
      throw new BadRequestException("请上传图片");
    }
    return this.materialImageService.uploadImage(request, request.admin.adminId, operationId, body.note, file).then(result => ok(result));
  }

  @Delete(":imageId")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminMaterialImageDeleteResultModel, "删除后台图片素材")
  deleteImage(@Req() request: RequestWithAdmin, @ReadIdempotencyKey() operationId: string, @Param("imageId", ParseIntPipe) imageId: number) {
    return this.materialImageService.deleteImage(request.admin.adminId, operationId, imageId).then(result => ok(result));
  }
}

@ApiExcludeController()
@Controller("static/uploads/material-store")
export class AdminMaterialImagePublicController {
  constructor(@Inject(AdminMaterialImageService) private readonly materialImageService: AdminMaterialImageService) {}

  @Get(":fileName")
  async getImage(@Param("fileName") fileName: string, @Res() response: ResponseLike) {
    const asset = await this.materialImageService.getImageAsset(fileName);
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }
}
