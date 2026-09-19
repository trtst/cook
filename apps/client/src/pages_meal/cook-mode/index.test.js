const { createMealAssistantFixture } = require("../../test-utils/meal-assistant-fixture.js");
const { existsSync, readFileSync } = require("fs");
const { resolve } = require("path");
const nodeAssert = require("assert").strict;

const hasJestRuntime =
  (typeof process !== "undefined" && Boolean(process.env.JEST_WORKER_ID)) ||
  (typeof globalThis.describe === "function" && typeof globalThis.it === "function");
const hasAutomatorRuntime = hasJestRuntime && typeof globalThis.program !== "undefined";
const nodeTest = hasJestRuntime ? null : require("node:test");

if (!hasAutomatorRuntime && !hasJestRuntime) {
  globalThis.jest = { setTimeout() {} };
  globalThis.describe = () => {};
  globalThis.it = () => {};
  globalThis.beforeAll = () => {};
}

globalThis.jest?.setTimeout?.(30000);

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
}

async function waitForCookMode(page, expectedSourceTag, timeout = 8000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const state = await page.callMethod("automatorReadState");
    if (state && state.currentSourceTag === expectedSourceTag) return state;
    await page.waitFor(100);
  }

  throw new Error(`未在 ${timeout}ms 内等到做饭模式来源标签: ${expectedSourceTag}`);
}

describe("pages_meal/cook-mode/index", () => {
  let fixture;

  beforeAll(async () => {
    fixture = await createMealAssistantFixture();
  });

  it("菜谱进入做饭模式时只读取原始步骤，不读取助手流程", async () => {
    await clearSession();
    const page = await program.reLaunch(
      `/pages_meal/cook-mode/index?source=recipe&recipeId=${fixture.paidMissingRecipe.id}&kind=my&flow=original`
    );
    await page.callMethod("automatorApplySession", {
      token: fixture.paidSession.token,
      uid: fixture.paidSession.user.uid,
      expiresAt: fixture.paidSession.expiresAt
    });

    const initial = await waitForCookMode(page, "菜谱步骤");
    expect(initial.flowMode).toBe("original");
    expect(initial.canSwitchFlowMode).toBe(false);
    expect(initial.assistantStepCount).toBe(0);
    expect(initial.originalStepCount).toBeGreaterThan(0);
  });

  it("免费菜谱未生成建议时仍可按原始步骤进入做饭模式", async () => {
    await clearSession();
    const page = await program.reLaunch(
      `/pages_meal/cook-mode/index?source=recipe&recipeId=${fixture.freeRecipe.id}&kind=my&flow=original`
    );
    await page.callMethod("automatorApplySession", {
      token: fixture.freeSession.token,
      uid: fixture.freeSession.user.uid,
      expiresAt: fixture.freeSession.expiresAt
    });

    const state = await waitForCookMode(page, "菜谱步骤");
    expect(state.flowMode).toBe("original");
    expect(state.canSwitchFlowMode).toBe(false);
    expect(state.assistantStepCount).toBe(0);
    expect(state.originalStepCount).toBeGreaterThan(0);
  });
});

if (!hasAutomatorRuntime && nodeTest) {
  const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");
  const fontSource = readFileSync(resolve(__dirname, "../../assets/fonts/font.scss"), "utf8");
  const numberIconPath = resolve(__dirname, "../../components/NumberIcon/NumberIcon.vue");

  nodeTest("meal cook mode keeps original flow separate from the explicit assistant flow", () => {
    nodeAssert.match(pageSource, /mealApi\.getCookContext/);
    nodeAssert.match(pageSource, /mealApi\.getCookAssistant/);
    nodeAssert.match(pageSource, /parseFlowMode/);
    nodeAssert.match(pageSource, /isAssistantMode/);
    nodeAssert.match(pageSource, /loadPlanAssistantFlow/);
    nodeAssert.match(pageSource, /menuTabs/);
    nodeAssert.match(pageSource, /selectedDishIndex/);
    nodeAssert.match(pageSource, /setSelectedDish/);
    nodeAssert.match(pageSource, /currentDishSteps/);
    nodeAssert.doesNotMatch(pageSource, /flowModeOptions/);
  });

  nodeTest("recipe cook mode uses kind for the source endpoint, not ownership", () => {
    nodeAssert.match(pageSource, /if \(kind === "inspiration"\) \{[\s\S]*?return recipeApi\.getInspirationRecipe\(targetRecipeId\);/);
    nodeAssert.match(pageSource, /if \(kind === "collection"\) \{[\s\S]*?return recipeApi\.getCollectionRecipe\(targetRecipeId\);/);
    nodeAssert.match(pageSource, /return recipeApi\.getRecipeDetail\(targetRecipeId\);/);
    nodeAssert.doesNotMatch(pageSource, /return recipeApi\.getMyRecipe\(targetRecipeId\);/);
  });

  nodeTest("meal cook mode keeps the list header, mode switch, and multi-dish plan menu in flow", () => {
    nodeAssert.match(pageSource, /<Layout[\s\S]*?:class="\[themeClasses, 'cook-mode-layout', \{ 'cook-layout--immersive': isImmersive \}\]"[\s\S]*?full-screen/);
    nodeAssert.match(pageSource, /:navbar-placeholder="true"/);
    nodeAssert.match(pageSource, /:navbar-transparent="false"/);
    nodeAssert.match(pageSource, /<view class="cook-nav__main" :class="\{ 'cook-nav__main--immersive': isImmersive \}">/);
    nodeAssert.doesNotMatch(pageSource, /<template #navbar-right>/);
    nodeAssert.match(pageSource, /<text v-else class="cook-nav__title">\{\{ sourceTitle \}\}<\/text>/);
    nodeAssert.doesNotMatch(pageSource, /cook-nav__settings|cook-settings|settingsVisible|openSettings|SheetShell/);
    nodeAssert.match(pageSource, /<view class="cook-nav__mode-state cook-nav__mode-state--list">[\s\S]*?<view class="cook-nav__mode-dot" aria-hidden="true" \/>[\s\S]*?class="cook-nav__mode-label cook-nav__mode-label--immersive">沉浸模式<\/text>/);
    nodeAssert.match(pageSource, /<view class="cook-nav__mode-state cook-nav__mode-state--immersive">[\s\S]*?class="cook-nav__mode-label cook-nav__mode-label--list">列表模式<\/text>[\s\S]*?<view class="cook-nav__mode-dot" aria-hidden="true" \/>/);
    nodeAssert.match(pageSource, /class="cook-nav__mode-label cook-nav__mode-label--immersive">沉浸模式<\/text>/);
    nodeAssert.match(pageSource, /class="cook-nav__mode-label cook-nav__mode-label--list">列表模式<\/text>/);
    nodeAssert.doesNotMatch(pageSource, /icon-cook-mode-(immersive|list)|cook-nav__mode-icon/);
    nodeAssert.match(pageSource, /<view v-if="hasMenuTabs" class="cook-toolbar" :class="\{ 'cook-toolbar--immersive': isImmersive \}">/);
    nodeAssert.match(pageSource, /<scroll-view[\s\S]*?class="cook-toolbar__flow-scroll"/);
    nodeAssert.doesNotMatch(pageSource, /cook-toolbar__modes/);
    nodeAssert.doesNotMatch(pageSource, /floatingModesStyle/);
    nodeAssert.doesNotMatch(pageSource, /cook-slide__top-right/);
    nodeAssert.match(pageSource, /scroll-x/);
    nodeAssert.match(pageSource, /class="cook-toolbar__flow-scroll"/);
    nodeAssert.match(pageSource, /const hasMenuTabs = computed\(\(\) => sourceType\.value === "plan" && menuTabs\.value\.length > 1\);/);
    nodeAssert.match(pageSource, /const showMenuTabs = computed\(\(\) => !isImmersive\.value && hasMenuTabs\.value\);/);
    nodeAssert.match(pageSource, /\.cook-mode-layout :deep\(\.navbar__fixed\)\s*\{[\s\S]*?transition: background-color 280ms ease;/);
    nodeAssert.doesNotMatch(pageSource, /cook-toolbar__main/);
    nodeAssert.doesNotMatch(pageSource, /toolbarMeta/);
    nodeAssert.match(pageSource, /\.cook-mode-page,\s*\.cook-list-scroll\s*\{\s*height: 100%;/);
    nodeAssert.doesNotMatch(pageSource, /class="cook-tools"/);
    nodeAssert.doesNotMatch(pageSource, /class="cook-complete"/);
  });

  nodeTest("meal cook mode keeps the navbar fixed and fades its immersive dark surface locally", () => {
    nodeAssert.match(pageSource, /:navbar-placeholder="true"/);
    nodeAssert.match(pageSource, /:navbar-transparent="false"/);
    nodeAssert.match(pageSource, /:navbar-background-color="navbarBackgroundColor"/);
    nodeAssert.match(pageSource, /const navbarBackgroundColor = computed\(\(\) => isImmersive\.value \? "var\(--color-overlay-medium\)" : "var\(--color-page\)"\);/);
    nodeAssert.doesNotMatch(pageSource, /const navbarBackgroundColor = "var\(--cook-surface-bg\)";/);
    nodeAssert.match(pageSource, /\.cook-mode-layout :deep\(\.navbar__fixed\)[\s\S]*?transition: background-color 280ms ease;/);
    nodeAssert.match(pageSource, /\.cook-mode-layout :deep\(\.navbar__title\)[\s\S]*?transition: color 280ms ease;/);
    nodeAssert.match(pageSource, /\.cook-mode-page\s*\{[\s\S]*?background-color: var\(--page-warm-bg\);[\s\S]*?transition: background-color 280ms ease;/);
    nodeAssert.doesNotMatch(pageSource, /--cook-/);
    nodeAssert.match(pageSource, /\.cook-mode-page--immersive\s*\{[\s\S]*?background-color: var\(--color-overlay-medium\);/);
    nodeAssert.match(pageSource, /\.cook-mode-page--immersive\s+\.cook-slide\s*\{[\s\S]*?background-color: var\(--color-overlay-medium\);/);
    nodeAssert.doesNotMatch(pageSource, /theme-dark/);
  });

  nodeTest("meal cook mode shares semantic surfaces across the navbar, slide, and page", () => {
    nodeAssert.match(pageSource, /const navbarBackgroundColor = computed\(\(\) => isImmersive\.value \? "var\(--color-overlay-medium\)" : "var\(--color-page\)"\);/);
    nodeAssert.doesNotMatch(pageSource, /--cook-/);
    nodeAssert.match(pageSource, /\.cook-mode-page\s*\{[\s\S]*?background-color: var\(--page-warm-bg\);/);
    nodeAssert.match(pageSource, /\.cook-slide\s*\{[\s\S]*?background-color: var\(--page-warm-bg\);/);
    nodeAssert.match(pageSource, /\.cook-slide::after\s*\{[\s\S]*?background-color: transparent;/);
    nodeAssert.match(pageSource, /\.cook-mode-page--immersive\s+\.cook-slide\s*\{[\s\S]*?background-color: var\(--color-overlay-medium\);/);
    nodeAssert.doesNotMatch(pageSource, /\.cook-mode-page--immersive \.cook-slide::after\s*\{/);
    nodeAssert.match(pageSource, /\.cook-mode-page--immersive \.cook-slide--image::after,[\s\S]*?\.cook-mode-page--immersive \.cook-slide--mixed::after\s*\{[\s\S]*?background-color: var\(--color-overlay-scrim\);/);
  });

  nodeTest("meal cook mode keeps the alarm font icon mapping", () => {
    nodeAssert.match(fontSource, /\.icon-alarm::before\s*\{\s*content: "\\e6fa";/);
  });

  nodeTest("meal cook mode animates its menu indicator without controlling manual menu scroll", () => {
    nodeAssert.match(pageSource, /<view v-if="hasMenuTabs" class="cook-toolbar"[\s\S]*?<scroll-view[\s\S]*?scroll-x[\s\S]*?class="cook-toolbar__flow-scroll"/);
    nodeAssert.match(pageSource, /<view class="cook-toolbar__flow-list">[\s\S]*?class="cook-toolbar__flow-indicator"[\s\S]*?v-for="\(item, index\) in menuTabs"/);
    nodeAssert.match(pageSource, /:scroll-left="menuScrollTarget"/);
    nodeAssert.match(pageSource, /@scroll="handleMenuScroll"/);
    nodeAssert.match(pageSource, /class="cook-toolbar__flow-indicator"/);
    nodeAssert.match(pageSource, /:style="menuIndicatorStyle"/);
    nodeAssert.match(pageSource, /:id="`cook-menu-\$\{index\}`"/);
    nodeAssert.match(pageSource, /syncMenuVisual\(index, true\)/);
    nodeAssert.match(pageSource, /const menuScrollTarget = ref\(0\);/);
    nodeAssert.match(pageSource, /function handleMenuScroll[\s\S]*?menuScrollLeft\.value = scrollLeft;/);
    nodeAssert.match(pageSource, /\.cook-toolbar__flow-list\s*\{[\s\S]*?display: flex;[\s\S]*?min-width: 100%;[\s\S]*?width: max-content;[\s\S]*?padding: 8rpx;/);
    nodeAssert.match(pageSource, /\.cook-toolbar__flow-mode\s*\{[\s\S]*?flex: 1 0 auto;[\s\S]*?justify-content: center;/);
    nodeAssert.doesNotMatch(pageSource, /\.cook-toolbar__flow-mode\s*\{[\s\S]*?margin-right:/);
    nodeAssert.match(pageSource, /const menuInset = Math\.max\(0, tab\.top - container\.top\);/);
    nodeAssert.match(pageSource, /const tabLeft = Math\.max\(0, menuScrollLeft\.value \+ tab\.left - container\.left - menuInset\);/);
    nodeAssert.match(pageSource, /height: `\$\{tab\.height\}px`,/);
    nodeAssert.match(pageSource, /transform: `translate\(\$\{tabLeft\}px, 0\)`,/);
    nodeAssert.doesNotMatch(pageSource, /padding: 8rpx 50vw;/);
    nodeAssert.doesNotMatch(pageSource, /cook-toolbar__flow-modes/);
  });

  nodeTest("meal cook mode hides empty list steps without rendering regular-recipe completion controls", () => {
    nodeAssert.match(pageSource, /class="cook-step-list"/);
    nodeAssert.match(pageSource, /class="cook-step-card"/);
    nodeAssert.match(pageSource, /v-for="\(item, index\) in dish\.steps"/);
    nodeAssert.match(pageSource, /const visibleListSteps = computed/);
    nodeAssert.match(pageSource, /steps\.value\.filter\(item => Boolean\(item\.imageUrl \|\| item\.bodyText\)\)/);
    nodeAssert.match(pageSource, /class="cook-step-card__index-current/);
    nodeAssert.doesNotMatch(pageSource, /@click="toggleStepCompleted\(index\)"/);
    nodeAssert.doesNotMatch(pageSource, /class="cook-dish-complete"/);
    nodeAssert.doesNotMatch(pageSource, /toggleCurrentDishCompleted/);
    nodeAssert.doesNotMatch(pageSource, /CookDishProgress/);
    nodeAssert.doesNotMatch(pageSource, /cook-card__/);
    nodeAssert.doesNotMatch(pageSource, /cook-list__head/);
  });

  nodeTest("meal cook mode shows one dish at a time and switches dishes horizontally in list view", () => {
    nodeAssert.match(pageSource, /<scroll-view v-if="isSingleListFlow" scroll-y class="cook-list-scroll"/);
    nodeAssert.match(pageSource, /<swiper v-else class="cook-list-swiper" :current="selectedDishIndex"/);
    nodeAssert.match(pageSource, /v-for="dish in listDishes"/);
    nodeAssert.match(pageSource, /const listDishes = computed/);
    nodeAssert.match(pageSource, /const isSingleListFlow = computed\(\(\) => listDishes\.value\.length <= 1\);/);
    nodeAssert.match(pageSource, /function handleListSwiperChange/);
    nodeAssert.doesNotMatch(pageSource, /scrollListToDish/);
    nodeAssert.doesNotMatch(pageSource, /handleListScroll/);
  });

  nodeTest("cook modes keep one rendering structure and only vary step data", () => {
    nodeAssert.match(pageSource, /assistantRecipeVersionId/);
    nodeAssert.match(pageSource, /if \(flowMode\.value === "assistant"\)/);
    nodeAssert.match(pageSource, /!assistant\.unlocked \|\| !assistant\.assistant \|\| !assistant\.assistant\.steps\.length/);
    nodeAssert.match(pageSource, /切换到普通做饭/);
    nodeAssert.match(pageSource, /function switchToOriginal/);
    nodeAssert.match(pageSource, /<text v-if="item\.phase" class="cook-step-card__phase">/);
    nodeAssert.match(pageSource, /<view v-if="isAssistantMode && item\.durationText" class="cook-step-card__duration">/);
    nodeAssert.match(pageSource, /<view v-if="item\.phase" class="cook-slide__meta">/);
    nodeAssert.doesNotMatch(pageSource, /cook-timer|hasStepTimer|timerRemainingSeconds|timerRunning|timerCompleted|timerHandle|timerDisplay|startTimer|pauseTimer|resetTimer|stopTimer|formatTimer/);
    nodeAssert.doesNotMatch(pageSource, /autoAdvance|自动翻页/);
  });

  nodeTest("meal assistant cook mode builds dish labels from the immutable assistant snapshot", () => {
    nodeAssert.match(pageSource, /buildMealAssistantSteps\(assistant\.assistant\.dishes, assistant\.assistant\.steps/);
    nodeAssert.match(pageSource, /function buildMealAssistantSteps\(\s*dishes: MealCookAssistantDishSource\[\],\s*assistantSteps: MealCookAssistantStep\[\],/);
    nodeAssert.doesNotMatch(pageSource, /menuTabs\.value = assistant\.assistant\.dishes\s*\.slice\(\)\s*\.sort\(/);
  });

  nodeTest("cook mode does not retain the hidden settings flow", () => {
    nodeAssert.doesNotMatch(pageSource, /keepScreenOn|setKeepScreenOn|页面常亮/);
  });

  nodeTest("meal cook mode gives the list scroll a fixed-height viewport inside the flip face", () => {
    nodeAssert.match(pageSource, /\.cook-content--list\s*\{[\s\S]*?display: flex;[\s\S]*?height: 100%;[\s\S]*?min-height: 0;/);
    nodeAssert.match(pageSource, /\.cook-list-swiper\s*\{[\s\S]*?flex: 1;[\s\S]*?min-height: 0;/);
    nodeAssert.match(pageSource, /\.cook-list-scroll\s*\{[\s\S]*?height: 100%;[\s\S]*?min-height: 0;/);
  });

  nodeTest("meal cook mode aligns the immersive toolbar spacer with the navbar", () => {
    nodeAssert.match(pageSource, /const immersiveSteps = computed/);
    nodeAssert.match(pageSource, /:current="immersiveIndex"/);
    nodeAssert.match(pageSource, /v-for="\(item, index\) in immersiveSteps"/);
    nodeAssert.match(pageSource, /class="cook-slide__image" :src="item\.imageUrl" mode="widthFix"/);
    nodeAssert.match(pageSource, /<text v-if="isImmersive" class="cook-slide__tag">\{\{ currentStep\?\.dishTitle \}\}<\/text>/);
    nodeAssert.match(pageSource, /<text v-else class="cook-nav__title">\{\{ sourceTitle \}\}<\/text>/);
    nodeAssert.doesNotMatch(pageSource, /<view class="cook-slide__top-left">[\s\S]*?cook-slide__tag[\s\S]*?<\/view>/);
    nodeAssert.match(pageSource, /\.cook-slide\s*\{[\s\S]*?display: flex;[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/);
    nodeAssert.match(pageSource, /\.cook-slide__image\s*\{[\s\S]*?width: 100%;[\s\S]*?height: auto;/);
    nodeAssert.match(pageSource, /const isImmersive = computed\(\(\) => viewMode\.value === "swiper"\);/);
    nodeAssert.match(pageSource, /class="cook-mode-page" :class="\{ 'cook-mode-page--immersive': isImmersive \}"/);
    nodeAssert.match(pageSource, /:navbar-transparent="false"/);
    nodeAssert.match(pageSource, /:navbar-background-color="navbarBackgroundColor"/);
    nodeAssert.match(pageSource, /\.cook-mode-layout :deep\(\.navbar__fixed\)\s*\{[\s\S]*?transition: background-color 280ms ease;/);
    nodeAssert.match(pageSource, /<view v-if="hasMenuTabs" class="cook-toolbar" :class="\{ 'cook-toolbar--immersive': isImmersive \}">/);
    nodeAssert.match(pageSource, /const hasMenuTabs = computed\(\(\) => sourceType\.value === "plan" && menuTabs\.value\.length > 1\);/);
    nodeAssert.match(pageSource, /<view v-if="hasMenuTabs" class="cook-toolbar"[\s\S]*?<scroll-view[\s\S]*?class="cook-toolbar__flow-scroll"/);
    nodeAssert.doesNotMatch(pageSource, /const immersiveToolbarStyle = computed/);
    nodeAssert.doesNotMatch(pageSource, /height: "0px",/);
    nodeAssert.doesNotMatch(pageSource, /navBarTotalHeight\.value/);
    nodeAssert.match(pageSource, /\.cook-toolbar--immersive\s*\{[\s\S]*?opacity: 0;[\s\S]*?z-index: 0;[\s\S]*?pointer-events: none;/);
    nodeAssert.match(pageSource, /\.cook-toolbar--immersive\s*\{[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/);
    nodeAssert.doesNotMatch(pageSource, /\.cook-toolbar--immersive\s*\{[^}]*?(?:max-height|transform):/);
    nodeAssert.match(pageSource, /\.cook-slide__copy\s*\{[\s\S]*?padding: 24rpx 24rpx calc\(24rpx \+ env\(safe-area-inset-bottom\)\);/);
    nodeAssert.match(pageSource, /<view v-if="item\.phase" class="cook-slide__meta">/);
    nodeAssert.match(pageSource, /syncDishFromImmersiveStep\(nextIndex\)/);
    nodeAssert.match(pageSource, /findIndex\(item => \(item\.dishKeys\.length \? item\.dishKeys\.includes\(currentDish\.key\) : item\.dishKey === currentDish\.key\)\)/);
  });

  nodeTest("meal cook mode gives the current and total digit icons independent sizes", () => {
    nodeAssert.match(pageSource, /import NumberIcon from "@\/components\/NumberIcon\/NumberIcon\.vue";/);
    nodeAssert.match(pageSource, /<NumberIcon class="cook-slide__index-current" :value="getDishStepIndex\(index\) \+ 1" \/>/);
    nodeAssert.match(pageSource, /<NumberIcon class="cook-slide__index-total" :value="getDishStepCount\(index\)" \/>/);
    nodeAssert.match(pageSource, /\.cook-slide__index\s*\{\s*display: flex;[\s\S]*?color: var\(--color-overlay-text\);\s*font-size: 22rpx;/);
    nodeAssert.match(pageSource, /\.cook-slide__index\s*\{[\s\S]*?text-shadow: 0 2rpx 10rpx var\(--color-shadow-overlay\);/);
    nodeAssert.match(pageSource, /\.cook-slide__index-current\s*\{\s*font-size: 100rpx;\s*line-height: 80rpx;\s*font-style: italic;\s*\}/);
    nodeAssert.match(pageSource, /\.cook-slide__index-total\s*\{\s*font-size: 50rpx;\s*line-height: 40rpx;\s*\}/);
    nodeAssert.match(pageSource, /\.cook-slide__index-separator\s*\{\s*font-size: 50rpx;\s*line-height: 1;\s*margin: 0;\s*\}/);
    nodeAssert.match(pageSource, /\.cook-slide__tag\s*\{\s*color: var\(--color-overlay-text\);\s*\}/);
    nodeAssert.doesNotMatch(pageSource, /cook-slide__time/);
  });

  nodeTest("number icon renders every digit of a passed number", () => {
    nodeAssert.ok(existsSync(numberIconPath), "Expected NumberIcon component to exist");
    const numberIconSource = readFileSync(numberIconPath, "utf8");
    nodeAssert.match(numberIconSource, /value: number/);
    nodeAssert.match(numberIconSource, /String\(props\.value\)\.split\(""\)/);
    nodeAssert.match(numberIconSource, /v-for="\(digit, index\) in digits"/);
    nodeAssert.match(numberIconSource, /`icon-number-\$\{digit\}`/);
    nodeAssert.match(fontSource, /\.icon-number-0::before\s*\{\s*content: "\\e62a";/);
    nodeAssert.match(fontSource, /\.icon-number-1::before\s*\{\s*content: "\\e61a";/);
    nodeAssert.match(fontSource, /\.icon-number-2::before\s*\{\s*content: "\\e620";/);
    nodeAssert.match(fontSource, /\.icon-number-3::before\s*\{\s*content: "\\e621";/);
    nodeAssert.match(fontSource, /\.icon-number-4::before\s*\{\s*content: "\\e622";/);
    nodeAssert.match(fontSource, /\.icon-number-5::before\s*\{\s*content: "\\e623";/);
    nodeAssert.match(fontSource, /\.icon-number-6::before\s*\{\s*content: "\\e624";/);
    nodeAssert.match(fontSource, /\.icon-number-7::before\s*\{\s*content: "\\e627";/);
    nodeAssert.match(fontSource, /\.icon-number-8::before\s*\{\s*content: "\\e628";/);
    nodeAssert.match(fontSource, /\.icon-number-9::before\s*\{\s*content: "\\e629";/);
  });

  nodeTest("meal cook mode gives mixed steps independent image preview, copy expansion, and reading controls", () => {
    nodeAssert.match(pageSource, /class="cook-step-card__image" :src="item\.imageUrl" mode="widthFix" @click\.stop="previewDishImages\(dish\.steps, item\.imageUrl\)"/);
    nodeAssert.match(pageSource, /class="cook-slide__image" :src="item\.imageUrl" mode="widthFix" @click\.stop="previewStepImage\(item\.imageUrl\)"/);
    nodeAssert.match(pageSource, /class="cook-slide" :class="\[`cook-slide--\$\{item\.displayMode\}`, \{ 'cook-slide--reading': isMixedStepReading\(item\.id\) \}\]" @click="toggleMixedReading\(item\)"/);
    nodeAssert.match(pageSource, /class="cook-slide__copy" @click\.stop="toggleMixedCopy\(item\.id\)"/);
    nodeAssert.match(pageSource, /getMixedStepText\(item\)/);
    nodeAssert.match(pageSource, /v-if="isMixedTextTruncated\(item\)" class="cook-slide__copy-more"/);
    nodeAssert.match(pageSource, /const expandedMixedStepIds = ref<string\[\]>\(\[\]\);/);
    nodeAssert.match(pageSource, /const mixedReadingStepId = ref\(""\);/);
    nodeAssert.match(pageSource, /function previewStepImage\(imageUrl: string \| null\)/);
    nodeAssert.match(pageSource, /uniPlatform\.media\.previewImage\(\{ urls: \[imageUrl\], current: imageUrl \}\)/);
    nodeAssert.match(pageSource, /function previewDishImages\(dishSteps: CookStep\[\], current: string \| null\)/);
    nodeAssert.match(pageSource, /const urls = dishSteps\.map\(item => item\.imageUrl\)\.filter\(\(imageUrl\): imageUrl is string => Boolean\(imageUrl\)\);/);
    nodeAssert.match(pageSource, /uniPlatform\.media\.previewImage\(\{ urls, current \}\)/);
    nodeAssert.match(pageSource, /function toggleMixedCopy\(stepId: string\)/);
    nodeAssert.match(pageSource, /function toggleMixedReading\(step: CookStep\)/);
    nodeAssert.match(pageSource, /function handleSwiperChange[\s\S]*?mixedReadingStepId\.value = "";/);
    nodeAssert.doesNotMatch(pageSource, /<view class="cook-slide__mask"/);
    nodeAssert.match(pageSource, /\.cook-slide__copy::after\s*\{[\s\S]*?background: var\(--overlay-image-mask\);/);
    nodeAssert.match(pageSource, /\.cook-slide__copy::after\s*\{[\s\S]*?inset: 0;/);
    nodeAssert.doesNotMatch(pageSource, /\.cook-slide__copy::after\s*\{[\s\S]*?top: -180rpx;/);
    nodeAssert.match(pageSource, /\.cook-slide__copy::after\s*\{[\s\S]*?pointer-events: none;/);
    nodeAssert.match(pageSource, /\.cook-slide--mixed\.cook-slide--reading \.cook-slide__top\s*\{[\s\S]*?transform: translateY\(-/);
    nodeAssert.match(pageSource, /\.cook-slide--mixed\.cook-slide--reading \.cook-slide__copy\s*\{[\s\S]*?transform: translateY\(/);
  });

  nodeTest("meal cook mode does not reload a populated plan when an image preview returns", () => {
    nodeAssert.match(pageSource, /onShow\(\(\) => \{[\s\S]*?sourceType\.value === "plan"[\s\S]*?sessionStore\.isLoggedIn[\s\S]*?!loading\.value[\s\S]*?!originalSteps\.value\.length/);
  });

  nodeTest("meal cook mode flips list and immersive views in a fixed-height stage without animating layout", () => {
    nodeAssert.match(pageSource, /<view class="cook-content-stage" :class="\{ 'cook-content-stage--immersive': isImmersive \}">/);
    nodeAssert.match(pageSource, /class="cook-content-stage__flipper"/);
    nodeAssert.match(pageSource, /class="cook-content cook-content--list cook-content-stage__face" :class="\{ 'cook-content-stage__face--inactive': isImmersive \}"/);
    nodeAssert.match(pageSource, /class="cook-content cook-content--swiper cook-content-stage__face cook-content-stage__face--back" :class="\{ 'cook-content-stage__face--inactive': !isImmersive \}"/);
    nodeAssert.match(pageSource, /\.cook-content-stage__flipper\s*\{[\s\S]*?transition: transform 520ms/);
    nodeAssert.match(pageSource, /\.cook-content-stage--immersive \.cook-content-stage__flipper\s*\{[\s\S]*?transform: rotateY\(180deg\);/);
    nodeAssert.match(pageSource, /\.cook-content-stage__face\s*\{[\s\S]*?position: absolute;[\s\S]*?backface-visibility: hidden;/);
    nodeAssert.match(pageSource, /\.cook-content-stage__face--back\s*\{[\s\S]*?transform: rotateY\(180deg\);/);
    nodeAssert.match(pageSource, /\.cook-content-stage__face--inactive\s*\{[\s\S]*?pointer-events: none;/);
    nodeAssert.doesNotMatch(pageSource, /transition: height/);
  });

  nodeTest("meal cook mode only reduces plain-text steps after one hundred characters", () => {
    nodeAssert.match(pageSource, /:class="getPlainTextSizeClass\(item\.bodyText \|\| item\.title\)"/);
    nodeAssert.match(pageSource, /function getPlainTextSizeClass\(text: string\)/);
    nodeAssert.match(pageSource, /Array\.from\(text\.replace\(\/\\s\/g, ""\)\)\.length/);
    nodeAssert.match(pageSource, /if \(length > 100\) return "cook-slide__plain-text--compact";/);
    nodeAssert.doesNotMatch(pageSource, /cook-slide__plain-text--minimum/);
    nodeAssert.match(pageSource, /\.cook-slide__plain-text\s*\{[\s\S]*?font-size: 54rpx;/);
    nodeAssert.match(pageSource, /\.cook-slide__plain-text--compact\s*\{[\s\S]*?font-size: 46rpx;/);
  });

  nodeTest("meal cook mode keeps the fixed node-based mode switch and immersive step alignment", () => {
    nodeAssert.match(pageSource, /\.cook-nav__mode-toggle\s*\{[\s\S]*?position: relative;[\s\S]*?width: 150rpx;[\s\S]*?height: 48rpx;[\s\S]*?background: linear-gradient\([\s\S]*?background-size: 205%;[\s\S]*?transition:/);
    nodeAssert.match(pageSource, /\.cook-nav__mode-dot\s*\{[\s\S]*?transition: background-color 280ms ease;/);
    nodeAssert.match(pageSource, /\.cook-nav__mode-state\s*\{[\s\S]*?position: absolute;[\s\S]*?transition: opacity 220ms ease, transform 320ms ease;/);
    nodeAssert.match(pageSource, /function toggleViewMode\(\)[\s\S]*?setViewMode\(isImmersive\.value \? "list" : "swiper"\);/);
    nodeAssert.match(pageSource, /\.cook-nav__mode-toggle--immersive[\s\S]*?background-position: 100%;/);
    nodeAssert.match(pageSource, /\.cook-nav__mode-toggle--immersive \.cook-nav__mode-state--immersive\s*\{[\s\S]*?transform: translateX\(12rpx\);/);
    nodeAssert.doesNotMatch(pageSource, /\.cook-nav__mode-toggle::before|\.cook-nav__mode-icon|icon-cook-mode-(immersive|list)/);
    nodeAssert.match(pageSource, /\.cook-slide__top\s*\{[\s\S]*?top: 0;/);
    nodeAssert.doesNotMatch(pageSource, /\.cook-slide\s*\{[^}]*background:/);
  });

  nodeTest("meal cook mode gives the default list mode a subtle surface", () => {
    nodeAssert.match(pageSource, /background: linear-gradient\(to right, var\(--color-surface-muted\) 50%, var\(--color-overlay-control\) 50%\) no-repeat;/);
  });

  nodeTest("meal cook mode hides redundant source and dish labels in both views", () => {
    nodeAssert.doesNotMatch(pageSource, /<text class="cook-slide__source">\{\{ item\.sourceTag \}\}<\/text>/);
    nodeAssert.doesNotMatch(pageSource, /<text v-if="item\.dishTitle" class="cook-slide__dish">\{\{ item\.dishTitle \}\}<\/text>/);
    nodeAssert.doesNotMatch(pageSource, /<text class="cook-step-card__source">\{\{ item\.sourceTag \}\}<\/text>/);
    nodeAssert.doesNotMatch(pageSource, /<text v-if="item\.dishTitle" class="cook-step-card__dish">\{\{ item\.dishTitle \}\}<\/text>/);
    nodeAssert.doesNotMatch(pageSource, /cook-step-card__source|cook-step-card__dish/);
  });

  nodeTest("meal cook mode keeps assistant step phase and alarm duration in one list header row", () => {
    nodeAssert.strictEqual((pageSource.match(/class="cook-step-card__index-row"/g) || []).length, 2);
    nodeAssert.strictEqual((pageSource.match(/class="cook-step-card__phase"/g) || []).length, 2);
    nodeAssert.strictEqual((pageSource.match(/class="cook-step-card__duration"/g) || []).length, 2);
    nodeAssert.match(pageSource, /<view class="cook-step-card__index-row">[\s\S]*?<text class="cook-step-card__index">[\s\S]*?<\/text>[\s\S]*?<text v-if="item\.phase" class="cook-step-card__phase">[\s\S]*?<\/text>[\s\S]*?<view v-if="isAssistantMode && item\.durationText" class="cook-step-card__duration">[\s\S]*?<\/view>[\s\S]*?<\/view>/);
    nodeAssert.match(pageSource, /<text class="cookfont icon-alarm cook-step-card__duration-icon"[^>]*\/>[\s\S]*?<text>\{\{ item\.durationText \}\}<\/text>/);
    nodeAssert.doesNotMatch(pageSource, /建议时长/);
    nodeAssert.match(pageSource, /\.cook-step-card__index-row\s*\{[\s\S]*?display: flex;[\s\S]*?align-items: center;/);
    nodeAssert.match(pageSource, /\.cook-step-card__duration\s*\{[\s\S]*?margin-left: auto;/);
  });

  nodeTest("meal cook mode keeps only the right quote icon on plain-text immersive steps", () => {
    nodeAssert.doesNotMatch(pageSource, /icon-quote-left/);
    nodeAssert.match(pageSource, /<text v-if="item\.displayMode === 'text'" class="cookfont icon-quote-right cook-slide__quote cook-slide__quote--right"/);
    nodeAssert.match(pageSource, /\.cook-slide__quote\s*\{[\s\S]*?position: absolute;/);
    nodeAssert.doesNotMatch(pageSource, /\.cook-slide__quote--left\s*\{/);
    nodeAssert.match(pageSource, /\.cook-slide__quote--right\s*\{[\s\S]*?bottom:/);
    nodeAssert.doesNotMatch(pageSource, /cook-slide__plain-quote/);
    nodeAssert.match(fontSource, /\.icon-quote-right::before\s*\{\s*content: "\\ebb9";/);
  });

  nodeTest("meal cook mode leaves dish-completion persistence to a future cooking-assistant flow", () => {
    nodeAssert.doesNotMatch(pageSource, /COOK_DISH_PROGRESS_TTL_MS/);
    nodeAssert.doesNotMatch(pageSource, /cookDishProgress/);
    nodeAssert.doesNotMatch(pageSource, /loadCookDishProgress/);
    nodeAssert.doesNotMatch(pageSource, /uniPlatform\.storage/);
  });

  nodeTest("meal cook mode shows static duration only for assistant steps", () => {
    nodeAssert.doesNotMatch(pageSource, /cook-bottom/);
    nodeAssert.match(pageSource, /class="cook-step-card__duration"/);
    nodeAssert.match(pageSource, /item\.durationText/);
    nodeAssert.strictEqual((pageSource.match(/v-if="isAssistantMode && item\.durationText"/g) || []).length, 2);
    nodeAssert.doesNotMatch(pageSource, /v-if="item\.durationText"/);
    nodeAssert.doesNotMatch(pageSource, /cook-timer|startTimer|pauseTimer|resetTimer|timerRemainingSeconds|timerRunning|timerCompleted/);
    nodeAssert.doesNotMatch(pageSource, /toggleTimer/);
  });
}
