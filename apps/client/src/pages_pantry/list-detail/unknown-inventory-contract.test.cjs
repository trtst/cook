const { readFileSync } = require("fs");
const { resolve } = require("path");
const nodeAssert = require("assert").strict;
const nodeTest = require("node:test");

const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");

nodeTest("采购清单不暴露数量未知的库存决策", () => {
  nodeAssert.doesNotMatch(pageSource, /确认库存/);
  nodeAssert.doesNotMatch(pageSource, /够用/);
  nodeAssert.doesNotMatch(pageSource, /不够，加入采购/);
  nodeAssert.doesNotMatch(pageSource, /暂不处理/);
  nodeAssert.doesNotMatch(pageSource, /CONFIRM_ENOUGH/);
  nodeAssert.doesNotMatch(pageSource, /unknownSheetVisible/);
  nodeAssert.doesNotMatch(pageSource, /openUnknownInventorySheet/);
});
