import assert from "node:assert/strict";
import test from "node:test";
import { NotificationService } from "./notification.service";

function createNotificationPrisma(fridgeRows: Array<{ id: number; name: string; updatedAt: Date }> = []) {
  const userCreatedAt = new Date("2026-09-04T08:00:00.000Z");
  const oldOfficialAt = new Date("2026-09-03T08:00:00.000Z");
  const newOfficialAt = new Date("2026-09-04T09:00:00.000Z");
  const officialRows = [
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

  const db: any = {
    user: {
      findUnique: async () => ({ id: 9, status: "ACTIVE", createdAt: userCreatedAt })
    },
    userNotificationSettings: {
      findUnique: async () => null
    },
    userNotificationState: {
      findUnique: async () => null
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
      count: async ({ where }: { where: { publishedAt?: { gt?: Date } } }) =>
        officialRows.filter(row => !where.publishedAt?.gt || row.publishedAt.getTime() > where.publishedAt.gt.getTime()).length,
      findFirst: async ({ where }: { where: { publishedAt?: { gt?: Date } } }) =>
        officialRows
          .filter(row => !where.publishedAt?.gt || row.publishedAt.getTime() > where.publishedAt.gt.getTime())
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0] ?? null,
      findMany: async () => officialRows
    }
  };
  db.$transaction = async <T>(callback: (tx: any) => Promise<T>) => callback(db);
  return db;
}

const prisma = createNotificationPrisma();

test("new users only count official messages published after registration as unread", async () => {
  const service = new NotificationService(prisma as never, {} as never);

  const badge = await service.getBadge(9);

  assert.equal(badge.unreadCount, 1);
  assert.equal(badge.latestTime, "2026-09-04T09:00:00.000Z");
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
  const reminders = result.items.filter(item => item.typeLabel === "系统提醒消息");

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

  assert.equal(result.total, 5);
  assert.equal(result.hasNext, true);
});
