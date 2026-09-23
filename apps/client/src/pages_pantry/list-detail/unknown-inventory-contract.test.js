const { readFileSync } = require("fs");
const { resolve } = require("path");
const nodeAssert = require("assert").strict;
const nodeTest = require("node:test");

const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");

nodeTest("采购清单允许主动处理数量未知的库存", () => {
  nodeAssert.match(pageSource, /确认库存/);
  nodeAssert.match(pageSource, /够用/);
  nodeAssert.match(pageSource, /不够，加入采购/);
  nodeAssert.match(pageSource, /暂不处理/);
  nodeAssert.match(pageSource, /CONFIRM_ENOUGH/);
  nodeAssert.match(pageSource, /unknownSheetVisible/);
  nodeAssert.match(pageSource, /openUnknownInventorySheet/);
});
