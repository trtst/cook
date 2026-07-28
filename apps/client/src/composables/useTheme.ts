import { computed, ref } from "vue";
import {
  getThemeSeed,
  getDefaultPaletteForSkin,
  getSupportedPalettesForSkin,
  isPaletteSupportedBySkin,
  supportsDarkForSkin,
  type ThemeMode,
  type ThemePalette,
  type ThemeSeed,
  type ThemeSkin
} from "@/themes";
import { uniPlatform } from "@/platform/uni";
import { THEME_SKIN_OPTIONS, useSettingsStore } from "@/stores/settings";

type EffectiveTheme = "light" | "dark";
type ThemeVars = Record<string, string>;

const systemTheme = ref<EffectiveTheme>("light");
let initialized = false;
let mediaQueryCleanup: (() => void) | undefined;

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseColor(color: string) {
  const value = color.trim();

  if (value.startsWith("#")) {
    const hex = value.slice(1);

    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0] + hex[0], 16),
        g: Number.parseInt(hex[1] + hex[1], 16),
        b: Number.parseInt(hex[2] + hex[2], 16),
        a: 1
      };
    }

    if (hex.length === 4) {
      return {
        r: Number.parseInt(hex[0] + hex[0], 16),
        g: Number.parseInt(hex[1] + hex[1], 16),
        b: Number.parseInt(hex[2] + hex[2], 16),
        a: Number.parseInt(hex[3] + hex[3], 16) / 255
      };
    }

    if (hex.length === 6 || hex.length === 8) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
      };
    }
  }

  const rgbaMatch = value.match(/rgba?\(([^)]+)\)/i);
  if (!rgbaMatch) return null;

  const parts = rgbaMatch[1]?.split(",").map((part) => part.trim()) ?? [];
  if (parts.length < 3) return null;

  const r = Number.parseFloat(parts[0] ?? "");
  const g = Number.parseFloat(parts[1] ?? "");
  const b = Number.parseFloat(parts[2] ?? "");
  const a = parts[3] == null ? 1 : Number.parseFloat(parts[3]);

  if ([r, g, b, a].some((item) => Number.isNaN(item))) return null;

  return { r, g, b, a };
}

function toRgba(color: string, alpha: number) {
  const parsed = parseColor(color);
  if (!parsed) return color;

  return `rgba(${clampChannel(parsed.r)}, ${clampChannel(parsed.g)}, ${clampChannel(parsed.b)}, ${alpha})`;
}

function mixColor(base: string, overlay: string, weight: number) {
  const baseColor = parseColor(base);
  const overlayColor = parseColor(overlay);

  if (!baseColor || !overlayColor) {
    return weight >= 0.5 ? overlay : base;
  }

  const overlayWeight = Math.max(0, Math.min(1, weight));
  const baseWeight = 1 - overlayWeight;

  return `rgb(${clampChannel(baseColor.r * baseWeight + overlayColor.r * overlayWeight)}, ${clampChannel(
    baseColor.g * baseWeight + overlayColor.g * overlayWeight
  )}, ${clampChannel(baseColor.b * baseWeight + overlayColor.b * overlayWeight)})`;
}

function getContrastText(color: string) {
  const parsed = parseColor(color);
  if (!parsed) return "#ffffff";

  const luminance = (parsed.r * 299 + parsed.g * 587 + parsed.b * 114) / 1000;
  return luminance >= 164 ? "#1b1b1b" : "#ffffff";
}

function deriveAccent(seed: ThemeSeed, themeMode: EffectiveTheme) {
  return mixColor(seed.primary, themeMode === "dark" ? seed.text : seed.surface, themeMode === "dark" ? 0.24 : 0.32);
}

function buildThemeVars(seed: ThemeSeed, themeMode: EffectiveTheme): ThemeVars {
  const accent = seed.accent ?? deriveAccent(seed, themeMode);
  const panel = mixColor(seed.surface, seed.primary, themeMode === "dark" ? 0.14 : 0.08);
  const secondaryText = toRgba(seed.text, themeMode === "dark" ? 0.72 : 0.7);
  const tertiaryText = toRgba(seed.text, themeMode === "dark" ? 0.58 : 0.56);
  const inverseText = getContrastText(seed.text);
  const border = toRgba(seed.primary, themeMode === "dark" ? 0.18 : 0.16);
  const divider = toRgba(seed.primary, themeMode === "dark" ? 0.12 : 0.1);
  const primarySoft = toRgba(seed.primary, themeMode === "dark" ? 0.26 : 0.24);
  const primaryActive = mixColor(seed.primary, seed.text, themeMode === "dark" ? 0.18 : 0.14);
  const buttonTone = mixColor(seed.primary, accent, 0.48);
  const buttonText = themeMode === "light" ? inverseText : getContrastText(buttonTone);
  const ink = themeMode === "dark" ? "#f5efe8" : "#1b1b1b";

  return {
    "--theme-bg": seed.bg,
    "--theme-surface": seed.surface,
    "--theme-text": seed.text,
    "--theme-primary": seed.primary,
    "--theme-accent": accent,
    "--color-page": seed.bg,
    "--color-surface": seed.surface,
    "--color-surface-mask-weak": toRgba(seed.surface, 0.16),
    "--color-surface-mask-medium": toRgba(seed.surface, 0.42),
    "--color-surface-mask-strong": toRgba(seed.surface, 0.76),
    "--color-surface-muted": panel,
    "--color-text": seed.text,
    "--color-text-secondary": secondaryText,
    "--color-text-tertiary": tertiaryText,
    "--color-text-inverse": inverseText,
    "--color-primary": seed.primary,
    "--color-primary-active": primaryActive,
    "--color-primary-soft": primarySoft,
    "--color-border": border,
    "--color-divider": divider,
    "--color-tabbar-bg": toRgba(seed.surface, 0.9),
    "--shadow-card": `0 12rpx 32rpx ${toRgba(seed.primary, themeMode === "dark" ? 0.18 : 0.1)}`,
    "--shadow-floating": `0 -8rpx 28rpx ${toRgba(seed.primary, themeMode === "dark" ? 0.22 : 0.12)}`,
    "--button-primary-gradient-start": seed.primary,
    "--button-primary-gradient-end": accent,
    "--button-primary-text": buttonText,
    "--button-primary-shadow": `0 22rpx 44rpx ${toRgba(seed.primary, themeMode === "dark" ? 0.32 : 0.24)}`,
    "--login-popup-backdrop-bg": toRgba(themeMode === "dark" ? "#050908" : seed.text, themeMode === "dark" ? 0.48 : 0.32),
    "--login-popup-hero-copy": seed.text,
    "--login-popup-hero-copy-secondary": secondaryText,
    "--login-popup-hero-mask-spot": toRgba(accent, themeMode === "dark" ? 0.14 : 0.2),
    "--login-popup-hero-mask-top": toRgba(seed.surface, themeMode === "dark" ? 0.06 : 0.04),
    "--login-popup-hero-mask-bottom": toRgba(seed.bg, themeMode === "dark" ? 0.52 : 0.46),
    "--login-popup-sheet-border": border,
    "--login-popup-sheet-shadow": `0 -20rpx 60rpx ${toRgba(seed.primary, themeMode === "dark" ? 0.22 : 0.12)}`,
    "--login-popup-sheet-overlay-start": toRgba(seed.surface, themeMode === "dark" ? 0.78 : 0.74),
    "--login-popup-sheet-overlay-end": toRgba(seed.bg, themeMode === "dark" ? 0.86 : 0.68),
    "--login-popup-title": seed.text,
    "--login-popup-description": secondaryText,
    "--login-popup-input-bg": toRgba(seed.surface, themeMode === "dark" ? 0.14 : 0.92),
    "--login-popup-input-border": border,
    "--login-popup-input-text": seed.text,
    "--login-popup-code-bg": primarySoft,
    "--login-popup-code-text": seed.primary,
    "--login-popup-ghost-bg": toRgba(seed.surface, themeMode === "dark" ? 0.12 : 0.86),
    "--login-popup-ghost-border": border,
    "--login-popup-ghost-text": secondaryText,
    "--login-popup-hint": tertiaryText,
    "--entry-board-bg": toRgba(seed.surface, themeMode === "dark" ? 0.86 : 0.94),
    "--entry-board-shadow": `0 18rpx 42rpx ${toRgba(seed.primary, themeMode === "dark" ? 0.2 : 0.14)}`,
    "--entry-primary-bg": mixColor(seed.surface, seed.primary, themeMode === "dark" ? 0.42 : 0.58),
    "--entry-side-mint-bg": mixColor(seed.surface, seed.primary, themeMode === "dark" ? 0.28 : 0.22),
    "--entry-side-aqua-bg": mixColor(seed.surface, accent, themeMode === "dark" ? 0.22 : 0.18),
    "--entry-ink": ink,
    "--entry-outline": ink,
    "--entry-accent": accent,
    "--entry-muted-text": tertiaryText,
    "--entry-side-muted-text": secondaryText,
    "--entry-photo-bg": toRgba(seed.surface, themeMode === "dark" ? 0.92 : 1),
    "--entry-photo-shadow": `inset 0 0 0 1rpx ${border}`,
    "--entry-photo-plate-bg": mixColor(seed.surface, seed.bg, 0.4),
    "--entry-button-bg": seed.primary,
    "--entry-button-color": buttonText,
    "--entry-button-shadow": `0 12rpx 20rpx ${toRgba(seed.primary, themeMode === "dark" ? 0.24 : 0.18)}`
  };
}

function readMiniProgramTheme() {
  const appBaseInfo = uniPlatform.system.getAppBaseInfo();
  if (appBaseInfo?.theme === "dark" || appBaseInfo?.theme === "light") {
    systemTheme.value = appBaseInfo.theme;
  }

  uniPlatform.system.onThemeChange((result) => {
    if (result.theme === "dark" || result.theme === "light") {
      systemTheme.value = result.theme;
    }
  });
}

function readH5Theme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  systemTheme.value = mediaQuery.matches ? "dark" : "light";

  const handleChange = (event: MediaQueryListEvent) => {
    systemTheme.value = event.matches ? "dark" : "light";
  };

  mediaQuery.addEventListener("change", handleChange);
  mediaQueryCleanup = () => mediaQuery.removeEventListener("change", handleChange);
}

export function initTheme() {
  if (initialized) return;
  initialized = true;
  readMiniProgramTheme();
  readH5Theme();
}

export function cleanupTheme() {
  mediaQueryCleanup?.();
  mediaQueryCleanup = undefined;
  initialized = false;
}

export function useTheme() {
  initTheme();

  const settingsStore = useSettingsStore();
  const effectiveSkin = computed(() => settingsStore.themeSkin);
  const effectiveTheme = computed<EffectiveTheme>(() => {
    if (!supportsDarkForSkin(effectiveSkin.value)) {
      return "light";
    }

    if (settingsStore.themeMode === "dark" || settingsStore.themeMode === "light") {
      return settingsStore.themeMode;
    }

    return systemTheme.value;
  });

  const effectivePalette = computed(() => {
    if (isPaletteSupportedBySkin(effectiveSkin.value, settingsStore.themePalette)) {
      return settingsStore.themePalette;
    }

    return getDefaultPaletteForSkin(effectiveSkin.value);
  });
  const themeClass = computed(() => `theme-${effectiveTheme.value}`);
  const skinClass = computed(() => `theme-skin-${effectiveSkin.value}`);
  const paletteClass = computed(() => {
    if (effectiveTheme.value === "dark") return "";
    if (supportedPalettes.value.length === 0) return "";
    return `theme-palette-${effectivePalette.value}`;
  });
  const themeClasses = computed(() => [themeClass.value, skinClass.value, paletteClass.value].filter(Boolean).join(" "));
  const themeVars = computed<ThemeVars>(() => {
    const seed = getThemeSeed(effectiveSkin.value, effectivePalette.value, effectiveTheme.value);
    if (!seed) return {};

    return buildThemeVars(seed, effectiveTheme.value);
  });
  const supportedPalettes = computed(() => getSupportedPalettesForSkin(effectiveSkin.value));
  const canSwitchPalette = computed(() => supportedPalettes.value.length > 1);
  function canUseThemeSkin(skin: ThemeSkin) {
    return THEME_SKIN_OPTIONS.some((option) => option.value === skin);
  }

  async function setThemeMode(mode: ThemeMode) {
    await settingsStore.setThemeMode(mode);
  }

  async function setThemeSkin(skin: ThemeSkin) {
    await settingsStore.setThemeSkin(skin);
    return true;
  }

  async function setThemePalette(palette: ThemePalette) {
    await settingsStore.setThemePalette(palette);
  }

  return {
    systemTheme,
    themeMode: computed(() => settingsStore.themeMode),
    themeSkin: computed(() => settingsStore.themeSkin),
    themePalette: computed(() => settingsStore.themePalette),
    effectiveSkin,
    effectivePalette,
    effectiveTheme,
    themeClass,
    skinClass,
    paletteClass,
    themeClasses,
    themeVars,
    supportedPalettes,
    canSwitchPalette,
    canUseThemeSkin,
    setThemeMode,
    setThemeSkin,
    setThemePalette
  };
}
