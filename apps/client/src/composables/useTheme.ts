import { computed, ref } from "vue";
import {
  getDefaultPaletteForSkin,
  getSupportedPalettesForSkin,
  isPaletteSupportedBySkin,
  THEME_SKIN_OPTIONS,
  useSettingsStore,
  type ThemeMode,
  type ThemePalette,
  type ThemeSkin
} from "@/stores/settings";

type EffectiveTheme = "light" | "dark";

const systemTheme = ref<EffectiveTheme>("light");
let initialized = false;
let mediaQueryCleanup: (() => void) | undefined;

function readMiniProgramTheme() {
  const platformUni = uni as unknown as {
    getAppBaseInfo?: () => { theme?: string };
    onThemeChange?: (listener: (result: { theme?: string }) => void) => void;
  };

  try {
    const appBaseInfo = platformUni.getAppBaseInfo?.();
    if (appBaseInfo?.theme === "dark" || appBaseInfo?.theme === "light") {
      systemTheme.value = appBaseInfo.theme;
    }
  } catch {
    systemTheme.value = "light";
  }

  try {
    platformUni.onThemeChange?.((result) => {
      if (result.theme === "dark" || result.theme === "light") {
        systemTheme.value = result.theme;
      }
    });
  } catch {
    // Ignore unsupported platforms.
  }
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
  const effectiveTheme = computed<EffectiveTheme>(() => {
    if (settingsStore.themeMode === "dark" || settingsStore.themeMode === "light") {
      return settingsStore.themeMode;
    }

    return systemTheme.value;
  });

  const effectiveSkin = computed(() => settingsStore.themeSkin);
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
    supportedPalettes,
    canSwitchPalette,
    canUseThemeSkin,
    setThemeMode,
    setThemeSkin,
    setThemePalette
  };
}
