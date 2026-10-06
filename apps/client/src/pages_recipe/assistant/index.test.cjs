const { readFileSync } = require("fs");
const { resolve } = require("path");
const assert = require("assert").strict;
const test = typeof globalThis.test === "function" ? globalThis.test : require("node:test");

const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const recipeApiSource = readFileSync(resolve(__dirname, "../../apis/recipe.ts"), "utf8");
const appConfigStoreSource = readFileSync(resolve(__dirname, "../../stores/app-config.ts"), "utf8");

test("single recipe assistant page reads fixed-version assistant and activity usage", () => {
  assert.match(pageSource, /import Empty from "@\/components\/Empty\/Empty\.vue";/);
  assert.match(pageSource, /useSessionStore/);
  assert.match(pageSource, /useLoginEmptyState/);
  assert.match(pageSource, /title="登录后查看做饭助手"/);
  assert.match(pageSource, /recipeVersionId/);
  assert.match(pageSource, /recipeApi\.getRecipeVersionCookAssistant/);
  assert.match(pageSource, /recipeApi\.unlockRecipeVersionCookAssistant/);
  assert.match(pageSource, /userApi\.getCookAssistantUsage/);
  assert.match(pageSource, /useAppConfigStore/);
  assert.match(appConfigStoreSource, /cookAssistant/);
});

test("single recipe assistant page shows activity tips and bounded first-unlock thinking loading", () => {
  assert.match(pageSource, /活动期间，免费生成，每天 2 次，当日有效/);
  assert.match(pageSource, /tipsText/);
  assert.match(pageSource, /newlyUnlocked/);
  assert.match(pageSource, /thinkingTimer/);
  assert.match(pageSource, /Math\.random/);
  assert.match(pageSource, /setTimeout/);
  assert.match(pageSource, /clearTimeout/);
});

test("single recipe assistant page renders generated time and three phase steps", () => {
  assert.match(pageSource, /generatedAt/);
  assert.match(pageSource, /PREP/);
  assert.match(pageSource, /COOK/);
  assert.match(pageSource, /SERVE/);
  assert.match(pageSource, /准备/);
  assert.match(pageSource, /烹饪/);
  assert.match(pageSource, /上桌/);
});

test("single recipe assistant page handles quota, disabled activity, unavailable wiki, and retry", () => {
  assert.match(pageSource, /remainingCount/);
  assert.match(pageSource, /activityEnabled/);
  assert.match(pageSource, /ApiClientError/);
  assert.match(pageSource, /code === 409/);
  assert.match(pageSource, /code === 429/);
  assert.match(pageSource, /if \(error instanceof UnauthorizedError\) \{[\s\S]*openLogin\(\)/);
  assert.match(pageSource, /retry/);
});

test("single recipe assistant API exposes fixed-version read and unlock contracts", () => {
  assert.match(recipeApiSource, /getRecipeVersionCookAssistant\(recipeVersionId: UUID\)/);
  assert.match(recipeApiSource, /unlockRecipeVersionCookAssistant\(recipeVersionId: UUID, body:/);
  assert.match(recipeApiSource, /newlyUnlocked: boolean/);
});

test("single recipe assistant enters the shared cook mode with assistant flow", () => {
  assert.match(pageSource, /flow=assistant/);
  assert.match(pageSource, /recipeVersionId=/);
});
