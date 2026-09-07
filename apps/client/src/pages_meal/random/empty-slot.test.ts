import assert from "node:assert/strict";
import test from "node:test";
import { buildRandomBoardSlots } from "../types/random";

test("random board keeps an empty card for every planned slot without a recipe", () => {
  const slots = buildRandomBoardSlots(
    "DINNER",
    {
      meatCount: 1,
      vegetableCount: 1,
      soupCount: 0,
      stapleCount: 0,
      breakfastStapleCount: 0,
      breakfastProteinCount: 0,
      breakfastSideCount: 0
    },
    [{ slotId: "MEAT-1", slotType: "MEAT", title: "番茄牛腩" } as never]
  );

  assert.deepEqual(slots.map(item => ({ kind: item.kind, slotId: item.slotId, slotType: item.slotType })), [
    { kind: "RECIPE", slotId: "MEAT-1", slotType: "MEAT" },
    { kind: "EMPTY", slotId: "VEGETABLE-1", slotType: "VEGETABLE" }
  ]);
});
