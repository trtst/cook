const { readFileSync } = require("fs");
const { resolve } = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

test("我的口味四类使用回车提交的 Tag 输入，备注保留多行文本", () => {
  assert.match(source, /TasteTagInput/);
  assert.match(source, /@confirm=/);
  assert.match(source, /v-model="noteText"[\s\S]*textarea/);
  assert.doesNotMatch(source, /请用中文分号/);
  assert.doesNotMatch(source, /\.split\(tasteSeparator\)/);
});
