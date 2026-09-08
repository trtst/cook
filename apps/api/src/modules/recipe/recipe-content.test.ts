import assert from "node:assert/strict";
import test from "node:test";
import { buildImportedRecipeAssistantSnapshot } from "./recipe-content";

test("builds an imported assistant snapshot without changing source facts", () => {
  const snapshot = buildImportedRecipeAssistantSnapshot([
    {
      order: 1,
      phase: "PREP",
      action: "BLANCH",
      title: "排骨焯水",
      detail: "排骨焯水后洗净。",
      imageUrl: null,
      durationMinutes: 8,
      durationText: "约 8 分钟"
    },
    {
      order: 2,
      phase: "SERVE",
      action: "PLATE",
      title: "盛汤",
      detail: "盛入汤碗。",
      imageUrl: null,
      durationMinutes: 5,
      durationText: null
    }
  ]);

  assert.equal(snapshot.summary.stepCount, 2);
  assert.equal(snapshot.summary.prepStepCount, 1);
  assert.equal(snapshot.summary.serveStepCount, 1);
  assert.equal(snapshot.steps[0]?.action, "BLANCH");
  assert.equal(snapshot.steps[1]?.action, "PLATE");
  assert.equal(snapshot.steps[0]?.durationMinutes, 8);
  assert.equal(snapshot.summary.totalDurationText, "约 13 分钟");
});
