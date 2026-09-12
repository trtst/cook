import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationPath = path.resolve(
  process.cwd(),
  "prisma/migrations/20260912160000_recipe_owner_snapshot_and_public_content_pool/migration.sql"
);

test("recipe owner migration only backfills the documented legacy system samples", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.match(sql, /UPDATE "recipes"\s+SET "owner_id" = 1001/s);
  assert.match(sql, /"owner_id" IS NULL/);
  assert.match(sql, /"is_inspiration" = false/);
  assert.match(sql, /"id" IN \(10002101, 10002102, 10002103, 10002104, 10002105, 10002111, 10002112, 10002113, 10002114, 10002115\)/);
  assert.match(sql, /recipes\.owner_id still contains non-inspiration legacy rows/);
});
