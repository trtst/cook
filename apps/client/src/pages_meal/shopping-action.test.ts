import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const planSource = readFileSync(resolve(__dirname, "plan/index.vue"), "utf8");
const detailSource = readFileSync(resolve(__dirname, "detail/index.vue"), "utf8");

test("meal shopping actions only treat ACTIVE lists as the current writable binding", () => {
  assert.match(planSource, /hasActiveShoppingListLink/);
  assert.match(detailSource, /hasActiveShoppingListLink/);
  assert.doesNotMatch(planSource, /hasShoppingListLink\(plan\)/);
  assert.doesNotMatch(detailSource, /hasShoppingListLink\(shoppingLinkTarget\.value\)/);
});
