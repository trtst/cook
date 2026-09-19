import assert from "node:assert/strict";
import test from "node:test";
import { toggleWishRecipeSelection } from "./recipe-selection";

test("我想吃 Sheet 不会把已提交的支持误当成可取消选择", () => {
  const selected = toggleWishRecipeSelection([11], 11, new Set([11]), 3);

  assert.deepEqual(selected, [11]);
});

test("我想吃 Sheet 仍允许添加未提交的菜并遵守三道上限", () => {
  const selected = toggleWishRecipeSelection([11], 12, new Set([11]), 3);
  const capped = toggleWishRecipeSelection([11, 12, 13], 14, new Set([11]), 3);

  assert.deepEqual(selected, [11, 12]);
  assert.deepEqual(capped, [11, 12, 13]);
});
