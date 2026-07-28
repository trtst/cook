import { Controller, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Writable } from "node:stream";
import { PrismaService } from "../../common/prisma.service";
import { IngredientImageService } from "../admin/ingredient-image.service";
import { AppConfigService } from "./app-config.service";

type ResponseLike = Writable & {
  setHeader: (name: string, value: string | number) => void;
};

@ApiExcludeController()
@Controller("public-assets")
export class PublicAssetsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfigService) private readonly appConfigService: AppConfigService,
    @Inject(IngredientImageService) private readonly ingredientImageService: IngredientImageService
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
  async getIngredientImage(@Param("ingredientId", new ParseUUIDPipe({ version: "4" })) ingredientId: string, @Res() response: ResponseLike) {
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
}
