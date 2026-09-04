import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

export const WECHAT_HTTP_CLIENT = Symbol("WECHAT_HTTP_CLIENT");
export type WechatHttpClient = (input: string | URL, init?: RequestInit) => Promise<Response>;

const CODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";
const ACCESS_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const PHONE_NUMBER_URL = "https://api.weixin.qq.com/wxa/business/getuserphonenumber";
const REQUEST_TIMEOUT_MS = 5000;
const ACCESS_TOKEN_BUFFER_MS = 60_000;

interface Code2SessionResponse {
  openid?: unknown;
  unionid?: unknown;
  session_key?: unknown;
  errcode?: unknown;
}

interface AccessTokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  errcode?: unknown;
}

interface PhoneNumberResponse {
  phone_info?: {
    phoneNumber?: unknown;
  };
  errcode?: unknown;
}

export interface WechatIdentitySession {
  appid: string;
  openid: string;
  unionid: string | null;
  sessionKey: string;
}

@Injectable()
export class WechatAuthService {
  private accessToken = "";
  private accessTokenExpiresAt = 0;

  constructor(@Inject(WECHAT_HTTP_CLIENT) private readonly http: WechatHttpClient) {}

  async login(code: string): Promise<WechatIdentitySession> {
    const appid = process.env.WECHAT_APP_ID?.trim();
    const secret = process.env.WECHAT_APP_SECRET?.trim();
    if (!appid || !secret) throw new ServiceUnavailableException("微信登录暂不可用");

    const payload = await this.fetchJson<Code2SessionResponse>(
      `${CODE2SESSION_URL}?${new URLSearchParams({
        appid,
        secret,
        js_code: code,
        grant_type: "authorization_code"
      }).toString()}`
    );

    const openid = typeof payload.openid === "string" ? payload.openid.trim() : "";
    const sessionKey = typeof payload.session_key === "string" ? payload.session_key.trim() : "";
    if (!openid || !sessionKey || (typeof payload.errcode === "number" && payload.errcode !== 0)) {
      throw new BadRequestException("微信登录失败，请重试");
    }

    const unionid = typeof payload.unionid === "string" ? payload.unionid.trim() : "";
    return {
      appid,
      openid,
      unionid: unionid || null,
      sessionKey
    };
  }

  async getPhoneNumber(phoneCode: string) {
    const accessToken = await this.getAccessToken();
    const payload = await this.fetchJson<PhoneNumberResponse>(`${PHONE_NUMBER_URL}?access_token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      body: JSON.stringify({ code: phoneCode }),
      headers: { "content-type": "application/json" }
    });
    const phone = typeof payload.phone_info?.phoneNumber === "string" ? payload.phone_info.phoneNumber.trim() : "";
    if (!phone || (typeof payload.errcode === "number" && payload.errcode !== 0)) {
      throw new BadRequestException("微信手机号授权失败，请重试");
    }

    return { phone };
  }

  private async getAccessToken() {
    const now = Date.now();
    if (this.accessToken && now < this.accessTokenExpiresAt) return this.accessToken;

    const appid = process.env.WECHAT_APP_ID?.trim();
    const secret = process.env.WECHAT_APP_SECRET?.trim();
    if (!appid || !secret) throw new ServiceUnavailableException("微信登录暂不可用");

    const payload = await this.fetchJson<AccessTokenResponse>(
      `${ACCESS_TOKEN_URL}?${new URLSearchParams({
        grant_type: "client_credential",
        appid,
        secret
      }).toString()}`
    );
    const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 0;
    if (!accessToken || expiresIn <= 0 || (typeof payload.errcode === "number" && payload.errcode !== 0)) {
      throw new ServiceUnavailableException("微信登录暂不可用");
    }

    this.accessToken = accessToken;
    this.accessTokenExpiresAt = now + expiresIn * 1000 - ACCESS_TOKEN_BUFFER_MS;
    return accessToken;
  }

  private async fetchJson<T>(url: string, init?: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.http(url, { ...init, signal: controller.signal });
      if (!response.ok) throw new ServiceUnavailableException("微信登录暂不可用");
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("微信登录暂不可用");
    } finally {
      clearTimeout(timeout);
    }
  }
}
