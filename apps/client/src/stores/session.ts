import { defineStore } from "pinia";
import { APP_STORAGE_KEYS, uniPlatform } from "@/platform/uni";

// Snapshot persisted in local storage for session restore on app relaunch.
interface SessionSnapshot {
	token: string;
	uid?: number;
	userId?: string;
	expiresAt: string;
	refreshCheckedAt?: number;
}

// Expired local sessions are discarded before they re-enter app state.
function isExpired(expiresAt: string) {
	const expiresTime = Date.parse(expiresAt);
	return Number.isNaN(expiresTime) || expiresTime <= Date.now();
}

// The app treats invalid or missing uid as logged-out shape `0`.
function resolveUid(uid?: number) {
	return typeof uid === "number" && uid > 0 ? uid : 0;
}

// Session store owns login token, uid, expiry, restore status,
// and the local persistence rules for those fields.
export const useSessionStore = defineStore("session", {
	state: () => ({
		// Current access token returned by the login flow.
		token: "",
		// User-facing numeric uid used by client APIs and page logic.
		uid: 0,
		// Absolute expiry time returned by the server.
		expiresAt: "",
		// Timestamp of the last refresh check to throttle silent refresh.
		refreshCheckedAt: 0,
		// Tells the app whether restore has already finished at least once.
		restored: false
	}),
	getters: {
		isLoggedIn: (state) => Boolean(state.token)
	},
	actions: {
		// Restores session state from local storage during app startup.
		// Invalid or expired snapshots are cleared instead of being reused.
		async restore() {
			const snapshot = await uniPlatform.storage.get<SessionSnapshot>(APP_STORAGE_KEYS.session);

			if (snapshot?.token) {
				if (isExpired(snapshot.expiresAt)) {
					await uniPlatform.storage.remove(APP_STORAGE_KEYS.session);
					this.restored = true;
					return;
				}

				this.token = snapshot.token;
				this.uid = resolveUid(snapshot.uid);
				this.expiresAt = snapshot.expiresAt;
				this.refreshCheckedAt = snapshot.refreshCheckedAt ?? 0;
			}

			this.restored = true;
		},
		// Writes the current session into both Pinia state and local storage.
		async setSession(snapshot: SessionSnapshot) {
			this.token = snapshot.token;
			this.uid = resolveUid(snapshot.uid);
			this.expiresAt = snapshot.expiresAt;
			this.refreshCheckedAt = snapshot.refreshCheckedAt ?? this.refreshCheckedAt;
			await uniPlatform.storage.set(APP_STORAGE_KEYS.session, {
				...snapshot,
				refreshCheckedAt: this.refreshCheckedAt
			});
		},
		// Records that the current token has already passed a refresh check.
		// This avoids calling the refresh path on every page entry.
		async markRefreshChecked() {
			if (!this.token) return;

			this.refreshCheckedAt = Date.now();
			await uniPlatform.storage.set(APP_STORAGE_KEYS.session, {
				token: this.token,
				uid: this.uid,
				expiresAt: this.expiresAt,
				refreshCheckedAt: this.refreshCheckedAt
			});
		},
		// Clears all in-memory and persisted session fields.
		async clearSession() {
			this.token = "";
			this.uid = 0;
			this.expiresAt = "";
			this.refreshCheckedAt = 0;
			await uniPlatform.storage.remove(APP_STORAGE_KEYS.session);
		}
	}
});
