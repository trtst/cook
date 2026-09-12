import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const recipeService = readFileSync(resolve(__dirname, "recipe.service.ts"), "utf8");
const contractTypes = readFileSync(resolve(__dirname, "../../contracts/types.ts"), "utf8");
const openapi = readFileSync(resolve(__dirname, "../../contracts/openapi.ts"), "utf8");

test("inspiration recipe detail exposes the immutable owner snapshot instead of curatedByName", () => {
  assert.match(contractTypes, /export interface RecipeOwnerSummary \{\s+uid: number;\s+nickname: string \| null;/s);
  assert.match(contractTypes, /export interface InspirationRecipeDetail \{[\s\S]*owner: RecipeOwnerSummary;/);
  assert.match(recipeService, /owner: \{\s+uid: recipe\.owner\.uid,\s+nickname: recipe\.ownerNicknameSnapshot\s+\}/s);
  assert.match(openapi, /export class RecipeOwnerModel \{/);
  assert.doesNotMatch(contractTypes, /curatedByName/);
});
