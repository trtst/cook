import { APP_VERSION } from "./app";

export type CookFrom = "mini_program" | "h5" | "pc" | "ios" | "android" | "harmony";

/**
 * 从完整 API 地址里反推出纯域名。
 *
 * 当前默认 `VITE_API_BASE_URL` 形如 `http://host:port/api`。
 * 业务 API 模块现在直接拼完整地址，例如 `${cfg.domain}/api/auth/login`，
 * 所以这里需要一个稳定的“去掉 /api 后缀”的默认域名。
 */
const defaultApiUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api.trtst.com/api";
const defaultDomain = defaultApiUrl.replace(/\/api\/?$/i, "");

export const cfg = {
	apiUrl: defaultApiUrl,
	domain: import.meta.env.VITE_API_DOMAIN ?? defaultDomain,
	/**
	 * 默认所有业务都走 `domain`。
	 * 只有像认证网关这类确实可能单独拆出的场景，才额外提供专用覆盖项。
	 */
	authDomain: import.meta.env.VITE_AUTH_DOMAIN ?? import.meta.env.VITE_API_DOMAIN ?? defaultDomain,
	cookFrom: import.meta.env.VITE_COOK_FROM,
	cookVersion: import.meta.env.VITE_COOK_VERSION ?? APP_VERSION
};
