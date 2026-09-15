import assert from "node:assert/strict";
import test from "node:test";
import { buildMenuDisplay, buildShoppingDisplay, menuItemMetaText } from "./menu-display";

const dishes = ["鱼香肉丝", "番茄炒蛋", "清炒时蔬", "红烧排骨", "紫菜蛋花汤", "麻婆豆腐", "凉拌黄瓜"];

test("five dishes render in full without an expand control", () => {
  const display = buildMenuDisplay(dishes.slice(0, 5), false);

  assert.deepEqual(display.rows.map(row => row.item), dishes.slice(0, 5));
  assert.deepEqual(display.rows.map(row => row.extra), [false, false, false, false, false]);
  assert.equal(display.showToggle, false);
  assert.equal(display.toggleText, "");
});

test("more than five dishes collapse to five and report the hidden count", () => {
  const display = buildMenuDisplay(dishes, false);

  assert.deepEqual(display.rows.filter(row => !row.extra).map(row => row.item), dishes.slice(0, 5));
  assert.deepEqual(display.rows.filter(row => row.extra).map(row => row.item), dishes.slice(5));
  assert.equal(display.expanded, false);
  assert.equal(display.showToggle, true);
  assert.equal(display.toggleText, "还有 2 道菜");
});

test("expanding shows every dish and changes the control to collapse", () => {
  const display = buildMenuDisplay(dishes, true);

  assert.deepEqual(display.rows.map(row => row.item), dishes);
  assert.equal(display.expanded, true);
  assert.equal(display.showToggle, true);
  assert.equal(display.toggleText, "收起菜单");
});

test("dining event menu rows show the first recipe keyword without a fallback label", () => {
  assert.equal(menuItemMetaText(true, ["家常", "快手"], null), "家常");
  assert.equal(menuItemMetaText(true, [], null), "");
});

test("plain meal plan rows keep their servings metadata", () => {
  assert.equal(menuItemMetaText(false, [], 4), "4人份");
  assert.equal(menuItemMetaText(false, [], null), "待安排");
});

const ingredients = ["番茄", "鸡蛋", "青菜", "排骨", "紫菜", "豆腐", "黄瓜"];

test("five shopping items render without an expand control", () => {
  const display = buildShoppingDisplay(ingredients.slice(0, 5), false);

  assert.deepEqual(display.rows.map(row => row.extra), [false, false, false, false, false]);
  assert.equal(display.showToggle, false);
  assert.equal(display.toggleText, "");
});

test("more than five shopping items collapse and report the hidden ingredient count", () => {
  const display = buildShoppingDisplay(ingredients, false);

  assert.deepEqual(display.rows.filter(row => !row.extra).map(row => row.item), ingredients.slice(0, 5));
  assert.deepEqual(display.rows.filter(row => row.extra).map(row => row.item), ingredients.slice(5));
  assert.equal(display.expanded, false);
  assert.equal(display.toggleText, "还有 2 样食材");
});

test("expanding shopping items changes the control to collapse", () => {
  const display = buildShoppingDisplay(ingredients, true);

  assert.equal(display.expanded, true);
  assert.equal(display.showToggle, true);
  assert.equal(display.toggleText, "收起采购清单");
});
