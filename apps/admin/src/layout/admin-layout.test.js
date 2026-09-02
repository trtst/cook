import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layoutSource = readFileSync(resolve(import.meta.dirname, "AdminLayout.vue"), "utf8");
const routerSource = readFileSync(resolve(import.meta.dirname, "../router/index.ts"), "utf8");

assert.ok(layoutSource.includes("<span>内容治理</span>"), "Expected sidebar to expose content governance group.");
assert.ok(
  layoutSource.includes('<el-menu-item index="/content/official-messages">官方消息</el-menu-item>'),
  "Expected sidebar to expose official messages under content governance."
);
assert.ok(
  routerSource.includes('path: "content/official-messages"'),
  "Expected router to keep the official messages route."
);
assert.ok(
  routerSource.includes('meta: { title: "官方消息", contentPage: "official-messages" }'),
  "Expected official messages route to use the official-messages content mode."
);

console.log("admin layout passed");
