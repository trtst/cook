import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { RecipeAssistantSnapshot } from "../../contracts/types";
import { RecipeService } from "./recipe.service";

const generatedAt = new Date("2026-09-13T02:00:00.000Z");

const assistantBody: Omit<RecipeAssistantSnapshot, "generatedAt"> = {
  summary: {
    stepCount: 1,
    prepStepCount: 1,
    cookStepCount: 0,
    serveStepCount: 0,
    totalDurationText: "约 5 分钟"
  },
  steps: [
    {
      order: 1,
      phase: "PREP",
      action: "CUT",
      title: "切配",
      detail: "洗净切配。",
      imageUrl: null,
      durationMinutes: 5,
      durationText: "约 5 分钟"
    }
  ]
};

const readyAssistant = {
  status: "READY",
  generatedAt,
  snapshotJson: assistantBody
};

const expectedSnapshot: RecipeAssistantSnapshot = {
  generatedAt: generatedAt.toISOString(),
  summary: assistantBody.summary,
  steps: assistantBody.steps
};

class FakePrisma {
  accessibleRecipeVersions = new Set<number>();
  collectedRecipeVersions = new Set<number>();
  assistantByVersion = new Map<number, { status: string; generatedAt: Date | null; snapshotJson: unknown }>();
  assistantLookupCount = 0;

  recipe = {
    findFirst: async ({ where }: { where: { currentVersionId?: number } }) => {
      if (where.currentVersionId && this.accessibleRecipeVersions.has(where.currentVersionId)) {
        return { id: where.currentVersionId + 10 };
      }
      return null;
    }
  };

  recipeCollection = {
    findFirst: async ({ where }: { where: { sourceVersionId?: number } }) => {
      if (where.sourceVersionId && this.collectedRecipeVersions.has(where.sourceVersionId)) {
        return { id: where.sourceVersionId + 20 };
      }
      return null;
    }
  };

  recipeCookAssistant = {
    findUnique: async ({ where }: { where: { recipeVersionId: number } }) => {
      this.assistantLookupCount += 1;
      return this.assistantByVersion.get(where.recipeVersionId) ?? null;
    }
  };
}

class FakeCookAssistantAccess {
  unlockByVersion = new Map<number, { unlockedAt: Date }>();
  unlockCalls: Array<{ userId: number; recipeVersionId: number; operationId: string }> = [];

  async getRecipeVersionUnlock(_userId: number, recipeVersionId: number) {
    return this.unlockByVersion.get(recipeVersionId) ?? null;
  }

  async unlockRecipeVersion(userId: number, recipeVersionId: number, operationId: string) {
    this.unlockCalls.push({ userId, recipeVersionId, operationId });
    const existing = this.unlockByVersion.get(recipeVersionId);
    if (existing) {
      return {
        newlyUnlocked: false,
        unlockedAt: existing.unlockedAt.toISOString(),
        usage: {
          activityEnabled: true,
          businessDate: "2026-09-13",
          dailyUnlockLimit: 2,
          usedCount: 1,
          remainingCount: 1,
          resetsAt: "2026-09-13T16:00:00.000Z"
        }
      };
    }

    const unlockedAt = new Date("2026-09-13T03:00:00.000Z");
    this.unlockByVersion.set(recipeVersionId, { unlockedAt });
    return {
      newlyUnlocked: true,
      unlockedAt: unlockedAt.toISOString(),
      usage: {
        activityEnabled: true,
        businessDate: "2026-09-13",
        dailyUnlockLimit: 2,
        usedCount: 1,
        remainingCount: 1,
        resetsAt: "2026-09-13T16:00:00.000Z"
      }
    };
  }
}

function createService(prisma: FakePrisma, access = new FakeCookAssistantAccess()) {
  return {
    access,
    service: new RecipeService(prisma as never, access as never, {} as never, {} as never, {} as never, {} as never)
  };
}

test("hides single-recipe assistant body until the current user unlocks the fixed version", async () => {
  const prisma = new FakePrisma();
  prisma.accessibleRecipeVersions.add(201);
  prisma.assistantByVersion.set(201, readyAssistant);
  const { service, access } = createService(prisma);

  const locked = await service.getRecipeVersionCookAssistant(7, 201);
  assert.deepEqual(locked, {
    recipeVersionId: 201,
    status: "READY",
    unlocked: false,
    unlockedAt: null,
    generatedAt: generatedAt.toISOString(),
    assistant: null
  });

  const unlocked = await service.unlockRecipeVersionCookAssistant(7, 201, "1001");
  assert.equal(unlocked.newlyUnlocked, true);
  assert.equal(access.unlockCalls.length, 1);
  assert.deepEqual(unlocked.assistant, expectedSnapshot);

  const repeatedRead = await service.getRecipeVersionCookAssistant(7, 201);
  assert.equal(access.unlockCalls.length, 1);
  assert.equal(repeatedRead.unlocked, true);
  assert.deepEqual(repeatedRead.assistant, expectedSnapshot);
});

test("unlocks are scoped to the requested immutable recipe version", async () => {
  const prisma = new FakePrisma();
  prisma.accessibleRecipeVersions.add(201);
  prisma.accessibleRecipeVersions.add(202);
  prisma.assistantByVersion.set(201, readyAssistant);
  prisma.assistantByVersion.set(202, readyAssistant);
  const { service, access } = createService(prisma);

  await service.unlockRecipeVersionCookAssistant(7, 201, "1001");
  await service.unlockRecipeVersionCookAssistant(7, 202, "1002");

  assert.deepEqual(access.unlockCalls.map(item => item.recipeVersionId), [201, 202]);
});

test("does not unlock when the fixed version has no READY Wiki assistant", async () => {
  const prisma = new FakePrisma();
  prisma.accessibleRecipeVersions.add(201);
  prisma.assistantByVersion.set(201, {
    status: "NEEDS_REVIEW",
    generatedAt,
    snapshotJson: assistantBody
  });
  const { service, access } = createService(prisma);

  await assert.rejects(() => service.unlockRecipeVersionCookAssistant(7, 201, "1001"), ConflictException);
  assert.equal(access.unlockCalls.length, 0);
});

test("rejects hidden or inaccessible fixed recipe versions before reading assistant content", async () => {
  const prisma = new FakePrisma();
  prisma.assistantByVersion.set(201, readyAssistant);
  const { service } = createService(prisma);

  await assert.rejects(() => service.getRecipeVersionCookAssistant(7, 201), NotFoundException);
  assert.equal(prisma.assistantLookupCount, 0);
});

test("does not expose the legacy recipe-id assistant generation endpoint", () => {
  const controllerSource = readFileSync(join(process.cwd(), "src/modules/recipe/recipe.controller.ts"), "utf8");
  const serviceSource = readFileSync(join(process.cwd(), "src/modules/recipe/recipe.service.ts"), "utf8");

  assert.equal(controllerSource.includes('@Post("recipes/:recipeId/assistant")'), false);
  assert.equal(controllerSource.includes("generateMyRecipeAssistant("), false);
  assert.equal(serviceSource.includes("generateMyRecipeAssistant("), false);
  assert.equal(serviceSource.includes("recipe:assistant:generate"), false);
});

test("publishing either a new or edited recipe version registers it as pending for Wiki review", () => {
  const serviceSource = readFileSync(join(process.cwd(), "src/modules/recipe/recipe.service.ts"), "utf8");
  const publishVersionBlocks = serviceSource.split("const version = await tx.recipeContentVersion.create({").slice(1, 3);

  assert.equal(publishVersionBlocks.length, 2);
  for (const block of publishVersionBlocks) {
    assert.match(
      block,
      /await tx\.recipeCookAssistant\.create\(\{\s*data: \{\s*recipeVersionId: version\.id,\s*status: "PENDING"/s
    );
  }
});
