import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./RecipeLibraryStatisticsPage.vue", import.meta.url), "utf8");
const api = readFileSync(new URL("../apis/home-topics.ts", import.meta.url), "utf8");

test("missing recipe requests carry the selected dimension, value, and page", () => {
  assert.match(page, /homeTopicsApi\.getMissingRecipeStats\(\{/);
  assert.match(page, /dimension: queryDimension\.value/);
  assert.match(page, /value: missingFilterValue\.value/);
  assert.match(page, /page: missingPage\.value/);
  assert.match(page, /pageSize: missingPageSize\.value/);
  assert.match(api, /"\/admin\/home-topics\/statistics\/missing-recipes"/);
});

test("statistics actions open current recipes for editing and export selected full JSON", () => {
  assert.match(page, /router\.push\(\{ name: "recipe-detail", params: \{ recipeId \} \}\)/);
  assert.match(page, /recipeApi\.exportFullJson\(\{ recipeIds \}\)/);
  assert.match(page, /@click="showRecipeStats\('nutrition', 'HAS_ANALYSIS'\)"/);
  assert.match(page, /@click="showRecipeStats\('nutrition', item\.key\)"/);
});

test("snapshot rebuild refreshes the visible statistics", () => {
  assert.match(page, /homeTopicsApi\.rebuildRecipeStats\(createOperationId\(\)\)/);
  assert.match(page, /snapshot\.value = result\.snapshot/);
});

test("statistics labels expose the updated cuisine taxonomy", () => {
  assert.match(page, /LOCAL_SPECIAL: "地方风味"/);
  assert.match(page, /HOME_STYLE: "家常菜"/);
});
