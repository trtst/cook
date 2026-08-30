import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { buildFridgeExpiryReminderMessage, type SubscribeMessagePayload } from "./subscribe-message";

const WECHAT_ACCESS_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const WECHAT_SUBSCRIBE_SEND_URL = "https://api.weixin.qq.com/cgi-bin/message/subscribe/send";
const WECHAT_REQUEST_TIMEOUT_MS = 5000;
const ACCESS_TOKEN_BUFFER_MS = 60_000;

interface AccessTokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  errcode?: unknown;
}

interface SubscribeSendResponse {
  errcode?: unknown;
}

@Injectable()
export class WechatSubscribeService {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async sendFridgeExpiryReminder(input: {
    userId: number;
    ingredientName: string;
    expireAt: string;
    daysLeft: number;
    storedDays: number;
    tipText: string;
    pagePath: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        openid: true
      }
    });
    const openid = user?.openid?.trim() || "";
    if (!openid) {
      throw new ServiceUnavailableException("当前用户未绑定微信身份");
    }

    const payload = buildFridgeExpiryReminderMessage({
      openid,
      ingredientName: input.ingredientName,
      expireAt: input.expireAt,
      daysLeft: input.daysLeft,
      storedDays: input.storedDays,
      tipText: input.tipText,
      pagePath: input.pagePath
    });
    await this.sendSubscribeMessage(payload);
    return {
      sentAt: new Date().toISOString()
    };
  }

  private async sendSubscribeMessage(payload: SubscribeMessagePayload) {
    const accessToken = await this.getAccessToken();
    const result = await this.fetchWechatJson<SubscribeSendResponse>(`${WECHAT_SUBSCRIBE_SEND_URL}?access_token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      body: JSON.stringify({
        touser: payload.touser,
        template_id: payload.templateId,
        page: payload.page,
        data: payload.data
      })
    });
    if (typeof result.errcode === "number" && result.errcode !== 0) {
      throw new ServiceUnavailableException("微信订阅消息发送失败");
    }
  }

  private async getAccessToken() {
    const now = Date.now();
    if (this.accessToken && now < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    const appId = process.env.WECHAT_APP_ID?.trim();
    const appSecret = process.env.WECHAT_APP_SECRET?.trim();
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException("微信订阅消息暂不可用");
    }

    const query = new URLSearchParams({
      grant_type: "client_credential",
      appid: appId,
      secret: appSecret
    });
    const result = await this.fetchWechatJson<AccessTokenResponse>(`${WECHAT_ACCESS_TOKEN_URL}?${query.toString()}`, {
      method: "GET"
    });
    const accessToken = typeof result.access_token === "string" ? result.access_token.trim() : "";
    const expiresIn = typeof result.expires_in === "number" ? result.expires_in : 0;
    if (!accessToken || expiresIn <= 0 || (typeof result.errcode === "number" && result.errcode !== 0)) {
      throw new ServiceUnavailableException("微信订阅消息暂不可用");
    }

    this.accessToken = accessToken;
    this.accessTokenExpiresAt = now + expiresIn * 1000 - ACCESS_TOKEN_BUFFER_MS;
    return accessToken;
  }

  private async fetchWechatJson<T>(url: string, options: { method: "GET" | "POST"; body?: string }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WECHAT_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: options.method,
        headers: options.body ? { "content-type": "application/json" } : undefined,
        body: options.body,
        signal: controller.signal
      });
      if (!response.ok) {
        throw new ServiceUnavailableException("微信订阅消息暂不可用");
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException("微信订阅消息暂不可用");
    } finally {
      clearTimeout(timeout);
    }
  }
}
