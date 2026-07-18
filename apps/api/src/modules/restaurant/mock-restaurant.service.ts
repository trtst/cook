import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  AcceptInviteResult,
  CreateInviteResult,
  CreateRestaurantResult,
  MyRestaurantsResult,
  PageResult,
  RestaurantMemberSummary,
  RestaurantMembersResult,
  RestaurantSummary
} from "@next-meal/api-client";

const now = "2026-07-18T10:30:00Z";
const restaurantId = "10000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000001";
const memberId = "20000000-0000-4000-8000-000000000001";

@Injectable()
export class MockRestaurantService {
  private restaurant: RestaurantSummary = {
    id: restaurantId,
    name: "我们家餐厅",
    ownerId: userId,
    collaborationMode: "PERSONAL",
    sharedQuotaPolicy: "ALL_WRITERS",
    memberLimit: 4,
    status: "ACTIVE",
    version: 1,
    myRole: "OWNER",
    myMemberStatus: "ACTIVE",
    memberCount: 1,
    createdAt: now,
    updatedAt: now
  };

  private readonly ownerMember: RestaurantMemberSummary = {
    id: memberId,
    restaurantId,
    user: {
      id: userId,
      nickname: "下一餐用户",
      avatarUrl: null
    },
    role: "OWNER",
    status: "ACTIVE",
    joinedAt: now,
    invitedAt: null,
    version: 1
  };

  listMine(): MyRestaurantsResult {
    return {
      restaurants: [this.restaurant],
      currentRestaurantId: this.restaurant.id,
      limits: {
        ownedLimit: 1,
        joinedLimit: 3,
        freeMemberLimit: 4
      }
    };
  }

  create(name: string): CreateRestaurantResult {
    this.restaurant = {
      ...this.restaurant,
      name,
      updatedAt: new Date().toISOString(),
      version: this.restaurant.version + 1
    };

    return {
      restaurant: this.restaurant,
      ownerMember: this.ownerMember
    };
  }

  get(id: string): RestaurantSummary {
    this.assertRestaurant(id);
    return this.restaurant;
  }

  listMembers(id: string): RestaurantMembersResult {
    this.assertRestaurant(id);

    return {
      restaurantId: id,
      members: [this.ownerMember]
    };
  }

  createInvite(id: string): CreateInviteResult {
    this.assertRestaurant(id);

    return {
      inviteToken: "mock-invite-token",
      sharePath: `/pages_restaurant/invite/index?token=mock-invite-token`,
      expiresAt: "2026-07-19T10:30:00Z"
    };
  }

  acceptInvite(_inviteToken: string): AcceptInviteResult {
    return {
      restaurant: this.restaurant,
      member: this.ownerMember
    };
  }

  listRestaurants(page: number, pageSize: number, keyword?: string, status?: string): PageResult<RestaurantSummary> {
    const matchedKeyword = !keyword || this.restaurant.name.includes(keyword);
    const matchedStatus = !status || this.restaurant.status === status;
    const items = matchedKeyword && matchedStatus ? [this.restaurant] : [];

    return {
      items,
      page,
      pageSize,
      total: items.length,
      hasNext: false
    };
  }

  private assertRestaurant(id: string) {
    if (id !== this.restaurant.id) {
      throw new NotFoundException("餐厅不存在");
    }
  }
}
