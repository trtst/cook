import assert from "node:assert/strict";
import test from "node:test";
import { PantryService } from "./pantry.service";

test("冰箱分页在数据库内归并并限制结果行数", async () => {
  let query: { sql: string; values: unknown[] } | undefined;
  const service = new PantryService({
    $queryRaw: async (statement: { sql: string; values: unknown[] }) => {
      query = statement;
      return [{ id: 41, ingredientId: 7, name: "西红柿", categoryName: "蔬果菌菇", kind: "PURCHASED",
        recordedAt: new Date("2026-09-24T00:00:00.000Z"), windowDays: 7, presence: "PRESENT",
        archived: false, recentlyPurchased: true, label: "最近买过", total: 51 }];
    }
  } as never, {} as never, {} as never, {} as never);

  const result = await service.listFridgeTraces(9, 2, 25);

  assert.match(query?.sql ?? "", /DISTINCT ON/);
  assert.match(query?.sql ?? "", /LIMIT/);
  assert.match(query?.sql ?? "", /OFFSET/);
  assert.deepEqual(query?.values, [9, 25, 25]);
  assert.equal(result.total, 51);
  assert.equal(result.items.length, 1);
  assert.equal(result.hasNext, true);
});
