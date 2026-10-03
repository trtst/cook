import assert from "node:assert/strict";
import test from "node:test";
import { NotificationService } from "./notification.service";

function createNotificationPrisma(
  fridgeRows: Array<{ id: number; name: string; updatedAt: Date }> = [],
  options: {
    officialRows?: Array<{ id: number; title: string; summary: string; bodyHtml: string; publishedAt: Date; updatedAt: Date }>;
    recipeRecommendationRows?: Array<{ id: number; userId: number; recipeTitle: string; status: "PENDING" | "REJECTED" | "ADOPTED"; reviewNote: string | null; updatedAt: Date }>;
    recipeReportRows?: Array<{ id: number; reporterId: number; reason: string; status: "OPEN" | "RESOLVED"; resolutionNote: string | null; updatedAt: Date }>;
    ingredientFeedbackRows?: Array<{ id: number; userId: number; ingredientName: string; suggestedName: string; status: "PENDING" | "REJECTED" | "ADOPTED"; reviewNote: string | null; updatedAt: Date }>;
    ingredientRecommendationRows?: Array<{ id: number; userId: number; ingredientName: string; status: "PENDING" | "REJECTED" | "ADOPTED" | "MERGED"; reviewNote: string | null; updatedAt: Date }>;
    unitRecommendationRows?: Array<{ id: number; userId: number; unitName: string; status: "PENDING" | "REJECTED" | "ADOPTED" | "MERGED"; reviewNote: string | null; updatedAt: Date }>;
    wikiRows?: Array<{
      id: number;
      status: "PENDING" | "READY" | "REJECTED";
      rejectionReason: string | null;
      resolvedAt: Date | null;
      updatedAt: Date;
      recipeVersion: { name: string; currentRecipes: Array<{ id: number; isInspiration: boolean }> };
    }>;
  } = {}
) {
  const userCreatedAt = new Date("2026-09-04T08:00:00.000Z");
  const oldOfficialAt = new Date("2026-09-03T08:00:00.000Z");
  const newOfficialAt = new Date("2026-09-04T09:00:00.000Z");
  const officialRows = options.officialRows ?? [
    {
      id: 1,
      title: "旧公告",
      summary: "注册前公告",
      bodyHtml: "",
      publishedAt: oldOfficialAt,
      updatedAt: oldOfficialAt
    },
    {
      id: 2,
      title: "新公告",
      summary: "注册后公告",
      bodyHtml: "",
      publishedAt: newOfficialAt,
      updatedAt: newOfficialAt
    }
  ];
  const wikiRows = options.wikiRows ?? [];
  const recipeRecommendationRows = options.recipeRecommendationRows ?? [];
  const recipeReportRows = options.recipeReportRows ?? [];
  const ingredientFeedbackRows = options.ingredientFeedbackRows ?? [];
  const ingredientRecommendationRows = options.ingredientRecommendationRows ?? [];
  const unitRecommendationRows = options.unitRecommendationRows ?? [];

  function createUserSource<T extends { updatedAt: Date; userId?: number; reporterId?: number }>(rows: T[], ownerField: "userId" | "reporterId") {
    const rowsForUser = (where?: Record<string, unknown>) => rows.filter(row => row[ownerField] === where?.[ownerField]);
    return {
      count: async ({ where }: { where?: Record<string, unknown> } = {}) => rowsForUser(where).length,
      findFirst: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        rowsForUser(where).slice().sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0] ?? null,
      findMany: async ({ where, take }: { where?: Record<string, unknown>; take?: number } = {}) => {
        const items = rowsForUser(where).slice().sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
        return typeof take === "number" ? items.slice(0, take) : items;
      }
    };
  }

  const emptySource = {
    count: async () => 0,
    findFirst: async () => null,
    findMany: async () => []
  };
  let notificationState: { badgeReadAt?: Date; feedReadAt?: Date } | null = null;
  const notificationReads = new Map<string, Date>();

  const db: any = {
    user: {
      findUnique: async () => ({ id: 9, status: "ACTIVE", createdAt: userCreatedAt })
    },
    userNotificationSettings: {
      findUnique: async () => null
    },
    userNotificationState: {
      findUnique: async () => notificationState,
      upsert: async ({ create, update }: { create: { badgeReadAt?: Date; feedReadAt?: Date }; update: { badgeReadAt?: Date; feedReadAt?: Date } }) => {
        notificationState = { ...(notificationState ?? {}), ...(notificationState ? update : create) };
        return notificationState;
      }
    },
    userNotificationRead: {
      findMany: async ({ where }: { where: { notificationId?: { in: string[] }; notificationAt?: { gt?: Date } } }) => {
        const rows = Array.from(notificationReads.entries()).map(([notificationId, notificationAt]) => ({ notificationId, notificationAt }));
        const notificationIds = where.notificationId?.in;
        const notificationAfter = where.notificationAt?.gt;
        const selected = notificationIds ? rows.filter(row => notificationIds.includes(row.notificationId)) : rows;
        return notificationAfter
          ? selected.filter(row => row.notificationAt.getTime() > notificationAfter.getTime())
          : selected;
      },
      upsert: async ({ create }: { create: { notificationId: string; notificationAt: Date } }) => {
        notificationReads.set(create.notificationId, create.notificationAt);
      }
    },
    ingredientRecommendation: createUserSource(ingredientRecommendationRows, "userId"),
    unitRecommendation: createUserSource(unitRecommendationRows, "userId"),
    recipeRecommendation: createUserSource(recipeRecommendationRows, "userId"),
    recipeReport: createUserSource(recipeReportRows, "reporterId"),
    ingredientFeedback: createUserSource(ingredientFeedbackRows, "userId"),
    shoppingListInvite: emptySource,
    recipeCookAssistantRequest: {
      count: async ({ where }: { where: { userId: number; status?: { in: string[] } } }) =>
        where.userId === 9 ? wikiRows.filter(row => !where.status || where.status.in.includes(row.status)).length : 0,
      findMany: async ({ where }: { where: { userId: number; status?: { in: string[] } }; take?: number }) =>
        where.userId === 9
          ? wikiRows.filter(row => !where.status || where.status.in.includes(row.status)).slice(0, 100)
          : [],
      findFirst: async ({ where }: { where: { userId: number; id: number; status?: { in: string[] } } }) =>
        where.userId === 9 && wikiRows.find(row => row.id === where.id && (!where.status || where.status.in.includes(row.status)))
    },
    fridgeItem: {
      ...emptySource,
      count: async ({ where }: { where?: { updatedAt?: { gt?: Date } } } = {}) => {
        const updatedAfter = where?.updatedAt?.gt;
        return fridgeRows.filter(row => !updatedAfter || row.updatedAt.getTime() > updatedAfter.getTime()).length;
      },
      findFirst: async () => fridgeRows.slice().sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0] ?? null,
      findMany: async ({ take }: { take?: number } = {}) => (typeof take === "number" ? fridgeRows.slice(0, take) : fridgeRows)
    },
    siteContent: {
      count: async ({ where }: { where: { publishedAt?: { gt?: Date }; updatedAt?: { gt?: Date } } }) =>
        officialRows.filter(row =>
          (!where.publishedAt?.gt || row.publishedAt.getTime() > where.publishedAt.gt.getTime()) &&
          (!where.updatedAt?.gt || row.updatedAt.getTime() > where.updatedAt.gt.getTime())
        ).length,
      findFirst: async ({ where }: { where: { publishedAt?: { gt?: Date }; updatedAt?: { gt?: Date } } }) =>
        officialRows
          .filter(row =>
            (!where.publishedAt?.gt || row.publishedAt.getTime() > where.publishedAt.gt.getTime()) &&
            (!where.updatedAt?.gt || row.updatedAt.getTime() > where.updatedAt.gt.getTime())
          )
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0] ?? null,
      findMany: async ({ where, take, orderBy }: { where?: { publishedAt?: { gt?: Date } }; take?: number; orderBy?: Array<{ updatedAt?: "asc" | "desc"; publishedAt?: "asc" | "desc" }> } = {}) => {
        const rows = officialRows
          .filter(row => !where?.publishedAt?.gt || row.publishedAt.getTime() > where.publishedAt.gt.getTime())
          .sort((left, right) => {
            const sort = orderBy?.[0] ?? { updatedAt: "desc" as const };
            const key = "updatedAt" in sort ? "updatedAt" : "publishedAt";
            const direction = sort[key] ?? "desc";
            return direction === "asc"
              ? left[key].getTime() - right[key].getTime()
              : right[key].getTime() - left[key].getTime();
          });
        return typeof take === "number" ? rows.slice(0, take) : rows;
      }
    }
  };
  db.$transaction = async <T>(callback: (tx: any) => Promise<T>) => callback(db);
  db.updateOfficialMessage = (updatedAt: Date) => {
    officialRows[1].updatedAt = updatedAt;
  };
  db.addOfficialMessage = (row: (typeof officialRows)[number]) => {
    officialRows.push(row);
  };
  return db;
}

const prisma = createNotificationPrisma();

test("new users only count official messages published after registration as unread", async () => {
  const service = new NotificationService(prisma as never, {} as never);

  const badge = await service.getBadge(9);

  assert.equal(badge.unreadCount, 1);
  assert.equal(badge.latestTime, "2026-09-04T09:00:00.000Z");
});

test("official content is presented as a published message event", async () => {
  const service = new NotificationService(prisma as never, {} as never);

  const result = await service.getFeed(9, 1, 20);
  const item = result.items.find(candidate => candidate.id === "official:2");

  assert.equal(item?.typeLabel, "炊火记");
  assert.equal(item?.title, "炊火记发布了《新公告》");
  assert.equal(item?.desc, "注册后公告");
});

test("recipe review, report handling, and ingredient correction results appear as unread notifications with notes", async () => {
  const reviewedAt = new Date("2026-09-04T11:00:00.000Z");
  const service = new NotificationService(
    createNotificationPrisma([], {
      officialRows: [],
      recipeRecommendationRows: [
        { id: 41, userId: 9, recipeTitle: "番茄炖牛腩", status: "REJECTED", reviewNote: "请补充完整步骤", updatedAt: reviewedAt },
        { id: 49, userId: 9, recipeTitle: "清炒时蔬", status: "ADOPTED", reviewNote: null, updatedAt: reviewedAt },
        { id: 50, userId: 8, recipeTitle: "他人的菜谱", status: "REJECTED", reviewNote: "不应泄露", updatedAt: reviewedAt }
      ],
      recipeReportRows: [
        { id: 42, reporterId: 9, reason: "内容错误", status: "RESOLVED", resolutionNote: "已核实并修正", updatedAt: reviewedAt },
        { id: 51, reporterId: 8, reason: "他人的举报", status: "RESOLVED", resolutionNote: "不应泄露", updatedAt: reviewedAt }
      ],
      ingredientFeedbackRows: [
        { id: 43, userId: 9, ingredientName: "西红柿", suggestedName: "番茄", status: "REJECTED", reviewNote: "系统名称暂不调整", updatedAt: reviewedAt },
        { id: 44, userId: 9, ingredientName: "白菜", suggestedName: "大白菜", status: "ADOPTED", reviewNote: null, updatedAt: reviewedAt }
      ],
      ingredientRecommendationRows: [
        { id: 45, userId: 9, ingredientName: "小白菜", status: "ADOPTED", reviewNote: null, updatedAt: reviewedAt },
        { id: 46, userId: 9, ingredientName: "旧名食材", status: "REJECTED", reviewNote: "已有同类食材", updatedAt: reviewedAt }
      ],
      unitRecommendationRows: [
        { id: 47, userId: 9, unitName: "把", status: "ADOPTED", reviewNote: null, updatedAt: reviewedAt },
        { id: 48, userId: 9, unitName: "盒", status: "REJECTED", reviewNote: "请换用更常见单位", updatedAt: reviewedAt }
      ]
    }) as never,
    {} as never
  );

  const result = await service.getFeed(9, 1, 20);
  const recipe = result.items.find(item => item.id === "recipe-recommendation:41");
  const adoptedRecipe = result.items.find(item => item.id === "recipe-recommendation:49");
  const report = result.items.find(item => item.id === "recipe-report:42");
  const feedback = result.items.find(item => item.id === "ingredient-feedback:43");
  const adoptedFeedback = result.items.find(item => item.id === "ingredient-feedback:44");
  const ingredientAdopted = result.items.find(item => item.id === "ingredient:45");
  const ingredientRejected = result.items.find(item => item.id === "ingredient:46");
  const unitAdopted = result.items.find(item => item.id === "unit:47");
  const unitRejected = result.items.find(item => item.id === "unit:48");

  assert.equal(recipe?.isUnread, true);
  assert.equal(recipe?.desc, "请补充完整步骤");
  assert.equal(adoptedRecipe?.desc, "“清炒时蔬”已收录到灵感");
  assert.equal(report?.isUnread, true);
  assert.equal(report?.desc, "已核实并修正");
  assert.equal(feedback?.isUnread, true);
  assert.equal(feedback?.desc, "系统名称暂不调整");
  assert.equal(adoptedFeedback?.desc, "“白菜”的纠错已采纳，名称更新为“大白菜”");
  assert.equal(ingredientAdopted?.desc, "“小白菜”已收录为系统食材");
  assert.equal(ingredientRejected?.desc, "已有同类食材");
  assert.equal(unitAdopted?.desc, "“把”已收录为系统单位");
  assert.equal(unitRejected?.desc, "请换用更常见单位");
  assert.equal(result.items.find(item => item.id === "recipe-recommendation:50"), undefined);
  assert.equal(result.items.find(item => item.id === "recipe-report:51"), undefined);
  assert.equal((await service.getBadge(9)).unreadCount, 9);

  await (service as any).markItemRead(9, "recipe-report:42", reviewedAt.toISOString());
  assert.equal((await service.getBadge(9)).unreadCount, 8);
});

test("opening the feed clears the badge and the matching unread card together", async () => {
  const service = new NotificationService(createNotificationPrisma() as never, {} as never);

  const badge = await (service as any).markBadgeSeen(9);
  const beforeOpen = await service.getFeed(9, 1, 20);
  const item = beforeOpen.items.find(candidate => candidate.id === "official:2");

  assert.equal(badge.unreadCount, 0);
  assert.equal(item?.isUnread, false);

  await (service as any).markItemRead(9, "official:2", "2026-09-04T09:00:00.000Z");

  const afterOpen = await service.getFeed(9, 1, 20);
  assert.equal(afterOpen.items.find(candidate => candidate.id === "official:2")?.isUnread, false);
});

test("marking one notification read removes only that notification from the badge count", async () => {
  const service = new NotificationService(
    createNotificationPrisma([], {
      officialRows: [
        {
          id: 1,
          title: "第一条公告",
          summary: "第一条",
          bodyHtml: "",
          publishedAt: new Date("2026-09-04T09:00:00.000Z"),
          updatedAt: new Date("2026-09-04T09:00:00.000Z")
        },
        {
          id: 2,
          title: "第二条公告",
          summary: "第二条",
          bodyHtml: "",
          publishedAt: new Date("2026-09-04T10:00:00.000Z"),
          updatedAt: new Date("2026-09-04T10:00:00.000Z")
        }
      ]
    }) as never,
    {} as never
  );

  assert.equal((await service.getBadge(9)).unreadCount, 2);

  await (service as any).markItemRead(9, "official:2", "2026-09-04T10:00:00.000Z");

  assert.equal((await service.getBadge(9)).unreadCount, 1);
});

test("leaving the feed only clears cards at the entry frontier", async () => {
  const service = new NotificationService(createNotificationPrisma() as never, {} as never);

  await service.markFeedRead(9, "2026-09-04T08:30:00.000Z");
  assert.equal((await service.getFeed(9, 1, 20)).items.find(item => item.id === "official:2")?.isUnread, true);

  await service.markFeedRead(9, "2026-09-04T09:00:00.000Z");
  assert.equal((await service.getFeed(9, 1, 20)).items.find(item => item.id === "official:2")?.isUnread, false);
});

test("leaving an empty feed does not mark future notifications as read", async () => {
  const prisma = createNotificationPrisma([], { officialRows: [] });
  const service = new NotificationService(prisma as never, {} as never);

  await service.markFeedRead(9, "2026-09-05T00:00:00.000Z");
  prisma.addOfficialMessage({
    id: 3,
    title: "后来发布的公告",
    summary: "稍后出现",
    bodyHtml: "",
    publishedAt: new Date("2026-09-04T10:00:00.000Z"),
    updatedAt: new Date("2026-09-04T10:00:00.000Z")
  });

  const item = (await service.getFeed(9, 1, 20)).items.find(candidate => candidate.id === "official:3");
  assert.equal(item?.isUnread, true);
});

test("an updated official message becomes unread again with its current version time", async () => {
  const prisma = createNotificationPrisma();
  const service = new NotificationService(prisma as never, {} as never);

  await service.markBadgeSeen(9);
  await service.markItemRead(9, "official:2", "2026-09-04T09:00:00.000Z");
  prisma.updateOfficialMessage(new Date("2026-09-04T10:00:00.000Z"));

  const item = (await service.getFeed(9, 1, 20)).items.find(candidate => candidate.id === "official:2");
  assert.equal(item?.timeValue, "2026-09-04T10:00:00.000Z");
  assert.equal(item?.isUnread, true);
  assert.equal((await service.getBadge(9)).unreadCount, 1);
});

test("the newest official notification version stays on the first feed page", async () => {
  const prisma = createNotificationPrisma();
  const service = new NotificationService(prisma as never, {} as never);

  prisma.updateOfficialMessage(new Date("2026-09-04T12:00:00.000Z"));
  prisma.addOfficialMessage({
    id: 3,
    title: "较晚发布的公告",
    summary: "较晚发布但未更新",
    bodyHtml: "",
    publishedAt: new Date("2026-09-04T10:00:00.000Z"),
    updatedAt: new Date("2026-09-04T10:00:00.000Z")
  });

  const result = await service.getFeed(9, 1, 1);
  assert.equal(result.items[0]?.id, "official:2");
  assert.equal(result.items[0]?.timeValue, "2026-09-04T12:00:00.000Z");
});

test("Wiki READY and rejection results notify only the requesting user", async () => {
  const service = new NotificationService(
    createNotificationPrisma([], {
      officialRows: [],
      wikiRows: [
        {
          id: 31,
          status: "READY",
          rejectionReason: null,
          resolvedAt: new Date("2026-09-04T13:00:00.000Z"),
          updatedAt: new Date("2026-09-04T13:00:00.000Z"),
          recipeVersion: { name: "红烧排骨", currentRecipes: [{ id: 101, isInspiration: false }] }
        },
        {
          id: 32,
          status: "REJECTED",
          rejectionReason: "菜谱不够完整",
          resolvedAt: new Date("2026-09-04T12:00:00.000Z"),
          updatedAt: new Date("2026-09-04T12:00:00.000Z"),
          recipeVersion: { name: "番茄鸡蛋", currentRecipes: [{ id: 102, isInspiration: true }] }
        },
        {
          id: 33,
          status: "PENDING",
          rejectionReason: null,
          resolvedAt: null,
          updatedAt: new Date("2026-09-04T14:00:00.000Z"),
          recipeVersion: { name: "不应通知", currentRecipes: [{ id: 103, isInspiration: false }] }
        }
      ]
    }) as never,
    {} as never
  );

  const result = await service.getFeed(9, 1, 20);
  const wikiItems = result.items.filter(item => item.id.startsWith("recipe-wiki:"));
  assert.equal(wikiItems.length, 2);
  assert.equal(wikiItems.find(item => item.id === "recipe-wiki:31")?.targetPath, "/pages_recipe/detail/index?recipeId=101&kind=my");
  assert.equal(wikiItems.find(item => item.id === "recipe-wiki:32")?.desc, "菜谱不够完整");
});
