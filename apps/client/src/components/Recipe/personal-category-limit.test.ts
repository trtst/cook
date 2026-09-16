import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sources = [
  resolve(__dirname, "AddToPrivateSheet.vue"),
  resolve(__dirname, "AddToPlanSheet.vue"),
  resolve(__dirname, "../../pages_meal/random/index.vue")
].map(path => readFileSync(path, "utf8"));

for (const source of sources) {
  assert.match(source, /maxlength="8"/);
  assert.doesNotMatch(source, /maxlength="4"/);
  assert.doesNotMatch(source, /最多4个字/);
}

console.log("personal category limit tests passed");
