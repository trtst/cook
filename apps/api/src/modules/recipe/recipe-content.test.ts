import assert from "node:assert/strict";
import test from "node:test";
import { buildImportedRecipeAssistantSnapshot, versionAssistantToSnapshot, versionToContent } from "./recipe-content";

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

test("normalizes historical fuzzy recipe amounts to 适量 when reading a version", () => {
  const content = versionToContent({
    name: "历史菜谱",
    story: null,
    baseServings: 1,
    difficulty: "EASY",
    duration: "WITHIN_15",
    tips: null,
    keywordsJson: [],
    toolsJson: [],
    ingredientsJson: [{
      ingredientId: 1,
      ingredientName: "盐",
      source: "SYSTEM",
      categoryId: 1,
      amount: { kind: "FUZZY", text: "少许" }
    }],
    stepsJson: []
  });

  assert.deepEqual(content.ingredients[0]?.amount, { kind: "FUZZY", text: "适量" });
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

test("does not expose candidate assistant snapshots before READY", () => {
  const snapshot = versionAssistantToSnapshot({
    status: "NEEDS_REVIEW",
    generatedAt: new Date("2026-09-13T00:00:00.000Z"),
    snapshotJson: buildImportedRecipeAssistantSnapshot([
      {
        order: 1,
        phase: "PREP",
        action: "CUT",
        title: "备菜",
        detail: "洗净切配。",
        imageUrl: null,
        durationMinutes: 5,
        durationText: "约 5 分钟"
      }
    ])
  });

  assert.equal(snapshot, null);
});
