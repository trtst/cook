import assert from "node:assert/strict";
import test from "node:test";
import { HomeService } from "./home.service";

function recipeRow({ id, currentVersionId, isInspiration, inspirationCategoryId = null, title }: {
  id: number;
  currentVersionId: number;
  isInspiration: boolean;
  inspirationCategoryId?: number | null;
  title: string;
}) {
  return {
    id,
    ownerId: isInspiration ? 9001 : 1001,
    title,
    coverImageUrl: null,
    isInspiration,
    inspirationCategoryId,
    currentVersionId,
    updatedAt: new Date("2026-09-23T00:00:00.000Z"),
    currentVersion: {
      name: title,
      story: null,
      baseServings: 2,
      difficulty: "EASY",
      duration: "WITHIN_15",
      tips: null,
      keywordsJson: [],
      toolsJson: [],
      ingredientsJson: [{ ingredientId: 501, name: "鸡腿", amount: { kind: "FUZZY", text: "适量" } }],
      stepsJson: []
    }
  };
}

test("home fridge recipes prefer the owned copy over its inspiration source", async () => {
  const inspiration = recipeRow({ id: 101, currentVersionId: 201, isInspiration: true, inspirationCategoryId: 301, title: "红烧鸡腿" });
  const owned = recipeRow({ id: 102, currentVersionId: 202, isInspiration: false, title: "红烧鸡腿" });
  const prisma = {
    recipe: {
      findMany: async (args: { where: { originVersionId?: { in: number[] } } }) =>
        args.where.originVersionId ? [{ id: owned.id, originVersionId: inspiration.currentVersionId }] : [inspiration, owned]
    },
    fridgeItem: {
      findMany: async () => [{ ingredientId: 501 }]
    }
  };
  const service = new HomeService(prisma as never, {} as never, {} as never);

  const result = await service.getFridgeRecipes(1001);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.kind, "MY");
  assert.equal(result.items[0]?.recipeId, owned.id);
});
