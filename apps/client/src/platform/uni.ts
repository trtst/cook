interface ClientPlatform {
  storage: {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
  };
  navigation: {
    navigateTo(path: string): Promise<void>;
    redirectTo(path: string): Promise<void>;
    switchTab(path: string): Promise<void>;
    reLaunch(path: string): Promise<void>;
    navigateBack(delta?: number): Promise<void>;
  };
  feedback: {
    toast(options: { title: string; icon?: "success" | "error" | "loading" | "none" }): Promise<void>;
  };
  clipboard: {
    set(data: string): Promise<void>;
  };
}

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

function navigateBack(delta = 1) {
  return callUni<void>((resolve, reject) => {
    uni.navigateBack({
      delta,
      success: () => resolve(),
      fail: reject
    });
  });
}

function showToast(options: { title: string; icon?: "success" | "error" | "loading" | "none" }) {
  return callUni<void>((resolve, reject) => {
    uni.showToast({
      title: options.title,
      icon: options.icon,
      success: () => resolve(),
      fail: reject
    });
  });
}

function setClipboardData(data: string) {
  return callUni<void>((resolve, reject) => {
    uni.setClipboardData({
      data,
      success: () => resolve(),
      fail: reject
    });
  });
}

export const uniPlatform: ClientPlatform = {
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
    reLaunch: (path) => navigate(path, "reLaunch"),
    navigateBack
  },
  feedback: {
    toast: showToast
  },
  clipboard: {
    set: setClipboardData
  }
};
