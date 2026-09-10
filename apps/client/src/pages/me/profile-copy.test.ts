import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

assert.match(source, /"家的味道，都在这里了"/);
assert.doesNotMatch(source, /"登录后同步你的数据"/);

console.log("profile copy tests passed");
