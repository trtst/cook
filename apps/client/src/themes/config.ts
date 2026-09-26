const tabbarSvgModules = import.meta.glob<string>("./*/*.svg", {
  eager: true,
  import: "default"
});

import {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SKIN,
  FALLBACK_ASSET_SKIN,
  formatEffectiveThemeText,
  formatThemeText,
  THEME_MODE_LABELS,
  THEME_PALETTE_LABELS,
  THEME_SOURCE_MODE_LABELS,
  THEME_PICKER_SKINS,
  THEME_SKIN_LABELS,
  THEME_PALETTE_OPTIONS,
  THEME_SKIN_PRESETS,
  THEME_TABBAR_ICON_NAMES,
  type ThemeAssetType,
  type ThemeMode,
  type ThemePalette,
  type ThemeSkin,
  type ThemeSourceMode,
  type ThemeSkinAccess,
  type ThemeSkinPreset,
  type ThemeTabbarIconName
} from "./presets";

export interface ThemeSvgAsset {
  type: "svg";
  default: string;
  active: string;
}

export interface ThemeIconAsset {
  type: "icon";
  className: string;
}

export type ThemeTabbarAsset = ThemeSvgAsset | ThemeIconAsset;

export interface ThemeAssets {
  tabbar?: Partial<Record<ThemeTabbarIconName, ThemeTabbarAsset>>;
}

export interface ThemeSkinOption {
  value: ThemeSkin;
  label: string;
  access: ThemeSkinAccess;
  assetType: ThemeAssetType;
  sourceMode: ThemeSourceMode;
  supportsPalette: boolean;
  supportsDark: boolean;
  palettes: ThemePalette[];
  assets: ThemeAssets;
}

const FONT_TABBAR_CLASS_BY_NAME: Record<ThemeTabbarIconName, string> = {
  home: "icon-tab-dining",
  recipe: "icon-tab-recipe",
  me: "icon-tab-me"
};

function createIconTabbarAssets(): Record<ThemeTabbarIconName, ThemeIconAsset> {
  return THEME_TABBAR_ICON_NAMES.reduce(
    (assets, iconName) => {
      assets[iconName] = {
        type: "icon",
        className: FONT_TABBAR_CLASS_BY_NAME[iconName]
      };
      return assets;
    },
    {} as Record<ThemeTabbarIconName, ThemeIconAsset>
  );
}

function getTabbarSvgPath(skin: string, iconName: ThemeTabbarIconName, active: boolean) {
  return `./${skin}/${iconName}${active ? "-active" : ""}.svg`;
}

function createSvgTabbarAssets(skin: string): Partial<Record<ThemeTabbarIconName, ThemeSvgAsset>> {
  return THEME_TABBAR_ICON_NAMES.reduce(
    (assets, iconName) => {
      const defaultIcon = tabbarSvgModules[getTabbarSvgPath(skin, iconName, false)];
      const activeIcon = tabbarSvgModules[getTabbarSvgPath(skin, iconName, true)];

      if (defaultIcon && activeIcon) {
        assets[iconName] = {
          type: "svg",
          default: defaultIcon,
          active: activeIcon
        };
      }

      return assets;
    },
    {} as Partial<Record<ThemeTabbarIconName, ThemeSvgAsset>>
  );
}

function createThemeAssets(config: ThemeSkinPreset): ThemeAssets {
  return {
    tabbar: config.assetType === "svg" ? createSvgTabbarAssets(config.value) : createIconTabbarAssets()
  };
}

export const THEME_SKIN_OPTIONS: ThemeSkinOption[] = THEME_SKIN_PRESETS.map((config) => ({
  value: config.value,
  label: config.label,
  access: config.access,
  assetType: config.assetType,
  sourceMode: config.sourceMode,
  supportsPalette: config.supportsPalette,
  supportsDark: config.supportsDark,
  palettes: [...config.palettes],
  assets: createThemeAssets(config)
}));

export {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SKIN,
  FALLBACK_ASSET_SKIN,
  formatEffectiveThemeText,
  formatThemeText,
  THEME_MODE_LABELS,
  THEME_PALETTE_LABELS,
  THEME_SOURCE_MODE_LABELS,
  THEME_PICKER_SKINS,
  THEME_SKIN_LABELS,
  THEME_PALETTE_OPTIONS,
  THEME_TABBAR_ICON_NAMES
};

export type { ThemeAssetType, ThemeMode, ThemePalette, ThemeSkin, ThemeSourceMode, ThemeSkinAccess, ThemeTabbarIconName };
