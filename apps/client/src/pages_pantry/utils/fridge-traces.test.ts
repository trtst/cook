import assert from "node:assert/strict";
import test from "node:test";
import { loadAllFridgeTraces } from "./fridge-traces";

test("清单页加载跨页食材痕迹，避免遗漏较早记录", async () => {
  const requestedPages: number[] = [];
  const rows = await loadAllFridgeTraces(async (page, pageSize) => {
    requestedPages.push(page);
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, 101);
    const items = Array.from({ length: end - start }, (_, index) => {
      const id = start + index + 1;
      return {
        id,
        ingredientId: id,
        name: `食材${id}`,
        categoryName: "蔬菜",
        kind: "MANUAL_PRESENT" as const,
        label: "可能还有",
        recordedAt: "2026-09-24T00:00:00.000Z",
        windowDays: 7 as const,
        presence: "PRESENT" as const,
        archived: false,
        recentlyPurchased: false
      };
    });
    return { items, hasNext: end < 101 };
  });

  assert.deepEqual(requestedPages, [1, 2]);
  assert.equal(rows.length, 101);
  assert.equal(rows[100]?.name, "食材101");
});
