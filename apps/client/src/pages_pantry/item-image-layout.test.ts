import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readPage(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

const pantryHomeSource = readPage("./index/index.vue");
const shoppingDetailSource = readPage("./list-detail/index.vue");

assert.match(pantryHomeSource, /最近买过、用过的食材会记在这里，家里有变化时也可以随手更新/);
assert.match(pantryHomeSource, /不需要维护精确库存/);
assert.match(pantryHomeSource, /trace\.presence/);
assert.doesNotMatch(pantryHomeSource, />确认还有<\/button>|>标记没有<\/button>/);
assert.match(pantryHomeSource, /很久没记录（\{\{ filteredArchivedTraces\.length \}\} 项）/);
assert.match(pantryHomeSource, /超过 30 天未更新/);
assert.match(pantryHomeSource, /fridgeApi\.list\(1, 20, categoryFilter\.value \?\? undefined\)/);
assert.doesNotMatch(shoppingDetailSource, /ImageLoader|item-row__image/, "Shopping-list detail keeps the confirmed text-first layout without ingredient images");

console.log("pantry low-maintenance layout tests passed");
