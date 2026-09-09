import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationPath = path.resolve(
  process.cwd(),
  "prisma/migrations/20260909120000_resource_id_sequences/migration.sql"
);

const sequenceStarts = {
  recipe_categories: 10_000_000,
  recipe_scenes: 10_000_000,
  inspiration_categories: 6_001,
  ingredient_categories: 5_001,
  units: 3_001,
  ingredients: 10_000_000,
  recipe_content_versions: 10_000_000,
  recipes: 10_000_000
} as const;

test("resource ID migration reserves the documented next IDs", () => {
  assert.equal(fs.existsSync(migrationPath), true, "resource ID migration is missing");
  const sql = fs.readFileSync(migrationPath, "utf8");

  for (const [table, start] of Object.entries(sequenceStarts)) {
    assert.match(
      sql,
      new RegExp(`setval[^\\n]*${table}[^\\n]*${start - 1}`),
      `expected ${table} sequence to start at ${start}`
    );
  }
});

test("seed keeps all documented inspiration categories in the 6001-6009 range", () => {
  const seedPath = path.resolve(process.cwd(), "prisma/seed.ts");
  const seed = fs.readFileSync(seedPath, "utf8");
  const expectedCategories = [
    [6001, "家常便饭"],
    [6002, "下饭好菜"],
    [6003, "快手小炒"],
    [6004, "减脂轻食"],
    [6005, "周末大餐"],
    [6006, "一人食光"],
    [6007, "地方风味"],
    [6008, "清淡养生"],
    [6009, "宴客硬菜"]
  ] as const;

  for (const [id, name] of expectedCategories) {
    assert.match(seed, new RegExp(`id: ${id}, name: "${name}"`), `missing inspiration category ${id}`);
  }
});
