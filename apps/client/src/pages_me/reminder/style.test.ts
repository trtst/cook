import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFile(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

function expectSelectorIncludes(source: string, selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(match[1].includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

function expectExcludes(source: string, snippet: string) {
  assert.ok(!source.includes(snippet), `Expected file to exclude: ${snippet}`);
}

const reminderPageSource = readFile("./index.vue");

expectExcludes(reminderPageSource, "reminder-card--hero");
expectExcludes(reminderPageSource, "permission-strip");
expectExcludes(reminderPageSource, "refreshNotificationBadgeSnapshot");
expectExcludes(reminderPageSource, "reminder-card__title");
expectExcludes(reminderPageSource, "reminder-card__section-desc");

expectSelectorIncludes(reminderPageSource, ".reminder-scroll", [
  "gap: var(--space-md);",
  "padding-top: var(--space-sm);"
]);

expectSelectorIncludes(reminderPageSource, ".setting-toggle", [
  "width: 80rpx;",
  "height: 48rpx;"
]);

expectSelectorIncludes(reminderPageSource, ".setting-toggle--on", [
  "background: var(--color-primary);"
]);

expectSelectorIncludes(reminderPageSource, ".setting-toggle__thumb", [
  "width: 40rpx;",
  "height: 40rpx;"
]);

expectSelectorIncludes(reminderPageSource, ".setting-toggle--on .setting-toggle__thumb", [
  "transform: translateX(32rpx);"
]);

expectSelectorIncludes(reminderPageSource, ".setting-group--paired .setting-row + .setting-row", [
  "border-top: 0;"
]);

expectSelectorIncludes(reminderPageSource, ".setting-row__desc", [
  "margin-top: 8rpx;",
  "color: var(--color-text-secondary);",
  "font-size: var(--font-size-xs);"
]);

expectSelectorIncludes(reminderPageSource, ".day-chip-list", [
  "display: flex;",
  "margin-top: 18rpx;"
]);

expectSelectorIncludes(reminderPageSource, ".day-chip--active .day-chip__text", [
  "color: var(--color-primary);"
]);

expectSelectorIncludes(reminderPageSource, ".reminder-footer", [
  "position: fixed;",
  "bottom: 0;",
  "background: var(--material-tabbar-bg);",
  "box-shadow: var(--material-tabbar-shadow);"
]);

expectSelectorIncludes(reminderPageSource, ".reminder-footer__button", [
  "height: 84rpx;",
  "background: var(--button-primary-bg);",
  "box-shadow: var(--button-primary-shadow);",
  "color: var(--button-primary-text);"
]);
expectExcludes(reminderPageSource, "time-list");
expectExcludes(reminderPageSource, "time-row__label");
expectExcludes(reminderPageSource, "time-row__value");

console.log("reminder page style passed");
