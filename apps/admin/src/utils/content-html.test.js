import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "content-html.ts"), "utf8");
const bannedProcessName = ["norm", "alize"].join("");

function expectIncludes(snippet) {
  assert.ok(source.includes(snippet), `Expected content-html.ts to include: ${snippet}`);
}

function expectExcludes(snippet) {
  assert.ok(!source.includes(snippet), `Expected content-html.ts to exclude: ${snippet}`);
}

expectIncludes('"h2"');
expectIncludes('"h3"');
expectIncludes('"strong"');
expectIncludes('"b"');
expectIncludes('"u"');
expectIncludes('"blockquote"');
expectIncludes('"ul"');
expectIncludes('"ol"');
expectIncludes('"li"');
expectIncludes('"a"');
expectIncludes('"img"');
expectIncludes("resolveLinkHref");
expectIncludes("resolveImageSrc");
expectExcludes('"h1"');
expectExcludes('"em"');
expectExcludes('"i"');
expectExcludes('"s"');
expectExcludes(bannedProcessName);
