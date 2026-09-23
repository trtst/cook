import assert from "node:assert/strict";
import test from "node:test";
import { buildFridgeCorrectionPatch, type FridgeCorrectionMode } from "./pantry.inventory-correction";
import { PantryService } from "./pantry.service";

test("rough correction keeps the ingredient available without an exact quantity", () => {
  assert.deepEqual(buildFridgeCorrectionPatch("ROUGH"), {
    quantityText: "快用完",
    exactQuantity: null,
    exactUnitId: null,
    available: true
  });
});

test("empty correction removes the ingredient from current stock", () => {
  const mode: FridgeCorrectionMode = "EMPTY";
  assert.deepEqual(buildFridgeCorrectionPatch(mode), {
    quantityText: "已用完",
    exactQuantity: null,
    exactUnitId: null,
    available: false
  });
});

test("updates multiple inventory batches under one idempotent transaction", async () => {
  const updates: unknown[] = [];
  let transactionCount = 0;
  const tx = {
    $queryRaw: async () => [],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    fridgeItem: {
      findMany: async () => [
        { id: 11, userId: 1, ingredientId: null, name: "土豆", expireAt: null, note: null },
        { id: 12, userId: 1, ingredientId: null, name: "土豆", expireAt: null, note: null }
      ],
      update: async (args: unknown) => {
        updates.push(args);
        return { id: updates.length, available: false };
      }
    },
    storageLedger: { upsert: async () => undefined }
  };
  const prisma = {
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => {
      transactionCount += 1;
      return callback(tx);
    }
  };
  const service = new PantryService(prisma as never, {} as never, {} as never, {} as never);
  (service as any).assertStorageWritable = async () => undefined;
  (service as any).buildFridgeWriteInput = async () => ({
    ingredientId: null,
    name: "土豆",
    quantityText: "已用完",
    exactQuantity: null,
    exactUnitId: null,
    expireAt: null,
    note: null
  });
  (service as any).loadFridgeItemSummaryFromTx = async (_tx: unknown, _userId: number, itemId: number) => ({ id: itemId });

  const result = await (service as any).updateFridgeItems(1, [11, 12], "batch-op", false, "已用完", null, null);

  assert.equal(transactionCount, 1);
  assert.equal(updates.length, 2);
  assert.deepEqual(result, [{ id: 11 }, { id: 12 }]);
});
