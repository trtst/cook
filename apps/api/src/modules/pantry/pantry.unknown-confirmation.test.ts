import assert from "node:assert/strict";
import test from "node:test";
import { buildUnknownInventoryConfirmationPatch } from "./pantry.unknown-confirmation";

test("unknown inventory confirmation marks a shopping item as covered without a fake quantity", () => {
  assert.deepEqual(buildUnknownInventoryConfirmationPatch(), {
    fridgeAppliedQuantityText: "数量未记录",
    fridgeCovered: true
  });
});
