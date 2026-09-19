import assert from "node:assert/strict";
import { canReadRecipe, defaultRecipeTab } from "./recipe-access";

assert.equal(defaultRecipeTab(false), "inspiration");
assert.equal(defaultRecipeTab(true), "my");
assert.equal(canReadRecipe("inspiration", false), true);
assert.equal(canReadRecipe("my", false), true);
assert.equal(canReadRecipe("my", true), true);

console.log("recipe access state passed");
