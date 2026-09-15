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
  idempotencyRows: IdempotencyRow[] = [];
  lockKeys: string[] = [];
  private nextUnlockId = 1;
  private txQueue = Promise.resolve();

  cookAssistantUnlock = {
    count: async ({ where }: { where: { userId: number; unlockedOn: Date } }) =>
      this.unlockRows.filter(row => row.userId === where.userId && row.unlockedOn.toISOString() === where.unlockedOn.toISOString()).length,
    findFirst: async ({ where }: { where: { userId: number; recipeVersionId?: number; planItemId?: number } }) =>
      this.unlockRows.find(row => {
        if (row.userId !== where.userId) return false;
        if (where.recipeVersionId !== undefined) return row.recipeVersionId === where.recipeVersionId;
        return row.planItemId === where.planItemId;
      }) ?? null,
    create: async ({ data }: { data: { userId: number; recipeVersionId?: number; planItemId?: number; unlockedOn: Date } }) => {
      const row: UnlockRow = {
        id: this.nextUnlockId++,
        userId: data.userId,
        recipeVersionId: data.recipeVersionId ?? null,
        planItemId: data.planItemId ?? null,
        unlockedOn: data.unlockedOn,
        unlockedAt: new Date("2026-09-13T03:00:00.000Z")
      };
      this.unlockRows.push(row);
      return row;
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
