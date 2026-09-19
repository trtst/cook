import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const detailSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const skeletonSource = readFileSync(resolve(__dirname, "RecipeDetailSkeleton.vue"), "utf8");

assert.ok(detailSource.includes("const pageLoading = ref(true);"), "Expected page loading to start before page data preparation.");
assert.ok(detailSource.includes("pageLoading.value = false;"), "Expected page loading to end before the detail request skeleton.");
assert.match(
  detailSource,
  /loading\.value = true;[\s\S]*?pageLoading\.value = false;/,
  "Expected the detail request state to be ready before the page overlay is removed."
);
assert.match(
  detailSource,
  /pageLoading\.value = false;[\s\S]*?await nextTick\(\);[\s\S]*?void loadDetail\(true\)/,
  "Expected detail loading to start after the page loading render phase."
);
assert.match(
  detailSource,
  /kind\.value === "inspiration"[\s\S]*?recipeApi\.getRecipeDetail\(recipeId\.value\)/,
  "Expected a private recipe detail to use the optional-auth readable detail request."
);
assert.doesNotMatch(
  detailSource,
  /if \(!canReadRecipe\(kind\.value, sessionStore\.isLoggedIn\)\) \{[\s\S]*?detail\.value = null;/,
  "Expected an unauthenticated private recipe to render its public content instead of an empty state."
);
assert.ok(!skeletonSource.includes(":deep("), "Expected detail skeleton styles to stay compatible with the mp-weixin WXSS compiler.");

for (const required of [
  'import Skeleton from "@/components/Skeleton/Skeleton.vue";',
  'class="recipe-detail-skeleton"',
  'class="recipe-detail-skeleton__cover"',
  'class="recipe-detail-skeleton__summary"',
  'class="recipe-detail-skeleton__section"',
  'recipe-detail-skeleton__steps'
]) {
  assert.ok(skeletonSource.includes(required), "Expected detail skeleton to include " + required + ".");
}

console.log("recipe detail loading contract passed");
