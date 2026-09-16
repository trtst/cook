import assert from "node:assert/strict";
import test from "node:test";
import { buildIngredientDisplay } from "./ingredient-display";

const ingredients = ["番茄", "鸡蛋", "青菜", "排骨", "紫菜", "豆腐", "黄瓜"];

test("five ingredients render in full without an expand control", () => {
  const display = buildIngredientDisplay(ingredients.slice(0, 5), false);

  assert.deepEqual(display.rows.map(row => row.item), ingredients.slice(0, 5));
  assert.deepEqual(display.rows.map(row => row.extra), [false, false, false, false, false]);
  assert.equal(display.showToggle, false);
  assert.equal(display.toggleText, "");
});

test("more than five ingredients collapse to five and report the hidden count", () => {
  const display = buildIngredientDisplay(ingredients, false);

  assert.deepEqual(display.rows.filter(row => !row.extra).map(row => row.item), ingredients.slice(0, 5));
  assert.deepEqual(display.rows.filter(row => row.extra).map(row => row.item), ingredients.slice(5));
  assert.equal(display.expanded, false);
  assert.equal(display.showToggle, true);
  assert.equal(display.toggleText, "还有 2 样食材");
});

test("expanding shows every ingredient and changes the control to collapse", () => {
  const display = buildIngredientDisplay(ingredients, true);

  assert.deepEqual(display.rows.map(row => row.item), ingredients);
  assert.equal(display.expanded, true);
  assert.equal(display.showToggle, true);
  assert.equal(display.toggleText, "收起食材清单");
});
