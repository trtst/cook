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

function getStoredThemePalette(value: unknown): ThemePalette | undefined {
  if (value === "cool") return "glacier";
  return THEME_PALETTE_OPTIONS.includes(value as ThemePalette) ? value as ThemePalette : undefined;
}

function getDefaultPaletteForSkin(themeSkin: ThemeSkin): ThemePalette {
  const preset = THEME_SKIN_PRESETS.find((option) => option.value === themeSkin) ?? THEME_SKIN_PRESETS[0];
  return preset.palettes[0] ?? DEFAULT_THEME_PALETTE;
}

function isPaletteSupportedBySkin(themeSkin: ThemeSkin, themePalette: ThemePalette) {
  const preset = THEME_SKIN_PRESETS.find((option) => option.value === themeSkin) ?? THEME_SKIN_PRESETS[0];
  return (preset.palettes as readonly ThemePalette[]).includes(themePalette);
}

export function resolveThemeSettingsSnapshot(snapshot: ThemeSettingsSnapshot | null | undefined): ResolvedThemeSettings {
  const themeSkin = isThemeSkin(snapshot?.themeSkin) ? snapshot.themeSkin : DEFAULT_THEME_SKIN;
  const storedPalette = getStoredThemePalette(snapshot?.themePalette);
  const themePalette = storedPalette && isPaletteSupportedBySkin(themeSkin, storedPalette)
    ? storedPalette
    : getDefaultPaletteForSkin(themeSkin);

  return {
    themeMode: isThemeMode(snapshot?.themeMode) ? snapshot.themeMode : "system",
    themeSkin,
    themePalette
  };
}
