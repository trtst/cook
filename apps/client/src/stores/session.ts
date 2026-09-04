import { defineStore } from "pinia";
import { APP_STORAGE_KEYS, uniPlatform } from "@/platform/uni";

export type AuthStatus = "guest" | "authenticated" | "refreshing" | "expired" | "blocked";

export interface SessionUserSnapshot {
	uid: number;
	nickname: string | null;
	avatarUrl: string | null;
	phone: string | null;
}

export interface SessionSnapshot {
	accessToken?: string;
	refreshToken?: string;
	uid?: number;
	user?: SessionUserSnapshot | null;
	expiresAt: string;
	refreshExpiresAt?: string;
	refreshCheckedAt?: number;
	/** The old key is accepted only for the current local-storage migration. */
	token?: string;
}

function isExpired(expiresAt: string) {
	const expiresTime = Date.parse(expiresAt);
	return Number.isNaN(expiresTime) || expiresTime <= Date.now();
}

function resolveUid(uid?: number) {
	return typeof uid === "number" && uid > 0 ? uid : 0;
}

function accessTokenOf(snapshot: SessionSnapshot) {
	return snapshot.accessToken?.trim() || snapshot.token?.trim() || "";
}

export const useSessionStore = defineStore("session", {
	state: () => ({
		accessToken: "",
		/** Kept as a synchronized compatibility alias for existing page automators. */
		token: "",
		refreshToken: "",
		user: null as SessionUserSnapshot | null,
		authStatus: "guest" as AuthStatus,
		logoutExplicit: false,
		uid: 0,
		expiresAt: "",
		refreshExpiresAt: "",
			refreshCheckedAt: 0,
			refreshing: false,
			wechatSessionId: "",
			restored: false
	}),
	getters: {
		isLoggedIn: state => Boolean(state.accessToken) && state.authStatus !== "guest"
	},
		actions: {
			async restore() {
				const snapshot = await uniPlatform.storage.get<SessionSnapshot>(APP_STORAGE_KEYS.session);
				const explicitLogout = (await uniPlatform.storage.get<boolean>(APP_STORAGE_KEYS.logoutExplicit)) === true;
				this.logoutExplicit = explicitLogout;
				const accessToken = snapshot ? accessTokenOf(snapshot) : "";
			const refreshToken = snapshot?.refreshToken?.trim() || "";

			if (!accessToken && !refreshToken) {
				this.authStatus = "guest";
				this.restored = true;
				return;
			}

			if (refreshToken && snapshot?.refreshExpiresAt && isExpired(snapshot.refreshExpiresAt)) {
				await this.clearSession();
				this.restored = true;
				return;
			}

			this.accessToken = accessToken;
			this.token = accessToken;
			this.refreshToken = refreshToken;
			this.user = snapshot?.user ?? null;
			this.uid = resolveUid(snapshot?.uid ?? snapshot?.user?.uid);
			this.expiresAt = snapshot?.expiresAt ?? "";
			this.refreshExpiresAt = snapshot?.refreshExpiresAt ?? "";
			this.refreshCheckedAt = snapshot?.refreshCheckedAt ?? 0;
			this.logoutExplicit = explicitLogout;
			this.authStatus = accessToken && isExpired(this.expiresAt) ? "expired" : "authenticated";
			this.restored = true;
		},

		async setSession(snapshot: SessionSnapshot) {
			const accessToken = accessTokenOf(snapshot);
			this.accessToken = accessToken;
			this.token = accessToken;
			this.refreshToken = snapshot.refreshToken?.trim() ?? this.refreshToken;
			this.user = snapshot.user ?? this.user;
			this.uid = resolveUid(snapshot.uid ?? snapshot.user?.uid ?? this.uid);
			this.expiresAt = snapshot.expiresAt;
			this.refreshExpiresAt = snapshot.refreshExpiresAt ?? this.refreshExpiresAt;
			this.refreshCheckedAt = snapshot.refreshCheckedAt ?? this.refreshCheckedAt;
			this.wechatSessionId = "";
			this.logoutExplicit = false;
			await uniPlatform.storage.remove(APP_STORAGE_KEYS.logoutExplicit);
			this.authStatus = "authenticated";
			await this.persist();
		},

		async markRefreshing() {
			if (!this.accessToken) return;
			this.refreshing = true;
			this.authStatus = "refreshing";
		},

		async markRefreshChecked() {
			if (!this.accessToken) return;
			this.refreshCheckedAt = Date.now();
			this.refreshing = false;
			if (this.authStatus === "refreshing" || this.authStatus === "expired") this.authStatus = "authenticated";
			await this.persist();
		},

		async clearSession(options: { explicitLogout?: boolean } = {}) {
			this.accessToken = "";
			this.token = "";
			this.refreshToken = "";
			this.user = null;
			this.uid = 0;
			this.expiresAt = "";
			this.refreshExpiresAt = "";
			this.refreshCheckedAt = 0;
			this.refreshing = false;
			this.wechatSessionId = "";
			this.authStatus = "guest";
			this.logoutExplicit = options.explicitLogout === true;
			await uniPlatform.storage.remove(APP_STORAGE_KEYS.session);
			if (this.logoutExplicit) {
				await uniPlatform.storage.set(APP_STORAGE_KEYS.logoutExplicit, true);
			} else {
				await uniPlatform.storage.remove(APP_STORAGE_KEYS.logoutExplicit);
			}
		},

		setWechatSessionId(wechatSessionId: string) {
			this.wechatSessionId = wechatSessionId.trim();
			this.authStatus = "guest";
		},

		markBlocked() {
			this.authStatus = "blocked";
		},

		async persist() {
			if (!this.accessToken && !this.refreshToken) {
				await uniPlatform.storage.remove(APP_STORAGE_KEYS.session);
				return;
			}

			await uniPlatform.storage.set(APP_STORAGE_KEYS.session, {
				accessToken: this.accessToken,
				refreshToken: this.refreshToken,
				uid: this.uid,
				user: this.user,
				expiresAt: this.expiresAt,
				refreshExpiresAt: this.refreshExpiresAt,
				refreshCheckedAt: this.refreshCheckedAt
			} satisfies SessionSnapshot);
		}
	}
});
