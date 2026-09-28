import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFile(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

function expectIncludes(source: string, snippet: string) {
  assert.ok(source.includes(snippet), `Expected file to include: ${snippet}`);
}

function expectExcludes(source: string, snippet: string) {
  assert.ok(!source.includes(snippet), `Expected file to exclude: ${snippet}`);
}

const addToPlanSheetSource = readFile("./AddToPlanSheet.vue");
const homeTopicPageSource = readFile("../../pages_home/topic/index.vue");
const randomPageSource = readFile("../../pages_meal/random/index.vue");

expectExcludes(homeTopicPageSource, 'class="recipe-note"');
expectExcludes(homeTopicPageSource, "确认加入计划时，会同时保存到私房菜。");
expectExcludes(addToPlanSheetSource, "私房菜分类");
expectExcludes(addToPlanSheetSource, "needAddToPrivate");
expectIncludes(addToPlanSheetSource, "mealApi.createPlan(body)");
expectExcludes(addToPlanSheetSource, "if (!item.recipeId) continue;");
expectIncludes(addToPlanSheetSource, "if (menuByVersion.has(recipeVersionId)) continue;");
expectIncludes(randomPageSource, "<AddToPlanSheet");
expectExcludes(randomPageSource, "createMyRecipeFromInspiration");

console.log("add to plan copy tests passed");
