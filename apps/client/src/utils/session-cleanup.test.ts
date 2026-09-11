import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

test("retired plan ordering cleanup removes all accounts while preserving other storage", () => {
  const source = readFileSync(resolve(__dirname, "session-cleanup.ts"), "utf8");
  const script = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const storage = new Map([
    ["meal-plan-order/v1", {}],
    ["meal-plan-order/v1/123", {}],
    ["meal-plan-order/v1/456", {}],
    ["meal-plan-order/v10/123", {}],
    ["cook_meal_session", {}],
    ["cook_meal_system_info_snapshot", {}],
    ["cook_meal_recipe_edit_123:new", {}]
  ]);
  const exports = {} as typeof import("./session-cleanup");
  new Function("require", "exports", script)((name: string) => {
    if (name !== "@/platform/uni") return {};
    return { uniPlatform: { storage: {
      keysSync: () => [...storage.keys()],
      removeSync: (key: string) => storage.delete(key)
    } } };
  }, exports);
  assert.equal(typeof exports.clearLegacyPlanOrder, "function");
  exports.clearLegacyPlanOrder();
  exports.clearLegacyPlanOrder();
  assert.deepEqual([...storage.keys()], [
    "meal-plan-order/v10/123", "cook_meal_session",
    "cook_meal_system_info_snapshot", "cook_meal_recipe_edit_123:new"
  ]);
});
