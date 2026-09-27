import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationDir = join(
  __dirname,
  "../../../prisma/migrations"
);
const copyMigrationPath = join(migrationDir, "20260927120000_medal_launch_copy/migration.sql");
const polishMigrationPath = join(migrationDir, "20260927130000_medal_launch_copy_polish/migration.sql");

test("首发勋章文案为全部五档设置独立名称且不暴露数量", () => {
  const sql = readFileSync(copyMigrationPath, "utf8");
  const polishSql = readFileSync(polishMigrationPath, "utf8");
  const rows = [...sql.matchAll(/^\s*\('([^']+)', '([^']*)', '([^']*)', '([^']*)'\)(?:,)?$/gm)];
  const codes = rows.map(row => row[1]);
  const names = rows.map(row => row[2]);
  const descriptionOverrides = new Map(
    [...polishSql.matchAll(/WHEN '([^']+)' THEN '([^']+)'/g)].map((row) => [row[1], row[2]])
  );

  assert.equal(rows.length, 40);
  assert.equal(new Set(codes).size, rows.length);
  assert.equal(new Set(names).size, rows.length, "every medal tier should have its own name");
  for (const row of rows) {
    assert.ok(row[2], `${row[1]} should have a name`);
    assert.doesNotMatch(row[2], /\d/, `${row[1]} name should not expose its tier count`);
    const description = descriptionOverrides.get(row[1]) ?? row[3];
    assert.doesNotMatch(description, /\d/, `${row[1]} description should not expose its tier count`);
    assert.doesNotMatch(description, /一次次|每次|多次/, `${row[1]} description should not describe tier counts`);
    assert.doesNotMatch(row[4], /\d/, `${row[1]} condition should not expose its tier count`);
  }

  assert.doesNotMatch(sql, /"target_count"\s*=/, "copy migration must preserve server-side tier thresholds");
  assert.doesNotMatch(sql, /"award_rule"\s*=/, "copy migration must preserve award rules");
});
