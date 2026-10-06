import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./markdown-rich-text.ts", import.meta.url), "utf8");
const bannedProcessName = ["norm", "alize"].join("");

function expectIncludes(snippet) {
  assert.ok(source.includes(snippet), `Expected markdown-rich-text.ts to include: ${snippet}`);
}

function expectExcludes(snippet) {
  assert.ok(!source.includes(snippet), `Expected markdown-rich-text.ts to exclude: ${snippet}`);
}

expectIncludes("Math.min(Math.max(heading[1].length, 2), 3)");
expectIncludes("heading[1].length === 1");
expectIncludes("imageLinePattern");
expectIncludes("resolveImageSrc");
expectIncludes('"<strong>$1</strong>"');
expectIncludes('"$1"');
expectExcludes("<em>$1</em>");
expectExcludes(bannedProcessName);
