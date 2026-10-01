import type { Prisma, StorageLedgerModule } from "@prisma/client";

// 个人空间计量暂缓；保留调用边界，恢复计量时再统一启用。
export function sizeOfJson(_value: unknown) {
  return 0;
}

export function sizeOfText(_value: string | null | undefined) {
  return 0;
}

export function sumImageBytes(_images: Array<{ sizeBytes: number }>) {
  return 0;
}

export function upsertStorageLedger(
  _tx: Prisma.TransactionClient,
  _userId: number,
  _module: StorageLedgerModule,
  _recordKey: string | number,
  _usedBytes: number
) {
  return Promise.resolve(null);
}

export function removeStorageLedger(
  _tx: Prisma.TransactionClient,
  _userId: number,
  _module: StorageLedgerModule,
  _recordKey: string | number
) {
  return Promise.resolve(null);
}
