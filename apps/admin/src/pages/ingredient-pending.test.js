import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("./IngredientPendingPage.vue", import.meta.url), "utf8");

test("pending ingredients expose a list-level quick approval action", () => {
  assert.match(page, /快捷通过/);
  assert.match(page, /source === 'JSON_IMPORT'/);
  assert.match(page, /移除占位/);
});

test("import placeholders cannot use quick approval", () => {
  assert.match(page, /!isImportedPlaceholder\(row\)/);
});
