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

const tipsIndex = source.indexOf('<text class="tips-text">{{ detailContent.tips }}</text>');
const curatedIndex = source.indexOf('<text v-if="attributionText" class="detail-curated">{{ attributionText }}</text>');
const planLinksIndex = source.indexOf('<view v-if="primaryPlanLink" class="section section--plan-links">');
assert.ok(tipsIndex >= 0 && tipsIndex < curatedIndex && curatedIndex < planLinksIndex, "Expected curated attribution to follow tips and precede later detail sections.");
assert.ok(source.includes("const attributionName = computed(() => {"), "Expected recipe detail attribution to have one name source.");
assert.ok(source.includes('myDetail.value?.owner : inspirationDetail.value?.owner'), "Expected all recipe details to read their frozen owner summary.");
assert.ok(source.includes('?.nickname?.trim() || "";'), "Expected an empty owner nickname to hide attribution.");
assert.ok(!source.includes("curatedByName"), "Expected legacy curatedByName attribution to be removed.");

assert.ok(
  source.includes('<view class="summary-card__title-row">'),
  "Expected the recipe title and share action to share one aligned row."
);
assert.ok(
  source.includes('class="summary-card__share" open-type="share"'),
  "Expected sharing to remain available beside the recipe title."
);
assert.ok(
  source.includes('v-if="showReportEntry" class="detail-inline-actions__item"'),
  "Expected the report action to be the external recipe inline action."
);
assert.ok(
  !source.includes('class="summary-card__report-entry"'),
  "Expected the report action to leave the summary card."
);
assert.ok(
  !source.includes('<view class="detail-actions__text">分享</view>'),
  "Expected the bottom action bar not to duplicate sharing."
);
assert.ok(
  source.includes('<view id="detail-steps" class="section">\n                <view class="section__head">\n                  <view class="section__head-main">'),
  "Expected the step caption to share the left-aligned section heading group."
);
assert.ok(
  source.includes('v-if="showStickyActions"\n                    class="section__action"\n                    @click="openCookMode"'),
  "Expected cook mode to use the right-aligned section action treatment."
);
assert.ok(
  !source.includes('class="summary-card__cook-entry"'),
  "Expected cook mode to leave the recipe summary card."
);
assert.ok(
  source.includes('<view class="detail-inline-actions__text">炊火智厨</view>'),
  "Expected inline recipe detail actions to use the named cooking assistant."
);
assert.ok(
  source.includes('<view class="detail-actions__text">添加计划</view>'),
  "Expected the sticky recipe detail action to say 添加计划."
);
assert.ok(
  source.includes('<view class="detail-actions__text">炊火智厨</view>'),
  "Expected the sticky recipe detail action to use the named cooking assistant."
);
assert.ok(
  !source.includes('<view class="detail-actions__text">助手</view>'),
  "Expected the sticky recipe detail action not to use the generic assistant label."
);
assert.match(
  source,
  /\.danger\s*\{[\s\S]*?height:\s*90rpx;/,
  "Expected the recipe report submit button to use the standard sheet action height."
);

console.log("recipe detail style passed");
