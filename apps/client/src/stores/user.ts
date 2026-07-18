import { defineStore } from "pinia";
import type { UserProfile } from "@next-meal/api-client";
import { THEME_SKIN_OPTIONS, type ThemeSkin } from "@/stores/settings";

export const useUserStore = defineStore("user", {
  state: () => ({
    profile: null as UserProfile | null
  }),
  getters: {
    isMembershipActive: (state) => state.profile?.membership?.status === "ACTIVE" && state.profile.membership.tier !== "FREE",
    themeSkinEntitlements: () => THEME_SKIN_OPTIONS.map((option) => option.value),
    canUseThemeSkin: () => (themeSkin: ThemeSkin) => THEME_SKIN_OPTIONS.some((option) => option.value === themeSkin)
  },
  actions: {
    setProfile(profile: UserProfile | null) {
      this.profile = profile;
    },
    clearProfile() {
      this.profile = null;
    }
  }
});
