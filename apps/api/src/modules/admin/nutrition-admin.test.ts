import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNutritionFoodWhere,
  buildNutritionDerivedInvalidationWhere,
  buildNutritionSnapshotDeleteWhere,
  normalizeNutritionCategory,
  normalizeNutritionSearch,
  toAdminNutritionFood
} from "./nutrition-admin";
import { parseNutritionCsvText } from "./nutrition-import";

test("nutrition search trims a bounded keyword", () => {
  assert.equal(normalizeNutritionSearch("  羊肉  "), "羊肉");
  assert.equal(normalizeNutritionSearch("   "), undefined);
});

test("nutrition category trims and bounds a selected category", () => {
  assert.equal(normalizeNutritionCategory("  畜肉类及其制品-羊  "), "畜肉类及其制品-羊");
  assert.equal(normalizeNutritionCategory("   "), undefined);
});

test("nutrition food queries keep category filtering in the database predicate", () => {
  assert.deepEqual(buildNutritionFoodWhere("羊肉", "畜肉类及其制品-羊"), {
    sourceVersion: "2026-08-22-primary-subset-v1",
    category: "畜肉类及其制品-羊",
    OR: [
      { sourceFoodCode: { contains: "羊肉", mode: "insensitive" } },
      { name: { contains: "羊肉", mode: "insensitive" } }
    ]
  });
});

test("nutrition snapshot invalidation keeps only unlocked automatic snapshots", () => {
  assert.deepEqual(buildNutritionSnapshotDeleteWhere([11, 12]), {
    sourceVersion: "2026-08-22-primary-subset-v1",
    source: "AUTO",
    isLocked: false,
    recipeVersionId: { in: [11, 12] }
  });
});

test("nutrition source imports invalidate unlocked automatic derived data", () => {
  assert.deepEqual(buildNutritionDerivedInvalidationWhere("v1"), {
    sourceVersion: "v1",
    source: "AUTO",
    isLocked: false
  });
});

test("nutrition category migration selects one latest batch per source version", async () => {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const migration = await readFile(resolve(process.cwd(), "prisma/migrations/20260909140000_nutrient_food_category/migration.sql"), "utf8");
  assert.match(migration, /DISTINCT ON\s*\(batch\."source_version"\)/);
  assert.match(migration, /ORDER BY batch\."source_version", batch\."imported_at" DESC, batch\."id" DESC/);
});

test("nutrition food exposes only the curated nutrition fields", () => {
  assert.deepEqual(
    toAdminNutritionFood({
      id: 12,
      sourceFoodCode: "083101x",
      name: "羊肉（代表值，fat7g）",
      edibleRate: 100,
      calories: 139,
      protein: 18.5,
      fat: 6.5,
      carbohydrate: 1.6,
      sourceVersion: "v1",
      category: "畜肉类及其制品-羊",
      englishName: "Lamb, lean and fat"
    }),
    {
      id: 12,
      foodCode: "083101x",
      foodName: "羊肉（代表值，fat7g）",
      englishName: "Lamb, lean and fat",
      category: "畜肉类及其制品-羊",
      edibleRate: 100,
      calories: 139,
      protein: 18.5,
      fat: 6.5,
      carbohydrate: 1.6,
      sourceVersion: "v1"
    }
  );
});

test("nutrition CSV validation rejects missing headers and empty food codes", () => {
  assert.throws(() => parseNutritionCsvText("category,foodName\n肉类,羊肉\n"), /CSV 缺少字段: foodCode/);
  assert.throws(
    () => parseNutritionCsvText("category,foodCode,foodName,englishName,edible,energyKCal,protein,fat,CHO\n肉类,,羊肉,,100,100,20,5,0\n"),
    /第 2 行 foodCode 不能为空/
  );
});

test("nutrition CSV validation preserves explicit source markers as null", () => {
  const rows = parseNutritionCsvText("category,foodCode,foodName,englishName,edible,energyKCal,protein,fat,CHO\n肉类,001,羊肉,,100,899*,Tr,—,0\n");
  assert.deepEqual(rows[0], {
    category: "肉类",
    foodCode: "001",
    foodName: "羊肉",
    englishName: "",
    edible: 100,
    energyKCal: 899,
    protein: null,
    fat: null,
    CHO: 0,
    raw: { category: "肉类", foodCode: "001", foodName: "羊肉", englishName: "", edible: "100", energyKCal: "899*", protein: "Tr", fat: "—", CHO: "0" }
  });
});
