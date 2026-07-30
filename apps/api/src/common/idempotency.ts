import type { Prisma } from "@prisma/client";
import { ConflictException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { IDEMPOTENCY_KEY_HEADER } from "./idempotency-key";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function fromJson<T>(value: unknown): T {
  return value as T;
}

function toRequestHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function lockOperation(tx: Prisma.TransactionClient, key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}

export async function getIdempotentResult<T>(
  db: Prisma.TransactionClient,
  operationId: string,
  operationType: string,
  userId: number,
  diningGroupId: number | null,
  requestHash: string
): Promise<T | null> {
  await lockOperation(db, `USER:${userId}:${operationType}:${operationId}`);
  const normalizedHash = toRequestHash(requestHash);
  const record = await db.idempotencyRecord.findFirst({
    where: { operationId, operationType, userId, diningGroupId },
    orderBy: { createdAt: "asc" }
  });
  if (!record) return null;
  if (record.requestHash !== normalizedHash) throw new ConflictException(`${IDEMPOTENCY_KEY_HEADER} 已用于其他请求`);
  return record.status === "SUCCEEDED" && record.resultJson ? fromJson<T>(record.resultJson) : null;
}

export async function getAdminIdempotentResult<T>(
  tx: Prisma.TransactionClient,
  operationId: string,
  operationType: string,
  adminId: number,
  requestHash: string
): Promise<T | null> {
  await lockOperation(tx, `ADMIN:${adminId}:${operationType}:${operationId}`);
  const normalizedHash = toRequestHash(requestHash);
  const record = await tx.idempotencyRecord.findFirst({
    where: { operationId, operationType, adminId },
    orderBy: { createdAt: "asc" }
  });
  if (!record) return null;
  if (record.requestHash !== normalizedHash) throw new ConflictException(`${IDEMPOTENCY_KEY_HEADER} 已用于其他请求`);
  return record.status === "SUCCEEDED" && record.resultJson ? fromJson<T>(record.resultJson) : null;
}

export function startAdminIdempotentOperation(
  tx: Prisma.TransactionClient,
  operationId: string,
  operationType: string,
  adminId: number,
  requestHash: string
) {
  return tx.idempotencyRecord.create({
    data: {
      operationId,
      operationType,
      adminId,
      requestHash: toRequestHash(requestHash),
      status: "PROCESSING"
    }
  });
}

export function completeAdminIdempotentOperation<T>(
  tx: Prisma.TransactionClient,
  operationId: string,
  operationType: string,
  adminId: number,
  requestHash: string,
  result: T
) {
  return tx.idempotencyRecord.updateMany({
    where: {
      operationId,
      operationType,
      adminId,
      requestHash: toRequestHash(requestHash),
      status: "PROCESSING"
    },
    data: {
      status: "SUCCEEDED",
      resultJson: toJson(result)
    }
  });
}

export function startIdempotentOperation(
  tx: Prisma.TransactionClient,
  operationId: string,
  operationType: string,
  userId: number,
  diningGroupId: number | null,
  requestHash: string
) {
  const normalizedHash = toRequestHash(requestHash);
  return tx.idempotencyRecord.create({
    data: {
      operationId,
      operationType,
      userId,
      diningGroupId,
      requestHash: normalizedHash,
      status: "PROCESSING"
    }
  });
}

export function completeIdempotentOperation<T>(
  tx: Prisma.TransactionClient,
  operationId: string,
  operationType: string,
  userId: number,
  diningGroupId: number | null,
  requestHash: string,
  result: T
) {
  const normalizedHash = toRequestHash(requestHash);
  return tx.idempotencyRecord.updateMany({
    where: {
      operationId,
      operationType,
      userId,
      diningGroupId,
      requestHash: normalizedHash,
      status: "PROCESSING"
    },
    data: {
      status: "SUCCEEDED",
      resultJson: toJson(result)
    }
  });
}
