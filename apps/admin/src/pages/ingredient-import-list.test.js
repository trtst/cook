import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./IngredientImportJobDetailPage.vue", import.meta.url), "utf8");
const api = readFileSync(new URL("../apis/ingredient.ts", import.meta.url), "utf8");

test("ingredient import list shows category and default unit instead of source path", () => {
  assert.doesNotMatch(page, /label="原文件路径"/);
  assert.match(page, /row\.categoryName \|\| row\.categoryCode/);
  assert.match(page, /row\.defaultUnitName \|\| "待补充"/);
});

test("ingredient import list supports quick review and quick delete", () => {
  assert.match(page, />快捷审核<\/el-button>/);
  assert.match(page, />快捷删除<\/el-button>/);
  assert.match(api, /deleteImportItem\(itemId: UUID/);
});

test("quick review keeps the audit and edit entry for the same ready item", () => {
  assert.match(page, /<el-button v-if="row\.status === 'READY' && row\.errorCount === 0"[\s\S]*?>快捷审核<\/el-button>/);
  assert.match(page, /<el-button v-if="row\.status !== 'IMPORTED'"[\s\S]*?@click="openItem\(row\.id\)">审核 \/ 修正<\/el-button>/);
});
