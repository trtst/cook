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
expectIncludes(randomPageSource, 'v-for="menuSlot in state.slots"');
expectIncludes(randomPageSource, ':item="menuSlot"');
expectExcludes(randomPageSource, '@click="rerollMenu"');
expectExcludes(randomPageSource, ':slot="slot"');
expectExcludes(randomPageSource, 'class="warning-card"');

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
expectIncludes(randomConditionBarSource, "icon-stepper-minus");
expectIncludes(randomConditionBarSource, "icon-stepper-add");
expectSelectorIncludes(randomConditionBarSource, ".option-chip--active", [
  "background: var(--color-primary);",
  "box-shadow: var(--button-primary-shadow);"
]);
expectSelectorExcludes(randomConditionBarSource, ".option-chip--active", ["background: var(--color-tag-primary-bg);"]);
expectSelectorIncludes(randomConditionBarSource, ".option-chip--active .option-chip__text", ["color: var(--color-primary-contrast);"]);

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

expectIncludes(fontSource, ".icon-stepper-add::before");
expectIncludes(fontSource, 'content: "\\e6d7";');
expectIncludes(fontSource, ".icon-stepper-minus::before");
expectIncludes(fontSource, 'content: "\\e6d8";');

console.log("random page style tests passed");
