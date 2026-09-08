import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicInspirationRecipe,
  pickInspirationOwnerId,
  recipeInspirationOwnerCount
} from "./recipe-inspiration-owner";

test("only selects from an exactly 100-member inspiration owner pool", () => {
  const ownerIds = Array.from({ length: recipeInspirationOwnerCount }, (_, index) => index + 1);
  const selected = pickInspirationOwnerId(ownerIds);
  assert.equal(ownerIds.includes(selected), true);
});

test("rejects a missing or oversized inspiration owner pool", () => {
  assert.throws(() => pickInspirationOwnerId([1]), /正好包含 100 个用户/);
  assert.throws(() => pickInspirationOwnerId(Array.from({ length: 101 }, (_, index) => index + 1)), /正好包含 100 个用户/);
});

test("rejects a pool with duplicate user IDs", () => {
  const ownerIds = Array.from({ length: recipeInspirationOwnerCount }, (_, index) => index + 1);
  ownerIds[ownerIds.length - 1] = ownerIds[ownerIds.length - 2] as number;

  assert.throws(() => pickInspirationOwnerId(ownerIds), /100 个不同用户/);
});

test("classifies only marked categorized recipes as public inspiration", () => {
  assert.equal(isPublicInspirationRecipe({ isInspiration: true, inspirationCategoryId: 1, status: "ACTIVE" }), true);
  assert.equal(isPublicInspirationRecipe({ isInspiration: false, inspirationCategoryId: 1, status: "ACTIVE" }), false);
  assert.equal(isPublicInspirationRecipe({ isInspiration: true, inspirationCategoryId: null, status: "ACTIVE" }), false);
  assert.equal(isPublicInspirationRecipe({ isInspiration: true, inspirationCategoryId: 1, status: "BLOCKED" }), false);
});
