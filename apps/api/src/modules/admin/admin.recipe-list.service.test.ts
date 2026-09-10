import assert from "node:assert/strict";
import test from "node:test";
import { AdminService } from "./admin.service";

test("system recipe list puts blocked recipes after recipes that are not blocked", async () => {
  const capture: { recipeQuery: { orderBy?: unknown } | null } = { recipeQuery: null };
  const prisma = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    recipe: {
      findMany: async (query: { orderBy?: unknown }) => {
        capture.recipeQuery = query;
        return [];
      },
      count: async () => 0
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations)
  };
  const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

  await service.listRecipes(1, 20, undefined, undefined, undefined, 1);

  assert.deepEqual(capture.recipeQuery?.orderBy, [
    { blockedAt: { sort: "asc", nulls: "first" } },
    { updatedAt: "desc" }
  ]);
});
