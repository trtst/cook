import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "./index.vue"), "utf8");

assert.ok(
  source.includes("paddingTop: `${navBarTotalHeight.value + 12}px`"),
  "Expected notification page top padding to follow the +12px page baseline."
);
assert.ok(source.includes('title=""'), "Expected notification page to keep an empty Layout title.");
assert.ok(source.includes(':class="themeClasses"'), "Expected notification page Layout host to carry theme classes.");
assert.ok(source.includes("<template #navbar-center>"), "Expected notification navbar to render its title through a page-owned center slot.");
assert.ok(source.includes("notification-nav-title"), "Expected notification navbar title to have a local style hook.");
assert.ok(!source.includes("paddingTop: `${navBarTotalHeight.value + 20}px`"), "Expected legacy +20px top padding to be removed.");
assert.ok(source.includes(".notification-page {\n  display: flex;"), "Expected notification page to keep a flex layout.");
assert.ok(source.includes("height: 100%;"), "Expected notification page to occupy the full available height for scrolling.");
assert.ok(!source.includes("min-height: 100%;"), "Expected legacy min-height based notification layout to be removed.");
assert.ok(source.includes(".notification-scroll-wrap {\n  position: relative;\n  display: flex;"), "Expected notification scroll wrapper to be a flex container.");
assert.ok(source.includes(".notification-scroll {\n  flex: 1;"), "Expected notification scroll view to consume remaining height.");
assert.ok(source.includes("min-height: 0;"), "Expected notification scroll chain to explicitly allow shrinking for scrolling.");

console.log("recommend page style passed");
