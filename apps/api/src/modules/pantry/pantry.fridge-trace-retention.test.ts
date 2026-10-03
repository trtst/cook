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
  const maintenanceEvents: Array<Record<string, unknown>> = [];
  let medalAwardCount = 0;
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
      deleteMany: async ({ where }: { where: { id?: { in: number[] }; userId?: number; OR?: Array<{ ingredientId?: number; name?: { equals: string; mode: string } }> } }) => {
        if (where.id) {
          removedIds.push(...where.id.in);
          for (let index = rows.length - 1; index >= 0; index -= 1) {
            if (where.id.in.includes(rows[index].id)) rows.splice(index, 1);
          }
          return { count: where.id.in.length };
        }
        const matches = rows.filter(row => row.userId === where.userId && where.OR?.some(identity =>
          identity.ingredientId !== undefined
            ? row.ingredientId === identity.ingredientId
            : row.ingredientId === null && String(row.name).toLocaleLowerCase() === identity.name?.equals.toLocaleLowerCase()
        ));
        removedIds.push(...matches.map(row => row.id));
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (matches.some(row => row.id === rows[index].id)) rows.splice(index, 1);
        }
        return { count: matches.length };
      }
    },
    fridgeMaintenanceEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        maintenanceEvents.push(data);
        return data;
      }
    }
  };
  const service = new PantryService({
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx)
  } as never, {} as never, {} as never, { awardFridgeMaintenance: async () => { medalAwardCount += 1; } } as never);

  const result = await service.removeFridgeTrace(9, "123456", 7, "芹菜", "蔬果菌菇");

  assert.deepEqual(result, { deletedCount: 3 });
  assert.deepEqual(removedIds, [1, 2, 3]);
  assert.deepEqual(rows, []);
  assert.equal(maintenanceEvents.length, 0);
  assert.equal(medalAwardCount, 0);
});
