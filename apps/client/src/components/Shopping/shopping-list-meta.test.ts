import assert from "node:assert/strict";
import * as shoppingListDisplay from "./shopping-list-meta";

const { shoppingListMetaText } = shoppingListDisplay;

const now = new Date(2026, 8, 15, 21, 0, 0);

assert.equal(
  shoppingListMetaText({
    progressDoneCount: 0,
    progressTotalCount: 1,
    updatedAt: new Date(2026, 8, 15, 18, 30, 0).toISOString()
  }, now),
  "进度 0/1 · 今天 18:30 更新"
);

assert.equal(
  shoppingListMetaText({
    progressDoneCount: 3,
    progressTotalCount: 8,
    updatedAt: new Date(2026, 8, 14, 20, 15, 0).toISOString()
  }, now),
  "进度 3/8 · 9月14日 20:15 更新"
);

assert.equal(
  shoppingListMetaText({
    progressDoneCount: 2,
    progressTotalCount: 2,
    updatedAt: new Date(2025, 11, 31, 9, 5, 0).toISOString()
  }, now),
  "进度 2/2 · 2025年12月31日 09:05 更新"
);

assert.equal(
  shoppingListMetaText({
    progressDoneCount: 0,
    progressTotalCount: 0,
    updatedAt: ""
  }, now),
  "进度 0/0"
);

const shoppingListRows = (shoppingListDisplay as typeof shoppingListDisplay & {
  shoppingListRows?: <T extends { id: number }>(items: T[], selectedId: number | "") => Array<{
    key: string;
    item: T;
    selected: boolean;
  }>;
}).shoppingListRows;

assert.equal(typeof shoppingListRows, "function", "shopping-list rows should derive selection from list ID");
const duplicateNameRows = shoppingListRows!([
  { id: 101, name: "9月16日 · 晚餐清单" },
  { id: 102, name: "9月16日 · 晚餐清单" },
  { id: 103, name: "9月16日 · 晚餐清单" }
], 102);

assert.deepEqual(
  duplicateNameRows.map(row => ({ id: row.item.id, selected: row.selected })),
  [
    { id: 101, selected: false },
    { id: 102, selected: true },
    { id: 103, selected: false }
  ]
);
assert.equal(new Set(duplicateNameRows.map(row => row.key)).size, 3, "each list row should have a unique render key");
assert.match(duplicateNameRows[1].key, /^102:active$/);

console.log("shopping list meta tests passed");
