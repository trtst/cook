import { Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import type { RequestWithAdmin } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import { AdminImageGenerationApplyDto, AdminImageGenerationQueryDto, AdminImageGenerationSettingsDto, AdminImageGenerationTargetDto } from "../../contracts/dtos";
import { ApiOkModel, ApiOkPage, AdminImageGenerationApplyResultModel, AdminImageGenerationCandidateModel, AdminImageGenerationDeleteResultModel, AdminImageGenerationSettingsModel, AdminImageGenerationTargetModel } from "../../contracts/openapi";
import { AdminImageGenerationService } from "./admin-image-generation.service";

@ApiTags("admin-image-generation")
@Controller("admin/image-generation")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
@ApiBearerAuth("AdminBearerAuth")
export class AdminImageGenerationController {
  constructor(@Inject(AdminImageGenerationService) private readonly service: AdminImageGenerationService) {}

  @Get("settings")
  @ApiOkModel(AdminImageGenerationSettingsModel, "读取生图关键词")
  getSettings() { return this.service.getSettings().then(result => ok(result)); }

  @Put("settings")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminImageGenerationSettingsModel, "保存食材和食谱的共享生图关键词")
  saveSettings(@Body() body: AdminImageGenerationSettingsDto, @ReadIdempotencyKey() operationId: string, @Req() request: RequestWithAdmin) {
    return this.service.saveSettings(body, operationId, request.admin.adminId).then(result => ok(result));
  }

  @Get("targets")
  @ApiOkPage(AdminImageGenerationTargetModel, "按食材或食谱查询可预览生图目标")
  listTargets(@Query() query: AdminImageGenerationQueryDto) {
    return this.service.listTargets({ ...query, missingOnly: query.missingOnly ?? true }).then(result => ok(result));
  }

  @Post("generate")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminImageGenerationCandidateModel, "调用火山方舟生成一张临时候选图")
  generate(@Body() body: AdminImageGenerationTargetDto, @ReadIdempotencyKey() operationId: string, @Req() request: RequestWithAdmin) {
    return this.service.generate(body, operationId, request.admin.adminId).then(result => ok(result));
  }

  @Delete("candidates/:candidateId")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminImageGenerationDeleteResultModel, "删除一张临时候选图")
  deleteCandidate(@Param("candidateId", ParseIntPipe) candidateId: number, @ReadIdempotencyKey() operationId: string, @Req() request: RequestWithAdmin) {
    return this.service.deleteCandidate(candidateId, operationId, request.admin.adminId).then(result => ok(result));
  }

  @Post("candidates/:candidateId/apply")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminImageGenerationApplyResultModel, "将候选图替换到对应图片位置")
  applyCandidate(
    @Param("candidateId", ParseIntPipe) candidateId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: AdminImageGenerationApplyDto,
    @Req() request: RequestWithAdmin & { protocol?: string; get?: (name: string) => string | undefined }
  ) {
    return this.service.applyCandidate(request, candidateId, operationId, body.expectedVersion, request.admin.adminId).then(result => ok(result));
  }
}
