/**
 * uni-app 运行时适配层。
 *
 * 这里只处理“小程序/uni 请求 API 如何发出去”：
 * 1. 把上层请求对象翻译成 `uni.request / uni.uploadFile / uni.downloadFile`。
 * 2. 统一追加平台识别头和客户端版本头。
 * 3. 统一把相对 path 转成最终 URL。
 *
 * 这里不处理业务错误码，也不决定某个接口该走哪个业务域名；
 * 那些规则属于 `http.ts` 和各业务 API 模块。
 */
import { cfg, type CookFrom } from "@/config";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRequest {
	url: string;
	method: HttpMethod;
	headers: Record<string, string>;
	body?: unknown;
}

export interface ApiRequestResult {
	status: number;
	body: unknown;
}

const cookFromValues = new Set(["mini_program", "h5", "pc", "ios", "android", "harmony"]);

export interface FileResult {
	status: number;
	body: unknown;
}

export interface UploadFileOptions {
	url: string;
	filePath: string;
	name: string;
	headers?: Record<string, string>;
	formData?: Record<string, string | number | boolean>;
}

export interface DownloadFileOptions {
	url: string;
	headers?: Record<string, string>;
}

export interface DownloadFileResult {
	status: number;
	tempFilePath: string;
}

type UniSystemInfoSyncApi = typeof uni & {
	getSystemInfoSync?: () => {
		platform?: string;
	};
};

/**
 * 只接受项目明确允许的来源枚举，避免把任意环境变量内容直接透传到请求头里。
 */
function readCookFrom(value: string | undefined): CookFrom | null {
	if (!value || !cookFromValues.has(value)) return null;
	return value as CookFrom;
}

/**
 * H5 场景下尽量从 UA 推断来源；小程序和受限运行时则回退到固定值。
 * 这里的判断只影响埋点/环境识别，不参与权限决策。
 */
function detectCookFrom(): CookFrom | null {
	if (typeof navigator === "undefined") return null;

	const userAgent = navigator.userAgent.toLowerCase();
	if (/harmonyos|openharmony/.test(userAgent)) return "harmony";
	if (/android/.test(userAgent)) return "android";
	if (/iphone|ipad|ipod/.test(userAgent)) return "ios";

	const isMobile = /mobile/.test(userAgent);
	return isMobile ? "h5" : "pc";
}

function getCookFrom() {
	return readCookFrom(cfg.cookFrom) ?? detectCookFrom() ?? "mini_program";
}

function readMiniProgramPlatform() {
	try {
		return ((uni as UniSystemInfoSyncApi).getSystemInfoSync?.().platform ?? "").toLowerCase();
	} catch {
		return "";
	}
}

function isRealMiniProgramDevice() {
	return getCookFrom() === "mini_program" && readMiniProgramPlatform() !== "devtools";
}

function isLocalhostHost(hostname: string) {
	const host = hostname.trim().toLowerCase();
	return host === "localhost" || host === "::1" || host.startsWith("127.");
}

function assertMiniProgramUploadUrl(url: string) {
	if (!isRealMiniProgramDevice()) return;

	let hostname = "";
	try {
		hostname = new URL(url).hostname;
	} catch {
		return;
	}

	if (!isLocalhostHost(hostname)) return;

	throw new Error("真机上传不能直连 127.0.0.1/localhost，请把 VITE_API_BASE_URL 改成手机可访问的局域网 IP 或 HTTPS 域名");
}

/**
 * 平台头统一在适配层注入，避免业务层漏传或传出不一致的版本信息。
 */
function buildHeaders(headers: Record<string, string>) {
	return {
		...headers,
		"X-Cook-From": getCookFrom(),
		"X-Cook-Version": cfg.cookVersion
	};
}

/**
 * 只在传入相对路径时拼接默认 API 地址；绝对地址原样透传。
 * 业务模块如果需要不同域名，应该在上层直接传完整 URL，而不是把域名判断压到适配层。
 */
function buildUrl(url: string) {
	if (/^https?:\/\//i.test(url)) return url;

	const base = cfg.apiUrl.endsWith("/") ? cfg.apiUrl.slice(0, -1) : cfg.apiUrl;
	const path = url.startsWith("/") ? url : `/${url}`;
	return `${base}${path}`;
}

/**
 * uni.uploadFile 返回体可能是字符串，这里做一次安全解析。
 * 解析失败时保留原始字符串，避免因为非 JSON 响应再次抛出二次错误。
 */
function parseBody(data: unknown) {
	if (typeof data !== "string") return data;

	try {
		return JSON.parse(data);
	} catch {
		return data;
	}
}

export function uniRequestAdapter(request: ApiRequest): Promise<ApiRequestResult> {
	return new Promise((resolve, reject) => {
		uni.request({
			url: request.url,
			method: request.method,
			header: buildHeaders(request.headers),
			data: request.body as never,
			success: (response) => {
				resolve({
					status: response.statusCode,
					body: response.data
				});
			},
			fail: (error) => {
				reject(new Error(`请求未发出或被小程序环境拦截：${error.errMsg || request.url}`));
			}
		});
	});
}

/**
 * 上传/下载先维持默认域名策略。
 * 如果未来某个文件接口明确迁到独立域名，再在这里扩展更合适，
 * 不提前把不确定的 domain 入口暴露给所有调用方。
 */
export function uploadFile(options: UploadFileOptions): Promise<FileResult> {
	const url = buildUrl(options.url);
	assertMiniProgramUploadUrl(url);
	return new Promise((resolve, reject) => {
		uni.uploadFile({
			url,
			filePath: options.filePath,
			name: options.name,
			header: buildHeaders(options.headers ?? {}),
			formData: options.formData,
			success: (response) => {
				resolve({
					status: response.statusCode,
					body: parseBody(response.data)
				});
			},
			fail: (error) => {
				reject(new Error(`上传请求未发出或被小程序环境拦截：${error.errMsg || options.url}`));
			}
		});
	});
}

export function downloadFile(options: DownloadFileOptions): Promise<DownloadFileResult> {
	return new Promise((resolve, reject) => {
		uni.downloadFile({
			url: buildUrl(options.url),
			header: buildHeaders(options.headers ?? {}),
			success: (response) => {
				resolve({
					status: response.statusCode,
					tempFilePath: response.tempFilePath
				});
			},
			fail: (error) => {
				reject(new Error(`下载请求未发出或被小程序环境拦截：${error.errMsg || options.url}`));
			}
		});
	});
}
