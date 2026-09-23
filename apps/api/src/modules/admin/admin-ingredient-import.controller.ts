import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import type { RequestWithAdmin } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import {
  ImportIngredientImportItemDto,
  DeleteIngredientImportItemDto,
  IngredientImportItemQueryDto,
  IngredientImportJobQueryDto,
  UpdateIngredientImportItemDto
} from "../../contracts/dtos";
import {
  AdminDeleteIngredientImportJobResultModel,
  AdminDeleteIngredientImportItemResultModel,
  IngredientImportItemDetailModel,
  IngredientImportJobDetailModel,
  IngredientImportJobModel,
  ApiOkModel,
  ApiOkPage
} from "../../contracts/openapi";
import type { IngredientImportBody, IngredientImportNutritionBody } from "../../contracts/types";
import { AdminIngredientImportService } from "./admin-ingredient-import.service";
import { recipeJsonUploadLimits, recipeJsonUploadStorage } from "./recipe-import-upload";

function toIngredientImportBody(body: UpdateIngredientImportItemDto["ingredientBody"]): IngredientImportBody {
  return {
    name: body.name,
    aliases: body.aliases,
    categoryCode: body.categoryCode,
    defaultUnitName: body.defaultUnitName,
    proteinType: body.proteinType as IngredientImportBody["proteinType"],
    isStaple: body.isStaple,
    isSpicyIngredient: body.isSpicyIngredient,
    imageUrl: body.imageUrl,
    nutrition: body.nutrition
      ? {
          sourceVersion: body.nutrition.sourceVersion,
          foodCode: body.nutrition.foodCode,
          foodName: body.nutrition.foodName,
          matchType: body.nutrition.matchType as IngredientImportNutritionBody["matchType"],
          confidence: body.nutrition.confidence,
          conversions: body.nutrition.conversions.map(item => ({ unitName: item.unitName, gramsPerUnit: item.gramsPerUnit }))
        }
      : null
  };
}

@ApiTags("admin")
@Controller("admin")
export class AdminIngredientImportController {
  constructor(private readonly ingredientImportService: AdminIngredientImportService) {}

  @Post("ingredient-import-jobs/json")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @UseInterceptors(FilesInterceptor("files", recipeJsonUploadLimits.files, { storage: recipeJsonUploadStorage, limits: recipeJsonUploadLimits }))
  @ApiConsumes("multipart/form-data")
  @ApiOkModel(IngredientImportJobModel, "后台创建 ingredient.import.v1 JSON 导入任务")
  createIngredientImportJsonJob(
    @Req() request: RequestWithAdmin,
    @ReadIdempotencyKey() operationId: string,
    @UploadedFiles() files?: Array<{ originalname?: string; buffer?: Buffer; size?: number }>
  ) {
    return this.ingredientImportService.createImportJob(files ?? [], request.admin.adminId, operationId).then(result => ok(result));
  }

  @Get("ingredient-import-jobs")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkPage(IngredientImportJobModel, "后台食材导入任务列表")
  listIngredientImportJobs(@Req() request: RequestWithAdmin, @Query() query: IngredientImportJobQueryDto) {
    return this.ingredientImportService.listImportJobs(query.page, query.pageSize, query.status, request.admin.adminId).then(result => ok(result));
  }

  @Get("ingredient-import-jobs/:jobId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(IngredientImportJobDetailModel, "后台食材导入任务详情")
  getIngredientImportJobDetail(
    @Req() request: RequestWithAdmin,
    @Param("jobId", ParseIntPipe) jobId: number,
    @Query() query: IngredientImportItemQueryDto
  ) {
    return this.ingredientImportService
      .getImportJobDetail(jobId, query.page, query.pageSize, query.status, request.admin.adminId)
      .then(result => ok(result));
  }

  @Delete("ingredient-import-jobs/:jobId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminDeleteIngredientImportJobResultModel, "后台删除食材导入任务")
  deleteIngredientImportJob(
    @Req() request: RequestWithAdmin,
    @Param("jobId", ParseIntPipe) jobId: number,
    @ReadIdempotencyKey() operationId: string
  ) {
    return this.ingredientImportService.deleteImportJob(jobId, operationId, request.admin.adminId).then(result => ok(result));
  }

  @Get("ingredient-import-items/:itemId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiOkModel(IngredientImportItemDetailModel, "后台食材导入条目详情")
  getIngredientImportItemDetail(@Req() request: RequestWithAdmin, @Param("itemId", ParseIntPipe) itemId: number) {
    return this.ingredientImportService.getImportItemDetail(itemId, request.admin.adminId).then(result => ok(result));
  }

  @Put("ingredient-import-items/:itemId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(IngredientImportItemDetailModel, "后台保存食材导入条目修正")
  updateIngredientImportItem(
    @Req() request: RequestWithAdmin,
    @Param("itemId", ParseIntPipe) itemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: UpdateIngredientImportItemDto
  ) {
    return this.ingredientImportService
      .updateImportItem(itemId, { operationId, expectedVersion: body.expectedVersion, ingredientBody: toIngredientImportBody(body.ingredientBody) }, request.admin.adminId)
      .then(result => ok(result));
  }

  @Post("ingredient-import-items/:itemId/import")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(IngredientImportItemDetailModel, "后台确认导入食材条目")
  importIngredientImportItem(
    @Req() request: RequestWithAdmin,
    @Param("itemId", ParseIntPipe) itemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: ImportIngredientImportItemDto
  ) {
    return this.ingredientImportService
      .importItem(itemId, { operationId, expectedVersion: body.expectedVersion }, request.admin.adminId)
      .then(result => ok(result));
  }

  @Delete("ingredient-import-items/:itemId")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminDeleteIngredientImportItemResultModel, "后台删除食材导入条目及其可安全删除的待审核食材")
  deleteIngredientImportItem(
    @Req() request: RequestWithAdmin,
    @Param("itemId", ParseIntPipe) itemId: number,
    @ReadIdempotencyKey() operationId: string,
    @Body() body: DeleteIngredientImportItemDto
  ) {
    return this.ingredientImportService
      .deleteImportItem(itemId, { operationId, expectedVersion: body.expectedVersion }, request.admin.adminId)
      .then(result => ok(result));
  }
}
