import { defineStore } from "pinia";
import { uniPlatform } from "@/platform/uni";
import {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SKIN,
  getDefaultPaletteForSkin,
  getSupportedPalettesForSkin,
  isPaletteSupportedBySkin,
  THEME_PALETTE_OPTIONS,
  THEME_SKIN_OPTIONS,
  type ThemeMode,
  type ThemePalette,
  type ThemeSkin
} from "@/themes";

const SETTINGS_STORAGE_KEY = "next_meal_settings";

export {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SKIN,
  getDefaultPaletteForSkin,
  getSupportedPalettesForSkin,
  isPaletteSupportedBySkin,
  THEME_PALETTE_OPTIONS,
  THEME_SKIN_OPTIONS
};
export type { ThemeMode, ThemePalette, ThemeSkin };

interface SettingsSnapshot {
  lastDiningGroupId: string;
  themeMode?: ThemeMode;
  themeSkin?: ThemeSkin;
  themePalette?: ThemePalette;
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function isThemeSkin(value: unknown): value is ThemeSkin {
  return THEME_SKIN_OPTIONS.some((option) => option.value === value);
}

function isThemePalette(value: unknown): value is ThemePalette {
  return THEME_PALETTE_OPTIONS.includes(value as ThemePalette);
}

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    lastDiningGroupId: "",
    themeMode: "system" as ThemeMode,
    themeSkin: DEFAULT_THEME_SKIN as ThemeSkin,
    themePalette: DEFAULT_THEME_PALETTE as ThemePalette
  }),
  actions: {
    async restore() {
      const snapshot = await uniPlatform.storage.get<SettingsSnapshot>(SETTINGS_STORAGE_KEY);
      const restoredSkin = isThemeSkin(snapshot?.themeSkin) ? snapshot.themeSkin : DEFAULT_THEME_SKIN;
      const restoredPalette =
        isThemePalette(snapshot?.themePalette) && isPaletteSupportedBySkin(restoredSkin, snapshot.themePalette)
          ? snapshot.themePalette
          : getDefaultPaletteForSkin(restoredSkin);

      this.lastDiningGroupId = snapshot?.lastDiningGroupId ?? "";
      this.themeMode = isThemeMode(snapshot?.themeMode) ? snapshot.themeMode : "system";
      this.themeSkin = restoredSkin;
      this.themePalette = restoredPalette;
    },
    async setLastDiningGroupId(diningGroupId: string) {
      this.lastDiningGroupId = diningGroupId;
      await this.persist();
    },
    async setThemeMode(themeMode: ThemeMode) {
      this.themeMode = themeMode;
      await this.persist();
    },
    async setThemeSkin(themeSkin: ThemeSkin) {
      this.themeSkin = themeSkin;
      if (!isPaletteSupportedBySkin(themeSkin, this.themePalette)) {
        this.themePalette = getDefaultPaletteForSkin(themeSkin);
      }
      await this.persist();
    },
    async setThemePalette(themePalette: ThemePalette) {
      if (!isPaletteSupportedBySkin(this.themeSkin, themePalette)) {
        this.themePalette = getDefaultPaletteForSkin(this.themeSkin);
        await this.persist();
        return;
      }
      this.themePalette = themePalette;
      await this.persist();
    },
    async clearSettings() {
      this.lastDiningGroupId = "";
      this.themeMode = "system";
      this.themeSkin = DEFAULT_THEME_SKIN;
      this.themePalette = DEFAULT_THEME_PALETTE;
      await uniPlatform.storage.remove(SETTINGS_STORAGE_KEY);
    },
    async persist() {
      await uniPlatform.storage.set(SETTINGS_STORAGE_KEY, {
        lastDiningGroupId: this.lastDiningGroupId,
        themeMode: this.themeMode,
        themeSkin: this.themeSkin,
        themePalette: this.themePalette
      });
    }
  }
});
