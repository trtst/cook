import assert from "node:assert/strict";
import test from "node:test";
import { PantryService } from "./pantry.service";

test("共享清单成员勾选已买时仍写入清单所属用户的食材痕迹", async () => {
  const tracesCreated: Array<Record<string, unknown>> = [];
  const item = {
    id: 31,
    userId: 8,
    listId: 12,
    ingredientId: 44,
    name: "鸡蛋",
    quantityText: null,
    note: null,
    sourceType: "MANUAL",
    sourceKey: null,
    status: "OPEN",
    updatedAt: new Date("2026-09-24T00:00:00.000Z")
  };
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    shoppingItem: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.listId) return item;
        return where.userId === item.userId
          ? { id: item.id, ingredientId: item.ingredientId, name: item.name, ingredient: { category: { name: "蔬果菌菇", code: "PRODUCE" } } }
          : null;
      },
      update: async () => ({})
    },
    fridgeTrace: {
      deleteMany: async () => ({ count: 1 }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        tracesCreated.push(data);
        return data;
      },
      findMany: async () => tracesCreated.map((trace, index) => ({
        id: index + 1,
        ingredientId: item.ingredientId,
        name: item.name,
        kind: trace.kind,
        createdAt: new Date("2026-09-24T00:00:00.000Z")
      }))
    },
    shoppingList: { update: async () => ({}) }
  };
  const service = new PantryService({
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx)
  } as never, {} as never, {} as never, {} as never);
  Object.defineProperty(service, "assertShoppingListWritable", {
    value: async () => ({ id: 12, name: "共享清单", status: "ACTIVE", version: 1, ownerUserId: 8, role: "MEMBER" })
  });
  Object.defineProperty(service, "loadShoppingListItemPatchFromTx", { value: async () => ({}) });

  await service.updateShoppingListItemCheck(9, 12, 31, "operation-shared-bought", 1, true);

  assert.equal(tracesCreated.length, 1);
  assert.equal(tracesCreated[0].userId, 8);
});
