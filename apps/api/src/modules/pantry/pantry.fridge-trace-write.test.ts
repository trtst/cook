import assert from "node:assert/strict";
import test from "node:test";
import { PantryService } from "./pantry.service";

function createEmptyTraceFixture() {
  const traceRows: Array<Record<string, unknown>> = [];
  const maintenanceRows: Array<Record<string, unknown>> = [];
  let medalAwardCount = 0;
  const tx = {
    $queryRaw: async () => [],
    ingredient: { findMany: async () => [] },
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    fridgeTrace: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: traceRows.length + 1, ...data, createdAt: new Date() };
        traceRows.push(row);
        return row;
      },
      findMany: async () => [...traceRows],
      deleteMany: async () => ({ count: 0 })
    },
    fridgeMaintenanceEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        maintenanceRows.push(data);
        return data;
      }
    }
  };
  const service = new PantryService(
    { $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx) } as never,
    {} as never,
    {} as never,
    { awardFridgeMaintenance: async () => { medalAwardCount += 1; } } as never
  );

  return { service, traceRows, maintenanceRows, get medalAwardCount() { return medalAwardCount; } };
}

test("未知食材标记为没有时只记录状态，不计入食材维护勋章", async () => {
  const fixture = createEmptyTraceFixture();

  await fixture.service.markFridgeTraceEmpty(9, "123459", null, "香菜");

  assert.equal(fixture.traceRows.length, 1);
  assert.equal(fixture.maintenanceRows.length, 0);
  assert.equal(fixture.medalAwardCount, 0);
});

test("批量将未知食材标记为没有时不创建食材维护勋章事实", async () => {
  const fixture = createEmptyTraceFixture();

  await fixture.service.markFridgeTracesEmpty(9, "123460", [{ ingredientId: null, name: "香菜", categoryName: null }]);

  assert.equal(fixture.traceRows.length, 1);
  assert.equal(fixture.maintenanceRows.length, 0);
  assert.equal(fixture.medalAwardCount, 0);
});

test("已有食材从有更新为没有时仍计入食材维护", async () => {
  const fixture = createEmptyTraceFixture();

  await fixture.service.markFridgeTracePresent(9, "123461", null, "香菜", null);
  await fixture.service.markFridgeTraceEmpty(9, "123462", null, "香菜");

  assert.equal(fixture.maintenanceRows.length, 2);
  assert.equal(fixture.medalAwardCount, 2);
  assert.equal(fixture.traceRows.at(-1)?.kind, "MANUAL_EMPTY");
});

test("批量确认食材有状态使用单个幂等事务并按食材去重", async () => {
  let transactionCount = 0;
  const createdRows: Array<Record<string, unknown>> = [];
  const maintenanceRows: Array<Record<string, unknown>> = [];
  let medalAwardCount = 0;
  const tx = {
    $queryRaw: async () => [],
    ingredient: {
      findMany: async () => [{ id: 7, ownerId: null, status: "ACTIVE", category: { name: "蔬果菌菇", code: "PRODUCE" } }]
    },
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    fridgeTrace: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: createdRows.length + 1,
          ...data,
          kind: data.kind,
          createdAt: new Date("2026-09-24T00:00:00.000Z")
        };
        createdRows.push(row);
        return row;
      },
      findMany: async () => [...createdRows].sort((left, right) =>
        (right.createdAt as Date).getTime() - (left.createdAt as Date).getTime() || Number(right.id) - Number(left.id)
      ),
      deleteMany: async ({ where }: { where: { id: { in: number[] } } }) => {
        for (let index = createdRows.length - 1; index >= 0; index -= 1) {
          if (where.id.in.includes(Number(createdRows[index].id))) createdRows.splice(index, 1);
        }
        return { count: where.id.in.length };
      }
    },
    fridgeMaintenanceEvent: { create: async ({ data }: { data: Record<string, unknown> }) => { maintenanceRows.push(data); return data; } }
  };
  const service = new PantryService({
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) => {
      transactionCount += 1;
      return run(tx);
    }
  } as never, {} as never, {} as never, { awardFridgeMaintenance: async () => { medalAwardCount += 1; } } as never);

  const result = await service.markFridgeTracesPresent(9, "123456", [
    { ingredientId: 7, name: " 鸡蛋 ", categoryName: "肉禽蛋" },
    { ingredientId: 7, name: "鸡蛋", categoryName: "肉禽蛋" },
    { ingredientId: null, name: "香菜", categoryName: null }
  ]);

  assert.equal(transactionCount, 1);
  assert.equal(createdRows.length, 2);
  assert.equal(createdRows[0].categoryName, "蔬果菌菇");
  assert.equal(createdRows[0].categoryCode, "PRODUCE");
  assert.deepEqual(result.map(item => [item.ingredientId, item.name, item.kind]), [
    [7, "鸡蛋", "MANUAL_PRESENT"],
    [null, "香菜", "MANUAL_PRESENT"]
  ]);
  assert.deepEqual(result.map(item => item.windowDays), [7, 15]);

  const singlePresent = await service.markFridgeTracePresent(9, "123457", 7, "芹菜", "肉禽蛋");
  const singleEmpty = await service.markFridgeTraceEmpty(9, "123458", 7, "芹菜", "肉禽蛋");
  assert.equal(singlePresent.windowDays, 7);
  assert.equal(singleEmpty.windowDays, 7);
  assert.equal(maintenanceRows.length, 2);
  assert.equal(medalAwardCount, 2);
});

test("手动食材痕迹不关联其他用户的个人食材", async () => {
  const createdRows: Array<Record<string, unknown>> = [];
  let ingredientQuery: Record<string, unknown> | undefined;
  const tx = {
    $queryRaw: async () => [],
    ingredient: {
      findMany: async (args: Record<string, unknown>) => {
        ingredientQuery = args;
        return [];
      }
    },
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    fridgeTrace: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: 1, ...data, createdAt: new Date("2026-09-24T00:00:00.000Z") };
        createdRows.push(row);
        return row;
      },
      findMany: async () => [...createdRows],
      deleteMany: async () => ({ count: 0 })
    },
    fridgeMaintenanceEvent: { create: async () => ({}) }
  };
  const service = new PantryService({
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx)
  } as never, {} as never, {} as never, { awardFridgeMaintenance: async () => undefined } as never);

  await service.markFridgeTracePresent(9, "223456", 77, "私有食材", "蔬菜");

  assert.deepEqual(ingredientQuery, {
    where: {
      id: { in: [77] },
      status: "ACTIVE",
      OR: [{ ownerId: null }, { ownerId: 9 }]
    },
    select: { id: true, category: { select: { name: true, code: true } } }
  });
  assert.equal(createdRows[0]?.ingredientId, null);
  assert.equal(createdRows[0]?.categoryName, null);
  assert.equal(createdRows[0]?.categoryCode, null);
});
