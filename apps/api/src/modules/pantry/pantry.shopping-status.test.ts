import assert from "node:assert/strict";
import test from "node:test";
import { PantryService } from "./pantry.service";

function createService() {
  return new PantryService({} as never, {} as never, {} as never, {} as never);
}

function idempotencyTx() {
  return {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    }
  };
}

test("deleting one shopping item releases its active fridge reservations", async () => {
  const releasedIds: string[] = [];
  const tx = {
    ...idempotencyTx(),
    shoppingItem: {
      findUnique: async () => ({ id: "item-1", userId: 9, listId: "list-1" }),
      update: async () => ({
        id: "item-1",
        name: "鸡蛋",
        quantityText: "2个",
        note: null,
        sourceType: "EVENT" as const,
        sourceKey: "event-1",
        status: "DELETED" as const,
        updatedAt: new Date()
      })
    },
    shoppingItemFridgeReservation: {
      updateMany: async ({ where }: { where: { shoppingItemId: { in: string[] } } }) => {
        releasedIds.push(...where.shoppingItemId.in);
        return { count: where.shoppingItemId.in.length };
      }
    },
    storageLedger: {
      deleteMany: async () => ({ count: 1 })
    },
    shoppingList: {
      update: async () => ({})
    }
  };
  const service = createService();
  (service as any).prisma = {
    $transaction: async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx)
  };

  await (service as any).updateShoppingStatus(9, "item-1", "operation-1", "DELETED");

  assert.deepEqual(releasedIds, ["item-1"]);
});

test("deleting a shopping group releases reservations for every item", async () => {
  const releasedIds: string[] = [];
  const tx = {
    ...idempotencyTx(),
    shoppingItem: {
      findMany: async (args: { select?: { listId?: boolean } }) =>
        args.select?.listId ? [{ listId: "list-1" }] : [{ id: "item-1", userId: 9 }, { id: "item-2", userId: 9 }],
      updateMany: async () => ({ count: 2 })
    },
    shoppingItemFridgeReservation: {
      updateMany: async ({ where }: { where: { shoppingItemId: { in: string[] } } }) => {
        releasedIds.push(...where.shoppingItemId.in);
        return { count: where.shoppingItemId.in.length };
      }
    },
    storageLedger: {
      deleteMany: async () => ({ count: 1 })
    },
    shoppingList: {
      update: async () => ({})
    }
  };
  const service = createService();
  (service as any).loadShoppingBoardFromTx = async () => ({ ingredientGroups: [], recipeGroups: [], otherItems: [] });
  (service as any).prisma = {
    $transaction: async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx)
  };

  await (service as any).updateShoppingGroupStatus(9, "operation-2", "ingredient:7", "DELETED");

  assert.deepEqual(releasedIds, ["item-1", "item-2"]);
});
