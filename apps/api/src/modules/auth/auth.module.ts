import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthRiskService } from "./auth-risk.service";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./auth-session.service";
import { SMS_GATEWAY, SMS_HTTP_CLIENT, AliyunSmsGateway, type SmsHttpClient } from "./sms-auth.service";
import { WECHAT_HTTP_CLIENT, WechatAuthService, type WechatHttpClient } from "./wechat-auth.service";
import { SmsAuthService } from "./sms-auth.service";

const fetchWechat: WechatHttpClient = (input, init) => fetch(input, init);
const fetchSms: SmsHttpClient = (input, init) => fetch(input, init);

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    AuthRiskService,
    WechatAuthService,
    SmsAuthService,
    { provide: WECHAT_HTTP_CLIENT, useValue: fetchWechat },
    { provide: SMS_HTTP_CLIENT, useValue: fetchSms },
    {
      provide: SMS_GATEWAY,
      useFactory: (http: SmsHttpClient) => new AliyunSmsGateway(http),
      inject: [SMS_HTTP_CLIENT]
    }
  ],
  exports: [AuthService]
})
export class AuthModule {}
