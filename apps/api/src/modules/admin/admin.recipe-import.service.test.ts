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
    keywords: [],
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
    publishRemoteImage?: (...args: any[]) => Promise<{ storageKey: string; imageUrl: string; sizeBytes?: number }>;
    publishTempImage?: (...args: any[]) => Promise<{ storageKey: string; imageUrl: string; sizeBytes?: number }>;
    discardTempImages?: (keys: Iterable<string>) => Promise<string[] | void>;
    removePublishedImages?: (keys: Iterable<string>) => Promise<void>;
    postCommitReadError?: boolean;
    cleanupAudits?: Array<Record<string, unknown>>;
  } = {},
  publishTrace?: {
    versionInputs: Array<Record<string, unknown>>;
    recipeInputs: Array<Record<string, unknown>>;
  }
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
      create: async ({ data }: { data: Record<string, unknown> }) => {
        publishTrace?.versionInputs.push(data);
        return { id: 903 };
      }
    },
    recipeCookAssistant: {
      findUnique: async () => null,
      upsert: async () => undefined
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
      findMany: async () => [{ id: 1, name: "排骨", categoryId: 1, proteinType: "PORK", category: { code: "MEAT_POULTRY_EGG" }, isStaple: false, isSpicyIngredient: false, aliases: [] }]
    },
    publicContentUserPoolMember: {
      findMany: async () => Array.from({ length: 100 }, (_, index) => ({ userId: index + 1 }))
    },
    user: {
      findUnique: async () => ({ nickname: "公共内容用户" })
    },
    auditEvent: {
      create: async () => undefined
    },
    recipe: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recipeCreateCalls.count += 1;
        publishTrace?.recipeInputs.push(data);
        return { id: 1 };
      }
    }
  };
  const prisma = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    auditEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        imageService.cleanupAudits?.push(data);
      }
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
      discardTempImages: imageService.discardTempImages ?? (async () => undefined),
      publishTempImage: imageService.publishTempImage ?? (async () => ({ storageKey: "unused", imageUrl: "/unused" })),
      publishRemoteImage: imageService.publishRemoteImage ?? (async () => ({ storageKey: "unused", imageUrl: "/unused" })),
      removePublishedImages: imageService.removePublishedImages ?? (async () => undefined)
    } as never,
    {} as never,
    {} as never
  );
}

test("publishing a JSON item with an unmatched ingredient is blocked before Recipe creation", async () => {
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

test("saving from a client that omits assistant prompts keeps the imported prompts", async () => {
  const now = new Date("2026-09-16T00:00:00.000Z");
  const savedBodies: RecipeImportRecipeBody[] = [];
  const currentBody = buildBody({
    assistantSteps: [{
      order: 1,
      phase: "PREP",
      action: "OTHER",
      title: "准备食材",
      detail: "准备食材。",
      imageUrl: null,
      imagePrompt: "案板上摆放洗净的食材，真实中式家常烹饪场景，不出现文字",
      durationMinutes: 5,
      durationText: "约 5 分钟"
    }]
  });
  const currentAssistantSteps = currentBody.assistantSteps ?? [];
  const requestBody = {
    ...currentBody,
    assistantSteps: currentAssistantSteps.map(({ imagePrompt: _imagePrompt, ...step }) => step)
  };
  const item = {
    id: 901,
    jobId: 902,
    sourcePath: "prompt.json",
    title: currentBody.title,
    status: "READY",
    rawBodyJson: buildRawBody(),
    parsedBodyJson: {},
    recipeBodyJson: currentBody,
    errorJson: [],
    warnJson: [],
    recipeId: null,
    version: 1,
    createdAt: now,
    updatedAt: now
  };
  const updatedItem = { ...item, version: 2 };
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => undefined,
      updateMany: async () => ({ count: 1 })
    },
    recipeImportItem: {
      findFirst: async () => item,
      updateMany: async ({ data }: { data: { recipeBodyJson: RecipeImportRecipeBody } }) => {
        savedBodies.push(data.recipeBodyJson);
        return { count: 1 };
      },
      findUnique: async () => updatedItem
    },
    auditEvent: { create: async () => undefined }
  };
  const prisma = {
    adminAccount: { findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] }) },
    recipeImportItem: { findFirst: async () => updatedItem },
    auditEvent: { create: async () => undefined },
    $transaction: async <T>(work: (transaction: typeof tx) => Promise<T>) => work(tx)
  };
  const service = new AdminService(
    prisma as never,
    {} as never,
    {} as never,
    { discardTempImages: async () => [], publishTempImage: async () => ({ storageKey: "unused", imageUrl: "/unused" }), publishRemoteImage: async () => ({ storageKey: "unused", imageUrl: "/unused" }), removePublishedImages: async () => undefined } as never,
    {} as never,
    {} as never
  );
  (service as any).prepareRecipeImportBody = async (_tx: unknown, body: RecipeImportRecipeBody) => body;
  (service as any).buildRecipeImportItemState = async () => ({ errorItems: [], warnItems: [] });
  (service as any).writeRecipeImportJobStats = async () => undefined;
  (service as any).buildRecipeImportItemDetail = async () => ({});

  await service.updateRecipeImportItem(901, 1, {
    operationId: "202609160001",
    expectedVersion: 1,
    recipeBody: requestBody
  });

  assert.equal(savedBodies[0]?.assistantSteps?.[0]?.imagePrompt, "案板上摆放洗净的食材，真实中式家常烹饪场景，不出现文字");
});

test("limits the number of remotely downloaded images in one publish", async () => {
  let publishCount = 0;
  const service = createPublishService(
    {
      id: 901,
      jobId: 902,
      sourcePath: "many-images.json",
      status: "READY",
      rawBodyJson: buildRawBody(),
      recipeBodyJson: buildBody(),
      version: 1,
      recipeId: null
    },
    { count: 0 },
    {
      publishRemoteImage: async () => {
        publishCount += 1;
        return { storageKey: `uploads/image-${publishCount}.png`, imageUrl: `/image-${publishCount}.png`, sizeBytes: 1 };
      }
    }
  );
  const recipeBody = buildBody({
    steps: Array.from({ length: 51 }, (_, index) => ({
      text: `步骤 ${index + 1}`,
      imageUrl: `https://images.example/${index + 1}.png`,
      imageKey: null,
      imageTempKey: null
    }))
  });

  await assert.rejects(
    () => (service as any).stageRecipeImportImages({}, buildRawBody(), recipeBody, [], []),
    /远程图片数量不能超过 50 张/
  );
  assert.equal(publishCount, 50);
});

test("refreshes unpublished import references for the merged source and its former merge items", async () => {
  const sourceBody = buildBody({
    ingredients: [{
      line: "紫长茄 500 克",
      ingredientName: "紫长茄",
      ingredientId: 10000025,
      quantity: "500",
      unitText: "克",
      unitId: 3001,
      fuzzyText: null,
      note: null,
      categoryCode: "PRODUCE"
    }]
  });
  const updates: Array<Record<string, unknown>> = [];
  const jobUpdates: Array<Record<string, unknown>> = [];
  const tx = {
    recipeImportItem: {
      findMany: async () => [{
        id: 901,
        jobId: 902,
        version: 4,
        rawBodyJson: buildRawBody(),
        recipeBodyJson: sourceBody
      }],
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { count: 1 };
      },
      groupBy: async () => [{ status: "READY", _count: { _all: 1 } }]
    },
    ingredient: {
      findMany: async () => [{
        id: 10000001,
        name: "茄子",
        ownerId: null,
        status: "ACTIVE",
        category: { id: 5001, code: "PRODUCE", isSelectable: true }
      }]
    },
    unit: {
      findMany: async () => [{ id: 3001, name: "克", ownerId: null }]
    },
    recipeImportJob: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        jobUpdates.push(data);
        return data;
      }
    }
  };
  const service = new AdminService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  (service as any).buildRecipeImportItemState = async () => ({ errorItems: [], warnItems: [] });

  const count = await (service as any).refreshRecipeImportIngredientReferences(
    tx,
    [10000024, 10000025],
    { id: 10000001, name: "茄子", categoryCode: "PRODUCE" }
  );

  assert.equal(count, 1);
  const savedBody = updates[0]?.recipeBodyJson as RecipeImportRecipeBody;
  assert.deepEqual(savedBody.ingredients[0], {
    ...sourceBody.ingredients[0],
    ingredientId: 10000001,
    ingredientName: "茄子",
    categoryCode: "PRODUCE"
  });
  assert.equal(updates[0]?.status, "READY");
  assert.equal(jobUpdates.length, 1);
});

test("limits the total size of remotely downloaded images in one publish", async () => {
  let publishCount = 0;
  const service = createPublishService(
    {
      id: 901,
      jobId: 902,
      sourcePath: "large-images.json",
      status: "READY",
      rawBodyJson: buildRawBody(),
      recipeBodyJson: buildBody(),
      version: 1,
      recipeId: null
    },
    { count: 0 },
    {
      publishRemoteImage: async () => {
        publishCount += 1;
        return { storageKey: `uploads/image-${publishCount}.png`, imageUrl: `/image-${publishCount}.png`, sizeBytes: 60 * 1024 * 1024 };
      }
    }
  );
  const recipeBody = buildBody({
    steps: [1, 2].map(index => ({
      text: `步骤 ${index}`,
      imageUrl: `https://images.example/${index}.png`,
      imageKey: null,
      imageTempKey: null
    }))
  });

  await assert.rejects(
    () => (service as any).stageRecipeImportImages({}, buildRawBody(), recipeBody, [], []),
    /远程图片总大小不能超过 100 MB/
  );
  assert.equal(publishCount, 2);
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
        category: { code: "MEAT_POULTRY_EGG", isSelectable: true }
      }]
    },
    unit: {
      findMany: async () => [{ id: 3, name: "克" }]
    }
  }, recipeBody, buildRawBody());

  assert.equal(state.errorItems.some((item: { field: string }) => item.field === "ingredients.0.ingredientId"), true);
});

test("a disabled system ingredient keeps its reference and reports the disabled state", async () => {
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "disabled.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  const recipeBody = buildBody({
    ingredients: [{
      line: "香醋 1 汤匙",
      ingredientName: "香醋",
      ingredientId: 331,
      quantity: "1",
      unitText: "汤匙",
      unitId: 3008,
      fuzzyText: null,
      note: null,
      categoryCode: "SEASONING"
    }]
  });
  const state = await (service as any).buildRecipeImportItemState({
    ingredient: {
      findMany: async () => [{
        id: 331,
        name: "香醋",
        status: "DISABLED",
        category: { code: "SEASONING", isSelectable: true }
      }]
    },
    unit: {
      findMany: async () => [{ id: 3008, name: "汤匙" }]
    }
  }, recipeBody, buildRawBody());

  assert.equal(
    state.errorItems.some((item: { message: string }) => item.message === "第 1 行食材已下架，请重新匹配"),
    true
  );
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
    keywords: [],
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

test("audits temporary image cleanup failures after import staging aborts", async () => {
  const cleanupAudits: Array<Record<string, unknown>> = [];
  const item = {
    id: 901,
    jobId: 902,
    sourcePath: "cleanup.json",
    status: "READY",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody({
      coverImageUrl: null,
      coverImageTempKey: "temp-cover.png",
      steps: [{ text: "步骤", imageUrl: "https://images.example/step.png", imageKey: null, imageTempKey: null }]
    }),
    version: 1,
    recipeId: null
  };
  const service = createPublishService(item, { count: 0 }, {
    publishTempImage: async () => ({ storageKey: "uploads/admin-recipe-images/temp-cover.png", imageUrl: "/temp-cover.png", sizeBytes: 10 }),
    publishRemoteImage: async () => {
      throw new Error("remote staging failed");
    },
    discardTempImages: async () => ["temp-cover.png"],
    cleanupAudits
  });
  (service as any).buildRecipeImportItemState = async () => ({ errorItems: [], warnItems: [] });
  (service as any).requireInspirationCategory = async () => ({ id: 1 });

  await assert.rejects(
    () => service.publishRecipeImportItem({}, 901, 1, { operationId: "202609080003", expectedVersion: 1 }),
    /remote staging failed/
  );
  assert.deepEqual(cleanupAudits, [{
    actorType: "ADMIN",
    actorAdminId: 1,
    action: "RECIPE_IMAGE_CLEANUP_FAILED",
    objectType: "RECIPE_IMPORT_ITEM",
    objectId: 901,
    payload: { tempKeys: ["temp-cover.png"] }
  }]);
});

test("publishing a JSON item stores body keywords in the version and recipe search text", async () => {
  const recipeCreateCalls = { count: 0 };
  const publishTrace = { versionInputs: [] as Array<Record<string, unknown>>, recipeInputs: [] as Array<Record<string, unknown>> };
  const item = {
    id: 901,
    jobId: 902,
    sourcePath: "keywords.json",
    status: "READY",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody({ keywords: ["鲜香", "快手"] }),
    version: 1,
    recipeId: null,
    createdAt: new Date("2026-09-09T00:00:00.000Z"),
    updatedAt: new Date("2026-09-09T00:00:00.000Z")
  };
  const service = createPublishService(item, recipeCreateCalls, {}, publishTrace);

  (service as any).buildRecipeImportItemState = async () => ({ errorItems: [], warnItems: [] });
  (service as any).requireInspirationCategory = async () => ({ id: 1 });
  (service as any).buildAdminRecipeContent = async () => ({
    name: "测试导入菜谱",
    story: "用于验证导入服务。",
    baseServings: 2,
    difficulty: "EASY",
    duration: "BETWEEN_15_30",
    estimatedCalories: null,
    tips: "按步骤完成。",
    keywords: ["鲜香", "快手"],
    tools: [],
    ingredients: [{ ingredientId: 1, ingredientName: "排骨", source: "SYSTEM", categoryId: 1, amount: { kind: "FUZZY", text: "适量" } }],
    steps: [{ text: "完成烹饪。", imageUrl: null }]
  });
  (service as any).assertAdminRecipeContent = () => undefined;
  (service as any).syncRecipeAssistant = async () => undefined;
  (service as any).writeRecipeImportJobStats = async () => undefined;
  (service as any).toRecipeImportItemSummary = () => ({ id: 901 });

  await service.publishRecipeImportItem({}, 901, 1, { operationId: "202609090002", expectedVersion: 1 });

  assert.deepEqual(publishTrace.versionInputs[0]?.keywordsJson, ["鲜香", "快手"]);
  assert.match(String(publishTrace.recipeInputs[0]?.searchText), /鲜香/);
  assert.match(String(publishTrace.recipeInputs[0]?.searchText), /快手/);
  assert.equal(publishTrace.recipeInputs[0]?.ownerNicknameSnapshot, "公共内容用户");
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

test("materializing an unknown import ingredient without a unit still creates a pending system ingredient", async () => {
  const createdIngredients: Array<Record<string, unknown>> = [];
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "pending-without-unit.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  (service as any).requireImportIngredientCategory = async () => ({ id: 777 });
  (service as any).nextSystemIngredientSortOrder = async () => 0;
  (service as any).nextSystemIngredientDisplaySortOrder = async () => 0;

  const [result] = await (service as any).materializeImportIngredients({
    ingredientCategory: {
      findFirst: async () => ({ id: 5001, code: "PRODUCE", isSelectable: true })
    },
    ingredient: {
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdIngredients.push(data);
        return { id: 326, ...data };
      }
    }
  }, [{
    line: "白胡椒粉 适量",
    ingredientName: "白胡椒粉",
    ingredientId: null,
    quantity: null,
    unitText: null,
    unitId: null,
    fuzzyText: null,
    note: null
  }]);

  assert.deepEqual(createdIngredients, [{
    ownerId: null,
    status: "PENDING",
    categoryId: 777,
    defaultUnitId: null,
    name: "白胡椒粉",
    searchKey: "白胡椒粉",
    systemSortOrder: 0,
    displaySortOrder: 0
  }]);
  assert.equal(result.ingredientId, 326);
});

test("materializing an unknown import ingredient preserves an unmatched unit text", async () => {
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "pending-with-unmatched-unit.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  (service as any).requireImportIngredientCategory = async () => ({ id: 777 });
  (service as any).nextSystemIngredientSortOrder = async () => 0;
  (service as any).nextSystemIngredientDisplaySortOrder = async () => 0;

  const [result] = await (service as any).materializeImportIngredients({
    ingredient: {
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 327, ...data })
    }
  }, [{
    line: "白胡椒粉 1 撮",
    ingredientName: "白胡椒粉",
    ingredientId: null,
    quantity: "1",
    unitText: "撮",
    unitId: null,
    fuzzyText: null,
    note: null
  }]);

  assert.equal(result.ingredientId, 327);
  assert.equal(result.unitText, "撮");
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
      findMany: async () => [],
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
  const existing = {
    id: 323,
    name: "新食材",
    status: "PENDING",
    categoryId: 777,
    category: { id: 777, code: "UNCLASSIFIED", isSelectable: false }
  };
  const [result] = await (service as any).materializeImportIngredients({
    ingredient: {
      findMany: async () => [existing],
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

test("materializing a matched active ingredient keeps the reference and uses the system category", async () => {
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "active-category-mismatch.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  (service as any).requireImportIngredientCategory = async () => ({ id: 777, code: "UNCLASSIFIED" });
  (service as any).nextSystemIngredientSortOrder = async () => 1;
  (service as any).nextSystemIngredientDisplaySortOrder = async () => 1;

  const [result] = await (service as any).materializeImportIngredients({
    ingredientCategory: {
      findFirst: async () => ({ id: 5001, code: "PRODUCE", isSelectable: true })
    },
    ingredient: {
      findFirst: async () => ({
        id: 328,
        name: "大蒜",
        status: "ACTIVE",
        categoryId: 5006,
        category: { id: 5006, code: "SEASONING", isSelectable: true }
      }),
      create: async () => {
        throw new Error("不应为已匹配食材创建重复记录");
      }
    }
  }, [{
    line: "大蒜 5 瓣",
    ingredientName: "大蒜",
    ingredientId: 328,
    quantity: "5",
    unitText: "瓣",
    unitId: 3006,
    fuzzyText: null,
    note: null,
    categoryCode: "PRODUCE"
  }]);

  assert.equal(result.ingredientId, 328);
  assert.equal(result.ingredientName, "大蒜");
  assert.equal(result.categoryCode, "SEASONING");
});

test("saving an import draft rewrites referenced ingredient name and category from the system ingredient", async () => {
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "save-category-mismatch.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  const queriedIds: number[][] = [];

  const result = await (service as any).prepareRecipeImportBody({
    $queryRaw: async () => [],
    ingredient: {
      findMany: async ({ where }: { where: { id: { in: number[] } } }) => {
        queriedIds.push(where.id.in);
        return [{ id: 328, name: "大蒜", category: { code: "SEASONING" } }];
      }
    }
  }, buildBody({
    ingredients: [{
      line: "蒜 5 瓣",
      ingredientName: "蒜",
      ingredientId: 328,
      quantity: "5",
      unitText: "瓣",
      unitId: 3006,
      fuzzyText: null,
      note: null,
      categoryCode: "PRODUCE"
    }]
  }), true);

  assert.deepEqual(queriedIds, [[328], [328]]);
  assert.equal(result.ingredients[0]?.ingredientName, "大蒜");
  assert.equal(result.ingredients[0]?.categoryCode, "SEASONING");
});

test("saving an import draft resolves an explicit merged ingredient id to its active target", async () => {
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "save-merged-reference.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });

  const result = await (service as any).prepareRecipeImportBody({
    $queryRaw: async () => [],
    ingredient: {
      findMany: async () => [{
        id: 10000024,
        ownerId: null,
        name: "长茄子",
        status: "MERGED",
        category: { code: "PRODUCE" },
        mergedTo: {
          id: 10000001,
          ownerId: null,
          name: "茄子",
          status: "ACTIVE",
          category: { code: "PRODUCE" }
        }
      }]
    }
  }, buildBody({
    ingredients: [{
      line: "长茄子 500 克",
      ingredientName: "长茄子",
      ingredientId: 10000024,
      quantity: "500",
      unitText: "克",
      unitId: 3001,
      fuzzyText: null,
      note: null,
      categoryCode: "GRAINS_STAPLES"
    }]
  }), true);

  assert.equal(result.ingredients[0]?.ingredientId, 10000001);
  assert.equal(result.ingredients[0]?.ingredientName, "茄子");
  assert.equal(result.ingredients[0]?.categoryCode, "PRODUCE");
});

test("saving an import draft re-reads a referenced ingredient after locking it", async () => {
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "save-concurrent-merge.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  let lockCompleted = false;
  const lockedIngredientIds: number[] = [];
  const source = {
    id: 10000024,
    ownerId: null,
    name: "长茄子",
    status: "ACTIVE",
    category: { code: "PRODUCE" },
    mergedTo: null
  };
  const merged = {
    ...source,
    status: "MERGED",
    mergedTo: {
      id: 10000001,
      ownerId: null,
      name: "茄子",
      status: "ACTIVE",
      category: { code: "PRODUCE" }
    }
  };

  const result = await (service as any).prepareRecipeImportBody({
    $queryRaw: async (...args: unknown[]) => {
      if (typeof args[1] === "number") lockedIngredientIds.push(args[1]);
      lockCompleted = true;
      return [];
    },
    ingredient: {
      findMany: async () => lockCompleted ? [merged] : [source]
    }
  }, buildBody({
    ingredients: [{
      line: "长茄子 500 克",
      ingredientName: "长茄子",
      ingredientId: source.id,
      quantity: "500",
      unitText: "克",
      unitId: 3001,
      fuzzyText: null,
      note: null,
      categoryCode: "PRODUCE"
    }]
  }), true);

  assert.equal(result.ingredients[0]?.ingredientId, 10000001);
  assert.equal(result.ingredients[0]?.ingredientName, "茄子");
  assert.deepEqual(lockedIngredientIds, [source.id, 10000001]);
});

test("saving an import draft rejects an explicit merged ingredient id with an invalid target", async () => {
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "save-invalid-merged-reference.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });

  await assert.rejects(
    (service as any).prepareRecipeImportBody({
      $queryRaw: async () => [],
      ingredient: {
        findMany: async () => [{
          id: 10000024,
          ownerId: null,
          name: "长茄子",
          status: "MERGED",
          category: { code: "PRODUCE" },
          mergedTo: {
            id: 10000001,
            ownerId: null,
            name: "茄子",
            status: "DISABLED",
            category: { code: "PRODUCE" }
          }
        }]
      }
    }, buildBody({
      ingredients: [{
        line: "长茄子 500 克",
        ingredientName: "长茄子",
        ingredientId: 10000024,
        quantity: "500",
        unitText: "克",
        unitId: 3001,
        fuzzyText: null,
        note: null,
        categoryCode: "PRODUCE"
      }]
    }), true),
    /归并食材目标无效/
  );
});

test("materializing a same-name ingredient prefers ACTIVE over PENDING and DISABLED", async () => {
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "ingredient-priority.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  (service as any).requireImportIngredientCategory = async () => ({ id: 777, code: "UNCLASSIFIED" });
  (service as any).nextSystemIngredientSortOrder = async () => 1;
  (service as any).nextSystemIngredientDisplaySortOrder = async () => 1;

  const [result] = await (service as any).materializeImportIngredients({
    ingredientCategory: {
      findFirst: async () => null
    },
    ingredient: {
      findMany: async () => [
        { id: 340, name: "淀粉", status: "DISABLED", category: { code: "GRAINS_STAPLES" } },
        { id: 341, name: "淀粉", status: "PENDING", category: { code: "UNCLASSIFIED" } },
        { id: 342, name: "淀粉", status: "ACTIVE", category: { code: "SEASONING" } }
      ],
      create: async () => {
        throw new Error("不应为已匹配食材创建重复记录");
      }
    }
  }, [{
    line: "淀粉 10 克",
    ingredientName: "淀粉",
    ingredientId: null,
    quantity: "10",
    unitText: "克",
    unitId: 3001,
    fuzzyText: null,
    note: null,
    categoryCode: "GRAINS_STAPLES"
  }]);

  assert.equal(result.ingredientId, 342);
  assert.equal(result.categoryCode, "SEASONING");
});

test("materializing a merged ingredient name stores the active target identity", async () => {
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "merged-ingredient.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  (service as any).requireImportIngredientCategory = async () => ({ id: 777, code: "UNCLASSIFIED" });
  (service as any).nextSystemIngredientSortOrder = async () => 1;
  (service as any).nextSystemIngredientDisplaySortOrder = async () => 1;

  const [result] = await (service as any).materializeImportIngredients({
    ingredientCategory: {
      findFirst: async () => ({ id: 5001, code: "PRODUCE", isSelectable: true })
    },
    ingredient: {
      findMany: async () => [{
        id: 10000024,
        ownerId: null,
        name: "长茄子",
        status: "MERGED",
        category: { code: "PRODUCE" },
        mergedTo: {
          id: 10000001,
          ownerId: null,
          name: "茄子",
          status: "ACTIVE",
          category: { code: "PRODUCE" }
        }
      }],
      create: async () => ({ id: 19999999, name: "长茄子" })
    }
  }, [{
    line: "长茄子 500 克",
    ingredientName: "长茄子",
    ingredientId: null,
    quantity: "500",
    unitText: "克",
    unitId: null,
    fuzzyText: null,
    note: null,
    categoryCode: "GRAINS_STAPLES"
  }]);

  assert.equal(result.ingredientId, 10000001);
  assert.equal(result.ingredientName, "茄子");
  assert.equal(result.categoryCode, "PRODUCE");
});

test("materializing an explicit merged ingredient id stores the active target identity", async () => {
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "merged-ingredient-id.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  (service as any).requireImportIngredientCategory = async () => ({ id: 777, code: "UNCLASSIFIED" });
  (service as any).nextSystemIngredientSortOrder = async () => 1;
  (service as any).nextSystemIngredientDisplaySortOrder = async () => 1;

  const [result] = await (service as any).materializeImportIngredients({
    ingredientCategory: {
      findFirst: async () => null
    },
    ingredient: {
      findFirst: async ({ where }: { where: { status: { in: string[] } } }) =>
        where.status.in.includes("MERGED")
          ? {
              id: 10000024,
              ownerId: null,
              name: "长茄子",
              status: "MERGED",
              category: { code: "PRODUCE" },
              mergedTo: {
                id: 10000001,
                ownerId: null,
                name: "茄子",
                status: "ACTIVE",
                category: { code: "PRODUCE" }
              }
            }
          : null,
      findMany: async () => [],
      create: async () => ({ id: 19999999, name: "长茄子" })
    }
  }, [{
    line: "长茄子 500 克",
    ingredientName: "长茄子",
    ingredientId: 10000024,
    quantity: "500",
    unitText: "克",
    unitId: null,
    fuzzyText: null,
    note: null,
    categoryCode: "GRAINS_STAPLES"
  }]);

  assert.equal(result.ingredientId, 10000001);
  assert.equal(result.ingredientName, "茄子");
  assert.equal(result.categoryCode, "PRODUCE");
});

test("materializing an import ingredient keeps a disabled system reference without reviving it", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const service = createPublishService({
    id: 901,
    jobId: 902,
    sourcePath: "disabled-existing.json",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    recipeBodyJson: buildBody(),
    version: 1,
    recipeId: null
  }, { count: 0 });
  (service as any).requireImportIngredientCategory = async () => ({ id: 777 });

  const [result] = await (service as any).materializeImportIngredients({
    ingredient: {
      findMany: async () => [{
        id: 325,
        name: "已下架食材",
        status: "DISABLED",
        categoryId: 1,
        category: { id: 1, code: "SEASONING", isSelectable: true }
      }],
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { id: 325, name: "已下架食材", status: "ACTIVE", categoryId: 1 };
      },
      create: async () => {
        throw new Error("不应为已下架食材创建重复记录");
      }
    }
  }, [{
    line: "已下架食材 100 克",
    ingredientName: "已下架食材",
    ingredientId: null,
    quantity: "100",
    unitText: "克",
    unitId: 3,
    fuzzyText: null,
    note: null
  }]);

  assert.equal(result.ingredientId, 325);
  assert.equal(result.categoryCode, "SEASONING");
  assert.equal(updates.length, 0);
});

test("recipe import detail returns only ingredient summaries referenced by its body", async () => {
  const now = new Date("2026-09-15T00:00:00.000Z");
  const queriedIds: number[][] = [];
  const recipeBody = buildBody({
    ingredients: [
      {
        line: "白胡椒粉 1 克",
        ingredientName: "白胡椒粉",
        ingredientId: 330,
        quantity: "1",
        unitText: "克",
        unitId: 3001,
        fuzzyText: null,
        note: null,
        categoryCode: "UNCLASSIFIED"
      },
      {
        line: "香醋 1 汤匙",
        ingredientName: "香醋",
        ingredientId: 331,
        quantity: "1",
        unitText: "汤匙",
        unitId: 3008,
        fuzzyText: null,
        note: null,
        categoryCode: "SEASONING"
      }
    ]
  });
  const item = {
    id: 901,
    jobId: 902,
    sourcePath: "ingredient-refs.json",
    title: "测试导入菜谱",
    status: "NEEDS_FIX",
    rawBodyJson: buildRawBody(),
    parsedBodyJson: {
      titleLine: null,
      story: null,
      baseServingsText: null,
      difficultyText: null,
      durationText: null,
      caloriesText: null,
      ingredientLines: [],
      stepLines: [],
      tipLines: []
    },
    recipeBodyJson: recipeBody,
    errorJson: [],
    warnJson: [],
    recipeId: null,
    version: 1,
    createdAt: now,
    updatedAt: now
  };
  const prisma = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    recipeImportItem: {
      findFirst: async () => item
    },
    ingredient: {
      findMany: async ({ where }: { where: { id: { in: number[] } } }) => {
        queriedIds.push(where.id.in);
        return [
          {
            id: 330,
            name: "白胡椒粉",
            version: 1,
            status: "PENDING",
            categoryId: 5009,
            category: { id: 5009, name: "待归类" },
            defaultUnit: null,
            proteinType: null,
            isStaple: false,
            isSpicyIngredient: false,
            aliases: [],
            updatedAt: now
          },
          {
            id: 331,
            name: "香醋",
            version: 2,
            status: "DISABLED",
            categoryId: 5006,
            category: { id: 5006, name: "调味料" },
            defaultUnit: { id: 3008, name: "汤匙", type: "COMMON", ownerId: null },
            proteinType: null,
            isStaple: false,
            isSpicyIngredient: false,
            aliases: [],
            updatedAt: now
          }
        ];
      }
    }
  };
  const service = new AdminService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  const result = await service.getRecipeImportItemDetail(901, 1);

  assert.deepEqual(queriedIds, [[330, 331]]);
  assert.deepEqual(result.ingredientRefs.map(item => [item.id, item.status]), [
    [330, "PENDING"],
    [331, "DISABLED"]
  ]);
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
  assert.equal(
    createdItems[0]?.data.errorJson.some((item: { field?: string }) => item.field === "recipe.content.ingredients.0.fuzzyText"),
    true
  );
  assert.equal(
    createdItems[0]?.data.errorJson.some((item: { field?: string }) => item.field === "recipe.content.steps.0.imagePrompt"),
    true
  );
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
        defaultUnitId: null,
        defaultUnit: null,
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
  assert.equal(result.items[0]?.defaultUnitId, null);
  assert.equal(result.items[0]?.defaultUnitName, null);
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

test("reviewing an imported ingredient updates every unpublished recipe draft reference and category", async () => {
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

  await (service as any).refreshRecipeImportIngredientReferences(tx, 321, {
    id: 999,
    name: "标准食材",
    categoryCode: "SEASONING"
  });

  const savedBody = updates[0]?.recipeBodyJson as typeof body;
  assert.equal(savedBody.ingredients[0]?.ingredientId, 999);
  assert.equal(savedBody.ingredients[0]?.ingredientName, "标准食材");
  assert.equal(savedBody.ingredients[0]?.categoryCode, "SEASONING");
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
  const lockedIngredientIds: number[] = [];
  const tx = {
    $queryRaw: async (...args: unknown[]) => {
      if (typeof args[1] === "number") lockedIngredientIds.push(args[1]);
      return [];
    },
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
  assert.deepEqual(lockedIngredientIds, [source.id, target.id]);
  assert.equal(ingredientUpdates.some(update => update.id === source.id && update.data.status === "MERGED"), true);
  assert.equal(ingredientUpdates.some(update => update.id === source.id && update.data.mergedToId === target.id), true);
});

test("approving an imported ingredient locks an automatically matched merge target", async () => {
  const source = {
    id: 321,
    ownerId: null,
    name: "长茄子",
    searchKey: "长茄子",
    status: "PENDING",
    version: 1,
    categoryId: 777,
    defaultUnitId: 3,
    category: { id: 777, name: "待归类", code: "UNCLASSIFIED", isSelectable: false },
    defaultUnit: { id: 3, name: "克" }
  };
  const target = {
    ...source,
    id: 100,
    ownerId: null,
    name: "茄子",
    searchKey: "长茄子",
    status: "ACTIVE",
    categoryId: 5001,
    category: { id: 5001, name: "蔬果菌菇", code: "PRODUCE", isSelectable: true }
  };
  const lockedIngredientIds: number[] = [];
  const ingredientUpdates: Array<{ id: number; data: Record<string, unknown> }> = [];
  const tx = {
    $queryRaw: async (...args: unknown[]) => {
      if (typeof args[1] === "number") lockedIngredientIds.push(args[1]);
      return [];
    },
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => undefined,
      updateMany: async () => ({ count: 1 })
    },
    ingredient: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id === source.id && where.status === "PENDING") return source;
        if (where.id === target.id) return target;
        if (where.searchKey === source.searchKey) return target;
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
    auditEvent: {
      create: async () => undefined
    },
    recipeImportItem: {
      findMany: async () => []
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
  (service as any).requireSelectableIngredientCategory = async () => target.category;
  (service as any).requireSystemUnit = async () => target.defaultUnit;
  (service as any).nextSystemIngredientSortOrder = async () => 1;
  (service as any).nextSystemIngredientDisplaySortOrder = async () => 1;
  (service as any).refreshRecipeImportIngredientReferences = async () => 0;

  const result = await service.reviewPendingIngredient(
    {},
    source.id,
    {
      operationId: "202609090003",
      action: "APPROVE_CREATE",
      expectedVersion: source.version,
      name: "长茄子",
      categoryId: target.categoryId,
      defaultUnitId: target.defaultUnitId
    },
    1
  );

  assert.equal(result.targetIngredientId, target.id);
  assert.deepEqual(lockedIngredientIds, [target.id, source.id]);
  assert.equal(ingredientUpdates.some(update => update.id === source.id && update.data.mergedToId === target.id), true);
});
