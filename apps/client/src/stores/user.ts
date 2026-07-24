import { defineStore } from "pinia";
import type { MeResponse } from "@/apis/user";
import { APP_STORAGE_KEYS, uniPlatform } from "@/platform/uni";
import { THEME_SKIN_OPTIONS, type ThemeSkin } from "@/stores/settings";
import { isMaybeString, isRecord } from "@/utils/utils";

// Cached `/users/me` payload saved locally for faster cold start restore.
interface UserProfileSnapshot {
  profile?: unknown;
  cachedAt?: number;
}

// Guards the cached payload before it is accepted back into typed store state.
// The check stays local because it validates this exact MeResponse shape.
function isUserProfile(profile: unknown): profile is MeResponse {
  if (!isRecord(profile) || typeof profile.uid !== "number") return false;
	if (!isMaybeString(profile.nickname) || !isMaybeString(profile.avatarUrl) || !isMaybeString(profile.phone)) return false;
	if (!isRecord(profile.display) || !isRecord(profile.membership)) return false;

	return (
		isMaybeString(profile.display.profileBackgroundUrl) &&
		isMaybeString(profile.display.homeBackgroundUrl) &&
		typeof profile.display.canUseProfileBackground === "boolean" &&
		typeof profile.display.canUseHomeBackground === "boolean" &&
		["FREE", "PLUS", "PRO", "ULTRA"].includes(String(profile.membership.tier)) &&
		isMaybeString(profile.membership.validUntil)
	);
}

// User store owns the current user profile and its short-lived local cache.
// It does not own login token state, which stays in session store.
export const useUserStore = defineStore("user", {
	state: () => ({
		// Last accepted `/users/me` response.
		profile: null as MeResponse | null,
		// Local cache timestamp used to enforce max-age restore rules.
		profileCachedAt: 0
	}),
	getters: {
		// Membership activation is not finalized yet in client state.
		// Keep the getter shape stable for pages, but do not infer real entitlement here.
		isMembershipActive: () => false,
		// Current theme entitlements are still front-end placeholders based on theme options.
		themeSkinEntitlements: () => THEME_SKIN_OPTIONS.map((option) => option.value),
		// Theme usage checks currently reuse the declared skin options list.
		canUseThemeSkin: () => (themeSkin: ThemeSkin) => THEME_SKIN_OPTIONS.some((option) => option.value === themeSkin)
	},
	actions: {
		// Updates in-memory profile state and mirrors the result to local cache.
		setProfile(profile: MeResponse | null) {
			this.profile = profile;
			this.profileCachedAt = profile ? Date.now() : 0;

			if (profile) {
				void uniPlatform.storage.set(APP_STORAGE_KEYS.userProfile, {
					profile,
					cachedAt: this.profileCachedAt
				});
			} else {
				void uniPlatform.storage.remove(APP_STORAGE_KEYS.userProfile);
			}
		},
		// Restores cached profile only when uid and max-age both match the current session.
		// A stale or shape-invalid cache is removed immediately instead of tolerated.
		async restoreProfile(uid: number, maxAgeMs: number) {
			const snapshot = await uniPlatform.storage.get<UserProfileSnapshot>(APP_STORAGE_KEYS.userProfile);

			if (
				!snapshot ||
				!isUserProfile(snapshot.profile) ||
				snapshot.profile.uid !== uid ||
				typeof snapshot.cachedAt !== "number" ||
				Date.now() - snapshot.cachedAt > maxAgeMs
			) {
				await uniPlatform.storage.remove(APP_STORAGE_KEYS.userProfile);
				return false;
			}

			this.profile = snapshot.profile;
			this.profileCachedAt = snapshot.cachedAt;
			return true;
		},
		// Clears profile state without touching session token ownership.
		clearProfile() {
			this.profile = null;
			this.profileCachedAt = 0;
			void uniPlatform.storage.remove(APP_STORAGE_KEYS.userProfile);
		}
	}
});
