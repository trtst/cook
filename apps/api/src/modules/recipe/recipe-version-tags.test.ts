import assert from "node:assert/strict";
import test from "node:test";
import type { RecipeContentSnapshot } from "../../contracts/types";
import { buildAutoRecipeVersionTags, filterAutoRecipeVersionTags, buildImportedRecipeVersionTags, inferRecipeVersionTagSnapshot } from "./recipe-version-tags";

function content(name: string, ingredientId: number | null, ingredientName = "鸡蛋"): RecipeContentSnapshot {
  return {
    name,
    story: null,
    baseServings: 1,
    difficulty: null,
    duration: null,
    estimatedCalories: null,
    tips: null,
    keywords: [],
    ingredients: ingredientId === null
      ? []
      : [{
          ingredientId,
          ingredientName,
          source: "SYSTEM",
          categoryId: 1,
          amount: { kind: "FUZZY", text: "适量" }
        }],
    steps: []
  };
}

test("only deterministic ingredient facts create confirmed automatic tags", () => {
  const tags = buildAutoRecipeVersionTags(
    content("清蒸菜", 101),
    new Map([[101, { id: 101, proteinType: "EGG", categoryCode: "MEAT_POULTRY_EGG", isStaple: false, isSpicyIngredient: false, aliases: [] }]])
  );

  assert.equal(tags.find(tag => tag.tagCode === "PRIMARY_INGREDIENT")?.status, "CONFIRMED");
  assert.equal(tags.find(tag => tag.tagCode === "MAIN_PROTEIN_TYPE")?.status, "CONFIRMED");
});

test("title inference remains a candidate and cannot become a confirmed fact", () => {
  const tags = buildAutoRecipeVersionTags(content("牛奶豆浆早餐", null));

  assert.equal(tags.find(tag => tag.tagCode === "MEAL_TYPE")?.tagValue, "BREAKFAST");
  assert.equal(tags.find(tag => tag.tagCode === "MEAL_TYPE")?.status, "CANDIDATE");
  assert.equal(tags.some(tag => tag.status === "CONFIRMED"), false);
});

test("automatic regeneration does not duplicate a manually confirmed tag", () => {
  const tags = buildAutoRecipeVersionTags(
    content("番茄牛腩焖饭", 101),
    new Map([[101, { id: 101, proteinType: "BEEF", categoryCode: "MEAT_POULTRY_EGG", isStaple: true, isSpicyIngredient: false, aliases: [] }]])
  );

  const filtered = filterAutoRecipeVersionTags(tags, [
    { tagCode: "MAIN_PROTEIN_TYPE", tagValue: "BEEF", source: "OPS" },
    { tagCode: "DISH_ROLE", tagValue: "STAPLE", source: "OPS" }
  ]);

  assert.equal(filtered.some(tag => tag.tagCode === "MAIN_PROTEIN_TYPE" && tag.tagValue === "BEEF"), false);
  assert.equal(filtered.some(tag => tag.tagCode === "DISH_ROLE" && tag.tagValue === "STAPLE"), false);
});

test("manual dish role does not suppress a different automatic dish role", () => {
  const filtered = filterAutoRecipeVersionTags(
    [
      { tagCode: "DISH_ROLE", tagValue: "MAIN", source: "AUTO", status: "CANDIDATE" },
      { tagCode: "DISH_ROLE", tagValue: "STAPLE", source: "AUTO", status: "CANDIDATE" }
    ],
    [{ tagCode: "DISH_ROLE", tagValue: "MAIN", source: "OPS" }]
  );

  assert.equal(filtered.some(tag => tag.tagCode === "DISH_ROLE" && tag.tagValue === "MAIN"), false);
  assert.equal(filtered.some(tag => tag.tagCode === "DISH_ROLE" && tag.tagValue === "STAPLE"), true);
});

test("seasoning seafood facts do not become the recipe main protein", () => {
  const tags = buildAutoRecipeVersionTags(
    content("清蒸菜", 4063, "蚝油"),
    new Map([[4063, { id: 4063, proteinType: "SEAFOOD", categoryCode: "SEASONING", isStaple: false, isSpicyIngredient: false, aliases: [] }]])
  );

  assert.equal(tags.some(tag => tag.tagCode === "MAIN_PROTEIN_TYPE"), false);
});

test("role-aware protein inference ignores seafood seasonings in all recipe text", () => {
  const recipe = content("虾皮炒青菜", 4063, "虾皮");
  recipe.story = "加入虾皮提鲜。";
  recipe.steps = [{ text: "放入虾皮和青菜翻炒。", imageUrl: null }];
  recipe.ingredients = [
    { ...recipe.ingredients[0]!, recipeRole: "SEASONING" },
    { ingredientId: 5001, ingredientName: "青菜", source: "SYSTEM", categoryId: 1, recipeRole: "MAIN", amount: { kind: "FUZZY", text: "适量" } }
  ];

  const tags = buildAutoRecipeVersionTags(recipe, new Map([
    [4063, { id: 4063, proteinType: "SEAFOOD", categoryCode: "DRIED_PRESERVED", isStaple: false, isSpicyIngredient: false, aliases: [] }],
    [5001, { id: 5001, proteinType: "PLANT", categoryCode: "PRODUCE", isStaple: false, isSpicyIngredient: false, aliases: [] }]
  ]));

  assert.equal(tags.some(tag => tag.tagCode === "MAIN_PROTEIN_TYPE"), false);
  assert.equal(tags.some(tag => tag.tagCode === "PRIMARY_INGREDIENT" && tag.tagValue === "4063"), false);
  assert.equal(tags.some(tag => tag.tagCode === "PRIMARY_INGREDIENT" && tag.tagValue === "5001"), true);
});

test("manual protein facts suppress conflicting automatic protein tags", () => {
  const filtered = filterAutoRecipeVersionTags(
    [{ tagCode: "MAIN_PROTEIN_TYPE", tagValue: "FISH", source: "AUTO", status: "CANDIDATE" }],
    [{ tagCode: "MAIN_PROTEIN_TYPE", tagValue: "LAMB", source: "OPS" }]
  );

  assert.equal(filtered.length, 0);
});

test("imported tags become confirmed OPS facts without nutrition fields", () => {
  const tags = buildImportedRecipeVersionTags([
    { tagCode: "DISH_ROLE", tagValue: "COLD_DISH" },
    { tagCode: "MEAL_TYPE", tagValue: "DINNER" }
  ]);

  assert.deepEqual(tags, [
    { tagCode: "DISH_ROLE", tagValue: "COLD_DISH", source: "OPS", status: "CONFIRMED", confidence: 1, sortOrder: 0, isLocked: true },
    { tagCode: "MEAL_TYPE", tagValue: "DINNER", source: "OPS", status: "CONFIRMED", confidence: 1, sortOrder: 1, isLocked: true }
  ]);
});

test("explicit spice wording takes precedence over ingredient heuristics", () => {
  const recipe = content("干辣椒炒菜", 6101, "干辣椒");
  recipe.ingredients[0] = { ...recipe.ingredients[0]!, recipeRole: "SEASONING" };
  const facts = new Map([[6101, {
    id: 6101,
    proteinType: null,
    categoryCode: "SEASONING",
    isStaple: false,
    isSpicyIngredient: true,
    aliases: []
  }]]);

  assert.equal(inferRecipeVersionTagSnapshot({ ...recipe, story: "来源明确说明不辣" }, facts).spiceLevel, "NONE");
  assert.equal(inferRecipeVersionTagSnapshot({ ...recipe, story: "来源明确说明微辣" }, facts).spiceLevel, "MILD");
  assert.equal(inferRecipeVersionTagSnapshot({ ...recipe, story: "来源明确说明中辣" }, facts).spiceLevel, "MEDIUM");
});

test("ingredient names alone do not create a guessed spice level or spicy flavor", () => {
  const recipe = content("干辣椒炒菜", 6101, "干辣椒");
  recipe.ingredients[0] = { ...recipe.ingredients[0]!, recipeRole: "SEASONING" };
  const inferred = inferRecipeVersionTagSnapshot(recipe, new Map([[6101, {
    id: 6101,
    proteinType: null,
    categoryCode: "SEASONING",
    isStaple: false,
    isSpicyIngredient: true,
    aliases: []
  }]]));

  assert.equal(inferred.spiceLevel, null);
  assert.equal(inferred.flavorProfile.includes("SPICY"), false);
  assert.equal(inferRecipeVersionTagSnapshot({ ...recipe, story: "成品酸辣开胃" }).spiceLevel, null);
});
