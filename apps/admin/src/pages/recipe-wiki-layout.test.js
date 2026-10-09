import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./RecipeWikiPage.vue", import.meta.url), "utf8");

test("keeps the Wiki queue visible while revision files use a separate drawer", () => {
  assert.match(page, /const revisionPreviewVisible = ref\(false\)/);
  assert.match(page, /<el-drawer[^>]*v-model="revisionPreviewVisible"/s);
  assert.match(page, /<div v-else v-loading="loading" class="table-panel">/);
  assert.doesNotMatch(page, /v-else-if="revisionPoolActive"/);
});
