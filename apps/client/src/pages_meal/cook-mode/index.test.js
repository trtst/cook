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
      `/pages_meal/cook-mode/index?source=recipe&recipeId=${fixture.paidMissingRecipe.id}&kind=my`
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
      `/pages_meal/cook-mode/index?source=recipe&recipeId=${fixture.freeRecipe.id}&kind=my`
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

  nodeTest("meal cook mode consumes raw cook-context and does not load assistant snapshots", () => {
    nodeAssert.match(pageSource, /mealApi\.getCookContext/);
    nodeAssert.match(pageSource, /menuTabs/);
    nodeAssert.match(pageSource, /selectedDishIndex/);
    nodeAssert.match(pageSource, /setSelectedDish/);
    nodeAssert.match(pageSource, /currentDishSteps/);
    nodeAssert.doesNotMatch(pageSource, /mealApi\.getCookAssistant/);
    nodeAssert.doesNotMatch(pageSource, /hasAssistantFlow/);
    nodeAssert.doesNotMatch(pageSource, /flowModeOptions/);
  });

  nodeTest("meal cook mode keeps one floating mode switch and long-step scrolling in separate regions", () => {
    nodeAssert.match(pageSource, /<Layout[\s\S]*?:class="\[themeClasses, \{ 'cook-layout--immersive': isImmersive \}\]"[\s\S]*?full-screen/);
    nodeAssert.match(pageSource, /:navbar-placeholder="!isImmersive"/);
    nodeAssert.match(pageSource, /:navbar-transparent="isImmersive"/);
    nodeAssert.match(pageSource, /<view class="cook-nav__main" :class="\{ 'cook-nav__main--immersive': isImmersive \}">/);
    nodeAssert.doesNotMatch(pageSource, /<template #navbar-right>/);
    nodeAssert.match(pageSource, /<SheetShell\s+:visible="settingsVisible"\s+title="做饭设置"/);
    nodeAssert.match(pageSource, /class="cook-settings__screen-on"/);
    nodeAssert.match(pageSource, /<view class="cook-toolbar" :class="\{ 'cook-toolbar--immersive': isImmersive \}" :style="immersiveToolbarStyle">/);
    nodeAssert.match(pageSource, /class="cook-toolbar__modes cook-toolbar__modes--floating"/);
    nodeAssert.match(pageSource, /:style="floatingModesStyle"/);
    nodeAssert.doesNotMatch(pageSource, /cook-toolbar__modes--immersive/);
    nodeAssert.doesNotMatch(pageSource, /cook-slide__top-right/);
    nodeAssert.match(pageSource, /scroll-x/);
    nodeAssert.match(pageSource, /class="cook-toolbar__flow-scroll"/);
    nodeAssert.match(pageSource, /\.cook-mode-page,\s*\.cook-list-scroll\s*\{\s*height: 100%;/);
    nodeAssert.doesNotMatch(pageSource, /class="cook-tools"/);
    nodeAssert.doesNotMatch(pageSource, /class="cook-complete"/);
  });

  nodeTest("meal cook mode animates its menu indicator without controlling manual menu scroll", () => {
    nodeAssert.match(pageSource, /<scroll-view[\s\S]*?v-if="menuTabs\.length > 1"[\s\S]*?scroll-x[\s\S]*?class="cook-toolbar__flow-scroll"/);
    nodeAssert.match(pageSource, /:scroll-left="menuScrollTarget"/);
    nodeAssert.match(pageSource, /@scroll="handleMenuScroll"/);
    nodeAssert.match(pageSource, /class="cook-toolbar__flow-indicator"/);
    nodeAssert.match(pageSource, /:style="menuIndicatorStyle"/);
    nodeAssert.match(pageSource, /:id="`cook-menu-\$\{index\}`"/);
    nodeAssert.match(pageSource, /syncMenuVisual\(index, true\)/);
    nodeAssert.match(pageSource, /const menuScrollTarget = ref\(0\);/);
    nodeAssert.match(pageSource, /function handleMenuScroll[\s\S]*?menuScrollLeft\.value = scrollLeft;/);
    nodeAssert.match(pageSource, /\.cook-toolbar__flow-scroll\s*\{[\s\S]*?padding: 8rpx;/);
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
    nodeAssert.match(pageSource, /<swiper class="cook-list-swiper" :current="selectedDishIndex" :disable-touch="listDishes\.length < 2" @change="handleListSwiperChange">/);
    nodeAssert.match(pageSource, /v-for="dish in listDishes"/);
    nodeAssert.match(pageSource, /const listDishes = computed/);
    nodeAssert.match(pageSource, /function handleListSwiperChange/);
    nodeAssert.doesNotMatch(pageSource, /scrollListToDish/);
    nodeAssert.doesNotMatch(pageSource, /handleListScroll/);
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
    nodeAssert.match(pageSource, /<text v-else class="cook-nav__title">做饭模式<\/text>/);
    nodeAssert.doesNotMatch(pageSource, /<view class="cook-slide__top-left">[\s\S]*?cook-slide__tag[\s\S]*?<\/view>/);
    nodeAssert.match(pageSource, /\.cook-slide\s*\{[\s\S]*?display: flex;[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/);
    nodeAssert.match(pageSource, /\.cook-slide__image\s*\{[\s\S]*?width: 100%;[\s\S]*?height: auto;/);
    nodeAssert.match(pageSource, /const isImmersive = computed\(\(\) => viewMode\.value === "swiper"\);/);
    nodeAssert.match(pageSource, /class="cook-mode-page" :class="\{ 'cook-mode-page--immersive': isImmersive \}"/);
    nodeAssert.match(pageSource, /\.cook-layout--immersive :deep\(\.navbar__fixed\)\s*\{[\s\S]*?background: var\(--overlay-image-mask\);/);
    nodeAssert.match(pageSource, /<view class="cook-toolbar" :class="\{ 'cook-toolbar--immersive': isImmersive \}" :style="immersiveToolbarStyle">/);
    nodeAssert.match(pageSource, /const immersiveToolbarStyle = computed/);
    nodeAssert.match(pageSource, /navBarTotalHeight\.value/);
    nodeAssert.match(pageSource, /height: \`[^,]*px\`,/);
    nodeAssert.match(pageSource, /padding: "0",/);
    nodeAssert.match(pageSource, /boxSizing: "border-box"/);
    nodeAssert.match(pageSource, /\.cook-toolbar--immersive\s*\{[\s\S]*?opacity: 0;[\s\S]*?z-index: 0;[\s\S]*?pointer-events: none;/);
    nodeAssert.match(pageSource, /\.cook-toolbar--immersive\s*\{[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/);
    nodeAssert.doesNotMatch(pageSource, /\.cook-toolbar--immersive\s*\{[^}]*?(?:max-height|transform):/);
    nodeAssert.match(pageSource, /\.cook-slide__copy\s*\{[\s\S]*?padding: 24rpx 24rpx calc\(24rpx \+ env\(safe-area-inset-bottom\)\);/);
    nodeAssert.doesNotMatch(pageSource, /cook-slide__dish/);
    nodeAssert.match(pageSource, /syncDishFromImmersiveStep\(nextIndex\)/);
    nodeAssert.match(pageSource, /findIndex\(item => item\.dishKey === currentDish\.key\)/);
  });

  nodeTest("meal cook mode gives the current and total digit icons independent sizes", () => {
    nodeAssert.match(pageSource, /import NumberIcon from "@\/components\/NumberIcon\/NumberIcon\.vue";/);
    nodeAssert.match(pageSource, /<NumberIcon class="cook-slide__index-current" :value="getDishStepIndex\(index\) \+ 1" \/>/);
    nodeAssert.match(pageSource, /<NumberIcon class="cook-slide__index-total" :value="getDishStepCount\(index\)" \/>/);
    nodeAssert.match(pageSource, /\.cook-slide__index\s*\{\s*display: flex;[\s\S]*?color: var\(--color-overlay-text\);\s*font-size: 22rpx;/);
    nodeAssert.match(pageSource, /\.cook-slide__index\s*\{[\s\S]*?text-shadow: 0 2rpx 10rpx var\(--color-shadow-overlay\);/);
    nodeAssert.match(pageSource, /\.cook-slide__index-current\s*\{\s*font-size: 100rpx;\s*line-height: 80rpx;\s*font-style: italic;\s*\}/);
    nodeAssert.match(pageSource, /\.cook-slide__index-total\s*\{\s*font-size: 50rpx;\s*line-height: 40rpx;\s*\}/);
    nodeAssert.match(pageSource, /\.cook-slide__index-separator\s*\{\s*font-size: 50rpx;\s*line-height: 1;\s*margin: 0 10rpx 0 -10rpx;\s*\}/);
    nodeAssert.match(pageSource, /\.cook-slide__tag,\s*\.cook-slide__time\s*\{[\s\S]*?padding: 8rpx 16rpx;[\s\S]*?border-radius: 999rpx;[\s\S]*?background: var\(--color-overlay-control\);/);
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

  nodeTest("meal cook mode keeps the manually tuned floating switch and immersive step alignment", () => {
    nodeAssert.match(pageSource, /\.cook-toolbar__mode\s*\{[\s\S]*?padding: 8rpx 16rpx;[\s\S]*?border-radius: var\(--radius-pill\);/);
    nodeAssert.match(pageSource, /\.cook-slide__top\s*\{[\s\S]*?top: 0;/);
    nodeAssert.doesNotMatch(pageSource, /\.cook-slide\s*\{[^}]*background:/);
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

  nodeTest("meal cook mode does not render a timer or step actions outside the cooking assistant", () => {
    nodeAssert.doesNotMatch(pageSource, /cook-bottom/);
    nodeAssert.doesNotMatch(pageSource, /timerRunning/);
    nodeAssert.doesNotMatch(pageSource, /toggleTimer/);
  });
}
