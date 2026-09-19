import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const detailSource = readFileSync(resolve(__dirname, "../../pages_recipe/detail/index.vue"), "utf8");
const privateSheetSource = readFileSync(resolve(__dirname, "AddToPrivateSheet.vue"), "utf8");

assert.equal(
  detailSource.match(/保存为私房菜/g),
  null,
  "Expected recipe detail actions not to use the old 保存为私房菜 wording."
);
assert.equal(
  privateSheetSource.match(/保存为私房菜|已保存为私房菜/g),
  null,
  "Expected the add-to-private sheet not to use the old save wording."
);
assert.ok(detailSource.includes("加到私房菜"), "Expected recipe detail actions to say 加到私房菜.");
assert.ok(privateSheetSource.includes("加到私房菜"), "Expected the add-to-private sheet to say 加到私房菜.");
assert.ok(privateSheetSource.includes("已加到私房菜"), "Expected the success toast to say 已加到私房菜.");

console.log("private recipe copy tests passed");
