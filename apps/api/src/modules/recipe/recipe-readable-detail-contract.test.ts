import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const controllerSource = readFileSync(resolve(__dirname, "recipe.controller.ts"), "utf8");
const serviceSource = readFileSync(resolve(__dirname, "recipe.service.ts"), "utf8");
const contractTypes = readFileSync(resolve(__dirname, "../../contracts/types.ts"), "utf8");
const openapi = readFileSync(resolve(__dirname, "../../contracts/openapi.ts"), "utf8");

test("recipe detail separates public content from owner-only personal data", () => {
  assert.match(contractTypes, /export interface RecipeDetailPersonal \{/);
  assert.match(contractTypes, /export interface RecipeDetail \{[\s\S]*personal: RecipeDetailPersonal \| null;/);
  assert.match(openapi, /export class RecipeDetailPersonalModel \{/);
  assert.match(openapi, /export class RecipeDetailModel \{[\s\S]*personal!: RecipeDetailPersonalModel \| null;/);
  assert.match(controllerSource, /@Get\("recipes\/:recipeId"\)[\s\S]*?@UseGuards\(OptionalUserAuthGuard\)/);
  assert.match(serviceSource, /const recipe = await this\.loadReadableRecipe\(this\.prisma, userId, recipeId\);/);
  assert.match(serviceSource, /private async loadReadableRecipe\(tx: RecipeDb, userId: UUID \| null, recipeId: UUID\)/);
  assert.match(serviceSource, /OR:\s*\[[\s\S]*publicInspirationRecipeWhere\("ACTIVE"\)[\s\S]*ownerId: userId/);
  assert.match(serviceSource, /return this\.toRecipeDetail\(/);
  assert.match(serviceSource, /const ownerRefs = ownedRecipe[\s\S]*loadRecipeEditRefs\(tx, ownedRecipe\.ownerId, baseContent\.ingredients\)/);
  assert.match(serviceSource, /const content = ownerRefs[\s\S]*normalizeRecipeEditContent\(baseContent, ownerRefs\.ingredientMap\)/);
});

console.log("recipe readable detail contract passed");
