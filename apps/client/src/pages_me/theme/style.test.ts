import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "./index.vue"), "utf8");

assert.ok(
  source.includes('<TabBar class="theme-page__preview-tabbar" current="me" :interactive="false" :fixed="false" />'),
  "Expected theme preview to render the real TabBar in non-fixed preview mode."
);
assert.ok(!source.includes("justify-content: space-between;"), "Expected theme page to stop stretching preview and footer apart.");
assert.ok(source.includes(".theme-page__main {\n  flex: 1;"), "Expected theme main area to consume remaining page height.");
assert.ok(
  source.includes(".theme-page__preview {\n  position: relative;\n  flex: 0 0 auto;\n  margin-top: var(--space-lg);"),
  "Expected theme preview block to sit close to the preview TabBar."
);
assert.ok(
  !source.includes("padding-bottom: calc(var(--tabbar-shell-height) + env(safe-area-inset-bottom));"),
  "Expected legacy preview bottom spacer for the fixed TabBar to be removed."
);
assert.ok(
  source.includes(".theme-footer {\n  margin-top: var(--space-lg);\n  padding-bottom: 0;"),
  "Expected theme footer spacing to be tightened once preview TabBar is embedded."
);

console.log("theme page style passed");
