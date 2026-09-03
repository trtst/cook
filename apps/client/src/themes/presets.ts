export type ThemeMode = "system" | "light" | "dark";
export type ThemeSkinAccess = "free" | "member";
export type ThemeAssetType = "icon" | "svg";
export type ThemeSourceMode = "mono" | "duo";

export const THEME_PALETTE_OPTIONS = ["default", "warm", "olive", "cool"] as const;
export const THEME_TABBAR_ICON_NAMES = ["home", "recipe", "me"] as const;

export type ThemePalette = (typeof THEME_PALETTE_OPTIONS)[number];
export type ThemeTabbarIconName = (typeof THEME_TABBAR_ICON_NAMES)[number];

interface ThemeSkinPresetBase<TSourceMode extends ThemeSourceMode> {
  value: string;
  label: string;
  access: ThemeSkinAccess;
  assetType: ThemeAssetType;
  sourceMode: TSourceMode;
  supportsPalette: boolean;
  supportsDark: boolean;
  palettes: readonly ThemePalette[];
}

export type ThemeSkinPreset = ThemeSkinPresetBase<"mono"> | ThemeSkinPresetBase<"duo">;

export const DEFAULT_THEME_SKIN = "default" as const;
export const DEFAULT_THEME_PALETTE = "default" as const;
export const FALLBACK_ASSET_SKIN = DEFAULT_THEME_SKIN;
export const THEME_MODE_LABELS = {
  system: "跟随系统",
  light: "浅色",
  dark: "深色"
} as const satisfies Record<ThemeMode, string>;
export const THEME_PALETTE_LABELS = {
  default: "默认",
  warm: "暖黄",
  olive: "橄榄",
  cool: "冷蓝"
} as const satisfies Record<ThemePalette, string>;
export const THEME_SOURCE_MODE_LABELS = {
  mono: "单主题色",
  duo: "双色主题"
} as const satisfies Record<ThemeSourceMode, string>;

export const THEME_SKIN_PRESETS = [
  {
    value: "default",
    label: "默认主题",
    access: "free",
    assetType: "icon",
    sourceMode: "duo",
    supportsPalette: true,
    supportsDark: true,
    palettes: ["default", "warm", "olive", "cool"]
  },
  {
    value: "fresh-ingredient",
    label: "清新食材",
    access: "free",
    assetType: "svg",
    sourceMode: "duo",
    supportsPalette: false,
    supportsDark: false,
    palettes: []
  },
  {
    value: "minimal-white",
    label: "简白",
    access: "free",
    assetType: "icon",
    sourceMode: "mono",
    supportsPalette: false,
    supportsDark: true,
    palettes: []
  },
  {
    value: "apple-glass",
    label: "磨砂玻璃",
    access: "member",
    assetType: "icon",
    sourceMode: "duo",
    supportsPalette: false,
    supportsDark: false,
    palettes: []
  }
] as const satisfies readonly ThemeSkinPreset[];

export type ThemeSkin = (typeof THEME_SKIN_PRESETS)[number]["value"];
export const THEME_PICKER_SKINS = ["default", "fresh-ingredient", "minimal-white", "apple-glass"] as const satisfies readonly ThemeSkin[];
export const THEME_SKIN_LABELS = Object.fromEntries(THEME_SKIN_PRESETS.map((item) => [item.value, item.label])) as Record<ThemeSkin, string>;

const DISPLAY_MODE_LABELS = {
  light: THEME_MODE_LABELS.light,
  dark: THEME_MODE_LABELS.dark
} as const;

export function formatThemeText(themeMode: ThemeMode, themeSkin: ThemeSkin, themePalette: ThemePalette, showPalette: boolean) {
  const modeLabel = THEME_MODE_LABELS[themeMode];
  const skinLabel = THEME_SKIN_LABELS[themeSkin];
  if (!showPalette) return `${modeLabel} · ${skinLabel}`;
  return `${modeLabel} · ${skinLabel} · ${THEME_PALETTE_LABELS[themePalette]}`;
}

export function formatEffectiveThemeText(themeMode: "light" | "dark", themeSkin: ThemeSkin, themePalette: ThemePalette, showPalette: boolean) {
  const modeLabel = DISPLAY_MODE_LABELS[themeMode];
  const skinLabel = THEME_SKIN_LABELS[themeSkin];
  if (!showPalette) return `${skinLabel} · ${modeLabel}`;
  return `${skinLabel} · ${THEME_PALETTE_LABELS[themePalette]} · ${modeLabel}`;
}
