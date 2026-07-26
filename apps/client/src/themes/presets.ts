export type ThemeMode = "system" | "light" | "dark";
export type ThemeSkinAccess = "free" | "member";
export type ThemeAssetType = "icon" | "svg";

export const THEME_PALETTE_OPTIONS = ["default", "warm", "olive", "cool"] as const;
export const THEME_TABBAR_ICON_NAMES = ["home", "recipe", "me"] as const;

export type ThemePalette = (typeof THEME_PALETTE_OPTIONS)[number];
export type ThemeTabbarIconName = (typeof THEME_TABBAR_ICON_NAMES)[number];

export interface ThemeSeed {
  bg: string;
  surface: string;
  text: string;
  // 必填主题高亮色。
  primary: string;
  // 可选次级点缀色；未填写时运行态会从 primary 自动派生。
  accent?: string;
}

export interface ThemeSeedSet {
  light: ThemeSeed;
  dark?: ThemeSeed;
}

export interface ThemeSkinPreset {
  value: string;
  label: string;
  access: ThemeSkinAccess;
  assetType: ThemeAssetType;
  supportsPalette: boolean;
  supportsDark: boolean;
  palettes: readonly ThemePalette[];
  seeds: Partial<Record<ThemePalette, ThemeSeedSet>>;
}

export const DEFAULT_THEME_SKIN = "default" as const;
export const DEFAULT_THEME_PALETTE = "default" as const;
export const FALLBACK_ASSET_SKIN = DEFAULT_THEME_SKIN;

export const THEME_SKIN_PRESETS = [
  {
    value: "default",
    label: "基础",
    access: "free",
    assetType: "svg",
    supportsPalette: true,
    supportsDark: true,
    palettes: ["default", "warm", "olive", "cool"],
    seeds: {
      default: {
        light: {
          bg: "#f6efe8",
          surface: "#fffaf5",
          text: "#2c231e",
          primary: "#8ab7a4",
          accent: "#e7a37d"
        },
        dark: {
          bg: "#111715",
          surface: "#18201d",
          text: "#f6efe8",
          primary: "#5a9d90",
          accent: "#8fbf8c"
        }
      },
      warm: {
        light: {
          bg: "#fbf4e5",
          surface: "#fffaf0",
          text: "#2d2418",
          primary: "#d67a54",
          accent: "#f0b16b"
        }
      },
      olive: {
        light: {
          bg: "#f2f4ea",
          surface: "#fffef8",
          text: "#202719",
          primary: "#7a9b61",
          accent: "#b7c76f"
        }
      },
      cool: {
        light: {
          bg: "#f0f5f8",
          surface: "#ffffff",
          text: "#17242d",
          primary: "#4e93bf",
          accent: "#83b6df"
        }
      }
    }
  },
  {
    value: "handdrawn-food",
    label: "手绘食物",
    access: "member",
    assetType: "svg",
    supportsPalette: false,
    supportsDark: false,
    palettes: [],
    seeds: {
      default: {
        light: {
          bg: "#fff6e3",
          surface: "#fffdf8",
          text: "#2a241d",
          primary: "#ff8b42",
          accent: "#ffb347"
        }
      }
    }
  },
  {
    value: "warm-couple",
    label: "暖黄情侣",
    access: "member",
    assetType: "icon",
    supportsPalette: false,
    supportsDark: false,
    palettes: [],
    seeds: {
      default: {
        light: {
          bg: "#fff4dc",
          surface: "#fffaf0",
          text: "#322217",
          primary: "#cf7f59",
          accent: "#efb06c"
        }
      }
    }
  },
  {
    value: "apple-glass",
    label: "苹果高斯",
    access: "member",
    assetType: "icon",
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
          accent: "#78b9ff"
        }
      }
    }
  }
] as const satisfies readonly ThemeSkinPreset[];

export type ThemeSkin = (typeof THEME_SKIN_PRESETS)[number]["value"];
