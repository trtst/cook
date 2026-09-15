import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function createFunction(relativePath: string) {
  const source = readFileSync(resolve(__dirname, relativePath), "utf8");
  const start = source.indexOf("async function createShoppingList() {");
  const end = source.indexOf("async function confirmAddToShoppingList()", start);
  assert.ok(start >= 0 && end > start, `Expected create flow in ${relativePath}`);
  return source.slice(start, end);
}

const createFlows = [
  createFunction("../../pages_meal/detail/index.vue"),
  createFunction("../../pages_meal/plan/index.vue"),
  createFunction("../../pages_recipe/detail/index.vue")
];

for (const flow of createFlows) {
  assert.doesNotMatch(flow, /loadShoppingLists\(true\)/, "create success should not refetch all active lists");
  assert.match(flow, /shoppingLists\.value = \[/, "create success should update the local picker list");
  assert.match(flow, /\.\.\.shoppingLists\.value\.filter\(item => item\.id !== created\.id\)/);
  assert.match(flow, /selectedShoppingListId\.value = created\.id/);
}

console.log("shopping list create flow tests passed");
