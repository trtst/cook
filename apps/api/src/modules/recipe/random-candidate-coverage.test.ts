import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateCoverageKeysFromConfirmedRecipeTags,
  missingRandomCandidateSlotTypes,
  requiredRandomCandidateCoverage
} from "./random-candidate-coverage";

test("confirmed egg fact supports breakfast protein without title fallback", () => {
  assert.deepEqual(
    candidateCoverageKeysFromConfirmedRecipeTags([
      { tagCode: "MEAL_TYPE", tagValue: "BREAKFAST" },
      { tagCode: "DISH_ROLE", tagValue: "VEGETABLE" },
      { tagCode: "MAIN_PROTEIN_TYPE", tagValue: "NONE" }
    ]),
    ["BREAKFAST:BREAKFAST_PROTEIN"]
  );
});

test("candidate coverage keeps lunch and dinner requirements separate", () => {
  const counts = new Map(requiredRandomCandidateCoverage.map(item => [item.key, 0]));
  counts.set("LUNCH:MEAT", 1);

  assert.deepEqual(missingRandomCandidateSlotTypes(counts), [
    "BREAKFAST:BREAKFAST_STAPLE",
    "BREAKFAST:BREAKFAST_PROTEIN",
    "BREAKFAST:BREAKFAST_SIDE",
    "LUNCH:VEGETABLE",
    "LUNCH:SOUP",
    "LUNCH:STAPLE",
    "DINNER:MEAT",
    "DINNER:VEGETABLE",
    "DINNER:SOUP",
    "DINNER:STAPLE"
  ]);
});
