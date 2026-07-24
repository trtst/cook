/**
 * 小程序平台适配层。
 *
 * 这个文件不是业务工具函数集合，而是 uni-app / 微信小程序能力的统一入口。
 * 当前项目要求业务代码不要直接散落调用 `uni.*` / `wx.*`，而是先收口到这里，
 * 再由页面、store、composable 按需消费这里暴露出的最小稳定接口。
 *
 * 这里负责的事情只有“端能力封装”：
 * 1. 系统信息读取。
 * 2. 本地存储读写。
 * 3. 页面导航。
 * 4. Toast 反馈。
 * 5. 剪贴板写入。
 *
 * 这里不负责的事情：
 * 1. 登录态判断。
 * 2. 用户权限、套餐、饭搭子状态。
 * 3. 接口契约、业务字段转换。
 * 4. 页面级交互编排。
 *
 * 之所以不放进 `utils/`，是因为 `utils/` 在这个项目里表示通用工具；
 * 而这里承载的是明确的平台边界。单独放在 `platform/`，可以避免业务层
 * 把平台调用误当成普通工具继续扩散。
 */
interface ClientPlatform {
	/**
	 * 系统相关只读能力。
	 * 这一组只暴露页面布局、主题监听所需的最小读取接口。
	 */
	system: {
		getWindowInfo(): WindowInfo | null;
		getMenuButtonRect(): MenuButtonRect | null;
		getAppBaseInfo(): AppBaseInfo | null;
		getRuntimeChannel(): RuntimeChannel;
		onThemeChange(listener: (result: ThemeChangeResult) => void): void;
	};
	/**
	 * 本地存储能力。
	 * 同时保留 sync / async 两套接口，方便页面启动阶段和普通业务代码分别使用。
	 */
	storage: {
		get<T>(key: string): Promise<T | null>;
		set<T>(key: string, value: T): Promise<void>;
		remove(key: string): Promise<void>;
		getSync<T>(key: string): T | null;
		setSync<T>(key: string, value: T): void;
		removeSync(key: string): void;
	};
	/**
	 * 页面路由能力。
	 * 这里统一封装不同跳转方式，避免业务层散落 `uni.navigateTo` 等直接调用。
	 */
	navigation: {
		navigateTo(path: string): Promise<void>;
		redirectTo(path: string): Promise<void>;
		switchTab(path: string): Promise<void>;
		reLaunch(path: string): Promise<void>;
		navigateBack(delta?: number): Promise<void>;
	};
	/**
	 * 轻量反馈能力。
	 * 当前只暴露 Toast；后续如果出现真实需求，再扩展到 modal / loading。
	 */
	feedback: {
		toast(options: { title: string; icon?: "success" | "error" | "loading" | "none" }): Promise<void>;
	};
	/**
	 * 剪贴板能力。
	 * 目前只需要写入；读取能力没有真实场景时不提前增加。
	 */
	clipboard: {
		set(data: string): Promise<void>;
	};
}

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

interface WindowInfo {
	statusBarHeight?: number;
	windowWidth?: number;
	windowHeight?: number;
	safeArea?: SafeArea;
}

interface AppBaseInfo {
	theme?: string;
}

interface ThemeChangeResult {
	theme?: string;
}

type RuntimeChannel = "mini_program" | "h5" | "pc" | "ios" | "android" | "harmony";

interface UniSystemApi {
	getWindowInfo?: () => WindowInfo;
	getMenuButtonBoundingClientRect?: () => MenuButtonRect;
	getAppBaseInfo?: () => AppBaseInfo;
	onThemeChange?: (listener: (result: ThemeChangeResult) => void) => void;
}

/**
 * 客户端本地缓存统一前缀。
 * 所有小程序本地 key 都从这里派生，避免与其他项目、历史调试数据混用。
 */
const STORAGE_PREFIX = "next_meal_";

function buildStorageKey(name: string) {
	return `${STORAGE_PREFIX}${name}`;
}

/**
 * 平台层统一维护的本地存储 key。
 * 这些 key 与具体存储实现强相关，所以与 storage 封装放在同一文件维护。
 */
export const APP_STORAGE_KEYS = Object.freeze({
	session: buildStorageKey("session"),
	settings: buildStorageKey("settings"),
	systemInfoSnapshot: buildStorageKey("system_info_snapshot"),
	userProfile: buildStorageKey("user_profile")
});

/**
 * 把 success / fail 风格的 uni API 转成 Promise，给上层稳定的 async/await 调用方式。
 */
function callUni<T>(runner: (resolve: (value: T) => void, reject: (reason: unknown) => void) => void): Promise<T> {
	return new Promise<T>((resolve, reject) => runner(resolve, reject));
}

/**
 * 统一封装四种页面跳转。
 * 上层只传目标路径和跳转类型，不直接感知具体 `uni.*` API。
 */
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

/**
 * 返回上一页。
 * 默认后退一级，供导航栏返回按钮等通用场景复用。
 */
function navigateBack(delta = 1) {
	return callUni<void>((resolve, reject) => {
		uni.navigateBack({
			delta,
			success: () => resolve(),
			fail: reject
		});
	});
}

/**
 * 统一 Toast 出口。
 * 页面只关心提示文案和图标，不直接触碰平台细节。
 */
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

/**
 * 统一剪贴板写入出口。
 */
function setClipboardData(data: string) {
	return callUni<void>((resolve, reject) => {
		uni.setClipboardData({
			data,
			success: () => resolve(),
			fail: reject
		});
	});
}

/**
 * 收口系统能力相关的非标准类型声明。
 * 某些 uni 能力在不同端或不同类型版本下不是完整静态声明，这里统一做一次窄化。
 */
function getUniSystemApi() {
	return uni as unknown as UniSystemApi;
}

function getRuntimeChannel(): RuntimeChannel {
	if (typeof navigator === "undefined") return "mini_program";

	const userAgent = navigator.userAgent.toLowerCase();
	if (/harmonyos|openharmony/.test(userAgent)) return "harmony";
	if (/android/.test(userAgent)) return "android";
	if (/iphone|ipad|ipod/.test(userAgent)) return "ios";

	return /mobile/.test(userAgent) ? "h5" : "pc";
}

/**
 * 对业务层暴露的统一平台对象。
 * 业务代码应优先依赖这里，而不是直接散落访问 `uni.*`。
 */
export const uniPlatform: ClientPlatform = {
	system: {
		getWindowInfo() {
			try {
				return getUniSystemApi().getWindowInfo?.() ?? null;
			} catch {
				return null;
			}
		},
		getMenuButtonRect() {
			try {
				return getUniSystemApi().getMenuButtonBoundingClientRect?.() ?? null;
			} catch {
				return null;
			}
		},
		getAppBaseInfo() {
			try {
				return getUniSystemApi().getAppBaseInfo?.() ?? null;
			} catch {
				return null;
			}
		},
		getRuntimeChannel() {
			return getRuntimeChannel();
		},
		onThemeChange(listener) {
			try {
				getUniSystemApi().onThemeChange?.(listener);
			} catch {
				// Unsupported platforms simply do not emit theme changes.
			}
		}
	},
	storage: {
		/**
		 * 同步读取本地缓存。
		 * uni 在无值时可能返回空字符串或 `undefined`，这里统一归一成 `null`。
		 */
		getSync<T>(key: string) {
			const value = uni.getStorageSync(key);
			return value === "" || value === undefined ? null : (value as T);
		},
		/**
		 * 同步写入本地缓存。
		 */
		setSync<T>(key: string, value: T) {
			uni.setStorageSync(key, value);
		},
		/**
		 * 同步删除本地缓存。
		 */
		removeSync(key: string) {
			uni.removeStorageSync(key);
		},
		/**
		 * 异步接口当前复用同步实现。
		 * 这样上层可以统一使用 async/await，同时不额外引入一套重复逻辑。
		 */
		async get<T>(key: string) {
			return uniPlatform.storage.getSync<T>(key);
		},
		async set<T>(key: string, value: T) {
			uniPlatform.storage.setSync(key, value);
		},
		async remove(key: string) {
			uniPlatform.storage.removeSync(key);
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
