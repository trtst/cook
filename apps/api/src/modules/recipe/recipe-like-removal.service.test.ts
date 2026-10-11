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

test("inspiration recipe summary keeps collectCount as a display aggregate", async () => {
  const prisma: any = {
    $queryRaw: async () => [{ id: 101 }],
    recipe: {
      findMany: async () => [recipeRow()],
      count: async () => 1
    }
  };
  prisma.$transaction = async (operation: ((tx: typeof prisma) => Promise<unknown>) | Array<Promise<unknown>>) =>
    typeof operation === "function" ? operation(prisma) : Promise.all(operation);
  const service = new RecipeService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

  const result = await service.listInspirationRecipes(1, 20, undefined, undefined, "RECOMMENDED");

  assert.equal("likeCount" in result.items[0], false);
  assert.equal(result.items[0].collectCount, 7);
  assert.deepEqual(result.items[0].keywords, ["家常", "快手", "下饭", "四季"]);
});

test("recommended inspiration list preserves the database ranking order after hydration", async () => {
  const rankedRows = [{ id: 102 }, { id: 101 }];
  const recipeRows = [
    { ...recipeRow(), id: 101 },
    { ...recipeRow(), id: 102 }
  ];
  let recommendationQuery: { strings: string[] } | null = null;
  const prisma: any = {
    $queryRaw: async (query: { strings: string[] }) => {
      recommendationQuery = query;
      return rankedRows;
    },
    recipe: {
      findMany: async () => recipeRows,
      count: async () => 2
    }
  };
  prisma.$transaction = async (operation: ((tx: typeof prisma) => Promise<unknown>) | Array<Promise<unknown>>) =>
    typeof operation === "function" ? operation(prisma) : Promise.all(operation);
  const service = new RecipeService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

  const result = await service.listInspirationRecipes(1, 20, undefined, undefined, "RECOMMENDED");

  assert.deepEqual(result.items.map(item => item.id), [102, 101]);
  const sql = (recommendationQuery as { strings: string[] } | null)?.strings.join("") ?? "";
  assert.match(sql, /COUNT\(DISTINCT c\.user_id\)/);
  assert.match(sql, /INTERVAL '30 days'/);
  assert.match(sql, /p\.status <> 'CANCELLED'/);
  assert.match(sql, /GROUP BY c\.source_recipe_id/);
  assert.match(sql, /LEAST\(COUNT\(\*\), 3\)/);
  assert.match(sql, /GROUP BY d\.recipe_id, p\.user_id/);
  assert.doesNotMatch(sql, /ROW_NUMBER\(\) OVER \(\s*PARTITION BY p\.user_id/);
  assert.match(sql, /2\.0 \* LN\(1\.0 \+ COALESCE\(plans\.plan_adds, 0\)\)/);
  assert.match(sql, /SELECT candidate\.id, candidate\.recommendation_rank, candidate\.published_at/);
  assert.match(sql, /COALESCE\(r\.inspiration_published_at, r\.created_at\)/);
  assert.match(sql, /INTERVAL '7 days'/);
  assert.match(sql, /WHEN 'STRONG_DOWNRANK' THEN 2/);
  assert.match(sql, /LEAST\(10,/);
  assert.match(sql, /ORDER BY position/);
});
