import type {
  AcceptInviteResult,
  ApiRequest,
  ApiRequestResult,
  ApiResponse,
  CreateDiningGroupResult,
  CreateInviteResult,
  DiningGroupMembersResult,
  DiningGroupSummary,
  UserProfile
} from "@next-meal/api-client";

const user: UserProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  uid: 52738164,
  nickname: "下一餐用户",
  avatarUrl: null,
  phone: "13800000000",
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

const diningGroup: DiningGroupSummary = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "我的饭搭子",
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

function readSearchParams(url: string) {
  return new URL(url, "http://mock.local").searchParams;
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

  if (path === "/auth/login" && request.method === "POST") {
    const body = request.body as { phone?: string; password?: string };
    if (body.phone !== "13800000000" || body.password !== "change-me") {
      return unauthorized();
    }

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

  if (path === "/dining-groups/mine" && request.method === "GET") {
    return {
      status: 200,
      body: ok({
        diningGroups: [diningGroup],
        currentDiningGroupId: diningGroup.id,
        limits: {
          ownedLimit: 1,
          joinedLimit: 3,
          freeMemberLimit: 4
        }
      })
    };
  }

  if (path === "/dining-groups" && request.method === "POST") {
    const body = request.body as { name?: string };
    const nextDiningGroup: DiningGroupSummary = {
      ...diningGroup,
      id: "10000000-0000-4000-8000-000000000002",
      name: body.name?.trim() || "我的饭搭子"
    };

    return {
      status: 200,
      body: ok<CreateDiningGroupResult>({
        diningGroup: nextDiningGroup,
        ownerMember: {
          id: "20000000-0000-4000-8000-000000000001",
          diningGroupId: nextDiningGroup.id,
          user,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: "2026-07-18T10:30:00Z",
          invitedAt: null,
          version: 1
        }
      })
    };
  }

  if (path === "/dining-group-members" && request.method === "GET") {
    const diningGroupId = readSearchParams(request.url).get("diningGroupId") ?? diningGroup.id;

    return {
      status: 200,
      body: ok<DiningGroupMembersResult>({
        diningGroupId,
        members: [
          {
            id: "20000000-0000-4000-8000-000000000001",
            diningGroupId,
            user,
            role: "OWNER",
            status: "ACTIVE",
            joinedAt: "2026-07-18T10:30:00Z",
            invitedAt: null,
            version: 1
          }
        ]
      })
    };
  }

  if (path === "/dining-group-invites" && request.method === "POST") {
    return {
      status: 200,
      body: ok<CreateInviteResult>({
        inviteToken: "mock-invite-token",
        sharePath: "/pages_restaurant/invite/index?token=mock-invite-token",
        expiresAt: "2026-07-19T10:30:00Z"
      })
    };
  }

  if (path === "/dining-group-invites/mock-invite-token/accept" && request.method === "POST") {
    return {
      status: 200,
      body: ok<AcceptInviteResult>({
        diningGroup,
        member: {
          id: "20000000-0000-4000-8000-000000000001",
          diningGroupId: diningGroup.id,
          user,
          role: "MEMBER",
          status: "ACTIVE",
          joinedAt: "2026-07-18T10:30:00Z",
          invitedAt: null,
          version: 1
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
