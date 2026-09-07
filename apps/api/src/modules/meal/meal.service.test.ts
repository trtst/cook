import assert from "node:assert/strict";
import test from "node:test";
import { confirmedRandomTagValues, randomMenuEmptyLimitOptions, shouldConsumeRandomMenuQuota } from "./meal.service";

test("random tag reads ignore candidates and AI regardless of source priority", () => {
  const values = confirmedRandomTagValues(
    [
      { id: 1, tagValue: "BREAKFAST", source: "AI", status: "CANDIDATE", sortOrder: null },
      { id: 2, tagValue: "LUNCH", source: "AUTO", status: "CONFIRMED", sortOrder: null },
      { id: 3, tagValue: "DINNER", source: "OPS", status: "CANDIDATE", sortOrder: null }
    ],
    true
  );

  assert.deepEqual(values, ["LUNCH"]);
});

test("conflicting confirmed scalar tags are not silently resolved by source", () => {
  const values = confirmedRandomTagValues(
    [
      { id: 1, tagValue: "PORK", source: "AUTO", status: "CONFIRMED", sortOrder: null },
      { id: 2, tagValue: "BEEF", source: "OPS", status: "CONFIRMED", sortOrder: null }
    ],
    false
  );

  assert.deepEqual(values, []);
});

test("only a non-empty random result consumes quota", () => {
  assert.equal(shouldConsumeRandomMenuQuota([]), false);
  assert.equal(shouldConsumeRandomMenuQuota([{ recipeVersionId: 1 }]), true);
});

test("empty random result uses the confirmed user rate-limit window", () => {
  assert.deepEqual(randomMenuEmptyLimitOptions(42), {
    key: "random-menu:empty:42",
    limit: 10,
    windowMs: 60_000
  });
});
