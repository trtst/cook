/**
 * 认证域请求和会话续期入口。
 * 页面只提交明确的认证字段，access/refresh token 的持久化和轮换由 session store 与 request layer 负责。
 */
import { cfg } from "@/config";
import { useSessionStore } from "@/stores/session";
import { get, post, refreshAccessToken, type IsoDateTime } from "./http";
import type { SessionUserSnapshot } from "@/stores/session";

export interface AuthSessionResult {
	accessToken: string;
	refreshToken: string;
	accessExpiresAt: IsoDateTime;
	refreshExpiresAt: IsoDateTime;
	user: SessionUserSnapshot;
}

export interface WechatSessionRequest {
	code: string;
	deviceId: string;
}

export type WechatSessionResult =
	| { status: "BOUND"; session: AuthSessionResult; wechatSessionId: null; retryAfterSeconds: number | null }
	| { status: "UNBOUND"; session: null; wechatSessionId: string; retryAfterSeconds: number | null }
	| { status: "BLOCKED"; session: null; wechatSessionId: null; retryAfterSeconds: number | null };

export interface WechatPhoneLoginRequest {
	wechatSessionId: string;
	phoneCode: string;
	deviceId: string;
}

export interface SmsSendRequest {
	phone: string;
	deviceId: string;
}

export interface SmsSendResult {
	cooldownSeconds: number;
}

export interface SmsLoginRequest {
	phone: string;
	code: string;
	deviceId: string;
	wechatSessionId?: string;
}

export interface PasswordLoginRequest {
	phone: string;
	password: string;
	deviceId: string;
}

export interface SetPasswordRequest {
	password: string;
}

export interface ChangePasswordRequest {
	currentPassword: string;
	newPassword: string;
}

export interface RefreshSessionRequest {
	refreshToken: string;
	deviceId: string;
}

export interface AuthMeResponse extends SessionUserSnapshot {
	id: number;
	phone: string | null;
	status: string;
}

export const authApi = {
	wechatSession(body: WechatSessionRequest) {
		return post<WechatSessionResult>(`${cfg.authDomain}/api/auth/wechat/session`, body, { auth: false });
	},
	loginWithWechatPhone(body: WechatPhoneLoginRequest) {
		return post<AuthSessionResult>(`${cfg.authDomain}/api/auth/wechat/phone-login`, body, { auth: false });
	},
	sendSmsCode(body: SmsSendRequest) {
		return post<SmsSendResult>(`${cfg.authDomain}/api/auth/sms/send`, { ...body, scene: "LOGIN" }, { auth: false });
	},
	loginWithSms(body: SmsLoginRequest) {
		return post<AuthSessionResult>(`${cfg.authDomain}/api/auth/sms/login`, body, { auth: false });
	},
	loginWithPassword(body: PasswordLoginRequest) {
		return post<AuthSessionResult>(`${cfg.authDomain}/api/auth/password/login`, body, { auth: false });
	},
	setPassword(body: SetPasswordRequest) {
		return post<{ changedAt: IsoDateTime }>(`${cfg.authDomain}/api/auth/password/set`, body);
	},
	changePassword(body: ChangePasswordRequest) {
		return post<{ changedAt: IsoDateTime }>(`${cfg.authDomain}/api/auth/password/change`, body);
	},
	refresh(body: RefreshSessionRequest) {
		return post<AuthSessionResult>(`${cfg.authDomain}/api/auth/refresh`, body, { auth: false });
	},
	logout(body: RefreshSessionRequest) {
		return post<null>(`${cfg.authDomain}/api/auth/logout`, body, { auth: false });
	},
	getMe() {
		return get<AuthMeResponse>(`${cfg.authDomain}/api/auth/me`);
	}
};

const refreshWindowMs = 3 * 24 * 60 * 60 * 1000;
const refreshGapMs = 10 * 60 * 1000;

function shouldRefresh(expiresAt: string) {
	const expiresTime = Date.parse(expiresAt);
	return Number.isFinite(expiresTime) && expiresTime - Date.now() <= refreshWindowMs;
}

function canCheckRefresh(lastCheckedAt: number) {
	return Date.now() - lastCheckedAt >= refreshGapMs;
}

export async function refreshSessionIfNeeded() {
	const sessionStore = useSessionStore();
	if (
		!sessionStore.accessToken ||
		!sessionStore.refreshToken ||
		!shouldRefresh(sessionStore.expiresAt) ||
		!canCheckRefresh(sessionStore.refreshCheckedAt) ||
		sessionStore.logoutExplicit
	) {
		return;
	}

	await refreshAccessToken();
}
