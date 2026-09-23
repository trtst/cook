import type { Prisma } from "@prisma/client";

export type InventoryIngredientStatus = "ACTIVE" | "DISABLED" | "MERGED" | "PENDING" | null;

export interface InventoryAuditRow {
  id: number;
  ingredientId: number | null;
  ingredientStatus: InventoryIngredientStatus;
  mergedToId: number | null;
  quantityText: string | null;
  exactQuantity: Prisma.Decimal | number | string | null;
  exactUnitId: number | null;
  available: boolean;
  expireAt: Date | null;
}

export interface InventoryAuditReport {
  missingIngredientIds: number[];
  mergedIngredientIds: Array<{ id: number; targetId: number }>;
  fuzzyQuantityIds: number[];
  invalidQuantityIds: number[];
  expiredAvailableIds: number[];
}

export function inspectInventoryRows(rows: InventoryAuditRow[], now = new Date()): InventoryAuditReport {
  const report: InventoryAuditReport = {
    missingIngredientIds: [],
    mergedIngredientIds: [],
    fuzzyQuantityIds: [],
    invalidQuantityIds: [],
    expiredAvailableIds: []
  };

  for (const row of rows) {
    if (row.ingredientId === null) {
      report.missingIngredientIds.push(row.id);
    } else if (row.ingredientStatus === "MERGED" && row.mergedToId !== null) {
      report.mergedIngredientIds.push({ id: row.id, targetId: row.mergedToId });
    }

    if (row.exactQuantity === null || row.exactUnitId === null) {
      if (row.quantityText) report.fuzzyQuantityIds.push(row.id);
    } else if (Number(row.exactQuantity) <= 0) {
      report.invalidQuantityIds.push(row.id);
    }

    if (row.available && row.expireAt !== null && row.expireAt.getTime() <= now.getTime()) {
      report.expiredAvailableIds.push(row.id);
    }
  }

  return report;
}

interface InventoryAuditReader {
  fridgeItem: {
    findMany(args: {
      select: {
        id: true;
        ingredientId: true;
        quantityText: true;
        exactQuantity: true;
        exactUnitId: true;
        available: true;
        expireAt: true;
        ingredient: {
          select: {
            status: true;
            mergedToId: true;
          };
        };
      };
    }): Promise<Array<{
      id: number;
      ingredientId: number | null;
      quantityText: string | null;
      exactQuantity: Prisma.Decimal | null;
      exactUnitId: number | null;
      available: boolean;
      expireAt: Date | null;
      ingredient: {
        status: InventoryIngredientStatus;
        mergedToId: number | null;
      } | null;
    }>>;
  };
}

export async function runInventoryAudit(reader: InventoryAuditReader, now = new Date()): Promise<InventoryAuditReport> {
  const rows = await reader.fridgeItem.findMany({
    select: {
      id: true,
      ingredientId: true,
      quantityText: true,
      exactQuantity: true,
      exactUnitId: true,
      available: true,
      expireAt: true,
      ingredient: {
        select: {
          status: true,
          mergedToId: true
        }
      }
    }
  });

  return inspectInventoryRows(
    rows.map(row => ({
      id: row.id,
      ingredientId: row.ingredientId,
      ingredientStatus: row.ingredient?.status ?? null,
      mergedToId: row.ingredient?.mergedToId ?? null,
      quantityText: row.quantityText,
      exactQuantity: row.exactQuantity,
      exactUnitId: row.exactUnitId,
      available: row.available,
      expireAt: row.expireAt
    })),
    now
  );
}
