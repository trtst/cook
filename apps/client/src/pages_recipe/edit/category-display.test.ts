import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { buildCategoryDisplay } from "./category-display";

const categories = ["家常菜", "快手菜", "周末宴客", "宝宝餐", "轻食", "汤羹", "烘焙"];

test("personal categories beyond five stay mounted and report their hidden count", () => {
  const display = buildCategoryDisplay(categories, false);

  assert.deepEqual(display.rows.filter(row => !row.extra).map(row => row.item), categories.slice(0, 5));
  assert.deepEqual(display.rows.filter(row => row.extra).map(row => row.item), categories.slice(5));
  assert.equal(display.expanded, false);
  assert.equal(display.showToggle, true);
  assert.equal(display.toggleText, "还有 2 个分类");
});

test("expanded personal categories show every item and offer collapse", () => {
  const display = buildCategoryDisplay(categories, true);

  assert.deepEqual(display.rows.map(row => row.item), categories);
  assert.equal(display.expanded, true);
  assert.equal(display.showToggle, true);
  assert.equal(display.toggleText, "收起分类");
});

test("chip spacing stays shared while category collapse owns its local gap", () => {
  const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");
  assert.match(source, /\.mode-row,\s*\.chip-row\s*\{[\s\S]*?gap: 14rpx;/);
  assert.match(source, /\.category-chip-row\s*\{[\s\S]*?gap: 0;/);
});
