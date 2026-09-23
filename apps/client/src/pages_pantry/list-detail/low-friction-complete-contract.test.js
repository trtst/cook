const { readFileSync } = require("fs");
const { resolve } = require("path");
const nodeAssert = require("assert").strict;
const nodeTest = require("node:test");

const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");

nodeTest("采购详情页不暴露完成采购后的入库主动作", () => {
  nodeAssert.doesNotMatch(pageSource, /primaryCardButtonText/);
  nodeAssert.doesNotMatch(pageSource, /handlePrimaryAction|finishList/);
  nodeAssert.doesNotMatch(pageSource, /entries: \[\]/);
  nodeAssert.doesNotMatch(pageSource, /自动记入冰箱|食材已记入冰箱/);
  nodeAssert.doesNotMatch(pageSource, /buildShoppingCompletePagePath/);
});

nodeTest("采购详情页只保留逐项已购状态", () => {
  nodeAssert.match(pageSource, /已购/);
  nodeAssert.doesNotMatch(pageSource, /数量和到期时间可以之后再补充/);
});
