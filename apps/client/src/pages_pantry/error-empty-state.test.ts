import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readPage(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

function expectIncludes(source: string, snippet: string) {
  assert.ok(source.includes(snippet), `Expected page to include: ${snippet}`);
}

const shoppingListSource = readPage("./list/index.vue");
const shoppingDetailSource = readPage("./list-detail/index.vue");
const pantryHomeSource = readPage("./index/index.vue");

expectIncludes(
  shoppingListSource,
  '<Empty\n                v-if="errorText"\n                :art="emptyStateArt"\n                clickable\n                title="采购清单加载遇到问题"\n                description="请检查网络后重新加载。"\n                @click="loadPage"'
);
expectIncludes(
  shoppingDetailSource,
  '<view v-else-if="errorText" class="detail-empty">\n        <Empty\n          :art="emptyStateArt"\n          clickable\n          title="清单详情加载遇到问题"\n          description="请检查网络后重新加载。"\n          @click="loadDetail"'
);
expectIncludes(
  pantryHomeSource,
  '<Empty\n                v-if="errorText"\n                class="pantry-empty"\n                :art="emptyStateArt"\n                clickable\n                title="食材加载遇到问题"\n                description="请检查网络后重新加载。"\n                @click="loadPage"'
);

console.log("pantry error empty-state tests passed");
