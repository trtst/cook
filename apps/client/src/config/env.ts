import { APP_VERSION } from "./app";
import { ENV_PROFILES, type AppMode } from "./env_profiles";

export type CookFrom = "mini_program" | "h5" | "pc" | "ios" | "android" | "harmony";

/**
 * 请求地址切换统一收口在配置层。
 * 如果要在开发环境和正式环境间切换，只改这里的 `mode`；
 * 不再让 `VITE_API_BASE_URL / VITE_API_DOMAIN / VITE_AUTH_DOMAIN` 成为第二套真相来源。
 */
const mode: AppMode = "prod";       // "dev" | "prod"
const profile = ENV_PROFILES[mode];

export const cfg = {
	mode,
	apiUrl: profile.apiUrl,
	domain: profile.domain,
	siteUrl: profile.siteUrl,
	/**
	 * 默认所有业务都走 `domain`。
	 * 只有像认证网关这类确实可能单独拆出的场景，才额外提供专用覆盖项。
	 */
	authDomain: profile.authDomain,
	cookFrom: import.meta.env.VITE_COOK_FROM,
	cookVersion: import.meta.env.VITE_COOK_VERSION ?? APP_VERSION
};
