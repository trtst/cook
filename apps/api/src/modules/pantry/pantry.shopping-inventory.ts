import type { InventoryAvailabilityState } from "./pantry.low-friction-model";

export interface StockInInput {
  itemId: number;
  ingredientId: number | null;
  name: string;
  explicitQuantity: string | null;
  explicitUnitId: number | null;
  explicitUnitName: string | null;
  explicitExpireAt: string | null;
}

export interface StockInResult {
  itemId: number;
  ingredientId: number | null;
  name: string;
  quantityText: string | null;
  exactQuantity: string | null;
  exactUnitId: number | null;
  expireAt: string | null;
  availabilityState: InventoryAvailabilityState;
}

export function buildAutomaticStockIn(input: StockInInput): StockInResult {
  const hasExactQuantity = Boolean(input.explicitQuantity?.trim())
    && input.explicitUnitId !== null
    && Boolean(input.explicitUnitName?.trim());
  const exactQuantity = hasExactQuantity ? input.explicitQuantity!.trim() : null;
  const exactUnitId = hasExactQuantity ? input.explicitUnitId : null;

  return {
    itemId: input.itemId,
    ingredientId: input.ingredientId,
    name: input.name,
    quantityText: hasExactQuantity ? `${exactQuantity} ${input.explicitUnitName!.trim()}` : null,
    exactQuantity,
    exactUnitId,
    expireAt: input.explicitExpireAt,
    availabilityState: hasExactQuantity ? "READY" : "UNKNOWN"
  };
}
