import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, "index.vue"), "utf8");

assert.match(source, /<view v-if="hasQuickEntries" class="action-dock">/);
assert.doesNotMatch(source, /v-else-if="showQuickEntriesSkeleton"/);
assert.doesNotMatch(source, /const showQuickEntriesSkeleton = computed/);
assert.doesNotMatch(source, /class="dock-action dock-action--skeleton"/);

console.log("action dock visibility tests passed");
