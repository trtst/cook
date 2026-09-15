import assert from "node:assert/strict";
import test from "node:test";

test("idempotency migration preflight reports each duplicate unique scope and fails closed", async () => {
  const { auditIdempotencyRecordDuplicates, assertNoIdempotencyRecordDuplicates } = await import("./verify-idempotency-migration-preflight");
  const result = await auditIdempotencyRecordDuplicates({
    findDuplicates: async (scope: string) => {
      if (scope === "user-no-group") return [{ operationId: "10001", operationType: "meal:create", userId: 7, duplicateCount: 2 }];
      if (scope === "user-group") return [{ operationId: "10002", operationType: "poll:vote", userId: 7, diningGroupId: 8, duplicateCount: 2 }];
      return [{ operationId: "10003", operationType: "admin:recipe", adminId: 9, duplicateCount: 3 }];
    }
  });

  assert.deepEqual(result.map(item => item.scope), ["user-no-group", "user-group", "admin"]);
  assert.throws(() => assertNoIdempotencyRecordDuplicates(result), /idempotency migration preflight failed/);
});

test("idempotency migration preflight passes only when all three scopes are duplicate-free", async () => {
  const { auditIdempotencyRecordDuplicates, assertNoIdempotencyRecordDuplicates } = await import("./verify-idempotency-migration-preflight");
  const result = await auditIdempotencyRecordDuplicates({
    findDuplicates: async () => []
  });

  assert.deepEqual(result, [
    { scope: "user-no-group", duplicates: [] },
    { scope: "user-group", duplicates: [] },
    { scope: "admin", duplicates: [] }
  ]);
  assert.doesNotThrow(() => assertNoIdempotencyRecordDuplicates(result));
});
