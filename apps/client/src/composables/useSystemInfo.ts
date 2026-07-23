import { computed, ref } from "vue";
import { APP_STORAGE_KEYS } from "@/config";
import { uniPlatform } from "@/platform/uni";

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
  windowWidth: number;
  windowHeight: number;
  safeArea?: SafeArea;
  menuButtonRect?: MenuButtonRect;
}

interface SystemInfoSnapshot extends SystemInfoState {
  updatedAt: number;
}

interface WindowInfo {
  statusBarHeight?: number;
  windowWidth?: number;
  windowHeight?: number;
  safeArea?: SafeArea;
}

const DEFAULT_NAV_BAR_HEIGHT = 44;
const DEFAULT_TAB_BAR_HEIGHT = 50;
const DEFAULT_SAFE_AREA_BOTTOM = 0;

const systemInfo = ref<SystemInfoState>({
  statusBarHeight: 20,
  windowWidth: 0,
  windowHeight: 0
});

let initialized = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function toNumber(value: unknown, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function readRect(value: unknown): MenuButtonRect | undefined {
  if (!isRecord(value)) return undefined;

  return {
    top: toNumber(value.top),
    bottom: toNumber(value.bottom),
    left: toNumber(value.left),
    right: toNumber(value.right),
    width: toNumber(value.width),
    height: toNumber(value.height)
  };
}

function readSafeArea(value: unknown): SafeArea | undefined {
  if (!isRecord(value)) return undefined;

  return {
    top: toNumber(value.top),
    bottom: toNumber(value.bottom),
    left: toNumber(value.left),
    right: toNumber(value.right),
    width: toNumber(value.width),
    height: toNumber(value.height)
  };
}

function normalizeSnapshot(value: unknown): SystemInfoSnapshot | null {
  if (!isRecord(value)) return null;

  const windowWidth = toNumber(value.windowWidth);
  const windowHeight = toNumber(value.windowHeight);
  if (!windowWidth && !windowHeight) return null;

  return {
    statusBarHeight: toNumber(value.statusBarHeight, 20),
    windowWidth,
    windowHeight,
    safeArea: readSafeArea(value.safeArea),
    menuButtonRect: readRect(value.menuButtonRect),
    updatedAt: toNumber(value.updatedAt)
  };
}

function readCachedSystemInfo() {
  return normalizeSnapshot(uniPlatform.storage.getSync<SystemInfoSnapshot>(APP_STORAGE_KEYS.systemInfoSnapshot));
}

function writeCachedSystemInfo(info: SystemInfoState) {
  uniPlatform.storage.setSync<SystemInfoSnapshot>(APP_STORAGE_KEYS.systemInfoSnapshot, {
    ...info,
    updatedAt: Date.now()
  });
}

function getMenuButtonRect() {
  return uniPlatform.system.getMenuButtonRect() ?? undefined;
}

function readWindowInfo(): WindowInfo | undefined {
  const windowInfo = uniPlatform.system.getWindowInfo();
  if (windowInfo) return windowInfo;

  if (typeof window === "undefined") return undefined;

  return {
    statusBarHeight: 0,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight
  };
}

export function initSystemInfo() {
  if (initialized) return;
  initialized = true;

  const cachedInfo = readCachedSystemInfo();
  if (cachedInfo) {
    systemInfo.value = cachedInfo;
  }

  try {
    const info = readWindowInfo();
    const nextInfo = {
      statusBarHeight: info?.statusBarHeight ?? 20,
      windowWidth: info?.windowWidth ?? 0,
      windowHeight: info?.windowHeight ?? 0,
      safeArea: info?.safeArea,
      menuButtonRect: getMenuButtonRect()
    };
    systemInfo.value = nextInfo;
    writeCachedSystemInfo(nextInfo);
  } catch {
    if (!cachedInfo) {
      systemInfo.value = {
        statusBarHeight: 20,
        windowWidth: 0,
        windowHeight: 0
      };
    }
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

  const navSideGuardWidth = computed(() => {
    const rect = systemInfo.value.menuButtonRect;
    if (!rect || !systemInfo.value.windowWidth) return navBarHeight.value;

    const rightGap = Math.max(0, systemInfo.value.windowWidth - rect.right);
    return Math.ceil(rect.width + rightGap);
  });

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
    navSideGuardWidth,
    safeAreaBottom,
    tabBarHeight
  };
}
