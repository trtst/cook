import assert from "node:assert/strict";
import test from "node:test";
import { RecipeService } from "./recipe.service";

test("authenticated ingredient search keeps the keyword condition with source visibility", async () => {
  let capturedWhere: unknown;
  const prisma = {
    ingredient: {
      findMany: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return [];
      },
      count: async () => 0
    },
    $transaction: async (queries: Promise<unknown>[]) => Promise.all(queries)
  };
  const service = new RecipeService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

  await service.listIngredients({}, 123, 1, 20, "猪肝");

  assert.deepEqual(capturedWhere, {
    AND: [
      {
        OR: [
          { searchKey: { contains: "猪肝" } },
          { aliases: { has: "猪肝" } },
          {
            mergedFrom: {
              some: {
                status: "MERGED",
                OR: [
                  { searchKey: { contains: "猪肝" } },
                  { aliases: { has: "猪肝" } }
                ]
              }
            }
          }
        ]
      },
      {
        OR: [
          { ownerId: null, status: "ACTIVE", category: { is: { isSelectable: true } } },
          { ownerId: 123, status: "ACTIVE" }
        ]
      }
    ]
  });
});
