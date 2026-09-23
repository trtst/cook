import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const listSource = readFileSync(resolve(__dirname, "index/index.vue"), "utf8");
const detailSource = readFileSync(resolve(__dirname, "item-detail/index.vue"), "utf8");
const apiSource = readFileSync(resolve(__dirname, "apis/fridge.ts"), "utf8");
const editSource = readFileSync(resolve(__dirname, "item-edit/index.vue"), "utf8");

assert.match(listSource, /ingredientId=/, "The ingredient list should navigate by ingredient identity");
assert.match(listSource, /stockGroups/, "The ingredient list should render service-side stock groups");
assert.doesNotMatch(listSource, /card\.id\)}`\)/, "The ingredient list should not use a batch id as its only detail key");
assert.match(
  detailSource,
  /<scroll-view[\s\S]*class="detail-content-scroll"[\s\S]*class="detail-hero"/,
  "The detail hero should scroll with the detail content"
);
assert.match(detailSource, /fridgeApi\.getDetail\(/, "The detail page should load one ingredient detail");
assert.match(detailSource, /fridgeApi\.consume\(currentItem\.value\.ingredientId/, "The detail page should consume by ingredient total");
assert.doesNotMatch(detailSource, /fridgeApi\.consume\(\[currentItem\.value\.id\]/, "The detail page must not select a batch id to consume");
assert.match(detailSource, /已过期库存/, "Expired batches should have a separate collapsible section");
assert.match(detailSource, /历史批次/, "Used-up batches should have a separate history section");
assert.match(apiSource, /getBatchDetail\(itemId/, "Legacy batch deep links should use an explicit compatibility endpoint");
assert.match(detailSource, /getBatchDetail\(itemId\.value\)/, "Legacy batch deep links should remain viewable without guessing identity");
assert.match(detailSource, /v-if=\"!currentItem\.identityPending\"/, "Unbound legacy inventory should not expose ingredient-level history");
assert.match(
  detailSource,
  /<view v-if=\"!currentItem\.identityPending\" class=\"section-card\">\s*<view class=\"collapse-header\" @click=\"toggleHistory\">[\s\S]*?历史批次/,
  "Unbound legacy inventory should not render the ingredient history section"
);
assert.match(detailSource, /historyHasNext/, "The history section should keep pagination state");
assert.match(detailSource, /loadMoreHistory/, "The history section should expose a way to load older batches");
assert.match(detailSource, /getHistory\(currentItem\.value\.ingredientId, page, 100\)/, "The history query should use the server page size limit");
assert.match(editSource, /fridgeApi\.getBatchDetail\(itemId\.value\)/, "Legacy batch edits should load the exact batch instead of a grouped card");
assert.match(detailSource, /fridgeApi\.updateMany\(/, "Multi-batch correction should use one transactional API call");
assert.doesNotMatch(detailSource, /for \(const batch of batches\)[\s\S]*fridgeApi\.update\(/, "Multi-batch correction must not partially update batches in a client loop");

console.log("pantry inventory batch contract tests passed");
