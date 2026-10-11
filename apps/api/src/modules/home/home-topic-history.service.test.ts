import assert from "node:assert/strict";
import test from "node:test";
import { HomeTopicService } from "./home-topic.service";

test("home topic history returns a bounded summary page before the current issue", async () => {
  const calls: { findMany?: unknown; count?: unknown } = {};
  const prisma = {
    homeTopic: {
      findFirst: async () => ({ issueNo: 12 }),
      findMany: async (args: unknown) => {
        calls.findMany = args;
        return [{
          id: 8,
          title: "往期周刊",
          subTitle: null,
          recType: "HOME_STYLE",
          issueNo: 8,
          description: "本期寄语",
          coverImageUrl: null,
          publishedAt: new Date("2026-10-01T00:00:00.000Z"),
          updatedAt: new Date("2026-10-02T00:00:00.000Z"),
          _count: { items: 3 }
        }];
      },
      count: async (args: unknown) => {
        calls.count = args;
        return 205;
      }
    }
  };
  const service = new HomeTopicService(prisma as never, {} as never, {} as never);

  const result = await service.listTopicHistory({ protocol: "https" }, 2, 150);

  assert.deepEqual(calls.findMany, {
    where: { status: "LISTED", issueNo: { lt: 12 } },
    select: {
      id: true,
      title: true,
      subTitle: true,
      recType: true,
      issueNo: true,
      description: true,
      coverImageUrl: true,
      publishedAt: true,
      updatedAt: true,
      _count: { select: { items: { where: { recipe: { isInspiration: true, inspirationCategoryId: { not: null }, status: "ACTIVE" } } } } }
    },
    orderBy: [{ issueNo: "desc" }],
    skip: 100,
    take: 100
  });
  assert.deepEqual(calls.count, { where: { status: "LISTED", issueNo: { lt: 12 } } });
  assert.deepEqual(result, {
    items: [{
      id: 8,
      title: "往期周刊",
      subTitle: null,
      recType: "HOME_STYLE",
      recTypeText: "家常下饭",
      issueNo: 8,
      description: "本期寄语",
      coverImageUrl: null,
      recipeCount: 3,
      publishedAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z"
    }],
    page: 2,
    pageSize: 100,
    total: 205,
    hasNext: true
  });
});

test("home topic history is empty if no public current issue exists", async () => {
  let queries = 0;
  const prisma = {
    homeTopic: {
      findFirst: async () => null,
      findMany: async () => {
        queries += 1;
        return [];
      },
      count: async () => {
        queries += 1;
        return 0;
      }
    }
  };
  const service = new HomeTopicService(prisma as never, {} as never, {} as never);

  const result = await service.listTopicHistory({ protocol: "https" }, 1, 20);

  assert.deepEqual(result, { items: [], page: 1, pageSize: 20, total: 0, hasNext: false });
  assert.equal(queries, 0);
});

test("home topic detail keeps only five lightweight history previews", async () => {
  const historyQueries: unknown[] = [];
  const prisma = {
    homeTopic: {
      findFirst: async () => ({
        id: 12,
        title: "最新周刊",
        subTitle: null,
        recType: "HOME_STYLE",
        issueNo: 12,
        description: "本期寄语",
        coverImageUrl: null,
        publishedAt: new Date("2026-10-10T00:00:00.000Z"),
        updatedAt: new Date("2026-10-10T00:00:00.000Z"),
        items: []
      }),
      findMany: async (args: unknown) => {
        historyQueries.push(args);
        return [];
      },
      count: async () => 5
    }
  };
  const userTokenService = { readOptionalUserId: async () => null };
  const service = new HomeTopicService(prisma as never, {} as never, userTokenService as never);

  const result = await service.getCurrentTopic({ protocol: "https" });

  assert.equal(result.topic?.id, 12);
  assert.equal(historyQueries.length, 1);
  assert.deepEqual(historyQueries[0], {
    where: { status: "LISTED", issueNo: { lt: 12 } },
    select: {
      id: true,
      title: true,
      subTitle: true,
      recType: true,
      issueNo: true,
      description: true,
      coverImageUrl: true,
      publishedAt: true,
      updatedAt: true,
      _count: { select: { items: { where: { recipe: { isInspiration: true, inspirationCategoryId: { not: null }, status: "ACTIVE" } } } } }
    },
    orderBy: [{ issueNo: "desc" }],
    skip: 0,
    take: 5
  });
});
