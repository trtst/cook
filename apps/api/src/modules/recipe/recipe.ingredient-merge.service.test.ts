import assert from "node:assert/strict";
import test from "node:test";
import type { RecipeDraftContentInput } from "../../contracts/types";
import { RecipeService } from "./recipe.service";

function draftContent(ingredientId: number, coverUploadId: number | null = null): RecipeDraftContentInput {
  return {
    name: "家常茄子",
    story: null,
    categoryId: null,
    sceneIds: [],
    coverUploadId,
    baseServings: 2,
    difficulty: "EASY",
    duration: "BETWEEN_15_30",
    tips: null,
    ingredients: [{
      ingredientId,
      name: "长茄子",
      quantity: "500",
      unitId: 3001,
      fuzzyText: null,
      categoryId: 5001,
      defaultUnitId: 3001,
      source: "PERSONAL"
    }],
    steps: []
  };
}

test("personal ingredient auto-merge rejects a target that is no longer active after locking", async () => {
  const source = {
    id: 10000030,
    ownerId: 7,
    name: "长茄子",
    searchKey: "长茄子",
    status: "ACTIVE",
    categoryId: 5001,
    defaultUnit: { id: 3001, name: "克" }
  };
  const target = {
    id: 10000001,
    ownerId: null,
    name: "茄子",
    searchKey: "长茄子",
    status: "ACTIVE",
    categoryId: 5001,
    defaultUnit: { id: 3001, name: "克" }
  };
  const lockedIngredientIds: number[] = [];
  const tx = {
    $queryRaw: async (...args: unknown[]) => {
      if (typeof args[1] === "number") lockedIngredientIds.push(args[1]);
      return [];
    },
    ingredient: {
      findFirst: async () => null,
      update: async () => source
    },
    ingredientCategory: {
      findUnique: async () => ({ id: 5001, name: "蔬果菌菇", isSelectable: true })
    },
    ingredientRecommendation: {
      create: async () => ({ id: 1 })
    }
  };
  const service = new RecipeService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );
  (service as any).syncDraftIngredientReferences = async () => undefined;
  (service as any).syncRecipeIngredientReferences = async () => undefined;

  await assert.rejects(
    (service as any).mergeIngredientIntoSystem(tx, 7, source, target, "系统库已有同名食材，已自动归并"),
    /主食材已更新，请重试/
  );
  assert.deepEqual(lockedIngredientIds, [target.id]);
});

test("personal ingredient auto-merge leaves fixed recipe content versions unchanged", async () => {
  const source = {
    id: 10000030,
    ownerId: 7,
    name: "长茄子",
    searchKey: "长茄子",
    status: "ACTIVE",
    categoryId: 5001,
    defaultUnit: { id: 3001, name: "克" }
  };
  const target = {
    id: 10000001,
    ownerId: null,
    name: "茄子",
    searchKey: "长茄子",
    status: "ACTIVE",
    categoryId: 5001,
    defaultUnit: { id: 3001, name: "克" }
  };
  let readFixedVersions = false;
  let updatedFixedVersion = false;
  const tx = {
    $queryRaw: async () => [],
    ingredient: {
      findFirst: async () => target,
      findMany: async () => [],
      update: async () => source
    },
    ingredientCategory: {
      findUnique: async () => ({ id: 5001, name: "蔬果菌菇", isSelectable: true })
    },
    ingredientRecommendation: {
      create: async () => ({ id: 1 })
    },
    recipeDraft: {
      findMany: async () => []
    },
    recipeContentVersion: {
      findMany: async () => {
        readFixedVersions = true;
        return [];
      },
      update: async () => {
        updatedFixedVersion = true;
        return {};
      }
    }
  };
  const service = new RecipeService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  await (service as any).mergeIngredientIntoSystem(
    tx,
    7,
    source,
    target,
    "系统库已有同名食材，已自动归并"
  );

  assert.equal(readFixedVersions, false);
  assert.equal(updatedFixedVersion, false);
});

test("personal ingredient auto-merge locks drafts before reading and preserves image storage accounting", async () => {
  const events: string[] = [];
  const updateBytes: number[] = [];
  const ledgerBytes: number[] = [];
  const tx = {
    $queryRaw: async () => {
      events.push("lock");
      return [];
    },
    recipeDraft: {
      findMany: async () => {
        events.push("read");
        return [{
          id: 41,
          recipeId: null,
          contentJson: draftContent(10000030, 71),
          contentSizeBytes: 6024
        }];
      },
      update: async ({ data }: { data: { contentSizeBytes: number } }) => {
        updateBytes.push(data.contentSizeBytes);
        return {};
      }
    },
    ingredient: {
      findMany: async () => [{ id: 10000001, aliases: [], mergedTo: null }]
    },
    uploadAsset: {
      aggregate: async () => ({ _sum: { sizeBytes: 5000 } })
    },
    storageLedger: {
      upsert: async ({ update }: { update: { usedBytes: number } }) => {
        ledgerBytes.push(update.usedBytes);
        return {};
      }
    }
  };
  const service = new RecipeService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  await (service as any).syncDraftIngredientReferences(tx, 7, 10000030, 10000001);

  assert.deepEqual(events, ["lock", "read"]);
  assert.equal(updateBytes[0], 6024);
  assert.deepEqual(ledgerBytes, [6024]);
});

test("personal ingredient auto-merge keeps an edit draft on its published-recipe delta basis", async () => {
  const updateBytes: number[] = [];
  const ledgerBytes: number[] = [];
  const tx = {
    $queryRaw: async () => [],
    recipeDraft: {
      findMany: async () => [{
        id: 42,
        recipeId: 88,
        contentJson: draftContent(10000030),
        contentSizeBytes: 0
      }],
      update: async ({ data }: { data: { contentSizeBytes: number } }) => {
        updateBytes.push(data.contentSizeBytes);
        return {};
      }
    },
    recipe: {
      findFirst: async () => ({
        id: 88,
        ownerId: 7,
        status: "ACTIVE",
        coverImageUrl: null,
        currentVersion: {
          name: "家常茄子",
          story: null,
          baseServings: 2,
          difficulty: "EASY",
          duration: "BETWEEN_15_30",
          estimatedCalories: null,
          tips: null,
          keywordsJson: [],
          toolsJson: [],
          ingredientsJson: [],
          stepsJson: [],
          contentSizeBytes: 5000
        }
      })
    },
    ingredient: {
      findMany: async () => [{ id: 10000001, aliases: [], mergedTo: null }]
    },
    storageLedger: {
      upsert: async ({ update }: { update: { usedBytes: number } }) => {
        ledgerBytes.push(update.usedBytes);
        return {};
      }
    }
  };
  const service = new RecipeService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  await (service as any).syncDraftIngredientReferences(tx, 7, 10000030, 10000001);

  assert.deepEqual(updateBytes, [0]);
  assert.deepEqual(ledgerBytes, [0]);
});
