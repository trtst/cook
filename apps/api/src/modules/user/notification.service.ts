import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import type { NotificationBadgeResponse, NotificationSettings, UpdateNotificationSettingsRequest, UUID } from "../../contracts/types";

type ActiveUserRecord = Pick<User, "id" | "status">;
type NotificationDb = Prisma.TransactionClient | PrismaService;
type TimedUnreadSummary = {
  unreadCount: number;
  latestAt: Date | null;
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
