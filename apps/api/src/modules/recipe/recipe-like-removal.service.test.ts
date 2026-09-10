import assert from "node:assert/strict";
import test from "node:test";
import { RecipeService } from "./recipe.service";

function recipeRow() {
  return {
    id: 101,
    title: "番茄炒蛋",
    coverImageUrl: null,
    likeCount: 99,
    collectCount: 7,
    updatedAt: new Date("2026-09-07T01:00:00.000Z"),
    currentVersionId: 201,
    currentVersion: {
      name: "番茄炒蛋",
      story: null,
      baseServings: 2,
      difficulty: "EASY",
      duration: "WITHIN_15",
      estimatedCalories: 220,
      tips: null,
      keywordsJson: ["家常", "快手", "下饭", "四季"],
      ingredientsJson: [],
      stepsJson: []
    },
    inspirationCategory: {
      id: 301,
      name: "家常菜",
      iconKey: null
    },
    owner: null,
    category: null,
    sceneLinks: []
  };
}

test("inspiration recipe list does not expose recipe likes or sort by likes", async () => {
  const orderByCalls: unknown[] = [];
  const prisma = {
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
    recipe: {
      findMany: async (args: { orderBy: unknown }) => {
        orderByCalls.push(args.orderBy);
        return [recipeRow()];
      },
      count: async () => 1
    }
  };
  const service = new RecipeService(prisma as never, {} as never, {} as never, {} as never, {} as never);

  const result = await service.listInspirationRecipes(1, 20, undefined, undefined, "RECOMMENDED");

  assert.deepEqual(orderByCalls[0], [{ collectCount: "desc" }, { updatedAt: "desc" }, { id: "desc" }]);
  assert.equal("likeCount" in result.items[0], false);
  assert.equal(result.items[0].collectCount, 7);
  assert.deepEqual(result.items[0].keywords, ["家常", "快手", "下饭", "四季"]);
});
