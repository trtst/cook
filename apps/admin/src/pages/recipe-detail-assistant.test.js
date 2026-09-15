import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const detailPage = fs.readFileSync(new URL("./RecipeDetailPage.vue", import.meta.url), "utf8");
const apiFile = fs.readFileSync(new URL("../apis/recipe.ts", import.meta.url), "utf8");

test("recipe detail API models the full Wiki assistant lifecycle and candidate flag", () => {
  assert.match(apiFile, /status: "MISSING" \| "PENDING" \| "GENERATING" \| "NEEDS_REVIEW" \| "READY" \| "FAILED"/);
  assert.match(apiFile, /hasCandidate: boolean/);
  assert.match(apiFile, /hasSnapshot: boolean/);
});

test("recipe detail assistant panel labels READY as frontend-available and NEEDS_REVIEW as manual work", () => {
  assert.match(detailPage, /NEEDS_REVIEW: "待人工处理"/);
  assert.match(detailPage, /READY: "前台可用"/);
  assert.match(detailPage, /前台可用 Wiki/);
  assert.match(detailPage, /候选内容/);
  assert.doesNotMatch(detailPage, /保留上一版可用快照/);
  assert.doesNotMatch(detailPage, /做饭建议已生成，可直接供前台单菜助理和本餐助理复用/);
});
