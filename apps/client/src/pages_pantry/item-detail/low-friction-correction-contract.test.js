const { readFileSync } = require("fs");
const { resolve } = require("path");
const nodeAssert = require("assert").strict;
const nodeTest = require("node:test");

const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");

nodeTest("食材详情提供补充数量、快用完和用完三个低摩擦入口", () => {
  nodeAssert.match(pageSource, /补充数量/);
  nodeAssert.match(pageSource, /快用完/);
  nodeAssert.match(pageSource, /用完/);
  nodeAssert.match(pageSource, /function markFridgeState\(mode: "ROUGH" \| "EMPTY"\)/);
  nodeAssert.match(pageSource, /available: mode === "ROUGH"/);
});
