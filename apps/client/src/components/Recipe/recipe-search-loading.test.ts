import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "RecipeSearchLoading.vue"), "utf8");

assert.ok(source.includes('class="recipe-search-loading__loader"'));
assert.ok(source.includes('class="recipe-search-loading__pan-wrapper"'));
assert.ok(source.includes('class="recipe-search-loading__food"'));
assert.ok(source.includes("animation: recipe-search-loading-cooking 1.7s infinite"));
assert.ok(!source.includes("cooking-loading.gif"));

console.log("recipe search loading tests passed");
