import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";

const WECHAT_ACCESS_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const WECHAT_MINI_CODE_URL = "https://api.weixin.qq.com/wxa/getwxacodeunlimit";
const WECHAT_REQUEST_TIMEOUT_MS = 5000;
const ACCESS_TOKEN_BUFFER_MS = 60_000;
const MAX_MINI_CODE_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

interface AccessTokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  errcode?: unknown;
}

@Injectable()
export class WechatMiniCodeService {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  async createMemoryShareCode(shareToken: string) {
    if (!/^[A-Za-z0-9_-]{1,32}$/u.test(shareToken)) {
      throw new BadRequestException("分享标识无效");
    }
    const accessToken = await this.getAccessToken();
    const environment = this.miniCodeEnvironment();
    const response = await this.fetchWechat(`${WECHAT_MINI_CODE_URL}?access_token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scene: shareToken,
        page: "pages_share/memory/index",
        check_path: false,
        env_version: environment,
        width: 430
      })
    });
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!response.ok || contentType.includes("application/json")) {
      throw new ServiceUnavailableException("小程序码生成失败，请稍后重试");
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_MINI_CODE_BYTES) {
      throw new ServiceUnavailableException("小程序码生成失败，请稍后重试");
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await response.arrayBuffer());
    } catch {
      throw new ServiceUnavailableException("小程序码生成失败，请稍后重试");
    }
    if (buffer.length < PNG_SIGNATURE.length || buffer.length > MAX_MINI_CODE_BYTES || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw new ServiceUnavailableException("小程序码生成失败，请稍后重试");
    }
    return buffer;
  }

  private miniCodeEnvironment(): "release" | "trial" | "develop" {
    const value = process.env.WECHAT_MINI_CODE_ENV_VERSION?.trim();
    if (value === "trial" || value === "develop") return value;
    return "release";
  }

  private async getAccessToken() {
    const now = Date.now();
    if (this.accessToken && now < this.accessTokenExpiresAt) return this.accessToken;
    const appId = process.env.WECHAT_APP_ID?.trim();
    const appSecret = process.env.WECHAT_APP_SECRET?.trim();
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException("小程序码暂不可用");
    }
    const query = new URLSearchParams({ grant_type: "client_credential", appid: appId, secret: appSecret });
    const response = await this.fetchWechat(`${WECHAT_ACCESS_TOKEN_URL}?${query.toString()}`, { method: "GET" });
    if (!response.ok) throw new ServiceUnavailableException("小程序码暂不可用");
    let result: AccessTokenResponse;
    try {
      result = (await response.json()) as AccessTokenResponse;
    } catch {
      throw new ServiceUnavailableException("小程序码暂不可用");
    }
    const accessToken = typeof result.access_token === "string" ? result.access_token.trim() : "";
    const expiresIn = typeof result.expires_in === "number" ? result.expires_in : 0;
    if (!accessToken || expiresIn <= 0 || (typeof result.errcode === "number" && result.errcode !== 0)) {
      throw new ServiceUnavailableException("小程序码暂不可用");
    }
    this.accessToken = accessToken;
    this.accessTokenExpiresAt = now + expiresIn * 1000 - ACCESS_TOKEN_BUFFER_MS;
    return accessToken;
  }

  private async fetchWechat(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WECHAT_REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch {
      throw new ServiceUnavailableException("小程序码暂不可用");
    } finally {
      clearTimeout(timeout);
    }
  }
}
