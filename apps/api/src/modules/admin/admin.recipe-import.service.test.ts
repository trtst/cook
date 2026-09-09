import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { AdminService } from "./admin.service";
import type { RecipeImportRawBody, RecipeImportRecipeBody } from "../../contracts/types";

function buildBody(overrides: Partial<RecipeImportRecipeBody> = {}): RecipeImportRecipeBody {
  return {
    inspirationCategoryId: 1,
    title: "测试导入菜谱",
    story: "用于验证导入服务。",
    baseServings: 2,
    difficulty: "EASY",
    duration: "BETWEEN_15_30",
    tips: "按步骤完成。",
    coverImageUrl: null,
    coverImageKey: null,
    coverImageTempKey: null,
    tools: [{ name: "炒锅" }],
    tags: [
      { tagCode: "MEAL_TYPE", tagValue: "DINNER" },
      { tagCode: "DISH_ROLE", tagValue: "MAIN" },
      { tagCode: "MAIN_PROTEIN_TYPE", tagValue: "NONE" },
      { tagCode: "FLAVOR_PROFILE", tagValue: "LIGHT" },
      { tagCode: "SPICE_LEVEL", tagValue: "NONE" }
    ],
    assistantSteps: [{
      order: 1,
      phase: "PREP",
      action: "OTHER",
      title: "准备食材",
      detail: "准备食材。",
      imageUrl: null,
      durationMinutes: 5,
      durationText: "约 5 分钟"
    }],
    ingredients: [{
      line: "未知食材 适量",
      ingredientName: "未知食材",
      ingredientId: null,
      quantity: null,
      unitText: null,
      unitId: null,
      fuzzyText: "适量",
      note: null
    }],
    steps: [{ text: "完成烹饪。", imageUrl: null, imageKey: null, imageTempKey: null }],
    ...overrides
  };
}

function buildRawBody(): RecipeImportRawBody {
  return {
    sourcePath: "invalid.json",
    jsonText: "{}",
    assetFolder: "",
    images: []
  };
}

function createPublishService(
  currentItem: Record<string, unknown>,
  recipeCreateCalls: { count: number },
  imageService: {
    publishRemoteImage?: (...args: any[]) => Promise<{ storageKey: string; imageUrl: string }>;
    removePublishedImages?: (keys: Iterable<string>) => Promise<void>;
    postCommitReadError?: boolean;
  } = {}
) {
  let externalReadCount = 0;
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => undefined,
      updateMany: async () => ({ count: 1 })
    },
    recipeImportItem: {
      findUnique: async () => currentItem,
      findFirst: async () => currentItem,
      updateMany: async () => ({ count: 1 })
    },
    recipeContentVersion: {
      create: async () => ({ id: 903 })
    },
    recipeVersionTag: {
      createMany: async () => undefined,
      deleteMany: async () => undefined,
      findMany: async () => []
    },
    nutrientSourceBatch: {
      findFirst: async () => null
    },
    ingredient: {
      findMany: async () => [{ id: 1, name: "排骨", categoryId: 1, proteinType: "PORK", isStaple: false, isSpicyIngredient: false, aliases: [] }]
    },
    recipeInspirationOwner: {
      findMany: async () => Array.from({ length: 100 }, (_, index) => ({ userId: index + 1 }))
    },
    auditEvent: {
      create: async () => undefined
    },
    recipe: {
      create: async () => {
        recipeCreateCalls.count += 1;
        return { id: 1 };
      }
    }
  };
  const prisma = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    recipeImportItem: {
      findUnique: async () => currentItem,
      findFirst: async () => {
        externalReadCount += 1;
        if (imageService.postCommitReadError && externalReadCount > 1) throw new Error("post-commit read failed");
        return currentItem;
      }
    },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
  };
  return new AdminService(
    prisma as never,
    {} as never,
    {} as never,
    {
      discardTempImages: async () => undefined,
      publishRemoteImage: imageService.publishRemoteImage ?? (async () => ({ storageKey: "unused", imageUrl: "/unused" })),
      removePublishedImages: imageService.removePublishedImages ?? (async () => undefined)
    } as never,
    {} as never,
    {} as never
  );
}

test("publishing a JSON item with fuzzy or unmatched ingredients is blocked before Recipe creation", async () => {
  const recipeCreateCalls = { count: 0 };
  const recipeBody = buildBody();
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "invalid.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: recipeBody,
    version: 1,
    recipeId: null
  }, recipeCreateCalls);

  await assert.rejects(
    () => service.publishRecipeImportItem({}, 901, 1, { operationId: "202609080001", expectedVersion: 1 }),
    (error: unknown) => error instanceof BadRequestException && error.message.includes("未补全")
  );
  assert.equal(recipeCreateCalls.count, 0);
});

test("a pending system ingredient keeps an import item blocked before publish", async () => {
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "pending.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  const recipeBody = buildBody({
    ingredients: [{
      line: "新食材 100 克",
      ingredientName: "新食材",
      ingredientId: 321,
      quantity: "100",
      unitText: "克",
      unitId: 3,
      fuzzyText: null,
      note: null
    }]
  });
  const state = await (service as any).buildRecipeImportItemState({
    ingredient: {
      findMany: async () => [{
        id: 321,
        name: "新食材",
        status: "PENDING",
        category: { isSelectable: true }
      }]
    },
    unit: {
      findMany: async () => [{ id: 3, name: "克" }]
    }
  }, recipeBody, buildRawBody());

  assert.equal(state.errorItems.some((item: { field: string }) => item.field === "ingredients.0.ingredientId"), true);
});

test("does not delete published images when the committed publish response read fails", async () => {
  const recipeCreateCalls = { count: 0 };
  const removedStorageKeys: string[][] = [];
  const item = {
    id: 901,
    jobId: 902,
    sourcePath: "complete.json",
    status: "READY",
    rawBodyJson: {
      sourcePath: "complete.json",
      jsonText: "{}",
      assetFolder: "",
      images: []
    },
    recipeBodyJson: buildBody({ coverImageUrl: "https://cdn.example.com/cover.jpg" }),
    version: 1,
    recipeId: null
  };
  const service = createPublishService(item, recipeCreateCalls, {
    publishRemoteImage: async () => ({ storageKey: "uploads/admin-recipe-images/cover.jpg", imageUrl: "/static/uploads/admin-recipe-images/cover.jpg" }),
    removePublishedImages: async (keys: Iterable<string>) => {
      removedStorageKeys.push(Array.from(keys));
    },
    postCommitReadError: true
  });
  (service as any).buildRecipeImportItemState = async () => ({ errorItems: [], warnItems: [] });
  (service as any).requireInspirationCategory = async () => ({ id: 1 });
  (service as any).buildAdminRecipeContent = async () => ({
    name: "测试导入菜谱",
    story: null,
    baseServings: 2,
    difficulty: "EASY",
    duration: "BETWEEN_15_30",
    estimatedCalories: null,
    tips: null,
    tools: [],
    ingredients: [{ ingredientId: 1, ingredientName: "排骨", source: "SYSTEM", categoryId: 1, amount: { kind: "FUZZY", text: "适量" } }],
    steps: [{ text: "完成烹饪。", imageUrl: null }]
  });
  (service as any).assertAdminRecipeContent = () => undefined;
  (service as any).syncRecipeAssistant = async () => undefined;
  (service as any).writeRecipeImportJobStats = async () => undefined;
  (service as any).toRecipeImportItemSummary = () => ({ id: 901 });

  await assert.rejects(
    () => service.publishRecipeImportItem({}, 901, 1, { operationId: "202609080002", expectedVersion: 1 }),
    /post-commit read failed/
  );
  assert.equal(recipeCreateCalls.count, 1);
  assert.deepEqual(removedStorageKeys, []);
});

test("materializing an unknown import ingredient creates a pending system ingredient", async () => {
  const recipeCreateCalls = { count: 0 };
  const createdIngredients: Array<Record<string, unknown>> = [];
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "pending.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, recipeCreateCalls);
  (service as any).requireImportIngredientCategory = async () => ({ id: 777 });
  (service as any).requireSystemUnit = async (_tx: unknown, id: number) => ({ id, name: "克" });
  (service as any).nextSystemIngredientSortOrder = async () => 0;
  (service as any).nextSystemIngredientDisplaySortOrder = async () => 0;

  const tx = {
    ingredient: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdIngredients.push(data);
        return { id: 321, ...data };
      }
    }
  };

  const [result] = await (service as any).materializeImportIngredients(tx, [{
    line: "新食材 100 克",
    ingredientName: "新食材",
    ingredientId: null,
    quantity: "100",
    unitText: "克",
    unitId: 3,
    fuzzyText: null,
    note: null
  }]);

  assert.equal(createdIngredients[0]?.status, "PENDING");
  assert.equal(result.ingredientId, 321);
});

test("materializing an unknown ingredient does not depend on a precise quantity", async () => {
  const createdIngredients: Array<Record<string, unknown>> = [];
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "pending-fuzzy.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  (service as any).requireImportIngredientCategory = async () => ({ id: 777 });
  (service as any).requireSystemUnit = async (_tx: unknown, id: number) => ({ id, name: "克" });
  (service as any).nextSystemIngredientSortOrder = async () => 0;
  (service as any).nextSystemIngredientDisplaySortOrder = async () => 0;

  const [result] = await (service as any).materializeImportIngredients({
    ingredient: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdIngredients.push(data);
        return { id: 322, ...data };
      }
    }
  }, [{
    line: "新食材 适量",
    ingredientName: "新食材",
    ingredientId: null,
    quantity: null,
    unitText: "克",
    unitId: 3,
    fuzzyText: "适量",
    note: null
  }]);

  assert.equal(createdIngredients[0]?.status, "PENDING");
  assert.equal(result.ingredientId, 322);
});

test("materializing an already pending import ingredient reuses the existing system row", async () => {
  let createCount = 0;
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "pending-existing.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  (service as any).requireImportIngredientCategory = async () => ({ id: 777 });
  const existing = { id: 323, name: "新食材", status: "PENDING", categoryId: 777 };
  const [result] = await (service as any).materializeImportIngredients({
    ingredient: {
      findFirst: async () => existing,
      create: async () => {
        createCount += 1;
        return { id: 324, name: "不应创建" };
      }
    }
  }, [{
    line: "新食材 100 克",
    ingredientName: "新食材",
    ingredientId: null,
    quantity: "100",
    unitText: "克",
    unitId: 3,
    fuzzyText: null,
    note: null
  }]);

  assert.equal(result.ingredientId, existing.id);
  assert.equal(result.ingredientName, existing.name);
  assert.equal(createCount, 0);
});

test("JSON import creates an unknown ingredient as a pending system ingredient", async () => {
  const createdItems: Array<{ data: Record<string, any> }> = [];
  const createdIngredients: Array<Record<string, unknown>> = [];
  const job = {
    id: 902,
    sourceType: "JSON",
    sourceName: "pending.json",
    status: "READY",
    totalCount: 1,
    readyCount: 0,
    needsFixCount: 1,
    failedCount: 0,
    createdByAdminId: 1,
    createdAt: new Date("2026-09-09T00:00:00.000Z"),
    updatedAt: new Date("2026-09-09T00:00:00.000Z")
  };
  const category = { id: 777, code: "UNCLASSIFIED", name: "待归类", isSelectable: false };
  const unit = { id: 3, name: "克", ownerId: null };
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({ id: 1 }),
      updateMany: async () => ({ count: 1 }),
      deleteMany: async () => undefined
    },
    recipeImportJob: {
      create: async () => job,
      groupBy: async () => [],
      update: async () => undefined,
      findUnique: async () => job
    },
    ingredientCategory: {
      findFirst: async () => category
    },
    ingredient: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdIngredients.push(data);
        return { id: 321, ...data };
      }
    },
    unit: {
      findFirst: async () => unit,
      findMany: async () => [unit]
    },
    recipeImportItem: {
      groupBy: async () => [{ status: "NEEDS_FIX", _count: { _all: 1 } }],
      create: async ({ data }: { data: Record<string, any> }) => {
        createdItems.push({ data });
        return { id: 1, ...data };
      }
    },
    auditEvent: {
      create: async () => undefined
    }
  };
  const service = new AdminService(
    {
      adminAccount: {
        findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
      },
      ingredient: {
        findMany: async () => []
      },
      unit: {
        findMany: async () => [unit]
      },
      $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  await service.createRecipeImportJob([
    {
      originalname: "pending.json",
      buffer: Buffer.from(JSON.stringify({
        schemaVersion: "recipe.import.v1",
        recipe: {
          inspirationCategoryId: 1,
          coverImageUrl: null,
          content: {
            name: "待审核食材菜谱",
            story: "用于测试未知食材导入。",
            baseServings: 2,
            difficulty: "EASY",
            duration: "BETWEEN_15_30",
            tips: "按步骤完成。",
            ingredients: [{ name: "新食材", quantity: "100", unit: "克" }],
            tools: [{ name: "炒锅" }],
            steps: [{ text: "完成烹饪。", imageUrl: null }]
          }
        },
        wiki: {
          tags: [
            { tagCode: "MEAL_TYPE", tagValue: "DINNER" },
            { tagCode: "DISH_ROLE", tagValue: "MAIN" },
            { tagCode: "MAIN_PROTEIN_TYPE", tagValue: "NONE" },
            { tagCode: "FLAVOR_PROFILE", tagValue: "LIGHT" },
            { tagCode: "SPICE_LEVEL", tagValue: "NONE" }
          ],
          assistant: {
            steps: [{
              order: 1,
              phase: "PREP",
              action: "OTHER",
              title: "准备食材",
              detail: "准备食材。",
              imageUrl: null,
              durationMinutes: 5,
              durationText: "约 5 分钟"
            }]
          }
        }
      }))
    }
  ], 1, "202609090000");

  assert.equal(createdIngredients[0]?.status, "PENDING");
  assert.equal(createdItems[0]?.data.recipeBodyJson.ingredients[0]?.ingredientId, 321);
  assert.equal(createdItems[0]?.data.status, "NEEDS_FIX");
});

test("pending ingredient list includes system ingredients created by JSON import", async () => {
  const recipeCreateCalls = { count: 0 };
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "pending.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, recipeCreateCalls);
  (service as any).prisma = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
    ingredientRecommendation: {
      findMany: async () => [],
      count: async () => 0
    },
    ingredient: {
      findMany: async () => [{
        id: 321,
        name: "新食材",
        status: "PENDING",
        version: 1,
        categoryId: 777,
        category: { name: "待归类" },
        defaultUnitId: 3,
        defaultUnit: { name: "克" },
        createdAt: new Date("2026-09-09T00:00:00.000Z"),
        updatedAt: new Date("2026-09-09T00:00:00.000Z")
      }],
      count: async () => 1
    }
  };

  const result = await service.listPendingIngredients(1, 20, undefined, 1);

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.id, 321);
  assert.equal(result.items[0]?.source, "JSON_IMPORT");
  assert.equal(result.items[0]?.user, null);
});

test("approving a JSON imported pending ingredient makes it an active system ingredient", async () => {
  const ingredient = {
    id: 321,
    ownerId: null,
    name: "新食材",
    searchKey: "新食材",
    status: "PENDING",
    version: 1,
    categoryId: 777,
    defaultUnitId: 3,
    systemSortOrder: null,
    displaySortOrder: null,
    category: { id: 777, name: "待归类", isSelectable: true },
    defaultUnit: { id: 3, name: "克" },
    owner: null,
    createdAt: new Date("2026-09-09T00:00:00.000Z"),
    updatedAt: new Date("2026-09-09T00:00:00.000Z")
  };
  const ingredientUpdates: Array<Record<string, unknown>> = [];
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => undefined,
      updateMany: async () => ({ count: 1 })
    },
    ingredient: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.status === "PENDING") return ingredient;
        return null;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        ingredientUpdates.push(data);
        return { ...ingredient, ...data, status: data.status ?? ingredient.status, version: 2 };
      }
    },
    ingredientRecommendation: {
      findFirst: async () => null
    },
    ingredientCategory: {
      findUnique: async () => ingredient.category
    },
    unit: {
      findFirst: async () => ingredient.defaultUnit
    },
    recipeImportItem: {
      findMany: async () => []
    },
    auditEvent: {
      create: async () => undefined
    }
  };
  const service = new AdminService(
    {
      adminAccount: {
        findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
      },
      $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  const result = await service.reviewPendingIngredient(
    {},
    ingredient.id,
    {
      operationId: "202609090001",
      action: "APPROVE_CREATE",
      expectedVersion: ingredient.version,
      name: "新食材",
      categoryId: ingredient.categoryId,
      defaultUnitId: ingredient.defaultUnitId
    },
    1
  );

  assert.equal(result.status, "APPROVED");
  assert.equal(result.targetIngredientId, ingredient.id);
  assert.equal(ingredientUpdates[0]?.status, "ACTIVE");
});

test("reviewing an imported ingredient updates every unpublished recipe draft reference", async () => {
  const body = buildBody({
    ingredients: [{
      line: "新食材 100 克",
      ingredientName: "新食材",
      ingredientId: 321,
      quantity: "100",
      unitText: "克",
      unitId: 3,
      fuzzyText: null,
      note: null
    }]
  });
  const item = {
    id: 10,
    jobId: 20,
    status: "NEEDS_FIX",
    version: 1,
    rawBodyJson: buildRawBody(),
    recipeBodyJson: body
  };
  const updates: Array<Record<string, unknown>> = [];
  const tx = {
    recipeImportItem: {
      findMany: async () => [item],
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { count: 1 };
      }
    }
  };
  const service = createPublishService(item, { count: 0 });
  (service as any).buildRecipeImportItemState = async () => ({ errorItems: [], warnItems: [] });
  (service as any).writeRecipeImportJobStats = async () => undefined;

  await (service as any).refreshRecipeImportIngredientReferences(tx, 321, { id: 999, name: "标准食材" });

  const savedBody = updates[0]?.recipeBodyJson as typeof body;
  assert.equal(savedBody.ingredients[0]?.ingredientId, 999);
  assert.equal(savedBody.ingredients[0]?.ingredientName, "标准食材");
  assert.equal(updates[0]?.status, "READY");
});

test("merging a JSON imported ingredient marks the source merged and points drafts to the target", async () => {
  const source = {
    id: 321,
    ownerId: null,
    name: "新食材",
    searchKey: "新食材",
    status: "PENDING",
    version: 1,
    categoryId: 777,
    defaultUnitId: 3,
    systemSortOrder: null,
    displaySortOrder: null,
    category: { id: 777, name: "蔬菜", isSelectable: true },
    defaultUnit: { id: 3, name: "克" },
    owner: null,
    createdAt: new Date("2026-09-09T00:00:00.000Z"),
    updatedAt: new Date("2026-09-09T00:00:00.000Z")
  };
  const target = {
    ...source,
    id: 999,
    name: "标准食材",
    searchKey: "标准食材",
    status: "ACTIVE"
  };
  const ingredientUpdates: Array<{ id: number; data: Record<string, unknown> }> = [];
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => undefined,
      updateMany: async () => ({ count: 1 })
    },
    ingredient: {
      findFirst: async ({ where }: { where: { id?: number; status?: unknown } }) => {
        if (where.id === source.id || where.status === "PENDING") return source;
        if (where.id === target.id) return target;
        return null;
      },
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        ingredientUpdates.push({ id: where.id, data });
        return { ...(where.id === target.id ? target : source), ...data, id: where.id, version: 2 };
      }
    },
    ingredientRecommendation: {
      findFirst: async () => null
    },
    ingredientCategory: {
      findUnique: async () => source.category
    },
    unit: {
      findFirst: async () => source.defaultUnit
    },
    recipeImportItem: {
      findMany: async () => []
    },
    auditEvent: {
      create: async () => undefined
    }
  };
  const service = new AdminService(
    {
      adminAccount: {
        findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
      },
      $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  const result = await service.reviewPendingIngredient(
    {},
    source.id,
    {
      operationId: "202609090002",
      action: "APPROVE_MERGE",
      expectedVersion: source.version,
      name: target.name,
      categoryId: source.categoryId,
      defaultUnitId: source.defaultUnitId,
      targetIngredientId: target.id
    },
    1
  );

  assert.equal(result.targetIngredientId, target.id);
  assert.equal(ingredientUpdates.some(update => update.id === source.id && update.data.status === "MERGED"), true);
  assert.equal(ingredientUpdates.some(update => update.id === source.id && update.data.mergedToId === target.id), true);
});
