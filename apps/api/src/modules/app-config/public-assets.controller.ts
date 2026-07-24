import { Controller, Get, Inject, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Writable } from "node:stream";
import { AppConfigService } from "./app-config.service";

type ResponseLike = Writable & {
  setHeader: (name: string, value: string | number) => void;
};

@ApiExcludeController()
@Controller("public-assets")
export class PublicAssetsController {
  constructor(@Inject(AppConfigService) private readonly appConfigService: AppConfigService) {}

  @Get("login-image")
  async getLoginImage(@Res() response: ResponseLike) {
    const asset = await this.appConfigService.getLoginImageAsset();
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Length", asset.stat.size);
    response.setHeader("Cache-Control", "public, max-age=300");
    asset.stream.pipe(response);
  }
}
