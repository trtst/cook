import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { AdminService } from "./admin.service";

function createService() {
  return new AdminService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
}

function buildContent() {
  return {
    name: "番茄炒蛋",
    story: null,
    baseServings: 2,
    difficulty: "EASY",
    duration: "BETWEEN_15_30",
    estimatedCalories: null,
    tips: null,
    keywords: [],
    tools: [],
    ingredients: [{ ingredientId: 10000001, amount: { kind: "FUZZY", text: "适量" } }],
    steps: [{ text: "炒熟。", imageUrl: null, imageTempKey: null }]
  };
}

test("admin recipe writes reject 适量 for non-seasoning ingredients", async () => {
  const service = createService();
  const tx = {
    ingredient: {
      findMany: async () => [{
        id: 10000001,
        name: "番茄",
        ownerId: null,
        status: "ACTIVE",
        categoryId: 5001,
        category: { code: "PRODUCE" }
      }]
    },
    unit: {
      findMany: async () => []
    }
  };

  await assert.rejects(
    () => (service as any).buildAdminRecipeContent(tx, buildContent(), [null]),
    (error: unknown) => error instanceof BadRequestException && error.message === "仅调味料可使用“适量”"
  );
});
