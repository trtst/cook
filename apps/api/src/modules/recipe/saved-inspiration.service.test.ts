import assert from "node:assert/strict";
import test from "node:test";
import { RecipeService } from "./recipe.service";

function createSaveHarness() {
  const saves: Array<{ id: number; userId: number; sourceRecipeId: number; sourceVersionId: number }> = [];
  let fullCollectorReads = 0;
  const idempotency = new Map<string, { requestHash: string; resultJson?: unknown; status: string }>();
  const source = {
    id: 1001,
    isInspiration: true,
    status: "ACTIVE",
    inspirationCategoryId: 2001,
    currentVersionId: 3001,
    collectCount: 0,
    coverImageUrl: "https://example.test/initial-cover.jpg",
    currentVersion: { contentSizeBytes: 0 }
  };
  const prisma: any = {
    $queryRaw: async () => [],
    recipe: {
      findFirst: async ({ where }: any) => {
        if (where.status && where.status !== source.status) return null;
        if (where.isInspiration && !source.isInspiration) return null;
        if (where.inspirationCategoryId?.not === null && source.inspirationCategoryId === null) return null;
        return {
          ...source,
          owner: { uid: 12345678, nickname: "账号昵称" },
          ownerNicknameSnapshot: "原整理者",
          category: null,
          inspirationCategory: { id: source.inspirationCategoryId, name: "家常菜" },
          sceneLinks: []
        };
      },
      update: async ({ data }: any) => {
        if (typeof data.collectCount === "number") source.collectCount = data.collectCount;
        if (typeof data.collectCount?.increment === "number") source.collectCount += data.collectCount.increment;
        if (typeof data.collectCount?.decrement === "number") source.collectCount -= data.collectCount.decrement;
        return { ...source };
      },
      findUnique: async () => ({ collectCount: source.collectCount }),
      count: async () => 0
    },
    recipeDraft: { count: async () => 0 },
    recipeContentVersion: {
      findUnique: async ({ where }: any) => ({
        id: where.id,
        name: `版本${where.id}`,
        ingredientsJson: [],
        stepsJson: [],
        toolsJson: [],
        keywordsJson: [],
        imagesJson: { coverImageUrl: `https://example.test/${where.id}.jpg` }
      })
    },
    recipeCollection: {
      findFirst: async ({ where }: any) => {
        const save = saves.find(save =>
        (where.userId === undefined || save.userId === where.userId) && (where.id === undefined || save.id === where.id) &&
        (where.sourceRecipeId === undefined || save.sourceRecipeId === where.sourceRecipeId) &&
        (where.sourceVersionId === undefined || save.sourceVersionId === where.sourceVersionId)
        );
        if (!save) return null;
        return {
          ...save,
          sourceVersion: { id: save.sourceVersionId, name: "固定版本", imagesJson: { coverImageUrl: `https://example.test/${save.sourceVersionId}.jpg` } },
          sourceRecipe: {
            ...source,
            ownerNicknameSnapshot: "原整理者",
            owner: { uid: 12345678, nickname: "账号昵称" },
            inspirationCategory: { id: source.inspirationCategoryId, name: "家常菜" },
          currentVersion: { ...source.currentVersion, ingredientsJson: [], stepsJson: [], toolsJson: [], keywordsJson: [] },
            sceneLinks: []
          }
        };
      },
      findMany: async ({ where }: any) => {
        if (where.sourceRecipeId !== undefined) fullCollectorReads += 1;
        return saves.filter(save =>
          (where.sourceRecipeId === undefined || save.sourceRecipeId === where.sourceRecipeId) &&
          (where.userId === undefined || save.userId === where.userId)
        ).map(save => ({
          ...save,
          sourceVersion: {
            id: save.sourceVersionId,
            name: "固定版本",
            ingredientsJson: [],
            stepsJson: [],
            toolsJson: [],
            keywordsJson: [],
            imagesJson: { coverImageUrl: `https://example.test/${save.sourceVersionId}.jpg` }
          },
          sourceRecipe: {
            ...source,
            coverImageUrl: source.coverImageUrl ?? null,
            owner: { uid: 12345678, nickname: "账号昵称" },
            ownerNicknameSnapshot: "原整理者",
            inspirationCategory: { id: source.inspirationCategoryId, name: "家常菜" }
          }
        }));
      },
      count: async ({ where }: any) => saves.filter(save => save.userId === where.userId).length,
      create: async ({ data }: any) => {
        const save = { id: 4000 + saves.length, ...data, createdAt: new Date("2026-10-10T00:00:00.000Z") };
        saves.push(save);
        return save;
      },
      delete: async ({ where }: any) => {
        const index = saves.findIndex(save => save.id === where.id);
        return saves.splice(index, 1)[0];
      }
    },
    idempotencyRecord: {
      findFirst: async ({ where }: any) => idempotency.get(`${where.userId}:${where.operationType}:${where.operationId}`) ?? null,
      create: async ({ data }: any) => {
        idempotency.set(`${data.userId}:${data.operationType}:${data.operationId}`, { requestHash: data.requestHash, status: data.status });
        return {};
      },
      updateMany: async ({ where, data }: any) => {
        const record = idempotency.get(`${where.userId}:${where.operationType}:${where.operationId}`);
        if (record) Object.assign(record, data);
        return { count: record ? 1 : 0 };
      }
    }
  };
  prisma.$transaction = async (operation: ((tx: typeof prisma) => Promise<unknown>) | Promise<unknown>[]) =>
    Array.isArray(operation) ? Promise.all(operation) : operation(prisma);

  return {
    prisma,
    saves,
    source,
    service: new RecipeService(
      prisma as never,
      {} as never,
      { resolveForUser: async () => ({ recipeLimit: 100 }) } as never,
      {} as never,
      {} as never,
      {} as never
    ),
    get fullCollectorReads() { return fullCollectorReads; }
  };
}

test("saving multiple fixed versions counts one collector per user and recipe", async () => {
  const harness = createSaveHarness();
  const { service, source, saves } = harness;

  const first = await service.saveInspirationToPrivate(11, "op-1", 1001, 3001);
  source.currentVersionId = 3002;
  const secondVersion = await service.saveInspirationToPrivate(11, "op-2", 1001, 3002);
  const secondUser = await service.saveInspirationToPrivate(12, "op-3", 1001, 3002);

  assert.equal(saves.length, 3);
  assert.equal(first.collectCount, 1);
  assert.equal(secondVersion.collectCount, 1);
  assert.equal(secondUser.collectCount, 2);
  assert.equal(harness.fullCollectorReads, 0, "counter updates must not load every collector into application memory");
});

test("removing one of several saved versions preserves the collector count", async () => {
  const harness = createSaveHarness();
  const { service, source } = harness;
  await service.saveInspirationToPrivate(11, "op-1", 1001, 3001);
  source.currentVersionId = 3002;
  await service.saveInspirationToPrivate(11, "op-2", 1001, 3002);

  const result = await service.removeSavedInspiration(11, 4000, "op-3");

  assert.equal(result.collectCount, 1);
  assert.equal(result.isSavedToPrivate, false);
  assert.equal(harness.fullCollectorReads, 0);
});

test("repeating a save operation returns the first result without duplicating the save", async () => {
  const { service, saves } = createSaveHarness();

  const first = await service.saveInspirationToPrivate(11, "op-repeat", 1001, 3001);
  const repeated = await service.saveInspirationToPrivate(11, "op-repeat", 1001, 3001);

  assert.deepEqual(repeated, first);
  assert.equal(saves.length, 1);
  assert.equal(first.collectCount, 1);
});

test("removing the last saved version removes that user from the distinct collector count", async () => {
  const harness = createSaveHarness();
  const { service, source } = harness;
  await service.saveInspirationToPrivate(11, "op-1", 1001, 3001);
  source.currentVersionId = 3002;
  await service.saveInspirationToPrivate(12, "op-2", 1001, 3002);
  source.status = "BLOCKED";

  const result = await service.removeSavedInspiration(11, 4000, "op-3");

  assert.equal(result.collectCount, 1);
  assert.equal(result.isSavedToPrivate, false);
  assert.equal(harness.fullCollectorReads, 0);
});

test("keeps an existing saved version readable and removable after its source recipe is taken down", async () => {
  const { service, source } = createSaveHarness();
  await service.saveInspirationToPrivate(11, "op-save-before-block", 1001, 3001);
  source.currentVersionId = 3002;
  source.status = "BLOCKED";
  (service as any).toInspirationRecipeDetail = async (_tx: unknown, recipe: any) => ({
    id: recipe.id,
    contentVersionId: recipe.currentVersionId
  });

  const detail = await service.getSavedInspiration(11, 4000);
  const removal = await service.removeSavedInspiration(11, 4000, "op-remove-after-block");

  assert.equal(detail.contentVersionId, 3001);
  assert.equal(detail.isAvailable, false);
  assert.equal(removal.isSavedToPrivate, false);
});

test("saved inspiration summary uses the saved version cover snapshot", async () => {
  const { service, source } = createSaveHarness();
  await service.saveInspirationToPrivate(11, "op-save-cover", 1001, 3001);
  source.coverImageUrl = "https://example.test/current-cover.jpg";

  const result = await service.listSavedInspirations(11, 1, 20);

  assert.equal(result.items[0].coverImageUrl, "https://example.test/3001.jpg");
});

test("inspiration detail does not report another saved version as the current version save", async () => {
  const { service, source } = createSaveHarness();
  await service.saveInspirationToPrivate(11, "op-save-old-version", 1001, 3001);
  source.currentVersionId = 3002;
  (service as any).toInspirationRecipeDetail = async (_tx: unknown, recipe: any, _userId: number, saveId: number | null) => ({
    id: recipe.id,
    contentVersionId: recipe.currentVersionId,
    saveId,
    isSavedToPrivate: saveId !== null
  });

  const result = await service.getInspirationRecipe(1001);

  assert.equal(result.contentVersionId, 3002);
  assert.equal(result.saveId, null);
  assert.equal(result.isSavedToPrivate, false);
});

test("public inspiration detail can load the exact publicly referenced saved version", async () => {
  const { service, source } = createSaveHarness();
  await service.saveInspirationToPrivate(11, "op-save-shared-version", 1001, 3001);
  source.currentVersionId = 3002;
  (service as any).toInspirationRecipeDetail = async (_tx: unknown, recipe: any) => ({
    id: recipe.id,
    contentVersionId: recipe.currentVersionId,
    coverImageUrl: (recipe.currentVersion.imagesJson as any).coverImageUrl
  });

  const result = await service.getInspirationRecipe(1001, undefined, 3001);

  assert.equal(result.contentVersionId, 3001);
  assert.equal(result.coverImageUrl, "https://example.test/3001.jpg");
});

test("rejects saving an inspiration version after the source recipe has moved to a newer version", async () => {
  const { service, source, saves } = createSaveHarness();
  source.currentVersionId = 3002;

  await assert.rejects(
    service.saveInspirationToPrivate(11, "op-stale-version", 1001, 3001),
    /灵感版本已更新/
  );
  assert.equal(saves.length, 0);
});

test("rejects saving an inspiration recipe after it has been taken down", async () => {
  const { service, source, saves } = createSaveHarness();
  source.status = "BLOCKED";

  await assert.rejects(
    service.saveInspirationToPrivate(11, "op-blocked-recipe", 1001, 3001),
    /灵感菜谱不存在/
  );
  assert.equal(saves.length, 0);
});
