import { Controller, Get, Inject, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ok } from "../../common/api-response";
import { ApiOkModel, AppConfigResponseModel } from "../../contracts/openapi";
import { AppConfigService } from "./app-config.service";

@ApiTags("app-config")
@Controller("app-config")
export class AppConfigController {
  constructor(@Inject(AppConfigService) private readonly appConfigService: AppConfigService) {}

  @Get()
  @ApiOkModel(AppConfigResponseModel, "公开启动配置，仅返回客户端启动必需字段")
  getPublicConfig(@Req() request: { protocol?: string; get?: (name: string) => string | undefined }) {
    return this.appConfigService.getPublicConfig(request).then(result => ok(result));
  }
}
