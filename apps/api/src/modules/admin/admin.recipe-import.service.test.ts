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
