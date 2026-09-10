import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync(new URL("./reset-recipe-fixtures.ts", import.meta.url), "utf8");

test("fixture reset clears nullable recipe references before deleting recipes", () => {
  const clearPlanReference = script.indexOf("tx.mealPlanDish.updateMany");
  const clearEventReference = script.indexOf("tx.diningEventParticipant.updateMany");
  const deleteRecipes = script.indexOf("await tx.recipe.deleteMany({});");

  assert.ok(clearPlanReference >= 0, "Expected meal plan recipe references to be cleared");
  assert.ok(clearEventReference >= 0, "Expected dining event recipe references to be cleared");
  assert.ok(clearPlanReference < deleteRecipes, "Meal plan references must be cleared before recipe deletion");
  assert.ok(clearEventReference < deleteRecipes, "Dining event references must be cleared before recipe deletion");
});
