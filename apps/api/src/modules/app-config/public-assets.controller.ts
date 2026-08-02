import { Controller, Get, Inject, NotFoundException, Param, ParseIntPipe, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Writable } from "node:stream";
import { PrismaService } from "../../common/prisma.service";
import { IngredientImageService } from "../admin/ingredient-image.service";
import { AppConfigService } from "./app-config.service";
import { MedalImageService, type MedalImageType } from "../user/medal-image.service";

type ResponseLike = Writable & {
  setHeader: (name: string, value: string | number) => void;
};

@ApiExcludeController()
@Controller("public-assets")
export class PublicAssetsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfigService) private readonly appConfigService: AppConfigService,
    @Inject(IngredientImageService) private readonly ingredientImageService: IngredientImageService,
    @Inject(MedalImageService) private readonly medalImageService: MedalImageService
  ) {}

  @Get("login-image")
  async getLoginImage(@Res() response: ResponseLike) {
    const asset = await this.appConfigService.getLoginImageAsset();
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }

  @Get("ingredients/:ingredientId")
  async getIngredientImage(@Param("ingredientId", ParseIntPipe) ingredientId: number, @Res() response: ResponseLike) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: {
        id: ingredientId,
        ownerId: null,
        status: "ACTIVE",
        imageUpdatedAt: {
          not: null
        }
      },
      select: { id: true }
    });
    if (!ingredient) {
      throw new NotFoundException("食材图片不存在");
    }
    const asset = await this.ingredientImageService.getImageAsset(ingredientId);
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }

  @Get("medals/:templateId")
  async getMedalImage(@Param("templateId", ParseIntPipe) templateId: number, @Res() response: ResponseLike) {
    const template = await this.prisma.medalTemplate.findFirst({
      where: {
        id: templateId,
        earnedImageUpdatedAt: {
          not: null
        }
      },
      select: { id: true }
    });
    if (!template) {
      throw new NotFoundException("勋章图片不存在");
    }
    const asset = await this.medalImageService.getImageAsset(templateId, "earned");
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }

  @Get("medals/:templateId/:imageType")
  async getMedalImageByType(
    @Param("templateId", ParseIntPipe) templateId: number,
    @Param("imageType") imageType: MedalImageType,
    @Res() response: ResponseLike
  ) {
    if (imageType !== "earned" && imageType !== "locked") {
      throw new NotFoundException("勋章图片不存在");
    }
    const template = await this.prisma.medalTemplate.findFirst({
      where:
        imageType === "earned"
          ? {
              id: templateId,
              earnedImageUpdatedAt: {
                not: null
              }
            }
          : {
              id: templateId,
              lockedImageUpdatedAt: {
                not: null
              }
            },
      select: { id: true }
    });
    if (!template) {
      throw new NotFoundException("勋章图片不存在");
    }
    const asset = await this.medalImageService.getImageAsset(templateId, imageType);
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }
}
