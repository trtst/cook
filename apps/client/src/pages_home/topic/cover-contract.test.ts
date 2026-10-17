import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const topicPage = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const recipeEditor = readFileSync(resolve(__dirname, "../../pages_recipe/edit/index.vue"), "utf8");
const mealDetail = readFileSync(resolve(__dirname, "../../pages_meal/detail/index.vue"), "utf8");
const imageField = readFileSync(resolve(__dirname, "../../components/ImageField.vue"), "utf8");

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

test("cover sizing is established inside ImageField for both supported ratios", () => {
  assert.match(imageField, /\.image-field--cover-ratio-3-4\s*\{[^}]*padding-top:\s*133\.3333%;/s);
  assert.match(imageField, /\.image-field--cover-ratio-4-3\s*\{[^}]*padding-top:\s*75%;/s);
  assert.match(recipeEditor, /class="hero__cover"[\s\S]*?variant="cover"/);
  assert.match(mealDetail, /variant="cover"\s+cover-ratio="4-3"/);
});
