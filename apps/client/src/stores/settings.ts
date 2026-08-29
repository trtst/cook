import { defineStore } from "pinia";
import { APP_STORAGE_KEYS, uniPlatform } from "@/platform/uni";
import {
	DEFAULT_THEME_PALETTE,
	DEFAULT_THEME_SKIN,
	getDefaultPaletteForSkin,
	getSupportedPalettesForSkin,
	isPaletteSupportedBySkin,
	supportsDarkForSkin,
	THEME_PALETTE_OPTIONS,
	THEME_SKIN_OPTIONS,
	type ThemeMode,
	type ThemePalette,
	type ThemeSkin
} from "@/themes";
import { resolveThemeSettingsSnapshot, type ThemeSettingsSnapshot } from "./theme-settings";

// Re-export theme constants and types so pages can consume one store-facing entry.
export {
	DEFAULT_THEME_PALETTE,
	DEFAULT_THEME_SKIN,
	getDefaultPaletteForSkin,
	getSupportedPalettesForSkin,
	isPaletteSupportedBySkin,
	supportsDarkForSkin,
	THEME_PALETTE_OPTIONS,
	THEME_SKIN_OPTIONS
};
export type { ThemeMode, ThemePalette, ThemeSkin };

function readInitialThemeSettings() {
	return resolveThemeSettingsSnapshot(uniPlatform.storage.getSync<ThemeSettingsSnapshot>(APP_STORAGE_KEYS.theme));
}

const initialThemeSettings = readInitialThemeSettings();

// Settings store owns local preferences only.
// It does not resolve entitlement or system theme listeners by itself.
export const useSettingsStore = defineStore("settings", {
	state: () => ({
		// User-selected theme mode or system-following mode.
		themeMode: initialThemeSettings.themeMode,
		// Active visual skin.
		themeSkin: initialThemeSettings.themeSkin,
		// Active palette inside the selected skin.
		themePalette: initialThemeSettings.themePalette
	}),
	actions: {
		// Restores local settings snapshot and repairs unsupported skin/palette combinations.
		async restore() {
			const restored = resolveThemeSettingsSnapshot(await uniPlatform.storage.get<ThemeSettingsSnapshot>(APP_STORAGE_KEYS.theme));
			this.themeMode = restored.themeMode;
			this.themeSkin = restored.themeSkin;
			this.themePalette = restored.themePalette;
		},
		// Updates theme mode and persists immediately because pages depend on it across relaunches.
		async setThemeMode(themeMode: ThemeMode) {
			this.themeMode = themeMode;
			await this.persist();
		},
		// Changing skin can invalidate the current palette, so palette is repaired before persistence.
		async setThemeSkin(themeSkin: ThemeSkin) {
			this.themeSkin = themeSkin;
			if (!isPaletteSupportedBySkin(themeSkin, this.themePalette)) {
				this.themePalette = getDefaultPaletteForSkin(themeSkin);
			}
			await this.persist();
		},
		// Rejects unsupported palette/skin pairs by falling back to the skin default.
		async setThemePalette(themePalette: ThemePalette) {
			if (!isPaletteSupportedBySkin(this.themeSkin, themePalette)) {
				this.themePalette = getDefaultPaletteForSkin(this.themeSkin);
				await this.persist();
				return;
			}
			this.themePalette = themePalette;
			await this.persist();
		},
		// Resets local settings to default values and clears persisted storage.
		async clearSettings() {
			this.themeMode = "system";
			this.themeSkin = DEFAULT_THEME_SKIN;
			this.themePalette = DEFAULT_THEME_PALETTE;
			await uniPlatform.storage.remove(APP_STORAGE_KEYS.theme);
		},
		// Central persistence path so every setting write uses one storage shape.
		async persist() {
			await uniPlatform.storage.set(APP_STORAGE_KEYS.theme, {
				themeMode: this.themeMode,
				themeSkin: this.themeSkin,
				themePalette: this.themePalette
			});
		}
	}
});
