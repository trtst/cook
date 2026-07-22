/**
 * 客户端请求层主入口。
 *
 * 责任边界：
 * 1. 统一拼接 URL、query 和 HTTP method，避免页面或 store 自己处理请求细节。
 * 2. 统一注入用户鉴权头，并在鉴权失效时执行本地会话清理。
 * 3. 统一校验服务端响应契约，只把 `data` 暴露给业务层。
 *
 * 非目标：
 * 1. 不在这里编排业务参数，也不做多字段兜底。
 * 2. 不在这里推断接口属于哪个域名，域名归属必须由各业务 API 模块显式声明。
 */
import { emitSessionCleared } from "@/utils/session-events";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import {
	downloadFile as uniDownloadFile,
	uniRequestAdapter,
	uploadFile as uniUploadFile,
	type DownloadFileOptions,
	type HttpMethod,
	type UploadFileOptions
} from "./adapters/uni";

export type UUID = string;
export type IsoDateTime = string;

/**
 * 业务成功返回了 JSON 契约，但 `code !== 0`。
 * 调用方可以读取 `code` 和 `data` 做业务级提示，不需要再关心 transport 层细节。
 */
export class ApiClientError<T = unknown> extends Error {
	constructor(
		readonly code: number,
		message: string,
		readonly data: T | null = null
	) {
		super(message);
		this.name = "ApiClientError";
	}
}

export class UnauthorizedError<T = unknown> extends ApiClientError<T> {
	constructor(message = "未登录或 token 失效", data: T | null = null) {
		super(401, message, data);
		this.name = "UnauthorizedError";
	}
}

export class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
		this.name = "HttpError";
	}
}

interface ApiResponse<T> {
	code: number;
	message: string;
	data: T;
	serverTime: IsoDateTime;
}

interface RequestOptions {
	auth?: boolean;
	query?: Record<string, string | number | boolean | null | undefined>;
	body?: unknown;
}

/**
 * 把 URL 和 query 拼成最终请求地址。
 * 业务模块现在自己声明模块级 base URL；这里既支持完整 URL，也兼容少量相对路径。
 */
function buildUrl(url: string, query?: RequestOptions["query"]) {
	const routeUrl = /^https?:\/\//i.test(url) ? url : url.startsWith("/") ? url : `/${url}`;
	const queryText = Object.entries(query ?? {})
		.filter(([, value]) => value !== null && value !== undefined)
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
		.join("&");

	return `${routeUrl}${queryText ? `?${queryText}` : ""}`;
}

function isApiResponse<T>(body: unknown): body is ApiResponse<T> {
	if (typeof body !== "object" || body === null) return false;

	const candidate = body as Partial<ApiResponse<T>>;
	return typeof candidate.code === "number" && typeof candidate.message === "string" && "data" in candidate;
}

/**
 * 401 的收口处理必须只保留在请求层：
 * 这样可以确保所有需要登录的接口在 token 失效时执行同一套清理流程，
 * 避免页面各自处理导致状态残留或重复跳转。
 */
async function clearUnauthorized(error: UnauthorizedError) {
	await useSessionStore().clearSession();
	useUserStore().clearProfile();
	await emitSessionCleared();
	throw error;
}

/**
 * 统一的底层请求方法。
 * 公开的 `get/post/put/del` 都会走这里，从而共享同一套鉴权与错误处理逻辑。
 */
async function requestByMethod<T>(method: HttpMethod, url: string, options: RequestOptions = {}) {
	const auth = options.auth ?? true;
	const token = auth ? useSessionStore().token : "";
	const result = await uniRequestAdapter({
		url: buildUrl(url, options.query),
		method,
		headers: {
			"content-type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {})
		},
		body: options.body
	});

	if (!isApiResponse<T>(result.body)) {
		if (result.status === 401) {
			const error = new UnauthorizedError();
			if (auth) await clearUnauthorized(error);
			throw error;
		}

		if (result.status < 200 || result.status >= 300) {
			throw new HttpError(result.status, "请求失败");
		}

		throw new HttpError(result.status, "响应格式不符合契约");
	}

	if (result.body.code === 401) {
		const error = new UnauthorizedError(result.body.message, result.body.data);
		if (auth) await clearUnauthorized(error);
		throw error;
	}

	if (result.body.code !== 0) {
		throw new ApiClientError(result.body.code, result.body.message, result.body.data);
	}

	if (result.status < 200 || result.status >= 300) {
		throw new HttpError(result.status, "请求失败");
	}

	return result.body.data;
}

/**
 * GET 只接受 query，不接受 body，调用形态贴近常见业务封装。
 */
export function get<T>(url: string, query?: RequestOptions["query"], options: Omit<RequestOptions, "query" | "body"> = {}) {
	return requestByMethod<T>("GET", url, {
		...options,
		query
	});
}

/**
 * POST 统一把第二个参数视为请求体，避免业务层重复书写 `method: "POST"`。
 */
export function post<T>(url: string, body?: unknown, options: Omit<RequestOptions, "body" | "query"> & { query?: RequestOptions["query"] } = {}) {
	return requestByMethod<T>("POST", url, {
		...options,
		body
	});
}

export function put<T>(url: string, body?: unknown, options: Omit<RequestOptions, "body" | "query"> & { query?: RequestOptions["query"] } = {}) {
	return requestByMethod<T>("PUT", url, {
		...options,
		body
	});
}

export function del<T>(url: string, query?: RequestOptions["query"], options: Omit<RequestOptions, "query" | "body"> = {}) {
	return requestByMethod<T>("DELETE", url, {
		...options,
		query
	});
}

function withAuth(headers: Record<string, string> = {}) {
	const token = useSessionStore().token;

	return {
		...headers,
		...(token ? { Authorization: `Bearer ${token}` } : {})
	};
}

/**
 * 文件上传仍复用同一套用户鉴权头。
 * 这里不暴露 domain 参数，原因是当前上传接口尚未进入多域名细分场景，
 * 过早开放额外入口只会增加调用面的不确定性。
 */
export function uploadFile(options: UploadFileOptions) {
	return uniUploadFile({
		...options,
		headers: withAuth(options.headers)
	});
}

/**
 * 下载也统一附带鉴权头，避免页面自己拼 Authorization。
 */
export function downloadFile(options: DownloadFileOptions) {
	return uniDownloadFile({
		...options,
		headers: withAuth(options.headers)
	});
}
