import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const topicPage = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const recipeEditor = readFileSync(resolve(__dirname, "../../pages_recipe/edit/index.vue"), "utf8");
const mealDetail = readFileSync(resolve(__dirname, "../../pages_meal/detail/index.vue"), "utf8");

test("weekly mini-code scene resolves and loads the selected topic", () => {
  assert.match(topicPage, /const rawScene = Array\.isArray\(query\?\.scene\) \? query\.scene\[0\] : query\?\.scene;/);
  assert.match(topicPage, /sceneTopicId = decodeURIComponent\(rawScene\);/);
  assert.match(topicPage, /const rawTopicId = queryTopicId \?\? sceneTopicId;/);
  assert.match(topicPage, /Number\.isInteger\(Number\(rawTopicId\)\) && Number\(rawTopicId\) > 0/);
  assert.match(topicPage, /void loadTopic\(topicId\.value, false\);/);
});

test("weekly cover slots preserve the 4:3 display contract", () => {
  assert.match(topicPage, /\.topic-summary__cover\s*\{[^}]*width:\s*267rpx;[^}]*height:\s*200rpx;/s);
  assert.match(topicPage, /\.history-card\s*\{[^}]*width:\s*400rpx;[^}]*height:\s*300rpx;/s);
  assert.match(topicPage, /\.history-card__cover\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3;/s);
});

test("cover sizing stays owned by each client page after removing ImageField defaults", () => {
  assert.match(recipeEditor, /\.hero__cover\s*\{[^}]*width:\s*100%;[^}]*aspect-ratio:\s*3\s*\/\s*4;/s);
  assert.match(mealDetail, /\.meal-hero__cover-field\.image-field--cover\.image-field--empty,[\s\S]*?aspect-ratio:\s*4\s*\/\s*3;/);
});
