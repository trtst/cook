const { readFileSync } = require("fs");
const { resolve } = require("path");
const nodeAssert = require("assert").strict;
const nodeTest = require("node:test");

const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");

nodeTest("采购清单列表不暴露自动入库的完成入口", () => {
  nodeAssert.doesNotMatch(pageSource, /标记完成/);
  nodeAssert.doesNotMatch(pageSource, /markComplete|openCompletePage|buildShoppingCompletePagePath/);
  nodeAssert.doesNotMatch(pageSource, /completeList\(/);
});

nodeTest("采购清单删除提示不提旧兼容记录", () => {
  nodeAssert.match(pageSource, /删除后这张清单和其中食材会一并移除，无法恢复。/);
  nodeAssert.doesNotMatch(pageSource, /兼容记录/);
});
