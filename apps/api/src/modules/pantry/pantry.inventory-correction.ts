export type FridgeCorrectionMode = "ROUGH" | "EMPTY";

export function buildFridgeCorrectionPatch(mode: FridgeCorrectionMode) {
  return {
    quantityText: mode === "ROUGH" ? "快用完" : "已用完",
    exactQuantity: null,
    exactUnitId: null,
    available: mode === "ROUGH"
  } as const;
}
