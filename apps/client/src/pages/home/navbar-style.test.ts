import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

assert.ok(source.includes(':show-left="false"'), "Expected home navbar not to render the default left icon.");
assert.ok(!source.includes("navbar-side-guard"), "Expected home navbar to rely on show-left=false for empty side collapse.");
assert.ok(source.includes("<template #navbar-center>"), "Expected home navbar greeting to stay in the center slot.");

console.log("home navbar style passed");
