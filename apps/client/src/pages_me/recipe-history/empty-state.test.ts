import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

test("recent history empty state uses the shared illustration and confirmed copy", () => {
  assert.match(source, /import emptyStateArt from "@\/assets\/empty\.png";/);
  assert.match(source, /import Empty from "@\/components\/Empty\/Empty\.vue";/);
  assert.match(
    source,
    /<Empty\s+:art="emptyStateArt"\s+title="还没有浏览记录"\s+description="去菜谱里逛逛，看过的菜谱会在这里留下足迹。"\s+\/>/
  );
  assert.doesNotMatch(source, /class="history-empty"/);
});
