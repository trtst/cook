export type ThemeMode = "system" | "light" | "dark";
export type ThemeSkinAccess = "free" | "member";
export type ThemeAssetType = "icon" | "svg";
export type ThemeSourceMode = "mono" | "duo";

export const THEME_PALETTE_OPTIONS = ["default", "warm", "olive", "cool"] as const;
export const THEME_TABBAR_ICON_NAMES = ["home", "recipe", "me"] as const;

export type ThemePalette = (typeof THEME_PALETTE_OPTIONS)[number];
export type ThemeTabbarIconName = (typeof THEME_TABBAR_ICON_NAMES)[number];

interface ThemeSeedBase {
  bg: string;
  surface: string;
  text: string;
  // 必填主题高亮色。
  primary: string;
}

export interface MonoThemeSeed extends ThemeSeedBase {
  secondary?: never;
}

export interface DuoThemeSeed extends ThemeSeedBase {
  // 双色主题必须显式声明第二主题色。
  secondary: string;
}

export type ThemeSeed = MonoThemeSeed | DuoThemeSeed;

export interface ThemeSeedSet<TSeed extends ThemeSeed = ThemeSeed> {
  light: TSeed;
  dark?: TSeed;
}

interface ThemeSkinPresetBase<TSourceMode extends ThemeSourceMode, TSeed extends ThemeSeed> {
  value: string;
  label: string;
  access: ThemeSkinAccess;
  assetType: ThemeAssetType;
  sourceMode: TSourceMode;
  supportsPalette: boolean;
  supportsDark: boolean;
  palettes: readonly ThemePalette[];
  seeds: Partial<Record<ThemePalette, ThemeSeedSet<TSeed>>>;
}

export type ThemeSkinPreset = ThemeSkinPresetBase<"mono", MonoThemeSeed> | ThemeSkinPresetBase<"duo", DuoThemeSeed>;

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
    palettes: ["default", "warm", "olive", "cool"],
    seeds: {
      default: {
        light: {
          bg: "#fff",
          surface: "#ffffff",
          text: "#17231d",
          primary: "#216e4e",
          secondary: "#dff1e8"
        },
        dark: {
          bg: "#111715",
          surface: "#18201d",
          text: "#f6efe8",
          primary: "#5a9d90",
          secondary: "#8fbf8c"
        }
      },
      warm: {
        light: {
          bg: "#fbf4e5",
          surface: "#fffaf0",
          text: "#2d2418",
          primary: "#d67a54",
          secondary: "#f0b16b"
        }
      },
      olive: {
        light: {
          bg: "#f2f4ea",
          surface: "#fffef8",
          text: "#202719",
          primary: "#7a9b61",
          secondary: "#b7c76f"
        }
      },
      cool: {
        light: {
          bg: "#f0f5f8",
          surface: "#ffffff",
          text: "#17242d",
          primary: "#4e93bf",
          secondary: "#83b6df"
        }
      }
    }
  },
  {
    value: "fresh-ingredient",
    label: "清新食材",
    access: "free",
    assetType: "svg",
    sourceMode: "duo",
    supportsPalette: false,
    supportsDark: false,
    palettes: [],
    seeds: {
      default: {
        light: {
          bg: "#f4f7f5",
          surface: "#ffffff",
          text: "#17231d",
          primary: "#216e4e",
          secondary: "#dff1e8"
        }
      }
    }
  },
  {
    value: "minimal-white",
    label: "简白",
    access: "free",
    assetType: "icon",
    sourceMode: "mono",
    supportsPalette: false,
    supportsDark: true,
    palettes: [],
    seeds: {
      default: {
        light: {
          bg: "#ffffff",
          surface: "#ffffff",
          text: "#161616",
          primary: "#7da35b"
        },
        dark: {
          bg: "#101211",
          surface: "#171a18",
          text: "#f5f7f6",
          primary: "#9db488"
        }
      }
    }
  },
  {
    value: "apple-glass",
    label: "磨砂玻璃",
    access: "member",
    assetType: "icon",
    sourceMode: "duo",
    supportsPalette: false,
    supportsDark: false,
    palettes: [],
    seeds: {
      default: {
        light: {
          bg: "#eef1f4",
          surface: "rgba(255, 255, 255, 0.74)",
          text: "#1d1d1f",
          primary: "#0a84ff",
          secondary: "#78b9ff"
        }
      }
    }
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
