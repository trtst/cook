import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "RichTextEditor.vue"), "utf8");

function expectIncludes(snippet) {
  assert.ok(source.includes(snippet), `Expected RichTextEditor.vue to include: ${snippet}`);
}

function expectExcludes(snippet) {
  assert.ok(!source.includes(snippet), `Expected RichTextEditor.vue to exclude: ${snippet}`);
}

expectIncludes("{ header: [2, 3, false] }");
expectIncludes('["bold", "underline", "blockquote"]');
expectIncludes('[{ list: "ordered" }, { list: "bullet" }]');
expectIncludes('["link", "image"]');
expectIncludes('["clean"]');
expectExcludes("{ header: [1, 2, 3, false] }");
expectExcludes('"italic"');
expectExcludes("{ align: [] }");
