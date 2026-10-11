import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const detailSource = readFileSync(resolve(__dirname, "../../pages_recipe/detail/index.vue"), "utf8");
const privateSheetSource = readFileSync(resolve(__dirname, "AddToPrivateSheet.vue"), "utf8");
const recipeApiSource = readFileSync(resolve(__dirname, "../../apis/recipe.ts"), "utf8");
const savedListSource = readFileSync(resolve(__dirname, "../../pages_recipe/list/index.vue"), "utf8");

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
assert.ok(detailSource.includes("添加到私房菜"), "Expected recipe detail actions to say 添加到私房菜.");
assert.ok(privateSheetSource.includes("添加到私房菜"), "Expected the sheet to use the single add-to-private action.");
assert.ok(privateSheetSource.includes("已添加到私房菜"), "Expected the success toast to say 已添加到私房菜.");
assert.ok(privateSheetSource.includes("从私房菜移除"), "Expected the sheet to support removing an added inspiration.");
assert.ok(privateSheetSource.includes("选择个人分类"), "Expected the sheet to require a personal category.");
assert.match(privateSheetSource, /categoryId: selectedCategoryId\.value as UUID/);
assert.match(privateSheetSource, /const isDisabled = computed\(\(\) => submitting\.value \|\| categorySubmitting\.value \|\|/);
const savedQuery = recipeApiSource.match(/export interface SavedInspirationQuery(?:\s+extends [^{]+)?\{[\s\S]*?\n\}/)?.[0];
assert.ok(savedQuery, "Expected a dedicated saved inspiration query contract.");
assert.match(savedQuery, /categoryId\?: UUID;/, "Expected saved inspiration requests to expose a category filter.");
assert.match(recipeApiSource, /listSavedInspirations\(query: SavedInspirationQuery\)/);
assert.match(savedListSource, /categoryId: requestCategoryId \|\| undefined/);
assert.match(savedListSource, /item\.personalCategory\.name/, "Expected saved inspiration rows to show their selected personal category.");
assert.match(savedListSource, /mode\.value !== currentMode \|\| \(currentMode === "saved" && savedCategoryId\.value !== requestCategoryId\)/,
  "Expected in-flight list requests to reload after the selected mode or personal category changes.");
assert.match(savedListSource, /mode\.value !== currentMode \|\| \(currentMode === "saved" && loadedSavedCategoryId\.value !== savedCategoryId\.value\)/,
  "Expected pagination requests to reload after the selected mode or personal category changes.");

console.log("private recipe copy tests passed");
