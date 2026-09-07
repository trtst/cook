import assert from "node:assert/strict";
import test from "node:test";
import type { RecipeContentSnapshot } from "../../contracts/types";
import { buildAutoRecipeVersionTags } from "./recipe-version-tags";

function content(name: string, ingredientId: number | null): RecipeContentSnapshot {
  return {
    name,
    story: null,
    baseServings: 1,
    difficulty: null,
    duration: null,
    estimatedCalories: null,
    tips: null,
    ingredients: ingredientId === null
      ? []
      : [{
          ingredientId,
          ingredientName: "鸡蛋",
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
    new Map([[101, { id: 101, proteinType: "EGG", isStaple: false, isSpicyIngredient: false, aliases: [] }]])
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
