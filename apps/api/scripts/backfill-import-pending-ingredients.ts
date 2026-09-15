import { Prisma, PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import type { RecipeImportIssue, RecipeImportRecipeBody } from "../src/contracts/types";
import {
  isImportedIngredientPlaceholder,
  normalizeRecipeImportBody,
  rebuildJsonItemState
} from "../src/modules/admin/recipe-import-json";
import { buildSearchKey } from "../src/modules/recipe/recipe-content";

export type ImportPendingItemRecord = {
  id: number;
  jobId: number;
  version: number;
  recipeBodyJson: unknown;
};

export type ImportPendingIngredientRow = {
  id: number;
  name: string;
  status: "PENDING" | "ACTIVE" | "DISABLED" | "MERGED";
  defaultUnitId: number | null;
  categoryCode: string;
  categorySelectable: boolean;
};

export type ImportPendingIngredientUnit = {
  id: number;
  name: string;
};

type ImportPendingCategory = {
  id: number;
  code: string;
};

type ItemUpdate = {
  id: number;
  version: number;
  recipeBodyJson: unknown;
  status: "READY" | "NEEDS_FIX";
  errorJson: unknown;
  warnJson: unknown;
};

export interface ImportPendingIngredientRepository {
  withTransaction<T>(work: (repository: ImportPendingIngredientRepository) => Promise<T>): Promise<T>;
  findCategory(categoryCode: string | null): Promise<ImportPendingCategory | null>;
  findIngredientsBySearchKey(searchKey: string): Promise<ImportPendingIngredientRow[]>;
  findUnit(unitId: number): Promise<ImportPendingIngredientUnit | null>;
  createPending(input: {
    name: string;
    searchKey: string;
    categoryId: number;
    defaultUnitId: number | null;
  }): Promise<ImportPendingIngredientRow>;
  findIngredientsByIds(ids: number[]): Promise<ImportPendingIngredientRow[]>;
  findUnitsByIds(ids: number[]): Promise<ImportPendingIngredientUnit[]>;
  updateItem(input: ItemUpdate): Promise<boolean>;
  refreshJob(jobId: number): Promise<void>;
}

export type ImportPendingIngredientBackfillResult = {
  mode: "dry-run" | "apply";
  scannedItems: number;
  repairedReferences: number;
  createdPending: number;
  disabledConflicts: number;
  versionConflicts: number;
  errors: Array<{ itemId: number; message: string }>;
};

class ImportItemVersionConflict extends Error {}

function preferredIngredient(rows: ImportPendingIngredientRow[]) {
  return rows.find(row => row.status === "ACTIVE")
    ?? rows.find(row => row.status === "PENDING")
    ?? rows.find(row => row.status === "DISABLED")
    ?? null;
}

function addReferenceIssues(
  recipeBody: RecipeImportRecipeBody,
  ingredientRows: ImportPendingIngredientRow[],
  unitRows: ImportPendingIngredientUnit[],
  errors: RecipeImportIssue[]
) {
  const ingredientMap = new Map(ingredientRows.map(row => [row.id, row]));
  const unitMap = new Map(unitRows.map(row => [row.id, row]));

  recipeBody.ingredients.forEach((item, index) => {
    if (item.ingredientId) {
      const ingredient = ingredientMap.get(item.ingredientId);
      const field = `ingredients.${index}.ingredientId`;
      if (!ingredient || ingredient.status === "MERGED") {
        errors.push({ field, message: `第 ${index + 1} 行食材不存在` });
      } else if (ingredient.status === "DISABLED") {
        errors.push({ field, message: `第 ${index + 1} 行食材已下架，请重新匹配` });
      } else if (ingredient.status === "PENDING") {
        errors.push({ field, message: `第 ${index + 1} 行食材仍在待归类，请先到食材管理完成归类` });
      } else {
        if (buildSearchKey(item.ingredientName) !== buildSearchKey(ingredient.name)) {
          errors.push({ field: `ingredients.${index}.ingredientName`, message: `第 ${index + 1} 行食材名称未严格匹配系统食材` });
        }
        if (!ingredient.categorySelectable) {
          errors.push({ field, message: `第 ${index + 1} 行食材仍在待归类，请先到食材管理完成归类` });
        }
      }
    }
    if (item.unitId) {
      const unit = unitMap.get(item.unitId);
      if (!unit) {
        errors.push({ field: `ingredients.${index}.unitId`, message: `第 ${index + 1} 行单位不存在` });
      } else if (item.unitText && buildSearchKey(item.unitText) !== buildSearchKey(unit.name)) {
        errors.push({ field: `ingredients.${index}.unitText`, message: `第 ${index + 1} 行单位未严格匹配系统单位` });
      }
    }
  });
}

async function itemState(repository: ImportPendingIngredientRepository, recipeBody: RecipeImportRecipeBody) {
  const state = rebuildJsonItemState(recipeBody);
  const ingredientIds = Array.from(new Set(
    recipeBody.ingredients.map(item => item.ingredientId).filter((value): value is number => value !== null)
  ));
  const unitIds = Array.from(new Set(
    recipeBody.ingredients.map(item => item.unitId).filter((value): value is number => value !== null)
  ));
  const [ingredientRows, unitRows] = await Promise.all([
    repository.findIngredientsByIds(ingredientIds),
    repository.findUnitsByIds(unitIds)
  ]);
  addReferenceIssues(recipeBody, ingredientRows, unitRows, state.errorItems);
  return state;
}

async function dryRunItem(
  record: ImportPendingItemRecord,
  repository: ImportPendingIngredientRepository,
  plannedSearchKeys: Set<string>
) {
  const recipeBody = normalizeRecipeImportBody(record.recipeBodyJson as RecipeImportRecipeBody);
  let repairedReferences = 0;
  let createdPending = 0;
  let disabledConflicts = 0;

  for (const item of recipeBody.ingredients) {
    if (item.ingredientId || !item.ingredientName.trim() || isImportedIngredientPlaceholder(item.ingredientName)) continue;
    const searchKey = buildSearchKey(item.ingredientName);
    const existing = preferredIngredient(await repository.findIngredientsBySearchKey(searchKey));
    if (existing?.status === "DISABLED") {
      disabledConflicts += 1;
    }
    repairedReferences += 1;
    if (!existing && !plannedSearchKeys.has(searchKey)) {
      const category = await repository.findCategory(item.categoryCode?.trim() || null);
      if (!category) {
        repairedReferences -= 1;
        continue;
      }
      plannedSearchKeys.add(searchKey);
      createdPending += 1;
    }
  }

  return { repairedReferences, createdPending, disabledConflicts };
}

async function applyItem(record: ImportPendingItemRecord, repository: ImportPendingIngredientRepository) {
  const recipeBody = normalizeRecipeImportBody(record.recipeBodyJson as RecipeImportRecipeBody);
  let repairedReferences = 0;
  let createdPending = 0;
  let disabledConflicts = 0;

  for (const item of recipeBody.ingredients) {
    if (item.ingredientId || !item.ingredientName.trim() || isImportedIngredientPlaceholder(item.ingredientName)) continue;
    const searchKey = buildSearchKey(item.ingredientName);
    let ingredient = preferredIngredient(await repository.findIngredientsBySearchKey(searchKey));
    if (ingredient?.status === "DISABLED") {
      disabledConflicts += 1;
    }
    const unit = item.unitId ? await repository.findUnit(item.unitId) : null;
    if (!ingredient) {
      const category = await repository.findCategory(item.categoryCode?.trim() || null);
      if (!category) continue;
      ingredient = await repository.createPending({
        name: item.ingredientName.trim(),
        searchKey,
        categoryId: category.id,
        defaultUnitId: unit?.id ?? null
      });
      createdPending += 1;
    }
    item.ingredientId = ingredient.id;
    item.ingredientName = ingredient.name;
    item.categoryCode = ingredient.categoryCode;
    if (unit) item.unitText = unit.name;
    repairedReferences += 1;
  }

  if (!repairedReferences) return { repairedReferences, createdPending, disabledConflicts, changed: false };

  const state = await itemState(repository, recipeBody);
  const updated = await repository.updateItem({
    id: record.id,
    version: record.version,
    recipeBodyJson: recipeBody,
    status: state.errorItems.length ? "NEEDS_FIX" : "READY",
    errorJson: state.errorItems,
    warnJson: state.warnItems
  });
  if (!updated) throw new ImportItemVersionConflict(`Import item ${record.id} changed during backfill`);
  return { repairedReferences, createdPending, disabledConflicts, changed: true };
}

export async function backfillImportPendingIngredients(input: {
  apply: boolean;
  records: ImportPendingItemRecord[];
  repository: ImportPendingIngredientRepository;
  plannedSearchKeys?: Set<string>;
}): Promise<ImportPendingIngredientBackfillResult> {
  const result: ImportPendingIngredientBackfillResult = {
    mode: input.apply ? "apply" : "dry-run",
    scannedItems: input.records.length,
    repairedReferences: 0,
    createdPending: 0,
    disabledConflicts: 0,
    versionConflicts: 0,
    errors: []
  };
  const scannedJobIds = new Set(input.records.map(record => record.jobId));
  const plannedSearchKeys = input.plannedSearchKeys ?? new Set<string>();

  for (const record of input.records) {
    try {
      const itemResult = input.apply
        ? await input.repository.withTransaction(repository => applyItem(record, repository))
        : await dryRunItem(record, input.repository, plannedSearchKeys);
      result.repairedReferences += itemResult.repairedReferences;
      result.createdPending += itemResult.createdPending;
      result.disabledConflicts += itemResult.disabledConflicts;
    } catch (error) {
      if (error instanceof ImportItemVersionConflict) {
        result.versionConflicts += 1;
        continue;
      }
      result.errors.push({
        itemId: record.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (input.apply) {
    for (const jobId of scannedJobIds) {
      await input.repository.refreshJob(jobId);
    }
  }
  return result;
}

export async function backfillImportPendingIngredientBatches(input: {
  apply: boolean;
  batchSize: number;
  repository: ImportPendingIngredientRepository;
  loadBatch: (cursorId: number, take: number) => Promise<ImportPendingItemRecord[]>;
}): Promise<ImportPendingIngredientBackfillResult> {
  const result: ImportPendingIngredientBackfillResult = {
    mode: input.apply ? "apply" : "dry-run",
    scannedItems: 0,
    repairedReferences: 0,
    createdPending: 0,
    disabledConflicts: 0,
    versionConflicts: 0,
    errors: []
  };
  const plannedSearchKeys = new Set<string>();
  let cursorId = 0;

  while (true) {
    const records = await input.loadBatch(cursorId, input.batchSize);
    if (!records.length) break;
    const nextCursorId = records.at(-1)?.id ?? cursorId;
    if (nextCursorId <= cursorId) throw new Error("Backfill batch cursor did not advance");
    const batch = await backfillImportPendingIngredients({
      apply: input.apply,
      records,
      repository: input.repository,
      plannedSearchKeys
    });
    result.scannedItems += batch.scannedItems;
    result.repairedReferences += batch.repairedReferences;
    result.createdPending += batch.createdPending;
    result.disabledConflicts += batch.disabledConflicts;
    result.versionConflicts += batch.versionConflicts;
    result.errors.push(...batch.errors);
    cursorId = nextCursorId;
  }

  return result;
}

export function parseImportPendingIngredientArgs(argv: string[]) {
  for (const argument of argv) {
    if (argument !== "--" && argument !== "--apply") throw new Error(`Unsupported argument: ${argument}`);
  }
  return { apply: argv.includes("--apply") };
}

type PrismaDb = PrismaClient | Prisma.TransactionClient;

function prismaRepository(db: PrismaDb, client: PrismaClient): ImportPendingIngredientRepository {
  return {
    withTransaction: work => client.$transaction(tx => work(prismaRepository(tx, client))),
    async findCategory(categoryCode) {
      return db.ingredientCategory.findFirst({
        where: categoryCode
          ? { code: categoryCode, isSelectable: true }
          : { code: "UNCLASSIFIED" },
        select: { id: true, code: true }
      });
    },
    async findIngredientsBySearchKey(searchKey) {
      const rows = await db.ingredient.findMany({
        where: { ownerId: null, searchKey, status: { in: ["ACTIVE", "PENDING", "DISABLED"] } },
        include: { category: { select: { code: true, isSelectable: true } } }
      });
      return rows.map(row => ({
        id: row.id,
        name: row.name,
        status: row.status,
        defaultUnitId: row.defaultUnitId,
        categoryCode: row.category.code,
        categorySelectable: row.category.isSelectable
      }));
    },
    async findUnit(unitId) {
      return db.unit.findFirst({
        where: { id: unitId, ownerId: null },
        select: { id: true, name: true }
      });
    },
    async createPending(input) {
      const [categoryLast, displayLast] = await Promise.all([
        db.ingredient.findFirst({
          where: { ownerId: null, status: "ACTIVE", categoryId: input.categoryId },
          orderBy: { systemSortOrder: "desc" },
          select: { systemSortOrder: true }
        }),
        db.ingredient.findFirst({
          where: { ownerId: null, status: "ACTIVE" },
          orderBy: { displaySortOrder: "desc" },
          select: { displaySortOrder: true }
        })
      ]);
      const row = await db.ingredient.create({
        data: {
          ownerId: null,
          status: "PENDING",
          categoryId: input.categoryId,
          defaultUnitId: input.defaultUnitId,
          name: input.name,
          searchKey: input.searchKey,
          systemSortOrder: (categoryLast?.systemSortOrder ?? -1) + 1,
          displaySortOrder: (displayLast?.displaySortOrder ?? -1) + 1
        },
        include: { category: { select: { code: true, isSelectable: true } } }
      });
      return {
        id: row.id,
        name: row.name,
        status: row.status,
        defaultUnitId: row.defaultUnitId,
        categoryCode: row.category.code,
        categorySelectable: row.category.isSelectable
      };
    },
    async findIngredientsByIds(ids) {
      if (!ids.length) return [];
      const rows = await db.ingredient.findMany({
        where: { id: { in: ids }, ownerId: null },
        include: { category: { select: { code: true, isSelectable: true } } }
      });
      return rows.map(row => ({
        id: row.id,
        name: row.name,
        status: row.status,
        defaultUnitId: row.defaultUnitId,
        categoryCode: row.category.code,
        categorySelectable: row.category.isSelectable
      }));
    },
    async findUnitsByIds(ids) {
      if (!ids.length) return [];
      return db.unit.findMany({
        where: { id: { in: ids }, ownerId: null },
        select: { id: true, name: true }
      });
    },
    async updateItem(input) {
      const updated = await db.recipeImportItem.updateMany({
        where: { id: input.id, version: input.version, status: { not: "PUBLISHED" }, job: { sourceType: "JSON" } },
        data: {
          recipeBodyJson: input.recipeBodyJson as Prisma.InputJsonValue,
          status: input.status,
          errorJson: input.errorJson as Prisma.InputJsonValue,
          warnJson: input.warnJson as Prisma.InputJsonValue,
          version: { increment: 1 }
        }
      });
      return updated.count === 1;
    },
    async refreshJob(jobId) {
      const rows = await db.recipeImportItem.groupBy({
        by: ["status"],
        where: { jobId },
        _count: { _all: true }
      });
      const counts = new Map(rows.map(row => [row.status, row._count._all]));
      const totalCount = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
      const readyCount = counts.get("READY") ?? 0;
      const needsFixCount = counts.get("NEEDS_FIX") ?? 0;
      const failedCount = counts.get("FAILED") ?? 0;
      const runningCount = (counts.get("PENDING_PARSE") ?? 0) + (counts.get("PUBLISHING") ?? 0);
      const publishedCount = counts.get("PUBLISHED") ?? 0;
      const status = totalCount === 0 || failedCount === totalCount
        ? "FAILED"
        : runningCount > 0
          ? "RUNNING"
          : readyCount === 0 && needsFixCount === 0 && publishedCount + failedCount === totalCount
            ? "COMPLETED"
            : "READY";
      await db.recipeImportJob.update({
        where: { id: jobId },
        data: { status, totalCount, readyCount, needsFixCount, failedCount }
      });
    }
  };
}

async function runCli() {
  loadLocalEnv();
  const client = new PrismaClient();
  const args = parseImportPendingIngredientArgs(process.argv.slice(2));
  try {
    const result = await backfillImportPendingIngredientBatches({
      apply: args.apply,
      batchSize: 100,
      repository: prismaRepository(client, client),
      loadBatch: (cursorId, take) => client.recipeImportItem.findMany({
        where: {
          id: { gt: cursorId },
          job: { sourceType: "JSON" },
          status: { not: "PUBLISHED" }
        },
        orderBy: { id: "asc" },
        take,
        select: { id: true, jobId: true, version: true, recipeBodyJson: true }
      })
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.$disconnect();
  }
}

if (require.main === module) {
  void runCli().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
