import { computed, ref } from "vue";
import {
  getThemeSeed,
  getDefaultPaletteForSkin,
  getSupportedPalettesForSkin,
  getThemeSourceModeForSkin,
  isPaletteSupportedBySkin,
  supportsDarkForSkin,
  type ThemeMode,
  type ThemePalette,
  type ThemeSourceMode,
  type ThemeSkin
} from "@/themes";
import { uniPlatform } from "@/platform/uni";
import { THEME_SKIN_OPTIONS, useSettingsStore } from "@/stores/settings";
import { buildThemeVars } from "./theme-vars";

type EffectiveTheme = "light" | "dark";
type ThemeVars = Record<string, string>;

const systemTheme = ref<EffectiveTheme>("light");
let initialized = false;
let mediaQueryCleanup: (() => void) | undefined;

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
  const sourceMode = computed<ThemeSourceMode>(() => getThemeSourceModeForSkin(effectiveSkin.value));
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

    return buildThemeVars(seed, effectiveTheme.value, sourceMode.value);
  });
  const supportedPalettes = computed(() => getSupportedPalettesForSkin(effectiveSkin.value));
  const canSwitchPalette = computed(() => supportedPalettes.value.length > 1);
  function canUseThemeSkin(skin: ThemeSkin) {
    return THEME_SKIN_OPTIONS.some((option) => option.value === skin);
  }

  async function setThemeMode(mode: ThemeMode, persist = true) {
    await settingsStore.setThemeMode(mode, persist);
  }

  async function setThemeSkin(skin: ThemeSkin, persist = true) {
    await settingsStore.setThemeSkin(skin, persist);
    return true;
  }

  async function setThemePalette(palette: ThemePalette, persist = true) {
    await settingsStore.setThemePalette(palette, persist);
  }

  return {
    systemTheme,
    themeMode: computed(() => settingsStore.themeMode),
    themeSkin: computed(() => settingsStore.themeSkin),
    themePalette: computed(() => settingsStore.themePalette),
    effectiveSkin,
    effectivePalette,
    effectiveTheme,
    sourceMode,
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
