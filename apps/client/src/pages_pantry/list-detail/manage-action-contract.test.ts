import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

assert.doesNotMatch(source, /key:\s*["']add-meal["']/, "The list-detail manage dock should not expose the add-meal action");
assert.doesNotMatch(source, /title="添加餐次"/, "The list-detail page should not render the add-meal sheet");
assert.doesNotMatch(source, /openMealSourceSheet|submitPlanSheet|mealSourceSheetVisible/, "The add-meal sheet flow should be removed with its entry point");
assert.doesNotMatch(source, /用库存|确认库存|NEED_CONFIRM|CONFIRM_ENOUGH|handleFridgeAction|openUnknownInventorySheet/, "The V1 shopping detail page must not expose the legacy inventory decision flow");

console.log("pantry list-detail manage action contract passed");
