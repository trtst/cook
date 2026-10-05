import { BadRequestException, Body, Controller, Get, Post, Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiExtraModels, ApiOkResponse, ApiProduces, ApiTags } from "@nestjs/swagger";
import type { Writable } from "node:stream";
import { ok } from "../../common/api-response";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import type { RequestWithAdmin } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { AdminSystemDataCleanupEffectModel, AdminSystemDataCollectionCountModel, AdminSystemDataDependencyModel, AdminSystemDataImportResultModel, AdminSystemDataPreviewModel, ApiOkModel } from "../../contracts/openapi";
import { AdminSystemDataService } from "./admin-system-data.service";
const maxSnapshotBytes = 200 * 1024 * 1024;
const snapshotUploadOptions = { limits: { fileSize: maxSnapshotBytes, files: 1 } };

type ResponseLike = Writable & {
  setHeader: (name: string, value: string | number) => void;
};

type SnapshotRequest = RequestWithAdmin & {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

function parsePackage(files?: Array<{ buffer?: Buffer }>) {
  const buffer = files?.[0]?.buffer;
  if (!buffer) throw new BadRequestException("请上传 ZIP 快照包");
  return buffer;
}

@ApiTags("admin")
@Controller("admin/system-data")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
@ApiBearerAuth("AdminBearerAuth")
export class AdminSystemDataController {
  constructor(private readonly systemDataService: AdminSystemDataService) {}

  @Get("export")
  @ApiProduces("application/zip")
  @ApiOkResponse({ description: "下载系统数据 ZIP 快照", content: { "application/zip": { schema: { type: "string", format: "binary" } } } })
  async exportPackage(@Req() request: SnapshotRequest, @Query("categories") categories: string, @Res() response: ResponseLike) {
    const selected = typeof categories === "string" ? categories.split(",").filter(Boolean) : [];
    const archive = await this.systemDataService.exportPackage(selected, request);
    response.setHeader("Content-Type", "application/zip");
    response.setHeader("Content-Disposition", 'attachment; filename="cook-data-snapshot.zip"');
    response.setHeader("Content-Length", archive.length);
    response.end(archive);
  }

  @Post("preview")
  @ApiExtraModels(AdminSystemDataCleanupEffectModel, AdminSystemDataCollectionCountModel, AdminSystemDataDependencyModel, AdminSystemDataPreviewModel)
  @UseInterceptors(FilesInterceptor("file", 1, snapshotUploadOptions))
  @ApiBody({ schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } })
  @ApiConsumes("multipart/form-data")
  @ApiOkModel(AdminSystemDataPreviewModel, "校验所选类别快照并返回导入预览")
  previewImport(@UploadedFiles() files?: Array<{ buffer?: Buffer }>) {
    return this.systemDataService.previewImport(parsePackage(files)).then(result => ok(result));
  }

  @Post("import")
  @ApiExtraModels(AdminSystemDataCollectionCountModel, AdminSystemDataImportResultModel)
  @UseInterceptors(FilesInterceptor("file", 1, snapshotUploadOptions))
  @ApiIdempotencyKey()
  @ApiBody({ schema: { type: "object", required: ["file", "previewFingerprint"], properties: { file: { type: "string", format: "binary" }, previewFingerprint: { type: "string", pattern: "^[a-f0-9]{64}$" } } } })
  @ApiConsumes("multipart/form-data")
  @ApiOkModel(AdminSystemDataImportResultModel, "事务性替换快照中所选类别")
  importPackage(
    @Req() request: SnapshotRequest,
    @ReadIdempotencyKey() operationId: string,
    @UploadedFiles() files?: Array<{ buffer?: Buffer }>,
    @Body("previewFingerprint") previewFingerprint?: string
  ) {
    if (typeof previewFingerprint !== "string") throw new BadRequestException("请先预览当前快照再导入");
    return this.systemDataService.importPackage(parsePackage(files), operationId, request.admin.adminId, previewFingerprint, request).then(result => ok(result));
  }
}
