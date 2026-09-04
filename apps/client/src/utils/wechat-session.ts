import type { AuthSessionResult, WechatSessionRequest, WechatSessionResult } from "@/apis/auth";
import { uniPlatform } from "@/platform/uni";

interface WechatSessionStore {
	logoutExplicit: boolean;
	setWechatSessionId(wechatSessionId: string): void;
	markBlocked(): void;
	setSession(snapshot: {
		accessToken: string;
		refreshToken: string;
		uid: number;
		user: AuthSessionResult["user"];
		expiresAt: string;
		refreshExpiresAt: string;
	}): Promise<void>;
}

interface WechatSessionClient {
	wechatSession(body: WechatSessionRequest): Promise<WechatSessionResult>;
}

export async function restoreWechatSession(store: WechatSessionStore, client?: WechatSessionClient) {
	if (store.logoutExplicit || uniPlatform.system.getRuntimeChannel() !== "mini_program") return false;

	try {
		const login = await uniPlatform.auth.login();
		const sessionClient = client ?? (await import("@/apis/auth")).authApi;
		const result = await sessionClient.wechatSession({
			code: login.code,
			deviceId: uniPlatform.auth.getDeviceId()
		});

		if (result.status === "BLOCKED") {
			store.markBlocked();
			return false;
		}

		if (result.status === "UNBOUND") {
			store.setWechatSessionId(result.wechatSessionId);
			return false;
		}

		await store.setSession({
			accessToken: result.session.accessToken,
			refreshToken: result.session.refreshToken,
			uid: result.session.user.uid,
			user: result.session.user,
			expiresAt: result.session.accessExpiresAt,
			refreshExpiresAt: result.session.refreshExpiresAt
		});
		return true;
	} catch {
		return false;
	}
}
