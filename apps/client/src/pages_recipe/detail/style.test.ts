import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const recipeApiSource = readFileSync(resolve(__dirname, "../../apis/recipe.ts"), "utf8");

assert.ok(!source.includes("<template #navbar-left>"), "Expected recipe detail navbar to use the default left button.");
assert.ok(!source.includes(':show-left="false"'), "Expected recipe detail navbar not to disable the default left button.");
assert.ok(!source.includes("detail-nav__back"), "Expected recipe detail navbar not to keep custom back button styles.");
assert.ok(!source.includes("function goBack()"), "Expected recipe detail navbar not to keep a custom back handler.");
assert.ok(source.includes(':navbar-center-visible="showAnchorTabs"'), "Expected recipe detail page to control whether Layout passes center slot.");
assert.ok(source.includes("<template #navbar-center>"), "Expected recipe detail navbar to keep the anchor content in the center slot.");
assert.ok(!source.includes('<template v-if="showAnchorTabs" #navbar-center>'), "Expected recipe detail navbar not to rely on page-level conditional slot creation.");
assert.ok(
  source.includes('<view class="detail-nav-tabs">'),
  "Expected recipe detail navbar center slot to render the anchor tabs without an empty wrapper."
);
assert.ok(!source.includes('navbar-layout="custom-left"'), "Expected recipe detail navbar not to stretch the left side.");
assert.ok(!source.includes('class="detail-nav"'), "Expected recipe detail navbar not to wrap back and anchors in the left slot.");
assert.ok(recipeApiSource.includes("keywords: string[];"), "Expected the public recipe content contract to include body keywords.");
assert.ok(source.includes('v-if="detailContent.keywords.length"'), "Expected the recipe detail to show keywords only when present.");
assert.ok(source.includes('v-for="item in detailContent.keywords"'), "Expected the recipe detail to render each body keyword.");
assert.ok(!source.includes(".wiki"), "Expected the recipe detail not to consume Wiki data.");
assert.ok(source.includes('import ImageLoader from "@/components/ImageLoader.vue";'), "Expected recipe detail to use the shared image loader.");
assert.ok(source.includes('<ImageLoader class="hero__image" :src="coverImageUrl" />'), "Expected the recipe detail cover to keep loading until its image succeeds.");
assert.ok(!source.includes('import ImageEmpty from "@/components/ImageEmpty.vue";'), "Expected recipe detail cover empty state to be owned by ImageLoader.");

assert.ok(
  source.includes('<text class="cookfont summary-card__report-entry-icon">&#xe710;</text>'),
  "Expected the recipe report entry to render the report icon before its label."
);
assert.ok(
  source.includes(".summary-card__report-entry-icon"),
  "Expected the recipe report icon to keep an explicit alignment style."
);
assert.match(
  source,
  /\.danger\s*\{[\s\S]*?height:\s*90rpx;/,
  "Expected the recipe report submit button to use the standard sheet action height."
);

console.log("recipe detail style passed");
