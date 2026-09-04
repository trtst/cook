import assert from "node:assert/strict";
import test from "node:test";
import { NotificationService } from "./notification.service";

function createNotificationPrisma() {
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

  return {
    $transaction: async <T>(callback: (tx: any) => Promise<T>) => callback(prisma),
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
    fridgeItem: emptySource,
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
}

const prisma = createNotificationPrisma();

test("new users only count official messages published after registration as unread", async () => {
  const service = new NotificationService(prisma as never, {} as never);

  const badge = await service.getBadge(9);

  assert.equal(badge.unreadCount, 1);
  assert.equal(badge.latestTime, "2026-09-04T09:00:00.000Z");
});
