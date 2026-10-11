import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sources = [
  resolve(__dirname, "AddToPrivateSheet.vue"),
  resolve(__dirname, "../../pages_recipe/edit/index.vue")
].map(path => readFileSync(path, "utf8"));

for (const [index, source] of sources.entries()) {
  const categoryInput = source.match(/<input\b(?=[^>]*v-model="categoryDraftName")[^>]*\/>/)?.[0];
  const validation = source.match(/async function createCategory(?:Tag)?\([\s\S]*?\n\}/)?.[0];
  assert.ok(categoryInput, `missing personal category input in source ${index}`);
  assert.match(categoryInput, /maxlength="16"/);
  assert.ok(validation, `missing personal category validation in source ${index}`);
  assert.match(validation, /if \(name\.length > 16\)/);
  assert.match(validation, /分类最多16个字/);
  assert.doesNotMatch(categoryInput, /maxlength="8"|maxlength="4"/);
  assert.doesNotMatch(validation, /最多(?:8|4)个字/);
}

console.log("personal category limit tests passed");
