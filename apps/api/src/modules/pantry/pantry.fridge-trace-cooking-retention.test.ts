import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { PantryService } from "./pantry.service";

test("已取消计划不能记录做饭食材痕迹", async () => {
  let traceWrites = 0;
  const plan = {
    id: 55,
    userId: 9,
    status: "CANCELLED",
    diningEvent: null,
    dishes: []
  };
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    mealPlanItem: { findUnique: async () => plan },
    fridgeTrace: { createMany: async () => { traceWrites += 1; return { count: 0 }; } }
  };
  const service = new PantryService({
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx)
  } as never, {} as never, {} as never, {} as never);

  await assert.rejects(
    service.completeMealCookingTrace(9, 55, "123457"),
    (error: unknown) => error instanceof ConflictException && /已取消计划/.test(error.message)
  );
  assert.equal(traceWrites, 0);
});

test("饭局完成写入用过痕迹后清理更旧的同食材痕迹", async () => {
  const rows: Array<Record<string, unknown> & { id: number; createdAt: Date }> = [
    { id: 1, userId: 9, ingredientId: 7, name: "青菜", kind: "MANUAL_PRESENT", createdAt: new Date("2026-09-01T00:00:00.000Z") },
    { id: 2, userId: 9, ingredientId: 7, name: "青菜", kind: "PURCHASED", createdAt: new Date("2026-09-22T00:00:00.000Z") },
    { id: 3, userId: 9, ingredientId: null, name: "香菜", kind: "USED", createdAt: new Date("2026-09-02T00:00:00.000Z") }
  ];
  const removedIds: number[] = [];
  let compactWhere: unknown;
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    mealPlanItem: {
      findUnique: async () => ({
        id: 55,
        userId: 9,
        diningEvent: null,
        dishes: [{
          recipeVersionId: 88,
          recipeVersion: {
            id: 88,
            name: "清炒青菜",
            ingredientsJson: [
              { ingredientId: 7, ingredientName: "青菜", categoryCode: "PRODUCE" },
              { ingredientId: null, ingredientName: " 香菜 ", categoryCode: "PRODUCE" }
            ]
          }
        }]
      })
    },
    ingredient: {
      findMany: async () => [{ id: 7, category: { name: "蔬菜", code: "PRODUCE" } }]
    },
    recipeContentVersion: { findMany: async () => [] },
    fridgeTrace: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        for (const item of data) {
          rows.push({ id: rows.length + 1, ...item, createdAt: item.createdAt as Date });
        }
        return { count: data.length };
      },
      findMany: async ({ where }: { where: unknown }) => {
        compactWhere = where;
        return [...rows].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id - left.id);
      },
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

  const result = await service.completeMealCookingTrace(9, 55, "123456");

  assert.equal(result.usedCount, 2);
  assert.deepEqual(removedIds.sort((left, right) => left - right), [1, 3]);
  assert.deepEqual(rows.map(row => row.kind).sort(), ["PURCHASED", "USED", "USED"]);
  assert.ok(rows.some(row => row.ingredientId === null && row.name === "香菜"));
  assert.deepEqual(compactWhere, {
    userId: 9,
    OR: [
      { ingredientId: { in: [7] } },
      { ingredientId: null, name: { in: ["香菜"], mode: "insensitive" } }
    ]
  });
});
