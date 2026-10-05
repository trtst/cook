import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { deletePrimaryWhere, snapshotRowValues, snapshotUpsertArgs, snapshotReplacementKey } from "./admin-system-data-snapshot.service";

test("builds scalar Prisma filters for deleting rows with a composite primary key", () => {
  assert.deepEqual(deletePrimaryWhere("UserNotificationRead", {
    userId: 52738164,
    notificationId: "official:1103"
  }), {
    userId: 52738164,
    notificationId: "official:1103"
  });
});

test("maps null nullable JSON snapshot fields to database NULL", () => {
  const values = snapshotRowValues("RecipeCookAssistant", {
    status: "PENDING",
    candidateJson: null,
    snapshotJson: null,
    generatedAt: null,
    lastError: null
  });

  assert.equal(values.candidateJson, Prisma.DbNull);
  assert.equal(values.snapshotJson, Prisma.DbNull);
  assert.equal(values.generatedAt, null);
  assert.equal(values.lastError, null);
});

test("matches medal template snapshot rows by stable code instead of local auto id", () => {
  const first = snapshotReplacementKey("MedalTemplate", { id: 1, code: "FIRST_MEAL" });
  const sameMedal = snapshotReplacementKey("MedalTemplate", { id: 92, code: "FIRST_MEAL" });
  assert.equal(first, sameMedal);
});

test("updates medal templates by code while preserving the target database id", () => {
  const args = snapshotUpsertArgs("MedalTemplate", {
    id: 92,
    code: "FIRST_MEAL",
    name: "第一次完成一餐"
  }) as { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> };

  assert.deepEqual(args.where, { code: "FIRST_MEAL" });
  assert.equal(args.create.id, 92);
  assert.equal(args.update.name, "第一次完成一餐");
  assert.equal("id" in args.update, false);
  assert.equal("code" in args.update, false);
});
