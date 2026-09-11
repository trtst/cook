import assert from "node:assert/strict";
import test from "node:test";
import { NotificationService } from "./notification.service";

function createNotificationPrisma(fridgeRows: Array<{ id: number; name: string; updatedAt: Date }> = [], options: { officialRows?: Array<{ id: number; title: string; summary: string; bodyHtml: string; publishedAt: Date; updatedAt: Date }> } = {}) {
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
      findMany: async ({ where }: { where: { notificationId: { in: string[] } } }) =>
        where.notificationId.in.flatMap(notificationId => {
          const notificationAt = notificationReads.get(notificationId);
          return notificationAt ? [{ notificationId, notificationAt }] : [];
        }),
      upsert: async ({ create }: { create: { notificationId: string; notificationAt: Date } }) => {
        notificationReads.set(create.notificationId, create.notificationAt);
      }
    },
    ingredientRecommendation: emptySource,
    unitRecommendation: emptySource,
    shoppingListInvite: emptySource,
    fridgeItem: {
      ...emptySource,
      count: async () => fridgeRows.length,
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

test("opening the feed clears its badge without clearing an unread card until the card is opened", async () => {
  const service = new NotificationService(createNotificationPrisma() as never, {} as never);

  const badge = await (service as any).markBadgeSeen(9);
  const beforeOpen = await service.getFeed(9, 1, 20);
  const item = beforeOpen.items.find(candidate => candidate.id === "official:2");

  assert.equal(badge.unreadCount, 0);
  assert.equal(item?.isUnread, true);

  await (service as any).markItemRead(9, "official:2", "2026-09-04T09:00:00.000Z");

  const afterOpen = await service.getFeed(9, 1, 20);
  assert.equal(afterOpen.items.find(candidate => candidate.id === "official:2")?.isUnread, false);
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

test("fridge reminders keep one distinct notification for each expiring item", async () => {
  const service = new NotificationService(
    createNotificationPrisma([
      { id: 1, name: "西红柿", updatedAt: new Date("2026-09-04T10:00:00.000Z") },
      { id: 2, name: "鸡蛋", updatedAt: new Date("2026-09-04T11:00:00.000Z") },
      { id: 3, name: "香菇", updatedAt: new Date("2026-09-04T12:00:00.000Z") }
    ]) as never,
    {} as never
  );

  const result = await service.getFeed(9, 1, 20);
  const reminders = result.items.filter(item => item.typeLabel === "系统提醒");

  assert.equal(reminders.length, 3);
  assert.deepEqual(reminders.map(item => item.title).sort(), ["食材临期提醒：西红柿", "食材临期提醒：鸡蛋", "食材临期提醒：香菇"].sort());
});

test("fridge reminder pagination keeps the full source total", async () => {
  const service = new NotificationService(
    createNotificationPrisma([
      { id: 1, name: "西红柿", updatedAt: new Date("2026-09-04T10:00:00.000Z") },
      { id: 2, name: "鸡蛋", updatedAt: new Date("2026-09-04T11:00:00.000Z") },
      { id: 3, name: "香菇", updatedAt: new Date("2026-09-04T12:00:00.000Z") }
    ]) as never,
    {} as never
  );

  const result = await service.getFeed(9, 2, 1);

  assert.equal(result.total, 4);
  assert.equal(result.hasNext, true);
});
