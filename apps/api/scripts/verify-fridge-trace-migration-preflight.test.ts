import assert from "node:assert/strict";
import test from "node:test";
import { assertNoLegacyFridgeRows } from "./verify-fridge-trace-migration-preflight";

test("旧冰箱迁移仅在待删除表为空时允许部署", () => {
  assert.doesNotThrow(() => assertNoLegacyFridgeRows({ fridgeItems: 0, reservations: 0 }));
  assert.throws(
    () => assertNoLegacyFridgeRows({ fridgeItems: 154, reservations: 2 }),
    /fridge_items=154.*shopping_item_fridge_reservations=2/
  );
});
