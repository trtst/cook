import assert from "node:assert/strict";
import test from "node:test";
import { invalidateMergedIngredientRecommendationCaches } from "./ingredient-merge-cache";

test("ingredient merge invalidates recommendation caches for users with merged-ingredient traces", async () => {
  let cacheDelete: unknown;
  const tx = {
    fridgeTrace: {
      findMany: async (query: unknown) => {
        assert.deepEqual(query, {
          where: { ingredientId: { in: [501, 502] } },
          distinct: ["userId"],
          select: { userId: true }
        });
        return [{ userId: 10 }, { userId: 20 }];
      }
    },
    homeFridgeRecommendationCache: {
      deleteMany: async (query: unknown) => { cacheDelete = query; }
    }
  };

  await invalidateMergedIngredientRecommendationCaches(tx as never, [501, 502]);

  assert.deepEqual(cacheDelete, { where: { userId: { in: [10, 20] } } });
});
