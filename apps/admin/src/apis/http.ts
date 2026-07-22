import { useSessionStore } from "@/stores/session";
import { adminAppConfig } from "./config";

export type UUID = string;
export type IsoDateTime = string;

export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

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
  method?: "GET" | "POST";
  auth?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
}

function getRequestId() {
  return crypto.randomUUID();
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const base = adminAppConfig.apiBaseUrl.endsWith("/")
    ? adminAppConfig.apiBaseUrl.slice(0, -1)
    : adminAppConfig.apiBaseUrl;
  const routePath = path.startsWith("/") ? path : `/${path}`;
  const queryText = Object.entries(query ?? {})
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

  return `${base}${routePath}${queryText ? `?${queryText}` : ""}`;
}

function isApiResponse<T>(body: unknown): body is ApiResponse<T> {
  if (typeof body !== "object" || body === null) return false;

  const candidate = body as Partial<ApiResponse<T>>;
  return typeof candidate.code === "number" && typeof candidate.message === "string" && "data" in candidate;
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function clearUnauthorized() {
  useSessionStore().clearSession();
  const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (!window.location.pathname.startsWith("/login")) {
    window.location.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
  }
}

export async function requestData<T>(path: string, options: RequestOptions = {}) {
  const auth = options.auth ?? true;
  const token = auth ? useSessionStore().token : null;
  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "X-Admin-Version": adminAppConfig.appVersion,
      "X-Admin-Build": String(adminAppConfig.appBuild),
      "X-Platform": "admin-web",
      "X-Request-Id": getRequestId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    credentials: "omit"
  });
  const body = await readBody(response);

  if (!isApiResponse<T>(body)) {
    if (response.status === 401) {
      const error = new UnauthorizedError();
      if (auth) clearUnauthorized();
      throw error;
    }

    if (!response.ok) throw new HttpError(response.status, "请求失败");
    throw new HttpError(response.status, "响应格式不符合契约");
  }

  if (body.code === 401) {
    const error = new UnauthorizedError(body.message, body.data);
    if (auth) clearUnauthorized();
    throw error;
  }

  if (body.code !== 0) {
    throw new ApiClientError(body.code, body.message, body.data);
  }

  if (!response.ok) throw new HttpError(response.status, "请求失败");
  return body.data;
}
