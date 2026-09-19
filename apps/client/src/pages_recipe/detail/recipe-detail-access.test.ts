import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const detailSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const recipeApiSource = readFileSync(resolve(__dirname, "../../apis/recipe.ts"), "utf8");

assert.match(recipeApiSource, /getRecipeDetail\(recipeId: UUID\)[\s\S]*auth: "optional"/);
assert.match(detailSource, /recipeApi\.getRecipeDetail\(recipeId\.value\)/);
assert.doesNotMatch(
  detailSource,
  /if \(!canReadRecipe\(kind\.value, sessionStore\.isLoggedIn\)\) \{[\s\S]*?detail\.value = null;/
);
assert.match(detailSource, /const myPersonal = computed\(\(\) => myDetail\.value\?\.personal/);
assert.match(detailSource, /const isOwnedDetail = computed\(\(\) =>[\s\S]*?Boolean\(myPersonal\.value\)/);
assert.doesNotMatch(detailSource, /return "添加你的第一道私房菜";/);
assert.match(
  detailSource,
  /if \(sessionStore\.isLoggedIn && \(kind\.value === "inspiration" \|\| Boolean\(myPersonal\.value\)\)\) \{/,
  "Expected recipe history writes to skip a non-owner private recipe detail."
);

console.log("recipe detail access boundary passed");
