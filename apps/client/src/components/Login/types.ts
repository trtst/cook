import type { WechatLoginResult } from "@next-meal/api-client";

export interface LoginSuccessPayload {
  session: WechatLoginResult;
}
