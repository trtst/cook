import { BadRequestException, Controller, Get, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiExtraModels, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import type { RequestWithAdmin } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { AdminSystemDataCollectionCountModel, AdminSystemDataExportModel, AdminSystemDataImportResultModel, AdminSystemDataPreviewModel, ApiOkModel } from "../../contracts/openapi";
import { AdminSystemDataService } from "./admin-system-data.service";
import { recipeJsonUploadLimits, recipeJsonUploadStorage } from "./recipe-import-upload";

function parsePackage(files?: Array<{ buffer?: Buffer }>) {
  const buffer = files?.[0]?.buffer;
  if (!buffer) throw new BadRequestException("请上传 JSON 数据包");
  try {
    return JSON.parse(buffer.toString("utf8")) as unknown;
  } catch {
    throw new BadRequestException("JSON 数据包格式无效");
  }
}

@ApiTags("admin")
@Controller("admin/system-data")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
@ApiBearerAuth("AdminBearerAuth")
export class AdminSystemDataController {
  constructor(private readonly systemDataService: AdminSystemDataService) {}

  @Get("export")
  @ApiOkModel(AdminSystemDataExportModel, "导出系统基础数据同步包")
  exportPackage() {
    return this.systemDataService.exportPackage().then(result => ok(result));
  }

  @Post("preview")
  @ApiExtraModels(AdminSystemDataCollectionCountModel, AdminSystemDataPreviewModel)
  @UseInterceptors(FilesInterceptor("file", 1, { storage: recipeJsonUploadStorage, limits: recipeJsonUploadLimits }))
  @ApiBody({ schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } })
  @ApiConsumes("multipart/form-data")
  @ApiOkModel(AdminSystemDataPreviewModel, "校验系统基础数据同步包并返回导入预览")
  previewImport(@UploadedFiles() files?: Array<{ buffer?: Buffer }>) {
    return this.systemDataService.previewImport(parsePackage(files)).then(result => ok(result));
  }

  @Post("import")
  @ApiExtraModels(AdminSystemDataCollectionCountModel, AdminSystemDataImportResultModel)
  @UseInterceptors(FilesInterceptor("file", 1, { storage: recipeJsonUploadStorage, limits: recipeJsonUploadLimits }))
  @ApiIdempotencyKey()
  @ApiBody({ schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } })
  @ApiConsumes("multipart/form-data")
  @ApiOkModel(AdminSystemDataImportResultModel, "事务性导入系统基础数据同步包")
  importPackage(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @UploadedFiles() files?: Array<{ buffer?: Buffer }>
  ) {
    return this.systemDataService.importPackage(parsePackage(files), operationId, request.admin.adminId).then(result => ok(result));
  }
}
