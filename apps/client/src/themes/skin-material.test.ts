import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFile(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

function expectIncludes(source: string, snippet: string) {
  assert.ok(source.includes(snippet), `Expected file to include: ${snippet}`);
}

function expectExcludes(source: string, snippet: string) {
  assert.ok(!source.includes(snippet), `Expected file to exclude: ${snippet}`);
}

function expectSelectorIncludes(source: string, selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(match[1].includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

function expectSelectorExcludes(source: string, selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(!match[1].includes(snippet), `Expected selector ${selector} to exclude: ${snippet}`);
  }
}

const LEGACY_SECONDARY_OUTLINE = "box-shadow: inset 0 0 0 1rpx var(--button-secondary-outline);";

const themeVarsSource = readFile("../composables/theme-vars.ts");
const fallbackColorsSource = readFile("../styles/colors.scss");
const appleGlassSkinSource = readFile("./apple-glass/skins.scss");
const handdrawnFoodSkinSource = readFile("./handdrawn-food/skins.scss");
const warmCoupleSkinSource = readFile("./warm-couple/skins.scss");
const confirmSource = readFile("../components/Confirm/Confirm.vue");
const emptySource = readFile("../components/Empty/Empty.vue");
const imageFieldSource = readFile("../components/ImageField.vue");
const loginModalSource = readFile("../components/Login/LoginModal.vue");
const loginStylesSource = readFile("../components/Login/login.scss");
const eventScheduleSheetSource = readFile("../components/Meal/EventScheduleSheet.vue");
const participantManageSheetSource = readFile("../components/Meal/ParticipantManageSheet.vue");
const accountPageSource = readFile("../pages_me/account/index.vue");
const mePageSource = readFile("../pages/me/index.vue");
const fontSource = readFile("../assets/fonts/font.scss");
const reminderPageSource = readFile("../pages_me/reminder/index.vue");
const knowledgeListPageSource = readFile("../pages_me/knowledge-list/index.vue");
const homePageSource = readFile("../pages/home/index.vue");
const mealEventPageSource = readFile("../pages_meal/event/index.vue");
const assistantPageSource = readFile("../pages_meal/assistant/index.vue");
const pantryListPageSource = readFile("../pages_pantry/list/index.vue");
const pantryIndexPageSource = readFile("../pages_pantry/index/index.vue");
const pantryGapPageSource = readFile("../pages_pantry/gap/index.vue");
const pantryItemDetailPageSource = readFile("../pages_pantry/item-detail/index.vue");
const pantryListCompletePageSource = readFile("../pages_pantry/list-complete/index.vue");
const pantryListDetailPageSource = readFile("../pages_pantry/list-detail/index.vue");
const randomPageSource = readFile("../pages_meal/random/index.vue");
const randomBottomBarSource = readFile("../pages_meal/components/RandomBottomBar.vue");
const randomConditionBarSource = readFile("../pages_meal/components/RandomConditionBar.vue");
const randomGapPanelSource = readFile("../pages_meal/components/RandomGapPanel.vue");
const randomSlotCardSource = readFile("../pages_meal/components/RandomSlotCard.vue");
const recommendPageSource = readFile("../pages_me/recommend/index.vue");
const recommendDetailPageSource = readFile("../pages_me/recommend-detail/index.vue");
const knowledgeDetailPageSource = readFile("../pages_me/knowledge-detail/index.vue");
const phonePageSource = readFile("../pages_me/phone/index.vue");
const tastePageSource = readFile("../pages_me/taste/index.vue");
const medalDetailPageSource = readFile("../pages_me/medal-detail/index.vue");
const medalPageSource = readFile("../pages_me/medal/index.vue");
const pantryHistoryPageSource = readFile("../pages_pantry/history/index.vue");
const mealDetailPageSource = readFile("../pages_meal/detail/index.vue");
const mealPlanPageSource = readFile("../pages_meal/plan/index.vue");
const cookModePageSource = readFile("../pages_meal/cook-mode/index.vue");
const recipePageSource = readFile("../pages/recipe/index.vue");
const recipeListPageSource = readFile("../pages_recipe/list/index.vue");
const recipeDetailPageSource = readFile("../pages_recipe/detail/index.vue");
const recipeEditPageSource = readFile("../pages_recipe/edit/index.vue");
const themePageSource = readFile("../pages_me/theme/index.vue");
const ingredientUnitsPageSource = readFile("../pages_me/ingredient-units/index.vue");
const membershipCodePageSource = readFile("../pages_me/membership-code/index.vue");
const homeTopicPageSource = readFile("../pages_home/topic/index.vue");
const tableTopicPageSource = readFile("../pages_home/table-topic/index.vue");
const tableTopicDetailPageSource = readFile("../pages_home/table-topic-detail/index.vue");
const shoppingTargetSheetSource = readFile("../pages_pantry/components/ShoppingTargetSheet.vue");
const pantryItemEditPageSource = readFile("../pages_pantry/item-edit/index.vue");
const shareImportPageSource = readFile("../pages_share/import/index.vue");
const sharePreviewPageSource = readFile("../pages_share/preview/index.vue");
const shareMemoryPageSource = readFile("../pages_share/memory/index.vue");
const menuConfirmSheetSource = readFile("../components/Meal/MenuConfirmSheet.vue");
const shoppingListPickerSheetSource = readFile("../components/Shopping/ShoppingListPickerSheet.vue");
const planArrangeSheetSource = readFile("../components/PlanArrangeSheet.vue");
const addToPlanSheetSource = readFile("../components/Recipe/AddToPlanSheet.vue");
const addToPrivateSheetSource = readFile("../components/Recipe/AddToPrivateSheet.vue");
const recipeSearchBarSource = readFile("../components/Recipe/RecipeSearchBar.vue");
const sharePillButtonSource = readFile("../components/Share/SharePillButton.vue");
const inviteShareSheetSource = readFile("../components/Share/InviteShareSheet.vue");
const sheetShellSource = readFile("../components/Sheet/SheetShell.vue");
const textFieldSheetSource = readFile("../components/Sheet/TextFieldSheet.vue");
const tabbarSource = readFile("../components/TabBar/TabBar.vue");
const toastSource = readFile("../components/Toast/Toast.vue");

expectIncludes(themeVarsSource, '"--material-mask-filter"');
expectIncludes(themeVarsSource, '"--material-card-bg"');
expectIncludes(themeVarsSource, '"--material-card-accent-bg"');
expectIncludes(themeVarsSource, '"--material-card-border"');
expectIncludes(themeVarsSource, '"--material-card-filter"');
expectIncludes(themeVarsSource, '"--material-panel-bg"');
expectIncludes(themeVarsSource, '"--material-panel-border"');
expectIncludes(themeVarsSource, '"--material-panel-filter"');
expectIncludes(themeVarsSource, '"--material-tabbar-bg"');
expectIncludes(themeVarsSource, '"--material-tabbar-border"');
expectIncludes(themeVarsSource, '"--material-tabbar-filter"');
expectIncludes(themeVarsSource, '"--material-input-bg"');
expectIncludes(themeVarsSource, '"--material-input-border"');
expectIncludes(themeVarsSource, '"--material-input-shadow"');
expectIncludes(themeVarsSource, '"--material-input-filter"');
expectIncludes(themeVarsSource, '"--material-control-bg"');
expectIncludes(themeVarsSource, '"--material-control-border"');
expectIncludes(themeVarsSource, '"--material-control-shadow"');
expectIncludes(themeVarsSource, '"--material-control-filter"');
expectIncludes(themeVarsSource, '"--button-primary-border"');
expectIncludes(themeVarsSource, '"--button-primary-filter"');
expectIncludes(themeVarsSource, '"--button-secondary-border"');
expectIncludes(themeVarsSource, '"--button-secondary-filter"');
expectIncludes(themeVarsSource, '"--page-hero-mask-bg"');
expectIncludes(themeVarsSource, '"--page-hero-orb-bg"');
expectIncludes(themeVarsSource, '"--page-bottom-mask-image"');
expectIncludes(themeVarsSource, '"--page-cover-fresh-shell-bg"');
expectIncludes(themeVarsSource, '"--page-primary-fade-bg"');
expectIncludes(themeVarsSource, '"--page-secondary-soft-bg"');
expectIncludes(themeVarsSource, '"--page-overlay-veil-bg"');
expectIncludes(themeVarsSource, '"--page-overlay-veil-filter"');
expectIncludes(themeVarsSource, '"--page-backdrop-blur-filter"');
expectIncludes(themeVarsSource, '"--page-glow-cluster-filter"');
expectIncludes(themeVarsSource, '"--page-glow-cluster-start-bg"');
expectIncludes(themeVarsSource, '"--page-glow-cluster-end-bg"');
expectIncludes(themeVarsSource, '"--overlay-hero-banner-shade"');
expectIncludes(themeVarsSource, '"--color-cover-empty-warm-bg"');
expectIncludes(themeVarsSource, '"--color-illustration-panel-warm"');
expectIncludes(themeVarsSource, '"--color-illustration-panel-fresh"');
expectIncludes(themeVarsSource, '"--color-illustration-panel-accent"');
expectIncludes(themeVarsSource, '"--color-state-warning-card-bg"');
expectIncludes(themeVarsSource, '"--color-state-primary-card-bg"');
expectIncludes(themeVarsSource, '"--color-state-danger-card-bg"');
expectIncludes(themeVarsSource, '"--color-tag-primary-bg"');
expectIncludes(themeVarsSource, '"--color-tag-primary-text"');
expectIncludes(themeVarsSource, '"--color-tag-secondary-bg"');
expectIncludes(themeVarsSource, '"--color-tag-secondary-text"');
expectIncludes(themeVarsSource, '"--color-tag-success-bg"');
expectIncludes(themeVarsSource, '"--color-tag-success-text"');
expectIncludes(themeVarsSource, '"--color-tag-warning-bg"');
expectIncludes(themeVarsSource, '"--color-tag-warning-text"');
expectIncludes(themeVarsSource, '"--color-tag-danger-bg"');
expectIncludes(themeVarsSource, '"--color-tag-danger-text"');
expectIncludes(themeVarsSource, '"--color-state-success-base"');
expectIncludes(themeVarsSource, '"--color-state-success-soft"');
expectIncludes(themeVarsSource, '"--color-state-success-text"');
expectIncludes(themeVarsSource, '"--color-state-success-border"');
expectIncludes(themeVarsSource, '"--color-state-warning-base"');
expectIncludes(themeVarsSource, '"--color-state-warning-soft"');
expectIncludes(themeVarsSource, '"--color-state-warning-text"');
expectIncludes(themeVarsSource, '"--color-state-warning-border"');
expectIncludes(themeVarsSource, '"--color-state-danger-base"');
expectIncludes(themeVarsSource, '"--color-state-danger-soft"');
expectIncludes(themeVarsSource, '"--color-state-danger-text"');
expectIncludes(themeVarsSource, '"--color-state-danger-border"');
expectIncludes(themeVarsSource, '"--color-state-info-base"');
expectIncludes(themeVarsSource, '"--color-state-info-soft"');
expectIncludes(themeVarsSource, '"--color-state-info-text"');
expectIncludes(themeVarsSource, '"--color-state-info-border"');
expectIncludes(themeVarsSource, '"--color-state-disabled-base"');
expectIncludes(themeVarsSource, '"--color-state-disabled-soft"');
expectIncludes(themeVarsSource, '"--color-state-disabled-text"');
expectIncludes(themeVarsSource, '"--color-state-disabled-border"');
expectIncludes(themeVarsSource, '"--color-support-action"');
expectIncludes(themeVarsSource, '"--color-icon-accent"');

expectIncludes(fallbackColorsSource, "--material-mask-filter:");
expectIncludes(fallbackColorsSource, "--material-card-bg:");
expectIncludes(fallbackColorsSource, "--material-card-accent-bg:");
expectIncludes(fallbackColorsSource, "--material-card-border:");
expectIncludes(fallbackColorsSource, "--material-card-filter:");
expectIncludes(fallbackColorsSource, "--material-panel-bg:");
expectIncludes(fallbackColorsSource, "--material-panel-border:");
expectIncludes(fallbackColorsSource, "--material-panel-filter:");
expectIncludes(fallbackColorsSource, "--material-tabbar-bg:");
expectIncludes(fallbackColorsSource, "--material-tabbar-border:");
expectIncludes(fallbackColorsSource, "--material-tabbar-filter:");
expectIncludes(fallbackColorsSource, "--material-input-bg:");
expectIncludes(fallbackColorsSource, "--material-input-border:");
expectIncludes(fallbackColorsSource, "--material-input-shadow:");
expectIncludes(fallbackColorsSource, "--material-input-filter:");
expectIncludes(fallbackColorsSource, "--material-control-bg:");
expectIncludes(fallbackColorsSource, "--material-control-border:");
expectIncludes(fallbackColorsSource, "--material-control-shadow:");
expectIncludes(fallbackColorsSource, "--material-control-filter:");
expectIncludes(fallbackColorsSource, "--button-primary-border:");
expectIncludes(fallbackColorsSource, "--button-primary-filter:");
expectIncludes(fallbackColorsSource, "--button-secondary-border:");
expectIncludes(fallbackColorsSource, "--button-secondary-filter:");
expectIncludes(fallbackColorsSource, "--button-danger-bg:");
expectIncludes(fallbackColorsSource, "--button-danger-text:");
expectIncludes(fallbackColorsSource, "--button-danger-shadow:");
expectIncludes(fallbackColorsSource, "--button-danger-border:");
expectIncludes(fallbackColorsSource, "--button-danger-filter:");
expectIncludes(fallbackColorsSource, "--page-hero-mask-bg:");
expectIncludes(fallbackColorsSource, "--page-hero-orb-bg:");
expectIncludes(fallbackColorsSource, "--page-bottom-mask-image:");
expectIncludes(fallbackColorsSource, "--page-cover-fresh-shell-bg:");
expectIncludes(fallbackColorsSource, "--page-primary-fade-bg:");
expectIncludes(fallbackColorsSource, "--page-secondary-soft-bg:");
expectIncludes(fallbackColorsSource, "--page-edge-fade-bg:");
expectIncludes(fallbackColorsSource, "--page-ambient-primary-bg:");
expectIncludes(fallbackColorsSource, "--page-ambient-duo-bg:");

expectSelectorIncludes(mePageSource, ".quick-entry__icon-font", ['color: var(--color-text);']);
expectSelectorExcludes(mePageSource, ".quick-entry__icon-font", ["--color-icon-accent"]);
expectSelectorIncludes(mePageSource, ".service-row__icon-font", ['color: var(--color-text);']);
expectSelectorExcludes(mePageSource, ".service-row__icon-font", ["--color-icon-accent"]);
expectSelectorIncludes(mePageSource, ".knowledge-entry__icon-font", ['color: var(--color-text);']);
expectSelectorExcludes(mePageSource, ".knowledge-entry__icon-font", ["--color-icon-accent"]);
expectExcludes(mePageSource, 'class="service-row__description"');
expectExcludes(mePageSource, 'class="knowledge-entry__description"');
expectSelectorIncludes(mePageSource, ".service-row__title", [
  "color: var(--color-text);",
  "font-weight: var(--font-weight-regular);"
]);
expectSelectorExcludes(mePageSource, ".service-row__title", ["font-weight: var(--font-weight-semibold);"]);
expectSelectorIncludes(mePageSource, ".knowledge-entry__title", [
  "font-size: var(--font-size-md);",
  "font-weight: var(--font-weight-regular);"
]);
expectSelectorExcludes(mePageSource, ".knowledge-entry__title", ["font-weight: var(--font-weight-bold);"]);
expectSelectorIncludes(tabbarSource, ".tabbar__font-icon", ['color: var(--color-text-tertiary);']);
expectSelectorExcludes(tabbarSource, ".tabbar__font-icon", ["--color-icon-accent", "--color-primary"]);
expectSelectorIncludes(tabbarSource, ".tabbar__item--active .tabbar__font-icon", ['color: var(--color-text);']);
expectSelectorExcludes(tabbarSource, ".tabbar__item--active .tabbar__font-icon", ["--color-icon-accent", "--color-primary"]);
expectIncludes(fallbackColorsSource, "--page-hero-shell-bg:");
expectIncludes(fallbackColorsSource, "--page-overlay-veil-bg:");
expectIncludes(fallbackColorsSource, "--page-overlay-veil-filter:");
expectIncludes(fallbackColorsSource, "--page-backdrop-blur-filter:");
expectIncludes(fallbackColorsSource, "--page-glow-cluster-filter:");
expectIncludes(fallbackColorsSource, "--page-glow-cluster-start-bg:");
expectIncludes(fallbackColorsSource, "--page-glow-cluster-end-bg:");
expectIncludes(fallbackColorsSource, "--overlay-hero-banner-shade:");
expectIncludes(fallbackColorsSource, "--color-cover-empty-warm-bg:");
expectIncludes(fallbackColorsSource, "--color-illustration-panel-warm:");
expectIncludes(fallbackColorsSource, "--color-illustration-panel-fresh:");
expectIncludes(fallbackColorsSource, "--color-illustration-panel-accent:");
expectIncludes(fallbackColorsSource, "--shadow-illustration-dot:");
expectIncludes(fallbackColorsSource, "--color-state-warning-card-bg:");
expectIncludes(fallbackColorsSource, "--color-state-primary-card-bg:");
expectIncludes(fallbackColorsSource, "--color-state-danger-card-bg:");
expectIncludes(fallbackColorsSource, "--color-tag-primary-bg:");
expectIncludes(fallbackColorsSource, "--color-tag-primary-text:");
expectIncludes(fallbackColorsSource, "--color-tag-secondary-bg:");
expectIncludes(fallbackColorsSource, "--color-tag-secondary-text:");
expectIncludes(fallbackColorsSource, "--color-tag-success-bg:");
expectIncludes(fallbackColorsSource, "--color-tag-success-text:");
expectIncludes(fallbackColorsSource, "--color-tag-warning-bg:");
expectIncludes(fallbackColorsSource, "--color-tag-warning-text:");
expectIncludes(fallbackColorsSource, "--color-tag-danger-bg:");
expectIncludes(fallbackColorsSource, "--color-tag-danger-text:");
expectIncludes(fallbackColorsSource, "--color-state-success-base:");
expectIncludes(fallbackColorsSource, "--color-state-success-soft:");
expectIncludes(fallbackColorsSource, "--color-state-success-text:");
expectIncludes(fallbackColorsSource, "--color-state-success-border:");
expectIncludes(fallbackColorsSource, "--color-state-warning-base:");
expectIncludes(fallbackColorsSource, "--color-state-warning-soft:");
expectIncludes(fallbackColorsSource, "--color-state-warning-text:");
expectIncludes(fallbackColorsSource, "--color-state-warning-border:");
expectIncludes(fallbackColorsSource, "--color-state-danger-base:");
expectIncludes(fallbackColorsSource, "--color-state-danger-soft:");
expectIncludes(fallbackColorsSource, "--color-state-danger-text:");
expectIncludes(fallbackColorsSource, "--color-state-danger-border:");
expectIncludes(fallbackColorsSource, "--color-state-info-base:");
expectIncludes(fallbackColorsSource, "--color-state-info-soft:");
expectIncludes(fallbackColorsSource, "--color-state-info-text:");
expectIncludes(fallbackColorsSource, "--color-state-info-border:");
expectIncludes(fallbackColorsSource, "--color-state-disabled-base:");
expectIncludes(fallbackColorsSource, "--color-state-disabled-soft:");
expectIncludes(fallbackColorsSource, "--color-state-disabled-text:");
expectIncludes(fallbackColorsSource, "--color-state-disabled-border:");
expectIncludes(fallbackColorsSource, "--color-text-disabled:");
expectIncludes(fallbackColorsSource, "--color-icon-tertiary:");
expectIncludes(fallbackColorsSource, "--color-tag-neutral-bg:");
expectIncludes(fallbackColorsSource, "--color-tag-neutral-text:");
expectIncludes(fallbackColorsSource, "--color-support-info:");
expectIncludes(fallbackColorsSource, "--color-support-highlight:");
expectIncludes(fallbackColorsSource, "--color-support-notice:");
expectIncludes(fallbackColorsSource, "--color-support-action:");
expectIncludes(fallbackColorsSource, "--color-icon-accent:");
expectIncludes(fallbackColorsSource, "--button-primary-shadow: 0 3rpx 10rpx");
expectIncludes(fallbackColorsSource, "--shadow-card: 0 2rpx 8rpx");
expectIncludes(fallbackColorsSource, "--shadow-floating: 0 -2rpx 8rpx");
expectIncludes(fallbackColorsSource, "--shadow-tabbar: 0 2rpx 8rpx");

expectIncludes(appleGlassSkinSource, "--material-card-bg:");
expectIncludes(appleGlassSkinSource, "--material-card-border: transparent;");
expectIncludes(appleGlassSkinSource, "--material-card-filter:");
expectIncludes(appleGlassSkinSource, "--material-panel-bg:");
expectIncludes(appleGlassSkinSource, "--material-panel-border: transparent;");
expectIncludes(appleGlassSkinSource, "--material-panel-filter:");
expectIncludes(appleGlassSkinSource, "--material-tabbar-bg:");
expectIncludes(appleGlassSkinSource, "--material-tabbar-border: transparent;");
expectIncludes(appleGlassSkinSource, "--material-tabbar-filter:");
expectIncludes(appleGlassSkinSource, "--material-input-bg:");
expectIncludes(appleGlassSkinSource, "--material-input-border:");
expectIncludes(appleGlassSkinSource, "--material-input-shadow:");
expectIncludes(appleGlassSkinSource, "--material-input-filter:");
expectIncludes(appleGlassSkinSource, "--material-control-bg:");
expectIncludes(appleGlassSkinSource, "--material-control-border:");
expectIncludes(appleGlassSkinSource, "--material-control-shadow:");
expectIncludes(appleGlassSkinSource, "--material-control-filter:");
expectIncludes(appleGlassSkinSource, "--button-primary-border: transparent;");
expectIncludes(appleGlassSkinSource, "--button-primary-filter:");
expectIncludes(appleGlassSkinSource, "--button-secondary-border: transparent;");
expectIncludes(appleGlassSkinSource, "--button-secondary-filter:");
expectIncludes(appleGlassSkinSource, "--login-popup-sheet-border: transparent;");
expectIncludes(appleGlassSkinSource, "--login-popup-backdrop-filter:");
expectIncludes(appleGlassSkinSource, "--login-popup-sheet-filter:");
expectIncludes(handdrawnFoodSkinSource, "--login-popup-sheet-border: transparent;");
expectIncludes(warmCoupleSkinSource, "--login-popup-sheet-border: transparent;");

expectIncludes(confirmSource, "background: var(--material-card-bg);");
expectIncludes(confirmSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(confirmSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(confirmSource, "backdrop-filter: var(--button-primary-filter);");
expectExcludes(confirmSource, LEGACY_SECONDARY_OUTLINE);
expectSelectorExcludes(confirmSource, ".confirm-card", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(confirmSource, ".confirm-card__button--ghost", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorExcludes(confirmSource, ".confirm-card__button--primary", ["border: 1rpx solid var(--button-primary-border);"]);
expectIncludes(confirmSource, ".confirm-card__button--danger {");
expectIncludes(confirmSource, "background: var(--button-danger-bg);");
expectIncludes(confirmSource, "color: var(--button-danger-text);");
expectIncludes(confirmSource, "box-shadow: var(--button-danger-shadow);");
expectIncludes(confirmSource, "backdrop-filter: var(--button-danger-filter);");
expectSelectorExcludes(confirmSource, ".confirm-card__button--danger", ["border: 1rpx solid var(--color-danger-soft);"]);

expectIncludes(emptySource, "background: var(--material-card-bg);");
expectIncludes(emptySource, "box-shadow: var(--material-card-shadow);");
expectIncludes(emptySource, "backdrop-filter: var(--material-card-filter);");
expectSelectorExcludes(emptySource, ".empty-state", ["border: 1px solid var(--material-card-border);"]);
expectSelectorExcludes(emptySource, ".empty-state--art", ["border: 1rpx solid var(--material-card-border);"]);

expectIncludes(imageFieldSource, "background: var(--button-primary-bg);");
expectIncludes(imageFieldSource, "box-shadow: var(--button-primary-shadow);");
expectIncludes(imageFieldSource, "backdrop-filter: var(--button-primary-filter);");
expectSelectorExcludes(imageFieldSource, ".image-field__action", ["border: 1rpx solid var(--button-primary-border);"]);
expectSelectorIncludes(imageFieldSource, ".image-field--cover.image-field--empty", [
  "background: var(--page-cover-fresh-shell-bg);"
]);

expectIncludes(loginStylesSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(loginStylesSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(loginStylesSource, "backdrop-filter: var(--button-primary-filter);");
expectSelectorIncludes(loginStylesSource, ".login", [
  "background: var(--material-card-accent-bg);"
]);
expectSelectorExcludes(loginStylesSource, ".login", [
  "radial-gradient(circle at top left, var(--color-secondary-soft), transparent 32%)"
]);
expectSelectorExcludes(loginStylesSource, ".login", ["border: 1px solid var(--material-card-border);"]);
expectSelectorExcludes(loginStylesSource, ".login__button", ["border: 1rpx solid var(--button-primary-border);"]);
expectSelectorIncludes(loginModalSource, ".login-popup__backdrop", [
  "-webkit-backdrop-filter: var(--login-popup-backdrop-filter);",
  "backdrop-filter: var(--login-popup-backdrop-filter);"
]);
expectSelectorExcludes(loginModalSource, ".login-popup__backdrop", ["backdrop-filter: blur(24rpx) saturate(145%);"]);
expectSelectorIncludes(loginModalSource, ".login-popup__phone-card", [
  "box-shadow: var(--login-popup-sheet-shadow);",
  "-webkit-backdrop-filter: var(--login-popup-sheet-filter);",
  "backdrop-filter: var(--login-popup-sheet-filter);"
]);
expectSelectorExcludes(loginModalSource, ".login-popup__phone-card", ["border: 2rpx solid var(--login-popup-sheet-border);"]);
expectSelectorExcludes(loginModalSource, ".login-popup__phone-card", ["backdrop-filter: blur(28rpx) saturate(150%);"]);

expectIncludes(accountPageSource, "background: var(--material-card-bg);");
expectIncludes(accountPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(accountPageSource, "backdrop-filter: var(--material-card-filter);");
expectSelectorExcludes(accountPageSource, ".account-panel", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(mePageSource, ".profile-modal__button--ghost", ["border: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(mePageSource, ".profile-hero__frost", [
  "background: var(--page-hero-mask-bg);",
  "backdrop-filter: var(--material-mask-filter);"
]);
expectSelectorExcludes(mePageSource, ".profile-hero__frost", ["backdrop-filter: blur(10rpx);"]);
expectSelectorExcludes(mePageSource, ".profile-hero__frost", ["linear-gradient(180deg, var(--color-surface-mask-weak), var(--color-surface-mask-medium)),"]);
expectSelectorIncludes(mePageSource, ".profile-modal", [
  "-webkit-backdrop-filter: var(--page-overlay-veil-filter);",
  "backdrop-filter: var(--page-overlay-veil-filter);"
]);
expectSelectorExcludes(mePageSource, ".profile-modal", ["backdrop-filter: blur(24rpx) saturate(145%);"]);
expectSelectorIncludes(mePageSource, ".service-row__icon-wrap--membership", [
  "background: var(--color-support-notice);"
]);
expectSelectorExcludes(mePageSource, ".service-row__icon-wrap--membership", ["background: var(--color-primary-soft-fill-subtle);"]);
expectSelectorIncludes(mePageSource, ".service-row__icon-wrap--benefit", [
  "background: var(--color-support-info);"
]);
expectSelectorExcludes(mePageSource, ".service-row__icon-wrap--benefit", ["background: var(--color-surface-primary-panel-soft);"]);
expectExcludes(mePageSource, "service-row__icon-wrap--medal");
expectIncludes(mePageSource, 'title: "饭局"');
expectIncludes(mePageSource, 'iconClass: "icon-meal-event"');
expectIncludes(mePageSource, 'title: "计划"');
expectIncludes(mePageSource, 'iconClass: "icon-meal-plan"');
expectIncludes(mePageSource, 'title: "食材"');
expectIncludes(mePageSource, 'iconClass: "icon-pantry"');
expectIncludes(mePageSource, 'title: "我的口味"');
expectIncludes(mePageSource, 'iconClass: "icon-my-taste"');
expectIncludes(mePageSource, 'title: "食材与单位"');
expectIncludes(mePageSource, 'iconClass: "icon-ingredient-units"');
expectIncludes(mePageSource, 'title: "厨房准备"');
expectIncludes(mePageSource, 'iconClass: "icon-kitchen-prep"');
expectIncludes(mePageSource, 'title: "烹饪技巧"');
expectIncludes(mePageSource, 'iconClass: "icon-cooking-skills"');
expectIncludes(mePageSource, 'title: "食谱技巧"');
expectIncludes(mePageSource, 'iconClass: "icon-recipe-skills"');
expectIncludes(fontSource, '.icon-my-taste::before {\n    content: "\\e62f";\n}');
expectIncludes(fontSource, '.icon-ingredient-units::before {\n    content: "\\e721";\n}');
expectIncludes(fontSource, '.icon-kitchen-prep::before {\n    content: "\\e61e";\n}');
expectIncludes(fontSource, '.icon-cooking-skills::before {\n    content: "\\e61c";\n}');
expectIncludes(fontSource, '.icon-recipe-skills::before {\n    content: "\\e61d";\n}');
expectIncludes(fontSource, '.icon-meal-event::before {\n    content: "\\e794";\n}');
expectIncludes(fontSource, '.icon-meal-plan::before {\n    content: "\\e6e3";\n}');
expectIncludes(fontSource, '.icon-pantry::before {\n    content: "\\e797";\n}');

expectIncludes(reminderPageSource, "background: var(--material-card-bg);");
expectIncludes(reminderPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(reminderPageSource, "backdrop-filter: var(--material-card-filter);");
expectSelectorExcludes(reminderPageSource, ".reminder-card", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorIncludes(reminderPageSource, ".reminder-card__eyebrow", [
  "background: var(--color-support-notice);"
]);
expectSelectorExcludes(reminderPageSource, ".reminder-card__eyebrow", ["background: var(--color-primary-soft-fill);"]);

expectIncludes(knowledgeListPageSource, "background: var(--material-card-bg);");
expectIncludes(knowledgeListPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(knowledgeListPageSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(knowledgeListPageSource, "background: var(--button-secondary-bg);");
expectIncludes(knowledgeListPageSource, "backdrop-filter: var(--button-secondary-filter);");
expectSelectorExcludes(knowledgeListPageSource, ".knowledge-status", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(knowledgeListPageSource, ".knowledge-status__button", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorIncludes(knowledgeListPageSource, ".knowledge-hero__eyebrow", [
  "background: var(--color-support-notice);",
  "color: var(--color-text-secondary);"
]);
expectSelectorExcludes(knowledgeListPageSource, ".knowledge-hero__eyebrow", ["background: var(--color-primary-soft-fill-medium);"]);

expectIncludes(homePageSource, "background: var(--material-card-bg);");
expectIncludes(homePageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(homePageSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(homePageSource, "background: var(--material-tabbar-bg);");
expectIncludes(homePageSource, "box-shadow: var(--material-tabbar-shadow);");
expectIncludes(homePageSource, "backdrop-filter: var(--material-tabbar-filter);");
expectIncludes(homePageSource, "background: var(--button-primary-bg);");
expectIncludes(homePageSource, "backdrop-filter: var(--button-primary-filter);");
expectIncludes(homePageSource, "background: var(--button-secondary-bg);");
expectIncludes(homePageSource, "backdrop-filter: var(--button-secondary-filter);");
expectExcludes(homePageSource, "border: 1rpx solid var(--material-card-border);");
expectExcludes(homePageSource, "border: 1rpx solid var(--button-primary-border);");
expectExcludes(homePageSource, "border: 1rpx solid var(--button-secondary-border);");
expectSelectorExcludes(homePageSource, ".feature-card__art", ["box-shadow: inset 0 0 0 1rpx var(--color-border);"]);
expectSelectorExcludes(homePageSource, ".home-nav-backdrop", [
  "border-bottom: 1rpx solid var(--material-tabbar-border);"
]);
expectSelectorIncludes(homePageSource, ".hero-banner", [
  "box-shadow: var(--material-card-shadow);"
]);
expectSelectorIncludes(homePageSource, ".table-hero", [
  "background: var(--page-hero-shell-bg);"
]);
expectSelectorIncludes(homePageSource, ".table-hero::before", [
  "background: var(--page-hero-mask-bg);"
]);
expectSelectorIncludes(homePageSource, ".table-hero::after", [
  "background: var(--page-hero-orb-bg);"
]);
expectSelectorIncludes(homePageSource, ".hero-banner__shade", [
  "background: var(--overlay-hero-banner-shade);"
]);
expectSelectorIncludes(homePageSource, ".hero-banner__action", [
  "-webkit-backdrop-filter: var(--material-mask-filter);",
  "backdrop-filter: var(--material-mask-filter);"
]);
expectSelectorIncludes(homePageSource, ".feature-card--main", [
  "background: var(--color-illustration-panel-warm);"
]);
expectSelectorIncludes(homePageSource, ".feature-card--mint", [
  "background: var(--color-illustration-panel-fresh);"
]);
expectSelectorIncludes(homePageSource, ".feature-card--green", [
  "background: var(--color-illustration-panel-accent);"
]);
expectSelectorIncludes(homePageSource, ".pantry-panel", [
  "background: var(--color-illustration-panel-accent);"
]);
expectSelectorIncludes(homePageSource, ".family-recipe__visual--warm", [
  "background: var(--color-illustration-panel-warm);"
]);
expectSelectorIncludes(homePageSource, ".family-recipe__visual--fresh", [
  "background: var(--color-illustration-panel-fresh);"
]);
expectSelectorIncludes(homePageSource, ".family-recipe__visual--cool", [
  "background: var(--color-illustration-panel-accent);"
]);
expectSelectorIncludes(homePageSource, ".feature-card__mini-dot", [
  "box-shadow: var(--shadow-illustration-dot);"
]);
expectSelectorIncludes(homePageSource, ".dock-action__dot", [
  "box-shadow: var(--shadow-illustration-dot);"
]);
expectExcludes(homePageSource, "linear-gradient(180deg, var(--color-overlay-medium), var(--color-overlay-stage)),");
expectExcludes(homePageSource, "linear-gradient(145deg, var(--color-primary-soft) 0%, var(--color-surface-raised) 100%)");
expectExcludes(homePageSource, "linear-gradient(145deg, var(--color-surface-muted) 0%, var(--color-surface-raised) 100%)");
expectExcludes(homePageSource, "linear-gradient(145deg, var(--color-secondary-soft) 0%, var(--color-surface-raised) 100%)");
expectExcludes(homePageSource, "linear-gradient(180deg, var(--color-surface-mask-weak), var(--color-surface-mask-medium)),");
expectExcludes(homePageSource, "box-shadow: 6rpx -6rpx 0 -2rpx var(--color-secondary-halo);");

expectSelectorIncludes(mePageSource, ".profile-hero__mask", [
  "mask-image: var(--page-bottom-mask-image);",
  "-webkit-mask-image: var(--page-bottom-mask-image);"
]);
expectSelectorIncludes(mePageSource, ".profile-form__input", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(mePageSource, ".password-form__input", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(pantryIndexPageSource, ".pantry-hero::after", [
  "mask-image: var(--page-bottom-mask-image);",
  "-webkit-mask-image: var(--page-bottom-mask-image);"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".detail-hero::after", [
  "mask-image: var(--page-bottom-mask-image);",
  "-webkit-mask-image: var(--page-bottom-mask-image);"
]);
expectSelectorIncludes(pantryListCompletePageSource, ".complete-hero::after", [
  "mask-image: var(--page-bottom-mask-image);"
]);
expectExcludes(mePageSource, "radial-gradient(ellipse at 15% 100%");
expectExcludes(pantryIndexPageSource, "radial-gradient(ellipse at 14% 100%");
expectExcludes(pantryListDetailPageSource, "radial-gradient(ellipse at 15% 100%");
expectExcludes(pantryListCompletePageSource, "radial-gradient(ellipse at 15% 100%");

expectSelectorIncludes(tableTopicPageSource, ".topic-page", [
  "background: var(--page-secondary-soft-bg);"
]);
expectSelectorIncludes(tableTopicPageSource, ".topic-card__cover--empty", [
  "background: var(--color-cover-empty-warm-bg);"
]);
expectSelectorIncludes(tableTopicPageSource, ".topic-hero__eyebrow", [
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(tableTopicPageSource, ".topic-state--error", [
  "color: var(--color-state-danger-text);"
]);
expectSelectorIncludes(tableTopicPageSource, ".topic-card__empty-text", [
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(tableTopicDetailPageSource, ".topic-page", [
  "background: var(--page-secondary-soft-bg);"
]);
expectSelectorIncludes(tableTopicDetailPageSource, ".topic-hero__cover--empty", [
  "background: var(--color-cover-empty-warm-bg);"
]);
expectSelectorIncludes(tableTopicDetailPageSource, ".topic-state--error", [
  "color: var(--color-state-danger-text);"
]);
expectSelectorIncludes(tableTopicDetailPageSource, ".topic-hero__empty-text", [
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(tableTopicDetailPageSource, ".topic-panel__label", [
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(tableTopicDetailPageSource, ".topic-panel__joined", [
  "color: var(--color-state-success-text);"
]);
expectSelectorIncludes(tableTopicDetailPageSource, ".topic-panel__button--joined", [
  "background: var(--color-state-success-soft);",
  "color: var(--color-state-success-text);"
]);
expectSelectorIncludes(tableTopicDetailPageSource, ".topic-panel__link", [
  "background: var(--color-state-success-soft);",
  "color: var(--color-state-success-text);"
]);
expectExcludes(tableTopicPageSource, "radial-gradient(circle at top right, var(--color-secondary-soft), transparent 34%)");
expectExcludes(tableTopicPageSource, "linear-gradient(135deg, var(--color-surface-primary-panel-soft), var(--color-warning-soft-fill))");
expectExcludes(tableTopicDetailPageSource, "radial-gradient(circle at top right, var(--color-secondary-soft), transparent 34%)");
expectExcludes(tableTopicDetailPageSource, "linear-gradient(135deg, var(--color-surface-primary-panel-soft), var(--color-warning-soft-fill))");

expectIncludes(mealEventPageSource, "background: var(--material-card-bg);");
expectIncludes(mealEventPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(mealEventPageSource, "backdrop-filter: var(--material-card-filter);");
expectSelectorExcludes(mealEventPageSource, ".event-card", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorIncludes(mealEventPageSource, ".filter-chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorExcludes(mealEventPageSource, ".filter-chip--active", ["border-color: var(--color-primary);"]);
expectSelectorIncludes(mealEventPageSource, ".filter-chip--active .filter-chip__label,\n.filter-chip--active .filter-chip__count", [
  "color: var(--color-tag-primary-text);"
]);

expectIncludes(pantryListPageSource, "background: var(--material-card-bg);");
expectIncludes(pantryListPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(pantryListPageSource, "backdrop-filter: var(--material-card-filter);");
expectExcludes(pantryListPageSource, LEGACY_SECONDARY_OUTLINE);
expectExcludes(pantryListPageSource, "border: 1rpx solid var(--material-card-border);");
expectExcludes(pantryListPageSource, "border: 1rpx solid var(--button-secondary-border);");

expectIncludes(pantryIndexPageSource, "border: 1rpx solid var(--material-input-border);");
expectIncludes(pantryIndexPageSource, "background: var(--material-input-bg);");
expectIncludes(pantryIndexPageSource, "box-shadow: var(--material-input-shadow);");
expectIncludes(pantryIndexPageSource, "backdrop-filter: var(--material-input-filter);");
expectIncludes(pantryIndexPageSource, "background: var(--material-control-bg);");
expectIncludes(pantryIndexPageSource, "box-shadow: var(--material-control-shadow);");
expectIncludes(pantryIndexPageSource, "backdrop-filter: var(--material-control-filter);");
expectIncludes(pantryIndexPageSource, "background: var(--material-card-bg);");
expectIncludes(pantryIndexPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(pantryIndexPageSource, "backdrop-filter: var(--material-card-filter);");
expectExcludes(pantryIndexPageSource, LEGACY_SECONDARY_OUTLINE);
expectSelectorIncludes(pantryIndexPageSource, ".home-nav-backdrop", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectSelectorExcludes(pantryIndexPageSource, ".home-nav-backdrop", ["backdrop-filter: saturate(180%) blur(22rpx);"]);
expectSelectorExcludes(pantryIndexPageSource, ".home-nav-backdrop", ["border-bottom: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(pantryIndexPageSource, ".pantry-hero", [
  "background: var(--page-hero-halo-bg);"
]);
expectSelectorIncludes(pantryIndexPageSource, ".item-card__placeholder", [
  "background: var(--page-cover-fresh-bg);"
]);
expectSelectorExcludes(pantryIndexPageSource, ".summary-strip,\n.quick-card,\n.notice,\n.item-card,\n.sheet-card", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(pantryIndexPageSource, ".sheet-actions__button--cancel", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorExcludes(pantryIndexPageSource, ".filter-chip", ["border: 1rpx solid var(--material-control-border);"]);
expectSelectorIncludes(pantryIndexPageSource, ".filter-chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorExcludes(pantryIndexPageSource, ".filter-chip--active", ["border-color: var(--color-primary);"]);
expectSelectorIncludes(pantryIndexPageSource, ".filter-chip--active .filter-chip__count", [
  "color: var(--color-tag-primary-text);"
]);
expectExcludes(pantryGapPageSource, LEGACY_SECONDARY_OUTLINE);
expectExcludes(pantryItemDetailPageSource, LEGACY_SECONDARY_OUTLINE);
expectSelectorIncludes(pantryGapPageSource, ".notice", [
  "background: var(--color-state-warning-soft);",
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(pantryGapPageSource, ".target-card", [
  "background: var(--color-state-warning-soft);"
]);
expectSelectorIncludes(pantryGapPageSource, ".target-card__action", [
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(pantryGapPageSource, ".gap-section__toggle", [
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(pantryItemDetailPageSource, ".badge--warning", [
  "background: var(--color-tag-warning-bg);",
  "color: var(--color-tag-warning-text);"
]);
expectSelectorIncludes(pantryItemDetailPageSource, ".detail-nav-backdrop", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectSelectorExcludes(pantryItemDetailPageSource, ".detail-nav-backdrop", ["backdrop-filter: saturate(180%) blur(22rpx);"]);
expectSelectorExcludes(pantryItemDetailPageSource, ".detail-nav-backdrop", ["border-bottom: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(pantryItemDetailPageSource, ".action-button--accent", [
  "background: var(--color-state-warning-soft);"
]);
expectExcludes(pantryListCompletePageSource, LEGACY_SECONDARY_OUTLINE);
expectSelectorIncludes(pantryListCompletePageSource, ".complete-filter__item--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorExcludes(pantryListCompletePageSource, ".complete-filter__item--active", ["background: var(--color-primary-soft-fill-subtle);"]);
expectSelectorIncludes(pantryListCompletePageSource, ".quick-chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(pantryListCompletePageSource, ".quick-chip--active", ["background: var(--color-primary-soft-fill-subtle);"]);
expectSelectorIncludes(pantryListCompletePageSource, ".complete-filter", [
  "background: var(--material-control-bg);",
  "box-shadow: var(--material-control-shadow);",
  "backdrop-filter: var(--material-control-filter);"
]);
expectSelectorExcludes(pantryListCompletePageSource, ".complete-filter", ["backdrop-filter: saturate(180%) blur(18rpx);"]);
expectSelectorIncludes(pantryListCompletePageSource, ".complete-footer", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectSelectorExcludes(pantryListCompletePageSource, ".complete-footer", ["backdrop-filter: blur(12rpx);"]);
expectIncludes(pantryListDetailPageSource, "background: var(--material-card-bg);");
expectIncludes(pantryListDetailPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(pantryListDetailPageSource, "backdrop-filter: var(--material-card-filter);");
expectSelectorIncludes(pantryListDetailPageSource, ".detail-nav-backdrop", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectIncludes(pantryListDetailPageSource, "background: var(--button-primary-bg);");
expectIncludes(pantryListDetailPageSource, "backdrop-filter: var(--button-primary-filter);");
expectIncludes(pantryListDetailPageSource, "background: var(--button-secondary-bg);");
expectIncludes(pantryListDetailPageSource, "backdrop-filter: var(--button-secondary-filter);");
expectExcludes(pantryListDetailPageSource, LEGACY_SECONDARY_OUTLINE);
expectExcludes(pantryListDetailPageSource, "border: 1rpx solid var(--material-card-border);");
expectExcludes(pantryListDetailPageSource, "border: 1rpx solid var(--button-primary-border);");
expectExcludes(pantryListDetailPageSource, "border: 1rpx solid var(--button-secondary-border);");
expectSelectorIncludes(pantryListDetailPageSource, ".store-card", [
  "background: var(--color-state-warning-card-bg);"
]);
expectSelectorExcludes(pantryListDetailPageSource, ".store-card", [
  "inset 0 0 0 1rpx"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".store-card--finish,\n.store-card--done", [
  "background: var(--color-state-primary-card-bg);"
]);
expectSelectorExcludes(pantryListDetailPageSource, ".store-card--finish,\n.store-card--done", [
  "inset 0 0 0 1rpx"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".store-card--voided", [
  "background: var(--color-state-danger-card-bg);"
]);
expectSelectorExcludes(pantryListDetailPageSource, ".store-card--voided", [
  "inset 0 0 0 1rpx"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".detail-hero__tag--voided", [
  "background: var(--color-state-danger-soft);",
  "color: var(--color-state-danger-text);"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".summary-card__badge--shared", [
  "background: var(--color-state-info-soft);",
  "color: var(--color-state-info-text);"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".summary-card__badge--done", [
  "background: var(--color-state-warning-soft);",
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".summary-card__badge--voided", [
  "background: var(--color-state-danger-soft);",
  "color: var(--color-state-danger-text);"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".sheet-option--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorExcludes(pantryListDetailPageSource, ".sheet-option--active", ["background: var(--color-primary-soft-fill-subtle);"]);
expectSelectorIncludes(pantryListDetailPageSource, ".mini-pill--danger", [
  "background: var(--color-state-danger-soft);",
  "color: var(--color-state-danger-text);"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".item-swipe__action", [
  "background: var(--color-state-danger-soft);",
  "color: var(--color-state-danger-text);"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".manage-dock__action--danger", [
  "background: var(--color-state-danger-soft);",
  "box-shadow: var(--material-card-shadow);"
]);
expectSelectorExcludes(pantryListDetailPageSource, ".manage-dock__action--danger", [
  "inset 0 0 0 1rpx"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".manage-dock__action-icon--danger", [
  "color: var(--color-state-danger-text);"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".manage-dock__action-label--danger", [
  "color: var(--color-state-danger-text);"
]);
expectExcludes(pantryListDetailPageSource, "radial-gradient(circle at 100% 0%, var(--color-warning-halo) 0 26%, transparent 27%),");
expectExcludes(pantryListDetailPageSource, "linear-gradient(135deg, var(--color-warning-soft-fill) 0%, var(--color-surface) 100%)");
expectExcludes(pantryListDetailPageSource, "radial-gradient(circle at 100% 0%, var(--color-primary-halo) 0 26%, transparent 27%),");
expectExcludes(pantryListDetailPageSource, "linear-gradient(135deg, var(--color-primary-soft-fill-subtle) 0%, var(--color-surface) 100%)");
expectExcludes(pantryListDetailPageSource, "radial-gradient(circle at 100% 0%, var(--color-danger-halo) 0 26%, transparent 27%),");
expectExcludes(pantryListDetailPageSource, "linear-gradient(135deg, var(--color-danger-soft-fill) 0%, var(--color-surface) 100%)");
expectSelectorExcludes(pantryListDetailPageSource, ".detail-nav-backdrop", [
  "background: linear-gradient(180deg, var(--color-surface-mask-strong) 0%, var(--color-surface-mask-medium) 100%);"
]);

expectIncludes(randomPageSource, "background: var(--material-card-bg);");
expectIncludes(randomPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(randomPageSource, "backdrop-filter: var(--material-card-filter);");
expectSelectorIncludes(randomPageSource, ".random-nav-backdrop", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectSelectorExcludes(randomPageSource, ".random-nav-backdrop", ["backdrop-filter: saturate(180%) blur(22rpx);"]);
expectSelectorExcludes(randomPageSource, ".random-nav-backdrop", ["border-bottom: 1rpx solid var(--color-border);"]);
expectSelectorExcludes(randomPageSource, ".notice,\n.warning-card,\n.empty-card,\n.board-card", ["border: 1rpx solid var(--material-card-border);"]);

expectIncludes(randomConditionBarSource, "background: var(--material-card-bg);");
expectIncludes(randomConditionBarSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(randomConditionBarSource, "backdrop-filter: var(--material-card-filter);");
expectSelectorExcludes(randomConditionBarSource, ".condition-card", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorIncludes(randomBottomBarSource, ".bottom-bar", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectSelectorExcludes(randomBottomBarSource, ".bottom-bar", ["backdrop-filter: saturate(180%) blur(18rpx);"]);

expectIncludes(randomGapPanelSource, "background: var(--material-card-bg);");
expectIncludes(randomGapPanelSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(randomGapPanelSource, "backdrop-filter: var(--material-card-filter);");
expectSelectorExcludes(randomGapPanelSource, ".gap-panel", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorIncludes(randomGapPanelSource, ".gap-card__status--ok", [
  "background: var(--color-state-success-soft);",
  "color: var(--color-state-success-text);"
]);
expectSelectorIncludes(randomGapPanelSource, ".gap-card__status--partial,\n.gap-card__status--missing,\n.gap-card__status--unknown", [
  "background: var(--color-state-warning-soft);",
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(randomPageSource, ".warning-card__title", [
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(randomPageSource, ".plan-sheet__tips", [
  "background: var(--color-state-warning-soft);"
]);
expectSelectorIncludes(randomPageSource, ".plan-sheet__tips-text", [
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(randomSlotCardSource, ".tag-row__item", [
  "background: var(--color-tag-warning-bg);",
  "color: var(--color-tag-warning-text);"
]);
expectSelectorIncludes(randomSlotCardSource, ".slot-card__badge", [
  "background: var(--color-tag-primary-bg);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(randomSlotCardSource, ".slot-card__badge", ["background: var(--color-primary-soft);"]);
expectSelectorIncludes(randomSlotCardSource, ".constraint-chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(randomSlotCardSource, ".constraint-chip--active", ["background: var(--color-primary-soft-fill);"]);

expectSelectorIncludes(assistantPageSource, ".assistant-state--error", [
  "color: var(--color-state-danger-text);"
]);
expectSelectorIncludes(assistantPageSource, ".assistant-grid__item", [
  "background: var(--color-support-notice);"
]);
expectSelectorExcludes(assistantPageSource, ".assistant-grid__item", ["background: var(--color-primary-soft-fill-subtle);"]);
expectSelectorIncludes(assistantPageSource, ".assistant-banner", [
  "background: var(--color-state-warning-soft);"
]);
expectSelectorIncludes(assistantPageSource, ".assistant-banner__title", [
  "color: var(--color-state-warning-text);"
]);
expectIncludes(assistantPageSource, `.assistant-note {
  padding: 18rpx 22rpx;
  border-radius: 20rpx;
  background: var(--color-support-notice);
}`);
expectExcludes(assistantPageSource, `.assistant-note {
  padding: 18rpx 22rpx;
  border-radius: 20rpx;
  background: var(--color-primary-soft-fill-subtle);
}`);

expectIncludes(recommendPageSource, "background: var(--material-card-bg);");
expectIncludes(recommendPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(recommendPageSource, "backdrop-filter: var(--material-card-filter);");
expectExcludes(recommendDetailPageSource, LEGACY_SECONDARY_OUTLINE);
expectSelectorExcludes(recommendPageSource, ".category-list", ["border: 1rpx solid var(--material-card-border);"]);

expectIncludes(pantryHistoryPageSource, "background: var(--material-card-bg);");
expectIncludes(pantryHistoryPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(pantryHistoryPageSource, "backdrop-filter: var(--material-card-filter);");
expectSelectorExcludes(pantryHistoryPageSource, ".notice,\n.card", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorIncludes(pantryHistoryPageSource, ".filter-chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(pantryHistoryPageSource, ".filter-chip--active", ["background: var(--color-primary-soft);"]);
expectSelectorIncludes(knowledgeListPageSource, ".knowledge-scroll-wrap", [
  "background: var(--page-ambient-primary-bg);"
]);
expectSelectorIncludes(recommendPageSource, ".notification-page", [
  "background: var(--page-ambient-duo-bg);"
]);
expectSelectorIncludes(recommendPageSource, ".category-card__icon-shell--recommend", [
  "background: var(--color-illustration-panel-fresh);"
]);
expectSelectorExcludes(recommendPageSource, ".category-card__icon-shell--recommend", [
  "radial-gradient(circle at 18% 18%, var(--color-primary-halo) 0, transparent 58%)"
]);
expectSelectorIncludes(recommendPageSource, ".category-card__icon-shell--shopping", [
  "background: var(--color-illustration-panel-accent);"
]);
expectSelectorExcludes(recommendPageSource, ".category-card__icon-shell--shopping", [
  "radial-gradient(circle at 20% 20%, var(--color-secondary-halo) 0, transparent 54%)"
]);
expectSelectorIncludes(membershipCodePageSource, ".redeem-page", [
  "background: var(--page-ambient-duo-bg);"
]);
expectSelectorIncludes(membershipCodePageSource, ".redeem-page::after", [
  "background: var(--color-cover-empty-warm-bg);"
]);
expectSelectorExcludes(membershipCodePageSource, ".redeem-page::after", [
  "radial-gradient(circle at 24% 38%, var(--color-secondary-soft) 0, transparent 46%)"
]);
expectSelectorExcludes(membershipCodePageSource, ".redeem-page::after", ["filter: blur(8rpx);"]);
expectSelectorIncludes(membershipCodePageSource, ".redeem-card", [
  "background: var(--material-card-bg);",
  "box-shadow: var(--material-card-shadow);",
  "backdrop-filter: var(--material-card-filter);"
]);
expectSelectorExcludes(membershipCodePageSource, ".redeem-card", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(themePageSource, ".option-chip", ["border: 1rpx solid var(--material-control-border);"]);
expectSelectorIncludes(recommendDetailPageSource, ".recommend-card__status--pending", [
  "color: var(--color-state-warning-text);",
  "background: var(--color-state-warning-soft);"
]);
expectSelectorIncludes(recommendDetailPageSource, ".recommend-card__status--rejected", [
  "color: var(--color-state-danger-text);",
  "background: var(--color-state-danger-soft);"
]);
expectSelectorIncludes(recommendDetailPageSource, ".recommend-card__status--adopted", [
  "color: var(--color-state-success-text);",
  "background: var(--color-state-success-soft);"
]);
expectSelectorIncludes(recommendDetailPageSource, ".recommend-card__status--merged", [
  "color: var(--color-state-info-text);",
  "background: var(--color-state-info-soft);"
]);
expectSelectorIncludes(recommendDetailPageSource, ".recommend-card__advice", [
  "color: var(--color-state-warning-text);"
]);

expectIncludes(mealDetailPageSource, "background: var(--material-card-bg);");
expectIncludes(mealDetailPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(mealDetailPageSource, "backdrop-filter: var(--material-card-filter);");
expectSelectorIncludes(mealDetailPageSource, ".meal-footer", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectSelectorExcludes(mealDetailPageSource, ".meal-footer", ["backdrop-filter: blur(12rpx);"]);
expectSelectorIncludes(mealDetailPageSource, ".detail-nav-backdrop", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectExcludes(mealDetailPageSource, LEGACY_SECONDARY_OUTLINE);
expectSelectorExcludes(mealDetailPageSource, ".summary-card,\n.store-card", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(mealDetailPageSource, ".meal-panel", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(mealDetailPageSource, ".sheet-actions__button--cancel", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorIncludes(mealDetailPageSource, ".summary-card__badge--planned", [
  "background: var(--color-tag-warning-bg);",
  "color: var(--color-tag-warning-text);"
]);
expectSelectorIncludes(mealDetailPageSource, ".summary-card__badge--confirmed,\n.summary-card__badge--done", [
  "background: var(--color-tag-success-bg);",
  "color: var(--color-tag-success-text);"
]);
expectSelectorIncludes(mealDetailPageSource, ".summary-card__badge--cancelled", [
  "background: var(--color-tag-danger-bg);",
  "color: var(--color-tag-danger-text);"
]);
expectIncludes(mealDetailPageSource, `.store-card {
  margin-top: 18rpx;
  padding: 28rpx 30rpx;
  background: var(--color-state-warning-card-bg);
  box-shadow: var(--material-card-shadow);
}`);
expectIncludes(mealDetailPageSource, `.store-card--event {
  background: var(--color-state-primary-card-bg);
  box-shadow: var(--material-card-shadow);
}`);
expectSelectorIncludes(mealDetailPageSource, ".meal-hero__tag--accent", [
  "background: var(--color-state-warning-soft);",
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(mealDetailPageSource, ".store-card__step--current", [
  "background: var(--color-state-warning-soft);",
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(mealDetailPageSource, ".meal-panel--warning", [
  "background: var(--color-state-warning-soft);"
]);
expectSelectorIncludes(mealDetailPageSource, ".meal-menu-empty__action", [
  "background: var(--color-state-warning-soft);",
  "color: var(--color-state-warning-text);"
]);
expectSelectorIncludes(mealDetailPageSource, ".meal-hero__cover-empty", [
  "background: var(--page-cover-fresh-shell-bg);"
]);
expectSelectorIncludes(mealDetailPageSource, ".meal-hero--plan", [
  "background: var(--color-cover-empty-warm-bg);"
]);
expectSelectorExcludes(mealDetailPageSource, ".meal-hero--plan", [
  "radial-gradient(circle at 88% 18%, var(--color-primary-halo) 0, transparent 26%)"
]);
expectExcludes(mealDetailPageSource, "inset 0 0 0 1rpx var(--color-border-light)");
expectExcludes(mealDetailPageSource, "radial-gradient(circle at 100% 0%, var(--color-warning-halo) 0 26%, transparent 27%),");
expectExcludes(mealDetailPageSource, "linear-gradient(135deg, var(--color-warning-soft-fill) 0%, var(--material-card-bg) 100%)");
expectExcludes(mealDetailPageSource, "radial-gradient(circle at 100% 0%, var(--color-primary-halo) 0 26%, transparent 27%),");
expectExcludes(mealDetailPageSource, "linear-gradient(135deg, var(--color-primary-soft-fill-subtle) 0%, var(--material-card-bg) 100%)");
expectSelectorExcludes(mealDetailPageSource, ".detail-nav-backdrop", ["backdrop-filter: saturate(180%) blur(22rpx);"]);
expectSelectorExcludes(mealDetailPageSource, ".detail-nav-backdrop", ["border-bottom: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(mealDetailPageSource, ".meal-inline-action", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(mealDetailPageSource, ".meal-inline-action", ["background: var(--color-primary-soft-fill-subtle);"]);
expectIncludes(cookModePageSource, `.cook-slide__index,
.cook-slide__tag,
.cook-slide__time {
  color: var(--color-overlay-text);
  background: var(--color-overlay-control);
  -webkit-backdrop-filter: var(--material-mask-filter);
  backdrop-filter: var(--material-mask-filter);
}`);
expectExcludes(cookModePageSource, `.cook-slide__index,
.cook-slide__tag,
.cook-slide__time {
  color: var(--color-overlay-text);
  -webkit-backdrop-filter: blur(18rpx);
  backdrop-filter: blur(18rpx);
  background: var(--color-overlay-control);
}`);
expectSelectorIncludes(cookModePageSource, ".cook-complete", [
  "box-shadow: var(--shadow-floating);",
  "-webkit-backdrop-filter: var(--page-overlay-veil-filter);",
  "backdrop-filter: var(--page-overlay-veil-filter);"
]);
expectSelectorExcludes(cookModePageSource, ".cook-complete", ["border: 1rpx solid var(--color-overlay-control);"]);
expectSelectorExcludes(cookModePageSource, ".cook-complete", ["backdrop-filter: blur(22rpx);"]);

expectIncludes(mealPlanPageSource, "background: var(--material-card-bg);");
expectIncludes(mealPlanPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(mealPlanPageSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(mealPlanPageSource, "background: var(--button-primary-bg);");
expectIncludes(mealPlanPageSource, "backdrop-filter: var(--button-primary-filter);");
expectIncludes(mealPlanPageSource, "background: var(--button-secondary-bg);");
expectIncludes(mealPlanPageSource, "backdrop-filter: var(--button-secondary-filter);");
expectExcludes(mealPlanPageSource, LEGACY_SECONDARY_OUTLINE);
expectExcludes(mealPlanPageSource, "border: 1rpx solid var(--material-card-border);");
expectExcludes(mealPlanPageSource, "border: 1rpx solid var(--button-primary-border);");
expectExcludes(mealPlanPageSource, "border: 1rpx solid var(--button-secondary-border);");
expectSelectorIncludes(mealPlanPageSource, ".sheet-chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(mealPlanPageSource, ".sheet-chip--active", ["border-color: var(--color-primary);"]);

expectIncludes(recipeListPageSource, "background: var(--material-card-bg);");
expectIncludes(recipeListPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(recipeListPageSource, "backdrop-filter: var(--material-card-filter);");
expectSelectorExcludes(recipeListPageSource, ".card", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorIncludes(recipePageSource, ".filter-trigger-wrap", [
  "background: var(--page-edge-fade-bg);"
]);
expectSelectorIncludes(recipePageSource, ".filter-drawer", [
  "background: var(--material-panel-bg);",
  "box-shadow: var(--material-panel-shadow);",
  "backdrop-filter: var(--material-panel-filter);"
]);
expectSelectorIncludes(recipePageSource, ".category-chip--active,\n.filter-chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorExcludes(recipePageSource, ".category-chip--active,\n.filter-chip--active", ["border-color: var(--color-primary);"]);
expectSelectorIncludes(recipePageSource, ".category-chip--active .category-chip__name,\n.filter-chip--active", [
  "color: var(--color-tag-primary-text);"
]);

expectIncludes(recipeDetailPageSource, "background: var(--material-card-bg);");
expectIncludes(recipeDetailPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(recipeDetailPageSource, "backdrop-filter: var(--material-card-filter);");
expectSelectorIncludes(recipeDetailPageSource, ".detail-page", [
  "background: var(--page-ambient-duo-bg);"
]);
expectSelectorExcludes(recipeDetailPageSource, ".detail-page", [
  "radial-gradient(circle at top left, var(--color-secondary-soft) 0%, transparent 34%)"
]);
expectSelectorExcludes(recipeDetailPageSource, ".notice", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(recipeDetailPageSource, ".summary-card", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorIncludes(recipeDetailPageSource, ".plan-link-row", [
  "background: var(--material-card-bg);",
  "box-shadow: var(--material-card-shadow);",
  "backdrop-filter: var(--material-card-filter);"
]);
expectSelectorExcludes(recipeDetailPageSource, ".plan-link-row", ["border: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(recipeDetailPageSource, ".detail-actions", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectSelectorIncludes(recipeDetailPageSource, ".detail-actions-shell::after", [
  "backdrop-filter: var(--page-overlay-veil-filter);"
]);
expectSelectorExcludes(recipeDetailPageSource, ".detail-actions-shell::after", ["backdrop-filter: saturate(180%) blur(22rpx);"]);
expectSelectorExcludes(recipeDetailPageSource, ".detail-actions", ["border: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(recipeDetailPageSource, ".report-box", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(recipeDetailPageSource, ".report-picker", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(recipeDetailPageSource, ".hero__cover-fill", [
  "background: var(--page-cover-fresh-shell-bg);"
]);
expectSelectorIncludes(recipeDetailPageSource, ".chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(recipeDetailPageSource, ".chip--active", ["background: var(--color-primary-soft);"]);
expectSelectorExcludes(recipeEditPageSource, ".step-sort-card", ["border: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(recipeEditPageSource, ".sheet-creator__input", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(recipeEditPageSource, ".ingredient-choice--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorIncludes(recipeEditPageSource, ".ingredient-create__card--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorIncludes(recipeEditPageSource, ".bottom-bar", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectSelectorExcludes(recipeEditPageSource, ".bottom-bar", ["backdrop-filter: blur(18rpx);"]);
expectSelectorIncludes(recipeEditPageSource, ".step-sort__mask", [
  "background: var(--page-overlay-veil-bg);",
  "-webkit-backdrop-filter: var(--page-overlay-veil-filter);",
  "backdrop-filter: var(--page-overlay-veil-filter);"
]);
expectSelectorExcludes(recipeEditPageSource, ".step-sort__mask", ["backdrop-filter: blur(10rpx) saturate(145%);"]);
expectExcludes(recipeDetailPageSource, ".light {");

expectIncludes(themePageSource, "background: var(--material-card-bg);");
expectIncludes(themePageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(themePageSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(themePageSource, "background: var(--material-control-bg);");
expectIncludes(themePageSource, "box-shadow: var(--material-control-shadow);");
expectIncludes(themePageSource, "backdrop-filter: var(--material-control-filter);");
expectSelectorIncludes(themePageSource, ".theme-card__eyebrow", [
  "background: var(--color-support-notice);"
]);
expectSelectorExcludes(themePageSource, ".theme-card__eyebrow", ["background: var(--color-primary-soft-fill);"]);
expectSelectorIncludes(themePageSource, ".option-chip", [
  "background: var(--material-control-bg);",
  "box-shadow: var(--material-control-shadow);",
  "backdrop-filter: var(--material-control-filter);"
]);
expectSelectorIncludes(themePageSource, ".option-chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorExcludes(themePageSource, ".option-chip--active", ["border-color: var(--color-primary);"]);
expectSelectorExcludes(themePageSource, ".theme-hero", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(themePageSource, ".theme-card", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorIncludes(themePageSource, ".option-chip--active .option-chip__text", [
  "color: var(--color-tag-primary-text);"
]);

expectIncludes(homeTopicPageSource, "background: var(--material-tabbar-bg);");
expectIncludes(homeTopicPageSource, "box-shadow: var(--material-tabbar-shadow);");
expectIncludes(homeTopicPageSource, "backdrop-filter: var(--material-tabbar-filter);");
expectSelectorIncludes(homeTopicPageSource, ".topic-backdrop__image--empty", [
  "background: var(--page-primary-fade-bg);"
]);
expectSelectorIncludes(homeTopicPageSource, ".topic-backdrop__veil", [
  "background: var(--page-overlay-veil-bg);",
  "-webkit-backdrop-filter: var(--page-overlay-veil-filter);",
  "backdrop-filter: var(--page-overlay-veil-filter);"
]);
expectIncludes(homeTopicPageSource, `.topic-backdrop__blur {
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  filter: var(--page-backdrop-blur-filter);
  transform: scale(1.08);
}`);
expectSelectorExcludes(homeTopicPageSource, ".topic-backdrop__blur", ["filter: blur(28rpx);"]);
expectIncludes(homeTopicPageSource, `.topic-section::before {
  content: "";
  position: absolute;
  left: -168rpx;
  top: 96rpx;
  width: 360rpx;
  height: 520rpx;
  border-radius: 50%;
  pointer-events: none;
  filter: var(--page-glow-cluster-filter);
  z-index: 0;
  opacity: 0.92;
  background: var(--page-glow-cluster-start-bg);
}`);
expectIncludes(homeTopicPageSource, `.topic-section::after {
  content: "";
  position: absolute;
  right: -176rpx;
  top: 188rpx;
  width: 360rpx;
  height: 520rpx;
  border-radius: 50%;
  pointer-events: none;
  filter: var(--page-glow-cluster-filter);
  z-index: 0;
  opacity: 0.84;
  background: var(--page-glow-cluster-end-bg);
}`);
expectSelectorExcludes(homeTopicPageSource, ".topic-section::before", ["filter: blur(24rpx);"]);
expectSelectorExcludes(homeTopicPageSource, ".topic-section::after", ["filter: blur(24rpx);"]);
expectSelectorIncludes(homeTopicPageSource, ".sheet-creator__input", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectIncludes(homeTopicPageSource, "background: var(--material-card-bg);");
expectIncludes(homeTopicPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(homeTopicPageSource, "backdrop-filter: var(--material-card-filter);");
expectExcludes(homeTopicPageSource, "border: 1rpx solid var(--material-card-border);");
expectExcludes(homeTopicPageSource, "linear-gradient(180deg, var(--color-primary-soft) 0%, var(--color-page) 100%)");
expectExcludes(homeTopicPageSource, "linear-gradient(180deg, var(--color-surface-mask-medium) 0%, var(--color-surface-mask-strong) 58%, var(--color-page) 100%)");
expectExcludes(homeTopicPageSource, "radial-gradient(circle at 68% 14%, var(--color-primary-soft) 0%, transparent 34%)");
expectExcludes(homeTopicPageSource, "radial-gradient(circle at 34% 12%, var(--color-primary-soft) 0%, transparent 34%)");
expectSelectorExcludes(homeTopicPageSource, ".topic-nav-backdrop", [
  "border-bottom: 1rpx solid var(--material-tabbar-border);"
]);

expectIncludes(sharePreviewPageSource, "background: var(--material-card-bg);");
expectIncludes(sharePreviewPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(sharePreviewPageSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(sharePreviewPageSource, "background: var(--button-primary-bg);");
expectIncludes(sharePreviewPageSource, "backdrop-filter: var(--button-primary-filter);");
expectIncludes(sharePreviewPageSource, "background: var(--button-secondary-bg);");
expectIncludes(sharePreviewPageSource, "backdrop-filter: var(--button-secondary-filter);");
expectExcludes(sharePreviewPageSource, "border: 1rpx solid var(--material-card-border);");
expectExcludes(sharePreviewPageSource, "border: 1rpx solid var(--button-primary-border);");
expectExcludes(sharePreviewPageSource, "border: 1rpx solid var(--button-secondary-border);");
expectSelectorIncludes(sharePreviewPageSource, ".invite-footer__hint", [
  "background: var(--color-support-notice);"
]);
expectSelectorExcludes(sharePreviewPageSource, ".invite-footer__hint", ["background: var(--color-primary-soft-fill-subtle);"]);
expectSelectorIncludes(sharePreviewPageSource, ".invite-footer__hint-text", [
  "color: var(--color-text-secondary);"
]);
expectSelectorExcludes(sharePreviewPageSource, ".invite-footer__hint-text", ["color: var(--color-primary);"]);
expectSelectorIncludes(sharePreviewPageSource, ".meal-footer__countdown-box", [
  "background: var(--color-state-danger-soft);"
]);
expectSelectorIncludes(sharePreviewPageSource, ".invite-footer__error", [
  "color: var(--color-state-danger-text);"
]);

expectIncludes(shareMemoryPageSource, "background: var(--material-card-bg);");
expectIncludes(shareMemoryPageSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(shareMemoryPageSource, "backdrop-filter: var(--material-card-filter);");
expectSelectorIncludes(shareMemoryPageSource, ".memory-card", [
  "background: var(--material-card-accent-bg);"
]);
expectExcludes(shareMemoryPageSource, "border: 1rpx solid var(--material-card-border);");
expectIncludes(shareMemoryPageSource, "background: var(--button-primary-bg);");
expectIncludes(shareMemoryPageSource, "backdrop-filter: var(--button-primary-filter);");
expectIncludes(shareMemoryPageSource, "background: var(--button-secondary-bg);");
expectIncludes(shareMemoryPageSource, "backdrop-filter: var(--button-secondary-filter);");
expectExcludes(shareMemoryPageSource, "border: 1rpx solid var(--button-primary-border);");
expectExcludes(shareMemoryPageSource, "border: 1rpx solid var(--button-secondary-border);");
expectSelectorIncludes(shareMemoryPageSource, ".notice", [
  "background: var(--color-state-warning-soft);",
  "color: var(--color-state-warning-text);"
]);

expectIncludes(eventScheduleSheetSource, "border: 1rpx solid var(--material-input-border);");
expectIncludes(eventScheduleSheetSource, "background: var(--material-input-bg);");
expectIncludes(eventScheduleSheetSource, "box-shadow: var(--material-input-shadow);");
expectIncludes(eventScheduleSheetSource, "backdrop-filter: var(--material-input-filter);");
expectIncludes(eventScheduleSheetSource, "backdrop-filter: var(--button-primary-filter);");
expectExcludes(eventScheduleSheetSource, LEGACY_SECONDARY_OUTLINE);
expectSelectorExcludes(eventScheduleSheetSource, ".event-schedule-sheet__button--cancel", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorExcludes(eventScheduleSheetSource, ".event-schedule-sheet__button--confirm", ["border: 1rpx solid var(--button-primary-border);"]);
expectSelectorIncludes(eventScheduleSheetSource, ".event-schedule-sheet__chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(eventScheduleSheetSource, ".event-schedule-sheet__chip--active", ["border-color: var(--color-primary);"]);
expectSelectorIncludes(participantManageSheetSource, ".participant-sheet__action--primary", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(participantManageSheetSource, ".participant-sheet__action--primary", ["background: var(--color-primary-soft-fill-subtle);"]);

expectIncludes(menuConfirmSheetSource, "background: var(--material-card-bg);");
expectIncludes(menuConfirmSheetSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(menuConfirmSheetSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(menuConfirmSheetSource, "backdrop-filter: var(--button-primary-filter);");
expectExcludes(menuConfirmSheetSource, LEGACY_SECONDARY_OUTLINE);
expectExcludes(menuConfirmSheetSource, "border: 1rpx solid var(--material-card-border);");
expectExcludes(menuConfirmSheetSource, "border: 1rpx solid var(--button-secondary-border);");
expectExcludes(menuConfirmSheetSource, "border: 1rpx solid var(--button-primary-border);");

expectIncludes(addToPlanSheetSource, "border: 1rpx solid var(--material-input-border);");
expectIncludes(addToPlanSheetSource, "background: var(--material-input-bg);");
expectIncludes(addToPlanSheetSource, "box-shadow: var(--material-input-shadow);");
expectIncludes(addToPlanSheetSource, "backdrop-filter: var(--material-input-filter);");
expectIncludes(addToPlanSheetSource, "background: var(--material-card-bg);");
expectIncludes(addToPlanSheetSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(addToPlanSheetSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(addToPlanSheetSource, ".chip,\n.meal-slot {");
expectIncludes(addToPlanSheetSource, "min-height: 50rpx;");
expectIncludes(addToPlanSheetSource, "padding: 0 24rpx;");
expectIncludes(addToPlanSheetSource, "border-radius: var(--radius-pill);");
expectIncludes(addToPlanSheetSource, "backdrop-filter: var(--button-primary-filter);");
expectSelectorIncludes(addToPlanSheetSource, ".sheet-creator__button", [
  "background: var(--color-tag-primary-bg);",
  "color: var(--color-tag-primary-text);"
]);
expectExcludes(addToPlanSheetSource, LEGACY_SECONDARY_OUTLINE);
expectSelectorExcludes(addToPlanSheetSource, ".chip,\n.meal-slot", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(addToPlanSheetSource, ".panel-note", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(addToPlanSheetSource, ".sheet-actions__button--cancel", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorExcludes(addToPlanSheetSource, ".sheet-actions__button--confirm", ["border: 1rpx solid var(--button-primary-border);"]);
expectSelectorIncludes(addToPlanSheetSource, ".chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(addToPlanSheetSource, ".chip--active", ["background: var(--color-primary-soft);"]);

expectIncludes(addToPrivateSheetSource, "background: var(--material-card-bg);");
expectIncludes(addToPrivateSheetSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(addToPrivateSheetSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(addToPrivateSheetSource, "border: 1rpx solid var(--material-input-border);");
expectIncludes(addToPrivateSheetSource, "background: var(--material-input-bg);");
expectIncludes(addToPrivateSheetSource, "box-shadow: var(--material-input-shadow);");
expectIncludes(addToPrivateSheetSource, "backdrop-filter: var(--material-input-filter);");
expectIncludes(addToPrivateSheetSource, ".chip {");
expectIncludes(addToPrivateSheetSource, "min-height: 70rpx;");
expectIncludes(addToPrivateSheetSource, "padding: 0 24rpx;");
expectIncludes(addToPrivateSheetSource, "border-radius: var(--radius-pill);");
expectIncludes(addToPrivateSheetSource, "backdrop-filter: var(--button-primary-filter);");
expectExcludes(addToPrivateSheetSource, LEGACY_SECONDARY_OUTLINE);
expectSelectorExcludes(addToPrivateSheetSource, ".chip", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(addToPrivateSheetSource, ".panel-note", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(addToPrivateSheetSource, ".sheet-actions__button--cancel", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorExcludes(addToPrivateSheetSource, ".sheet-actions__button--confirm", ["border: 1rpx solid var(--button-primary-border);"]);
expectSelectorIncludes(addToPrivateSheetSource, ".chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(addToPrivateSheetSource, ".chip--active", ["background: var(--color-primary-soft);"]);
expectSelectorIncludes(addToPrivateSheetSource, ".sheet-creator__button", [
  "background: var(--color-tag-primary-bg);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(addToPrivateSheetSource, ".sheet-creator__button", ["background: var(--color-primary-soft);"]);

expectSelectorIncludes(sharePillButtonSource, ".share-pill", [
  "background: var(--color-tag-primary-bg);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(sharePillButtonSource, ".share-pill", ["background: var(--color-primary-soft);"]);
expectSelectorIncludes(pantryItemDetailPageSource, ".badge--info", [
  "background: var(--color-tag-primary-bg);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(pantryItemDetailPageSource, ".badge--info", ["background: var(--color-primary-soft);"]);
expectSelectorIncludes(randomPageSource, ".board-card__badge", [
  "background: var(--color-tag-primary-bg);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(randomPageSource, ".board-card__badge", ["background: var(--color-primary-soft);"]);

expectIncludes(shoppingListPickerSheetSource, "background: var(--material-card-bg);");
expectIncludes(shoppingListPickerSheetSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(shoppingListPickerSheetSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(shoppingListPickerSheetSource, "border: 1rpx solid var(--material-input-border);");
expectIncludes(shoppingListPickerSheetSource, "background: var(--material-input-bg);");
expectIncludes(shoppingListPickerSheetSource, "box-shadow: var(--material-input-shadow);");
expectIncludes(shoppingListPickerSheetSource, "backdrop-filter: var(--material-input-filter);");
expectIncludes(shoppingListPickerSheetSource, "backdrop-filter: var(--button-primary-filter);");
expectSelectorIncludes(shoppingListPickerSheetSource, ".shopping-list-option--active", [
  "background: var(--color-tag-primary-bg);"
]);
expectSelectorIncludes(shoppingListPickerSheetSource, ".shopping-create__button", [
  "background: var(--color-tag-primary-bg);",
  "color: var(--color-tag-primary-text);"
]);
expectExcludes(shoppingListPickerSheetSource, LEGACY_SECONDARY_OUTLINE);
expectSelectorExcludes(shoppingListPickerSheetSource, ".shopping-list-option", ["border: 1rpx solid var(--material-card-border);"]);
expectSelectorExcludes(shoppingListPickerSheetSource, ".sheet-actions__button--cancel", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorExcludes(shoppingListPickerSheetSource, ".sheet-actions__button--confirm", ["border: 1rpx solid var(--button-primary-border);"]);

expectIncludes(planArrangeSheetSource, "background: var(--material-card-bg);");
expectIncludes(planArrangeSheetSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(planArrangeSheetSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(planArrangeSheetSource, "backdrop-filter: var(--button-primary-filter);");
expectExcludes(planArrangeSheetSource, LEGACY_SECONDARY_OUTLINE);
expectExcludes(planArrangeSheetSource, "border: 1rpx solid var(--material-card-border);");
expectExcludes(planArrangeSheetSource, "border: 1rpx solid var(--button-secondary-border);");
expectExcludes(planArrangeSheetSource, "border: 1rpx solid var(--button-primary-border);");

expectIncludes(sheetShellSource, "backdrop-filter: var(--material-mask-filter);");
expectIncludes(sheetShellSource, "background: var(--material-panel-bg);");
expectIncludes(sheetShellSource, "box-shadow: var(--material-panel-shadow);");
expectIncludes(sheetShellSource, "backdrop-filter: var(--material-panel-filter);");
expectExcludes(sheetShellSource, "border: 1rpx solid var(--material-panel-border);");

expectIncludes(recipeSearchBarSource, "border: 1rpx solid var(--material-input-border);");
expectIncludes(recipeSearchBarSource, "background: var(--material-input-bg);");
expectIncludes(recipeSearchBarSource, "box-shadow: var(--material-input-shadow);");
expectIncludes(recipeSearchBarSource, "backdrop-filter: var(--material-input-filter);");

expectIncludes(inviteShareSheetSource, "background: var(--material-card-bg);");
expectIncludes(inviteShareSheetSource, "box-shadow: var(--material-card-shadow);");
expectIncludes(inviteShareSheetSource, "backdrop-filter: var(--material-card-filter);");
expectIncludes(inviteShareSheetSource, "backdrop-filter: var(--button-secondary-filter);");
expectExcludes(inviteShareSheetSource, LEGACY_SECONDARY_OUTLINE);
expectExcludes(inviteShareSheetSource, "border: 1rpx solid var(--material-card-border);");
expectExcludes(inviteShareSheetSource, "border: 1rpx solid var(--button-secondary-border);");
expectSelectorIncludes(inviteShareSheetSource, ".invite-share__tag-icon", [
  "color: var(--color-state-warning-text);"
]);

expectIncludes(textFieldSheetSource, "background: var(--material-input-bg);");
expectIncludes(textFieldSheetSource, "border: 1rpx solid var(--material-input-border);");
expectIncludes(textFieldSheetSource, "box-shadow: var(--material-input-shadow);");
expectIncludes(textFieldSheetSource, "backdrop-filter: var(--material-input-filter);");
expectIncludes(textFieldSheetSource, "backdrop-filter: var(--button-primary-filter);");
expectExcludes(textFieldSheetSource, LEGACY_SECONDARY_OUTLINE);
expectSelectorExcludes(textFieldSheetSource, ".text-field-sheet__button--cancel", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorExcludes(textFieldSheetSource, ".text-field-sheet__button--confirm", ["border: 1rpx solid var(--button-primary-border);"]);

expectIncludes(tabbarSource, "background: var(--material-tabbar-bg);");
expectIncludes(tabbarSource, "box-shadow: var(--material-tabbar-shadow);");
expectIncludes(tabbarSource, "backdrop-filter: var(--material-tabbar-filter);");
expectExcludes(tabbarSource, "border: 1rpx solid var(--material-tabbar-border);");

expectIncludes(toastSource, "background: var(--material-panel-bg);");
expectIncludes(toastSource, "box-shadow: var(--material-panel-shadow);");
expectIncludes(toastSource, "backdrop-filter: var(--material-panel-filter);");
expectExcludes(toastSource, "border: 1rpx solid var(--material-panel-border);");

expectSelectorIncludes(ingredientUnitsPageSource, ".sheet-input", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(ingredientUnitsPageSource, ".sheet-textarea", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(ingredientUnitsPageSource, ".sheet-chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorIncludes(ingredientUnitsPageSource, ".category-chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorExcludes(ingredientUnitsPageSource, ".category-chip--active", ["border-color: var(--color-primary);"]);
expectSelectorIncludes(ingredientUnitsPageSource, ".category-chip--active .category-chip__name", [
  "color: var(--color-tag-primary-text);"
]);
expectSelectorIncludes(medalPageSource, ".category-chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorExcludes(medalPageSource, ".category-chip--active", ["border-color: var(--color-primary);"]);
expectSelectorIncludes(medalPageSource, ".category-chip--active .category-chip__name,\n.category-chip--active .category-chip__meta", [
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(ingredientUnitsPageSource, ".unit-guide", ["border: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(membershipCodePageSource, ".redeem-input", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(shoppingTargetSheetSource, ".shopping-target-sheet__input", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(shoppingTargetSheetSource, ".shopping-target-sheet__option", [
  "background: var(--material-card-bg);",
  "box-shadow: var(--material-card-shadow);",
  "backdrop-filter: var(--material-card-filter);"
]);
expectSelectorExcludes(shoppingTargetSheetSource, ".shopping-target-sheet__option", ["border: 1rpx solid var(--color-border);"]);
expectSelectorExcludes(phonePageSource, ".phone-form-card", ["border: 1rpx solid var(--color-divider);"]);
expectSelectorExcludes(knowledgeDetailPageSource, ".detail-toolbar", ["border: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(knowledgeDetailPageSource, ".detail-toolbar", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectSelectorExcludes(knowledgeDetailPageSource, ".detail-toolbar", ["backdrop-filter: blur(16rpx);"]);
expectSelectorIncludes(knowledgeDetailPageSource, ".detail-toolbar__button--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);",
  "color: var(--color-tag-primary-text);"
]);
expectSelectorExcludes(knowledgeDetailPageSource, ".detail-toolbar__button--active", ["background: var(--color-primary-soft-fill);"]);
expectSelectorIncludes(knowledgeDetailPageSource, ".detail-hero__mask", [
  "background: var(--overlay-image-mask);"
]);
expectSelectorExcludes(knowledgeDetailPageSource, ".detail-hero__mask", [
  "radial-gradient(circle at top right, var(--color-primary-soft), transparent 28%)"
]);
expectIncludes(pantryItemEditPageSource, "border: 1rpx solid var(--material-input-border);");
expectIncludes(pantryItemEditPageSource, "background: var(--material-input-bg);");
expectIncludes(pantryItemEditPageSource, "box-shadow: var(--material-input-shadow);");
expectIncludes(pantryItemEditPageSource, "backdrop-filter: var(--material-input-filter);");
expectSelectorIncludes(pantryItemEditPageSource, ".ingredient-item,\n.readonly-card", [
  "background: var(--material-card-bg);",
  "box-shadow: var(--material-card-shadow);",
  "backdrop-filter: var(--material-card-filter);"
]);
expectSelectorExcludes(pantryItemEditPageSource, ".ingredient-item,\n.readonly-card", ["border: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(shareImportPageSource, ".input", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(phonePageSource, ".phone-page", [
  "background: var(--page-primary-soft-bg);"
]);
expectSelectorExcludes(phonePageSource, ".phone-page", [
  "radial-gradient(circle at top center, var(--color-primary-halo), transparent 42%)"
]);
expectExcludes(ingredientUnitsPageSource, LEGACY_SECONDARY_OUTLINE);
expectSelectorIncludes(ingredientUnitsPageSource, ".ingredient-card__unit", [
  "-webkit-backdrop-filter: var(--material-mask-filter);",
  "backdrop-filter: var(--material-mask-filter);"
]);
expectSelectorExcludes(ingredientUnitsPageSource, ".ingredient-card__unit", ["backdrop-filter: blur(8rpx);"]);
expectSelectorIncludes(ingredientUnitsPageSource, ".ingredient-card__notice", [
  "-webkit-backdrop-filter: var(--material-mask-filter);",
  "backdrop-filter: var(--material-mask-filter);"
]);
expectSelectorExcludes(ingredientUnitsPageSource, ".ingredient-card__notice", ["backdrop-filter: blur(8rpx);"]);
expectSelectorExcludes(ingredientUnitsPageSource, ".sheet-button--ghost", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorExcludes(recommendDetailPageSource, ".invite-card__button--cancel", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorExcludes(recommendDetailPageSource, ".editor-button--ghost", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorIncludes(recommendDetailPageSource, ".invite-card--pending", [
  "background: var(--material-card-bg);",
  "box-shadow: var(--material-card-shadow);",
  "backdrop-filter: var(--material-card-filter);"
]);
expectSelectorExcludes(recommendDetailPageSource, ".invite-card--pending", ["border: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(recommendDetailPageSource, ".editor-input", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(recommendDetailPageSource, ".chip", [
  "background: var(--material-control-bg);",
  "box-shadow: var(--material-control-shadow);",
  "backdrop-filter: var(--material-control-filter);"
]);
expectSelectorExcludes(recommendDetailPageSource, ".chip", ["border: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(recommendDetailPageSource, ".chip--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorExcludes(recommendDetailPageSource, ".chip--active", ["border-color: var(--color-primary);"]);
expectSelectorIncludes(medalDetailPageSource, ".detail-footer", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectSelectorExcludes(medalDetailPageSource, ".detail-footer", ["backdrop-filter: blur(12rpx);"]);
expectSelectorExcludes(medalDetailPageSource, ".hero-card__badge-base", ["filter: blur(0.4rpx);"]);
expectSelectorExcludes(tastePageSource, ".taste-status__button", ["border: 1rpx solid var(--color-border);"]);
expectSelectorIncludes(tastePageSource, ".taste-field__textarea", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(shareMemoryPageSource, ".textarea", [
  "border: 1rpx solid var(--material-input-border);",
  "background: var(--material-input-bg);",
  "box-shadow: var(--material-input-shadow);",
  "backdrop-filter: var(--material-input-filter);"
]);
expectSelectorIncludes(mealDetailPageSource, ".share-member--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorIncludes(pantryListPageSource, ".share-member--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorIncludes(pantryListDetailPageSource, ".share-member--active", [
  "background: var(--color-tag-primary-bg);",
  "box-shadow: inset 0 0 0 1rpx var(--color-border-active);"
]);
expectSelectorExcludes(pantryGapPageSource, ".sheet-actions__button--cancel", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorExcludes(pantryItemDetailPageSource, ".sheet-actions__button--cancel", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorExcludes(pantryListCompletePageSource, ".sheet-actions__button--cancel", ["border: 1rpx solid var(--button-secondary-border);"]);
expectSelectorIncludes(pantryGapPageSource, ".gap-nav-backdrop", [
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);",
  "backdrop-filter: var(--material-tabbar-filter);"
]);
expectSelectorExcludes(pantryGapPageSource, ".gap-nav-backdrop", ["backdrop-filter: saturate(180%) blur(22rpx);"]);
expectSelectorExcludes(pantryGapPageSource, ".gap-nav-backdrop", ["border-bottom: 1rpx solid var(--color-border);"]);

console.log("theme skin material tests passed");
