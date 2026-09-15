import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("./IngredientItemsPage.vue", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../apis/ingredient.ts", import.meta.url), "utf8");

test("nutrition loading guards against stale ingredient responses", () => {
  assert.match(page, /let nutritionRequest = 0/);
  assert.match(page, /requestId !== nutritionRequest/);
  assert.match(page, /nutritionDetail\.value = null/);
  assert.match(page, /:disabled="!nutritionDetail/);
});

test("the unclassified category requests pending ingredients and exposes a processing action", () => {
  assert.match(page, /item\.code === "UNCLASSIFIED"/);
  assert.match(page, /\? "ALL" : "ACTIVE"/);
  assert.match(page, /row\.status === 'PENDING'/);
  assert.match(page, />处理<\/el-button>/);
});

test("an unclassified pending card renders safely when the default unit is missing", () => {
  assert.match(page, /row\.defaultUnit\?\.name \|\| "默认单位待补充"/);
  assert.match(page, /form\.defaultUnitId = row\.defaultUnit\?\.id \|\| ""/);
});

test("merged ingredients have a dedicated read-only view and active target", () => {
  assert.match(page, /<el-option label="已归并" value="MERGED" \/>/);
  assert.match(page, /row\.status === 'MERGED'/);
  assert.match(page, /归并至：\{\{ row\.mergedTo\?\.name \}\}/);
  assert.match(page, /v-else-if="row\.status === 'MERGED'"/);
});

test("active and disabled ingredient cards can open the merge dialog", () => {
  assert.match(page, /openMergeIngredient\(row\)/);
  assert.match(page, /合并为主食材/);
  assert.match(page, /status: "ACTIVE"/);
  assert.match(page, /item\.id !== mergeSource\.value\?\.id/);
  assert.match(page, /不会覆盖主食材资料/);
  assert.match(page, /已发布菜谱不会改写/);
});

test("the Admin ingredient API submits an idempotent merge request", () => {
  assert.match(api, /mergeIngredient\(sourceIngredientId: UUID, body: MergeIngredientPayload\)/);
  assert.match(api, /\/admin\/ingredients\/\$\{encodeURIComponent\(String\(sourceIngredientId\)\)\}\/merge/);
  assert.match(api, /targetIngredientId: UUID/);
  assert.match(api, /idempotencyKey: operationId/);
});
