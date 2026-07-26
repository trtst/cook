export {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SKIN,
  FALLBACK_ASSET_SKIN,
  THEME_PALETTE_OPTIONS,
  THEME_SKIN_OPTIONS
} from "./config";

export type {
  ThemeAssets,
  ThemeIconAsset,
  ThemeMode,
  ThemePalette,
  ThemeSeed,
  ThemeSeedSet,
  ThemeSkin,
  ThemeSkinAccess,
  ThemeSkinOption,
  ThemeSvgAsset,
  ThemeTabbarAsset,
  ThemeAssetType,
  ThemeTabbarIconName
} from "./config";

import {
  DEFAULT_THEME_PALETTE,
  THEME_SKIN_OPTIONS,
  type ThemeAssets,
  type ThemePalette,
  type ThemeSeed,
  type ThemeSeedSet,
  type ThemeSkin
} from "./config";

export function getThemeSkinOption(themeSkin: ThemeSkin) {
  return THEME_SKIN_OPTIONS.find((option) => option.value === themeSkin) ?? THEME_SKIN_OPTIONS[0];
}

export function getThemeSkinAssets(themeSkin: ThemeSkin): ThemeAssets {
  return getThemeSkinOption(themeSkin).assets ?? {};
}

export function getDefaultPaletteForSkin(themeSkin: ThemeSkin) {
  return getThemeSkinOption(themeSkin).palettes[0] ?? DEFAULT_THEME_PALETTE;
}

export function getSupportedPalettesForSkin(themeSkin: ThemeSkin) {
  return getThemeSkinOption(themeSkin).palettes;
}

export function isPaletteSupportedBySkin(themeSkin: ThemeSkin, themePalette: ThemePalette) {
  return getSupportedPalettesForSkin(themeSkin).includes(themePalette);
}

export function supportsPaletteForSkin(themeSkin: ThemeSkin) {
  return getThemeSkinOption(themeSkin).supportsPalette;
}

export function supportsDarkForSkin(themeSkin: ThemeSkin) {
  return getThemeSkinOption(themeSkin).supportsDark;
}

export function getThemeSeedSet(themeSkin: ThemeSkin, themePalette: ThemePalette): ThemeSeedSet | null {
  const option = getThemeSkinOption(themeSkin);

  if (option.seeds[themePalette]) {
    return option.seeds[themePalette] ?? null;
  }

  return option.seeds[DEFAULT_THEME_PALETTE] ?? null;
}

export function getThemeSeed(themeSkin: ThemeSkin, themePalette: ThemePalette, themeMode: "light" | "dark"): ThemeSeed | null {
  const seedSet = getThemeSeedSet(themeSkin, themePalette);

  if (!seedSet) return null;
  if (themeMode === "dark" && seedSet.dark) return seedSet.dark;
  return seedSet.light;
}
