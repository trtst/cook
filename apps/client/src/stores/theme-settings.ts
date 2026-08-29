import {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SKIN,
  THEME_PALETTE_OPTIONS,
  THEME_SKIN_PRESETS,
  type ThemeMode,
  type ThemePalette,
  type ThemeSkin
} from "@/themes/presets";

export interface ThemeSettingsSnapshot {
  themeMode?: ThemeMode;
  themeSkin?: ThemeSkin;
  themePalette?: ThemePalette;
}

export interface ResolvedThemeSettings {
  themeMode: ThemeMode;
  themeSkin: ThemeSkin;
  themePalette: ThemePalette;
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function isThemeSkin(value: unknown): value is ThemeSkin {
  return THEME_SKIN_PRESETS.some((option) => option.value === value);
}

function isThemePalette(value: unknown): value is ThemePalette {
  return THEME_PALETTE_OPTIONS.includes(value as ThemePalette);
}

function getThemePreset(themeSkin: ThemeSkin) {
  return THEME_SKIN_PRESETS.find((option) => option.value === themeSkin) ?? THEME_SKIN_PRESETS[0];
}

function getDefaultPaletteForSkin(themeSkin: ThemeSkin): ThemePalette {
  return getThemePreset(themeSkin).palettes[0] ?? DEFAULT_THEME_PALETTE;
}

function isPaletteSupportedBySkin(themeSkin: ThemeSkin, themePalette: ThemePalette) {
  return (getThemePreset(themeSkin).palettes as readonly ThemePalette[]).includes(themePalette);
}

export function resolveThemeSettingsSnapshot(snapshot: ThemeSettingsSnapshot | null | undefined): ResolvedThemeSettings {
  const themeSkin = isThemeSkin(snapshot?.themeSkin) ? snapshot.themeSkin : DEFAULT_THEME_SKIN;
  const themePalette =
    isThemePalette(snapshot?.themePalette) && isPaletteSupportedBySkin(themeSkin, snapshot.themePalette)
      ? snapshot.themePalette
      : getDefaultPaletteForSkin(themeSkin);

  return {
    themeMode: isThemeMode(snapshot?.themeMode) ? snapshot.themeMode : "system",
    themeSkin,
    themePalette
  };
}
