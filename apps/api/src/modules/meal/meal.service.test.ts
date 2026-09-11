import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmedRandomTagValues,
  createDiningEventShareToken,
  MealService,
  parseDiningEventShareInviteId,
  randomMenuEmptyLimitOptions,
  shouldConsumeRandomMenuQuota
} from "./meal.service";

test("random tag reads ignore candidates and AI regardless of source priority", () => {
  const values = confirmedRandomTagValues(
    [
      { id: 1, tagValue: "BREAKFAST", source: "AI", status: "CANDIDATE", sortOrder: null },
      { id: 2, tagValue: "LUNCH", source: "AUTO", status: "CONFIRMED", sortOrder: null },
      { id: 3, tagValue: "DINNER", source: "OPS", status: "CANDIDATE", sortOrder: null }
    ],
    true
  );

  assert.deepEqual(values, ["LUNCH"]);
});

test("conflicting confirmed scalar tags are not silently resolved by source", () => {
  const values = confirmedRandomTagValues(
    [
      { id: 1, tagValue: "PORK", source: "AUTO", status: "CONFIRMED", sortOrder: null },
      { id: 2, tagValue: "BEEF", source: "OPS", status: "CONFIRMED", sortOrder: null }
    ],
    false
  );

  assert.deepEqual(values, []);
});

test("only a non-empty random result consumes quota", () => {
  assert.equal(shouldConsumeRandomMenuQuota([]), false);
  assert.equal(shouldConsumeRandomMenuQuota([{ recipeVersionId: 1 }]), true);
});

test("empty random result uses the confirmed user rate-limit window", () => {
  assert.deepEqual(randomMenuEmptyLimitOptions(42), {
    key: "random-menu:empty:42",
    limit: 10,
    windowMs: 60_000
  });
});

test("dining-event share token is stable per invite and rejects tampering", () => {
  const token = createDiningEventShareToken(42);

  assert.equal(createDiningEventShareToken(42), token);
  assert.equal(parseDiningEventShareInviteId(token), 42);
  assert.equal(parseDiningEventShareInviteId(`${token}x`), null);
});

test("legacy memory snapshots without a generated code do not expose a broken URL", () => {
  const service = new MealService(
    {} as never,
    {} as never,
    {
      buildDiningMemoryAssetUrl: () => "/static/missing",
      buildDiningMemoryMiniCodeStorageKey: () => "uploads/dining-event-memory-codes/missing.png"
    } as never,
    {} as never,
    {} as never
  );

  const preview = (service as any).toDiningMemorySharePreview({
    title: "旧回忆",
    planDate: null,
    mealSlot: null,
    coverStorageKey: null,
    coverContentType: null,
    menuItemsSnapshot: [],
    participantsSnapshot: [],
    caption: null,
    createdAt: new Date("2026-09-10T12:00:00.000Z"),
    snapshotVersion: 1,
    shareTokenHash: "a".repeat(64)
  }, {});

  assert.equal(preview.miniCodeUrl, null);
});

test("next dining invite locks the event before checking active invites", async () => {
  const calls: string[] = [];
  const service = new MealService({} as never, {} as never, {} as never, {} as never, {} as never);
  const tx = {
    $queryRaw: async () => {
      calls.push("lock");
      return [];
    },
    diningEventShareInvite: {
      findFirst: async () => {
        calls.push("find");
        return { id: 7 };
      }
    }
  };

  const result = await (service as any).ensureNextDiningEventShareInvite(tx, 42, 9);

  assert.deepEqual(calls, ["lock", "find"]);
  assert.deepEqual(result, { id: 7 });
});

test("failed dining memory asset cleanup is recorded in the outbox", async () => {
  let created: unknown;
  const service = new MealService(
    {
      outboxEvent: {
        create: async (args: unknown) => {
          created = args;
          return {};
        }
      }
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  await (service as any).recordDiningMemoryStorageCleanup(82, ["uploads/memory-code.png"], new Error("storage unavailable"));

  assert.deepEqual(created, {
    data: {
      eventType: "ASSET_CLEANUP",
      aggregateType: "DINING_MEMORY_SHARE",
      aggregateId: 82,
      payload: { storageKeys: ["uploads/memory-code.png"] },
      lastError: "storage unavailable"
    }
  });
});

test("dining memory share prepares external assets outside database transactions", async () => {
  let inTransaction = false;
  const externalCalls: Array<{ name: string; inTransaction: boolean }> = [];
  const event = {
    id: 82,
    userId: 9,
    title: "周末家宴",
    status: "COMPLETED",
    completedAt: new Date("2026-09-11T12:00:00.000Z"),
    scheduledAt: new Date("2026-09-11T11:30:00.000Z"),
    diningGroupId: null,
    coverStorageKey: "uploads/dining-event-covers/82/source.webp",
    coverContentType: "image/webp",
    mealPlanItem: {
      planDate: new Date("2026-09-11T00:00:00.000Z"),
      mealSlot: "DINNER",
      shoppingList: null
    },
    user: { uid: 52738164, nickname: "主理人", avatarUrl: null },
    participants: [],
    wishItems: [],
    menuItems: [
      {
        id: 1,
        recipeVersionId: 1001,
        title: "番茄炒蛋",
        version: 1,
        recipeVersion: {
          currentRecipes: [{ id: 10001, ownerId: 9, coverImageUrl: null }]
        }
      }
    ],
    shareInvites: [],
    note: null
  };
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    diningEvent: {
      findUnique: async () => event
    },
    diningEventMemoryShare: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: 501,
        createdAt: new Date("2026-09-11T12:10:00.000Z"),
        ...data
      })
    },
    storageLedger: {
      aggregate: async () => ({ _sum: { usedBytes: 0 } }),
      upsert: async () => ({})
    }
  };
  const prisma = {
    $transaction: async <T>(callback: (nextTx: typeof tx) => Promise<T>) => {
      inTransaction = true;
      try {
        return await callback(tx);
      } finally {
        inTransaction = false;
      }
    }
  };
  const uploadService = {
    buildDiningMemoryCoverStorageKey: () => "uploads/dining-event-memory-covers/82/1.webp",
    copyDiningEventCoverToMemory: async () => {
      externalCalls.push({ name: "copyCover", inTransaction });
      return { storageKey: "uploads/dining-event-memory-covers/82/1.webp", contentType: "image/webp", sizeBytes: 2048 };
    },
    buildDiningMemoryMiniCodeStorageKey: () => "uploads/dining-event-memory-codes/hash.png",
    storeDiningMemoryMiniCode: async () => {
      externalCalls.push({ name: "storeMiniCode", inTransaction });
      return "uploads/dining-event-memory-codes/hash.png";
    },
    buildDiningMemoryAssetUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`,
    removeStorageFiles: async () => []
  };
  const wechatMiniCodeService = {
    createMemoryShareCode: async () => {
      externalCalls.push({ name: "createMiniCode", inTransaction });
      return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    }
  };
  const service = new MealService(
    prisma as never,
    { resolveForUser: async () => ({ storageLimitBytes: 10 * 1024 * 1024 }) } as never,
    uploadService as never,
    {} as never,
    wechatMiniCodeService as never
  );

  await service.createDiningMemoryShare({}, 9, 82, "10086", true, "吃得开心");

  assert.deepEqual(externalCalls, [
    { name: "copyCover", inTransaction: false },
    { name: "createMiniCode", inTransaction: false },
    { name: "storeMiniCode", inTransaction: false }
  ]);
});
