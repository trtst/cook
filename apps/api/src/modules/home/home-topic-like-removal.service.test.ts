import assert from "node:assert/strict";
import test from "node:test";
import { HomeTopicService } from "./home-topic.service";

function recipeRow() {
  return {
    id: 101,
    title: "红烧鸡腿",
    coverImageUrl: null,
    likeCount: 88,
    collectCount: 6,
    currentVersionId: 201,
    updatedAt: new Date("2026-09-07T02:00:00.000Z"),
    currentVersion: {
      difficulty: "EASY",
      duration: "BETWEEN_15_30"
    },
    inspirationCategory: {
      id: 301,
      name: "家常菜",
      iconKey: null
    }
  };
}

test("home topic recipe search does not expose recipe likes or sort by likes", async () => {
  const orderByCalls: unknown[] = [];
  const prisma = {
    recipe: {
      findMany: async (args: { orderBy: unknown }) => {
        orderByCalls.push(args.orderBy);
        return [recipeRow()];
      }
    }
  };
  const service = new HomeTopicService(prisma as never, {} as never, {} as never);

  const result = await service.searchRecipes();

  assert.deepEqual(orderByCalls[0], [{ collectCount: "desc" }, { updatedAt: "desc" }, { id: "desc" }]);
  assert.equal("likeCount" in result.items[0], false);
  assert.equal(result.items[0].collectCount, 6);
});
