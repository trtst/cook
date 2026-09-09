import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const recipesPage = fs.readFileSync(new URL("./RecipesPage.vue", import.meta.url), "utf8");

test("recipe categories keep the blocked tab after all regular categories", () => {
  const allIndex = recipesPage.indexOf('<span class="category-item__name">全部系统菜谱</span>');
  const regularCategoriesIndex = recipesPage.indexOf('v-for="item in categories"');
  const blockedIndex = recipesPage.indexOf('<span class="category-item__name">下架</span>');

  assert.ok(allIndex >= 0, "Expected the all recipes tab");
  assert.ok(regularCategoriesIndex > allIndex, "Expected regular categories after the all recipes tab");
  assert.ok(blockedIndex > regularCategoriesIndex, "Expected the blocked tab after regular categories");
});
