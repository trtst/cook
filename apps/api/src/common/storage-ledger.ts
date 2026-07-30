import type { Prisma, StorageLedgerModule } from "@prisma/client";

const minRecordBytes = 1024;

function byteLength(value: string) {
  return Buffer.byteLength(value, "utf8");
}

export function sizeOfJson(value: unknown) {
  return Math.max(minRecordBytes, byteLength(JSON.stringify(value)));
}

export function sizeOfText(value: string | null | undefined) {
  return Math.max(minRecordBytes, byteLength(value ?? ""));
}

export function sumImageBytes(images: Array<{ sizeBytes: number }>) {
  return images.reduce((total, image) => total + Math.max(0, image.sizeBytes), 0);
}

export function upsertStorageLedger(
  tx: Prisma.TransactionClient,
  userId: number,
  module: StorageLedgerModule,
  recordKey: string | number,
  usedBytes: number
) {
  const normalizedKey = String(recordKey);
  return tx.storageLedger.upsert({
    where: {
      userId_module_recordKey: {
        userId,
        module,
        recordKey: normalizedKey
      }
    },
    update: { usedBytes },
    create: {
      userId,
      module,
      recordKey: normalizedKey,
      usedBytes
    }
  });
}

export function removeStorageLedger(
  tx: Prisma.TransactionClient,
  userId: number,
  module: StorageLedgerModule,
  recordKey: string | number
) {
  const normalizedKey = String(recordKey);
  return tx.storageLedger.deleteMany({
    where: {
      userId,
      module,
      recordKey: normalizedKey
    }
  });
}
