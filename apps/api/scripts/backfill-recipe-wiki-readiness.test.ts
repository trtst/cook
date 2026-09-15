import assert from "node:assert/strict";
import test from "node:test";
import {
  backfillRecipeWikiReadiness,
  candidateReadiness,
  parseRecipeWikiReadinessArgs
} from "./backfill-recipe-wiki-readiness";

const readyCandidate = {
  summary: {
    stepCount: 3,
    prepStepCount: 1,
    cookStepCount: 1,
    serveStepCount: 1,
    totalDurationText: "约 18 分钟"
  },
  steps: [
    {
      order: 1,
      phase: "PREP",
      action: "CUT",
      title: "切配",
      detail: "洗净切好。",
      imageUrl: null,
      durationMinutes: 5,
      durationText: "约 5 分钟"
    },
    {
      order: 2,
      phase: "COOK",
      action: "STIR_FRY",
      title: "翻炒",
      detail: "热锅翻炒。",
      imageUrl: "https://cdn.example/step.jpg",
      durationMinutes: 10,
      durationText: "约 10 分钟"
    },
    {
      order: 3,
      phase: "SERVE",
      action: "PLATE",
      title: "装盘",
      detail: "盛出上桌。",
      imageUrl: null,
      durationMinutes: 3,
      durationText: "约 3 分钟"
    }
  ]
};
const candidateUpdatedAt = new Date("2026-09-13T01:00:00.000Z");

test("validates a complete candidate as READY without inventing generated time", () => {
  const result = candidateReadiness(readyCandidate);

  assert.equal(result.status, "READY");
  assert.deepEqual(result.blockingReasons, []);
  assert.deepEqual(result.snapshotJson, readyCandidate);
});

test("keeps invalid candidates in NEEDS_REVIEW with explicit blocking reasons", () => {
  const result = candidateReadiness({
    ...readyCandidate,
    summary: { ...readyCandidate.summary, cookStepCount: 0 },
    steps: [
      { ...readyCandidate.steps[0], durationMinutes: 0 },
      { ...readyCandidate.steps[2], order: 4 }
    ]
  });

  assert.equal(result.status, "NEEDS_REVIEW");
  assert.ok(result.blockingReasons.some(reason => reason.includes("durationMinutes")));
  assert.ok(result.blockingReasons.some(reason => reason.includes("order")));
  assert.ok(result.blockingReasons.some(reason => reason.includes("summary")));
  assert.equal(result.snapshotJson, null);
});

test("dry-run reports candidates but does not persist readiness changes", async () => {
  const savedIds: number[] = [];
  const result = await backfillRecipeWikiReadiness({
    apply: false,
    now: new Date("2026-09-13T02:00:00.000Z"),
    records: [
      { id: 1, recipeVersionId: 10000000, candidateJson: readyCandidate, updatedAt: candidateUpdatedAt },
      { id: 2, recipeVersionId: 10000001, candidateJson: { steps: [] }, updatedAt: candidateUpdatedAt }
    ],
    saveReady: async record => {
      savedIds.push(record.id);
      return true;
    }
  });

  assert.equal(result.mode, "dry-run");
  assert.equal(result.scannedCount, 2);
  assert.equal(result.readyCount, 1);
  assert.equal(result.needsReviewCount, 1);
  assert.deepEqual(savedIds, []);
});

test("apply persists only READY candidates with generated time", async () => {
  const saved: Array<{ id: number; generatedAt: Date }> = [];
  const now = new Date("2026-09-13T02:00:00.000Z");
  const result = await backfillRecipeWikiReadiness({
    apply: true,
    now,
    records: [
      { id: 1, recipeVersionId: 10000000, candidateJson: readyCandidate, updatedAt: candidateUpdatedAt },
      { id: 2, recipeVersionId: 10000001, candidateJson: { steps: [] }, updatedAt: candidateUpdatedAt }
    ],
    saveReady: async record => {
      saved.push({ id: record.id, generatedAt: record.generatedAt });
      return true;
    }
  });

  assert.equal(result.mode, "apply");
  assert.equal(result.appliedCount, 1);
  assert.deepEqual(saved, [{ id: 1, generatedAt: now }]);
});

test("apply reports a concurrent candidate change instead of counting it as published", async () => {
  const result = await backfillRecipeWikiReadiness({
    apply: true,
    now: new Date("2026-09-13T02:00:00.000Z"),
    records: [{ id: 1, recipeVersionId: 10000000, candidateJson: readyCandidate, updatedAt: candidateUpdatedAt }],
    saveReady: async () => false
  });

  assert.equal(result.readyCount, 1);
  assert.equal(result.appliedCount, 0);
  assert.equal(result.concurrentChangeCount, 1);
  assert.deepEqual(result.concurrentChangeVersionIds, [10000000]);
  assert.equal(result.nextStep, "Re-run with --apply for candidates changed during this run.");
});

test("argument parsing defaults to dry-run and requires positive numeric limits", () => {
  assert.deepEqual(parseRecipeWikiReadinessArgs([]), { apply: false, batchSize: 100, limit: null });
  assert.deepEqual(parseRecipeWikiReadinessArgs(["--apply", "--batch-size=20", "--limit=40"]), {
    apply: true,
    batchSize: 20,
    limit: 40
  });
  assert.throws(() => parseRecipeWikiReadinessArgs(["--batch-size=0"]), /--batch-size/);
  assert.throws(() => parseRecipeWikiReadinessArgs(["--limit=x"]), /--limit/);
});
