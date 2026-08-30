import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "./index.vue"), "utf8");

assert.ok(
  source.includes("paddingTop: `${navBarTotalHeight.value + 12}px`"),
  "Expected notification page top padding to follow the +12px page baseline."
);
assert.ok(!source.includes("paddingTop: `${navBarTotalHeight.value + 20}px`"), "Expected legacy +20px top padding to be removed.");

console.log("recommend page style passed");
