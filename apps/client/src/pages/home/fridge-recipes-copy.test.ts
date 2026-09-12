import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

assert.ok(source.includes("按冰箱食材"), "Expected fridge recipe section to explain the ingredient source.");
assert.ok(source.includes("先看看能做的菜"), "Expected fridge recipe section to use the confirmed title.");
assert.ok(source.includes("换一换"), "Expected fridge recipe section action to be the refresh action.");
assert.ok(
  source.includes('@click="refreshFridgeRecipeRecommendations"'),
  "Expected fridge recipe section action to refresh fridge-based recommendations."
);
assert.ok(
  !source.includes('<text class="section-heading__action" @click="openRandomEntry">更多推荐</text>'),
  "Expected fridge recipe section action not to jump to random menu as 更多推荐."
);
assert.ok(source.includes("登录后看看能做什么"), "Expected guest empty state to explain login-gated fridge matching.");
assert.ok(!source.includes("去登录"), "Expected guest empty state not to render an extra login action.");
assert.ok(
  source.includes('<view v-if="sessionStore.isLoggedIn" class="fridge-empty__actions">'),
  "Expected fridge recipe empty actions to render only for logged-in users."
);
assert.ok(source.includes("先记几样冰箱食材"), "Expected empty state for logged-in users without fridge ingredients.");
assert.ok(source.includes("还没匹配到合适的菜"), "Expected empty state for logged-in users with unmatched ingredients.");
assert.ok(source.includes(".section-heading__eyebrow"), "Expected fridge recipe section eyebrow to have local styling.");
assert.ok(source.includes(".fridge-empty__actions"), "Expected fridge recipe empty actions to have local styling.");
assert.ok(source.includes(".fridge-empty__button--primary"), "Expected fridge recipe empty primary action to have local styling.");
assert.ok(source.includes(".fridge-empty__button--secondary"), "Expected fridge recipe empty secondary action to have local styling.");
assert.ok(source.includes("family-recipe--skeleton"), "Expected fridge recipe skeleton items to use a dedicated spacing class.");
assert.ok(
  source.includes(".family-recipe--skeleton:not(:last-child)") && source.includes("margin-right: 44rpx;"),
  "Expected fridge recipe skeleton items to have wider spacing than loaded cards."
);
assert.ok(
  source.includes(".family-recipe--skeleton .family-recipe__skeleton-copy") && source.includes("margin-top: 18rpx;"),
  "Expected fridge recipe skeleton copy to keep spacing from the image placeholder."
);
assert.ok(
  source.includes('<ImageEmpty v-else class="family-recipe__image-empty" ratio="fill" />'),
  "Expected fridge recipe cards without a cover to use the shared recipe image empty state."
);
assert.ok(!source.includes("family-recipe__badges"), "Expected fridge recipe cards not to render clipped image badges.");
assert.ok(
  source.includes('const segments = [];') && !source.includes('item.durationText || "时长待补"'),
  "Expected fridge recipe metadata not to include a duration fallback."
);
assert.ok(source.includes("已配上${item.matchedIngredientCount}样"), "Expected complete matches to remain visible in recipe metadata.");

console.log("home fridge recipe copy tests passed");
