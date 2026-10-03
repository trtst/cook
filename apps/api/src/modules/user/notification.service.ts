import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Prisma, type RecipeWikiRequestStatus, type User } from "@prisma/client";
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

type ActiveUserRecord = Pick<User, "id" | "status" | "createdAt">;
type NotificationDb = Prisma.TransactionClient | PrismaService;
type TimedUnreadSummary = {
  unreadCount: number;
  latestAt: Date | null;
};
type FeedSourceResult = {
  items: NotificationFeedItem[];
  total: number;
};
type ReadNotificationSummary = { allCount: number };

const officialChannelCode = "OFFICIAL_NOTICE";
const dayMs = 24 * 60 * 60 * 1000;
const maxNotificationFeedPage = 50;
const recipeWikiResolvedStatuses: RecipeWikiRequestStatus[] = ["READY", "REJECTED"];

const recipeWikiFeedSelect = {
  id: true,
  status: true,
  rejectionReason: true,
  resolvedAt: true,
  updatedAt: true,
  recipeVersion: {
    select: {
      name: true,
      currentRecipes: {
        where: { status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true, isInspiration: true }
      }
    }
  }
} satisfies Prisma.RecipeCookAssistantRequestSelect;

type RecipeWikiFeedRow = Prisma.RecipeCookAssistantRequestGetPayload<{ select: typeof recipeWikiFeedSelect }>;

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * dayMs);
}

function maxDate(...values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((current, value) => {
    if (!value) return current;
    if (!current) return value;
    return value.getTime() > current.getTime() ? value : current;
  }, null);
}

function minDate(...values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((current, value) => {
    if (!value) return current;
    if (!current) return value;
    return value.getTime() < current.getTime() ? value : current;
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
      const user = await this.loadActiveUser(tx, userId);
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
      const user = await this.loadActiveUser(tx, userId);
      const stateRow = await tx.userNotificationState.findUnique({ where: { userId } });
      return this.buildBadge(tx, userId, user.createdAt, stateRow?.feedReadAt ?? null);
    });
  }

  async getFeed(userId: UUID, page: number, pageSize: number): Promise<PageResult<NotificationFeedItem>> {
    return this.prisma.$transaction(async tx => {
      const user = await this.loadActiveUser(tx, userId);
      const nextPage = toPositiveInt(page, 1);
      if (nextPage > maxNotificationFeedPage) {
        throw new BadRequestException(`通知列表最多支持查看 ${maxNotificationFeedPage} 页`);
      }
      const nextPageSize = Math.min(toPositiveInt(pageSize, 20), 100);
      const sourceLimit = nextPage * nextPageSize;
      const [
        stateRow,
        ingredientSource,
        unitSource,
        recipeRecommendationSource,
        recipeReportSource,
        ingredientFeedbackSource,
        inviteSource,
        officialSource,
        recipeWikiSource
      ] = await Promise.all([
        tx.userNotificationState.findUnique({ where: { userId } }),
        this.loadIngredientFeed(tx, userId, sourceLimit),
        this.loadUnitFeed(tx, userId, sourceLimit),
        this.loadRecipeRecommendationFeed(tx, userId, sourceLimit),
        this.loadRecipeReportFeed(tx, userId, sourceLimit),
        this.loadIngredientFeedbackFeed(tx, userId, sourceLimit),
        this.loadInviteFeed(tx, userId, sourceLimit),
        this.loadOfficialFeed(tx, user.createdAt, sourceLimit),
        this.loadRecipeWikiFeed(tx, userId, sourceLimit)
      ]);
      const mergedItems = [
        ...ingredientSource.items,
        ...unitSource.items,
        ...recipeRecommendationSource.items,
        ...recipeReportSource.items,
        ...ingredientFeedbackSource.items,
        ...inviteSource.items,
        ...officialSource.items,
        ...recipeWikiSource.items
      ].sort((left, right) => new Date(right.timeValue).getTime() - new Date(left.timeValue).getTime());
      const total =
        ingredientSource.total +
        unitSource.total +
        recipeRecommendationSource.total +
        recipeReportSource.total +
        ingredientFeedbackSource.total +
        inviteSource.total +
        officialSource.total +
        recipeWikiSource.total;
      const start = (nextPage - 1) * nextPageSize;
      const end = start + nextPageSize;
      const pageItems = mergedItems.slice(start, end);
      const reads = pageItems.length
        ? await tx.userNotificationRead.findMany({
            where: {
              userId,
              notificationId: { in: pageItems.map(item => item.id) }
            },
            select: {
              notificationId: true,
              notificationAt: true
            }
          })
        : [];
      const readTimes = new Map(reads.map(item => [item.notificationId, item.notificationAt]));
      const feedReadAt = stateRow?.feedReadAt ?? null;
      return {
        items: pageItems.map(item => ({
          ...item,
          isUnread: this.isFeedItemUnread(item.timeValue, feedReadAt, readTimes.get(item.id) ?? null)
        })),
        page: nextPage,
        pageSize: nextPageSize,
        total,
        hasNext: nextPage < maxNotificationFeedPage && end < total
      };
    });
  }

  async markBadgeSeen(userId: UUID): Promise<NotificationBadgeResponse> {
    return this.prisma.$transaction(async tx => {
      const user = await this.loadActiveUser(tx, userId);
      const stateRow = await tx.userNotificationState.findUnique({ where: { userId } });
      const currentBadge = await this.buildBadge(tx, userId, user.createdAt, stateRow?.feedReadAt ?? null);

      if (!currentBadge.latestTime) {
        return currentBadge;
      }

      const nextReadAt = maxDate(stateRow?.feedReadAt ?? null, new Date(currentBadge.latestTime));
      if (!nextReadAt) return currentBadge;
      await tx.userNotificationState.upsert({
        where: { userId },
        create: {
          userId,
          badgeReadAt: nextReadAt,
          feedReadAt: nextReadAt
        },
        update: {
          badgeReadAt: nextReadAt,
          feedReadAt: nextReadAt
        }
      });

      return this.buildBadge(tx, userId, user.createdAt, nextReadAt);
    });
  }

  async markFeedRead(userId: UUID, beforeTime: string): Promise<NotificationBadgeResponse> {
    const requestedAt = new Date(beforeTime);
    if (Number.isNaN(requestedAt.getTime())) throw new BadRequestException("通知时间格式不正确");

    return this.prisma.$transaction(async tx => {
      const user = await this.loadActiveUser(tx, userId);
      const stateRow = await tx.userNotificationState.findUnique({ where: { userId } });
      const badge = await this.buildBadge(tx, userId, user.createdAt, stateRow?.feedReadAt ?? null);
      const latestAt = badge.latestTime ? new Date(badge.latestTime) : null;
      if (!latestAt) {
        return badge;
      }
      const nextReadAt = maxDate(stateRow?.feedReadAt ?? null, minDate(requestedAt, latestAt));

      if (nextReadAt) {
        await tx.userNotificationState.upsert({
          where: { userId },
          create: { userId, feedReadAt: nextReadAt },
          update: { feedReadAt: nextReadAt }
        });
      }

      return this.buildBadge(tx, userId, user.createdAt, nextReadAt ?? stateRow?.feedReadAt ?? null);
    });
  }

  async markItemRead(userId: UUID, notificationId: string, notificationTime: string): Promise<void> {
    const requestedAt = new Date(notificationTime);
    if (Number.isNaN(requestedAt.getTime())) throw new BadRequestException("通知时间格式不正确");

    await this.prisma.$transaction(async tx => {
      const user = await this.loadActiveUser(tx, userId);
      const notificationAt = await this.findNotificationTime(tx, userId, user.createdAt, notificationId);

      if (!notificationAt || notificationAt.getTime() !== requestedAt.getTime()) {
        throw new NotFoundException("通知已更新或不存在");
      }

      await tx.userNotificationRead.upsert({
        where: {
          userId_notificationId: {
            userId,
            notificationId
          }
        },
        create: {
          userId,
          notificationId,
          notificationAt
        },
        update: {
          notificationAt
        }
      });
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
        const timeValue = item.updatedAt;
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
          isUnread: false,
          typeLabel: "系统审核",
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
        const timeValue = item.updatedAt;
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
          isUnread: false,
          typeLabel: "系统审核",
          tone: "review",
          title: `单位审核：${item.unitName}`,
          desc,
          timeValue: toIsoDate(timeValue),
          targetPath: null
        } satisfies NotificationFeedItem;
      })
    };
  }

  private async loadRecipeRecommendationFeed(db: NotificationDb, userId: UUID, take: number): Promise<FeedSourceResult> {
    const where = { userId, status: { not: "WITHDRAWN" as const } };
    const [total, items] = await Promise.all([
      db.recipeRecommendation.count({ where }),
      db.recipeRecommendation.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take,
        select: { id: true, recipeTitle: true, status: true, reviewNote: true, updatedAt: true }
      })
    ]);

    return {
      total,
      items: items.map(item => {
        const desc =
          item.status === "PENDING"
            ? `“${item.recipeTitle}”正在审核中`
            : item.status === "REJECTED"
              ? item.reviewNote || `“${item.recipeTitle}”审核未通过`
              : `“${item.recipeTitle}”已收录到灵感`;
        return {
          id: `recipe-recommendation:${item.id}`,
          isUnread: false,
          typeLabel: "系统审核",
          tone: "review",
          title: `食谱审核：${item.recipeTitle}`,
          desc,
          timeValue: toIsoDate(item.updatedAt),
          targetPath: null
        } satisfies NotificationFeedItem;
      })
    };
  }

  private async loadRecipeReportFeed(db: NotificationDb, userId: UUID, take: number): Promise<FeedSourceResult> {
    const where = { reporterId: userId };
    const [total, items] = await Promise.all([
      db.recipeReport.count({ where }),
      db.recipeReport.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take,
        select: { id: true, reason: true, status: true, resolutionNote: true, updatedAt: true }
      })
    ]);

    return {
      total,
      items: items.map(item => ({
        id: `recipe-report:${item.id}`,
        isUnread: false,
        typeLabel: "系统审核",
        tone: "review",
        title: `举报处理：${item.reason}`,
        desc: item.status === "OPEN" ? "举报正在处理中" : item.resolutionNote || "举报已处理，感谢反馈",
        timeValue: toIsoDate(item.updatedAt),
        targetPath: null
      } satisfies NotificationFeedItem))
    };
  }

  private async loadIngredientFeedbackFeed(db: NotificationDb, userId: UUID, take: number): Promise<FeedSourceResult> {
    const where = { userId };
    const [total, items] = await Promise.all([
      db.ingredientFeedback.count({ where }),
      db.ingredientFeedback.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take,
        select: { id: true, ingredientName: true, suggestedName: true, status: true, reviewNote: true, updatedAt: true }
      })
    ]);

    return {
      total,
      items: items.map(item => {
        const desc =
          item.status === "PENDING"
            ? `“${item.ingredientName}”的纠错正在审核中`
            : item.status === "REJECTED"
              ? item.reviewNote || `“${item.ingredientName}”的纠错未采纳`
              : `“${item.ingredientName}”的纠错已采纳${item.suggestedName !== item.ingredientName ? `，名称更新为“${item.suggestedName}”` : ""}`;
        return {
          id: `ingredient-feedback:${item.id}`,
          isUnread: false,
          typeLabel: "系统审核",
          tone: "review",
          title: `食材纠错：${item.ingredientName}`,
          desc,
          timeValue: toIsoDate(item.updatedAt),
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
          updatedAt: true,
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
        const timeValue = item.updatedAt;

        return {
          id: `invite:${item.id}`,
          isUnread: false,
          typeLabel: "购物清单协作",
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

  private async loadOfficialFeed(db: NotificationDb, userCreatedAt: Date, take: number): Promise<FeedSourceResult> {
    const where = {
      type: "ARTICLE" as const,
      status: "PUBLISHED" as const,
      channel: {
        is: {
          code: officialChannelCode
        }
      },
      publishedAt: { gt: userCreatedAt }
    };
    const [total, items] = await Promise.all([
      db.siteContent.count({ where }),
      db.siteContent.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
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
        const timeValue = item.updatedAt;

        return {
          id: `official:${item.id}`,
          isUnread: false,
          typeLabel: "炊火记",
          tone: "official",
          title: `炊火记发布了《${item.title}》`,
          desc: item.summary,
          timeValue: toIsoDate(timeValue),
          targetPath: directUrl
            ? `/pages_web/content/index?url=${encodeURIComponent(directUrl)}`
            : `/pages_me/official-message/index?messageId=${encodeURIComponent(String(item.id))}`
        } satisfies NotificationFeedItem;
      })
    };
  }

  private async loadRecipeWikiFeed(db: NotificationDb, userId: UUID, take: number): Promise<FeedSourceResult> {
    const where = { userId, status: { in: recipeWikiResolvedStatuses } };
    const requestDelegate = db.recipeCookAssistantRequest as PrismaService["recipeCookAssistantRequest"];
    const [total, items] = await Promise.all([
      requestDelegate.count({ where }),
      requestDelegate.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take,
        select: recipeWikiFeedSelect
      }) as unknown as RecipeWikiFeedRow[]
    ]);

    return {
      total,
      items: items.map(item => {
        const recipe = item.recipeVersion.currentRecipes[0] ?? null;
        const timeValue = item.resolvedAt ?? item.updatedAt;
        const targetPath = recipe
          ? `/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(recipe.id))}&kind=${recipe.isInspiration ? "inspiration" : "my"}`
          : null;
        return {
          id: `recipe-wiki:${item.id}`,
          isUnread: false,
          typeLabel: "菜谱 Wiki",
          tone: "recipe-wiki",
          title: item.status === "READY" ? `炊火智厨已完成：${item.recipeVersion.name}` : `炊火智厨申请未通过：${item.recipeVersion.name}`,
          desc: item.status === "READY" ? "Wiki 已制作完成，点击即可打开炊火智厨" : item.rejectionReason || "菜谱内容暂不满足生成条件，请重新编辑后再申请",
          timeValue: toIsoDate(timeValue),
          targetPath
        } satisfies NotificationFeedItem;
      })
    };
  }

  private isFeedItemUnread(timeValue: string, feedReadAt: Date | null, itemReadAt: Date | null) {
    const notificationAt = new Date(timeValue);
    if (feedReadAt && notificationAt.getTime() <= feedReadAt.getTime()) return false;
    if (itemReadAt && notificationAt.getTime() <= itemReadAt.getTime()) return false;
    return true;
  }

  private async findNotificationTime(
    db: NotificationDb,
    userId: UUID,
    userCreatedAt: Date,
    notificationId: string
  ): Promise<Date | null> {
    const ingredientId = notificationId.match(/^ingredient:(\d+)$/)?.[1];
    if (ingredientId) {
      const item = await db.ingredientRecommendation.findFirst({
        where: { id: Number(ingredientId), userId },
        select: { createdAt: true, updatedAt: true, reviewedAt: true }
      });
      return item?.updatedAt ?? null;
    }

    const unitId = notificationId.match(/^unit:(\d+)$/)?.[1];
    if (unitId) {
      const item = await db.unitRecommendation.findFirst({
        where: { id: Number(unitId), userId },
        select: { createdAt: true, updatedAt: true, reviewedAt: true }
      });
      return item?.updatedAt ?? null;
    }

    const recipeRecommendationId = notificationId.match(/^recipe-recommendation:(\d+)$/)?.[1];
    if (recipeRecommendationId) {
      const item = await db.recipeRecommendation.findFirst({
        where: { id: Number(recipeRecommendationId), userId, status: { not: "WITHDRAWN" } },
        select: { updatedAt: true }
      });
      return item?.updatedAt ?? null;
    }

    const recipeReportId = notificationId.match(/^recipe-report:(\d+)$/)?.[1];
    if (recipeReportId) {
      const item = await db.recipeReport.findFirst({
        where: { id: Number(recipeReportId), reporterId: userId },
        select: { updatedAt: true }
      });
      return item?.updatedAt ?? null;
    }

    const ingredientFeedbackId = notificationId.match(/^ingredient-feedback:(\d+)$/)?.[1];
    if (ingredientFeedbackId) {
      const item = await db.ingredientFeedback.findFirst({
        where: { id: Number(ingredientFeedbackId), userId },
        select: { updatedAt: true }
      });
      return item?.updatedAt ?? null;
    }

    const inviteId = notificationId.match(/^invite:(\d+)$/)?.[1];
    if (inviteId) {
      const item = await db.shoppingListInvite.findFirst({
        where: { id: Number(inviteId), targetUserId: userId },
        select: { updatedAt: true }
      });
      return item?.updatedAt ?? null;
    }

    const officialId = notificationId.match(/^official:(\d+)$/)?.[1];
    if (officialId) {
      const item = await db.siteContent.findFirst({
        where: {
          id: Number(officialId),
          type: "ARTICLE",
          status: "PUBLISHED",
          channel: { is: { code: officialChannelCode } },
          publishedAt: { gt: userCreatedAt }
        },
        select: { updatedAt: true }
      });
      return item?.updatedAt ?? null;
    }

    const recipeWikiId = notificationId.match(/^recipe-wiki:(\d+)$/)?.[1];
    if (recipeWikiId) {
      const item = await db.recipeCookAssistantRequest.findFirst({
        where: { id: Number(recipeWikiId), userId, status: { in: recipeWikiResolvedStatuses } },
        select: { resolvedAt: true, updatedAt: true }
      });
      return item?.resolvedAt ?? item?.updatedAt ?? null;
    }

    return null;
  }

  private async buildBadge(
    db: NotificationDb,
    userId: UUID,
    userCreatedAt: Date,
    feedReadAt: Date | null
  ): Promise<NotificationBadgeResponse> {
    const [
      ingredientSummary,
      unitSummary,
      recipeRecommendationSummary,
      recipeReportSummary,
      ingredientFeedbackSummary,
      inviteSummary,
      officialSummary,
      recipeWikiSummary,
      readSummary
    ] = await Promise.all([
      this.loadIngredientSummary(db, userId, feedReadAt),
      this.loadUnitSummary(db, userId, feedReadAt),
      this.loadRecipeRecommendationSummary(db, userId, feedReadAt),
      this.loadRecipeReportSummary(db, userId, feedReadAt),
      this.loadIngredientFeedbackSummary(db, userId, feedReadAt),
      this.loadInviteSummary(db, userId, feedReadAt),
      this.loadOfficialSummary(db, userCreatedAt, feedReadAt),
      this.loadRecipeWikiSummary(db, userId, feedReadAt),
      this.loadReadNotificationSummary(db, userId, userCreatedAt, feedReadAt)
    ]);

    const sourceUnreadCount =
      ingredientSummary.unreadCount +
      unitSummary.unreadCount +
      recipeRecommendationSummary.unreadCount +
      recipeReportSummary.unreadCount +
      ingredientFeedbackSummary.unreadCount +
      inviteSummary.unreadCount +
      officialSummary.unreadCount +
      recipeWikiSummary.unreadCount;
    const unreadCount = Math.max(sourceUnreadCount - readSummary.allCount, 0);

    const latestAt = maxDate(
      ingredientSummary.latestAt,
      unitSummary.latestAt,
      recipeRecommendationSummary.latestAt,
      recipeReportSummary.latestAt,
      ingredientFeedbackSummary.latestAt,
      inviteSummary.latestAt,
      officialSummary.latestAt,
      recipeWikiSummary.latestAt
    );

    return {
      unreadCount,
      latestTime: latestAt?.toISOString() ?? ""
    };
  }

  private async loadReadNotificationSummary(
    db: NotificationDb,
    userId: UUID,
    userCreatedAt: Date,
    feedReadAt: Date | null
  ): Promise<ReadNotificationSummary> {
    const reads = await db.userNotificationRead.findMany({
      where: feedReadAt
        ? { userId, notificationAt: { gt: feedReadAt } }
        : { userId },
      select: {
        notificationId: true,
        notificationAt: true
      }
    });

    if (!reads.length) {
      return { allCount: 0 };
    }

    const ingredientIds = new Map<number, string[]>();
    const unitIds = new Map<number, string[]>();
    const recipeRecommendationIds = new Map<number, string[]>();
    const recipeReportIds = new Map<number, string[]>();
    const ingredientFeedbackIds = new Map<number, string[]>();
    const inviteIds = new Map<number, string[]>();
    const officialIds = new Map<number, string[]>();
    const recipeWikiIds = new Map<number, string[]>();

    const sourceIds = new Map([
      ["ingredient", ingredientIds],
      ["unit", unitIds],
      ["recipe-recommendation", recipeRecommendationIds],
      ["recipe-report", recipeReportIds],
      ["ingredient-feedback", ingredientFeedbackIds],
      ["invite", inviteIds],
      ["official", officialIds],
      ["recipe-wiki", recipeWikiIds]
    ]);

    for (const read of reads) {
      const match = read.notificationId.match(/^([a-z-]+):(\d+)$/);
      if (!match) continue;
      const id = Number(match[2]);
      if (!Number.isSafeInteger(id) || id < 1) continue;
      const ids = sourceIds.get(match[1]);
      if (!ids) continue;
      const notificationIds = ids.get(id) ?? [];
      notificationIds.push(read.notificationId);
      ids.set(id, notificationIds);
    }

    const loadBatches = async <T>(ids: number[], query: (batch: number[]) => Promise<T[]>): Promise<T[]> => {
      const rows: T[] = [];
      for (let start = 0; start < ids.length; start += 500) {
        rows.push(...await query(ids.slice(start, start + 500)));
      }
      return rows;
    };

    const [ingredients, units, recipeRecommendations, recipeReports, ingredientFeedbacks, invites, officialMessages, recipeWikiRequests] = await Promise.all([
      loadBatches([...ingredientIds.keys()], ids => db.ingredientRecommendation.findMany({
        where: { id: { in: ids }, userId },
        select: { id: true, updatedAt: true }
      })),
      loadBatches([...unitIds.keys()], ids => db.unitRecommendation.findMany({
        where: { id: { in: ids }, userId },
        select: { id: true, updatedAt: true }
      })),
      loadBatches([...recipeRecommendationIds.keys()], ids => db.recipeRecommendation.findMany({
        where: { id: { in: ids }, userId, status: { not: "WITHDRAWN" } },
        select: { id: true, updatedAt: true }
      })),
      loadBatches([...recipeReportIds.keys()], ids => db.recipeReport.findMany({
        where: { id: { in: ids }, reporterId: userId },
        select: { id: true, updatedAt: true }
      })),
      loadBatches([...ingredientFeedbackIds.keys()], ids => db.ingredientFeedback.findMany({
        where: { id: { in: ids }, userId },
        select: { id: true, updatedAt: true }
      })),
      loadBatches([...inviteIds.keys()], ids => db.shoppingListInvite.findMany({
        where: { id: { in: ids }, targetUserId: userId },
        select: { id: true, updatedAt: true }
      })),
      loadBatches([...officialIds.keys()], ids => db.siteContent.findMany({
        where: {
          id: { in: ids },
          type: "ARTICLE",
          status: "PUBLISHED",
          channel: { is: { code: officialChannelCode } },
          publishedAt: { gt: userCreatedAt }
        },
        select: { id: true, updatedAt: true }
      })),
      loadBatches([...recipeWikiIds.keys()], ids => db.recipeCookAssistantRequest.findMany({
        where: { id: { in: ids }, userId, status: { in: recipeWikiResolvedStatuses } },
        select: { id: true, resolvedAt: true, updatedAt: true }
      }))
    ]);

    const currentTimes = new Map<string, Date>();
    const rememberTimes = <T extends { id: number }>(source: Map<number, string[]>, items: T[], time: (item: T) => Date | null) => {
      for (const item of items) {
        const currentTime = time(item);
        if (!currentTime) continue;
        for (const notificationId of source.get(item.id) ?? []) {
          currentTimes.set(notificationId, currentTime);
        }
      }
    };

    rememberTimes(ingredientIds, ingredients, item => item.updatedAt);
    rememberTimes(unitIds, units, item => item.updatedAt);
    rememberTimes(recipeRecommendationIds, recipeRecommendations, item => item.updatedAt);
    rememberTimes(recipeReportIds, recipeReports, item => item.updatedAt);
    rememberTimes(ingredientFeedbackIds, ingredientFeedbacks, item => item.updatedAt);
    rememberTimes(inviteIds, invites, item => item.updatedAt);
    rememberTimes(officialIds, officialMessages, item => item.updatedAt);
    rememberTimes(recipeWikiIds, recipeWikiRequests, item => item.resolvedAt ?? item.updatedAt);

    let allCount = 0;

    reads.forEach(read => {
      const currentTime = currentTimes.get(read.notificationId);
      if (!currentTime || currentTime.getTime() !== read.notificationAt.getTime()) return;
      allCount += 1;
    });

    return { allCount };
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

  private async loadRecipeRecommendationSummary(db: NotificationDb, userId: UUID, readAt: Date | null): Promise<TimedUnreadSummary> {
    const where = { userId, status: { not: "WITHDRAWN" as const } };
    const [latest, unreadCount] = await Promise.all([
      db.recipeRecommendation.findFirst({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { updatedAt: true } }),
      db.recipeRecommendation.count({ where: readAt ? { ...where, updatedAt: { gt: readAt } } : where })
    ]);
    return { unreadCount, latestAt: latest?.updatedAt ?? null };
  }

  private async loadRecipeReportSummary(db: NotificationDb, userId: UUID, readAt: Date | null): Promise<TimedUnreadSummary> {
    const where = { reporterId: userId };
    const [latest, unreadCount] = await Promise.all([
      db.recipeReport.findFirst({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { updatedAt: true } }),
      db.recipeReport.count({ where: readAt ? { ...where, updatedAt: { gt: readAt } } : where })
    ]);
    return { unreadCount, latestAt: latest?.updatedAt ?? null };
  }

  private async loadIngredientFeedbackSummary(db: NotificationDb, userId: UUID, readAt: Date | null): Promise<TimedUnreadSummary> {
    const where = { userId };
    const [latest, unreadCount] = await Promise.all([
      db.ingredientFeedback.findFirst({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { updatedAt: true } }),
      db.ingredientFeedback.count({ where: readAt ? { ...where, updatedAt: { gt: readAt } } : where })
    ]);
    return { unreadCount, latestAt: latest?.updatedAt ?? null };
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

  private async loadRecipeWikiSummary(db: NotificationDb, userId: UUID, readAt: Date | null): Promise<TimedUnreadSummary> {
    const where = { userId, status: { in: recipeWikiResolvedStatuses } };
    const [latest, unreadCount] = await Promise.all([
      db.recipeCookAssistantRequest.findFirst({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { resolvedAt: true, updatedAt: true }
      }),
      db.recipeCookAssistantRequest.count({
        where: readAt ? { ...where, updatedAt: { gt: readAt } } : where
      })
    ]);
    return {
      unreadCount,
      latestAt: latest ? latest.resolvedAt ?? latest.updatedAt : null
    };
  }

  private async loadOfficialSummary(db: NotificationDb, userCreatedAt: Date, readAt: Date | null): Promise<TimedUnreadSummary> {
    const unreadAfter = maxDate(userCreatedAt, readAt) ?? userCreatedAt;
    const sourceWhere = {
      type: "ARTICLE" as const,
      status: "PUBLISHED" as const,
      channel: {
        is: {
          code: officialChannelCode
        }
      },
      publishedAt: { gt: userCreatedAt }
    };
    const unreadWhere = {
      ...sourceWhere,
      updatedAt: { gt: unreadAfter }
    };
    const [latest, unreadCount] = await Promise.all([
      db.siteContent.findFirst({
        where: sourceWhere,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { updatedAt: true }
      }),
      db.siteContent.count({ where: unreadWhere })
    ]);

    return {
      unreadCount,
      latestAt: latest?.updatedAt ?? null
    };
  }

  private toSettings(settings: Prisma.UserNotificationSettingsGetPayload<Record<string, never>>): NotificationSettings {
    return {
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
      recommendEnabled: body.recommend.enabled,
    };
  }

  private async loadActiveUser(db: NotificationDb, userId: UUID): Promise<ActiveUserRecord> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
          id: true,
        status: true,
        createdAt: true
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
