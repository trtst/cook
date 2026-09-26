import { Module } from "@nestjs/common";
import { WechatMiniCodeService } from "./wechat-mini-code.service";

@Module({
  providers: [WechatMiniCodeService],
  exports: [WechatMiniCodeService]
})
export class WechatModule {}
