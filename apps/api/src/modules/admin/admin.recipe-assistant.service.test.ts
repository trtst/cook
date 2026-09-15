import assert from "node:assert/strict";
import test from "node:test";
import { AdminService } from "./admin.service";
import type { RecipeContentSnapshot, RecipeImportRecipeBody } from "../../contracts/types";

function createService() {
  return new AdminService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );
}

function content(): RecipeContentSnapshot {
  return {
    name: "测试菜谱",
    story: "用于验证后台 Wiki 状态。",
    baseServings: 2,
    difficulty: "EASY",
    duration: "BETWEEN_15_30",
    estimatedCalories: null,
    tips: "按步骤完成。",
    keywords: [],
    tools: [{ name: "炒锅" }],
    ingredients: [{
      ingredientId: 1,
      ingredientName: "排骨",
      source: "SYSTEM",
      categoryId: 1,
      amount: {
        kind: "EXACT",
        quantity: "500",
        unitId: 1,
        unitName: "克",
        unitType: "WEIGHT"
      }
    }],
    steps: [{ text: "排骨焯水 8 分钟。", imageUrl: null }]
  };
}

function importedSteps(): NonNullable<RecipeImportRecipeBody["assistantSteps"]> {
  return [{
    order: 1,
    phase: "PREP",
    action: "BLANCH",
    title: "排骨焯水",
    detail: "排骨焯水后洗净。",
    imageUrl: null,
    durationMinutes: 8,
    durationText: "约 8 分钟"
  }];
}

function createAssistantTx(initialRecord: Record<string, unknown> | null = null, failFirstWrite = false) {
  let record = initialRecord;
  const writes: Array<Record<string, unknown>> = [];
  let shouldFailWrite = failFirstWrite;
  return {
    writes,
    tx: {
      recipeCookAssistant: {
        upsert: async ({ update, create }: { update: Record<string, unknown>; create: Record<string, unknown> }) => {
          if (shouldFailWrite) {
            shouldFailWrite = false;
            throw new Error("写入候选失败");
          }
          const data = record ? update : create;
          writes.push(data);
          const attemptCount = typeof (data.attemptCount as { increment?: number } | undefined)?.increment === "number"
            ? Number(record?.attemptCount ?? 0) + Number((data.attemptCount as { increment: number }).increment)
            : Number(data.attemptCount ?? record?.attemptCount ?? 0);
          record = {
            id: 1,
            recipeVersionId: 100,
            candidateJson: null,
            snapshotJson: null,
            generatedAt: null,
            lastAttemptAt: new Date("2026-09-13T00:00:00.000Z"),
            lastError: null,
            source: "AUTO",
            isLocked: false,
            updatedByAdminId: null,
            updatedAt: new Date("2026-09-13T00:00:00.000Z"),
            ...(record ?? {}),
            ...data,
            attemptCount
          };
          return record;
        },
        findUnique: async () => record
      }
    }
  };
}

test("admin assistant state distinguishes candidate content from a frontend-ready snapshot", () => {
  const service = createService();
  const state = (service as any).toRecipeAssistantState({
    status: "NEEDS_REVIEW",
    candidateJson: { steps: [] },
    snapshotJson: null,
    generatedAt: null,
    lastAttemptAt: new Date("2026-09-13T00:00:00.000Z"),
    attemptCount: 1,
    lastError: null
  });

  assert.equal(state.status, "NEEDS_REVIEW");
  assert.equal(state.hasCandidate, true);
  assert.equal(state.hasSnapshot, false);
  assert.equal(state.generatedAt, null);
});

test("admin rule-built assistant sync creates a review candidate and does not publish a frontend snapshot", async () => {
  const service = createService();
  const { tx, writes } = createAssistantTx();

  const state = await (service as any).syncRecipeAssistant(tx, 100, content());

  assert.equal(writes[0]?.status, "NEEDS_REVIEW");
  assert.ok(writes[0]?.candidateJson, "Expected generated content to be stored as a candidate");
  assert.equal(state.status, "NEEDS_REVIEW");
  assert.equal(state.hasCandidate, true);
  assert.equal(state.hasSnapshot, false);
});

test("admin imported assistant sync publishes READY only after candidate validation succeeds", async () => {
  const service = createService();
  const { tx, writes } = createAssistantTx();

  const state = await (service as any).syncRecipeAssistant(tx, 100, content(), importedSteps());

  assert.equal(writes[0]?.status, "READY");
  assert.ok(writes[0]?.candidateJson, "Expected imported Wiki to keep a candidate copy");
  assert.ok(writes[0]?.snapshotJson, "Expected validated imported Wiki to publish a snapshot");
  assert.ok(writes[0]?.generatedAt instanceof Date);
  assert.equal(state.status, "READY");
  assert.equal(state.hasCandidate, true);
  assert.equal(state.hasSnapshot, true);
});

test("admin candidate regeneration keeps the published READY snapshot available", async () => {
  const service = createService();
  const publishedAt = new Date("2026-09-12T12:00:00.000Z");
  const publishedSnapshot = { summary: { stepCount: 1 }, steps: [{ title: "旧版步骤" }] };
  const { tx, writes } = createAssistantTx({
    status: "READY",
    candidateJson: publishedSnapshot,
    snapshotJson: publishedSnapshot,
    generatedAt: publishedAt,
    attemptCount: 3
  });

  const state = await (service as any).syncRecipeAssistant(tx, 100, content());

  assert.equal(writes[0]?.status, "READY");
  assert.deepEqual(writes[0]?.snapshotJson, publishedSnapshot);
  assert.equal(writes[0]?.generatedAt, publishedAt);
  assert.equal(state.status, "READY");
  assert.equal(state.hasSnapshot, true);
  assert.equal(state.generatedAt, publishedAt.toISOString());
});

test("admin regeneration failure keeps the published READY snapshot available", async () => {
  const service = createService();
  const publishedAt = new Date("2026-09-12T12:00:00.000Z");
  const publishedSnapshot = { summary: { stepCount: 1 }, steps: [{ title: "旧版步骤" }] };
  const { tx, writes } = createAssistantTx({
    status: "READY",
    candidateJson: publishedSnapshot,
    snapshotJson: publishedSnapshot,
    generatedAt: publishedAt,
    attemptCount: 3
  }, true);

  const state = await (service as any).syncRecipeAssistant(tx, 100, content());

  assert.equal(writes[0]?.status, "READY");
  assert.deepEqual(writes[0]?.snapshotJson, publishedSnapshot);
  assert.equal(writes[0]?.generatedAt, publishedAt);
  assert.equal(writes[0]?.lastError, "写入候选失败");
  assert.equal(state.status, "READY");
  assert.equal(state.hasSnapshot, true);
});
