import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "./AddToPlanSheet.vue"), "utf8");
const tagStyle = source.match(/\.sheet-section__tag \{([\s\S]*?)\n\}/)?.[1] ?? "";

for (const snippet of [
  "background: var(--color-state-warning-soft);",
  "color: var(--color-state-warning-text);",
  "border: 1rpx solid var(--color-state-warning-border);",
  "border-radius: var(--radius-pill);"
]) {
  assert.ok(tagStyle.includes(snippet), `Expected required tag style: ${snippet}`);
}

assert.ok(
  source.includes(".sheet-section__hint {\n  line-height: 1.6;"),
  "Expected the helper hint to keep its own style rule"
);

console.log("add to plan required tag styles passed");
