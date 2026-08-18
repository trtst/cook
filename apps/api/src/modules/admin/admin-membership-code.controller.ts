import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import type { RequestWithAdmin } from "../../common/auth-context";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import {
  AdminMembershipCodeBatchQueryDto,
  AdminMembershipCodeQueryDto,
  CreateAdminMembershipCodeBatchDto,
  GenerateAdminMembershipCodesDto,
  SetAdminMembershipCodeBatchStatusDto
} from "../../contracts/dtos";
import {
  AdminGenerateMembershipCodesResultModel,
  AdminMembershipCodeBatchItemModel,
  AdminMembershipCodeItemModel,
  AdminMembershipSkuListResponseModel,
  ApiOkModel,
  ApiOkPage
} from "../../contracts/openapi";
import { AdminMembershipCodeService } from "./admin-membership-code.service";

@ApiTags("admin-membership-codes")
@Controller("admin/membership-codes")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
@ApiBearerAuth("AdminBearerAuth")
export class AdminMembershipCodeController {
  constructor(@Inject(AdminMembershipCodeService) private readonly adminMembershipCodeService: AdminMembershipCodeService) {}

  @Get("skus")
  @ApiOkModel(AdminMembershipSkuListResponseModel, "读取固定会员 SKU 目录")
  listSkus() {
    return this.adminMembershipCodeService.listSkus().then(result => ok(result));
  }

  @Get("batches")
  @ApiOkPage(AdminMembershipCodeBatchItemModel, "分页读取兑换码批次")
  listBatches(@Query() query: AdminMembershipCodeBatchQueryDto) {
    return this.adminMembershipCodeService
      .listBatches(query.page, query.pageSize, query.keyword, query.skuCode, query.redeemEnabled)
      .then(result => ok(result));
  }

  @Post("batches")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminMembershipCodeBatchItemModel, "创建兑换码批次")
  createBatch(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: CreateAdminMembershipCodeBatchDto
  ) {
    return this.adminMembershipCodeService.createBatch(request.admin.adminId, operationId, body).then(result => ok(result));
  }

  @Post("batches/:batchId/status")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminMembershipCodeBatchItemModel, "切换兑换码批次上下架")
  setBatchStatus(
    @Req() request: RequestWithAdmin,
    @Param("batchId", ParseIntPipe) batchId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: SetAdminMembershipCodeBatchStatusDto
  ) {
    return this.adminMembershipCodeService
      .setBatchStatus(request.admin.adminId, batchId, operationId, body)
      .then(result => ok(result));
  }

  @Post("batches/:batchId/generate")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminGenerateMembershipCodesResultModel, "按批次批量生成会员兑换码")
  generateCodes(
    @Req() request: RequestWithAdmin,
    @Param("batchId", ParseIntPipe) batchId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: GenerateAdminMembershipCodesDto
  ) {
    return this.adminMembershipCodeService
      .generateCodes(request.admin.adminId, batchId, operationId, body)
      .then(result => ok(result));
  }

  @Get()
  @ApiOkPage(AdminMembershipCodeItemModel, "分页读取兑换码状态")
  listCodes(@Query() query: AdminMembershipCodeQueryDto) {
    return this.adminMembershipCodeService
      .listCodes(query.page, query.pageSize, query.batchId, query.status, query.code)
      .then(result => ok(result));
  }

  @Post(":codeId/disable")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminMembershipCodeItemModel, "停用未使用兑换码")
  disableCode(
    @Req() request: RequestWithAdmin,
    @Param("codeId", ParseIntPipe) codeId: number,
    @ReadIdempotencyKey() operationId: string
  ) {
    return this.adminMembershipCodeService.disableCode(request.admin.adminId, codeId, operationId).then(result => ok(result));
  }
}
