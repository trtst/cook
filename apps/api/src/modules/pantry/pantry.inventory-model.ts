import { Prisma } from "@prisma/client";

export interface InventoryReservationRecord {
  shoppingListId: number;
  shoppingListName: string;
  shoppingItemId: number;
  reservedText: string;
}

export interface InventoryBatchRecord {
  id: number;
  ingredientId: number | null;
  name: string;
  categoryName: string | null;
  quantityText: string | null;
  exactQuantity: Prisma.Decimal | number | string | null;
  exactUnitId: number | null;
  exactUnitName: string | null;
  note: string | null;
  available: boolean;
  version: number;
  expireAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  reservedQuantity: Prisma.Decimal | number | string | null;
  reservations: InventoryReservationRecord[];
}

export interface FridgeBatchSummary {
  id: number;
  ingredientId: number | null;
  name: string;
  quantityText: string | null;
  exactQuantity: string | null;
  exactUnitId: number | null;
  exactUnitName: string | null;
  note: string | null;
  available: boolean;
  expireAt: string | null;
  isExpired: boolean;
  isExpiredWithin15Days: boolean;
  stockText: string | null;
  reservedText: string | null;
  availableText: string | null;
  reservations: InventoryReservationRecord[];
  needsConfirmation: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FridgeStockGroup {
  unitId: number;
  unitName: string;
  quantity: string;
  batchCount: number;
}

export interface FridgeIngredientSummary {
  id: number;
  ingredientId: number | null;
  categoryName: string | null;
  name: string;
  stockText: string;
  stockGroups: FridgeStockGroup[];
  expireAt: string | null;
  isExpired: boolean;
  expiredBatchCount: number;
  batchCount: number;
  hasReservation: boolean;
  needsConfirmation: boolean;
  identityPending: boolean;
  updatedAt: string;
  batches: FridgeBatchSummary[];
}

function decimal(value: Prisma.Decimal | number | string | null) {
  return value === null ? null : new Prisma.Decimal(value);
}

function iso(value: Date | string | null) {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function formatQuantity(quantity: Prisma.Decimal, unitName: string) {
  return `${quantity.toString()} ${unitName}`;
}

function compareBatch(left: FridgeBatchSummary, right: FridgeBatchSummary) {
  if (left.expireAt === null && right.expireAt !== null) return 1;
  if (left.expireAt !== null && right.expireAt === null) return -1;
  if (left.expireAt !== null && right.expireAt !== null) {
    const expireDiff = left.expireAt.localeCompare(right.expireAt);
    if (expireDiff !== 0) return expireDiff;
  }
  const createdDiff = left.createdAt.localeCompare(right.createdAt);
  return createdDiff || left.id - right.id;
}

function maxIso(values: string[]) {
  return values.reduce((latest, value) => (value > latest ? value : latest), "");
}

function buildBatchSummary(row: InventoryBatchRecord, now: Date): FridgeBatchSummary {
  const exactQuantity = decimal(row.exactQuantity);
  const reservedQuantity = decimal(row.reservedQuantity) ?? new Prisma.Decimal(0);
  const hasExactAmount = exactQuantity !== null && row.exactUnitId !== null && Boolean(row.exactUnitName);
  const stockText = hasExactAmount ? formatQuantity(exactQuantity, row.exactUnitName!) : row.quantityText;
  const availableQuantity = hasExactAmount ? Prisma.Decimal.max(exactQuantity.sub(reservedQuantity), 0) : null;
  const reservedText = hasExactAmount && reservedQuantity.gt(0) ? formatQuantity(reservedQuantity, row.exactUnitName!) : null;
  const availableText = hasExactAmount ? formatQuantity(availableQuantity!, row.exactUnitName!) : stockText;
  const expireAt = iso(row.expireAt);
  const isExpired = expireAt !== null && new Date(expireAt).getTime() <= now.getTime();
  const isExpiredWithin15Days = isExpired && now.getTime() - new Date(expireAt).getTime() <= 15 * 86_400_000;

  return {
    id: row.id,
    ingredientId: row.ingredientId!,
    name: row.name,
    quantityText: row.quantityText,
    exactQuantity: exactQuantity?.toString() ?? null,
    exactUnitId: row.exactUnitId,
    exactUnitName: row.exactUnitName,
    note: row.note,
    available: row.available && (exactQuantity === null || exactQuantity.gt(0)),
    expireAt,
    isExpired,
    isExpiredWithin15Days,
    stockText,
    reservedText,
    availableText,
    reservations: row.reservations,
    needsConfirmation: !hasExactAmount,
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!
  };
}

function buildStockGroups(batches: FridgeBatchSummary[]) {
  const groups = new Map<number, FridgeStockGroup>();
  for (const batch of batches) {
    if (!batch.available || batch.exactQuantity === null || batch.exactUnitId === null || !batch.exactUnitName) continue;
    const current = groups.get(batch.exactUnitId);
    if (current) {
      current.quantity = new Prisma.Decimal(current.quantity).add(batch.exactQuantity).toString();
      current.batchCount += 1;
      continue;
    }
    groups.set(batch.exactUnitId, {
      unitId: batch.exactUnitId,
      unitName: batch.exactUnitName,
      quantity: batch.exactQuantity,
      batchCount: 1
    });
  }

  return [...groups.values()].sort((left, right) => {
    const leftBatch = batches.find(batch => batch.exactUnitId === left.unitId);
    const rightBatch = batches.find(batch => batch.exactUnitId === right.unitId);
    return (leftBatch ? batches.indexOf(leftBatch) : Number.MAX_SAFE_INTEGER) - (rightBatch ? batches.indexOf(rightBatch) : Number.MAX_SAFE_INTEGER);
  });
}

function buildStockText(batches: FridgeBatchSummary[], stockGroups: FridgeStockGroup[]) {
  const exactText = stockGroups.map(group => `${group.quantity} ${group.unitName}`);
  const vagueText = batches
    .filter(batch => batch.available && batch.needsConfirmation && batch.stockText)
    .map(batch => batch.stockText!);
  return [...exactText, ...vagueText].join(" + ") || "未填库存";
}

export function buildEmptyFridgeIngredientSummary(rows: InventoryBatchRecord[]): FridgeIngredientSummary {
  const latest = [...rows].sort((left, right) => {
    const updatedDiff = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    return updatedDiff || right.id - left.id;
  })[0];
  if (!latest) {
    throw new Error("无法为空库存构建食材摘要");
  }

  return {
    id: latest.ingredientId ?? latest.id,
    ingredientId: latest.ingredientId,
    categoryName: latest.categoryName,
    name: latest.name,
    stockText: "已用完",
    stockGroups: [],
    expireAt: null,
    isExpired: false,
    expiredBatchCount: 0,
    batchCount: 0,
    hasReservation: false,
    needsConfirmation: rows.some(row => row.exactQuantity === null || row.exactUnitId === null || !row.exactUnitName),
    identityPending: latest.ingredientId === null,
    updatedAt: maxIso(rows.map(row => iso(row.updatedAt)!)),
    batches: []
  };
}

export function groupFridgeBatches(rows: InventoryBatchRecord[], now = new Date()): FridgeIngredientSummary[] {
  const grouped = new Map<string, { ingredientId: number | null; id: number; records: InventoryBatchRecord[] }>();
  for (const row of rows) {
    if (!row.available) continue;
    const key = row.ingredientId === null ? `legacy:${row.id}` : `ingredient:${row.ingredientId}`;
    const current = grouped.get(key) ?? { ingredientId: row.ingredientId, id: row.ingredientId ?? row.id, records: [] };
    current.records.push(row);
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map(group => {
      const { ingredientId, id, records } = group;
      const batches = records.map(row => buildBatchSummary(row, now)).filter(batch => batch.available).sort(compareBatch);
      const stockGroups = buildStockGroups(batches);
      const first = batches[0]!;
      const expiredBatches = batches.filter(batch => batch.isExpired);
      return {
        id,
        ingredientId,
        categoryName: records[0]?.categoryName ?? null,
        name: first.name,
        stockText: buildStockText(batches, stockGroups),
        stockGroups,
        expireAt: batches.find(batch => batch.expireAt !== null)?.expireAt ?? null,
        isExpired: expiredBatches.length > 0,
        expiredBatchCount: expiredBatches.length,
        batchCount: batches.length,
        hasReservation: batches.some(batch => batch.reservations.length > 0),
        needsConfirmation: batches.some(batch => batch.needsConfirmation),
        identityPending: ingredientId === null,
        updatedAt: maxIso(batches.map(batch => batch.updatedAt)),
        batches
      } satisfies FridgeIngredientSummary;
    })
    .sort((left, right) => {
      const expireDiff = (left.expireAt ?? "9999").localeCompare(right.expireAt ?? "9999");
      return expireDiff || left.name.localeCompare(right.name) || left.id - right.id;
    });
}

export function buildFridgeBatchSummary(row: InventoryBatchRecord, now = new Date()) {
  return buildBatchSummary(row, now);
}
