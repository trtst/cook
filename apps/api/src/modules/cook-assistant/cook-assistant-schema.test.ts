import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const schemaPath = join(__dirname, "../../../prisma/schema.prisma");
const migrationPath = join(__dirname, "../../../prisma/migrations/20260913100000_cook_assistant_unlocks/migration.sql");

const schema = readFileSync(schemaPath, "utf8");
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

function block(name: string) {
  const matched = schema.match(new RegExp(`(?:enum|model) ${name} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(matched, `Expected ${name} block in schema.prisma`);
  return matched[0];
}

function assertIncludesAll(source: string, values: string[], label: string) {
  for (const value of values) {
    assert.match(source, new RegExp(`\\b${value}\\b`), `Expected ${label} to include ${value}`);
  }
}

test("recipe assistant status supports the full Wiki lifecycle", () => {
  assertIncludesAll(block("RecipeAssistantStatus"), ["PENDING", "GENERATING", "NEEDS_REVIEW", "READY", "FAILED"], "RecipeAssistantStatus");
});

test("recipe cook assistant separates candidate content from READY frontend snapshot", () => {
  const model = block("RecipeCookAssistant");

  assert.match(model, /\bcandidateJson\s+Json\?/);
  assert.match(model, /\bsnapshotJson\s+Json\?/);
  assert.match(model, /\bgeneratedAt\s+DateTime\?/);
  assert.match(migration, /recipe_cook_assistants_ready_snapshot_chk/);
  assert.match(migration, /"status"\s*=\s*'READY'[\s\S]*"snapshot_json"\s+IS\s+NOT\s+NULL/);
  assert.match(migration, /"status"\s*=\s*'READY'[\s\S]*"generated_at"\s+IS\s+NOT\s+NULL/);
});

test("meal plan cook assistant keeps legacy snapshot and adds a new immutable contract snapshot", () => {
  const model = block("MealPlanCookAssistant");

  assert.match(model, /\bmenuDigest\s+String\?\s+@map\("menu_digest"\)/);
  assert.match(model, /\bsnapshot\s+Json\?\s+@map\("snapshot"\)/);
  assert.match(model, /\bgeneratedAt\s+DateTime\?\s+@map\("generated_at"\)/);
  assert.match(model, /\bcontractVersion\s+String\s+@default\("legacy\.v1"\)\s+@map\("contract_version"\)/);
  assert.match(model, /\bstatus\s+MealAssistantStatus\s+@default\(READY\)/);
  assert.match(model, /\bassistantJson\s+Json\?\s+@map\("assistant_json"\)/);
  assert.match(model, /\bassistantGeneratedAt\s+DateTime\?\s+@map\("assistant_generated_at"\)/);
  assertIncludesAll(block("MealAssistantStatus"), ["GENERATING", "READY", "FAILED"], "MealAssistantStatus");
  assert.match(migration, /ALTER COLUMN "menu_digest" DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN "snapshot" DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN "generated_at" DROP NOT NULL/);
  assert.match(migration, /meal_plan_cook_assistants_ready_contract_chk/);
});

test("cook assistant unlock records exactly one target and enforces user target uniqueness", () => {
  const model = block("CookAssistantUnlock");

  assert.match(model, /\buserId\s+Int\s+@map\("user_id"\)/);
  assert.match(model, /\brecipeVersionId\s+Int\?\s+@map\("recipe_version_id"\)/);
  assert.match(model, /\bplanItemId\s+Int\?\s+@map\("plan_item_id"\)/);
  assert.match(model, /\bunlockedOn\s+DateTime\s+@map\("unlocked_on"\)\s+@db\.Date/);
  assert.match(model, /\bunlockedAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("unlocked_at"\)\s+@db\.Timestamptz\(3\)/);
  assert.match(model, /recipeVersion\s+RecipeContentVersion\?\s+@relation\([^)]*onDelete:\s*Cascade/);
  assert.match(model, /planItem\s+MealPlanItem\?\s+@relation\([^)]*onDelete:\s*Cascade/);
  assert.match(model, /@@unique\(\[userId,\s*recipeVersionId\]/);
  assert.match(model, /@@unique\(\[userId,\s*planItemId\]/);
  assert.match(model, /@@index\(\[userId,\s*unlockedOn\]/);
  assert.match(migration, /cook_assistant_unlocks_target_xor_chk/);
});

test("idempotency records have partial unique indexes for nullable scopes", () => {
  assert.match(migration, /idempotency_records_user_no_group_uq/);
  assert.match(migration, /WHERE\s+"user_id"\s+IS\s+NOT\s+NULL\s+AND\s+"dining_group_id"\s+IS\s+NULL/i);
  assert.match(migration, /idempotency_records_user_group_uq/);
  assert.match(migration, /WHERE\s+"user_id"\s+IS\s+NOT\s+NULL\s+AND\s+"dining_group_id"\s+IS\s+NOT\s+NULL/i);
  assert.match(migration, /idempotency_records_admin_uq/);
  assert.match(migration, /WHERE\s+"admin_id"\s+IS\s+NOT\s+NULL/i);
});
