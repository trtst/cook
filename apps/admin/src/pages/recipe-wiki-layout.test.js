import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./RecipeWikiPage.vue", import.meta.url), "utf8");

test("renders server Wiki items and local revision items in one paginated table", () => {
  assert.match(page, /const pageRows = computed<RecipeWikiPageRow\[]>\(\(\) =>/);
  assert.match(page, /return \[\.\.\.revisions, \.\.\.wiki\]/);
  assert.match(page, /<el-table ref="tableRef" :data="pageRows" row-key="key" reserve-selection/);
  assert.match(page, /<div v-else v-loading="loading" class="table-panel">/);
  assert.doesNotMatch(page, /revisionPreviewVisible|<el-drawer/);
});

test("keeps bulk Wiki removal within the API's 100-item limit", () => {
  assert.match(page, /function canSelectRow\(row: RecipeWikiPageRow\)/);
  assert.match(page, /selected\.value\.length < 100/);
  assert.match(page, /:selectable="canSelectRow"/);
  assert.match(page, /if \(selected\.value\.length > 100\)/);
  assert.match(page, /移出待补充（\{\{ selected\.length }}\/100）/);
});
