import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { normalizeRecipeKeywords } from "./recipe-keywords";

const recipeApiSource = readFileSync(resolve(import.meta.dirname, "./recipe.ts"), "utf8");

test("normalizes a missing recipe keyword list before cards read its length", () => {
  assert.deepEqual(normalizeRecipeKeywords(undefined), []);
  assert.deepEqual(normalizeRecipeKeywords(null), []);
  assert.deepEqual(normalizeRecipeKeywords(["家常", "快手"]), ["家常", "快手"]);
});

test("recipe details expose assistant availability instead of embedding assistant json", () => {
  assert.match(recipeApiSource, /assistantAvailable: boolean/);
  for (const name of ["MyRecipeDetail", "CollectedRecipeDetail", "InspirationRecipeDetail"]) {
    const match = recipeApiSource.match(new RegExp(`export interface ${name} \\{[\\s\\S]*?\\n\\}`));
    assert.ok(match, `missing ${name}`);
    assert.match(match[0], /assistantAvailable: boolean/);
    assert.doesNotMatch(match[0], /assistant: RecipeAssistantSnapshot \| null/);
  }
});

test("single recipe cook assistant uses fixed recipe version endpoints", () => {
  assert.match(recipeApiSource, /interface RecipeCookAssistantResponse/);
  assert.match(recipeApiSource, /interface UnlockRecipeCookAssistantResponse/);
  assert.match(recipeApiSource, /getRecipeVersionCookAssistant\(recipeVersionId: UUID\)/);
  assert.match(recipeApiSource, /unlockRecipeVersionCookAssistant\(recipeVersionId: UUID, body:/);
  assert.match(recipeApiSource, /recipe-versions\/\$\{encodeURIComponent\(String\(recipeVersionId\)\)\}\/cook-assistant/);
  assert.match(recipeApiSource, /idempotencyKey: body\.operationId/);
  assert.doesNotMatch(recipeApiSource, /generateMyRecipeAssistant/);
  assert.doesNotMatch(recipeApiSource, /\/recipes\/\$\{encodeURIComponent\(String\(recipeId\)\)\}\/assistant/);
});
