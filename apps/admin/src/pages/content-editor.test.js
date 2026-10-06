import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ContentEditorPage.vue", import.meta.url), "utf8");

function expectIncludes(snippet) {
  assert.ok(source.includes(snippet), `Expected ContentEditorPage.vue to include: ${snippet}`);
}

const updateStatusStart = source.indexOf("async function updateStatus(status: SiteContentStatus)");
const setStatusCall = source.indexOf("contentApi.setStatus", updateStatusStart);

assert.ok(updateStatusStart >= 0, "Expected updateStatus function to exist");
assert.ok(setStatusCall > updateStatusStart, "Expected updateStatus to call contentApi.setStatus");
expectIncludes("const saved = await persistContent();");
expectIncludes("if (!saved) return;");
expectIncludes("applyDetail(saved);");
assert.ok(
  source.indexOf("const saved = await persistContent();", updateStatusStart) < setStatusCall,
  "Expected updateStatus to save current form before publishing status"
);
