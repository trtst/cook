import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "./index.vue"), "utf8");

assert.ok(!source.includes("TabBar"), "Expected the theme page to stop rendering a TabBar preview.");
assert.ok(!source.includes("TabBar 预览"), "Expected the TabBar preview copy to be removed.");
assert.ok(!source.includes("theme-page__preview"), "Expected the theme preview block to be removed.");
assert.ok(source.includes(".theme-page__main {\n  flex: 1;"), "Expected theme main area to consume remaining page height.");
assert.ok(
  !source.includes("padding-bottom: calc(var(--tabbar-shell-height) + env(safe-area-inset-bottom));"),
  "Expected legacy preview bottom spacer for the fixed TabBar to be removed."
);
assert.ok(
  source.includes(".theme-footer {\n  flex: 0 0 auto;\n  margin-top: auto;") && source.includes("env(safe-area-inset-bottom)"),
  "Expected the theme save button to stay at the page bottom and clear the safe area."
);
assert.ok(
  source.includes('await uniPlatform.feedback.toast({ title: "主题已保存", icon: "success" })'),
  "Expected confirmed theme persistence to show a success toast."
);

console.log("theme page style passed");
