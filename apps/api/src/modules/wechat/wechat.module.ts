import { Module } from "@nestjs/common";
import { WechatSubscribeService } from "./wechat-subscribe.service";
import { WechatMiniCodeService } from "./wechat-mini-code.service";

@Module({
  providers: [WechatSubscribeService, WechatMiniCodeService],
  exports: [WechatSubscribeService, WechatMiniCodeService]
})
export class WechatModule {}
