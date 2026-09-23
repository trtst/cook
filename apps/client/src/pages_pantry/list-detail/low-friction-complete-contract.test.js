const { readFileSync } = require("fs");
const { resolve } = require("path");
const nodeAssert = require("assert").strict;
const nodeTest = require("node:test");

const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");

nodeTest("采购详情页把完成采购作为唯一主动作并自动入库", () => {
  nodeAssert.match(pageSource, /const primaryCardButtonText = computed\(\(\) => "完成采购"\);/);
  nodeAssert.match(pageSource, /async function handlePrimaryAction\(\) \{[\s\S]*?await finishList\(\);[\s\S]*?\}/);
  nodeAssert.match(pageSource, /entries: \[\]/);
  nodeAssert.match(pageSource, /已完成采购，食材已记入冰箱/);
  nodeAssert.doesNotMatch(pageSource, /buildShoppingCompletePagePath/);
});

nodeTest("部分已购时仍可完成采购，未购项留在清单事实中", () => {
  nodeAssert.match(pageSource, /const canShowPrimaryAction = computed\(\(\) =>[\s\S]*?hasCheckedGroups\.value[\s\S]*?\);/);
  nodeAssert.match(pageSource, /const primaryCardDesc = computed\(\(\) =>[\s\S]*?数量和到期时间可以之后再补充[\s\S]*?\);/);
});
