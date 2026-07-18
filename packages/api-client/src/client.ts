import type {
  AcceptInviteRequest,
  AcceptInviteResult,
  AdminListRestaurantsQuery,
  AdminListRestaurantsResult,
  AdminListUsersQuery,
  AdminListUsersResult,
  AdminLoginRequest,
  AdminLoginResult,
  CreateInviteRequest,
  CreateInviteResult,
  CreateRestaurantRequest,
  CreateRestaurantResult,
  MyRestaurantsResult,
  RestaurantMembersResult,
  UpdateCurrentUserRequest,
  WechatLoginRequest,
  WechatLoginResult
} from "./contracts";
import { ApiClientError, HttpError, UnauthorizedError } from "./errors";
import type { ApiResponse, RestaurantSummary, UserProfile, UUID } from "./types";

export type AuthScheme = "none" | "user" | "admin";
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

export type ApiRequestAdapter = (request: ApiRequest) => Promise<ApiRequestResult>;

export interface ApiClientOptions {
  baseUrl: string;
  request: ApiRequestAdapter;
  getAuthHeader?: (scheme: Exclude<AuthScheme, "none">) => Promise<string | null> | string | null;
  onUnauthorized?: (error: UnauthorizedError) => Promise<void> | void;
}

interface RequestOptions {
  method?: HttpMethod;
  auth?: AuthScheme;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
}

function joinUrl(baseUrl: string, path: string, query?: RequestOptions["query"]) {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) {
      search.set(key, String(value));
    }
  }

  const queryText = search.toString();
  return `${base}${normalizedPath}${queryText ? `?${queryText}` : ""}`;
}

function encodePath(value: string) {
  return encodeURIComponent(value);
}

function isApiResponse<T>(body: unknown): body is ApiResponse<T> {
  if (typeof body !== "object" || body === null) return false;

  const candidate = body as Partial<ApiResponse<T>>;
  return typeof candidate.code === "number" && typeof candidate.message === "string" && "data" in candidate;
}

async function resolveHeaders(options: ApiClientOptions, auth: AuthScheme) {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  if (auth !== "none") {
    const authHeader = await options.getAuthHeader?.(auth);

    if (authHeader) {
      headers.Authorization = authHeader;
    }
  }

  return headers;
}

async function requestData<T>(options: ApiClientOptions, path: string, requestOptions: RequestOptions = {}) {
  const auth = requestOptions.auth ?? "user";
  const result = await options.request({
    url: joinUrl(options.baseUrl, path, requestOptions.query),
    method: requestOptions.method ?? "GET",
    headers: await resolveHeaders(options, auth),
    body: requestOptions.body
  });

  if (result.status === 401) {
    const error = new UnauthorizedError();
    await options.onUnauthorized?.(error);
    throw error;
  }

  if (result.status < 200 || result.status >= 300) {
    throw new HttpError(result.status, "请求失败");
  }

  if (!isApiResponse<T>(result.body)) {
    throw new HttpError(result.status, "响应格式不符合契约");
  }

  if (result.body.code === 401) {
    const error = new UnauthorizedError(result.body.message, result.body.data);
    await options.onUnauthorized?.(error);
    throw error;
  }

  if (result.body.code !== 0) {
    throw new ApiClientError(result.body.code, result.body.message, result.body.data);
  }

  return result.body.data;
}

export function createApiClient(options: ApiClientOptions) {
  return {
    auth: {
      loginWithWechat(body: WechatLoginRequest) {
        return requestData<WechatLoginResult>(options, "/auth/wechat/login", {
          method: "POST",
          auth: "none",
          body
        });
      }
    },
    user: {
      getCurrent() {
        return requestData<UserProfile>(options, "/users/me", {
          auth: "user"
        });
      },
      updateCurrent(body: UpdateCurrentUserRequest) {
        return requestData<UserProfile>(options, "/users/me", {
          method: "PUT",
          auth: "user",
          body
        });
      }
    },
    restaurant: {
      listMine() {
        return requestData<MyRestaurantsResult>(options, "/restaurants/mine", {
          auth: "user"
        });
      },
      create(body: CreateRestaurantRequest) {
        return requestData<CreateRestaurantResult>(options, "/restaurants", {
          method: "POST",
          auth: "user",
          body
        });
      },
      get(restaurantId: UUID) {
        return requestData<RestaurantSummary>(options, `/restaurants/${encodePath(restaurantId)}`, {
          auth: "user"
        });
      },
      listMembers(restaurantId: UUID) {
        return requestData<RestaurantMembersResult>(options, "/restaurant-members", {
          auth: "user",
          query: { restaurantId }
        });
      },
      createInvite(body: CreateInviteRequest) {
        return requestData<CreateInviteResult>(options, "/restaurant-invites", {
          method: "POST",
          auth: "user",
          body
        });
      },
      acceptInvite(inviteToken: string, body: AcceptInviteRequest) {
        return requestData<AcceptInviteResult>(options, `/restaurant-invites/${encodePath(inviteToken)}/accept`, {
          method: "POST",
          auth: "user",
          body
        });
      }
    },
    admin: {
      login(body: AdminLoginRequest) {
        return requestData<AdminLoginResult>(options, "/admin/auth/login", {
          method: "POST",
          auth: "none",
          body
        });
      },
      listUsers(query: AdminListUsersQuery) {
        return requestData<AdminListUsersResult>(options, "/admin/users", {
          auth: "admin",
          query: { ...query }
        });
      },
      listRestaurants(query: AdminListRestaurantsQuery) {
        return requestData<AdminListRestaurantsResult>(options, "/admin/restaurants", {
          auth: "admin",
          query: { ...query }
        });
      }
    }
  };
}
