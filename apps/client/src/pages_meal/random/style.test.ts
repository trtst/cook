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

const randomPageSource = readFile("./index.vue");
const randomConditionBarSource = readFile("../components/RandomConditionBar.vue");
const randomBottomBarSource = readFile("../components/RandomBottomBar.vue");
const randomGapPanelSource = readFile("../components/RandomGapPanel.vue");
const randomSlotCardSource = readFile("../components/RandomSlotCard.vue");
const fontSource = readFile("../../assets/fonts/font.scss");

expectIncludes(randomPageSource, '<view class="random-generate-bar">');
expectIncludes(randomPageSource, '@click="generateMenu"');
expectIncludes(randomPageSource, 'class="plan-sheet__inspiration"');
expectIncludes(randomPageSource, 'class="plan-sheet__category-row"');
expectIncludes(randomPageSource, 'class="plan-sheet__category-chip"');
expectIncludes(randomPageSource, '@click="createPlan"');
expectIncludes(randomPageSource, "for (const item of inspirationSlots.value) selectCategory(item.recipeVersionId, created.id);");
expectIncludes(randomPageSource, 'v-for="menuSlot in state.slots"');
expectIncludes(randomPageSource, ':item="menuSlot"');
expectExcludes(randomPageSource, '@click="rerollMenu"');
expectExcludes(randomPageSource, ':slot="slot"');
expectExcludes(randomPageSource, 'class="warning-card"');
expectExcludes(randomPageSource, "<RandomGapPanel");
expectExcludes(randomPageSource, 'from "../components/RandomGapPanel.vue"');
expectExcludes(randomPageSource, ':gap-summary=');
expectExcludes(randomPageSource, "gapSummaryMap");
expectExcludes(randomPageSource, "shortageDishCount");
expectExcludes(randomPageSource, "待补");
expectExcludes(randomPageSource, "还缺食材");
expectExcludes(randomPageSource, "和缺什么理清楚");
expectIncludes(randomPageSource, "暂时没有更多可换的菜了");
expectIncludes(randomPageSource, "if (isReroll) {");
expectIncludes(randomPageSource, "if (result.items.length === 0) {");

expectSelectorIncludes(randomPageSource, ".random-generate-bar", [
  "position: fixed;",
  "bottom: 0;",
  "background: var(--material-tabbar-bg);"
]);
expectSelectorIncludes(randomPageSource, ".random-generate-bar__button", [
  "height: 96rpx;",
  "border-radius: 999rpx;"
]);
expectSelectorIncludes(randomPageSource, ".random-generate-bar__button--primary", [
  "width: 100%;",
  "flex: 1 1 100%;",
  "background: var(--button-primary-bg);",
  "color: var(--button-primary-text);"
]);
expectSelectorExcludes(randomPageSource, ".random-generate-bar__button--primary", ["再生成一桌"]);
expectSelectorIncludes(randomPageSource, ".board-card__description", ["color: var(--color-text);"]);
expectSelectorIncludes(randomPageSource, ".board-card__summary-item", ["color: var(--color-text);"]);
expectSelectorExcludes(randomPageSource, ".board-card__summary-item", ["color: var(--color-text-secondary);"]);

expectIncludes(randomConditionBarSource, "优先消耗冰箱食材");
expectIncludes(randomConditionBarSource, "只影响这一次随机和换菜，不会改动平时偏好。");
expectIncludes(randomConditionBarSource, "toggle-row__head");
expectIncludes(randomConditionBarSource, "condition-group__description");
expectExcludes(randomConditionBarSource, 'class="action-row"');
expectSelectorIncludes(randomConditionBarSource, ".toggle-row", [
  "flex-direction: column;"
]);
expectSelectorIncludes(randomConditionBarSource, ".toggle-row__head", [
  "display: flex;",
  "justify-content: space-between;"
]);
expectIncludes(randomConditionBarSource, 'class="cookfont slot-plan__button icon-stepper-minus"');
expectIncludes(randomConditionBarSource, 'class="cookfont slot-plan__button icon-stepper-add"');
expectExcludes(randomConditionBarSource, 'class="cookfont slot-plan__button-icon');
expectSelectorIncludes(randomConditionBarSource, ".option-chip--active", [
  "background: var(--button-primary-bg);",
  "box-shadow: var(--button-primary-shadow);"
]);
expectSelectorExcludes(randomConditionBarSource, ".option-chip--active", ["background: var(--color-tag-primary-bg);"]);
expectSelectorIncludes(randomConditionBarSource, ".option-chip--active .option-chip__text", ["color: var(--button-primary-text);"]);

expectSelectorExcludes(randomBottomBarSource, ".bottom-bar", ["position: sticky;"]);
expectExcludes(randomBottomBarSource, "看看缺什么");
expectExcludes(randomBottomBarSource, "openGap");
expectExcludes(randomBottomBarSource, "加入清单");
expectExcludes(randomBottomBarSource, "createShopping");
expectIncludes(randomBottomBarSource, "加入计划");

expectExcludes(randomGapPanelSource, "确认有");
expectExcludes(randomGapPanelSource, "确认无");
expectExcludes(randomGapPanelSource, "保留待采购");
expectExcludes(randomGapPanelSource, "采购这道缺口");
expectIncludes(randomGapPanelSource, "冰箱对比");

expectExcludes(randomSlotCardSource, "取消保留");
expectExcludes(randomSlotCardSource, 'emit("lock"');
expectExcludes(randomSlotCardSource, 'emit("unlock"');
expectIncludes(randomSlotCardSource, "划掉");
expectIncludes(randomSlotCardSource, "换一道");
expectIncludes(randomSlotCardSource, "item: RandomSlotViewModel;");
expectExcludes(randomSlotCardSource, "slot: RandomSlotViewModel;");
expectExcludes(randomSlotCardSource, 'class="constraint-row"');
expectExcludes(randomSlotCardSource, 'class="constraint-chip');
expectExcludes(randomSlotCardSource, 'label: "15分钟"');
expectExcludes(randomSlotCardSource, 'label: "30-60分钟"');
expectExcludes(randomSlotCardSource, 'label: "优先用冰箱"');
expectIncludes(randomSlotCardSource, "metaTags");
expectIncludes(randomSlotCardSource, "fridgeNote");
expectIncludes(randomSlotCardSource, "props.item.matchedIngredients");
expectIncludes(randomSlotCardSource, 'return `已有：${names}${suffix}`;');
expectIncludes(randomSlotCardSource, 'MILD: "微辣"');
expectExcludes(randomSlotCardSource, 'v-for="tag in item.flavorTags"');
expectIncludes(randomSlotCardSource, 'v-for="tag in metaTags"');
expectExcludes(randomSlotCardSource, 'class="tag-row"');
expectExcludes(randomSlotCardSource, 'class="slot-card__gap"');
expectExcludes(randomSlotCardSource, "缺 ");

expectIncludes(fontSource, ".icon-stepper-add::before");
expectIncludes(fontSource, 'content: "\\e6d7";');
expectIncludes(fontSource, ".icon-stepper-minus::before");
expectIncludes(fontSource, 'content: "\\e6d8";');

console.log("random page style tests passed");
