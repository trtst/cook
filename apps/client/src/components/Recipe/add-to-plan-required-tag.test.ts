import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "./AddToPlanSheet.vue"), "utf8");
assert.ok(source.includes("安排到哪餐"), "Expected the shared sheet to let users choose a meal slot.");
assert.ok(!source.includes("私房菜分类"), "Expected plan addition not to require a private-recipe category.");
assert.ok(!source.includes("sheet-section__tag"), "Expected the old required-category tag to be removed.");

console.log("add to plan required tag styles passed");
