import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const detailSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");

assert.match(
  detailSource,
  /if \(inspirationDetail\.value\?\.category\?\.name\) return inspirationDetail\.value\.category\.name;/,
  "Expected inspiration recipe details to display their own category name."
);

console.log("recipe inspiration category display passed");
