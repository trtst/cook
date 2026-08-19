/**
 * 认证域接口。
 *
 * 这里只保留两类能力：
 * 1. 登录、刷新这类直接面向认证服务的请求。
 * 2. 会话续期节流逻辑。
 *
 * 页面不应该自己决定何时刷新 token，也不应该自己拼认证域名。
 */
import { cfg } from "@/config";
import { post, type IsoDateTime } from "./http";
import type { SessionUser } from "./user";
import { useSessionStore } from "@/stores/session";

/**
 * 提前刷新窗口。
 * token 距过期时间进入这个窗口后，允许触发后台续期，避免请求发出时才发现已过期。
 */
const refreshWindowMs = 3 * 24 * 60 * 60 * 1000;

/**
 * 刷新检查节流间隔。
 * 这个值用于控制频率，避免每次页面显示或接口调用都重复打 refresh 接口。
 */
const refreshGapMs = 10 * 60 * 1000;

export interface PasswordLoginRequest {
	phone: string;
	password: string;
}

export interface CodeLoginRequest {
	phone: string;
	code: string;
}

export type AuthCodeScene = "LOGIN" | "BIND_PHONE";

export interface SendAuthCodeRequest {
	phone: string;
	scene: AuthCodeScene;
}

export interface WechatLoginRequest {
	code: string;
}

export interface AuthSessionResult {
	token: string;
	expiresAt: IsoDateTime;
	user: SessionUser;
}

export interface PasswordLoginResult extends AuthSessionResult {}

export interface CodeLoginResult extends AuthSessionResult {}

export interface WechatLoginResult extends AuthSessionResult {}

export interface RefreshSessionResult {
	token: string;
	expiresAt: IsoDateTime;
}

export const authApi = {
	/**
	 * 登录接口显式关闭鉴权头。
	 * 这不是可选优化，而是契约要求：登录前没有稳定 user token 可带。
	 */
	loginWithPassword(body: PasswordLoginRequest) {
		return post<PasswordLoginResult>(`${cfg.authDomain}/api/auth/login`, body, { auth: false });
	},
	/**
	 * 统一验证码发送入口。
	 * 后端通过 `scene` 区分登录验证码和绑定手机号验证码。
	 */
	sendCode(body: SendAuthCodeRequest) {
		return post<null>(`${cfg.authDomain}/api/auth/code-send`, body, { auth: false });
	},
	/**
	 * 验证码登录。
	 * 发码与登录提交分离，便于后端替换真实短信通道。
	 */
	loginWithCode(body: CodeLoginRequest) {
		return post<CodeLoginResult>(`${cfg.authDomain}/api/auth/code-login`, body, { auth: false });
	},
	/**
	 * 小程序微信登录。
	 * 前端先通过 `uni.login` 获取一次性 code，再交给服务端换取业务会话。
	 */
	loginWithWechat(body: WechatLoginRequest) {
		return post<WechatLoginResult>(`${cfg.authDomain}/api/auth/wechat-login`, body, { auth: false });
	},
	/**
	 * 刷新当前 user token。
	 * 只服务会话续期，不返回完整用户资料；用户资料统一再走 `/users/me`。
	 */
	refreshSession() {
		return post<RefreshSessionResult>(`${cfg.authDomain}/api/auth/refresh`);
	}
};

let refreshPromise: Promise<void> | null = null;

/**
 * 只在接近过期时刷新，避免把 refresh 变成常规高频请求。
 */
function shouldRefresh(expiresAt: string) {
	const expiresTime = Date.parse(expiresAt);
	return Number.isFinite(expiresTime) && expiresTime - Date.now() <= refreshWindowMs;
}

/**
 * 通过本地时间戳做最小节流，减少同一前台会话里的重复刷新尝试。
 */
function canCheckRefresh(lastCheckedAt: number) {
	return Date.now() - lastCheckedAt >= refreshGapMs;
}

/**
 * 会话续期入口。
 *
 * 关键约束：
 * 1. 单飞：`refreshPromise` 保证同一时间最多只有一个 refresh 请求在跑。
 * 2. 节流：距离上次检查太近时直接返回，保护性能和认证服务。
 * 3. 幂等：并发调用会等待同一个 Promise，不会重复覆盖本地 session。
 */
export async function refreshSessionIfNeeded() {
	const sessionStore = useSessionStore();

	if (!sessionStore.token || !shouldRefresh(sessionStore.expiresAt) || !canCheckRefresh(sessionStore.refreshCheckedAt)) return;

	refreshPromise ??= authApi
		.refreshSession()
		.then(async session => {
			await sessionStore.setSession({
				token: session.token,
				uid: sessionStore.uid,
				expiresAt: session.expiresAt
			});
		})
		.finally(async () => {
			await useSessionStore().markRefreshChecked();
			refreshPromise = null;
		});

	await refreshPromise;
}
