import { Controller, Get, Inject, NotFoundException, Param, ParseIntPipe, Req, Res } from "@nestjs/common";
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
@Controller("static/uploads")
export class HomeTopicPublicAssetsController {
  constructor(@Inject(HomeTopicService) private readonly homeTopicService: HomeTopicService) {}

  @Get("home-topics/:fileName")
  async getTopicFile(@Param("fileName") fileName: string, @Res() response: ResponseLike) {
    const match = /^(\d+)(?:\.(?:jpg|png|webp))?$/i.exec(fileName);
    if (!match) {
      throw new NotFoundException("本周灵感专题封面图不存在");
    }
    const asset = await this.homeTopicService.getTopicImage(Number(match[1]));
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }
}
