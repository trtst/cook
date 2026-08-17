import { BadRequestException, Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiConsumes, ApiExcludeController, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Writable } from "node:stream";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { UserAuthGuard } from "../../common/user-auth.guard";
import { UploadRecipeImageDto } from "../../contracts/dtos";
import { ApiOkModel, UploadImageResultModel } from "../../contracts/openapi";
import { UploadService } from "./upload.service";

type ResponseLike = Writable & {
  setHeader: (name: string, value: string | number) => void;
};

@ApiTags("uploads")
@Controller()
export class UploadController {
  constructor(@Inject(UploadService) private readonly uploadService: UploadService) {}

  @Post("uploads/images")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiIdempotencyKey()
  @ApiOkModel(UploadImageResultModel, "上传或替换草稿里的菜谱图片")
  uploadRecipeImage(
    @Body() body: UploadRecipeImageDto,
    @Req() request: RequestWithUser & { protocol?: string; get?: (name: string) => string | undefined },
    @ReadIdempotencyKey() operationId: string,
    @UploadedFile() file?: { buffer?: Buffer; size?: number }
  ) {
    if (!file) {
      throw new BadRequestException("请上传图片");
    }
    return this.uploadService
      .uploadRecipeImage(request, request.user.userId, operationId, body.draftId, body.scene, body.slotKey, file)
      .then(result => ok(result));
  }
}

@ApiExcludeController()
@Controller("public-assets")
export class UploadPublicController {
  constructor(@Inject(UploadService) private readonly uploadService: UploadService) {}

  @Get("recipe-images/:publicId")
  async getRecipeImage(@Param("publicId") publicId: string, @Res() response: ResponseLike) {
    const asset = await this.uploadService.getRecipeImageAsset(publicId);
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }

  @Get("dining-group-covers/:diningGroupId")
  async getDiningGroupCover(@Param("diningGroupId", ParseIntPipe) diningGroupId: number, @Res() response: ResponseLike) {
    const asset = await this.uploadService.getDiningGroupCoverAsset(diningGroupId);
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }

  @Get("dining-event-covers/:eventId")
  async getDiningEventCover(@Param("eventId", ParseIntPipe) eventId: number, @Res() response: ResponseLike) {
    const asset = await this.uploadService.getDiningEventCoverAsset(eventId);
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }
}
