import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { Writable } from "node:stream";
import { ok } from "../../common/api-response";
import { AdminAuthGuard } from "../../common/admin-auth.guard";
import type { RequestWithAdmin } from "../../common/auth-context";
import { ApiIdempotencyKey } from "../../common/idempotency-key";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import { UploadAdminRecipeImageDto } from "../../contracts/dtos";
import { AdminRecipeImageUploadResultModel, ApiOkModel } from "../../contracts/openapi";
import { AdminRecipeImageService } from "./admin-recipe-image.service";

type AssetRequest = RequestWithAdmin & { protocol?: string; get?: (name: string) => string | undefined };

type ResponseLike = Writable & {
  setHeader: (name: string, value: string | number) => void;
};

@ApiTags("admin")
@Controller("admin")
export class AdminRecipeImageController {
  constructor(@Inject(AdminRecipeImageService) private readonly adminRecipeImageService: AdminRecipeImageService) {}

  @Post("recipe-images")
  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @ApiBearerAuth("AdminBearerAuth")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiIdempotencyKey()
  @ApiOkModel(AdminRecipeImageUploadResultModel, "后台上传系统菜谱临时图片")
  uploadRecipeImage(
    @Req() request: AssetRequest,
    @Body() body: UploadAdminRecipeImageDto,
    @UploadedFile() file?: { buffer?: Buffer; size?: number }
  ) {
    if (!file) {
      throw new BadRequestException("请上传图片");
    }
    return this.adminRecipeImageService.stageTempImage(request, body.scene, file).then(result => ok(result));
  }
}

@ApiExcludeController()
@Controller("public-assets/admin-recipe-images")
export class AdminRecipeImagePublicController {
  constructor(@Inject(AdminRecipeImageService) private readonly adminRecipeImageService: AdminRecipeImageService) {}

  @Get(":fileName")
  async getPublicImage(@Param("fileName") fileName: string, @Res() response: ResponseLike) {
    const asset = await this.adminRecipeImageService.getPublicImageAsset(fileName);
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }
}
