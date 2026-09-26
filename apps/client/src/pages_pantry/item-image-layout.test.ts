import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readPage(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

const pantryHomeSource = readPage("./index/index.vue");
const shoppingDetailSource = readPage("./list-detail/index.vue");

assert.match(pantryHomeSource, /只做参考，不做库存记账/);
assert.match(pantryHomeSource, /最近买过或用过的食材痕迹/);
assert.match(pantryHomeSource, /trace\.presence/);
assert.match(pantryHomeSource, />确认还有<\/button>/);
assert.match(pantryHomeSource, />标记没有<\/button>/);
assert.match(pantryHomeSource, /很久没记录（\{\{ archivedTraces\.length \}\} 项）/);
assert.match(pantryHomeSource, /超过 30 天未更新/);
assert.match(pantryHomeSource, /loadAllFridgeTraces\(\(page, pageSize\) => fridgeApi\.list\(page, pageSize\)\)/);
assert.ok(
  shoppingDetailSource.includes('<ImageLoader class="item-row__image" :src="group.imageUrl" />'),
  "Shopping-list ingredients should render their image through ImageLoader"
);

console.log("pantry low-maintenance layout tests passed");
