import assert from "node:assert/strict";
import test from "node:test";
import { buildImportedRecipeAssistantSnapshot, versionToContent } from "./recipe-content";

test("reads body keywords from the immutable recipe content version", () => {
  const content = versionToContent({
    name: "小炒黄牛肉",
    story: "湘味家常菜。",
    baseServings: 1,
    difficulty: "EASY",
    duration: "BETWEEN_15_30",
    tips: "大火快炒。",
    keywordsJson: ["鲜辣", "下饭"],
    toolsJson: [],
    ingredientsJson: [],
    stepsJson: []
  });

  assert.deepEqual(content.keywords, ["鲜辣", "下饭"]);
});

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
