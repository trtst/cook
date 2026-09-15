import assert from "node:assert/strict";
import test from "node:test";
import {
  backfillImportPendingIngredientBatches,
  backfillImportPendingIngredients,
  parseImportPendingIngredientArgs,
  type ImportPendingIngredientRepository,
  type ImportPendingIngredientRow,
  type ImportPendingIngredientUnit,
  type ImportPendingItemRecord
} from "./backfill-import-pending-ingredients";

function ingredientRow(
  id: number,
  name: string,
  status: ImportPendingIngredientRow["status"],
  defaultUnitId: number | null = 3001
): ImportPendingIngredientRow {
  return {
    id,
    name,
    status,
    defaultUnitId,
    categoryCode: status === "PENDING" ? "UNCLASSIFIED" : "SEASONING",
    categorySelectable: status === "ACTIVE"
  };
}

function recipeBody(name = "白胡椒粉", unitId: number | null = null) {
  return {
    inspirationCategoryId: 6001,
    title: "测试菜谱",
    story: "一道用于回填测试的菜。",
    baseServings: 2,
    difficulty: "EASY" as const,
    duration: "WITHIN_15" as const,
    tips: "趁热食用。",
    keywords: ["测试"],
    coverImageKey: null,
    coverImageTempKey: null,
    tools: [{ name: "炒锅" }],
    tags: [],
    assistantSteps: [],
    ingredients: [
      {
        line: unitId ? `${name} 2克` : name,
        ingredientName: name,
        ingredientId: null,
        quantity: unitId ? "2" : null,
        unitText: unitId ? "克" : null,
        unitId,
        fuzzyText: null,
        note: null,
        categoryCode: null
      }
    ],
    steps: [{ text: "拌匀。", imageUrl: null, imageKey: null, imageTempKey: null }]
  };
}

function item(id = 38, name = "白胡椒粉", unitId: number | null = null): ImportPendingItemRecord {
  return { id, jobId: 7, version: 1, recipeBodyJson: recipeBody(name, unitId) };
}

class FakeRepository implements ImportPendingIngredientRepository {
  readonly ingredients = new Map<number, ImportPendingIngredientRow>();
  readonly units = new Map<number, ImportPendingIngredientUnit>([[3001, { id: 3001, name: "克" }]]);
  createCalls = 0;
  updateCalls = 0;
  updates: Array<{ id: number; errorJson: unknown }> = [];
  refreshedJobs: number[] = [];
  failNextRefresh = false;
  forceVersionConflict = false;
  nextId = 10000010;

  constructor(readonly records: ImportPendingItemRecord[]) {}

  async withTransaction<T>(work: (repository: ImportPendingIngredientRepository) => Promise<T>): Promise<T> {
    const ingredientSnapshot = new Map(this.ingredients);
    const recordSnapshot = structuredClone(this.records);
    const createCalls = this.createCalls;
    const updateCalls = this.updateCalls;
    try {
      return await work(this);
    } catch (error) {
      this.ingredients.clear();
      for (const [id, row] of ingredientSnapshot) this.ingredients.set(id, row);
      this.records.splice(0, this.records.length, ...recordSnapshot);
      this.createCalls = createCalls;
      this.updateCalls = updateCalls;
      throw error;
    }
  }

  async findCategory(categoryCode: string | null) {
    if (categoryCode && categoryCode !== "SEASONING") return null;
    return { id: categoryCode ? 5008 : 5009, code: categoryCode ?? "UNCLASSIFIED" };
  }

  async findIngredientsBySearchKey(searchKey: string) {
    return [...this.ingredients.values()].filter(row => row.name.toLowerCase().replace(/\s+/g, "") === searchKey);
  }

  async findUnit(unitId: number) {
    return this.units.get(unitId) ?? null;
  }

  async createPending(input: { name: string; searchKey: string; categoryId: number; defaultUnitId: number | null }) {
    this.createCalls += 1;
    const row = ingredientRow(this.nextId++, input.name, "PENDING", input.defaultUnitId);
    row.categoryCode = input.categoryId === 5009 ? "UNCLASSIFIED" : "SEASONING";
    this.ingredients.set(row.id, row);
    return row;
  }

  async findIngredientsByIds(ids: number[]) {
    return ids.flatMap(id => {
      const row = this.ingredients.get(id);
      return row ? [row] : [];
    });
  }

  async findUnitsByIds(ids: number[]) {
    return ids.flatMap(id => {
      const row = this.units.get(id);
      return row ? [row] : [];
    });
  }

  async updateItem(input: { id: number; version: number; recipeBodyJson: unknown; status: "READY" | "NEEDS_FIX"; errorJson: unknown; warnJson: unknown }) {
    this.updateCalls += 1;
    this.updates.push({ id: input.id, errorJson: input.errorJson });
    if (this.forceVersionConflict) return false;
    const record = this.records.find(row => row.id === input.id && row.version === input.version);
    if (!record) return false;
    record.recipeBodyJson = input.recipeBodyJson;
    record.version += 1;
    return true;
  }

  async refreshJob(jobId: number) {
    this.refreshedJobs.push(jobId);
    if (this.failNextRefresh) {
      this.failNextRefresh = false;
      throw new Error("refresh failed");
    }
  }
}

test("dry-run reports repairable incomplete names without performing writes", async () => {
  const records = [item()];
  const repository = new FakeRepository(records);

  const result = await backfillImportPendingIngredients({ apply: false, records, repository });

  assert.deepEqual(result, {
    mode: "dry-run",
    scannedItems: 1,
    repairedReferences: 1,
    createdPending: 1,
    disabledConflicts: 0,
    versionConflicts: 0,
    errors: []
  });
  assert.equal(repository.createCalls, 0);
  assert.equal(repository.updateCalls, 0);
  assert.deepEqual(repository.refreshedJobs, []);
});

test("dry-run counts a repeated missing name as one future pending ingredient", async () => {
  const records = [item(38), item(39)];
  const repository = new FakeRepository(records);

  const result = await backfillImportPendingIngredients({ apply: false, records, repository });

  assert.equal(result.repairedReferences, 2);
  assert.equal(result.createdPending, 1);
});

test("batch processing keeps reads bounded and deduplicates planned names across batches", async () => {
  const records = [item(38), item(39), item(40)];
  const repository = new FakeRepository(records);
  const reads: Array<{ cursorId: number; take: number }> = [];

  const result = await backfillImportPendingIngredientBatches({
    apply: false,
    batchSize: 2,
    repository,
    loadBatch: async (cursorId, take) => {
      reads.push({ cursorId, take });
      return records.filter(record => record.id > cursorId).slice(0, take);
    }
  });

  assert.deepEqual(reads, [
    { cursorId: 0, take: 2 },
    { cursorId: 39, take: 2 },
    { cursorId: 40, take: 2 }
  ]);
  assert.equal(result.scannedItems, 3);
  assert.equal(result.repairedReferences, 3);
  assert.equal(result.createdPending, 1);
});

test("apply creates a pending ingredient with no guessed default unit", async () => {
  const records = [item()];
  const repository = new FakeRepository(records);

  const result = await backfillImportPendingIngredients({ apply: true, records, repository });

  assert.equal(result.createdPending, 1);
  assert.equal(result.repairedReferences, 1);
  assert.equal(repository.ingredients.get(10000010)?.defaultUnitId, null);
  assert.equal((records[0].recipeBodyJson as ReturnType<typeof recipeBody>).ingredients[0].ingredientId, 10000010);
  assert.deepEqual(repository.refreshedJobs, [7]);
});

test("apply reuses ACTIVE and PENDING names and preserves a DISABLED reference", async () => {
  const records = [item(1, "葱"), item(2, "姜"), item(3, "旧调料")];
  const repository = new FakeRepository(records);
  repository.ingredients.set(10000001, ingredientRow(10000001, "葱", "ACTIVE"));
  repository.ingredients.set(10000002, ingredientRow(10000002, "姜", "PENDING", null));
  repository.ingredients.set(10000003, ingredientRow(10000003, "旧调料", "DISABLED"));

  const result = await backfillImportPendingIngredients({ apply: true, records, repository });

  assert.equal(result.repairedReferences, 3);
  assert.equal(result.createdPending, 0);
  assert.equal(result.disabledConflicts, 1);
  assert.equal((records[0].recipeBodyJson as ReturnType<typeof recipeBody>).ingredients[0].ingredientId, 10000001);
  assert.equal((records[1].recipeBodyJson as ReturnType<typeof recipeBody>).ingredients[0].ingredientId, 10000002);
  assert.equal((records[2].recipeBodyJson as ReturnType<typeof recipeBody>).ingredients[0].ingredientId, 10000003);
  assert.equal((records[0].recipeBodyJson as ReturnType<typeof recipeBody>).ingredients[0].categoryCode, "SEASONING");
  assert.equal((records[1].recipeBodyJson as ReturnType<typeof recipeBody>).ingredients[0].categoryCode, "UNCLASSIFIED");
  assert.equal((records[2].recipeBodyJson as ReturnType<typeof recipeBody>).ingredients[0].categoryCode, "SEASONING");
  assert.equal(
    (repository.updates.find(update => update.id === 3)?.errorJson as Array<{ field: string; message: string }>).some(error =>
      error.field === "ingredients.0.ingredientId" && error.message === "第 1 行食材已下架，请重新匹配"
    ),
    true
  );
});

test("repeated apply is idempotent and creates no additional pending ingredient", async () => {
  const records = [item()];
  const repository = new FakeRepository(records);

  await backfillImportPendingIngredients({ apply: true, records, repository });
  const second = await backfillImportPendingIngredients({ apply: true, records, repository });

  assert.equal(repository.createCalls, 1);
  assert.equal(second.createdPending, 0);
  assert.equal(second.repairedReferences, 0);
});

test("rerunning apply refreshes scanned job stats after a previous refresh failure", async () => {
  const records = [item()];
  const repository = new FakeRepository(records);
  repository.failNextRefresh = true;

  await assert.rejects(
    () => backfillImportPendingIngredients({ apply: true, records, repository }),
    /refresh failed/
  );
  assert.equal((records[0].recipeBodyJson as ReturnType<typeof recipeBody>).ingredients[0].ingredientId, 10000010);

  const second = await backfillImportPendingIngredients({ apply: true, records, repository });

  assert.equal(second.repairedReferences, 0);
  assert.deepEqual(repository.refreshedJobs, [7, 7]);
});

test("an optimistic-version conflict rolls back the pending ingredient creation", async () => {
  const records = [item()];
  const repository = new FakeRepository(records);
  repository.forceVersionConflict = true;

  const result = await backfillImportPendingIngredients({ apply: true, records, repository });

  assert.equal(result.createdPending, 0);
  assert.equal(result.repairedReferences, 0);
  assert.equal(result.versionConflicts, 1);
  assert.equal(repository.ingredients.size, 0);
  assert.equal(repository.createCalls, 0);
});

test("apply preserves a valid imported unit on a newly created pending ingredient", async () => {
  const records = [item(38, "白胡椒粉", 3001)];
  const repository = new FakeRepository(records);

  await backfillImportPendingIngredients({ apply: true, records, repository });

  assert.equal(repository.ingredients.get(10000010)?.defaultUnitId, 3001);
});

test("argument parsing defaults to dry-run and only accepts the exact apply flag", () => {
  assert.deepEqual(parseImportPendingIngredientArgs([]), { apply: false });
  assert.deepEqual(parseImportPendingIngredientArgs(["--apply"]), { apply: true });
  assert.deepEqual(parseImportPendingIngredientArgs(["--", "--apply"]), { apply: true });
  assert.throws(() => parseImportPendingIngredientArgs(["--apply=true"]), /Unsupported argument/);
});
