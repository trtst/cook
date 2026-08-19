import { showConfirm, type ConfirmOptions } from "@/feedback/confirm";
import { showToast, type ToastOptions } from "@/feedback/toast";

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
		measure(selector: string): Promise<ElementRect | null>;
		setKeepScreenOn(enabled: boolean): Promise<void>;
	};
	/**
	 * 本地存储能力。
	 * 同时保留 sync / async 两套接口，方便页面启动阶段和普通业务代码分别使用。
	 */
	storage: {
		get<T>(key: string): Promise<T | null>;
		set<T>(key: string, value: T): Promise<void>;
		remove(key: string): Promise<void>;
		keys(): Promise<string[]>;
		getSync<T>(key: string): T | null;
		setSync<T>(key: string, value: T): void;
		removeSync(key: string): void;
		keysSync(): string[];
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
		pageScrollTo(options: { selector?: string; scrollTop?: number; offsetTop?: number; duration?: number }): Promise<void>;
	};
	/**
	 * 轻量反馈能力。
	 * 这里暴露统一的自定义 Toast / Confirm 出口，避免业务层散落系统弹层调用。
	 */
	feedback: {
		toast(options: ToastOptions): Promise<void>;
		confirm(options: ConfirmOptions): Promise<boolean>;
		hideKeyboard(): Promise<void>;
	};
	auth: {
		login(): Promise<LoginCodeResult>;
	};
	/**
	 * 剪贴板能力。
	 * 目前只需要写入；读取能力没有真实场景时不提前增加。
	 */
	clipboard: {
		set(data: string): Promise<void>;
	};
	media: {
		chooseImage(options?: ChooseImageOptions): Promise<ChooseImageResult[]>;
		chooseMedia(options?: ChooseMediaOptions): Promise<ChooseMediaResult[]>;
		getImageInfo(src: string): Promise<ImageInfoResult>;
		previewImage(options: PreviewImageOptions): Promise<void>;
		saveFile(tempFilePath: string): Promise<SaveFileResult>;
		removeSavedFile(filePath: string): Promise<void>;
		createCanvasContext(canvasId: string, component?: unknown): UniApp.CanvasContext;
		canvasToTempFilePath(options: CanvasToTempFileOptions, component?: unknown): Promise<CanvasToTempFileResult>;
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

interface ElementRect {
	top: number;
	bottom: number;
	left: number;
	right: number;
	width: number;
	height: number;
}

interface ChooseImageCropOptions {
	width: number;
	height: number;
	quality?: number;
}

interface ChooseImageOptions {
	count?: number;
	sourceType?: Array<"album" | "camera">;
	sizeType?: Array<"original" | "compressed">;
	crop?: ChooseImageCropOptions | null;
}

interface ChooseImageResult {
	path: string;
	size: number;
	width?: number;
	height?: number;
}

interface ChooseMediaOptions {
	count?: number;
	mediaType?: Array<"image" | "video">;
	sourceType?: Array<"album" | "camera">;
	sizeType?: Array<"original" | "compressed">;
	camera?: "front" | "back";
	maxDuration?: number;
}

interface ChooseMediaResult {
	path: string;
	size: number;
	width?: number;
	height?: number;
	fileType?: "image" | "video";
	thumbTempFilePath?: string;
	duration?: number;
}

interface ImageInfoResult {
	path?: string;
	width: number;
	height: number;
	type?: string;
	orientation?: string;
}

interface PreviewImageOptions {
	urls: string[];
	current?: string;
}

interface CanvasToTempFileOptions {
	canvasId: string;
	x?: number;
	y?: number;
	width: number;
	height: number;
	destWidth?: number;
	destHeight?: number;
	fileType?: "jpg" | "png";
	quality?: number;
}

interface CanvasToTempFileResult {
	tempFilePath: string;
}

interface SaveFileResult {
	savedFilePath: string;
}

interface LoginCodeResult {
	code: string;
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
const STORAGE_PREFIX = "cook_meal_";

function buildStorageKey(name: string) {
	return `${STORAGE_PREFIX}${name}`;
}

/**
 * 平台层统一维护的本地存储 key。
 * 这些 key 与具体存储实现强相关，所以与 storage 封装放在同一文件维护。
 */
export const APP_STORAGE_KEYS = Object.freeze({
	session: buildStorageKey("session"),
	theme: buildStorageKey("theme"),
	systemInfoSnapshot: buildStorageKey("system_info_snapshot"),
	userProfile: buildStorageKey("user_profile"),
	imageCrop(token: string) {
		return buildStorageKey(`image_crop_${String(token || "").trim()}`);
	},
	recipeEdit(uid: number | string) {
		return buildStorageKey(`recipe_edit_${String(uid || "").trim()}`);
	}
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

function pageScrollTo(options: { selector?: string; scrollTop?: number; offsetTop?: number; duration?: number }) {
	return callUni<void>((resolve, reject) => {
		uni.pageScrollTo({
			selector: options.selector,
			scrollTop: options.scrollTop,
			offsetTop: options.offsetTop,
			duration: options.duration ?? 260,
			success: () => resolve(),
			fail: reject
		});
	});
}

function hideKeyboard() {
	return Promise.resolve().then(() => {
		uni.hideKeyboard();
	});
}

function login() {
	return callUni<LoginCodeResult>((resolve, reject) => {
		if (getRuntimeChannel() !== "mini_program") {
			reject(new Error("当前环境不支持微信登录"));
			return;
		}

		uni.login({
			provider: "weixin",
			success: (result: { code?: string }) => {
				const code = typeof result.code === "string" ? result.code.trim() : "";
				if (!code) {
					reject(new Error("微信登录失败，请重试"));
					return;
				}

				resolve({ code });
			},
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

function chooseImage(options: ChooseImageOptions = {}) {
	return callUni<ChooseImageResult[]>((resolve, reject) => {
		const chooseOptions = {
			count: options.count ?? 1,
			sourceType: options.sourceType ?? ["album"],
			sizeType: options.sizeType ?? ["compressed"],
			crop: options.crop
				? {
						width: options.crop.width,
						height: options.crop.height,
						quality: options.crop.quality ?? 90,
						resize: true
				  }
				: undefined,
			success: (result: {
				tempFilePaths?: string[];
				tempFiles?: Array<{ path?: string; size?: number; width?: number; height?: number }>;
			}) => {
				const files =
					result.tempFiles?.map((item) => ({
						path: item.path || "",
						size: Number(item.size || 0),
						width: item.width,
						height: item.height
					})) ??
					(result.tempFilePaths ?? []).map((path) => ({
						path,
						size: 0
					}));
				resolve(files.filter((item) => item.path));
			},
			fail: reject
		};

		(uni.chooseImage as unknown as (payload: typeof chooseOptions) => void)(chooseOptions);
	});
}

function chooseMedia(options: ChooseMediaOptions = {}) {
	return callUni<ChooseMediaResult[]>((resolve, reject) => {
		uni.chooseMedia({
			count: options.count ?? 1,
			mediaType: options.mediaType ?? ["image"],
			sourceType: options.sourceType ?? ["album", "camera"],
			sizeType: options.sizeType ?? ["compressed"],
			camera: options.camera ?? "back",
			maxDuration: options.maxDuration ?? 30,
			success: (result: {
				tempFiles?: Array<{
					tempFilePath?: string;
					size?: number;
					width?: number;
					height?: number;
					fileType?: "image" | "video";
					thumbTempFilePath?: string;
					duration?: number;
				}>;
			}) => {
				resolve(
					(result.tempFiles ?? [])
						.map((item) => ({
							path: item.tempFilePath || "",
							size: Number(item.size || 0),
							width: item.width,
							height: item.height,
							fileType: item.fileType,
							thumbTempFilePath: item.thumbTempFilePath,
							duration: item.duration
						}))
						.filter((item) => item.path)
				);
			},
			fail: reject
		});
	});
}

function getImageInfo(src: string) {
	return callUni<ImageInfoResult>((resolve, reject) => {
		uni.getImageInfo({
			src,
			success: (result) => resolve(result as ImageInfoResult),
			fail: reject
		});
	});
}

function previewImage(options: PreviewImageOptions) {
	return callUni<void>((resolve, reject) => {
		uni.previewImage({
			urls: options.urls,
			current: options.current,
			success: () => resolve(),
			fail: reject
		});
	});
}

function saveFile(tempFilePath: string) {
	return callUni<SaveFileResult>((resolve, reject) => {
		uni.saveFile({
			tempFilePath,
			success: (result) => resolve({ savedFilePath: result.savedFilePath }),
			fail: reject
		});
	});
}

function removeSavedFile(filePath: string) {
	return callUni<void>((resolve, reject) => {
		uni.removeSavedFile({
			filePath,
			success: () => resolve(),
			fail: reject
		});
	});
}

function createCanvasContext(canvasId: string, component?: unknown) {
	return uni.createCanvasContext(canvasId, component as never);
}

function canvasToTempFilePath(options: CanvasToTempFileOptions, component?: unknown) {
	return callUni<CanvasToTempFileResult>((resolve, reject) => {
		uni.canvasToTempFilePath(
			{
				canvasId: options.canvasId,
				x: options.x ?? 0,
				y: options.y ?? 0,
				width: options.width,
				height: options.height,
				destWidth: options.destWidth ?? options.width,
				destHeight: options.destHeight ?? options.height,
				fileType: options.fileType ?? "jpg",
				quality: options.quality ?? 0.9,
				success: (result) => resolve({ tempFilePath: result.tempFilePath }),
				fail: reject
			},
			component as never
		);
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

function measure(selector: string) {
	return callUni<ElementRect | null>((resolve) => {
		const query = uni.createSelectorQuery();
		query.select(selector).boundingClientRect((rect) => {
			resolve((rect as ElementRect | null) ?? null);
		});
		query.exec();
	});
}

function setKeepScreenOn(enabled: boolean) {
	return callUni<void>((resolve, reject) => {
		uni.setKeepScreenOn({
			keepScreenOn: enabled,
			success: () => resolve(),
			fail: reject
		});
	});
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
		},
		measure(selector) {
			return measure(selector);
		},
		setKeepScreenOn(enabled) {
			return setKeepScreenOn(enabled);
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
		keysSync() {
			try {
				const result = uni.getStorageInfoSync();
				return Array.isArray(result.keys) ? result.keys.map(item => String(item || "").trim()).filter(Boolean) : [];
			} catch {
				return [];
			}
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
		},
		async keys() {
			return uniPlatform.storage.keysSync();
		}
	},
	navigation: {
		navigateTo: (path) => navigate(path, "navigateTo"),
		redirectTo: (path) => navigate(path, "redirectTo"),
		switchTab: (path) => navigate(path, "switchTab"),
		reLaunch: (path) => navigate(path, "reLaunch"),
		navigateBack,
		pageScrollTo
	},
	feedback: {
		toast: showToast,
		confirm: showConfirm,
		hideKeyboard
	},
	auth: {
		login
	},
	clipboard: {
		set: setClipboardData
	},
	media: {
		chooseImage,
		chooseMedia,
		getImageInfo,
		previewImage,
		saveFile,
		removeSavedFile,
		createCanvasContext,
		canvasToTempFilePath
	}
};
