import { Controller, Get, Inject, NotFoundException, Param, Req, Res } from "@nestjs/common";
import { ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { HomeFeatureBoardPlacement } from "@prisma/client";
import type { Writable } from "node:stream";
import { ok } from "../../common/api-response";
import { ApiOkModel, HomeEntriesResponseModel } from "../../contracts/openapi";
import { HomeService } from "./home.service";

type HomeAssetRequest = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

type ResponseLike = Writable & {
  setHeader: (name: string, value: string | number) => void;
};

function parsePlacement(placement: string): HomeFeatureBoardPlacement {
  if (
    placement === "MAIN" ||
    placement === "SIDE_TOP" ||
    placement === "SIDE_BOTTOM" ||
    placement === "QUICK_1" ||
    placement === "QUICK_2" ||
    placement === "QUICK_3" ||
    placement === "QUICK_4"
  ) {
    return placement;
  }
  throw new NotFoundException("首页快捷入口图片不存在");
}

@ApiTags("home")
@Controller()
export class HomeController {
  constructor(@Inject(HomeService) private readonly homeService: HomeService) {}

  @Get("home-entries")
  @ApiOkModel(HomeEntriesResponseModel, "读取小程序首页快捷入口")
  getHomeEntries(@Req() request: HomeAssetRequest) {
    return this.homeService.getHomeEntries(request).then(result => ok(result));
  }
}

@ApiExcludeController()
@Controller("public-assets")
export class HomePublicAssetsController {
  constructor(@Inject(HomeService) private readonly homeService: HomeService) {}

  @Get("home-entries/:placement")
  async getHomeEntryImage(@Param("placement") placement: string, @Res() response: ResponseLike) {
    const asset = await this.homeService.getHomeEntryImageAsset(parsePlacement(placement));
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }
}
