import type { PlatformAdapter } from "@next-meal/platform";

function callUni<T>(runner: (resolve: (value: T) => void, reject: (reason: unknown) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => runner(resolve, reject));
}

function navigate(path: string, method: "navigateTo" | "redirectTo" | "switchTab" | "reLaunch") {
  return callUni<void>((resolve, reject) => {
    const options = {
      url: path,
      success: () => resolve(),
      fail: reject
    };

    if (method === "navigateTo") {
      uni.navigateTo(options);
      return;
    }

    if (method === "redirectTo") {
      uni.redirectTo(options);
      return;
    }

    if (method === "switchTab") {
      uni.switchTab(options);
      return;
    }

    uni.reLaunch(options);
  });
}

export const uniPlatform: PlatformAdapter = {
  auth: {
    login() {
      return callUni((resolve, reject) => {
        uni.login({
          provider: "weixin",
          success: (result) => resolve({ code: result.code }),
          fail: reject
        });
      });
    }
  },
  storage: {
    async get<T>(key: string) {
      const value = uni.getStorageSync(key);
      return value ? (value as T) : null;
    },
    async set<T>(key: string, value: T) {
      uni.setStorageSync(key, value);
    },
    async remove(key: string) {
      uni.removeStorageSync(key);
    }
  },
  navigation: {
    navigateTo: (path) => navigate(path, "navigateTo"),
    redirectTo: (path) => navigate(path, "redirectTo"),
    switchTab: (path) => navigate(path, "switchTab"),
    reLaunch: (path) => navigate(path, "reLaunch")
  },
  share: {
    buildShareMessage(options) {
      return options;
    }
  }
};
