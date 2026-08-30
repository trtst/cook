import { Module } from "@nestjs/common";
import { WechatSubscribeService } from "./wechat-subscribe.service";

@Module({
  providers: [WechatSubscribeService],
  exports: [WechatSubscribeService]
})
export class WechatModule {}
