import { defineStore } from "pinia";
import type { MeResponse } from "@/apis/user";
import { APP_STORAGE_KEYS } from "@/config";
import { uniPlatform } from "@/platform/uni";
import { THEME_SKIN_OPTIONS, type ThemeSkin } from "@/stores/settings";

interface UserProfileSnapshot {
  profile?: unknown;
  cachedAt?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isUserProfile(profile: unknown): profile is MeResponse {
  if (!isRecord(profile) || typeof profile.uid !== "number") return false;
  if (!isNullableString(profile.nickname) || !isNullableString(profile.avatarUrl) || !isNullableString(profile.phone)) return false;
  if (!isRecord(profile.display) || !isRecord(profile.membership)) return false;

  return (
    isNullableString(profile.display.profileBackgroundUrl) &&
    isNullableString(profile.display.homeBackgroundUrl) &&
    typeof profile.display.canUseProfileBackground === "boolean" &&
    typeof profile.display.canUseHomeBackground === "boolean" &&
    ["FREE", "PLUS", "PRO", "ULTRA"].includes(String(profile.membership.tier)) &&
    isNullableString(profile.membership.validUntil)
  );
}

export const useUserStore = defineStore("user", {
  state: () => ({
    profile: null as MeResponse | null,
    profileCachedAt: 0
  }),
  getters: {
    isMembershipActive: () => false,
    themeSkinEntitlements: () => THEME_SKIN_OPTIONS.map((option) => option.value),
    canUseThemeSkin: () => (themeSkin: ThemeSkin) => THEME_SKIN_OPTIONS.some((option) => option.value === themeSkin)
  },
  actions: {
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
    clearProfile() {
      this.profile = null;
      this.profileCachedAt = 0;
      void uniPlatform.storage.remove(APP_STORAGE_KEYS.userProfile);
    }
  }
});
