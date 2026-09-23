import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmedRandomTagValues,
  createDiningMemoryShareToken,
  createDiningEventShareToken,
  MealService,
  parseDiningMemoryShareEventId,
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

test("cancelling an unaccepted dining event expires invites and releases its plan", async () => {
  const inviteUpdates: unknown[] = [];
  let event = {
    id: 82,
    userId: 9,
    mealPlanItemId: 501,
    status: "CONFIRMED",
    scheduledAt: new Date("2026-10-01T12:00:00.000Z"),
    completedAt: null,
    version: 3,
    participants: [{ userId: 10, status: "INVITED" }]
  };
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    diningEvent: {
      findUnique: async () => event,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        event = { ...event, ...data, version: event.version + 1 };
        return event;
      }
    },
    diningEventShareInvite: {
      updateMany: async (args: unknown) => {
        inviteUpdates.push(args);
        return { count: 1 };
      }
    }
  };
  const service = new MealService(
    { $transaction: async <T>(callback: (db: typeof tx) => Promise<T>) => callback(tx) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );
  (service as any).toDiningEventSummary = (row: typeof event) => ({
    id: row.id,
    status: row.status,
    planItemId: row.mealPlanItemId
  });

  const result = await (service as any).cancelDiningEvent(9, 82, "1001");

  assert.deepEqual(result, { id: 82, status: "CANCELLED", planItemId: null });
  assert.equal(event.status, "CANCELLED");
  assert.equal(event.mealPlanItemId, null);
  assert.equal(inviteUpdates.length, 1);
  const inviteUpdate = inviteUpdates[0] as any;
  assert.deepEqual(inviteUpdate.where, {
    diningEventId: 82,
    status: { in: ["ACTIVE", "OPENED"] }
  });
  assert.equal(inviteUpdate.data.status, "EXPIRED");
  assert.ok(inviteUpdate.data.expiredAt instanceof Date);
});

test("confirming a menu does not create shopping items before the user chooses to shop", async () => {
  const pantryCalls: unknown[] = [];
  const plan = {
    id: 501,
    status: "CONFIRMED",
    dishes: [{ id: 701 }],
    version: 3,
    menuLockedAt: new Date("2026-09-24T08:00:00.000Z"),
    diningEvent: null
  };
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    mealPlanItem: {
      update: async () => plan
    }
  };
  const service = new MealService(
    { $transaction: async <T>(callback: (db: typeof tx) => Promise<T>) => callback(tx) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { syncPlanShoppingGapInTransaction: async (...args: unknown[]) => pantryCalls.push(args) } as never
  );
  (service as any).getOwnedMealPlanOrThrow = async () => plan;
  (service as any).getMealPlanOrThrow = async () => plan;
  (service as any).toMealPlanSummary = () => ({ id: plan.id, version: plan.version });

  const result = await service.confirmMealPlanMenu(9, plan.id, "1001", plan.version);

  assert.deepEqual(result, { id: plan.id, version: plan.version });
  assert.deepEqual(pantryCalls, []);
});

test("dining memory code token is stable per event and rejects tampering", () => {
  const token = createDiningMemoryShareToken(82);

  assert.equal(createDiningMemoryShareToken(82), token);
  assert.match(token, /^[A-Za-z0-9_-]{1,32}$/);
  assert.equal(parseDiningMemoryShareEventId(token), 82);
  assert.equal(parseDiningMemoryShareEventId(`${token}x`), null);
});

test("public dining memory code reads the newest snapshot for its event", async () => {
  const service = new MealService({
    diningEventMemoryShare: {
      findFirst: async ({ where, orderBy }: { where: { diningEventId: number }; orderBy: { snapshotVersion: string } }) => {
        assert.deepEqual(where, { diningEventId: 82 });
        assert.deepEqual(orderBy, { snapshotVersion: "desc" });
        return {
          title: "更新后的回忆",
          planDate: null,
          mealSlot: null,
          coverStorageKey: null,
          coverContentType: null,
          miniCodeStorageKey: "uploads/dining-event-memory-codes/stable.png",
          menuItemsSnapshot: [],
          participantsSnapshot: [],
          caption: null,
          createdAt: new Date("2026-09-12T12:00:00.000Z"),
          snapshotVersion: 2,
          shareTokenHash: "b".repeat(64)
        };
      }
    }
  } as never, {} as never, {
    buildDiningMemoryAssetUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`
  } as never, {} as never, {} as never, {} as never, {} as never);

  const preview = await service.getDiningMemorySharePreview({}, createDiningMemoryShareToken(82));

  assert.equal(preview.title, "更新后的回忆");
  assert.equal(preview.snapshotVersion, 2);
  assert.equal(preview.miniCodeUrl, "/static/uploads/dining-event-memory-codes/stable.png");
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
    {} as never,
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
  const service = new MealService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
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

test("dining memory share creates the event code once and reuses it for later snapshots", async () => {
  let inTransaction = false;
  let snapshotVersion = 0;
  const externalCalls: Array<{ name: string; inTransaction: boolean }> = [];
  const event = {
    id: 82,
    userId: 9,
    title: "周末家宴",
    status: "COMPLETED",
    completedAt: new Date("2026-09-11T12:00:00.000Z"),
    scheduledAt: new Date("2026-09-11T11:30:00.000Z"),
    diningGroupId: null,
    memoryMiniCodeStorageKey: null as string | null,
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
      findUnique: async () => event,
      update: async ({ data }: { data: { memoryMiniCodeStorageKey: string } }) => {
        event.memoryMiniCodeStorageKey = data.memoryMiniCodeStorageKey;
        return event;
      }
    },
    diningEventMemoryShare: {
      findFirst: async () => snapshotVersion ? { snapshotVersion } : null,
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: 501,
        createdAt: new Date("2026-09-11T12:10:00.000Z"),
        ...data,
        snapshotVersion: snapshotVersion = Number(data.snapshotVersion)
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
    buildDiningMemoryMiniCodeStorageKey: () => "uploads/dining-event-memory-codes/hash.jpg",
    storeDiningMemoryMiniCode: async () => {
      externalCalls.push({ name: "storeMiniCode", inTransaction });
      return "uploads/dining-event-memory-codes/hash.jpg";
    },
    buildDiningMemoryAssetUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`,
    removeStorageFiles: async () => []
  };
  const wechatMiniCodeService = {
    createMemoryShareCode: async () => {
      externalCalls.push({ name: "createMiniCode", inTransaction });
      return { buffer: Buffer.from([255, 216, 255, 217]), contentType: "image/jpeg" };
    }
  };
  const service = new MealService(
    prisma as never,
    { resolveForUser: async () => ({ storageLimitBytes: 10 * 1024 * 1024 }) } as never,
    uploadService as never,
    {} as never,
    wechatMiniCodeService as never,
    {} as never,
    {} as never
  );

  await service.createDiningMemoryShare({}, 9, 82, "10086", true, "吃得开心");
  await service.createDiningMemoryShare({}, 9, 82, "10087", false, "下次再聚");

  assert.deepEqual(externalCalls, [
    { name: "copyCover", inTransaction: false },
    { name: "createMiniCode", inTransaction: false },
    { name: "storeMiniCode", inTransaction: false },
    { name: "copyCover", inTransaction: false }
  ]);
  assert.equal(event.memoryMiniCodeStorageKey, "uploads/dining-event-memory-codes/hash.jpg");
});

const mealAssistantGeneratedAt = new Date("2026-09-13T03:00:00.000Z");

const mealAssistantWikiBody = {
  summary: {
    stepCount: 2,
    prepStepCount: 1,
    cookStepCount: 1,
    serveStepCount: 0,
    totalDurationText: "约15分钟"
  },
  steps: [
    {
      order: 1,
      phase: "PREP" as const,
      action: "CUT" as const,
      title: "切番茄",
      detail: "番茄切块。",
      imageUrl: null,
      durationMinutes: 5,
      durationText: "约5分钟"
    },
    {
      order: 2,
      phase: "COOK" as const,
      action: "STIR_FRY" as const,
      title: "快炒",
      detail: "鸡蛋和番茄快速翻炒。",
      imageUrl: null,
      durationMinutes: 10,
      durationText: "约10分钟"
    }
  ]
};

function mealAssistantVersion(id: number, name: string, assistant: unknown = null) {
  return {
    id,
    name,
    story: null,
    baseServings: 2,
    difficulty: "EASY",
    duration: "WITHIN_15",
    estimatedCalories: null,
    tips: null,
    keywordsJson: [],
    toolsJson: [],
    ingredientsJson: [],
    stepsJson: [{ text: `${name}原始步骤`, imageUrl: null }],
    cookAssistant: assistant,
    currentRecipes: [{ id: id + 1000, coverImageUrl: null }]
  };
}

function mealAssistantPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    userId: 9,
    planDate: new Date("2026-09-13T00:00:00.000Z"),
    mealSlot: "DINNER",
    title: "周日晚餐",
    note: null,
    status: "PLANNED",
    version: 1,
    completedAt: null,
    createdAt: new Date("2026-09-13T01:00:00.000Z"),
    updatedAt: new Date("2026-09-13T01:00:00.000Z"),
    menuLockedAt: new Date("2026-09-13T01:10:00.000Z"),
    shoppingList: null,
    diningEvent: null,
    cookAssistant: null,
    dishes: [
      {
        id: 701,
        planItemId: 501,
        recipeId: 1201,
        recipeVersionId: 201,
        slotType: "MEAT",
        purchaseState: "READY",
        sortOrder: 0,
        createdAt: new Date("2026-09-13T01:00:00.000Z"),
        updatedAt: new Date("2026-09-13T01:00:00.000Z"),
        recipeVersion: { name: "番茄炒蛋", baseServings: 2, duration: "WITHIN_15" }
      },
      {
        id: 702,
        planItemId: 501,
        recipeId: 1202,
        recipeVersionId: 202,
        slotType: "VEGETABLE",
        purchaseState: "READY",
        sortOrder: 1,
        createdAt: new Date("2026-09-13T01:00:00.000Z"),
        updatedAt: new Date("2026-09-13T01:00:00.000Z"),
        recipeVersion: { name: "清炒青菜", baseServings: 2, duration: "WITHIN_15" }
      }
    ],
    ...overrides
  };
}

class FakeMealAssistantPrisma {
  plan = mealAssistantPlan();
  versions = new Map<number, unknown>([
    [
      201,
      mealAssistantVersion(201, "番茄炒蛋", {
        status: "READY",
        generatedAt: mealAssistantGeneratedAt,
        snapshotJson: mealAssistantWikiBody
      })
    ],
    [202, mealAssistantVersion(202, "清炒青菜")]
  ]);
  participantStatusByUser = new Map<number, string>();
  versionQueries: unknown[] = [];
  createdAssistantCount = 0;

  mealPlanItem = {
    findUnique: async ({ where }: { where: { id: number } }) => (where.id === this.plan.id ? this.plan : null),
    update: async () => this.plan
  };

  diningEventParticipant = {
    findFirst: async ({ where }: { where: { diningEventId: number; userId: number } }) => {
      const status = this.participantStatusByUser.get(where.userId);
      return status ? { status } : null;
    }
  };

  recipeContentVersion = {
    findMany: async (args: { where: { id: { in: number[] } } }) => {
      this.versionQueries.push(args);
      return args.where.id.in.map(id => this.versions.get(id)).filter(Boolean);
    }
  };

  mealPlanCookAssistant = {
    findUnique: async ({ where }: { where: { planItemId: number } }) => (where.planItemId === this.plan.id ? this.plan.cookAssistant : null),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.createdAssistantCount += 1;
      this.plan.cookAssistant = {
        id: 801,
        createdAt: new Date("2026-09-13T03:00:00.000Z"),
        updatedAt: new Date("2026-09-13T03:00:00.000Z"),
        menuDigest: null,
        snapshot: null,
        generatedAt: null,
        ...data
      } as never;
      return this.plan.cookAssistant;
    },
    update: async ({ data }: { data: Record<string, unknown> }) => {
      this.plan.cookAssistant = {
        ...((this.plan.cookAssistant as unknown as Record<string, unknown>) ?? {}),
        ...data
      } as never;
      return this.plan.cookAssistant;
    }
  };

  async $queryRaw() {
    return [];
  }

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    return callback(this);
  }
}

class FakeMealAssistantAccess {
  unlocks = new Map<string, { unlockedAt: Date }>();
  calls: Array<{ userId: number; planItemId: number; operationId: string }> = [];

  async getMealPlanUnlock(userId: number, planItemId: number) {
    return this.unlocks.get(`${userId}:${planItemId}`) ?? null;
  }

  async unlockMealPlan(userId: number, planItemId: number, operationId: string) {
    this.calls.push({ userId, planItemId, operationId });
    const key = `${userId}:${planItemId}`;
    const existing = this.unlocks.get(key);
    if (existing) {
      return {
        newlyUnlocked: false,
        unlockedAt: existing.unlockedAt.toISOString(),
        usage: {
          activityEnabled: true,
          businessDate: "2026-09-13",
          dailyUnlockLimit: 2,
          usedCount: 1,
          remainingCount: 1,
          resetsAt: "2026-09-13T16:00:00.000Z"
        }
      };
    }
    const unlockedAt = new Date("2026-09-13T03:10:00.000Z");
    this.unlocks.set(key, { unlockedAt });
    return {
      newlyUnlocked: true,
      unlockedAt: unlockedAt.toISOString(),
      usage: {
        activityEnabled: true,
        businessDate: "2026-09-13",
        dailyUnlockLimit: 2,
        usedCount: 1,
        remainingCount: 1,
        resetsAt: "2026-09-13T16:00:00.000Z"
      }
    };
  }
}

function createMealAssistantService(prisma = new FakeMealAssistantPrisma(), access = new FakeMealAssistantAccess()) {
  return {
    prisma,
    access,
    service: new MealService(prisma as never, {} as never, {} as never, {} as never, {} as never, access as never, {} as never)
  };
}

function diningSchedulePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    userId: 9,
    planDate: new Date("2026-10-01T00:00:00.000Z"),
    mealSlot: "DINNER",
    title: "晚餐饮食计划",
    note: null,
    status: "PLANNED",
    version: 1,
    completedAt: null,
    createdAt: new Date("2026-09-13T01:00:00.000Z"),
    updatedAt: new Date("2026-09-13T01:00:00.000Z"),
    menuLockedAt: null,
    shoppingList: null,
    diningEvent: null,
    cookAssistant: null,
    dishes: [],
    ...overrides
  };
}

class FakeDiningSchedulePrisma {
  plan = diningSchedulePlan();
  conflictPlan: ReturnType<typeof diningSchedulePlan> | null = null;
  event = this.eventRow();
  planUpdates: unknown[] = [];

  idempotencyRecord = {
    findFirst: async () => null,
    create: async () => ({}),
    updateMany: async () => ({ count: 1 })
  };

  mealPlanItem = {
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      if ((where.id as number | undefined) === this.plan.id) return this.plan;
      const unique = where.userId_planDate_mealSlot as
        | { userId: number; planDate: Date; mealSlot: string }
        | undefined;
      if (!unique) return null;
      if (
        this.conflictPlan &&
        unique.userId === this.conflictPlan.userId &&
        unique.mealSlot === this.conflictPlan.mealSlot &&
        unique.planDate.toISOString() === this.conflictPlan.planDate.toISOString()
      ) {
        return this.conflictPlan;
      }
      if (
        unique.userId === this.plan.userId &&
        unique.mealSlot === this.plan.mealSlot &&
        unique.planDate.toISOString() === this.plan.planDate.toISOString()
      ) {
        return this.plan;
      }
      return null;
    },
    update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
      assert.equal(where.id, this.plan.id);
      this.planUpdates.push(data);
      this.plan = {
        ...this.plan,
        ...(data.planDate ? { planDate: data.planDate as Date } : {}),
        ...(data.mealSlot ? { mealSlot: data.mealSlot as string } : {}),
        ...(data.title ? { title: data.title as string } : {}),
        version: data.version && typeof data.version === "object" ? this.plan.version + 1 : this.plan.version,
        updatedAt: new Date("2026-09-13T02:00:00.000Z")
      };
      this.event = this.eventRow();
      return this.plan;
    }
  };

  diningEvent = {
    findUnique: async () => this.event,
    update: async ({ data }: { data: Record<string, unknown> }) => {
      this.event = this.eventRow({
        scheduledAt: data.scheduledAt as Date,
        location: (data.location as string | null | undefined) ?? this.event.location,
        version: this.event.version + 1
      });
      return this.event;
    }
  };

  async $queryRaw() {
    return [];
  }

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    return callback(this);
  }

  eventRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 901,
      userId: 9,
      mealPlanItemId: this.plan.id,
      diningGroupId: null,
      title: "晚餐饮食计划",
      scheduledAt: new Date("2026-10-01T10:30:00.000Z"),
      location: null,
      note: null,
      coverStorageKey: null,
      coverContentType: null,
      status: "PLANNED",
      menuSnapshot: {
        name: "本餐菜单",
        story: null,
        baseServings: 1,
        difficulty: null,
        duration: null,
        estimatedCalories: null,
        tips: null,
        keywords: [],
        ingredients: [],
        steps: []
      },
      shareTokenHash: null,
      shareTokenExpiresAt: null,
      completedAt: null,
      version: 1,
      createdAt: new Date("2026-09-13T01:30:00.000Z"),
      updatedAt: new Date("2026-09-13T01:30:00.000Z"),
      user: { uid: 52738164, nickname: "主理人", avatarUrl: null },
      mealPlanItem: {
        planDate: this.plan.planDate,
        mealSlot: this.plan.mealSlot,
        shoppingList: null
      },
      shareInvites: [],
      participants: [],
      wishItems: [],
      menuItems: [],
      ...overrides
    };
  }
}

test("dining event menu summaries expose keywords from the fixed recipe version", () => {
  const prisma = new FakeDiningSchedulePrisma();
  const service = new MealService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const event = prisma.eventRow({
    menuItems: [
      {
        id: 801,
        recipeVersionId: 201,
        title: "番茄炒蛋",
        version: 1,
        recipeVersion: {
          keywordsJson: ["家常", "快手"],
          currentRecipes: [{ id: 1201, ownerId: 9, coverImageUrl: null }]
        }
      }
    ]
  });

  const summary = (service as any).toDiningEventSummary(event, 9);

  assert.deepEqual(summary.menuItems[0].keywords, ["家常", "快手"]);
});

test("dining event schedule update moves the linked plan to the scheduled time range", async () => {
  const prisma = new FakeDiningSchedulePrisma();
  const service = new MealService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);

  await service.updateDiningEventSchedule({}, 9, 901, "2001", 1, "2026-10-01T15:10:00.000Z", null);

  assert.equal(prisma.plan.mealSlot, "LATE_NIGHT");
  assert.equal(planDateText(prisma.plan.planDate), "2026-10-01");
  assert.equal(prisma.plan.title, "夜宵饮食计划");
  assert.equal(prisma.planUpdates.length, 1);
});

test("dining event schedule update rejects a slot that already has another plan", async () => {
  const prisma = new FakeDiningSchedulePrisma();
  prisma.conflictPlan = diningSchedulePlan({
    id: 777,
    mealSlot: "LATE_NIGHT",
    title: "已有夜宵"
  });
  const service = new MealService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);

  await assert.rejects(
    () => service.updateDiningEventSchedule({}, 9, 901, "2002", 1, "2026-10-01T15:10:00.000Z", null),
    error => error instanceof Error && error.message === "该时间对应的餐次已有安排"
  );

  assert.equal(prisma.plan.mealSlot, "DINNER");
});

function planDateText(value: Date) {
  return value.toISOString().slice(0, 10);
}

test("meal cook context returns current raw recipe steps without reading Wiki assistants", async () => {
  const { prisma, service } = createMealAssistantService();

  const context = await service.getMealPlanCookContext(9, 501);

  assert.equal(context.planItemId, 501);
  assert.equal(context.dishes.length, 2);
  assert.equal(context.dishes[0]?.content.steps[0]?.text, "番茄炒蛋原始步骤");
  assert.equal(JSON.stringify(prisma.versionQueries[0]).includes("cookAssistant"), false);
});

test("invited and accepted dining-event participants can access the same meal cook context", async () => {
  const prisma = new FakeMealAssistantPrisma();
  prisma.plan = mealAssistantPlan({ userId: 1, diningEvent: { id: 901 } });
  prisma.participantStatusByUser.set(9, "INVITED");
  prisma.participantStatusByUser.set(10, "ACCEPTED");
  const { service } = createMealAssistantService(prisma);

  assert.equal((await service.getMealPlanCookContext(9, 501)).diningEventId, 901);
  assert.equal((await service.getMealPlanCookContext(10, 501)).diningEventId, 901);
  await assert.rejects(() => service.getMealPlanCookContext(11, 501));

  prisma.participantStatusByUser.set(12, "REMOVED");
  await assert.rejects(() => service.getMealPlanCookContext(12, 501));
});

test("legacy meal assistant snapshots are not exposed as the new contract", async () => {
  const prisma = new FakeMealAssistantPrisma();
  prisma.plan = mealAssistantPlan({
    cookAssistant: {
      id: 801,
      planItemId: 501,
      menuDigest: "legacy",
      snapshot: { summary: { dishCount: 1 }, prepTasks: [], cookTimeline: [], serveTasks: [] },
      generatedAt: mealAssistantGeneratedAt,
      contractVersion: "legacy.v1",
      status: "READY",
      assistantJson: null,
      assistantGeneratedAt: null
    }
  });
  const { service } = createMealAssistantService(prisma);

  const result = await service.getMealPlanCookAssistant(9, 501);

  assert.equal(result.status, "NOT_GENERATED");
  assert.equal(result.assistant, null);
  assert.equal("isStale" in result, false);
});

test("meal assistant unlock creates one shared snapshot, marks ORIGINAL fallback dishes, and unlocks per user", async () => {
  const prisma = new FakeMealAssistantPrisma();
  prisma.plan = mealAssistantPlan({ diningEvent: { id: 901 } });
  prisma.participantStatusByUser.set(10, "ACCEPTED");
  const { access, service } = createMealAssistantService(prisma);

  const first = await service.unlockMealPlanCookAssistant(9, 501, "1001");
  const storedAfterFirst = prisma.plan.cookAssistant as unknown as { assistantJson: { dishes: Array<{ source: string }> } };
  const second = await service.unlockMealPlanCookAssistant(10, 501, "1002");

  assert.equal(first.newlyUnlocked, true);
  assert.equal(second.newlyUnlocked, true);
  assert.equal(prisma.createdAssistantCount, 1);
  assert.deepEqual(storedAfterFirst.assistantJson.dishes.map(item => item.source), ["WIKI", "ORIGINAL"]);
  assert.deepEqual(first.assistant?.dishes.map(item => item.source), ["WIKI", "ORIGINAL"]);
  assert.deepEqual(second.assistant, first.assistant);
  assert.deepEqual(access.calls.map(item => item.userId), [9, 10]);
});

test("meal assistant unlock fails without consuming a count when every dish lacks a READY Wiki", async () => {
  const prisma = new FakeMealAssistantPrisma();
  prisma.versions.set(201, mealAssistantVersion(201, "番茄炒蛋"));
  prisma.versions.set(202, mealAssistantVersion(202, "清炒青菜"));
  const { access, service } = createMealAssistantService(prisma);

  await assert.rejects(() => service.unlockMealPlanCookAssistant(9, 501, "1001"));

  assert.equal(access.calls.length, 0);
  assert.equal(prisma.createdAssistantCount, 0);
});

test("ready meal assistant snapshots are immutable and do not expose stale state after menu changes", async () => {
  const prisma = new FakeMealAssistantPrisma();
  const existingSnapshot = {
    contractVersion: 1,
    generatedAt: mealAssistantGeneratedAt.toISOString(),
    title: "旧晚餐",
    summary: "旧菜单助手",
    dishes: [{ dishId: 701, recipeVersionId: 201, title: "番茄炒蛋", source: "WIKI" }],
    steps: [
      {
        order: 1,
        phase: "COOK",
        title: "旧步骤",
        detail: "按旧菜单执行。",
        dishIds: [701],
        imageUrl: null,
        durationText: null,
        source: "WIKI",
        parallelKey: null
      }
    ],
    notes: []
  };
  prisma.plan = mealAssistantPlan({
    dishes: [
      ...mealAssistantPlan().dishes,
      {
        id: 703,
        planItemId: 501,
        recipeId: 1203,
        recipeVersionId: 203,
        slotType: "SOUP",
        purchaseState: "READY",
        sortOrder: 2,
        createdAt: new Date("2026-09-13T01:00:00.000Z"),
        updatedAt: new Date("2026-09-13T01:00:00.000Z"),
        recipeVersion: { name: "紫菜汤", baseServings: 2, duration: "WITHIN_15" }
      }
    ],
    cookAssistant: {
      id: 801,
      planItemId: 501,
      contractVersion: "meal-assistant.v1",
      status: "READY",
      assistantJson: existingSnapshot,
      assistantGeneratedAt: mealAssistantGeneratedAt,
      menuDigest: null,
      snapshot: null,
      generatedAt: null
    }
  });
  const access = new FakeMealAssistantAccess();
  access.unlocks.set("9:501", { unlockedAt: new Date("2026-09-13T03:10:00.000Z") });
  const { service } = createMealAssistantService(prisma, access);

  const result = await service.getMealPlanCookAssistant(9, 501);

  assert.equal("isStale" in result, false);
  assert.equal(result.assistant?.title, "旧晚餐");
  assert.deepEqual(result.assistant?.dishes.map(item => item.dishId), [701]);
});
