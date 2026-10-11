import assert from "node:assert/strict";
import test from "node:test";
import { AdminService } from "./admin.service";

test("admin recommendation rank update stores the selected rank and audit reason", async () => {
  const recipe = {
    id: 10000001,
    title: "测试菜谱",
    coverImageUrl: null,
    status: "ACTIVE",
    isInspiration: true,
    inspirationCategoryId: 2001,
    inspirationCategory: { id: 2001, name: "家常菜" },
    owner: { uid: 10000001 },
    recommendationRank: "NORMAL",
    recommendationRankReason: null,
    version: 4,
    updatedAt: new Date("2026-10-10T00:00:00.000Z")
  };
  const audits: unknown[] = [];
  const writes: unknown[] = [];
  const idempotency = new Map<string, Record<string, unknown>>();
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async ({ where }: any) => idempotency.get(`${where.adminId}:${where.operationType}:${where.operationId}`) ?? null,
      create: async ({ data }: any) => {
        idempotency.set(`${data.adminId}:${data.operationType}:${data.operationId}`, data);
        return data;
      },
      updateMany: async ({ where, data }: any) => {
        const key = `${where.adminId}:${where.operationType}:${where.operationId}`;
        const record = idempotency.get(key);
        if (record) Object.assign(record, data);
        return { count: record ? 1 : 0 };
      }
    },
    recipe: {
      findFirst: async () => ({ ...recipe }),
      updateMany: async ({ where, data }: any) => {
        writes.push({ where, data });
        if (recipe.version !== where.version) return { count: 0 };
        recipe.recommendationRank = data.recommendationRank;
        recipe.recommendationRankReason = data.recommendationRankReason;
        recipe.version += 1;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...recipe })
    },
    auditEvent: { create: async ({ data }: any) => audits.push(data) }
  };
  const prisma = {
    adminAccount: { findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] }) },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
  };
  const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

  const result = await (service as any).setRecipeRecommendationRank(10000001, 1, {
    operationId: "10001001",
    expectedVersion: 4,
    rank: "DOWNRANK",
    reason: "近期内容质量待复核"
  });

  assert.equal(recipe.recommendationRank, "DOWNRANK");
  assert.equal(recipe.recommendationRankReason, "近期内容质量待复核");
  assert.equal(result.version, 5);
  assert.equal(writes.length, 1);
  assert.equal((audits[0] as any).action, "RECIPE_RECOMMENDATION_RANK_UPDATED");
  assert.deepEqual((audits[0] as any).payload, {
    previousRank: "NORMAL",
    rank: "DOWNRANK",
    reason: "近期内容质量待复核"
  });
});

test("admin recommendation rank update rejects a stale recipe version", async () => {
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    recipe: {
      findFirst: async () => ({ id: 10000001, isInspiration: true, inspirationCategoryId: 2001, version: 5 }),
      updateMany: async () => ({ count: 0 })
    },
    auditEvent: { create: async () => ({}) }
  };
  const prisma = {
    adminAccount: { findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] }) },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
  };
  const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

  await assert.rejects(
    () => (service as any).setRecipeRecommendationRank(10000001, 1, {
      operationId: "10001002",
      expectedVersion: 4,
      rank: "STRONG_DOWNRANK",
      reason: "质量问题"
    }),
    { message: "菜谱已被更新，请刷新后重试" }
  );
});
