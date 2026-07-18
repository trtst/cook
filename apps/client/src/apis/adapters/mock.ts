import type { ApiRequest, ApiRequestResult, ApiResponse, RestaurantSummary, UserProfile } from "@next-meal/api-client";

const user: UserProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  nickname: "下一餐用户",
  avatarUrl: null,
  phone: null,
  membership: {
    tier: "PLUS",
    status: "ACTIVE",
    skinEntitlements: ["handdrawn-food", "warm-couple", "apple-glass"],
    expiresAt: "2026-08-18T10:30:00Z"
  },
  status: "ACTIVE",
  createdAt: "2026-07-18T10:30:00Z",
  updatedAt: "2026-07-18T10:30:00Z"
};

const restaurant: RestaurantSummary = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "我们家餐厅",
  ownerId: user.id,
  collaborationMode: "PERSONAL",
  sharedQuotaPolicy: "ALL_WRITERS",
  memberLimit: 4,
  status: "ACTIVE",
  version: 1,
  myRole: "OWNER",
  myMemberStatus: "ACTIVE",
  memberCount: 1,
  createdAt: "2026-07-18T10:30:00Z",
  updatedAt: "2026-07-18T10:30:00Z"
};

function ok<T>(data: T): ApiResponse<T> {
  return {
    code: 0,
    message: "ok",
    data,
    serverTime: new Date().toISOString()
  };
}

function readPath(url: string) {
  return new URL(url, "http://mock.local").pathname;
}

function unauthorized(): ApiRequestResult {
  return {
    status: 401,
    body: {
      code: 401,
      message: "未登录或 token 失效",
      data: null,
      serverTime: new Date().toISOString()
    }
  };
}

function hasAuth(request: ApiRequest) {
  return Boolean(request.headers.Authorization);
}

export async function mockRequestAdapter(request: ApiRequest): Promise<ApiRequestResult> {
  const path = readPath(request.url);

  if (path === "/auth/wechat/login" && request.method === "POST") {
    return {
      status: 200,
      body: ok({
        token: "mock-user-token",
        expiresAt: "2026-07-19T10:30:00Z",
        user
      })
    };
  }

  if (!hasAuth(request)) {
    return unauthorized();
  }

  if (path === "/users/me" && request.method === "GET") {
    return { status: 200, body: ok(user) };
  }

  if (path === "/restaurants/mine" && request.method === "GET") {
    return {
      status: 200,
      body: ok({
        restaurants: [restaurant],
        currentRestaurantId: restaurant.id,
        limits: {
          ownedLimit: 1,
          joinedLimit: 3,
          freeMemberLimit: 4
        }
      })
    };
  }

  return {
    status: 404,
    body: {
      code: 404,
      message: "mock 接口不存在",
      data: null,
      serverTime: new Date().toISOString()
    }
  };
}
