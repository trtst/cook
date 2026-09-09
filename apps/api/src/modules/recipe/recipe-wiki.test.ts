import assert from "node:assert/strict";
import test from "node:test";
import type { RecipeAssistantSnapshot, RecipeContentSnapshot, RecipeNutritionSummary } from "../../contracts/types";
import { buildRecipeWikiQualityCards } from "./recipe-wiki";

const content: RecipeContentSnapshot = {
  name: "海带排骨汤",
  story: "海带和排骨一起炖煮，汤味鲜美。",
  baseServings: 4,
  difficulty: "EASY",
  duration: "OVER_60",
  estimatedCalories: null,
  tips: "排骨先焯水。",
  tools: [{ name: "汤锅" }],
  ingredients: [{
    ingredientId: 101,
    ingredientName: "排骨",
    source: "SYSTEM",
    categoryId: 1,
    amount: { kind: "EXACT", quantity: "500", unitId: 201, unitName: "克", unitType: "WEIGHT" }
  }],
  steps: [{ text: "排骨焯水后洗净。", imageUrl: null }]
};

const nutrition: RecipeNutritionSummary = {
  status: "COMPLETE",
  qualityLabel: "估算较完整",
  perServing: { calories: 416, protein: 22, fat: 31.7, carbohydrate: 12.2 },
  perRecipe: { calories: 1664, protein: 88, fat: 126.8, carbohydrate: 48.8 },
  calculatedAt: "2026-09-08T00:00:00.000Z",
  sourceVersion: "cn-food-v1"
};

const assistant: RecipeAssistantSnapshot = {
  generatedAt: "2026-09-08T00:00:00.000Z",
  summary: { stepCount: 1, prepStepCount: 1, cookStepCount: 0, serveStepCount: 0, totalDurationText: "约 8 分钟" },
  steps: [{
    order: 1,
    phase: "PREP",
    action: "BLANCH",
    title: "排骨焯水",
    detail: "排骨焯水后洗净。",
    imageUrl: null,
    durationMinutes: 8,
    durationText: "约 8 分钟"
  }]
};

const tags = [
  ["MEAL_TYPE", "DINNER"],
  ["DISH_ROLE", "SOUP"],
  ["MAIN_PROTEIN_TYPE", "PORK"],
  ["FLAVOR_PROFILE", "LIGHT"],
  ["SPICE_LEVEL", "NONE"]
].map(([tagCode, tagValue]) => ({
  tagCode,
  tagValue,
  source: "OPS" as const,
  status: "CONFIRMED" as const,
  confidence: 1,
  sortOrder: 0,
  isLocked: true
}));

test("marks all Wiki quality cards complete when the current version is fully consumable", () => {
  const cards = buildRecipeWikiQualityCards({ content, tags, nutrition, assistant });

  assert.equal(cards.length, 7);
  assert.equal(cards.every(card => card.status === "COMPLETE" && card.score === 100 && card.blockingReasons.length === 0), true);
});

test("keeps nutrition and random-menu cards incomplete for missing facts", () => {
  const cards = buildRecipeWikiQualityCards({
    content,
    tags: tags.filter(tag => tag.tagCode !== "DISH_ROLE"),
    nutrition: { ...nutrition, status: "INSUFFICIENT", qualityLabel: "当前数据不足", perServing: null, perRecipe: null },
    assistant
  });

  assert.equal(cards.find(card => card.code === "NUTRITION")?.status, "INCOMPLETE");
  assert.equal(cards.find(card => card.code === "NUTRITION")?.blockingReasons.length, 1);
  assert.equal(cards.find(card => card.code === "RANDOM_MENU")?.status, "INCOMPLETE");
});
