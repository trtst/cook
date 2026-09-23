const { readFileSync } = require("fs");
const { resolve } = require("path");
const nodeAssert = require("assert").strict;
const nodeTest = require("node:test");

const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const legacyCompletePageSource = readFileSync(resolve(__dirname, "../list-complete/index.vue"), "utf8");

nodeTest("采购清单列表不暴露自动入库的完成入口", () => {
  nodeAssert.doesNotMatch(pageSource, /标记完成/);
  nodeAssert.doesNotMatch(pageSource, /markComplete|openCompletePage|buildShoppingCompletePagePath/);
  nodeAssert.doesNotMatch(pageSource, /completeList\(/);
});

nodeTest("旧完成入库深链只跳转到清单详情", () => {
  nodeAssert.match(legacyCompletePageSource, /redirectTo\([^\n]*pages_pantry\/list-detail\/index/);
  nodeAssert.doesNotMatch(legacyCompletePageSource, /shoppingApi\.completeList\(/);
});
