import { computed, ref } from "vue";

interface MenuButtonRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

interface SystemInfoState {
  statusBarHeight: number;
  windowHeight: number;
  safeArea?: SafeArea;
  menuButtonRect?: MenuButtonRect;
}

interface WindowInfo {
  statusBarHeight?: number;
  windowHeight?: number;
  safeArea?: SafeArea;
}

const DEFAULT_NAV_BAR_HEIGHT = 44;
const DEFAULT_TAB_BAR_HEIGHT = 50;
const DEFAULT_SAFE_AREA_BOTTOM = 0;

const systemInfo = ref<SystemInfoState>({
  statusBarHeight: 20,
  windowHeight: 0
});

let initialized = false;

function getMenuButtonRect() {
  const platformUni = uni as unknown as {
    getMenuButtonBoundingClientRect?: () => MenuButtonRect;
  };

  try {
    return platformUni.getMenuButtonBoundingClientRect?.();
  } catch {
    return undefined;
  }
}

function readWindowInfo(): WindowInfo | undefined {
  const platformUni = uni as unknown as {
    getWindowInfo?: () => WindowInfo;
  };

  try {
    const windowInfo = platformUni.getWindowInfo?.();
    if (windowInfo) return windowInfo;
  } catch {
    // Continue with H5 fallback or default values.
  }

  if (typeof window === "undefined") return undefined;

  return {
    statusBarHeight: 0,
    windowHeight: window.innerHeight
  };
}

export function initSystemInfo() {
  if (initialized) return;
  initialized = true;

  try {
    const info = readWindowInfo();
    systemInfo.value = {
      statusBarHeight: info?.statusBarHeight ?? 20,
      windowHeight: info?.windowHeight ?? 0,
      safeArea: info?.safeArea,
      menuButtonRect: getMenuButtonRect()
    };
  } catch {
    systemInfo.value = {
      statusBarHeight: 20,
      windowHeight: 0
    };
  }
}

export function useSystemInfo() {
  initSystemInfo();

  const navBarHeight = computed(() => {
    const rect = systemInfo.value.menuButtonRect;
    if (!rect) return DEFAULT_NAV_BAR_HEIGHT;

    const topGap = Math.max(0, rect.top - systemInfo.value.statusBarHeight);
    return rect.height + topGap * 2;
  });

  const navBarTotalHeight = computed(() => systemInfo.value.statusBarHeight + navBarHeight.value);

  const safeAreaBottom = computed(() => {
    const safeArea = systemInfo.value.safeArea;
    if (!safeArea || !systemInfo.value.windowHeight) return DEFAULT_SAFE_AREA_BOTTOM;
    return Math.max(0, systemInfo.value.windowHeight - safeArea.bottom);
  });

  const tabBarHeight = computed(() => DEFAULT_TAB_BAR_HEIGHT + safeAreaBottom.value);

  return {
    systemInfo,
    navBarHeight,
    navBarTotalHeight,
    safeAreaBottom,
    tabBarHeight
  };
}
