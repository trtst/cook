import { Controller, Get, Inject, NotFoundException, Param, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { HomeFeatureBoardPlacement } from "@prisma/client";
import type { Writable } from "node:stream";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { UserAuthGuard } from "../../common/user-auth.guard";
import {
  ApiOkModel,
  ApiOkNullableModel,
  HomeEntriesResponseModel,
  HomeFridgeRecipesResponseModel,
  HomeNextMealStateModel,
  HomeRecentArrangementModel,
  HomeWeekOverviewModel
} from "../../contracts/openapi";
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

  @Get("home/recent-arrangement")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkNullableModel(HomeRecentArrangementModel, "读取首页最近安排单卡摘要")
  getRecentArrangement(@Req() request: RequestWithUser) {
    return this.homeService.getRecentArrangement(request.user.userId).then(result => ok(result));
  }

  @Get("home/next-meal")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(HomeNextMealStateModel, "读取首页下一顿状态卡")
  getNextMealState(@Req() request: RequestWithUser) {
    return this.homeService.getNextMealState(request.user.userId).then(result => ok(result));
  }

  @Get("home/week-overview")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(HomeWeekOverviewModel, "读取首页这周吃饭安排主卡")
  getWeekOverview(@Req() request: RequestWithUser) {
    return this.homeService.getWeekOverview(request.user.userId).then(result => ok(result));
  }

  @Get("home/fridge-recipes")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiOkModel(HomeFridgeRecipesResponseModel, "读取首页冰箱匹配推荐")
  getFridgeRecipes(@Req() request: RequestWithUser) {
    return this.homeService.getFridgeRecipes(request.user.userId).then(result => ok(result));
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
