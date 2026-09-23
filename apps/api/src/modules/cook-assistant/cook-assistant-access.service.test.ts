import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, HttpException } from "@nestjs/common";
import { CookAssistantAccessService } from "./cook-assistant-access.service";

type UnlockRow = {
  id: number;
  userId: number;
  recipeVersionId: number | null;
  planItemId: number | null;
  unlockedOn: Date;
  unlockedAt: Date;
  status?: "RESERVED" | "CONSUMED";
};

type WikiRequestRow = {
  id: number;
  userId: number;
  recipeVersionId: number;
  status: "PENDING" | "READY" | "REJECTED";
  requestedAt: Date;
  resolvedAt: Date | null;
  rejectionReason: string | null;
};

type IdempotencyRow = {
  operationId: string;
  operationType: string;
  userId: number | null;
  adminId: number | null;
  diningGroupId: number | null;
  requestHash: string;
  status: "PROCESSING" | "SUCCEEDED" | "FAILED";
  resultJson: unknown;
  createdAt: Date;
};

class FakePrisma {
  unlockRows: UnlockRow[] = [];
  wikiRequestRows: WikiRequestRow[] = [];
  idempotencyRows: IdempotencyRow[] = [];
  lockKeys: string[] = [];
  private nextUnlockId = 1;
  private txQueue = Promise.resolve();

  cookAssistantUnlock = {
    count: async ({ where }: { where: { userId: number; unlockedOn: Date } }) =>
      this.unlockRows.filter(row => row.userId === where.userId && row.unlockedOn.toISOString() === where.unlockedOn.toISOString()).length,
    findFirst: async ({ where }: { where: { userId: number; recipeVersionId?: number; planItemId?: number; status?: string } }) =>
      this.unlockRows.find(row => {
        if (row.userId !== where.userId) return false;
        if (where.status !== undefined && row.status !== where.status) return false;
        if (where.recipeVersionId !== undefined) return row.recipeVersionId === where.recipeVersionId;
        return row.planItemId === where.planItemId;
      }) ?? null,
    create: async ({ data }: { data: { userId: number; recipeVersionId?: number; planItemId?: number; unlockedOn: Date; status?: "RESERVED" | "CONSUMED" } }) => {
      const row: UnlockRow = {
        id: this.nextUnlockId++,
        userId: data.userId,
        recipeVersionId: data.recipeVersionId ?? null,
        planItemId: data.planItemId ?? null,
        unlockedOn: data.unlockedOn,
        unlockedAt: new Date("2026-09-13T03:00:00.000Z"),
        status: data.status ?? "CONSUMED"
      };
      this.unlockRows.push(row);
      return row;
    },
    updateMany: async ({ where, data }: { where: { userId?: number; recipeVersionId?: number; status?: string }; data: { status?: string } }) => {
      let count = 0;
      for (const row of this.unlockRows) {
        if (where.userId !== undefined && row.userId !== where.userId) continue;
        if (where.recipeVersionId !== undefined && row.recipeVersionId !== where.recipeVersionId) continue;
        if (where.status !== undefined && row.status !== where.status) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    },
    deleteMany: async ({ where }: { where: { userId?: number; recipeVersionId?: number; status?: string } }) => {
      const before = this.unlockRows.length;
      this.unlockRows = this.unlockRows.filter(row => {
        if (where.userId !== undefined && row.userId !== where.userId) return true;
        if (where.recipeVersionId !== undefined && row.recipeVersionId !== where.recipeVersionId) return true;
        if (where.status !== undefined && row.status !== where.status) return true;
        return false;
      });
      return { count: before - this.unlockRows.length };
    }
  };

  recipeCookAssistantRequest = {
    findUnique: async ({ where }: { where: { userId_recipeVersionId?: { userId: number; recipeVersionId: number } } }) => {
      const key = where.userId_recipeVersionId;
      return this.wikiRequestRows.find(row => row.userId === key?.userId && row.recipeVersionId === key?.recipeVersionId) ?? null;
    },
    findMany: async ({ where }: { where: { recipeVersionId?: number; status?: string } }) => this.wikiRequestRows.filter(row => {
      if (where.recipeVersionId !== undefined && row.recipeVersionId !== where.recipeVersionId) return false;
      if (where.status !== undefined && row.status !== where.status) return false;
      return true;
    }),
    upsert: async ({ where, create, update }: { where: { userId_recipeVersionId: { userId: number; recipeVersionId: number } }; create: Omit<WikiRequestRow, "id">; update: Partial<WikiRequestRow> }) => {
      const key = where.userId_recipeVersionId;
      const existing = this.wikiRequestRows.find(row => row.userId === key.userId && row.recipeVersionId === key.recipeVersionId);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const row = { id: this.wikiRequestRows.length + 1, ...create };
      this.wikiRequestRows.push(row);
      return row;
    },
    updateMany: async ({ where, data }: { where: { recipeVersionId?: number; userId?: number; status?: string }; data: Partial<WikiRequestRow> }) => {
      let count = 0;
      for (const row of this.wikiRequestRows) {
        if (where.recipeVersionId !== undefined && row.recipeVersionId !== where.recipeVersionId) continue;
        if (where.userId !== undefined && row.userId !== where.userId) continue;
        if (where.status !== undefined && row.status !== where.status) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    }
  };

  idempotencyRecord = {
    findFirst: async ({ where }: { where: { operationId: string; operationType: string; userId?: number; diningGroupId?: number | null } }) =>
      this.idempotencyRows.find(row => {
        return (
          row.operationId === where.operationId &&
          row.operationType === where.operationType &&
          row.userId === where.userId &&
          row.diningGroupId === where.diningGroupId
        );
      }) ?? null,
    create: async ({ data }: { data: Omit<IdempotencyRow, "adminId" | "resultJson" | "createdAt"> }) => {
      this.idempotencyRows.push({
        ...data,
        adminId: null,
        resultJson: null,
        createdAt: new Date()
      });
    },
    updateMany: async ({ where, data }: { where: Partial<IdempotencyRow>; data: Partial<IdempotencyRow> }) => {
      let count = 0;
      for (const row of this.idempotencyRows) {
        const matched = Object.entries(where).every(([key, value]) => row[key as keyof IdempotencyRow] === value);
        if (!matched) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    }
  };

  async $queryRaw(strings: TemplateStringsArray, key: string) {
    this.lockKeys.push(key);
    return [];
  }

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    const run = this.txQueue.then(() => callback(this));
    this.txQueue = run.then(() => undefined, () => undefined);
    return run;
  }
}

const now = new Date("2026-09-13T15:30:00.000Z");

test("reports usage for the Shanghai business date and ignores yesterday unlocks", async () => {
  const prisma = new FakePrisma();
  prisma.unlockRows.push({
    id: 1,
    userId: 7,
    recipeVersionId: 100,
    planItemId: null,
    unlockedOn: new Date("2026-09-12T00:00:00.000Z"),
    unlockedAt: new Date("2026-09-12T01:00:00.000Z")
  });
  const service = new CookAssistantAccessService(prisma as never);

  const usage = await service.getUsage(7, now);

  assert.deepEqual(usage, {
    activityEnabled: true,
    businessDate: "2026-09-13",
    dailyUnlockLimit: 2,
    usedCount: 0,
    remainingCount: 2,
    resetsAt: "2026-09-13T16:00:00.000Z"
  });
});

test("uses one daily pool for recipe and meal targets and keeps unlocks permanent", async () => {
  const service = new CookAssistantAccessService(new FakePrisma() as never);

  const recipe = await service.unlockRecipeVersion(7, 100, "1001", now);
  const meal = await service.unlockMealPlan(7, 200, "1002", now);

  assert.equal(recipe.newlyUnlocked, true);
  assert.equal(meal.newlyUnlocked, true);
  assert.equal(meal.usage.usedCount, 2);
  assert.equal(meal.usage.remainingCount, 0);
});

test("does not consume another daily count for an already unlocked target", async () => {
  const service = new CookAssistantAccessService(new FakePrisma() as never);

  await service.unlockRecipeVersion(7, 100, "1001", now);
  const repeated = await service.unlockRecipeVersion(7, 100, "1002", now);

  assert.equal(repeated.newlyUnlocked, false);
  assert.equal(repeated.usage.usedCount, 1);
  assert.equal(repeated.usage.remainingCount, 1);
});

test("rejects a third different target without writing an unlock", async () => {
  const prisma = new FakePrisma();
  const service = new CookAssistantAccessService(prisma as never);

  await service.unlockRecipeVersion(7, 100, "1001", now);
  await service.unlockMealPlan(7, 200, "1002", now);

  await assert.rejects(() => service.unlockRecipeVersion(7, 101, "1003", now), (error: unknown) => {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), 429);
    return true;
  });
  assert.equal(prisma.unlockRows.length, 2);
});

test("serializes concurrent unlocks so only one target succeeds when one count remains", async () => {
  const prisma = new FakePrisma();
  const service = new CookAssistantAccessService(prisma as never);
  await service.unlockRecipeVersion(7, 100, "1001", now);

  const results = await Promise.allSettled([
    service.unlockMealPlan(7, 200, "1002", now),
    service.unlockRecipeVersion(7, 101, "1003", now)
  ]);

  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  assert.equal(prisma.unlockRows.length, 2);
  assert.ok(prisma.lockKeys.some(key => key === "COOK_ASSISTANT_USAGE:7:2026-09-13"));
});

test("returns the first result for an idempotent retry and rejects key reuse for another target", async () => {
  const service = new CookAssistantAccessService(new FakePrisma() as never);

  const first = await service.unlockRecipeVersion(7, 100, "1001", now);
  const retry = await service.unlockRecipeVersion(7, 100, "1001", now);

  assert.deepEqual(retry, first);
  await assert.rejects(() => service.unlockMealPlan(7, 200, "1001", now), ConflictException);
});

test("reserves one count for a recipe Wiki request and only refreshes its latest request time", async () => {
  const prisma = new FakePrisma();
  const service = new CookAssistantAccessService(prisma as never);

  const first = await service.requestRecipeWiki(7, 100, "2001", now);
  const repeated = await service.requestRecipeWiki(7, 100, "2002", new Date("2026-09-13T15:40:00.000Z"));

  assert.equal(first.status, "PENDING");
  assert.equal(first.usage.usedCount, 1);
  assert.equal(repeated.status, "PENDING");
  assert.equal(repeated.usage.usedCount, 1);
  assert.equal(prisma.unlockRows.length, 1);
  assert.equal(prisma.wikiRequestRows.length, 1);
  assert.equal(prisma.wikiRequestRows[0]?.requestedAt.toISOString(), "2026-09-13T15:40:00.000Z");
});

test("settling a Wiki request consumes or releases only the requesting user's reservation", async () => {
  const prisma = new FakePrisma();
  const service = new CookAssistantAccessService(prisma as never);

  await service.requestRecipeWiki(7, 100, "2101", now);
  await service.requestRecipeWiki(8, 100, "2102", now);
  const readyUsers = await service.settleRecipeWikiRequest(prisma as never, 100, "READY", now);

  assert.deepEqual(readyUsers, [7, 8]);
  assert.deepEqual(prisma.unlockRows.map(row => row.status), ["CONSUMED", "CONSUMED"]);
  assert.deepEqual(prisma.wikiRequestRows.map(row => row.status), ["READY", "READY"]);

  await service.requestRecipeWiki(7, 101, "2103", now);
  const rejectedUsers = await service.settleRecipeWikiRequest(prisma as never, 101, "REJECTED", now, "菜谱不够完整");
  assert.deepEqual(rejectedUsers, [7]);
  assert.equal(prisma.unlockRows.some(row => row.recipeVersionId === 101), false);
  assert.equal(prisma.wikiRequestRows.find(row => row.recipeVersionId === 101)?.rejectionReason, "菜谱不够完整");
});

test("does not treat a reserved Wiki request as an unlocked recipe assistant", async () => {
  const prisma = new FakePrisma();
  prisma.unlockRows.push({
    id: 99,
    userId: 7,
    recipeVersionId: 100,
    planItemId: null,
    unlockedOn: new Date("2026-09-13T00:00:00.000Z"),
    unlockedAt: now,
    status: "RESERVED"
  });
  await assert.rejects(
    () => new CookAssistantAccessService(prisma as never).unlockRecipeVersion(7, 100, "2201", now),
    /Wiki 正在制作中/
  );
});
