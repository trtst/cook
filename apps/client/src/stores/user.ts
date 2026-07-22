import { defineStore } from "pinia";
import type { UserBasic } from "@/apis/user";
import { uniPlatform } from "@/platform/uni";
import { THEME_SKIN_OPTIONS, type ThemeSkin } from "@/stores/settings";

const USER_PROFILE_STORAGE_KEY = "next_meal_user_profile";

interface UserProfileSnapshot {
  profile: UserBasic;
  cachedAt: number;
}

export const useUserStore = defineStore("user", {
  state: () => ({
    profile: null as UserBasic | null,
    profileCachedAt: 0
  }),
  getters: {
    isMembershipActive: () => false,
    themeSkinEntitlements: () => THEME_SKIN_OPTIONS.map((option) => option.value),
    canUseThemeSkin: () => (themeSkin: ThemeSkin) => THEME_SKIN_OPTIONS.some((option) => option.value === themeSkin)
  },
  actions: {
    setProfile(profile: UserBasic | null) {
      this.profile = profile;
      this.profileCachedAt = profile ? Date.now() : 0;

      if (profile) {
        void uniPlatform.storage.set(USER_PROFILE_STORAGE_KEY, {
          profile,
          cachedAt: this.profileCachedAt
        });
      } else {
        void uniPlatform.storage.remove(USER_PROFILE_STORAGE_KEY);
      }
    },
    async restoreProfile(userId: string, maxAgeMs: number) {
      const snapshot = await uniPlatform.storage.get<UserProfileSnapshot>(USER_PROFILE_STORAGE_KEY);

      if (!snapshot?.profile || snapshot.profile.id !== userId || Date.now() - snapshot.cachedAt > maxAgeMs) {
        await uniPlatform.storage.remove(USER_PROFILE_STORAGE_KEY);
        return false;
      }

      this.profile = snapshot.profile;
      this.profileCachedAt = snapshot.cachedAt;
      return true;
    },
    clearProfile() {
      this.profile = null;
      this.profileCachedAt = 0;
      void uniPlatform.storage.remove(USER_PROFILE_STORAGE_KEY);
    }
  }
});
