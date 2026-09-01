import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { policy } from "../../config/policy";
import type {
  NotificationBadgeResponse,
  NotificationFeedItem,
  NotificationSettings,
  PageResult,
  UpdateNotificationSettingsRequest,
  UUID
} from "../../contracts/types";
import { EntitlementService } from "../entitlement/entitlement.service";

type ActiveUserRecord = Pick<User, "id" | "status">;
type NotificationDb = Prisma.TransactionClient | PrismaService;
type TimedUnreadSummary = {
  unreadCount: number;
  latestAt: Date | null;
};
type FeedSourceResult = {
  items: NotificationFeedItem[];
  total: number;
};

const officialChannelCode = "OFFICIAL_NOTICE";
const dayMs = 24 * 60 * 60 * 1000;

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * dayMs);
}

function startOfDay(base: Date) {
  const next = new Date(base);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(base: Date) {
  const next = new Date(base);
  next.setHours(23, 59, 59, 999);
  return next;
}

function maxDate(...values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((current, value) => {
    if (!value) return current;
    if (!current) return value;
    return value.getTime() > current.getTime() ? value : current;
  }, null);
}

function toPositiveInt(value: number, fallback: number) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function toIsoDate(value: Date) {
  return value.toISOString();
}

function resolveDirectUrl(bodyHtml: string) {
  const matched = bodyHtml.match(/<a\b[^>]*href=(['"])(https:\/\/[^"'<>]+)\1/i);
  return matched?.[2] ?? "";
}

function buildDefaultSettings(): NotificationSettings {
  return {
    reminderDotOnly: false,
    meal: {
      enabled: true,
      times: {
        breakfast: "08:00",
        lunch: "12:00",
        afternoonTea: "15:30",
        dinner: "18:30",
        lateNight: "21:30"
      }
    },
    fridge: {
      enabled: true,
      days: 3
    },
    recommend: {
      enabled: false
    }
  };
}

@Injectable()
export class NotificationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService
  ) {}

  async getSettings(userId: UUID): Promise<NotificationSettings> {
    return this.prisma.$transaction(async tx => {
      await this.loadActiveUser(tx, userId);
      const settings = await tx.userNotificationSettings.findUnique({
        where: { userId }
      });
      return settings ? this.toSettings(settings) : buildDefaultSettings();
    });
  }

  async updateSettings(userId: UUID, body: UpdateNotificationSettingsRequest): Promise<NotificationSettings> {
    return this.prisma.$transaction(async tx => {
      await this.loadActiveUser(tx, userId);
      const settings = await tx.userNotificationSettings.upsert({
        where: { userId },
        create: this.toSettingsCreate(userId, body),
        update: this.toSettingsUpdate(body)
      });
      return this.toSettings(settings);
    });
  }

  async getBadge(userId: UUID): Promise<NotificationBadgeResponse> {
    return this.prisma.$transaction(async tx => {
      await this.loadActiveUser(tx, userId);
      const [settingsRow, stateRow] = await Promise.all([
        tx.userNotificationSettings.findUnique({ where: { userId } }),
        tx.userNotificationState.findUnique({ where: { userId } })
      ]);

      return this.buildBadge(tx, userId, stateRow?.feedReadAt ?? null, settingsRow ? this.toSettings(settingsRow) : buildDefaultSettings());
    });
  }

  async getFeed(userId: UUID, page: number, pageSize: number): Promise<PageResult<NotificationFeedItem>> {
    return this.prisma.$transaction(async tx => {
      await this.loadActiveUser(tx, userId);
      const settingsRow = await tx.userNotificationSettings.findUnique({
        where: { userId }
      });
      const settings = settingsRow ? this.toSettings(settingsRow) : buildDefaultSettings();
      const nextPage = toPositiveInt(page, 1);
      const nextPageSize = Math.min(toPositiveInt(pageSize, 20), 100);
      const sourceLimit = nextPage * nextPageSize;
      const now = new Date();
      const [ingredientSource, unitSource, inviteSource, officialSource, fridgeSource, mealSource] = await Promise.all([
        this.loadIngredientFeed(tx, userId, sourceLimit),
        this.loadUnitFeed(tx, userId, sourceLimit),
        this.loadInviteFeed(tx, userId, sourceLimit),
        this.loadOfficialFeed(tx, sourceLimit),
        this.loadFridgeReminderFeed(tx, userId, now, settings),
        this.loadMealReminderFeed(tx, userId, now, settings)
      ]);
      const mergedItems = [
        ...ingredientSource.items,
        ...unitSource.items,
        ...inviteSource.items,
        ...officialSource.items,
        ...fridgeSource.items,
        ...mealSource.items
      ].sort((left, right) => new Date(right.timeValue).getTime() - new Date(left.timeValue).getTime());
      const total = ingredientSource.total + unitSource.total + inviteSource.total + officialSource.total + fridgeSource.total + mealSource.total;
      const start = (nextPage - 1) * nextPageSize;
      const end = start + nextPageSize;
      return {
        items: mergedItems.slice(start, end),
        page: nextPage,
        pageSize: nextPageSize,
        total,
        hasNext: end < total
      };
    });
  }

  async markFeedRead(userId: UUID): Promise<NotificationBadgeResponse> {
    return this.prisma.$transaction(async tx => {
      await this.loadActiveUser(tx, userId);
      const [settingsRow, stateRow] = await Promise.all([
        tx.userNotificationSettings.findUnique({ where: { userId } }),
        tx.userNotificationState.findUnique({ where: { userId } })
      ]);
      const settings = settingsRow ? this.toSettings(settingsRow) : buildDefaultSettings();
      const currentBadge = await this.buildBadge(tx, userId, stateRow?.feedReadAt ?? null, settings);

      if (!currentBadge.latestTime) {
        return currentBadge;
      }

      const nextReadAt = new Date(currentBadge.latestTime);
      await tx.userNotificationState.upsert({
        where: { userId },
        create: {
          userId,
          feedReadAt: nextReadAt
        },
        update: {
          feedReadAt: nextReadAt
        }
      });

      return this.buildBadge(tx, userId, nextReadAt, settings);
    });
  }

  private async loadIngredientFeed(db: NotificationDb, userId: UUID, take: number): Promise<FeedSourceResult> {
    const where = { userId };
    const [total, items] = await Promise.all([
      db.ingredientRecommendation.count({ where }),
      db.ingredientRecommendation.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take,
        select: {
          id: true,
          ingredientName: true,
          status: true,
          reviewNote: true,
          createdAt: true,
          updatedAt: true,
          reviewedAt: true
        }
      })
    ]);

    return {
      total,
      items: items.map(item => {
        const timeValue = item.reviewedAt ?? item.updatedAt ?? item.createdAt;
        const desc =
          item.status === "PENDING"
            ? `“${item.ingredientName}”正在审核中`
            : item.status === "REJECTED"
              ? item.reviewNote || `“${item.ingredientName}”审核未通过`
              : item.status === "ADOPTED"
                ? `“${item.ingredientName}”已收录为系统食材`
                : `“${item.ingredientName}”已归并到现有系统食材`;

        return {
          id: `ingredient:${item.id}`,
          typeLabel: "系统审核消息",
          tone: "review",
          title: `食材审核：${item.ingredientName}`,
          desc,
          timeValue: toIsoDate(timeValue),
          targetPath: null
        } satisfies NotificationFeedItem;
      })
    };
  }

  private async loadUnitFeed(db: NotificationDb, userId: UUID, take: number): Promise<FeedSourceResult> {
    const where = { userId };
    const [total, items] = await Promise.all([
      db.unitRecommendation.count({ where }),
      db.unitRecommendation.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take,
        select: {
          id: true,
          unitName: true,
          status: true,
          reviewNote: true,
          createdAt: true,
          updatedAt: true,
          reviewedAt: true
        }
      })
    ]);

    return {
      total,
      items: items.map(item => {
        const timeValue = item.reviewedAt ?? item.updatedAt ?? item.createdAt;
        const desc =
          item.status === "PENDING"
            ? `“${item.unitName}”正在审核中`
            : item.status === "REJECTED"
              ? item.reviewNote || `“${item.unitName}”审核未通过`
              : item.status === "ADOPTED"
                ? `“${item.unitName}”已收录为系统单位`
                : `“${item.unitName}”已归并到现有系统单位`;

        return {
          id: `unit:${item.id}`,
          typeLabel: "系统审核消息",
          tone: "review",
          title: `单位审核：${item.unitName}`,
          desc,
          timeValue: toIsoDate(timeValue),
          targetPath: null
        } satisfies NotificationFeedItem;
      })
    };
  }

  private async loadInviteFeed(db: NotificationDb, userId: UUID, take: number): Promise<FeedSourceResult> {
    const where = { targetUserId: userId };
    const [total, items] = await Promise.all([
      db.shoppingListInvite.count({ where }),
      db.shoppingListInvite.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take,
        select: {
          id: true,
          status: true,
          createdAt: true,
          acceptedAt: true,
          declinedAt: true,
          revokedAt: true,
          list: {
            select: {
              id: true,
              name: true,
              status: true,
              ownerUserId: true,
              owner: {
                select: {
                  uid: true,
                  nickname: true
                }
              },
              members: {
                where: { userId },
                select: { userId: true }
              },
              _count: {
                select: {
                  members: true,
                  items: true
                }
              }
            }
          }
        }
      })
    ]);
    const memberLimitCache = new Map<UUID, Promise<number>>();

    const feedItems = await Promise.all(
      items.map(async item => {
        const ownerUserId = item.list.ownerUserId;
        let memberLimitPromise = memberLimitCache.get(ownerUserId);
        if (!memberLimitPromise) {
          memberLimitPromise = this.entitlementService
            .getTier(db, ownerUserId)
            .then(tier => policy.shoppingListMemberLimit[tier]);
          memberLimitCache.set(ownerUserId, memberLimitPromise);
        }
        const memberLimit = await memberLimitPromise;
        const canJoin = item.list.status === "ACTIVE" && item.list.members.length === 0 && item.list._count.members < memberLimit;
        const ownerName = item.list.owner.nickname || `UID ${item.list.owner.uid}`;
        const desc =
          item.status === "ACCEPTED"
            ? `你已加入“${item.list.name}”，可继续和 ${ownerName} 一起维护`
            : item.status === "DECLINED"
              ? `你已忽略 ${ownerName} 发来的“${item.list.name}”协作邀请`
              : item.status === "REVOKED"
                ? `发起人已撤回“${item.list.name}”的协作邀请`
                : canJoin
                  ? `${ownerName} 邀请你一起维护“${item.list.name}”`
                  : `“${item.list.name}”当前协作者已满，暂时不能加入`;
        const timeValue = item.acceptedAt ?? item.declinedAt ?? item.revokedAt ?? item.createdAt;

        return {
          id: `invite:${item.id}`,
          typeLabel: "系统清单协作消息",
          tone: "shopping",
          title: `清单协作：${item.list.name}`,
          desc,
          timeValue: toIsoDate(timeValue),
          targetPath: `/pages_pantry/list-detail/index?id=${encodeURIComponent(String(item.list.id))}`
        } satisfies NotificationFeedItem;
      })
    );

    return {
      total,
      items: feedItems
    };
  }

  private async loadOfficialFeed(db: NotificationDb, take: number): Promise<FeedSourceResult> {
    const where = {
      type: "ARTICLE" as const,
      status: "PUBLISHED" as const,
      channel: {
        is: {
          code: officialChannelCode
        }
      }
    };
    const [total, items] = await Promise.all([
      db.siteContent.count({ where }),
      db.siteContent.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
        take,
        select: {
          id: true,
          title: true,
          summary: true,
          bodyHtml: true,
          publishedAt: true,
          updatedAt: true
        }
      })
    ]);

    return {
      total,
      items: items.map(item => {
        const directUrl = resolveDirectUrl(item.bodyHtml);
        const timeValue = item.publishedAt ?? item.updatedAt;

        return {
          id: `official:${item.id}`,
          typeLabel: "系统官方消息",
          tone: "official",
          title: item.title,
          desc: item.summary,
          timeValue: toIsoDate(timeValue),
          targetPath: directUrl
            ? `/pages_web/content/index?url=${encodeURIComponent(directUrl)}`
            : `/pages_me/official-message/index?messageId=${encodeURIComponent(String(item.id))}`
        } satisfies NotificationFeedItem;
      })
    };
  }

  private async loadFridgeReminderFeed(
    db: NotificationDb,
    userId: UUID,
    now: Date,
    settings: NotificationSettings
  ): Promise<FeedSourceResult> {
    if (!settings.fridge.enabled) {
      return { items: [], total: 0 };
    }

    const where = {
      userId,
      available: true,
      expireAt: {
        not: null,
        lte: addDays(now, settings.fridge.days)
      }
    };
    const [expiringCount, latest] = await Promise.all([
      db.fridgeItem.count({ where }),
      db.fridgeItem.findFirst({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { updatedAt: true }
      })
    ]);

    if (!expiringCount || !latest?.updatedAt) {
      return { items: [], total: 0 };
    }

    return {
      total: 1,
      items: [
        {
          id: "reminder:fridge-expiring",
          typeLabel: "系统提醒消息",
          tone: "reminder",
          title: "食材到期提醒",
          desc: expiringCount === 1 ? "有 1 样食材快到期，记得优先安排" : `有 ${expiringCount} 样食材快到期，记得优先安排`,
          timeValue: toIsoDate(latest.updatedAt),
          targetPath: "/pages_pantry/index/index"
        }
      ]
    };
  }

  private async loadMealReminderFeed(
    db: NotificationDb,
    userId: UUID,
    now: Date,
    settings: NotificationSettings
  ): Promise<FeedSourceResult> {
    if (!settings.meal.enabled) {
      return { items: [], total: 0 };
    }

    const windowStart = startOfDay(now);
    const windowEnd = endOfDay(addDays(windowStart, 6));
    const planWhere = {
      userId,
      status: "PLANNED" as const,
      planDate: {
        gte: windowStart,
        lte: windowEnd
      }
    };
    const [latestPlan, latestList, plannedDays] = await Promise.all([
      db.mealPlanItem.findFirst({
        where: planWhere,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { updatedAt: true }
      }),
      db.shoppingList.findFirst({
        where: {
          ownerUserId: userId,
          status: "ACTIVE",
          mealPlans: {
            some: planWhere
          }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { updatedAt: true }
      }),
      db.mealPlanItem.findMany({
        where: planWhere,
        distinct: ["planDate"],
        select: { planDate: true }
      })
    ]);
    const latestAt = maxDate(latestPlan?.updatedAt, latestList?.updatedAt);

    if (!latestAt || !plannedDays.length) {
      return { items: [], total: 0 };
    }

    return {
      total: 1,
      items: [
        {
          id: "reminder:week-overview",
          typeLabel: "系统提醒消息",
          tone: "reminder",
          title: "计划提醒",
          desc: plannedDays.length === 1 ? "你本周还有 1 天安排待处理" : `你本周还有 ${plannedDays.length} 天安排待处理`,
          timeValue: toIsoDate(latestAt),
          targetPath: "/pages_meal/plan/index"
        }
      ]
    };
  }

  private async buildBadge(
    db: NotificationDb,
    userId: UUID,
    readAt: Date | null,
    settings: NotificationSettings
  ): Promise<NotificationBadgeResponse> {
    const now = new Date();
    const [ingredientSummary, unitSummary, inviteSummary, officialSummary, fridgeSummary, mealSummary] = await Promise.all([
      this.loadIngredientSummary(db, userId, readAt),
      this.loadUnitSummary(db, userId, readAt),
      this.loadInviteSummary(db, userId, readAt),
      this.loadOfficialSummary(db, readAt),
      this.loadFridgeReminderSummary(db, userId, readAt, now, settings),
      this.loadMealReminderSummary(db, userId, readAt, now, settings)
    ]);

    const reminderUnreadCount = fridgeSummary.unreadCount + mealSummary.unreadCount;
    const unreadCount =
      ingredientSummary.unreadCount +
      unitSummary.unreadCount +
      inviteSummary.unreadCount +
      officialSummary.unreadCount +
      (settings.reminderDotOnly ? 0 : reminderUnreadCount);

    const latestAt = maxDate(
      ingredientSummary.latestAt,
      unitSummary.latestAt,
      inviteSummary.latestAt,
      officialSummary.latestAt,
      fridgeSummary.latestAt,
      mealSummary.latestAt
    );

    return {
      unreadCount,
      reminderUnreadCount,
      showReminderDot: settings.reminderDotOnly && reminderUnreadCount > 0,
      latestTime: latestAt?.toISOString() ?? ""
    };
  }

  private async loadIngredientSummary(db: NotificationDb, userId: UUID, readAt: Date | null): Promise<TimedUnreadSummary> {
    const where = { userId };
    const [latest, unreadCount] = await Promise.all([
      db.ingredientRecommendation.findFirst({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { updatedAt: true }
      }),
      db.ingredientRecommendation.count({
        where: readAt
          ? {
              ...where,
              updatedAt: { gt: readAt }
            }
          : where
      })
    ]);

    return {
      unreadCount,
      latestAt: latest?.updatedAt ?? null
    };
  }

  private async loadUnitSummary(db: NotificationDb, userId: UUID, readAt: Date | null): Promise<TimedUnreadSummary> {
    const where = { userId };
    const [latest, unreadCount] = await Promise.all([
      db.unitRecommendation.findFirst({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { updatedAt: true }
      }),
      db.unitRecommendation.count({
        where: readAt
          ? {
              ...where,
              updatedAt: { gt: readAt }
            }
          : where
      })
    ]);

    return {
      unreadCount,
      latestAt: latest?.updatedAt ?? null
    };
  }

  private async loadInviteSummary(db: NotificationDb, userId: UUID, readAt: Date | null): Promise<TimedUnreadSummary> {
    const where = { targetUserId: userId };
    const [latest, unreadCount] = await Promise.all([
      db.shoppingListInvite.findFirst({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { updatedAt: true }
      }),
      db.shoppingListInvite.count({
        where: readAt
          ? {
              ...where,
              updatedAt: { gt: readAt }
            }
          : where
      })
    ]);

    return {
      unreadCount,
      latestAt: latest?.updatedAt ?? null
    };
  }

  private async loadOfficialSummary(db: NotificationDb, readAt: Date | null): Promise<TimedUnreadSummary> {
    const where = {
      type: "ARTICLE" as const,
      status: "PUBLISHED" as const,
      channel: {
        is: {
          code: officialChannelCode
        }
      }
    };
    const [latest, unreadCount] = await Promise.all([
      db.siteContent.findFirst({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { updatedAt: true }
      }),
      db.siteContent.count({
        where: readAt
          ? {
              ...where,
              updatedAt: { gt: readAt }
            }
          : where
      })
    ]);

    return {
      unreadCount,
      latestAt: latest?.updatedAt ?? null
    };
  }

  private async loadFridgeReminderSummary(
    db: NotificationDb,
    userId: UUID,
    readAt: Date | null,
    now: Date,
    settings: NotificationSettings
  ): Promise<TimedUnreadSummary> {
    if (!settings.fridge.enabled) {
      return {
        unreadCount: 0,
        latestAt: null
      };
    }

    const latest = await db.fridgeItem.findFirst({
      where: {
        userId,
        available: true,
        expireAt: {
          not: null,
          lte: addDays(now, settings.fridge.days)
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { updatedAt: true }
    });

    const latestAt = latest?.updatedAt ?? null;
    return {
      unreadCount: latestAt && (!readAt || latestAt.getTime() > readAt.getTime()) ? 1 : 0,
      latestAt
    };
  }

  private async loadMealReminderSummary(
    db: NotificationDb,
    userId: UUID,
    readAt: Date | null,
    now: Date,
    settings: NotificationSettings
  ): Promise<TimedUnreadSummary> {
    if (!settings.meal.enabled) {
      return {
        unreadCount: 0,
        latestAt: null
      };
    }

    const windowStart = startOfDay(now);
    const windowEnd = endOfDay(addDays(windowStart, 6));
    const [latestPlan, latestList] = await Promise.all([
      db.mealPlanItem.findFirst({
        where: {
          userId,
          status: "PLANNED",
          planDate: {
            gte: windowStart,
            lte: windowEnd
          }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { updatedAt: true }
      }),
      db.shoppingList.findFirst({
        where: {
          ownerUserId: userId,
          status: "ACTIVE",
          mealPlans: {
            some: {
              userId,
              status: "PLANNED",
              planDate: {
                gte: windowStart,
                lte: windowEnd
              }
            }
          }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { updatedAt: true }
      })
    ]);

    const latestAt = maxDate(latestPlan?.updatedAt, latestList?.updatedAt);
    return {
      unreadCount: latestAt && (!readAt || latestAt.getTime() > readAt.getTime()) ? 1 : 0,
      latestAt
    };
  }

  private toSettings(settings: Prisma.UserNotificationSettingsGetPayload<Record<string, never>>): NotificationSettings {
    return {
      reminderDotOnly: settings.reminderDotOnly,
      meal: {
        enabled: settings.mealEnabled,
        times: {
          breakfast: settings.mealBreakfastTime,
          lunch: settings.mealLunchTime,
          afternoonTea: settings.mealAfternoonTeaTime,
          dinner: settings.mealDinnerTime,
          lateNight: settings.mealLateNightTime
        }
      },
      fridge: {
        enabled: settings.fridgeEnabled,
        days: settings.fridgeDays as NotificationSettings["fridge"]["days"]
      },
      recommend: {
        enabled: settings.recommendEnabled
      }
    };
  }

  private toSettingsCreate(userId: UUID, body: UpdateNotificationSettingsRequest) {
    return {
      userId,
      ...this.toSettingsUpdate(body)
    };
  }

  private toSettingsUpdate(body: UpdateNotificationSettingsRequest) {
    return {
      mealEnabled: body.meal.enabled,
      mealBreakfastTime: body.meal.times.breakfast,
      mealLunchTime: body.meal.times.lunch,
      mealAfternoonTeaTime: body.meal.times.afternoonTea,
      mealDinnerTime: body.meal.times.dinner,
      mealLateNightTime: body.meal.times.lateNight,
      fridgeEnabled: body.fridge.enabled,
      fridgeDays: body.fridge.days,
      recommendEnabled: body.recommend.enabled,
      reminderDotOnly: body.reminderDotOnly
    };
  }

  private async loadActiveUser(db: NotificationDb, userId: UUID): Promise<ActiveUserRecord> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true
      }
    });
    this.assertActiveUser(user);
    return user;
  }

  private assertActiveUser(user: ActiveUserRecord | null): asserts user is ActiveUserRecord {
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("未登录或 token 失效");
    }
  }
}
