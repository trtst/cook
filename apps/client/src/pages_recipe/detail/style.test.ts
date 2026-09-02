import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

assert.ok(!source.includes("<template #navbar-left>"), "Expected recipe detail navbar to use the default left button.");
assert.ok(!source.includes(':show-left="false"'), "Expected recipe detail navbar not to disable the default left button.");
assert.ok(!source.includes("detail-nav__back"), "Expected recipe detail navbar not to keep custom back button styles.");
assert.ok(!source.includes("function goBack()"), "Expected recipe detail navbar not to keep a custom back handler.");
assert.ok(source.includes(':navbar-center-visible="showAnchorTabs"'), "Expected recipe detail page to control whether Layout passes center slot.");
assert.ok(source.includes("<template #navbar-center>"), "Expected recipe detail navbar to keep the anchor content in the center slot.");
assert.ok(!source.includes('<template v-if="showAnchorTabs" #navbar-center>'), "Expected recipe detail navbar not to rely on page-level conditional slot creation.");
assert.ok(
  source.includes('<view class="detail-nav-tabs">'),
  "Expected recipe detail navbar center slot to render the anchor tabs without an empty wrapper."
);
assert.ok(!source.includes('navbar-layout="custom-left"'), "Expected recipe detail navbar not to stretch the left side.");
assert.ok(!source.includes('class="detail-nav"'), "Expected recipe detail navbar not to wrap back and anchors in the left slot.");

console.log("recipe detail style passed");
