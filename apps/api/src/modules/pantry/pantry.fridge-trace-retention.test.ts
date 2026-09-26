import assert from "node:assert/strict";
import test from "node:test";
import { PantryService } from "./pantry.service";

test("new food status keeps only the latest status, purchase, and use trace", async () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const rows: Array<Record<string, unknown> & { id: number; createdAt: Date }> = [
    { id: 1, userId: 9, ingredientId: 7, name: "芹菜", kind: "MANUAL_PRESENT", createdAt: new Date(now - 12 * day) },
    { id: 2, userId: 9, ingredientId: 7, name: "芹菜", kind: "PURCHASED", createdAt: new Date(now - 2 * day) },
    { id: 3, userId: 9, ingredientId: 7, name: "芹菜", kind: "USED", createdAt: new Date(now - day) }
  ];
  const removedIds: number[] = [];
  const tx = {
    $queryRaw: async () => [],
    ingredient: {
      findMany: async () => [{ id: 7, category: { name: "蔬果菌菇", code: "PRODUCE" } }]
    },
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    fridgeTrace: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const created = {
          id: 4,
          userId: 9,
          ...data,
          createdAt: new Date()
        } as Record<string, unknown> & { id: number; createdAt: Date };
        rows.push(created);
        return created;
      },
      findMany: async () => [...rows].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id - left.id),
      deleteMany: async ({ where }: { where: { id: { in: number[] } } }) => {
        removedIds.push(...where.id.in);
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (where.id.in.includes(rows[index].id)) rows.splice(index, 1);
        }
        return { count: where.id.in.length };
      }
    }
  };
  const service = new PantryService({
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx)
  } as never, {} as never, {} as never, {} as never);

  await service.markFridgeTraceEmpty(9, "123456", 7, "芹菜", "蔬果菌菇");

  assert.deepEqual(removedIds, [1]);
  assert.deepEqual(rows.map(row => [row.id, row.kind]), [
    [2, "PURCHASED"],
    [3, "USED"],
    [4, "MANUAL_EMPTY"]
  ]);
});
