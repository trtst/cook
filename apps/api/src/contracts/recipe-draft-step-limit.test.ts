import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { RecipeDraftContentDto } from "./dtos";

function draftWithSteps(count: number) {
  return plainToInstance(RecipeDraftContentDto, {
    name: "番茄炒蛋",
    story: null,
    categoryId: null,
    sceneIds: [],
    coverUploadId: null,
    coverImageUrl: null,
    baseServings: null,
    difficulty: null,
    duration: null,
    tips: null,
    ingredients: [],
    steps: Array.from({ length: count }, (_, index) => ({
      slotKey: `step-${index + 1}`,
      text: "",
      uploadId: null,
      imageUrl: null
    }))
  });
}

test("user recipe drafts accept 20 steps and reject 21", () => {
  const validErrors = validateSync(draftWithSteps(20));
  const invalidErrors = validateSync(draftWithSteps(21));

  assert.equal(validErrors.find(error => error.property === "steps")?.constraints?.arrayMaxSize, undefined);
  assert.equal(typeof invalidErrors.find(error => error.property === "steps")?.constraints?.arrayMaxSize, "string");
});
