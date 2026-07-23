export const APP_NAME = "下一餐";
export const APP_VERSION = "0.1.0";
export const APP_STORAGE_PREFIX = "next_meal_";

function buildStorageKey(name: string) {
  return `${APP_STORAGE_PREFIX}${name}`;
}

export const APP_META = Object.freeze({
  name: APP_NAME,
  version: APP_VERSION,
  storagePrefix: APP_STORAGE_PREFIX
});

export const APP_STORAGE_KEYS = Object.freeze({
  session: buildStorageKey("session"),
  settings: buildStorageKey("settings"),
  systemInfoSnapshot: buildStorageKey("system_info_snapshot"),
  userProfile: buildStorageKey("user_profile")
});
