import { Controller, Get, Inject, Param, ParseIntPipe, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { Writable } from "node:stream";
import { ok } from "../../common/api-response";
import type { RequestWithUser } from "../../common/auth-context";
import { ApiIdempotencyKey, ReadIdempotencyKey } from "../../common/idempotency-key";
import { UserAuthGuard } from "../../common/user-auth.guard";
import { ApiOkModel, TableTopicDetailResponseModel, TableTopicListResponseModel } from "../../contracts/openapi";
import { TableTopicService } from "./table-topic.service";

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

@ApiTags("table-topics")
@Controller()
export class TableTopicController {
  constructor(@Inject(TableTopicService) private readonly tableTopicService: TableTopicService) {}

  @Get("table-topics")
  @ApiOkModel(TableTopicListResponseModel, "读取餐桌话题列表")
  listTopics(@Req() request: TopicRequest) {
    return this.tableTopicService.listTopics(request).then(result => ok(result));
  }

  @Get("table-topics/:topicId")
  @ApiOkModel(TableTopicDetailResponseModel, "读取餐桌话题详情")
  getTopic(@Req() request: TopicRequest, @Param("topicId", ParseIntPipe) topicId: number) {
    return this.tableTopicService.getTopic(request, topicId).then(result => ok(result));
  }

  @Post("table-topics/:topicId/participate")
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth("UserBearerAuth")
  @ApiIdempotencyKey()
  @ApiOkModel(TableTopicDetailResponseModel, "参与一个餐桌话题")
  participate(
    @Req() request: RequestWithUser & TopicRequest,
    @Param("topicId", ParseIntPipe) topicId: number,
    @ReadIdempotencyKey() operationId: string
  ) {
    return this.tableTopicService.participate(request, request.user.userId, topicId, operationId).then(result => ok(result));
  }
}

@ApiExcludeController()
@Controller("public-assets")
export class TableTopicPublicAssetsController {
  constructor(@Inject(TableTopicService) private readonly tableTopicService: TableTopicService) {}

  @Get("table-topics/:topicId")
  async getTopicImage(@Param("topicId", ParseIntPipe) topicId: number, @Res() response: ResponseLike) {
    const asset = await this.tableTopicService.getTopicImage(topicId);
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }
}
