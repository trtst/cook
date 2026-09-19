import assert from "node:assert/strict";
import test from "node:test";
import {
  COOK_ASSISTANT_LOADING_MAX_MS,
  COOK_ASSISTANT_LOADING_MIN_MS,
  getCookAssistantLoadingDuration,
  waitForCookAssistantLoading
} from "./cook-assistant-loading";

test("cook assistant loading duration stays in the short thinking window", () => {
  assert.equal(getCookAssistantLoadingDuration(() => 0), COOK_ASSISTANT_LOADING_MIN_MS);
  assert.equal(getCookAssistantLoadingDuration(() => 1), COOK_ASSISTANT_LOADING_MAX_MS);
  assert.ok(COOK_ASSISTANT_LOADING_MIN_MS >= 2500);
  assert.ok(COOK_ASSISTANT_LOADING_MAX_MS <= 3500);
});

test("cook assistant loading waits only for the remaining minimum time", async () => {
  const waited: number[] = [];

  await waitForCookAssistantLoading(
    1000,
    1200,
    () => 1100,
    async milliseconds => {
      waited.push(milliseconds);
    }
  );

  assert.deepEqual(waited, [1100]);
});
