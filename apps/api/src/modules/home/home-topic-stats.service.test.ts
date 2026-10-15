import assert from "node:assert/strict";
import test from "node:test";
import { primaryIngredientNames } from "./home-topic-stats.service";

test("primary ingredient statistics include active system ingredients across categories", () => {
  const names = primaryIngredientNames(
    ["6101", "6102", "6103", "not-an-id"],
    [
      { ingredientId: 6101, name: "干辣椒" },
      { ingredientId: 6102, name: "个人辣椒" },
      { ingredientId: 6103, name: "未关联的辣椒" }
    ],
    new Set([6101, 6103])
  );

  assert.deepEqual([...names], ["干辣椒"]);
});
