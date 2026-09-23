import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("./IngredientPendingPage.vue", import.meta.url), "utf8");

test("incomplete pending ingredients show missing governance facts as pending completion", () => {
  assert.match(page, /row\.categoryName \|\| "待补充"/);
  assert.match(page, /row\.defaultUnitName \|\| "待补充"/);
});

test("opening an incomplete ingredient review does not guess category or default unit", () => {
  assert.match(page, /form\.categoryId = selectableCategories\.value\.find\(item => item\.id === row\.categoryId\)\?\.id \|\| ""/);
  assert.match(page, /form\.defaultUnitId = row\.defaultUnitId \|\| ""/);
  assert.doesNotMatch(page, /form\.categoryId = [^\n]*selectableCategories\.value\[0\]/);
  assert.doesNotMatch(page, /form\.defaultUnitId = [^\n]*units\.value\[0\]/);
});

test("merge targets exclude system ingredients without a default unit", () => {
  assert.match(page, /mergeOptions\.value\.filter\([\s\S]*item\.defaultUnit !== null/);
});

test("quick approval does not ask for a second confirmation", () => {
  const quickApprove = page.match(/async function quickApprove\([\s\S]*?(?=async function removeImportedPlaceholder)/)?.[0] ?? "";
  assert.match(quickApprove, /reviewPendingIngredient/);
  assert.doesNotMatch(quickApprove, /ElMessageBox\.confirm/);
});
