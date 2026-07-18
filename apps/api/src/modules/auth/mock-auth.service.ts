import { Injectable } from "@nestjs/common";
import type { AdminLoginRequest, AdminLoginResult, UserProfile, WechatLoginRequest, WechatLoginResult } from "@next-meal/api-client";

const now = "2026-07-18T10:30:00Z";

@Injectable()
export class MockAuthService {
  private readonly user: UserProfile = {
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
    createdAt: now,
    updatedAt: now
  };

  loginWithWechat(_body: WechatLoginRequest): WechatLoginResult {
    return {
      token: "mock-user-token",
      expiresAt: "2026-07-19T10:30:00Z",
      user: this.user
    };
  }

  getCurrentUser() {
    return this.user;
  }

  updateCurrentUser(body: Partial<UserProfile>) {
    this.user.nickname = body.nickname ?? this.user.nickname;
    this.user.avatarUrl = body.avatarUrl ?? this.user.avatarUrl;
    this.user.phone = body.phone ?? this.user.phone;
    this.user.updatedAt = new Date().toISOString();

    return this.user;
  }

  loginAdmin(body: AdminLoginRequest): AdminLoginResult {
    return {
      token: "mock-admin-token",
      expiresAt: "2026-07-19T10:30:00Z",
      admin: {
        id: "00000000-0000-4000-8000-0000000000a1",
        username: body.username,
        displayName: "系统管理员",
        roles: ["ADMIN"]
      }
    };
  }

  listUsers(page: number, pageSize: number, keyword?: string) {
    const items = keyword && !this.user.nickname?.includes(keyword) ? [] : [this.user];

    return {
      items,
      page,
      pageSize,
      total: items.length,
      hasNext: false
    };
  }
}
