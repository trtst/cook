import { Controller, Get, Inject, Param, ParseIntPipe, Req, Res } from "@nestjs/common";
import { ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { Writable } from "node:stream";
import { ok } from "../../common/api-response";
import { ApiOkModel, HomeTopicCurrentResponseModel, HomeTopicDetailResponseModel } from "../../contracts/openapi";
import { HomeTopicService } from "./home-topic.service";

type TopicRequest = {
  protocol?: string;
  get?: (name: string) => string | undefined;
  headers?: {
    authorization?: string;
  };
};

type ResponseLike = Writable & {
  setHeader: (name: string, value: string | number) => void;
};

@ApiTags("home-topics")
@Controller()
export class HomeTopicController {
  constructor(@Inject(HomeTopicService) private readonly homeTopicService: HomeTopicService) {}

  @Get("home-topics/current")
  @ApiOkModel(HomeTopicCurrentResponseModel, "读取当前本周灵感专题")
  getCurrentTopic(@Req() request: TopicRequest) {
    return this.homeTopicService.getCurrentTopic(request).then(result => ok(result));
  }

  @Get("home-topics/:topicId")
  @ApiOkModel(HomeTopicDetailResponseModel, "读取指定本周灵感专题")
  getTopic(@Req() request: TopicRequest, @Param("topicId", ParseIntPipe) topicId: number) {
    return this.homeTopicService.getTopic(request, topicId).then(result => ok(result));
  }
}

@ApiExcludeController()
@Controller("public-assets")
export class HomeTopicPublicAssetsController {
  constructor(@Inject(HomeTopicService) private readonly homeTopicService: HomeTopicService) {}

  @Get("home-topics/:topicId")
  async getTopicImage(@Param("topicId", ParseIntPipe) topicId: number, @Res() response: ResponseLike) {
    const asset = await this.homeTopicService.getTopicImage(topicId);
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }
}
