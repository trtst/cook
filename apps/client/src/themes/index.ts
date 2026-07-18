export {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SKIN,
  FALLBACK_ASSET_SKIN,
  THEME_PALETTE_OPTIONS,
  THEME_SKIN_OPTIONS
} from "./config";

export type {
  ThemeAssets,
  ThemeFontAsset,
  ThemeMode,
  ThemePalette,
  ThemeSkin,
  ThemeSkinAccess,
  ThemeSkinOption,
  ThemeSvgAsset,
  ThemeTabbarAsset,
  ThemeTabbarAssetType,
  ThemeTabbarIconName
} from "./config";

import {
  DEFAULT_THEME_PALETTE,
  THEME_SKIN_OPTIONS,
  type ThemeAssets,
  type ThemePalette,
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
