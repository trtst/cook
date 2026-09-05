import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { HomeTopicService } from "./home-topic.service";
import { TableTopicService } from "./table-topic.service";

function idempotencyMock() {
  return {
    findFirst: async () => null,
    create: async () => ({}),
    updateMany: async () => ({ count: 1 })
  };
}

test("admin cannot delete a listed home topic", async () => {
  const topic = {
    id: 12,
    status: "LISTED",
    version: 3,
    coverImageUrl: null,
    title: "本周灵感",
    subTitle: null,
    recType: "HOME_STYLE",
    issueNo: 8,
    description: "先下架再删除",
    publishedAt: new Date("2026-09-06T01:00:00.000Z"),
    updatedAt: new Date("2026-09-06T01:00:00.000Z"),
    items: []
  };
  let deleted = false;
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: idempotencyMock(),
    homeTopic: {
      findUnique: async () => topic,
      delete: async () => {
        deleted = true;
      }
    }
  };
  const prisma = {
    $transaction: async (callback: (nextTx: unknown) => Promise<unknown>) => callback(tx)
  };
  const imageService = {
    buildImagePath: (topicId: number) => `/static/uploads/home-topics/${topicId}`,
    finishClear: async () => {},
    rollbackClear: async () => {}
  };
  const service = new HomeTopicService(prisma as never, imageService as never, {} as never);

  await assert.rejects(
    () =>
      (service as unknown as {
        deleteTopic(adminId: number, topicId: number, operationId: string, body: { expectedVersion: number }): Promise<unknown>;
      }).deleteTopic(1, topic.id, "10001", { expectedVersion: topic.version }),
    BadRequestException
  );
  assert.equal(deleted, false);
});

test("admin deletes an unlisted table topic and refreshes the backend list", async () => {
  const topic = {
    id: 21,
    status: "UNLISTED",
    version: 2,
    title: "餐桌话题",
    summary: "允许删除参与事实",
    coverImageUrl: null,
    activityAt: new Date("2026-09-06T02:00:00.000Z"),
    targetType: "PAGE",
    targetValue: null,
    updatedAt: new Date("2026-09-06T02:00:00.000Z"),
    _count: { participants: 4 }
  };
  let deletedId: number | null = null;
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: idempotencyMock(),
    tableTopic: {
      findUnique: async () => topic,
      delete: async ({ where }: { where: { id: number } }) => {
        deletedId = where.id;
        return topic;
      },
      findMany: async () => []
    }
  };
  const prisma = {
    $transaction: async (callback: (nextTx: unknown) => Promise<unknown>) => callback(tx)
  };
  const imageService = {
    buildImagePath: (topicId: number) => `/static/uploads/table-topics/${topicId}`,
    finishClear: async () => {},
    rollbackClear: async () => {}
  };
  const service = new TableTopicService(prisma as never, imageService as never, {} as never);

  const result = await (service as unknown as {
    deleteTopic(
      request: unknown,
      adminId: number,
      topicId: number,
      operationId: string,
      body: { expectedVersion: number }
    ): Promise<{ topics: unknown[] }>;
  }).deleteTopic({}, 1, topic.id, "10002", { expectedVersion: topic.version });

  assert.equal(deletedId, topic.id);
  assert.deepEqual(result.topics, []);
});

test("admin rolls back staged home topic image when delete transaction fails after callback", async () => {
  const topic = {
    id: 31,
    status: "UNLISTED",
    version: 2,
    coverImageUrl: "/static/uploads/home-topics/31",
    title: "本周灵感",
    subTitle: null,
    recType: "HOME_STYLE",
    issueNo: 9,
    description: "提交失败要恢复封面",
    publishedAt: new Date("2026-09-06T03:00:00.000Z"),
    updatedAt: new Date("2026-09-06T03:00:00.000Z"),
    items: []
  };
  let finishCount = 0;
  let rollbackCount = 0;
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: idempotencyMock(),
    homeTopic: {
      findUnique: async () => topic,
      delete: async () => topic,
      findMany: async () => []
    }
  };
  const prisma = {
    $transaction: async (callback: (nextTx: unknown) => Promise<unknown>) => {
      await callback(tx);
      throw new Error("commit failed");
    }
  };
  const imageService = {
    buildImagePath: (topicId: number) => `/static/uploads/home-topics/${topicId}`,
    stageClear: async () => "/tmp/home-topic-backup.png",
    finishClear: async () => {
      finishCount += 1;
    },
    rollbackClear: async () => {
      rollbackCount += 1;
    }
  };
  const service = new HomeTopicService(prisma as never, imageService as never, {} as never);

  await assert.rejects(
    () =>
      (service as unknown as {
        deleteTopic(adminId: number, topicId: number, operationId: string, body: { expectedVersion: number }): Promise<unknown>;
      }).deleteTopic(1, topic.id, "10003", { expectedVersion: topic.version }),
    /commit failed/
  );

  assert.equal(finishCount, 0);
  assert.equal(rollbackCount, 1);
});

test("admin does not restore table topic image when backup cleanup fails after delete commit", async () => {
  const topic = {
    id: 41,
    status: "UNLISTED",
    version: 2,
    title: "餐桌话题",
    summary: "提交成功后备份清理失败",
    coverImageUrl: "/static/uploads/table-topics/41",
    activityAt: new Date("2026-09-06T04:00:00.000Z"),
    targetType: "PAGE",
    targetValue: null,
    updatedAt: new Date("2026-09-06T04:00:00.000Z"),
    _count: { participants: 0 }
  };
  let rollbackCount = 0;
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: idempotencyMock(),
    tableTopic: {
      findUnique: async () => topic,
      delete: async () => topic,
      findMany: async () => []
    }
  };
  const prisma = {
    $transaction: async (callback: (nextTx: unknown) => Promise<unknown>) => callback(tx)
  };
  const imageService = {
    buildImagePath: (topicId: number) => `/static/uploads/table-topics/${topicId}`,
    stageClear: async () => "/tmp/table-topic-backup.png",
    finishClear: async () => {
      throw new Error("backup cleanup failed");
    },
    rollbackClear: async () => {
      rollbackCount += 1;
    }
  };
  const service = new TableTopicService(prisma as never, imageService as never, {} as never);

  const result = await (service as unknown as {
    deleteTopic(
      request: unknown,
      adminId: number,
      topicId: number,
      operationId: string,
      body: { expectedVersion: number }
    ): Promise<{ topics: unknown[] }>;
  }).deleteTopic({}, 1, topic.id, "10004", { expectedVersion: topic.version });

  assert.deepEqual(result.topics, []);
  assert.equal(rollbackCount, 0);
});
