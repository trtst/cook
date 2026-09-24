import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AdminIngredientImportService, buildIngredientImportRequestHash, matchIngredientBody, matchIngredientImportItem, toIngredientImportItemSummary, type IngredientMatchCandidate } from "./admin-ingredient-import.service";

function candidate(overrides: Partial<IngredientMatchCandidate> = {}): IngredientMatchCandidate {
  return {
    id: 4003,
    name: "土豆",
    aliases: ["马铃薯", "洋芋"],
    status: "ACTIVE",
    mergedToId: null,
    version: 1,
    ...overrides
  };
}

test("resolves an active alias over a disabled canonical name", () => {
  const result = matchIngredientBody(
    {
      name: "旧土豆",
      aliases: ["新土豆"],
      categoryCode: "PRODUCE",
      defaultUnitName: null,
      proteinType: null,
      isStaple: false,
      isSpicyIngredient: false,
      imageUrl: null,
      nutrition: null
    },
    [
      candidate({ id: 100, name: "旧土豆", aliases: [], status: "DISABLED" }),
      candidate({ id: 200, name: "新土豆", aliases: [], status: "ACTIVE" })
    ]
  );

  assert.deepEqual(result, {
    kind: "MATCHED",
    matchType: "ALIAS",
    ingredientId: 200,
    ingredientName: "新土豆"
  });
});

test("matches an imported alias to the canonical active ingredient", () => {
  const result = matchIngredientImportItem("马铃薯", [candidate()]);

  assert.deepEqual(result, {
    kind: "MATCHED",
    matchType: "ALIAS",
    ingredientId: 4003,
    ingredientName: "土豆"
  });
});

test("prefers an active ingredient over pending or disabled duplicate candidates", () => {
  const result = matchIngredientImportItem("土豆", [
    candidate({ id: 100, status: "PENDING" }),
    candidate({ id: 200, status: "DISABLED" }),
    candidate({ id: 300, status: "ACTIVE" })
  ]);

  assert.equal(result?.kind, "MATCHED");
  assert.equal(result?.ingredientId, 300);
});

test("resolves a merged alias to its active target", () => {
  const result = matchIngredientImportItem("马铃薯", [
    candidate({ id: 4002, status: "MERGED", mergedToId: 4003 }),
    candidate({ id: 4003, aliases: [], status: "ACTIVE" })
  ]);

  assert.deepEqual(result, {
    kind: "MATCHED",
    matchType: "ALIAS",
    ingredientId: 4003,
    ingredientName: "土豆"
  });
});

test("returns create when no name or alias matches", () => {
  assert.deepEqual(matchIngredientImportItem("红薯", [candidate()]), { kind: "CREATE" });
});

test("returns ambiguous when multiple active ingredients share an alias", () => {
  const result = matchIngredientImportItem("薯仔", [
    candidate({ id: 4003, aliases: ["薯仔"] }),
    candidate({ id: 4004, name: "马铃薯", aliases: ["薯仔"] })
  ]);

  assert.deepEqual(result, { kind: "AMBIGUOUS", ingredientIds: [4003, 4004] });
});

test("rejects an imported alias that conflicts with another ingredient's canonical name", async () => {
  const service = new AdminIngredientImportService({} as never);
  const tx = {
    ingredient: {
      update: async () => undefined
    }
  };

  await assert.rejects(
    () => (service as unknown as {
      appendAliases(
        tx: { ingredient: { update: () => Promise<undefined> } },
        ingredient: IngredientMatchCandidate,
        aliases: string[],
        candidates: IngredientMatchCandidate[]
      ): Promise<void>;
    }).appendAliases(
      tx,
      candidate({ aliases: [] }),
      ["红薯"],
      [candidate({ aliases: [] }), candidate({ id: 4004, name: "红薯", aliases: [] })]
    ),
    ConflictException
  );
});

test("does not treat a merged source alias as a conflict with its active target", async () => {
  const service = new AdminIngredientImportService({} as never);
  let updated = false;
  const target = candidate({ aliases: [], version: 3 });
  const merged = candidate({ id: 4002, name: "马铃薯", aliases: [], status: "MERGED", mergedToId: target.id });
  const tx = {
    ingredient: {
      updateMany: async () => {
        updated = true;
        return { count: 1 };
      }
    }
  };

  await (service as unknown as {
    appendAliases(
      tx: { ingredient: { updateMany: () => Promise<{ count: number }> } },
      ingredient: IngredientMatchCandidate,
      aliases: string[],
      candidates: IngredientMatchCandidate[]
    ): Promise<void>;
  }).appendAliases(tx, target, ["马铃薯"], [target, merged]);

  assert.equal(updated, true);
});

test("hashes imported JSON content instead of only file metadata", () => {
  const first = buildIngredientImportRequestHash([{ sourcePath: "potato.json", jsonText: "{\"v\":1}" }]);
  const second = buildIngredientImportRequestHash([{ sourcePath: "potato.json", jsonText: "{\"v\":2}" }]);

  assert.notEqual(first, second);
});

test("returns a bad request for an unsupported upload before opening a transaction", async () => {
  const prisma = {
    adminAccount: { findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] }) }
  };
  const service = new AdminIngredientImportService(prisma as never);

  await assert.rejects(
    () => service.createImportJob([{ originalname: "ingredients.txt", buffer: Buffer.from("{}") }], 1, "202609230010"),
    BadRequestException
  );
});

test("applies a root JSON validation error to every item in the source", async () => {
  const createdItems: Array<{ status: string; errorJson: unknown }> = [];
  const job = {
    id: 9201,
    sourceName: "invalid.json",
    status: "READY",
    totalCount: 0,
    readyCount: 0,
    needsFixCount: 0,
    importedCount: 0,
    failedCount: 0,
    createdByAdminId: 1,
    createdAt: new Date("2026-09-23T00:00:00.000Z"),
    updatedAt: new Date("2026-09-23T00:00:00.000Z")
  };
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    ingredientImportJob: {
      create: async () => job,
      findUnique: async () => job,
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(job, data)
    },
    ingredientImportItem: {
      create: async ({ data }: { data: { status: string; errorJson: unknown } }) => {
        createdItems.push(data);
        return { id: createdItems.length };
      },
      count: async () => 2
    },
    auditEvent: { create: async () => undefined }
  };
  const prisma = {
    adminAccount: { findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] }) },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
  };
  const source = JSON.stringify({
    schemaVersion: "wrong.v1",
    ingredients: [
      { name: "甲", aliases: [], categoryCode: "PRODUCE", defaultUnitName: null, proteinType: null, isStaple: false, isSpicyIngredient: false, imageUrl: null, nutrition: null },
      { name: "乙", aliases: [], categoryCode: "PRODUCE", defaultUnitName: null, proteinType: null, isStaple: false, isSpicyIngredient: false, imageUrl: null, nutrition: null }
    ]
  });
  const service = new AdminIngredientImportService(prisma as never);

  await service.createImportJob([{ originalname: "invalid.json", buffer: Buffer.from(source) }], 1, "202609230011");

  assert.deepEqual(createdItems.map(item => item.status), ["NEEDS_FIX", "NEEDS_FIX"]);
  assert.match(JSON.stringify(createdItems[1]?.errorJson), /schemaVersion/);
});

test("rejects duplicate nutrition conversion units before writing the mapping", async () => {
  const service = new AdminIngredientImportService({} as never);
  let mappingWritten = false;
  const tx = {
    nutrientFood: {
      findFirst: async () => ({ id: 8001 })
    },
    ingredientNutrientMapping: {
      findUnique: async () => null,
      upsert: async () => {
        mappingWritten = true;
      }
    },
    unit: {
      findFirst: async ({ where }: { where: { name: string } }) => ({ id: where.name === "个" ? 3001 : 3002 })
    },
    ingredientUnitNutrientConversion: {
      deleteMany: async () => undefined,
      createMany: async () => undefined
    }
  };

  await assert.rejects(
    () => (service as unknown as {
      writeNutritionIfMissing(tx: {
        nutrientFood: { findFirst: () => Promise<{ id: number }> };
        ingredientNutrientMapping: { findUnique: () => Promise<null>; upsert: () => Promise<void> };
        unit: { findFirst: (args: { where: { name: string } }) => Promise<{ id: number }> };
        ingredientUnitNutrientConversion: { deleteMany: () => Promise<void>; createMany: () => Promise<void> };
      }, ingredientId: number, nutrition: {
        sourceVersion: string;
        foodCode: string;
        foodName: string;
        matchType: "ALIAS";
        confidence: number;
        conversions: Array<{ unitName: string; gramsPerUnit: number }>;
      }): Promise<void>;
    }).writeNutritionIfMissing(tx, 4003, {
      sourceVersion: "2026-v1",
      foodCode: "021101",
      foodName: "马铃薯",
      matchType: "ALIAS",
      confidence: 0.98,
      conversions: [
        { unitName: "个", gramsPerUnit: 200 },
        { unitName: "个", gramsPerUnit: 210 }
      ]
    }),
    BadRequestException
  );
  assert.equal(mappingWritten, false);
});

test("returns the completed create result for a repeated import-job request", async () => {
  const serviceState = {
    records: [] as Array<{ status: string; requestHash: string; resultJson?: unknown; id: number }>,
    jobs: 0,
    items: 0
  };
  const createdAt = new Date("2026-09-20T00:00:00.000Z");
  const job = {
    id: 9001,
    sourceName: "potato.json",
    status: "READY",
    totalCount: 1,
    readyCount: 1,
    needsFixCount: 0,
    importedCount: 0,
    failedCount: 0,
    createdByAdminId: 1,
    createdAt,
    updatedAt: createdAt
  };
  const source = JSON.stringify({
    schemaVersion: "ingredient.import.v1",
    ingredients: [{
      name: "土豆",
      aliases: ["马铃薯"],
      categoryCode: "PRODUCE",
      defaultUnitName: "个",
      proteinType: null,
      isStaple: true,
      isSpicyIngredient: false,
      imageUrl: null,
      nutrition: null
    }]
  });
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => serviceState.records[0] ?? null,
      create: async ({ data }: { data: { requestHash: string } }) => {
        const record = { id: 1, status: "PROCESSING", requestHash: data.requestHash };
        serviceState.records[0] = record;
        return record;
      },
      updateMany: async ({ data }: { data: { resultJson: unknown } }) => {
        serviceState.records[0] = { ...serviceState.records[0], status: "SUCCEEDED", resultJson: data.resultJson };
        return { count: 1 };
      }
    },
    ingredientImportJob: {
      create: async () => {
        serviceState.jobs += 1;
        return job;
      },
      findUnique: async () => job,
      update: async ({ data }: { data: { status?: string; totalCount?: number; readyCount?: number; needsFixCount?: number; importedCount?: number; failedCount?: number } }) => {
        Object.assign(job, data);
        return job;
      }
    },
    ingredientImportItem: {
      create: async () => {
        serviceState.items += 1;
        return { id: serviceState.items };
      },
      count: async () => 1
    },
    auditEvent: { create: async () => undefined }
  };
  const prisma = {
    adminAccount: { findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] }) },
    ingredientImportJob: { update: async ({ data }: { data: { status: string } }) => Object.assign(job, data) },
    ingredientImportItem: { create: async () => { serviceState.items += 1; return { id: serviceState.items }; } },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
  };
  const service = new AdminIngredientImportService(prisma as never);
  const files = [{ originalname: "potato.json", buffer: Buffer.from(source), size: Buffer.byteLength(source) }];

  const first = await service.createImportJob(files, 1, "202609200001");
  const second = await service.createImportJob(files, 1, "202609200001");

  assert.deepEqual(second, first);
  assert.equal(serviceState.jobs, 1);
  assert.equal(serviceState.items, 1);
});

test("stores an idempotent result when an already imported item is retried", async () => {
  const body = {
    name: "土豆",
    aliases: ["马铃薯"],
    categoryCode: "PRODUCE",
    defaultUnitName: "个",
    proteinType: null,
    isStaple: true,
    isSpicyIngredient: false,
    imageUrl: null,
    nutrition: null
  } as const;
  let completed = 0;
  const item = {
    id: 9101,
    jobId: 9001,
    sourcePath: "potato.json#ingredients[0]",
    title: "土豆",
    status: "IMPORTED",
    rawBodyJson: { sourcePath: "potato.json", jsonText: "{}" },
    ingredientBodyJson: body,
    errorJson: [],
    warnJson: [],
    ingredientId: 4003,
    matchType: "EXACT_NAME",
    version: 2,
    createdAt: new Date("2026-09-20T00:00:00.000Z"),
    updatedAt: new Date("2026-09-20T00:00:00.000Z")
  };
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => {
        completed += 1;
        return { count: 1 };
      }
    },
    ingredientImportItem: { findUnique: async () => item },
    ingredient: { findMany: async () => [] }
  };
  const prisma = {
    adminAccount: { findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] }) },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
  };
  const service = new AdminIngredientImportService(prisma as never);

  const result = await service.importItem(9101, { operationId: "202609200002", expectedVersion: 2 }, 1);

  assert.equal(result.status, "IMPORTED");
  assert.equal(completed, 1);
});

test("returns a conflict when concurrent import creates hit the pending ingredient unique constraint", async () => {
  const body = {
    name: "并发食材",
    aliases: [],
    categoryCode: "PRODUCE",
    defaultUnitName: null,
    proteinType: null,
    isStaple: false,
    isSpicyIngredient: false,
    imageUrl: null,
    nutrition: null
  } as const;
  const item = {
    id: 9202,
    jobId: 9001,
    status: "READY",
    version: 1,
    ingredientBodyJson: body,
    errorJson: []
  };
  const uniqueError = new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "5.22.0" });
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    ingredientImportItem: { findUnique: async () => item },
    ingredient: {
      findMany: async () => [],
      create: async () => { throw uniqueError; }
    },
    ingredientCategory: { findFirst: async () => ({ id: 5001 }) },
    auditEvent: { create: async () => undefined }
  };
  const prisma = {
    adminAccount: { findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] }) },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
  };
  const service = new AdminIngredientImportService(prisma as never);

  await assert.rejects(
    () => service.importItem(item.id, { operationId: "202609230012", expectedVersion: item.version }, 1),
    ConflictException
  );
});

test("item summaries expose category and default unit for the import list", () => {
  const result = toIngredientImportItemSummary(
    {
      id: 9102,
      jobId: 9001,
      sourcePath: "potato.json#ingredients[0]",
      title: "土豆",
      status: "READY",
      errorJson: [],
      warnJson: [],
      ingredientBodyJson: { categoryCode: "PRODUCE", defaultUnitName: "个" },
      ingredientId: null,
      matchType: null,
      version: 1,
      createdAt: new Date("2026-09-20T00:00:00.000Z"),
      updatedAt: new Date("2026-09-20T00:00:00.000Z")
    },
    "蔬果菌菇"
  );

  assert.equal(result.categoryCode, "PRODUCE");
  assert.equal(result.categoryName, "蔬果菌菇");
  assert.equal(result.defaultUnitName, "个");
});

test("deleting a created pending import item also deletes its unused ingredient", async () => {
  const item = {
    id: 9103,
    jobId: 9001,
    sourcePath: "potato.json#ingredients[0]",
    title: "土豆",
    status: "IMPORTED",
    rawBodyJson: {},
    ingredientBodyJson: { name: "土豆", categoryCode: "PRODUCE", defaultUnitName: "个" },
    errorJson: [],
    warnJson: [],
    ingredientId: 4003,
    matchType: "CREATED_PENDING",
    version: 2,
    createdAt: new Date("2026-09-20T00:00:00.000Z"),
    updatedAt: new Date("2026-09-20T00:00:00.000Z")
  };
  const ingredient = { id: 4003, ownerId: null, status: "PENDING", version: 1, name: "土豆", categoryId: 5001 };
  const deleted: string[] = [];
  const tx = {
    $queryRaw: async () => [{ exists: false }],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    ingredientImportItem: {
      findUnique: async () => item,
      count: async () => 0,
      delete: async () => { deleted.push("item"); }
    },
    ingredient: {
      findUnique: async () => ingredient,
      count: async () => 0,
      delete: async () => { deleted.push("ingredient"); }
    },
    ingredientRecommendation: { count: async () => 0 },
    ingredientFeedback: { count: async () => 0 },
    fridgeItem: { count: async () => 0 },
    shoppingItem: { count: async () => 0 },
    ingredientImportJob: { update: async () => undefined },
    auditEvent: { create: async () => undefined }
  };
  const prisma = {
    adminAccount: { findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] }) },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
  };
  const service = new AdminIngredientImportService(prisma as never);

  const result = await service.deleteImportItem(9103, { operationId: "202609200003", expectedVersion: 2 }, 1);

  assert.equal(result.deletedIngredientId, 4003);
  assert.deepEqual(deleted, ["item", "ingredient"]);
});
